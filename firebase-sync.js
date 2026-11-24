// ==========================================
// Firebase Realtime Database 실시간 멀티플레이 동기화 모듈
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    databaseURL: "https://english-party-3d-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let db = null;
const myPlayerId = "p_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
window.myPlayerId = myPlayerId;

let lastHandledTriggerId = 0;
let lastHandledMinigameStartId = 0;
let lastLobbySyncTime = 0;
let myLobbyRef = null;
let cachedLobbyPlayers = {};

try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    console.log("🔥 Firebase 초기화 성공! ID:", myPlayerId);
    subscribeLobbyPlayers();
} catch (err) {
    console.error("❌ Firebase 연결 오류:", err);
}

// ==========================================
// 1. 로비(포탈 들판) 실시간 위치 & 밀치기 동기화
// ==========================================
function subscribeLobbyPlayers() {
    if (!db) return;
    const lobbyRef = ref(db, "lobby_players");
    onValue(lobbyRef, (snapshot) => {
        const allPlayers = snapshot.val() || {};
        cachedLobbyPlayers = allPlayers;
        window.latestLobbyPlayers = allPlayers;
        if (typeof window.onLobbyPlayersUpdated === "function") {
            window.onLobbyPlayersUpdated(allPlayers, myPlayerId);
        }
    }, (error) => {
        console.error("❌ Firebase lobby_players 읽기 오류 (DB 규칙을 확인하세요!):", error);
    });
}

window.syncJoinLobby = function(playerData) {
    if (!db) return;
    myLobbyRef = ref(db, `lobby_players/${myPlayerId}`);
    onDisconnect(myLobbyRef).remove();
    set(myLobbyRef, {
        ...playerData,
        id: myPlayerId,
        inLobby: true,
        updatedAt: Date.now()
    }).then(() => {
        if (typeof window.onLobbyPlayersUpdated === "function") {
            window.onLobbyPlayersUpdated(cachedLobbyPlayers, myPlayerId);
        }
    }).catch((err) => {
        console.error("❌ Firebase lobby_players 쓰기 오류:", err);
    });
};

window.syncUpdateLobbyState = function(playerData, force = false) {
    if (!db) return;
    const now = Date.now();
    if (!force && now - lastLobbySyncTime < 75) return;
    lastLobbySyncTime = now;

    if (!myLobbyRef) {
        myLobbyRef = ref(db, `lobby_players/${myPlayerId}`);
        onDisconnect(myLobbyRef).remove();
    }
    update(myLobbyRef, {
        ...playerData,
        id: myPlayerId,
        updatedAt: now
    });
};

window.syncLobbyShove = function(targetId, pushVx, pushVz) {
    if (!db || !myLobbyRef) return;
    update(myLobbyRef, {
        shoveEventId: Date.now(),
        shoveTargetId: targetId || "",
        shoveVx: pushVx || 0,
        shoveVz: pushVz || 0,
        updatedAt: Date.now()
    });
};

// ==========================================
// 2. 파티 룸(방 생성 / 참가 / 룰렛) 동기화
// ==========================================
window.syncCreateRoom = async function(roomInfo, hostMember) {
    if (!db) return;
    const code = roomInfo.code;
    await set(ref(db, `rooms/${code}`), {
        code: code,
        hostId: myPlayerId,
        maxMembers: 4,
        totalRounds: roomInfo.totalRounds,
        currentRound: 1,
        rouletteTriggerId: 0,
        rouletteTargetIndex: 0,
        minigameState: null,
        members: {
            [myPlayerId]: {
                ...hostMember,
                id: myPlayerId,
                points: 0,
                joinedAt: Date.now()
            }
        }
    });
    subscribeRoom(code);
};

window.syncJoinRoom = async function(code, guestMember) {
    if (!db) return { ok: false, error: "서버 연결 중입니다. 잠시 후 다시 시도하세요." };
    const roomSnap = await get(ref(db, `rooms/${code}`));
    if (!roomSnap.exists()) {
        return { ok: false, error: "존재하지 않는 방 번호입니다!" };
    }
    const roomData = roomSnap.val();
    const currentMembers = roomData.members ? Object.keys(roomData.members) : [];
    const maxCap = roomData.maxMembers || 4;
    if (!currentMembers.includes(myPlayerId) && currentMembers.length >= maxCap) {
        return { ok: false, error: `⚠️ 방 정원이 가득 찼습니다! (최대 ${maxCap}명)` };
    }

    await set(ref(db, `rooms/${code}/members/${myPlayerId}`), {
        ...guestMember,
        id: myPlayerId,
        points: 0,
        joinedAt: Date.now()
    });
    subscribeRoom(code);
    return { ok: true, totalRounds: roomData.totalRounds || 5 };
};

window.syncSpinRoulette = async function(code, triggerId, targetIdx) {
    if (!db || !code) return;
    lastHandledTriggerId = triggerId;
    await update(ref(db, `rooms/${code}`), {
        rouletteTriggerId: triggerId,
        rouletteTargetIndex: targetIdx
    });
};

