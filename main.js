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
window.hasPlayedFirstRound = false;

// 로비 다른 플레이어 3D 인스턴스 관리 맵
const remoteLobbyPlayers = {};

let lobbyGroup, partyRoomGroup, bombGameGroup;
let gamePhase = 'LOBBY';
let phaseTimer = 0;
let roomCharacterMap = {};
let tvCanvas, tvCtx, tvTexture;

const ROULETTE_GAMES = [
    { id: 'BOMB_DEFUSAL', title: 'BOMB DEFUSAL', subtitle: '30초 폭탄 해체 영단어 타이핑!', color: '#ff4757', icon: '💣' },
    { id: 'GRAMMAR_WALL', title: 'GRAMMAR WALL', subtitle: '영어 문법 정답 벽을 찾아 돌파하라!', color: '#3742fa', icon: '🧱' },
    { id: 'RHYTHM_STAGE', title: 'RHYTHM STAGE', subtitle: '스타디움 무대에서 리듬 맞춰 단어 타이핑!', color: '#ffa502', icon: '🎤' },
    { id: 'WORD_SCRAMBLE', title: 'WORD SCRAMBLE', subtitle: '뒤섞인 알파벳 블록 맞추기!', color: '#2ed573', icon: '🔤' },
    { id: 'SENTENCE_BUILDER', title: 'SENTENCE BUILDER', subtitle: '영어 문장 순서 조립하기!', color: '#9c88ff', icon: '🧩' },
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
        if (gamePhase !== 'LOBBY' && gamePhase !== 'MINIGAME_WALL') return;

        if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = true;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = true;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
        if ((e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') && gamePhase === 'LOBBY') {
            if (!document.getElementById('custom-modal').classList.contains('hidden')) return;
            e.preventDefault();
            if (currentNearObject) triggerInteraction();
            else if (e.code === 'Space' && playerChameleon) playerChameleon.jump();
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
        } else if (dragDistance < 6 && gamePhase === 'MINIGAME_WALL' && typeof window.handleWallLocalShove === 'function') {
            window.handleWallLocalShove();
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
    // 캐릭터 선택 화면에서는 다른 플레이어가 겹쳐 보이지 않도록 일시 숨김
    Object.values(remoteLobbyPlayers).forEach(r => {
        if (r && r.char && r.char.group) r.char.group.visible = false;
    });
    document.getElementById('character-select-overlay').classList.remove('hidden');
    document.getElementById('open-selector-btn').classList.add('hidden');
}

function confirmCharacterSelection() {
    const charInfo = CHARACTER_TYPES[selectedCharIndex];
    const colorObj = JELLY_COLORS.find(c => c.hex === selectedColorHex);
    const finalNick = getPlayerNickname();
    if (playerChameleon) {
        playerChameleon.setNickname(finalNick);
        // 처음 입장 시 30명이 한 점에 겹치지 않도록 광장 원형 반경 내 랜덤 위치로 분산 배치
        if (!window.hasEnteredLobbyOnce) {
            window.hasEnteredLobbyOnce = true;
            const angle = Math.random() * Math.PI * 2;
            const radius = 1.2 + Math.random() * 2.4;
            playerChameleon.group.position.set(Math.cos(angle) * radius, 0, 6 + Math.sin(angle) * radius);
        }
    }
    document.getElementById('current-char-emoji').textContent = charInfo.emoji;
    document.getElementById('current-char-name').textContent = finalNick;
    if (colorObj) document.getElementById('current-char-color-dot').style.backgroundColor = colorObj.css;

    isSelectingCharacter = false;
    if (showcasePedestal) showcasePedestal.visible = false;
    document.getElementById('character-select-overlay').classList.add('hidden');
    document.getElementById('open-selector-btn').classList.remove('hidden');
    document.getElementById('lobby-population-hud').classList.remove('hidden');
    cameraAngle = 0;

    // 숨겨두었던 로비 다른 플레이어들 다시 표시
    Object.values(remoteLobbyPlayers).forEach(r => {
        if (r && r.char && r.char.group) r.char.group.visible = true;
    });

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

function copyRoomCodeToClipboard() {
    if (!window.currentRoomInfo || !window.currentRoomInfo.code) return;
    const code = window.currentRoomInfo.code;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).catch(() => {});
    }
    const copyBtn = document.getElementById('copy-room-code-btn');
    if (copyBtn) {
        const orig = copyBtn.textContent;
        copyBtn.textContent = '✅ 복사됨!';
        setTimeout(() => { copyBtn.textContent = orig; }, 1400);
    }
}

function checkProximity() {
    if (!playerChameleon) return;
    const promptEl = document.getElementById('interaction-prompt');
    if (gamePhase !== 'LOBBY' || isSelectingCharacter) {
        currentNearObject = null;
        promptEl.classList.add('opacity-0', 'pointer-events-none');
        return;
    }
    const pPos = playerChameleon.group.position;
    const distToPortal = Math.hypot(pPos.x - 0, pPos.z - (-9));

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
    window.hasPlayedFirstRound = false;
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
    window.hasPlayedFirstRound = false;
    window.currentRoomInfo = {
        code: code,
        role: 'GUEST',
        totalRounds: joinedRounds,
        currentRound: 1,
        members: [memberInfo]
    };
    if (window.syncJoinRoom) {
        const res = await window.syncJoinRoom(code, memberInfo);
        if (!res.ok) {
            window.currentRoomInfo = null;
            errEl.textContent = res.error || '방 입장에 실패했습니다.';
            return;
        }
        window.currentRoomInfo.totalRounds = res.totalRounds;
    }
    updateMonitorCanvas();
    startPartySequence();
}

// ==========================================
// 로비(포탈 들판) 다른 플레이어 실시간 동기화 & 밀치기 모션/판정
// ==========================================
window.onLobbyPlayersUpdated = function(allPlayers, myId) {
    if (!lobbyGroup) return;
    const now = Date.now();
    const activeIds = new Set();

    // 로비 접속자 최대 30명까지 정렬 및 필터링
    const validEntries = Object.entries(allPlayers)
        .filter(([pid, pData]) => pid !== myId && pData && pData.inLobby !== false && (!pData.updatedAt || now - pData.updatedAt <= 90000))
        .slice(0, 29);

    const countEl = document.getElementById('lobby-player-count');
    if (countEl) {
        countEl.textContent = String(Math.min(30, validEntries.length + (isSelectingCharacter ? 0 : 1)));
    }

    validEntries.forEach(([pid, pData]) => {
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
            // 캐릭터 선택 화면 중이면 겹치지 않도록 숨김 유지
            charObj.group.visible = !isSelectingCharacter;
            remote = {
                char: charObj,
                targetPos: new THREE.Vector3(pData.x || 0, pData.y || 0, pData.z || 6),
                targetRotY: pData.rotY || 0,
                lastShoveEventId: pData.shoveEventId || 0
            };
            remoteLobbyPlayers[pid] = remote;
        } else {
            remote.char.group.visible = !isSelectingCharacter;
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
    renderPartyScoreboard();
    if (gamePhase !== 'LOBBY' && gamePhase !== 'MINIGAME_BOMB' && gamePhase !== 'MINIGAME_WALL' && gamePhase !== 'MINIGAME_RHYTHM') {
        syncSofaCharacters();
    }
};

// 모든 파티원이 미니게임 결과를 완료했을 때만 방장의 '파티 룸으로 돌아가기' 버튼 활성화!
window.onMinigameFinishedPlayersUpdated = function(finishedMap) {
    if (!window.currentRoomInfo || window.currentRoomInfo.role !== 'HOST') return;
    const members = window.currentRoomInfo.members || [];
    if (members.length === 0) return;

    const allDone = members.every(m => Boolean(finishedMap[m.id]));
    const doneCount = members.filter(m => Boolean(finishedMap[m.id])).length;

    ['bomb-next-round-btn', 'wall-next-round-btn', 'rhythm-next-round-btn'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (allDone) {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            btn.textContent = '파티 룸으로 돌아가기 🛋️';
        } else {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.textContent = `⏳ 파티원 종료 대기 중 (${doneCount}/${members.length}명 완료)`;
        }
    });
};

// ==========================================
// 등수별 누적 점수(PT) 관리 & 파티 룸 순위판 렌더링
// ==========================================
window.awardMinigamePoints = function(awardedPointsMap) {
    if (!window.currentRoomInfo) return;
    const isHost = window.currentRoomInfo.role === 'HOST';

    window.currentRoomInfo.members.forEach(m => {
        const add = awardedPointsMap[m.id] || 0;
        m.points = (m.points || 0) + add;
    });

    if (isHost && window.syncSaveRoundPoints) {
        window.syncSaveRoundPoints(window.currentRoomInfo.code, window.currentRoomInfo.members);
    }
    renderPartyScoreboard();
};

window.getMemberTotalPoints = function(memberId) {
    if (!window.currentRoomInfo) return 0;
    const found = window.currentRoomInfo.members.find(m => m.id === memberId);
    return found ? (found.points || 0) : 0;
};

function renderPartyScoreboard() {
    const listEl = document.getElementById('party-scoreboard-list');
    if (!listEl || !window.currentRoomInfo) return;
    const sorted = [...window.currentRoomInfo.members].sort((a, b) => (b.points || 0) - (a.points || 0));
    listEl.innerHTML = '';
    sorted.forEach((m, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}위`;
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-white/80 rounded-xl px-2.5 py-1.5';
        row.innerHTML = `
            <span class="truncate max-w-[125px]">${medal} ${m.emoji || ''} ${m.name}</span>
            <span class="font-black text-indigo-600">${m.points || 0} PT</span>
        `;
        listEl.appendChild(row);
    });
}

function syncSofaCharacters() {
    // 한 팀 최대 4명 소파 착석 위치
    const seatXPositions = [-2.55, -0.85, 0.85, 2.55];
    const members = (window.currentRoomInfo && window.currentRoomInfo.members.length > 0)
        ? window.currentRoomInfo.members.slice(0, 4)
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
    document.getElementById('lobby-population-hud').classList.add('hidden');
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
    document.getElementById('party-scoreboard-hud').classList.remove('hidden');
    renderPartyScoreboard();
    document.getElementById('spin-roulette-btn').classList.add('hidden');
    document.getElementById('start-minigame-btn').classList.add('hidden');
    const isHost = !window.currentRoomInfo || window.currentRoomInfo.role === 'HOST';
    document.getElementById('return-lobby-btn').classList.toggle('hidden', !isHost || window.hasPlayedFirstRound);
    document.getElementById('party-status-text').textContent = '🛋️ 소파로 걸어가 자리에 앉는 중...';

    camera.position.set(0, 4.2, 8.8);
    camera.lookAt(0, 3.2, -3.5);
}

function triggerRouletteSpin() {
    if (window.currentRoomInfo && window.currentRoomInfo.role !== 'HOST') return;
    // 구현 완료된 미니게임(0: 폭탄 해체하기, 1: 문법 벽 돌파, 2: 스타디움 리듬 스테이지) 중 랜덤 추첨!
    const implementedGameIndices = [0, 1, 2];
    const targetIdx = implementedGameIndices[Math.floor(Math.random() * implementedGameIndices.length)];
    beginRouletteAnimation(targetIdx);

    if (window.syncSpinRoulette && window.currentRoomInfo) {
        window.syncSpinRoulette(window.currentRoomInfo.code, Date.now(), targetIdx);
    }
}

function triggerStartSelectedMinigame() {
    if (window.currentRoomInfo && window.currentRoomInfo.role !== 'HOST') return;
    const chosenId = selectedRouletteGame ? selectedRouletteGame.id : 'BOMB_DEFUSAL';
    const seedVal = Math.floor(Math.random() * 100000);

    if (window.syncStartMinigame && window.currentRoomInfo) {
        window.syncStartMinigame(window.currentRoomInfo.code, chosenId);
    }
    if (chosenId === 'RHYTHM_STAGE' && typeof window.enterRhythmStageMinigame === 'function') {
        window.enterRhythmStageMinigame(seedVal);
    } else if (chosenId === 'GRAMMAR_WALL' && typeof window.enterGrammarWallMinigame === 'function') {
        window.enterGrammarWallMinigame(seedVal);
    } else if (typeof window.enterBombDefusalMinigame === 'function') {
        window.enterBombDefusalMinigame();
    }
}

window.startRemoteRouletteSpin = function(targetIdx) {
    beginRouletteAnimation(targetIdx);
};

function beginRouletteAnimation(targetIdx) {
    // 혹시 미니게임 화면이 남아있는 상태였다면 안전하게 파티 룸 상태로 전환
    if (window.isBombMinigameActive || window.isWallMinigameActive || window.isRhythmMinigameActive) {
        window.isBombMinigameActive = false;
        window.isWallMinigameActive = false;
        window.isRhythmMinigameActive = false;
        document.getElementById('bomb-game-overlay').classList.add('hidden');
        document.getElementById('wall-game-overlay').classList.add('hidden');
        document.getElementById('rhythm-game-overlay').classList.add('hidden');
        if (bombGameGroup) bombGameGroup.visible = false;
        if (typeof wallGameGroup !== 'undefined' && wallGameGroup) wallGameGroup.visible = false;
        if (typeof rhythmGameGroup !== 'undefined' && rhythmGameGroup) rhythmGameGroup.visible = false;
        partyRoomGroup.visible = true;
        document.getElementById('party-room-hud').classList.remove('hidden');
        document.getElementById('party-scoreboard-hud').classList.remove('hidden');
    }
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
    document.getElementById('party-scoreboard-hud').classList.add('hidden');
    document.getElementById('open-selector-btn').classList.remove('hidden');
    document.getElementById('lobby-population-hud').classList.remove('hidden');
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
                            const startMiniBtn = document.getElementById('start-minigame-btn');
                            startMiniBtn.textContent = `미니게임 시작! ${selectedRouletteGame.icon}`;
                            startMiniBtn.classList.remove('hidden');
                        }
                    }
                }
            }
            drawRouletteMonitor();
        }
    }

    // 미니게임 1: 폭탄 해체하기 독립 모듈 렌더링
    if (gamePhase === 'MINIGAME_BOMB' && typeof window.updateAndRenderBombMinigame === 'function') {
        window.updateAndRenderBombMinigame(dt, elapsed);
        return;
    }

    // 미니게임 2: 영어 문법 벽 돌파 독립 모듈 렌더링
    if (gamePhase === 'MINIGAME_WALL' && typeof window.updateAndRenderWallMinigame === 'function') {
        window.updateAndRenderWallMinigame(dt, elapsed);
        return;
    }

    // 미니게임 3: 스타디움 리듬 스테이지 독립 모듈 렌더링
    if (gamePhase === 'MINIGAME_RHYTHM' && typeof window.updateAndRenderRhythmMinigame === 'function') {
        window.updateAndRenderRhythmMinigame(dt, elapsed);
        return;
    }

    Object.values(remoteLobbyPlayers).forEach((remote) => {
        const g = remote.char.group;
        const prevX = g.position.x;
        const prevZ = g.position.z;
        g.position.lerp(remote.targetPos, 10 * dt);

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
    console.log("7");
    initScene();
    initCharacterSelectorUI();
    setupEvents();
    if (window.latestLobbyPlayers && window.myPlayerId) {
        window.onLobbyPlayersUpdated(window.latestLobbyPlayers, window.myPlayerId);
    }
    animate();
};
