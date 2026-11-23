// ==========================================
// 3. 공통 미니게임 실시간 동기화 (열몇 개 미니게임 공용)
// ==========================================
let lastHandledMinigameStartId = 0;

window.syncStartMinigame = async function(code, gameType = 'BOMB_DEFUSAL') {
    if (!db || !code) return;
    const startId = Date.now();
    lastHandledMinigameStartId = startId;
    await update(ref(db, `rooms/${code}`), {
        minigameState: {
            type: gameType,
            startId: startId,
            startedAt: startId,
            scores: {}
        }
    });
};

window.syncUpdateMinigameScore = function(code, score) {
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