// ==========================================
// 3. 공통 미니게임 실시간 동기화
// ==========================================
window.syncStartMinigame = async function(code, gameType = 'BOMB_DEFUSAL') {
    if (!db || !code) return;
    const startId = Date.now();
    lastHandledMinigameStartId = startId;
    await update(ref(db, `rooms/${code}`), {
        minigameState: {
            type: gameType,
            startId: startId,
            startedAt: startId,
            seed: Math.floor(Math.random() * 100000),
            scores: {},
            players: {}
        }
    });
};

window.syncUpdateMinigameScore = function(code, score) {
    if (!db || !code) return;
    update(ref(db, `rooms/${code}/minigameState/scores`), {
        [myPlayerId]: score
    });
};

window.syncWallPlayerState = function(code, stateObj) {
    if (!db || !code) return;
    update(ref(db, `rooms/${code}/minigameState/players/${myPlayerId}`), {
        ...stateObj,
        updatedAt: Date.now()
    });
};

window.syncPlayerMinigameFinished = function(code) {
    if (!db || !code) return;
    update(ref(db, `rooms/${code}/minigameState/finishedPlayers`), {
        [myPlayerId]: true
    });
};

window.syncReturnToPartyRoom = async function(code, nextRound) {
    if (!db || !code) return;
    const payload = { minigameState: null };
    if (typeof nextRound === 'number') {
        payload.currentRound = nextRound;
    }
    await update(ref(db, `rooms/${code}`), payload);
};

window.syncSaveRoundPoints = async function(code, updatedMembers) {
    if (!db || !code || !Array.isArray(updatedMembers)) return;
    const updates = {};
    updatedMembers.forEach(m => {
        if (m.id) {
            updates[`rooms/${code}/members/${m.id}/points`] = m.points || 0;
        }
    });
    await update(ref(db), updates);
};

function subscribeRoom(code) {
    if (!db) return;
    const roomRef = ref(db, `rooms/${code}`);
    onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data || !window.currentRoomInfo) return;

        window.currentRoomInfo.totalRounds = data.totalRounds || 5;
        window.currentRoomInfo.currentRound = data.currentRound || 1;

        if (data.members) {
            const memberList = Object.values(data.members);
            memberList.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
            window.currentRoomInfo.members = memberList;
            if (typeof window.onRoomMembersUpdated === 'function') {
                window.onRoomMembersUpdated();
            }
        }

        const triggerId = Number(data.rouletteTriggerId || 0);
        if (triggerId > 0 && triggerId !== lastHandledTriggerId) {
            lastHandledTriggerId = triggerId;
            if (window.currentRoomInfo.role !== 'HOST' && typeof window.startRemoteRouletteSpin === 'function') {
                window.startRemoteRouletteSpin(data.rouletteTargetIndex || 0);
            }
        }

        if (data.minigameState && data.minigameState.type === 'BOMB_DEFUSAL') {
            const mg = data.minigameState;
            if (mg.startId && mg.startId !== lastHandledMinigameStartId) {
                lastHandledMinigameStartId = mg.startId;
                if (typeof window.enterBombDefusalMinigame === 'function') {
                    window.enterBombDefusalMinigame(mg.startedAt);
                }
            }
            if (mg.scores && typeof window.onBombScoresUpdated === 'function') {
                window.onBombScoresUpdated(mg.scores);
            }
            if (typeof window.onMinigameFinishedPlayersUpdated === 'function') {
                window.onMinigameFinishedPlayersUpdated(mg.finishedPlayers || {});
            }
        } else if (data.minigameState && data.minigameState.type === 'GRAMMAR_WALL') {
            const mg = data.minigameState;
            if (mg.startId && mg.startId !== lastHandledMinigameStartId) {
                lastHandledMinigameStartId = mg.startId;
                if (typeof window.enterGrammarWallMinigame === 'function') {
                    window.enterGrammarWallMinigame(mg.seed || mg.startedAt);
                }
            }
            if (mg.players && typeof window.onWallPlayersUpdated === 'function') {
                window.onWallPlayersUpdated(mg.players);
            }
            if (typeof window.onMinigameFinishedPlayersUpdated === 'function') {
                window.onMinigameFinishedPlayersUpdated(mg.finishedPlayers || {});
            }
        } else if (!data.minigameState) {
            if (window.isBombMinigameActive && typeof window.exitBombMinigameToRoom === 'function') {
                window.exitBombMinigameToRoom();
            }
            if (window.isWallMinigameActive && typeof window.exitWallMinigameToRoom === 'function') {
                window.exitWallMinigameToRoom();
            }
        }
    });
}

if (window.pendingLobbyJoin) {
    window.syncJoinLobby(window.pendingLobbyJoin);
    window.pendingLobbyJoin = null;
}
