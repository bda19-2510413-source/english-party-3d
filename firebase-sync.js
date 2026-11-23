// ==========================================
// Firebase Realtime Database 실시간 멀티플레이 연동
// (로비 위치/밀치기 + 파티 룸 소파/룰렛 + 폭탄 해체 동기화)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD0Vf6Wi0-ShkHHEMriVmUXdhrrx-0b270",
    authDomain: "english-party-3d.firebaseapp.com",
    databaseURL: "https://english-party-3d-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "english-party-3d",
    storageBucket: "english-party-3d.firebasestorage.app",
    messagingSenderId: "228674994941",
    appId: "1:228674994941:web:075b92a2972bd5967d3494",
    measurementId: "G-X50RP54RVJ"
};

let db = null;
const myPlayerId = 'player_' + Math.random().toString(36).substring(2, 10);
window.myPlayerId = myPlayerId;

try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
} catch (err) {
    console.error("Firebase 초기화 오류:", err);
}

// ==========================================
// 1. 로비(포탈 들판) 실시간 위치 & 밀치기 동기화
// ==========================================
let lobbySubscribed = false;
let lastLobbySyncTime = 0;

window.syncJoinLobby = function(playerData) {
    if (!db) return;
    const myLobbyRef = ref(db, `rooms/global_lobby/players/${myPlayerId}`);
    set(myLobbyRef, {
        id: myPlayerId,
        name: playerData.name,
        charType: playerData.charType,
        colorHex: playerData.colorHex,
        x: playerData.x,
        y: playerData.y,
        z: playerData.z,
        rotY: playerData.rotY,
        inLobby: true,
        shoveEventId: 0,
        shoveTargetId: '',
        shoveVx: 0,
        shoveVz: 0,
        updatedAt: Date.now()
    });
    onDisconnect(myLobbyRef).remove();

    if (!lobbySubscribed) {
        lobbySubscribed = true;
        onValue(ref(db, 'rooms/global_lobby/players'), (snap) => {
            const allPlayers = snap.val() || {};
            if (typeof window.onLobbyPlayersUpdated === 'function') {
                window.onLobbyPlayersUpdated(allPlayers, myPlayerId);
            }
        });
    }
};

window.syncUpdateLobbyState = function(playerData, force = false) {
    if (!db) return;
    const now = Date.now();
    if (!force && now - lastLobbySyncTime < 75) return;
    lastLobbySyncTime = now;

    update(ref(db, `rooms/global_lobby/players/${myPlayerId}`), {
        name: playerData.name,
        charType: playerData.charType,
        colorHex: playerData.colorHex,
        x: Number(playerData.x.toFixed(2)),
        y: Number(playerData.y.toFixed(2)),
        z: Number(playerData.z.toFixed(2)),
        rotY: Number(playerData.rotY.toFixed(2)),
        inLobby: playerData.inLobby,
        updatedAt: now
    });
};

// 좌클릭 시 상대 화면에도 밀치기 3D 모션과 충격파가 보이도록 전송
window.syncLobbyShove = function(targetId, vx, vz) {
    if (!db) return;
    update(ref(db, `rooms/global_lobby/players/${myPlayerId}`), {
        shoveEventId: Date.now(),
        shoveTargetId: targetId || '',
        shoveVx: Number(vx.toFixed(2)),
        shoveVz: Number(vz.toFixed(2))
    });
};

// ==========================================
// 2. 파티 룸(소파 & 모니터 룰렛) 동기화
// ==========================================
let lastHandledTriggerId = 0;

window.syncCreateRoom = async function(roomInfo, charInfo) {
    if (!db) return;
    lastHandledTriggerId = 0;
    const roomRef = ref(db, `rooms/${roomInfo.code}`);
    const memberObj = {
        id: myPlayerId,
        name: charInfo.name,
        emoji: charInfo.emoji,
        charType: charInfo.charType,
        colorHex: charInfo.colorHex,
        isHost: true,
        joinedAt: Date.now()
    };
    await set(roomRef, {
        code: roomInfo.code,
        totalRounds: roomInfo.totalRounds,
        currentRound: 1,
        rouletteTriggerId: 0,
        rouletteTargetIndex: 0,
        members: { [myPlayerId]: memberObj }
    });
    onDisconnect(ref(db, `rooms/${roomInfo.code}/members/${myPlayerId}`)).remove();
    subscribeRoom(roomInfo.code);
};

window.syncJoinRoom = async function(code, charInfo) {
    if (!db) return { ok: true, totalRounds: 5 };
    const roomRef = ref(db, `rooms/${code}`);
    const snap = await get(roomRef);
    if (!snap.exists()) {
        return { ok: false, error: '존재하지 않는 방 번호입니다!' };
    }
    const data = snap.val();
    lastHandledTriggerId = data.rouletteTriggerId || 0;

    const memberRef = ref(db, `rooms/${code}/members/${myPlayerId}`);
    await set(memberRef, {
        id: myPlayerId,
        name: charInfo.name,
        emoji: charInfo.emoji,
        charType: charInfo.charType,
        colorHex: charInfo.colorHex,
        isHost: false,
        joinedAt: Date.now()
    });
    onDisconnect(memberRef).remove();
    subscribeRoom(code);
    return { ok: true, totalRounds: data.totalRounds || 5 };
};

window.syncSpinRoulette = async function(code, triggerId, targetIndex) {
    if (!db || !code) return;
    lastHandledTriggerId = triggerId;
    await update(ref(db, `rooms/${code}`), {
        rouletteTriggerId: triggerId,
        rouletteTargetIndex: targetIndex
    });
};

// ==========================================
// 3. 폭탄 해체 미니게임 실시간 동기화
// ==========================================
let lastHandledMinigameStartId = 0;

window.syncStartBombMinigame = async function(code) {
    if (!db || !code) return;
    const startId = Date.now();
    lastHandledMinigameStartId = startId;
    await update(ref(db, `rooms/${code}`), {
        minigameState: {
            type: 'BOMB_DEFUSAL',
            startId: startId,
            startedAt: startId,
            scores: {}
        }
    });
};

window.syncUpdateBombScore = function(code, score) {
    if (!db || !code) return;
    update(ref(db, `rooms/${code}/minigameState/scores`), {
        [myPlayerId]: score
    });
};

window.syncReturnToPartyRoom = async function(code) {
    if (!db || !code) return;
    await update(ref(db, `rooms/${code}`), {
        minigameState: null
    });
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
        } else if (!data.minigameState && window.isBombMinigameActive) {
            if (typeof window.exitBombMinigameToRoom === 'function') {
                window.exitBombMinigameToRoom();
            }
        }
    });
}

if (window.pendingLobbyJoin) {
    window.syncJoinLobby(window.pendingLobbyJoin);
    window.pendingLobbyJoin = null;
}
