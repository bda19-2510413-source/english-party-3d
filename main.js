// ==========================================
// 전역 게임 상태, UI 컨트롤, 애니메이션 루프
// ==========================================
let scene, camera, renderer;
let clock = new THREE.Clock();

let selectedCharIndex = 0;
let selectedCharType = 'chameleon';
let selectedColorHex = 0x2ed573;
let playerNickname = '';
let isSelectingCharacter = true;
let playerChameleon;
let showcasePedestal;

let portalRing, portalInnerRing, portalInner, portalParticles = [];
let monitorCanvas, monitorCtx, monitorTexture;
let clouds = [], flowers = [];
let colliders = [];

const keys = { up: false, down: false, left: false, right: false };
let cameraAngle = 0;
let isDragging = false;
let dragDistance = 0;
let prevMouseX = 0;
let currentNearObject = null;
let shoveEffects = [];
let selectedTotalRounds = 5;
window.currentRoomInfo = null;

// 로비 다른 플레이어 3D 인스턴스 관리 맵
const remoteLobbyPlayers = {};

let lobbyGroup, partyRoomGroup, bombGameGroup;
let gamePhase = 'LOBBY';
let phaseTimer = 0;
let roomCharacterMap = {};
let tvCanvas, tvCtx, tvTexture;

// ==========================================
// 미니게임 1: 폭탄 해체하기 상태 및 초·중등 영단어 풀
// ==========================================
window.isBombMinigameActive = false;
let bombSubPhase = 'INTRO'; // 'INTRO' (3초 묶임 연출) | 'PLAY' (30초 타이핑) | 'RESULT' (1등 환호/폭발)
let bombPhaseElapsed = 0;
let bombStages = [];
let bombScoreMap = {};
let myBombScore = 0;
let currentBombWordObj = null;

const BOMB_WORD_BANK = [
    { en: 'APPLE', ko: '사과' }, { en: 'BANANA', ko: '바나나' }, { en: 'TIGER', ko: '호랑이' },
    { en: 'RABBIT', ko: '토끼' }, { en: 'SCHOOL', ko: '학교' }, { en: 'FRIEND', ko: '친구' },
    { en: 'HAPPY', ko: '행복한' }, { en: 'WATER', ko: '물' }, { en: 'MUSIC', ko: '음악' },
    { en: 'PLANET', ko: '행성' }, { en: 'ROCKET', ko: '로켓' }, { en: 'DRAGON', ko: '드래곤' },
    { en: 'CASTLE', ko: '성' }, { en: 'FOREST', ko: '숲' }, { en: 'OCEAN', ko: '바다' },
    { en: 'SUMMER', ko: '여름' }, { en: 'WINTER', ko: '겨울' }, { en: 'SPRING', ko: '봄' },
    { en: 'AUTUMN', ko: '가을' }, { en: 'DOCTOR', ko: '의사' }, { en: 'PILOT', ko: '조종사' },
    { en: 'ARTIST', ko: '예술가' }, { en: 'CAMERA', ko: '카메라' }, { en: 'GUITAR', ko: '기타' },
    { en: 'SOCCER', ko: '축구' }, { en: 'TENNIS', ko: '테니스' }, { en: 'CHEESE', ko: '치즈' },
    { en: 'COOKIE', ko: '쿠키' }, { en: 'ORANGE', ko: '오렌지' }, { en: 'PURPLE', ko: '보라색' },
    { en: 'YELLOW', ko: '노란색' }, { en: 'SILVER', ko: '은색' }, { en: 'GOLDEN', ko: '황금빛의' },
    { en: 'BRIDGE', ko: '다리' }, { en: 'ISLAND', ko: '섬' }, { en: 'DESERT', ko: '사막' },
    { en: 'MONKEY', ko: '원숭이' }, { en: 'TURTLE', ko: '거북이' }, { en: 'DOLPHIN', ko: '돌고래' },
    { en: 'PENGUIN', ko: '펭귄' }, { en: 'RAINBOW', ko: '무지개' }, { en: 'THUNDER', ko: '천둥' },
    { en: 'SHADOW', ko: '그림자' }, { en: 'MIRROR', ko: '거울' }, { en: 'WINDOW', ko: '창문' },
    { en: 'GARDEN', ko: '정원' }, { en: 'FLOWER', ko: '꽃' }, { en: 'BUTTERFLY', ko: '나비' },
    { en: 'MOUNTAIN', ko: '산' }, { en: 'VICTORY', ko: '승리' }, { en: 'DEFUSE', ko: '해체하다' }
];

const ROULETTE_GAMES = [
    { id: 'BOMB_DEFUSAL', title: 'BOMB DEFUSAL', subtitle: '30초 폭탄 해체 영단어 타이핑!', color: '#ff4757', icon: '💣' },
    { id: 'SPEED_VOCAB', title: 'SPEED VOCAB QUIZ', subtitle: '제한시간 영단어 스피드 퀴즈!', color: '#3742fa', icon: '⚡' },
    { id: 'WORD_SCRAMBLE', title: 'WORD SCRAMBLE', subtitle: '뒤섞인 알파벳 블록 맞추기!', color: '#2ed573', icon: '🔤' },
    { id: 'SENTENCE_BUILDER', title: 'SENTENCE BUILDER', subtitle: '영어 문장 순서 조립하기!', color: '#ffa502', icon: '🧩' },
    { id: 'MYSTERY_QA', title: 'MYSTERY 20 Q&A', subtitle: '스무고개 영어 힌트 추리!', color: '#9c88ff', icon: '🕵️' },
    { id: 'LISTENING_MATCH', title: 'LISTENING MATCH', subtitle: '발음 듣고 그림 카드 찾기!', color: '#1e90ff', icon: '🎧' }
];
let rouletteOffset = 0;
let rouletteVelocity = 0;
let rouletteTargetIndex = 0;
let rouletteState = 'IDLE';
let selectedRouletteGame = null;

function spawnShoveWave(pos, rotY) {
    const wave = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.34, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    wave.position.copy(pos);
    wave.rotation.y = rotY;
    lobbyGroup.add(wave);
    shoveEffects.push({ mesh: wave, life: 0.28, maxLife: 0.28 });
}

