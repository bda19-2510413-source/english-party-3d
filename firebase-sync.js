// ==========================================
// Firebase Realtime Database 실시간 멀티플레이 연동
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// English Party 3D 실제 Firebase Realtime Database 설정
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

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        console.log("Firebase Realtime DB 연결 성공!");
    } else {
        console.warn("Firebase 설정값이 아직 기본값입니다. 로컬 테스트 모드로 동작합니다.");
    }
} catch (err) {
    console.error("Firebase 초기화 오류:", err);
}

// 방 생성 후 Firebase에 방 데이터 등록 및 실시간 구독
window.syncCreateRoom = async function(roomInfo, charInfo) {
    if (!db) return;
    const roomRef = ref(db, `rooms/${roomInfo.code}`);
    const memberObj = {
        id: myPlayerId,
        name: charInfo.name,
        emoji: charInfo.emoji,
        charType: charInfo.charType,
        colorHex: charInfo.colorHex,
        isHost: true
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

// 방 참가 시 Firebase에서 방 확인 후 입장
window.syncJoinRoom = async function(code, charInfo) {
    if (!db) return { ok: true, totalRounds: 5 };
    const roomRef = ref(db, `rooms/${code}`);
    const snap = await get(roomRef);
    if (!snap.exists()) {
        return { ok: false, error: '존재하지 않는 방 번호입니다!' };
    }
    const data = snap.val();
    const memberRef = ref(db, `rooms/${code}/members/${myPlayerId}`);
    await set(memberRef, {
        id: myPlayerId,
        name: charInfo.name,
        emoji: charInfo.emoji,
        charType: charInfo.charType,
        colorHex: charInfo.colorHex,
        isHost: false
    });
    onDisconnect(memberRef).remove();
    subscribeRoom(code);
    return { ok: true, totalRounds: data.totalRounds || 5 };
};

// 방장이 룰렛을 돌릴 때 모든 팀원에게 동일한 당첨 결과 방송
window.syncSpinRoulette = async function(code, triggerId, targetIndex) {
    if (!db || !code) return;
    await update(ref(db, `rooms/${code}`), {
        rouletteTriggerId: triggerId,
        rouletteTargetIndex: targetIndex
    });
};

let lastHandledTriggerId = 0;

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
            // 방장이 맨 앞에 오도록 정렬
            memberList.sort((a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0));
            window.currentRoomInfo.members = memberList;
            if (typeof window.onRoomMembersUpdated === 'function') {
                window.onRoomMembersUpdated();
            }
        }

        // 방장이 룰렛을 돌렸을 때 팀원 화면에서도 동일하게 룰렛 회전
        if (data.rouletteTriggerId && data.rouletteTriggerId !== lastHandledTriggerId) {
            lastHandledTriggerId = data.rouletteTriggerId;
            if (window.currentRoomInfo.role !== 'HOST' && typeof window.startRemoteRouletteSpin === 'function') {
                window.startRemoteRouletteSpin(data.rouletteTargetIndex || 0);
            }
        }
    });
}