function setupEvents() {
    window.addEventListener('keydown', (e) => {
        if (e.target && e.target.tagName === 'INPUT') return;
        if (isSelectingCharacter) {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') prevCharacter();
            if (e.code === 'ArrowRight' || e.code === 'KeyD') nextCharacter();
            if (e.code === 'Enter') confirmCharacterSelection();
            return;
        }
        if (gamePhase !== 'LOBBY') return;

        if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = true;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = true;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
        if (e.code === 'Space') {
            e.preventDefault();
            if (currentNearObject) triggerInteraction();
            else if (playerChameleon) playerChameleon.jump();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
    });

    renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        dragDistance = 0;
        prevMouseX = e.clientX;
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - prevMouseX;
        dragDistance += Math.abs(deltaX);
        cameraAngle -= deltaX * 0.008;
        prevMouseX = e.clientX;
    });
    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        if (dragDistance < 6 && !isSelectingCharacter && gamePhase === 'LOBBY' && playerChameleon) {
            if (document.getElementById('custom-modal').classList.contains('hidden')) {
                playerChameleon.shove();
                handleLocalLobbyShove();
            }
        }
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function getPlayerNickname() {
    const input = document.getElementById('start-nickname-input');
    const val = input ? input.value.trim() : playerNickname.trim();
    return val || CHARACTER_TYPES[selectedCharIndex].name;
}

function onNicknameInput(val) {
    playerNickname = val;
    if (playerChameleon) playerChameleon.setNickname(getPlayerNickname());
}

function initCharacterSelectorUI() {
    const grid = document.getElementById('character-grid');
    grid.innerHTML = '';
    CHARACTER_TYPES.forEach((char, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.index = index;
        btn.className = 'char-card-btn jelly-btn flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl border-2 flex flex-col items-center justify-center bg-white/80 hover:bg-white shadow-sm';
        btn.innerHTML = `<span class="text-xl md:text-2xl">${char.emoji}</span>`;
        btn.title = char.name;
        btn.onclick = () => selectCharacterByIndex(index);
        grid.appendChild(btn);
    });

    const palette = document.getElementById('color-palette');
    palette.innerHTML = '';
    JELLY_COLORS.forEach((c) => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.dataset.hex = c.hex;
        swatch.className = 'color-swatch-btn jelly-btn w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white shadow-md';
        swatch.style.backgroundColor = c.css;
        swatch.title = c.name;
        swatch.onclick = () => selectCharacterColor(c.hex);
        palette.appendChild(swatch);
    });
    updateShowcaseUI();
}

function selectCharacterByIndex(index) {
    selectedCharIndex = (index + CHARACTER_TYPES.length) % CHARACTER_TYPES.length;
    const charInfo = CHARACTER_TYPES[selectedCharIndex];
    selectedCharType = charInfo.id;
    selectedColorHex = charInfo.defaultColor;
    if (playerChameleon) {
        playerChameleon.setAppearance(selectedCharType, selectedColorHex);
        playerChameleon.setNickname(getPlayerNickname());
        playerChameleon.jump();
    }
    updateShowcaseUI();
}

function prevCharacter() { selectCharacterByIndex(selectedCharIndex - 1); }
function nextCharacter() { selectCharacterByIndex(selectedCharIndex + 1); }

function selectCharacterColor(colorHex) {
    selectedColorHex = colorHex;
    if (playerChameleon) {
        playerChameleon.setColor(colorHex);
        playerChameleon.jump();
    }
    updateShowcaseUI();
}

function updateShowcaseUI() {
    const charInfo = CHARACTER_TYPES[selectedCharIndex];
    document.getElementById('showcase-emoji').textContent = charInfo.emoji;
    document.getElementById('showcase-name').textContent = charInfo.name;
    document.getElementById('showcase-index').textContent = `${selectedCharIndex + 1} / ${CHARACTER_TYPES.length}`;

    document.querySelectorAll('.char-card-btn').forEach((btn, idx) => {
        btn.classList.toggle('border-indigo-500', idx === selectedCharIndex);
        btn.classList.toggle('bg-indigo-100', idx === selectedCharIndex);
        btn.classList.toggle('ring-2', idx === selectedCharIndex);
        btn.classList.toggle('ring-indigo-300', idx === selectedCharIndex);
        btn.classList.toggle('scale-105', idx === selectedCharIndex);
        btn.classList.toggle('border-transparent', idx !== selectedCharIndex);
    });

    document.querySelectorAll('.color-swatch-btn').forEach((btn) => {
        const hexVal = Number(btn.dataset.hex);
        btn.classList.toggle('ring-4', hexVal === selectedColorHex);
        btn.classList.toggle('ring-indigo-500', hexVal === selectedColorHex);
        btn.classList.toggle('scale-110', hexVal === selectedColorHex);
    });
}

function openCharacterSelector() {
    if (gamePhase !== 'LOBBY') return;
    isSelectingCharacter = true;
    keys.up = keys.down = keys.left = keys.right = false;
    if (showcasePedestal && playerChameleon) {
        showcasePedestal.position.set(playerChameleon.group.position.x, 0.04, playerChameleon.group.position.z);
        showcasePedestal.visible = true;
    }
    document.getElementById('character-select-overlay').classList.remove('hidden');
    document.getElementById('open-selector-btn').classList.add('hidden');
}

function confirmCharacterSelection() {
    const charInfo = CHARACTER_TYPES[selectedCharIndex];
    const colorObj = JELLY_COLORS.find(c => c.hex === selectedColorHex);
    const finalNick = getPlayerNickname();
    if (playerChameleon) playerChameleon.setNickname(finalNick);
    document.getElementById('current-char-emoji').textContent = charInfo.emoji;
    document.getElementById('current-char-name').textContent = finalNick;
    if (colorObj) document.getElementById('current-char-color-dot').style.backgroundColor = colorObj.css;

    isSelectingCharacter = false;
    if (showcasePedestal) showcasePedestal.visible = false;
    document.getElementById('character-select-overlay').classList.add('hidden');
    document.getElementById('open-selector-btn').classList.remove('hidden');
    cameraAngle = 0;

    if (playerChameleon) {
        const joinPayload = {
            name: finalNick,
            charType: selectedCharType,
            colorHex: selectedColorHex,
            x: playerChameleon.group.position.x,
            y: playerChameleon.group.position.y,
            z: playerChameleon.group.position.z,
            rotY: playerChameleon.group.rotation.y
        };
        if (window.syncJoinLobby) {
            window.syncJoinLobby(joinPayload);
        } else {
            window.pendingLobbyJoin = joinPayload;
        }
    }
}

function checkProximity() {
    if (!playerChameleon) return;
    const pPos = playerChameleon.group.position;
    const distToPortal = Math.hypot(pPos.x - 0, pPos.z - (-9));
    const promptEl = document.getElementById('interaction-prompt');

    if (distToPortal < 4.3) {
        currentNearObject = 'PORTAL';
        promptEl.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        currentNearObject = null;
        promptEl.classList.add('opacity-0', 'pointer-events-none');
    }
}

function triggerInteraction() {
    if (!currentNearObject) return;
    document.getElementById('portal-current-nickname').textContent = getPlayerNickname();
    resetPortalModal();
    const modal = document.getElementById('custom-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function resetPortalModal() {
    document.getElementById('portal-step-select').classList.remove('hidden');
    document.getElementById('portal-step-join').classList.add('hidden');
}

function selectTotalRounds(rounds) {
    selectedTotalRounds = rounds;
    document.querySelectorAll('.round-opt-btn').forEach(btn => {
        const r = Number(btn.dataset.rounds);
        btn.classList.toggle('bg-indigo-600', r === rounds);
        btn.classList.toggle('text-white', r === rounds);
        btn.classList.toggle('border-indigo-600', r === rounds);
        btn.classList.toggle('shadow', r === rounds);
        btn.classList.toggle('bg-white', r !== rounds);
        btn.classList.toggle('text-slate-700', r !== rounds);
        btn.classList.toggle('border-transparent', r !== rounds);
    });
}

async function createTeamAndEnterRoom() {
    const roomCode = String(Math.floor(100000 + Math.random() * 900000));
    const charInfo = CHARACTER_TYPES[selectedCharIndex];
    const memberInfo = {
        id: window.myPlayerId || 'host_local',
        name: getPlayerNickname(),
        emoji: charInfo.emoji,
        charType: selectedCharType,
        colorHex: selectedColorHex,
        isHost: true
    };
    window.currentRoomInfo = {
        code: roomCode,
        role: 'HOST',
        totalRounds: selectedTotalRounds,
        currentRound: 1,
        members: [memberInfo]
    };
    if (window.syncCreateRoom) {
        await window.syncCreateRoom(window.currentRoomInfo, memberInfo);
    }
    updateMonitorCanvas();
    startPartySequence();
}

function showJoinTeamStep() {
    document.getElementById('join-room-code-input').value = '';
    document.getElementById('join-error-msg').textContent = '';
    document.getElementById('portal-step-select').classList.add('hidden');
    document.getElementById('portal-step-join').classList.remove('hidden');
    setTimeout(() => document.getElementById('join-room-code-input').focus(), 50);
}

async function submitJoinRoom() {
    const code = document.getElementById('join-room-code-input').value.trim();
    const errEl = document.getElementById('join-error-msg');
    if (!/^\d{6}$/.test(code)) {
        errEl.textContent = '6자리 숫자 방 번호를 정확히 입력해주세요!';
        return;
    }
    const charInfo = CHARACTER_TYPES[selectedCharIndex];
    const memberInfo = {
        id: window.myPlayerId || 'guest_local',
        name: getPlayerNickname(),
        emoji: charInfo.emoji,
        charType: selectedCharType,
        colorHex: selectedColorHex,
        isHost: false
    };

    let joinedRounds = selectedTotalRounds;
    if (window.syncJoinRoom) {
        const res = await window.syncJoinRoom(code, memberInfo);
        if (!res.ok) {
            errEl.textContent = res.error || '방 입장에 실패했습니다.';
            return;
        }
        joinedRounds = res.totalRounds;
    }

    window.currentRoomInfo = {
        code: code,
        role: 'GUEST',
        totalRounds: joinedRounds,
        currentRound: 1,
        members: [memberInfo]
    };
    updateMonitorCanvas();
    startPartySequence();
}

// ==========================================
// 로비(포탈 들판) 다른 플레이어 실시간 동기화 & 밀치기 모션/판정
// ==========================================
window.onLobbyPlayersUpdated = function(allPlayers, myId) {
    const now = Date.now();
    const activeIds = new Set();

    Object.entries(allPlayers).forEach(([pid, pData]) => {
        if (pid === myId) return;
        if (!pData.inLobby || (pData.updatedAt && now - pData.updatedAt > 15000)) return;
        activeIds.add(pid);

        let remote = remoteLobbyPlayers[pid];
        if (!remote) {
            const charObj = new JellyCharacter(
                pData.charType || 'chameleon',
                pData.colorHex !== undefined ? pData.colorHex : 0x2ed573,
                pData.x || 0,
                pData.z || 6,
                pData.name || '친구',
                lobbyGroup
            );
            remote = {
                char: charObj,
                targetPos: new THREE.Vector3(pData.x || 0, pData.y || 0, pData.z || 6),
                targetRotY: pData.rotY || 0,
                lastShoveEventId: pData.shoveEventId || 0
            };
            remoteLobbyPlayers[pid] = remote;
        } else {
            if (remote.char.type !== pData.charType) {
                remote.char.setAppearance(pData.charType, pData.colorHex);
            } else if (remote.char.colorHex !== pData.colorHex) {
                remote.char.setColor(pData.colorHex);
            }
            if (remote.char.nickname !== pData.name) {
                remote.char.setNickname(pData.name);
            }
            remote.targetPos.set(pData.x || 0, pData.y || 0, pData.z || 6);
            remote.targetRotY = pData.rotY || 0;
        }

        // 상대방이 좌클릭 밀치기를 했을 때 내 화면에서도 팔을 뻗는 3D 밀치기 모션 + 충격파 즉시 실행!
        if (pData.shoveEventId && pData.shoveEventId !== remote.lastShoveEventId) {
            remote.lastShoveEventId = pData.shoveEventId;
            remote.char.group.rotation.y = remote.targetRotY;
            remote.char.isShoving = false;
            remote.char.shove();

            if (pData.shoveTargetId === myId && playerChameleon && gamePhase === 'LOBBY') {
                playerChameleon.velocity.x += (pData.shoveVx || 0);
                playerChameleon.velocity.z += (pData.shoveVz || 0);
                playerChameleon.velocity.y = 5.5;
                playerChameleon.isGrounded = false;
            }
        }
    });

    Object.keys(remoteLobbyPlayers).forEach(pid => {
        if (!activeIds.has(pid)) {
            lobbyGroup.remove(remoteLobbyPlayers[pid].char.group);
            delete remoteLobbyPlayers[pid];
        }
    });
};

function handleLocalLobbyShove() {
    if (!playerChameleon || gamePhase !== 'LOBBY') return;
    const myPos = playerChameleon.group.position;
    const forward = new THREE.Vector3(Math.sin(playerChameleon.group.rotation.y), 0, Math.cos(playerChameleon.group.rotation.y));

    let hitTargetId = '';
    let pushVx = 0;
    let pushVz = 0;

    Object.entries(remoteLobbyPlayers).forEach(([pid, remote]) => {
        const toTarget = remote.char.group.position.clone().sub(myPos);
        toTarget.y = 0;
        const dist = toTarget.length();
        if (dist < 2.6) {
            const dir = dist > 0.01 ? toTarget.normalize() : forward.clone();
            if (dir.dot(forward) > 0.15) {
                hitTargetId = pid;
                pushVx = forward.x * 13.5;
                pushVz = forward.z * 13.5;
            }
        }
    });

    if (window.syncLobbyShove) {
        window.syncLobbyShove(hitTargetId, pushVx, pushVz);
    }
}

window.onRoomMembersUpdated = function() {
    updateMonitorCanvas();
    if (gamePhase !== 'LOBBY' && gamePhase !== 'MINIGAME_BOMB') {
        syncSofaCharacters();
    }
};

function syncSofaCharacters() {
    const seatXPositions = [-2.4, -0.8, 0.8, 2.4, -3.1];
    const members = (window.currentRoomInfo && window.currentRoomInfo.members.length > 0)
        ? window.currentRoomInfo.members
        : [{ id: window.myPlayerId || 'local', name: getPlayerNickname(), charType: selectedCharType, colorHex: selectedColorHex, isHost: true }];

    const activeMemberIds = new Set();

    members.forEach((m, idx) => {
        const mId = m.id || `member_${idx}`;
        activeMemberIds.add(mId);
        const seatX = seatXPositions[idx % seatXPositions.length];

        if (!roomCharacterMap[mId]) {
            const cType = m.charType || selectedCharType;
            const cColor = m.colorHex !== undefined ? m.colorHex : selectedColorHex;
            const startX = seatX + (idx % 2 === 0 ? -1.1 : 1.1);
            const startZ = 2.6;

            const charObj = new JellyCharacter(cType, cColor, startX, startZ, m.name, partyRoomGroup);
            charObj.group.rotation.y = Math.PI;
            roomCharacterMap[mId] = {
                char: charObj,
                targetX: seatX,
                targetZ: -2.18,
                seated: false,
                jumped: false
            };
        } else {
            roomCharacterMap[mId].targetX = seatX;
        }
    });

    Object.keys(roomCharacterMap).forEach(mId => {
        if (!activeMemberIds.has(mId)) {
            partyRoomGroup.remove(roomCharacterMap[mId].char.group);
            delete roomCharacterMap[mId];
        }
    });
}

function startPartySequence() {
    closeModal();
    isSelectingCharacter = false;
    document.getElementById('character-select-overlay').classList.add('hidden');
    document.getElementById('interaction-prompt').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('open-selector-btn').classList.add('hidden');
    document.getElementById('room-status-hud').classList.add('hidden');

    if (window.syncUpdateLobbyState && playerChameleon) {
        window.syncUpdateLobbyState({
            name: getPlayerNickname(),
            charType: selectedCharType,
            colorHex: selectedColorHex,
            x: playerChameleon.group.position.x,
            y: playerChameleon.group.position.y,
            z: playerChameleon.group.position.z,
            rotY: playerChameleon.group.rotation.y,
            inLobby: false
        }, true);
    }

    lobbyGroup.visible = false;
    partyRoomGroup.visible = true;
    if (bombGameGroup) bombGameGroup.visible = false;
    scene.background = new THREE.Color(0xdff9fb);
    scene.fog = new THREE.Fog(0xdff9fb, 35, 95);

    Object.values(roomCharacterMap).forEach(rc => partyRoomGroup.remove(rc.char.group));
    roomCharacterMap = {};
    syncSofaCharacters();

    gamePhase = 'ROOM_SOFA';
    phaseTimer = 0;
    rouletteState = 'IDLE';
    selectedRouletteGame = null;
    drawRouletteMonitor();

    const totalR = window.currentRoomInfo ? window.currentRoomInfo.totalRounds : selectedTotalRounds;
    const curR = window.currentRoomInfo ? window.currentRoomInfo.currentRound : 1;
    const roomCodeTxt = window.currentRoomInfo ? `방 ${window.currentRoomInfo.code} • ` : '';
    document.getElementById('party-round-badge').textContent = `${roomCodeTxt}${curR} / ${totalR}판`;

    document.getElementById('party-room-hud').classList.remove('hidden');
    document.getElementById('spin-roulette-btn').classList.add('hidden');
    document.getElementById('start-minigame-btn').classList.add('hidden');
    const isHost = !window.currentRoomInfo || window.currentRoomInfo.role === 'HOST';
    document.getElementById('return-lobby-btn').classList.toggle('hidden', !isHost);
    document.getElementById('party-status-text').textContent = '🛋️ 소파로 걸어가 자리에 앉는 중...';

    camera.position.set(0, 4.2, 8.8);
    camera.lookAt(0, 3.2, -3.5);
}

function triggerRouletteSpin() {
    if (window.currentRoomInfo && window.currentRoomInfo.role !== 'HOST') return;
    const targetIdx = 0; // 첫 번째 미니게임: 폭탄 해체하기 (BOMB DEFUSAL)
    beginRouletteAnimation(targetIdx);

    if (window.syncSpinRoulette && window.currentRoomInfo) {
        window.syncSpinRoulette(window.currentRoomInfo.code, Date.now(), targetIdx);
    }
}

function triggerStartSelectedMinigame() {
    if (window.currentRoomInfo && window.currentRoomInfo.role !== 'HOST') return;
    if (window.syncStartBombMinigame && window.currentRoomInfo) {
        window.syncStartBombMinigame(window.currentRoomInfo.code);
    }
    window.enterBombDefusalMinigame();
}

window.enterBombDefusalMinigame = function() {
    if (window.isBombMinigameActive) return;
    window.isBombMinigameActive = true;
    gamePhase = 'MINIGAME_BOMB';
    bombSubPhase = 'INTRO';
    bombPhaseElapsed = 0;
    myBombScore = 0;
    bombScoreMap = {};

    if (!bombGameGroup) {
        bombGameGroup = new THREE.Group();
        scene.add(bombGameGroup);
    }
    while (bombGameGroup.children.length > 0) {
        bombGameGroup.remove(bombGameGroup.children[0]);
    }
    bombStages = [];

    const members = (window.currentRoomInfo && window.currentRoomInfo.members.length > 0)
        ? window.currentRoomInfo.members
        : [{ id: window.myPlayerId || 'local', name: getPlayerNickname(), charType: selectedCharType, colorHex: selectedColorHex, isHost: true }];

    members.forEach((m, idx) => {
        bombScoreMap[m.id] = 0;
        const stage = createBombStageForMember(m, idx);
        bombStages.push(stage);
    });

    partyRoomGroup.visible = false;
    lobbyGroup.visible = false;
    bombGameGroup.visible = true;
    scene.background = new THREE.Color(0x141a2e);
    scene.fog = new THREE.Fog(0x141a2e, 20, 65);

    document.getElementById('party-room-hud').classList.add('hidden');
    document.getElementById('bomb-game-overlay').classList.remove('hidden');
    document.getElementById('bomb-typing-panel').classList.add('hidden');
    document.getElementById('bomb-result-panel').classList.add('hidden');
    document.getElementById('bomb-phase-banner').textContent = '🪢 밧줄에 묶였다! 30초 동안 영단어로 폭탄을 해체하라!';
    document.getElementById('bomb-timer-text').textContent = '30.0';
    document.getElementById('bomb-my-score').textContent = '0';

    renderBombSplitLabels();
    pickNextBombWord();
};

function renderBombSplitLabels() {
    const container = document.getElementById('bomb-split-labels');
    container.innerHTML = '';
    const count = bombStages.length;
    if (count === 0) return;

    const cols = count === 1 ? 1 : 2;
    const rows = Math.ceil(count / 2);

    bombStages.forEach((st, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const wPct = 100 / cols;
        const hPct = 100 / rows;
        const leftPct = col * wPct;
        const topPct = row * hPct;

        const isMe = st.member.id === (window.myPlayerId || 'local');
        const cell = document.createElement('div');
        cell.style.cssText = `position:absolute; left:${leftPct}%; top:${topPct}%; width:${wPct}%; height:${hPct}%; border: 3px solid ${isMe ? '#ffd32a' : 'rgba(255,255,255,0.28)'}; box-sizing:border-box;`;
        cell.innerHTML = `
            <div class="absolute top-16 left-3 glass-panel rounded-2xl px-3.5 py-1.5 flex items-center gap-2 shadow-lg">
                <span class="font-black text-xs md:text-sm ${isMe ? 'text-indigo-600' : 'text-slate-800'}">${st.member.name}${isMe ? ' (나)' : ''}</span>
                <span class="bg-rose-500 text-white font-black text-xs px-2.5 py-0.5 rounded-full">💣 <span id="bomb-cell-score-${st.member.id}">${st.score}</span>개</span>
            </div>
        `;
        container.appendChild(cell);
    });
}

function pickNextBombWord() {
    const next = BOMB_WORD_BANK[Math.floor(Math.random() * BOMB_WORD_BANK.length)];
    currentBombWordObj = next;
    document.getElementById('bomb-word-meaning').textContent = `뜻: ${next.ko}`;
    document.getElementById('bomb-target-word').textContent = next.en;
    const inp = document.getElementById('bomb-word-input');
    inp.value = '';
}

function onBombWordInput(val) {
    if (bombSubPhase !== 'PLAY' || !currentBombWordObj) return;
    const cleaned = val.trim().toUpperCase();
    if (cleaned === currentBombWordObj.en) {
        myBombScore += 1;
        document.getElementById('bomb-my-score').textContent = String(myBombScore);
        const myId = window.myPlayerId || 'local';
        bombScoreMap[myId] = myBombScore;
        const myStage = bombStages.find(s => s.member.id === myId);
        if (myStage) {
            myStage.score = myBombScore;
            myStage.charObj.jump();
        }
        const badge = document.getElementById(`bomb-cell-score-${myId}`);
        if (badge) badge.textContent = String(myBombScore);

        if (window.syncUpdateBombScore && window.currentRoomInfo) {
            window.syncUpdateBombScore(window.currentRoomInfo.code, myBombScore);
        }
        pickNextBombWord();
    }
}

window.onBombScoresUpdated = function(scoresObj) {
    Object.entries(scoresObj).forEach(([pid, sc]) => {
        bombScoreMap[pid] = sc;
        const st = bombStages.find(s => s.member.id === pid);
        if (st) {
            if (sc > st.score && pid !== (window.myPlayerId || 'local')) {
                st.charObj.jump();
            }
            st.score = sc;
        }
        const badge = document.getElementById(`bomb-cell-score-${pid}`);
        if (badge) badge.textContent = String(sc);
    });
};

function evaluateBombDefusalResults() {
    bombSubPhase = 'RESULT';
    bombPhaseElapsed = 0;
    document.getElementById('bomb-typing-panel').classList.add('hidden');
    document.getElementById('bomb-phase-banner').textContent = '💥 시간 종료! 1등만 탈출 성공!';

    const sorted = [...bombStages].sort((a, b) => b.score - a.score);
    const topScore = sorted[0] ? sorted[0].score : 0;

    sorted.forEach((st, rankIdx) => {
        if (rankIdx === 0 && (sorted.length === 1 || st.score >= topScore)) {
            st.isWinner = true;
            st.ropeGroup.visible = false;
            st.bombGroup.visible = false;
        } else {
            st.isWinner = false;
            st.exploded = true;
            st.bombGroup.visible = false;
            st.explosionMesh.visible = true;
            st.charObj.setColor(0x2f3542);
        }
    });

    const rankListEl = document.getElementById('bomb-ranking-list');
    rankListEl.innerHTML = '';
    sorted.forEach((st, idx) => {
        const isFirst = st.isWinner;
        const row = document.createElement('div');
        row.className = `flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 ${isFirst ? 'bg-amber-50 border-amber-400' : 'bg-slate-100 border-slate-200'}`;
        row.innerHTML = `
            <div class="flex items-center gap-2.5">
                <span class="font-black text-base ${isFirst ? 'text-amber-600' : 'text-slate-500'}">${idx + 1}등</span>
                <span class="font-black text-slate-800">${st.member.name}</span>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full ${isFirst ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}">
                    ${isFirst ? '🎉 해체 탈출!' : '💥 폭탄 폭발!'}
                </span>
            </div>
            <span class="font-black text-indigo-600">${st.score}개</span>
        `;
        rankListEl.appendChild(row);
    });

    const winnerName = sorted[0] ? sorted[0].member.name : '1등';
    document.getElementById('bomb-winner-desc').textContent = `👑 ${winnerName}님이 가장 많은 폭탄을 해체해 탈출했습니다!`;
    document.getElementById('bomb-result-panel').classList.remove('hidden');

    const isHost = !window.currentRoomInfo || window.currentRoomInfo.role === 'HOST';
    document.getElementById('bomb-next-round-btn').classList.toggle('hidden', !isHost);
    document.getElementById('bomb-guest-next-wait').classList.toggle('hidden', isHost);
}

function finishBombMinigameToRoom() {
    if (window.syncReturnToPartyRoom && window.currentRoomInfo) {
        window.syncReturnToPartyRoom(window.currentRoomInfo.code);
    }
    window.exitBombMinigameToRoom();
}

window.exitBombMinigameToRoom = function() {
    window.isBombMinigameActive = false;
    document.getElementById('bomb-game-overlay').classList.add('hidden');
    if (bombGameGroup) bombGameGroup.visible = false;
    startPartySequence();
};

window.startRemoteRouletteSpin = function(targetIdx) {
    beginRouletteAnimation(targetIdx);
};

function beginRouletteAnimation(targetIdx) {
    gamePhase = 'ROOM_MONITOR';
    rouletteState = 'SPINNING';
    rouletteTargetIndex = targetIdx;
    rouletteVelocity = 26 + Math.random() * 4;
    selectedRouletteGame = null;
    document.getElementById('spin-roulette-btn').classList.add('hidden');
    document.getElementById('start-minigame-btn').classList.add('hidden');
    document.getElementById('party-status-text').textContent = '🎰 모니터 확대 및 룰렛 회전 중!';
}

function returnToLobby() {
    if (window.currentRoomInfo && window.currentRoomInfo.role !== 'HOST') return;
    gamePhase = 'LOBBY';
    partyRoomGroup.visible = false;
    if (bombGameGroup) bombGameGroup.visible = false;
    lobbyGroup.visible = true;
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 45, 135);

    document.getElementById('party-room-hud').classList.add('hidden');
    document.getElementById('open-selector-btn').classList.remove('hidden');
    if (window.currentRoomInfo) {
        document.getElementById('hud-room-code').textContent = `${window.currentRoomInfo.code} (${window.currentRoomInfo.totalRounds}판)`;
        document.getElementById('room-status-hud').classList.remove('hidden');
    }

    if (window.syncUpdateLobbyState && playerChameleon) {
        window.syncUpdateLobbyState({
            name: getPlayerNickname(),
            charType: selectedCharType,
            colorHex: selectedColorHex,
            x: playerChameleon.group.position.x,
            y: playerChameleon.group.position.y,
            z: playerChameleon.group.position.z,
            rotY: playerChameleon.group.rotation.y,
            inLobby: true
        }, true);
    }
}

function closeModal() {
    const modal = document.getElementById('custom-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.getElapsedTime();

    if (gamePhase === 'ROOM_SOFA' || gamePhase === 'ROOM_MONITOR') {
        phaseTimer += dt;
        let allSeated = true;
        const sofaCharacters = Object.values(roomCharacterMap);
        if (sofaCharacters.length === 0) allSeated = false;

        sofaCharacters.forEach((rc) => {
            const pos = rc.char.group.position;
            if (!rc.seated) {
                allSeated = false;
                const dx = rc.targetX - pos.x;
                const dz = rc.targetZ - pos.z;
                const dist = Math.hypot(dx, dz);

                if (dist > 0.12) {
                    const speed = 3.2;
                    pos.x += (dx / dist) * speed * dt;
                    pos.z += (dz / dist) * speed * dt;
                    rc.char.group.rotation.y = Math.atan2(dx, dz);

                    const walkBounce = Math.abs(Math.sin(elapsed * 14));
                    rc.char.bodyPivot.position.y = walkBounce * 0.14;
                    rc.char.leftLeg.position.z = Math.sin(elapsed * 14) * 0.2;
                    rc.char.rightLeg.position.z = -Math.sin(elapsed * 14) * 0.2;

                    if (dist < 1.1 && !rc.jumped) rc.jumped = true;
                    if (rc.jumped) pos.y = Math.sin((1 - dist / 1.1) * Math.PI) * 1.15;
                } else {
                    rc.seated = true;
                    pos.set(rc.targetX, 0.92, rc.targetZ);
                    rc.char.group.rotation.y = 0;
                    rc.char.leftLeg.rotation.x = -Math.PI / 2.1;
                    rc.char.rightLeg.rotation.x = -Math.PI / 2.1;
                    rc.char.leftLeg.position.set(-0.25, 0.28, 0.22);
                    rc.char.rightLeg.position.set(0.25, 0.28, 0.22);
                    rc.char.bodyPivot.rotation.x = -0.12;
                }
            } else {
                pos.x += (rc.targetX - pos.x) * 6 * dt;
                const idleBounce = Math.sin(elapsed * 3.5 + rc.targetX) * 0.035;
                rc.char.bodyPivot.position.y = idleBounce;
                rc.char.bodyPivot.scale.set(1 - idleBounce, 1 + idleBounce, 1 - idleBounce);
            }
        });

        if (gamePhase === 'ROOM_SOFA') {
            camera.position.lerp(new THREE.Vector3(0, 3.6, 7.6), 4 * dt);
            camera.lookAt(0, 2.6, -3.2);

            if (allSeated) {
                const isHost = !window.currentRoomInfo || window.currentRoomInfo.role === 'HOST';
                const spinBtn = document.getElementById('spin-roulette-btn');
                if (isHost) {
                    spinBtn.textContent = '룰렛 돌리기! 🎰';
                    spinBtn.classList.remove('hidden');
                    document.getElementById('party-status-text').textContent = '🛋️ 착석 완료! 룰렛 돌리기 버튼을 눌러주세요';
                } else {
                    spinBtn.classList.add('hidden');
                    document.getElementById('party-status-text').textContent = '🛋️ 착석 완료! 방장이 룰렛을 돌릴 때까지 대기 중...';
                }
            }
        } else if (gamePhase === 'ROOM_MONITOR') {
            camera.position.lerp(new THREE.Vector3(0, 6.4, 2.35), 3.2 * dt);
            camera.lookAt(0, 6.4, -6.05);

            if (rouletteState === 'SPINNING') {
                rouletteOffset += rouletteVelocity * dt;
                rouletteVelocity *= Math.pow(0.42, dt);

                if (rouletteVelocity < 0.45) {
                    const total = ROULETTE_GAMES.length;
                    const currentBase = Math.floor(rouletteOffset / total) * total;
                    let targetSlot = currentBase + rouletteTargetIndex;
                    if (targetSlot < rouletteOffset) targetSlot += total;

                    rouletteOffset += (targetSlot - rouletteOffset) * 8 * dt;
                    if (Math.abs(targetSlot - rouletteOffset) < 0.02) {
                        rouletteOffset = targetSlot;
                        rouletteState = 'DONE';
                        selectedRouletteGame = ROULETTE_GAMES[rouletteTargetIndex];
                        document.getElementById('party-status-text').textContent =
                            `🎉 선택된 게임: ${selectedRouletteGame.icon} ${selectedRouletteGame.title}`;
                        const isHost = !window.currentRoomInfo || window.currentRoomInfo.role === 'HOST';
                        if (isHost) {
                            const spinBtn = document.getElementById('spin-roulette-btn');
                            spinBtn.textContent = '다시 돌리기 🎰';
                            spinBtn.classList.remove('hidden');
                            document.getElementById('start-minigame-btn').classList.remove('hidden');
                        }
                    }
                }
            }
            drawRouletteMonitor();
        }
    }

    // ==========================================
    // 미니게임 1: 폭탄 해체하기 애니메이션 & 분할 화면 렌더링
    // ==========================================
    if (gamePhase === 'MINIGAME_BOMB' && bombStages.length > 0) {
        bombPhaseElapsed += dt;

        if (bombSubPhase === 'INTRO') {
            bombStages.forEach((st, idx) => {
                st.charObj.bodyPivot.rotation.z = Math.sin(elapsed * 18 + idx) * 0.16;
                st.charObj.headGroup.rotation.y = Math.sin(elapsed * 12 + idx) * 0.35;
                st.bombLed.material.color.setHex(Math.sin(elapsed * 20) > 0 ? 0xff4757 : 0x550000);
                st.spark.scale.setScalar(0.8 + Math.sin(elapsed * 30) * 0.4);
            });
            if (bombPhaseElapsed >= 3.0) {
                bombSubPhase = 'PLAY';
                bombPhaseElapsed = 0;
                document.getElementById('bomb-phase-banner').textContent = '⌨️ 영단어를 입력해 폭탄을 해체하세요!';
                document.getElementById('bomb-typing-panel').classList.remove('hidden');
                setTimeout(() => document.getElementById('bomb-word-input').focus(), 40);
            }
        } else if (bombSubPhase === 'PLAY') {
            const remaining = Math.max(0, 30.0 - bombPhaseElapsed);
            document.getElementById('bomb-timer-text').textContent = remaining.toFixed(1);

            const blinkSpeed = remaining < 7 ? 38 : 16;
            bombStages.forEach((st, idx) => {
                st.charObj.update(dt, new THREE.Vector3());
                st.charObj.bodyPivot.rotation.z = Math.sin(elapsed * 14 + idx) * 0.1;
                st.bombLed.material.color.setHex(Math.sin(elapsed * blinkSpeed) > 0 ? 0xff4757 : 0x440000);
                st.spark.rotation.y += 6 * dt;
                st.spark.scale.setScalar(0.9 + Math.sin(elapsed * 35) * 0.45);
            });

            if (remaining <= 0) {
                evaluateBombDefusalResults();
            }
        } else if (bombSubPhase === 'RESULT') {
            bombStages.forEach((st, idx) => {
                if (st.isWinner) {
                    st.charObj.bodyPivot.rotation.z = 0;
                    st.charObj.group.position.y = Math.abs(Math.sin(elapsed * 7)) * 1.15;
                    st.charObj.group.rotation.y = Math.sin(elapsed * 3.5) * 0.45;
                    st.charObj.leftArm.rotation.z = 2.6;
                    st.charObj.rightArm.rotation.z = -2.6;
                } else {
                    if (st.explosionMesh.visible) {
                        const expT = Math.min(1, bombPhaseElapsed / 0.65);
                        st.explosionMesh.scale.setScalar(1 + expT * 9.5);
                        st.explosionMesh.material.opacity = Math.max(0, 1 - expT);
                        if (expT >= 1) st.explosionMesh.visible = false;
                    }
                    st.charObj.group.rotation.y += 5.5 * dt;
                    st.charObj.bodyPivot.rotation.z = Math.sin(elapsed * 16 + idx) * 0.28;
                }
            });
        }

        const W = window.innerWidth;
        const H = window.innerHeight;
        const count = bombStages.length;
        const cols = count === 1 ? 1 : 2;
        const rows = Math.ceil(count / 2);

        renderer.setScissorTest(true);
        bombStages.forEach((st, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const vpW = Math.floor(W / cols);
            const vpH = Math.floor(H / rows);
            const vpX = col * vpW;
            const vpY = H - (row + 1) * vpH;

            renderer.setViewport(vpX, vpY, vpW, vpH);
            renderer.setScissor(vpX, vpY, vpW, vpH);

            camera.aspect = vpW / vpH;
            camera.updateProjectionMatrix();

            const camDistZ = bombSubPhase === 'INTRO' ? 3.6 : 4.5;
            const camHeightY = bombSubPhase === 'INTRO' ? 1.85 : 2.15;
            camera.position.set(st.baseX, camHeightY, camDistZ);
            camera.lookAt(st.baseX + 0.1, 1.05, 0.25);

            renderer.render(scene, camera);
        });
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, W, H);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        return;
    }

    // 로비 다른 플레이어 위치 보간, 몸통 부딪힘 반발 및 걷기/밀치기 애니메이션 업데이트
    Object.values(remoteLobbyPlayers).forEach(remote => {
        const g = remote.char.group;
        const prevX = g.position.x;
        const prevZ = g.position.z;
        g.position.lerp(remote.targetPos, 10 * dt);

        if (playerChameleon && !isSelectingCharacter) {
            const dx = playerChameleon.group.position.x - g.position.x;
            const dz = playerChameleon.group.position.z - g.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist > 0.01 && dist < 1.15) {
                const push = (1.15 - dist) * 6.5 * dt;
                playerChameleon.group.position.x += (dx / dist) * push;
                playerChameleon.group.position.z += (dz / dist) * push;
            }
        }

        let diff = remote.targetRotY - g.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        g.rotation.y += diff * 10 * dt;

        // 상대방이 밀치기 모션 중일 때 팔을 앞으로 뻗고 몸을 숙이는 3D 애니메이션 재생
        if (remote.char.isShoving) {
            remote.char.shoveTimer -= dt;
            const progress = 1 - Math.max(0, remote.char.shoveTimer / 0.34);
            const punchCurve = Math.sin(progress * Math.PI);
            remote.char.bodyPivot.rotation.x = punchCurve * 0.42;
            remote.char.bodyPivot.position.z = punchCurve * 0.24;
            remote.char.leftArm.rotation.x = -punchCurve * 1.45;
            remote.char.rightArm.rotation.x = -punchCurve * 1.45;
            remote.char.leftArm.rotation.z = 0.4 - punchCurve * 0.35;
            remote.char.rightArm.rotation.z = -0.4 + punchCurve * 0.35;
            remote.char.leftArm.position.z = 0.05 + punchCurve * 0.38;
            remote.char.rightArm.position.z = 0.05 + punchCurve * 0.38;
            remote.char.bodyPivot.scale.set(1 - punchCurve * 0.12, 1 - punchCurve * 0.08, 1 + punchCurve * 0.22);

            if (remote.char.shoveTimer <= 0) {
                remote.char.isShoving = false;
                remote.char.bodyPivot.rotation.x = 0;
                remote.char.bodyPivot.position.z = 0;
                remote.char.leftArm.rotation.x = 0;
                remote.char.rightArm.rotation.x = 0;
                remote.char.leftArm.rotation.z = 0.4;
                remote.char.rightArm.rotation.z = -0.4;
                remote.char.leftArm.position.z = 0.05;
                remote.char.rightArm.position.z = 0.05;
                remote.char.bodyPivot.scale.set(1, 1, 1);
            }
        } else {
            const movedDist = Math.hypot(g.position.x - prevX, g.position.z - prevZ);
            if (movedDist > 0.005) {
                const bounce = Math.abs(Math.sin(elapsed * 14));
                remote.char.bodyPivot.position.y = bounce * 0.14;
                remote.char.leftLeg.position.z = Math.sin(elapsed * 14) * 0.2;
                remote.char.rightLeg.position.z = -Math.sin(elapsed * 14) * 0.2;
            } else {
                remote.char.bodyPivot.position.y = Math.sin(elapsed * 3) * 0.03;
                remote.char.leftLeg.position.z = 0;
                remote.char.rightLeg.position.z = 0;
            }
        }
    });

    if (portalRing) portalRing.rotation.z += 0.35 * dt;
    if (portalInnerRing) portalInnerRing.rotation.z -= 0.75 * dt;
    if (portalInner) {
        const pulse = 1 + Math.sin(elapsed * 3) * 0.03;
        portalInner.scale.set(pulse, pulse, 1);
    }
    portalParticles.forEach(p => {
        p.userData.angle += p.userData.speed * dt;
        p.position.x = Math.cos(p.userData.angle) * p.userData.radius;
        p.position.y = 2.65 + Math.sin(p.userData.angle) * p.userData.radius;
        p.rotation.y += 2 * dt;
    });

    clouds.forEach(c => {
        c.group.position.x += c.speed * dt;
        if (c.group.position.x > 48) c.group.position.x = -48;
    });

    flowers.forEach(f => {
        f.group.rotation.z = Math.sin(elapsed * 2.2 + f.phase) * 0.08;
    });

    for (let i = shoveEffects.length - 1; i >= 0; i--) {
        const eff = shoveEffects[i];
        eff.life -= dt;
        const t = 1 - Math.max(0, eff.life / eff.maxLife);
        eff.mesh.scale.set(1 + t * 2.8, 1 + t * 2.8, 1);
        eff.mesh.material.opacity = (1 - t) * 0.85;
        if (eff.life <= 0) {
            lobbyGroup.remove(eff.mesh);
            shoveEffects.splice(i, 1);
        }
    }

    if (isSelectingCharacter && playerChameleon) {
        playerChameleon.update(dt, new THREE.Vector3());
        if (!isDragging) playerChameleon.group.rotation.y += 0.75 * dt;
        else playerChameleon.group.rotation.y = -cameraAngle;

        const cPos = playerChameleon.group.position;
        camera.position.lerp(new THREE.Vector3(cPos.x, cPos.y + 2.35, cPos.z + 4.35), 8 * dt);
        camera.lookAt(cPos.x, cPos.y + 1.15, cPos.z);
    } else if (gamePhase === 'LOBBY') {
        const moveDir = new THREE.Vector3();
        const forward = new THREE.Vector3(-Math.sin(cameraAngle), 0, -Math.cos(cameraAngle));
        const right = new THREE.Vector3(Math.cos(cameraAngle), 0, -Math.sin(cameraAngle));

        if (keys.up) moveDir.add(forward);
        if (keys.down) moveDir.sub(forward);
        if (keys.left) moveDir.sub(right);
        if (keys.right) moveDir.add(right);

        playerChameleon.update(dt, moveDir);

        const camOffset = new THREE.Vector3(Math.sin(cameraAngle) * 10, 5.8, Math.cos(cameraAngle) * 10);
        camera.position.lerp(playerChameleon.group.position.clone().add(camOffset), 7 * dt);
        camera.lookAt(playerChameleon.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)));
        checkProximity();

        if (window.syncUpdateLobbyState && playerChameleon) {
            window.syncUpdateLobbyState({
                name: getPlayerNickname(),
                charType: selectedCharType,
                colorHex: selectedColorHex,
                x: playerChameleon.group.position.x,
                y: playerChameleon.group.position.y,
                z: playerChameleon.group.position.z,
                rotY: playerChameleon.group.rotation.y,
                inLobby: true
            });
        }
    }

    renderer.render(scene, camera);
}

window.onload = function () {
    initScene();
    initCharacterSelectorUI();
    setupEvents();
    animate();
};
