// ==========================================
// 메인 컨트롤, UI, 파티 룸(소파 & 모니터 룰렛), 시상대 및 애니메이션 루프
// ==========================================
let scene, camera, renderer;
let lobbyGroup, partyRoomGroup, bombGameGroup, awardCeremonyGroup;
let playerChameleon, showcasePedestal;
let portalRing, portalInner, portalInnerRing;
let portalParticles = [];
let clouds = [];
let flowers = [];
let shoveEffects = [];
let colliders = [];

let monitorCanvas, monitorCtx, monitorTexture;
let tvCanvas, tvCtx, tvTexture;
let roomCharacterMap = {};
let remoteLobbyPlayers = {};

let isSelectingCharacter = true;
let selectedCharType = 'chameleon';
let selectedColorHex = 0x2ed573;
let playerNickname = '';
let selectedTotalRounds = 5;
let currentRoomInfo = null;
window.currentRoomInfo = null;
window.hasPlayedFirstRound = false;
window.isAwardCeremonyActive = false;

let gamePhase = 'LOBBY'; // 'LOBBY' | 'PARTY_ROOM' | 'MINIGAME_BOMB' | 'MINIGAME_WALL' | 'MINIGAME_RHYTHM' | 'AWARD_CEREMONY'
let phaseTimer = 0;
let awardCeremonyActors = [];
let awardConfetti = [];

const ROULETTE_GAMES = [
    { id: 'BOMB_DEFUSAL', icon: '💣', title: 'BOMB DEFUSAL', subtitle: '폭탄 해체하기 (영단어 타이핑!)', color: '#ff4757' },
    { id: 'GRAMMAR_WALL', icon: '🧱', title: 'GRAMMAR WALL', subtitle: '영어 문법 벽 돌파 (정답 줄 서기!)', color: '#1e90ff' },
    { id: 'RHYTHM_STAGE', icon: '🎤', title: 'RHYTHM STAGE', subtitle: '스타디움 리듬 스테이지 (박자 타이핑!)', color: '#ff9f43' }
];
let rouletteState = 'IDLE'; // 'IDLE' | 'SPINNING' | 'DONE'
let rouletteOffset = 0;
let rouletteSpeed = 0;
let rouletteTargetOffset = 0;
let selectedRouletteGame = null;
let lastRouletteTickSlot = -1;

const keys = { up: false, down: false, left: false, right: false };
let cameraAngle = 0;
let cameraPitch = 0.25;
let isDragging = false;
let prevMouseX = 0, prevMouseY = 0;
let isNearPortal = false;
const clock = new THREE.Clock();

function getPlayerNickname() {
    if (playerNickname && playerNickname.trim()) return playerNickname.trim();
    return CHARACTER_TYPES.find(c => c.id === selectedCharType).name;
}

window.showMinigameCountdown = function(labelText) {
    let banner = document.getElementById('global-countdown-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'global-countdown-banner';
        banner.className = 'fixed inset-0 z-[60] pointer-events-none flex items-center justify-center';
        banner.innerHTML = '<div id="global-countdown-text" class="px-10 py-5 rounded-full bg-amber-400 text-slate-950 font-black text-4xl md:text-6xl border-4 border-white shadow-2xl tracking-wider"></div>';
        document.body.appendChild(banner);
    }
    const textEl = document.getElementById('global-countdown-text');
    textEl.textContent = labelText;
    banner.classList.remove('hidden');
    clearTimeout(window._countdownHideTimer);
    window._countdownHideTimer = setTimeout(() => {
        banner.classList.add('hidden');
    }, 1050);
};

function spawnShoveWave(pos, rotY) {
    const waveGroup = new THREE.Group();
    waveGroup.position.copy(pos);
    waveGroup.rotation.y = rotY;
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.25, 0.45, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    waveGroup.add(ring);
    lobbyGroup.add(waveGroup);
    shoveEffects.push({ group: waveGroup, mat: ring.material, life: 0.28, maxLife: 0.28 });
}

function handleShoveAttack() {
    if (isSelectingCharacter) return;
    if (gamePhase === 'MINIGAME_WALL' && typeof window.handleWallLocalShove === 'function') {
        window.handleWallLocalShove();
        return;
    }
    if (gamePhase !== 'LOBBY' || !playerChameleon) return;
    playerChameleon.shove();
    if (window.PartySound) window.PartySound.playSfx('shove');

    const myPos = playerChameleon.group.position;
    const forward = new THREE.Vector3(Math.sin(playerChameleon.group.rotation.y), 0, Math.cos(playerChameleon.group.rotation.y));
    let hitTargetId = '';
    let pushVx = 0, pushVz = 0;

    Object.entries(remoteLobbyPlayers).forEach(([pid, remote]) => {
        const diff = remote.char.group.position.clone().sub(myPos);
        diff.y = 0;
        const dist = diff.length();
        if (dist < 2.3) {
            const dirToTarget = dist > 0.01 ? diff.clone().normalize() : forward.clone();
            if (dirToTarget.dot(forward) > 0.15) {
                hitTargetId = pid;
                pushVx = forward.x * 13.5;
                pushVz = forward.z * 13.5;
                remote.char.velocity.x += pushVx;
                remote.char.velocity.z += pushVz;
                remote.char.velocity.y = 4.5;
                remote.char.isGrounded = false;
            }
        }
    });

    if (window.syncLobbyShove) {
        window.syncLobbyShove(hitTargetId, pushVx, pushVz);
    }
}

window.onLobbyPlayersUpdated = function(allPlayers, myId) {
    if (!lobbyGroup) return;
    const activeIds = new Set();

    Object.entries(allPlayers).forEach(([pid, data]) => {
        if (pid === myId || !data || data.inLobby === false) return;
        activeIds.add(pid);

        if (!remoteLobbyPlayers[pid]) {
            const charObj = new JellyCharacter(
                data.charType || 'chameleon',
                data.colorHex !== undefined ? data.colorHex : 0x2ed573,
                data.x || 0,
                data.z || 6,
                data.name || '플레이어',
                lobbyGroup
            );
            remoteLobbyPlayers[pid] = {
                char: charObj,
                targetPos: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 6),
                targetRotY: data.rotY || 0,
                charType: data.charType || 'chameleon',
                colorHex: data.colorHex,
                name: data.name || '플레이어',
                lastShoveEventId: data.shoveEventId || 0
            };
        } else {
            const remote = remoteLobbyPlayers[pid];
            remote.targetPos.set(data.x || 0, data.y || 0, data.z || 6);
            remote.targetRotY = data.rotY || 0;
            if (remote.charType !== data.charType || remote.colorHex !== data.colorHex) {
                remote.charType = data.charType;
                remote.colorHex = data.colorHex;
                remote.char.setAppearance(data.charType, data.colorHex);
            }
            if (remote.name !== data.name) {
                remote.name = data.name;
                remote.char.setNickname(data.name);
            }
        }

        const remote = remoteLobbyPlayers[pid];
        remote.char.group.visible = !isSelectingCharacter;

        if (data.shoveEventId && data.shoveEventId !== remote.lastShoveEventId) {
            remote.lastShoveEventId = data.shoveEventId;
            remote.char.group.rotation.y = data.rotY || remote.targetRotY;
            remote.char.shove();
            if (data.shoveTargetId === myId && playerChameleon && gamePhase === 'LOBBY') {
                playerChameleon.velocity.x += (data.shoveVx || 0);
                playerChameleon.velocity.z += (data.shoveVz || 0);
                playerChameleon.velocity.y = 4.8;
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

    const totalLobbyCount = Math.min(30, activeIds.size + 1);
    const countEl = document.getElementById('lobby-player-count');
    if (countEl) countEl.textContent = String(totalLobbyCount);
};

window.onRoomMembersUpdated = function() {
    if (!window.currentRoomInfo) return;
    currentRoomInfo = window.currentRoomInfo;
    updateMonitorCanvas();
    if (gamePhase === 'PARTY_ROOM') {
        syncPartyRoomCharacters();
        updatePartyRoomHUD();
    }
    if (gamePhase === 'PARTY_ROOM' || gamePhase === 'AWARD_CEREMONY') {
        renderPartyScoreboard();
    }
};

window.onMinigameFinishedPlayersUpdated = function(finishedMap) {
    if (!window.currentRoomInfo || window.currentRoomInfo.role !== 'HOST') return;
    const members = window.currentRoomInfo.members || [];
    if (members.length === 0) return;

    const allDone = members.every(m => Boolean(finishedMap[m.id]));
    const doneCount = members.filter(m => Boolean(finishedMap[m.id])).length;
    const isFinalRound = window.currentRoomInfo && (window.currentRoomInfo.currentRound >= window.currentRoomInfo.totalRounds);

    ['bomb-next-round-btn', 'wall-next-round-btn', 'rhythm-next-round-btn'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (allDone) {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
            btn.textContent = isFinalRound ? '최종 시상식 이동! 🏆' : '파티 룸으로 돌아가기 🛋️';
        } else {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.textContent = `⏳ 파티원 종료 대기 중 (${doneCount}/${members.length}명 완료)`;
        }
    });
};

window.awardMinigamePoints = function(pointsAwardMap) {
    if (!window.currentRoomInfo || !Array.isArray(window.currentRoomInfo.members)) return;
    window.currentRoomInfo.members.forEach(m => {
        const add = pointsAwardMap[m.id] || 0;
        m.points = (m.points || 0) + add;
    });
    renderPartyScoreboard();
    const isHost = window.currentRoomInfo.role === 'HOST';
    if (isHost && window.syncSaveRoundPoints) {
        window.syncSaveRoundPoints(window.currentRoomInfo.code, window.currentRoomInfo.members);
    }
};

window.getMemberTotalPoints = function(memberId) {
    if (!window.currentRoomInfo || !Array.isArray(window.currentRoomInfo.members)) return 0;
    const found = window.currentRoomInfo.members.find(m => m.id === memberId);
    return found ? (found.points || 0) : 0;
};

function renderPartyScoreboard() {
    const listEl = document.getElementById('party-scoreboard-list');
    if (!listEl || !currentRoomInfo) return;
    const sorted = [...currentRoomInfo.members].sort((a, b) => (b.points || 0) - (a.points || 0));
    listEl.innerHTML = '';
    sorted.forEach((m, idx) => {
        const isTop = idx === 0 && (m.points || 0) > 0;
        const row = document.createElement('div');
        row.className = `flex items-center justify-between px-2.5 py-1.5 rounded-xl ${isTop ? 'bg-amber-100/90 text-amber-900' : 'bg-white/70 text-slate-800'}`;
        row.innerHTML = `
            <span class="truncate max-w-[135px]">${idx === 0 ? '👑' : `${idx + 1}.`} ${m.emoji || '🦎'} ${m.name}</span>
            <span class="font-black text-indigo-600">${m.points || 0} PT</span>
        `;
        listEl.appendChild(row);
    });
}

function initCharacterSelectUI() {
    const grid = document.getElementById('character-grid');
    grid.innerHTML = '';
    CHARACTER_TYPES.forEach(char => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.charId = char.id;
        btn.onclick = () => selectCharacterType(char.id, true);
        btn.className = 'char-card-btn jelly-btn flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-2xl md:text-3xl border-2 transition-all bg-white/80 border-slate-200';
        btn.innerHTML = `<span>${char.emoji}</span>`;
        grid.appendChild(btn);
    });

    const palette = document.getElementById('color-palette');
    palette.innerHTML = '';
    JELLY_COLORS.forEach(col => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.dataset.colorHex = col.hex;
        dot.onclick = () => selectCharacterColor(col.hex);
        dot.className = 'color-dot-btn jelly-btn w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-white shadow-md transition-transform';
        dot.style.backgroundColor = col.css;
        palette.appendChild(dot);
    });

    updateCharacterSelectUI();
}

function selectCharacterType(charId, applyDefaultColor = false) {
    selectedCharType = charId;
    const found = CHARACTER_TYPES.find(c => c.id === charId);
    if (applyDefaultColor && found) selectedColorHex = found.defaultColor;
    if (playerChameleon) {
        playerChameleon.setAppearance(selectedCharType, selectedColorHex);
        playerChameleon.setNickname(getPlayerNickname());
        playerChameleon.jump();
    }
    updateCharacterSelectUI();
    syncMyLobbyData(true);
}

function selectCharacterColor(colorHex) {
    selectedColorHex = colorHex;
    if (playerChameleon) {
        playerChameleon.setColor(selectedColorHex);
        playerChameleon.jump();
    }
    updateCharacterSelectUI();
    syncMyLobbyData(true);
}

function onNicknameInput(val) {
    playerNickname = val;
    if (playerChameleon) playerChameleon.setNickname(getPlayerNickname());
    syncMyLobbyData(false);
}

function prevCharacter() {
    const idx = CHARACTER_TYPES.findIndex(c => c.id === selectedCharType);
    const prevIdx = (idx - 1 + CHARACTER_TYPES.length) % CHARACTER_TYPES.length;
    selectCharacterType(CHARACTER_TYPES[prevIdx].id, true);
}

function nextCharacter() {
    const idx = CHARACTER_TYPES.findIndex(c => c.id === selectedCharType);
    const nextIdx = (idx + 1) % CHARACTER_TYPES.length;
    selectCharacterType(CHARACTER_TYPES[nextIdx].id, true);
}

function updateCharacterSelectUI() {
    const idx = CHARACTER_TYPES.findIndex(c => c.id === selectedCharType);
    const current = CHARACTER_TYPES[idx];
    const colorObj = JELLY_COLORS.find(c => c.hex === selectedColorHex) || JELLY_COLORS[0];

    document.getElementById('showcase-emoji').textContent = current.emoji;
    document.getElementById('showcase-name').textContent = current.name;
    document.getElementById('showcase-index').textContent = `${idx + 1} / ${CHARACTER_TYPES.length}`;
    document.getElementById('current-char-emoji').textContent = current.emoji;
    document.getElementById('current-char-name').textContent = getPlayerNickname();
    document.getElementById('current-char-color-dot').style.backgroundColor = colorObj.css;

    document.querySelectorAll('.char-card-btn').forEach(btn => {
        const isSelected = btn.dataset.charId === selectedCharType;
        btn.classList.toggle('border-indigo-600', isSelected);
        btn.classList.toggle('bg-indigo-50', isSelected);
        btn.classList.toggle('scale-105', isSelected);
        btn.classList.toggle('border-slate-200', !isSelected);
    });

    document.querySelectorAll('.color-dot-btn').forEach(btn => {
        const isSelected = Number(btn.dataset.colorHex) === selectedColorHex;
        btn.classList.toggle('ring-4', isSelected);
        btn.classList.toggle('ring-indigo-500', isSelected);
        btn.classList.toggle('scale-110', isSelected);
    });
}

function syncMyLobbyData(force = false) {
    if (!playerChameleon) return;
    const payload = {
        name: getPlayerNickname(),
        charType: selectedCharType,
        colorHex: selectedColorHex,
        x: playerChameleon.group.position.x,
        y: playerChameleon.group.position.y,
        z: playerChameleon.group.position.z,
        rotY: playerChameleon.group.rotation.y,
        inLobby: (gamePhase === 'LOBBY')
    };
    if (window.syncUpdateLobbyState) {
        window.syncUpdateLobbyState(payload, force);
    } else {
        window.pendingLobbyJoin = payload;
    }
}

function confirmCharacterSelection() {
    isSelectingCharacter = false;
    cameraAngle = 0;
    if (showcasePedestal) showcasePedestal.visible = false;

    const existingCount = Object.keys(remoteLobbyPlayers).length;
    if (existingCount > 0 && playerChameleon) {
        const spreadAngle = (existingCount * 1.15) % (Math.PI * 2);
        const spreadRadius = 2.0 + (existingCount % 3) * 0.85;
        playerChameleon.group.position.set(
            Math.cos(spreadAngle) * spreadRadius,
            0,
            6.0 + Math.sin(spreadAngle) * spreadRadius
        );
    }

    Object.values(remoteLobbyPlayers).forEach(r => {
        r.char.group.visible = true;
    });

    document.getElementById('character-select-overlay').classList.add('hidden');
    document.getElementById('open-selector-btn').classList.remove('hidden');
    document.getElementById('lobby-population-hud').classList.remove('hidden');
    updateCharacterSelectUI();
    if (playerChameleon) {
        playerChameleon.setNickname(getPlayerNickname());
        playerChameleon.jump();
    }
    if (window.PartySound) {
        window.PartySound.playSfx('jump');
        window.PartySound.startLobbyBGM();
    }
    const initPayload = {
        name: getPlayerNickname(),
        charType: selectedCharType,
        colorHex: selectedColorHex,
        x: playerChameleon ? playerChameleon.group.position.x : 0,
        y: 0,
        z: playerChameleon ? playerChameleon.group.position.z : 6,
        rotY: 0,
        inLobby: true
    };
    if (window.syncJoinLobby) {
        window.syncJoinLobby(initPayload);
    } else {
        window.pendingLobbyJoin = initPayload;
    }
}

function openCharacterSelector() {
    if (gamePhase !== 'LOBBY') return;
    isSelectingCharacter = true;
    cameraAngle = 0;
    if (showcasePedestal) {
        showcasePedestal.position.set(playerChameleon.group.position.x, 0.04, playerChameleon.group.position.z);
        showcasePedestal.visible = true;
    }
    Object.values(remoteLobbyPlayers).forEach(r => {
        r.char.group.visible = false;
    });
    document.getElementById('start-nickname-input').value = playerNickname;
    document.getElementById('character-select-overlay').classList.remove('hidden');
    document.getElementById('open-selector-btn').classList.add('hidden');
    document.getElementById('lobby-population-hud').classList.add('hidden');
    updateCharacterSelectUI();
}

function selectTotalRounds(rounds) {
    selectedTotalRounds = rounds;
    document.querySelectorAll('.round-opt-btn').forEach(btn => {
        const isSel = Number(btn.dataset.rounds) === rounds;
        btn.classList.toggle('bg-indigo-600', isSel);
        btn.classList.toggle('text-white', isSel);
        btn.classList.toggle('border-indigo-600', isSel);
        btn.classList.toggle('shadow', isSel);
        btn.classList.toggle('bg-white', !isSel);
        btn.classList.toggle('text-slate-700', !isSel);
        btn.classList.toggle('border-transparent', !isSel);
    });
}

function resetPortalModal() {
    document.getElementById('portal-step-select').classList.remove('hidden');
    document.getElementById('portal-step-join').classList.add('hidden');
    document.getElementById('join-error-msg').textContent = '';
    document.getElementById('join-room-code-input').value = '';
    document.getElementById('portal-current-nickname').textContent = getPlayerNickname();
}

function showJoinTeamStep() {
    document.getElementById('portal-step-select').classList.add('hidden');
    document.getElementById('portal-step-join').classList.remove('hidden');
    document.getElementById('join-room-code-input').focus();
}

function copyRoomCodeToClipboard() {
    if (!currentRoomInfo || !currentRoomInfo.code) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentRoomInfo.code);
    }
    const copyBtn = document.getElementById('copy-room-code-btn');
    if (copyBtn) {
        const orig = copyBtn.textContent;
        copyBtn.textContent = '✅ 복사됨!';
        setTimeout(() => { copyBtn.textContent = orig; }, 1400);
    }
}

async function createTeamAndEnterRoom() {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const currentChar = CHARACTER_TYPES.find(c => c.id === selectedCharType);
    const hostMember = {
        id: window.myPlayerId || 'local_host',
        name: getPlayerNickname(),
        emoji: currentChar ? currentChar.emoji : '🦎',
        charType: selectedCharType,
        colorHex: selectedColorHex,
        points: 0,
        isHost: true
    };
    currentRoomInfo = {
        role: 'HOST',
        code: code,
        totalRounds: selectedTotalRounds,
        currentRound: 1,
        members: [hostMember]
    };
    window.currentRoomInfo = currentRoomInfo;
    window.hasPlayedFirstRound = false;

    if (window.syncCreateRoom) {
        await window.syncCreateRoom(currentRoomInfo, hostMember);
    }
    closeModal();
    startPartySequence();
}

async function submitJoinRoom() {
    const inputCode = document.getElementById('join-room-code-input').value.trim();
    const errEl = document.getElementById('join-error-msg');
    if (!/^\d{6}$/.test(inputCode)) {
        errEl.textContent = '⚠️ 6자리 숫자 방 번호를 정확히 입력해주세요!';
        return;
    }

    const currentChar = CHARACTER_TYPES.find(c => c.id === selectedCharType);
    const guestMember = {
        id: window.myPlayerId || 'local_guest',
        name: getPlayerNickname(),
        emoji: currentChar ? currentChar.emoji : '🦎',
        charType: selectedCharType,
        colorHex: selectedColorHex,
        points: 0,
        isHost: false
    };

    if (window.syncJoinRoom) {
        errEl.textContent = '⏳ 방 확인 중...';
        const res = await window.syncJoinRoom(inputCode, guestMember);
        if (!res.ok) {
            errEl.textContent = res.error;
            return;
        }
        currentRoomInfo = {
            role: 'GUEST',
            code: inputCode,
            totalRounds: res.totalRounds,
            currentRound: 1,
            members: [guestMember]
        };
        window.currentRoomInfo = currentRoomInfo;
        window.hasPlayedFirstRound = false;
    }

    closeModal();
    startPartySequence();
}

function syncPartyRoomCharacters() {
    if (!partyRoomGroup || !currentRoomInfo) return;
    const seatXPositions = [-2.55, -0.85, 0.85, 2.55];
    const activeIds = new Set();

    currentRoomInfo.members.forEach((m, idx) => {
        const key = m.id || `member_${idx}`;
        activeIds.add(key);
        const seatX = seatXPositions[idx % seatXPositions.length];

        if (!roomCharacterMap[key]) {
            const charObj = new JellyCharacter(
                m.charType || 'chameleon',
                m.colorHex !== undefined ? m.colorHex : 0x2ed573,
                seatX,
                -2.3,
                m.name,
                partyRoomGroup
            );
            roomCharacterMap[key] = charObj;
        }
        const charObj = roomCharacterMap[key];
        if (!charObj.isSeatedOnSofa) {
            charObj.isSeatedOnSofa = true;
            charObj.seatHopTimer = 0.55;
        }
        charObj.group.position.set(seatX, 0.72, -2.25);
        // 앞(카메라 쪽)을 바라보고 소파에 앉는 기본 자세
        charObj.group.rotation.y = 0;
        charObj.leftLeg.rotation.x = -Math.PI / 2;
        charObj.rightLeg.rotation.x = -Math.PI / 2;
        charObj.leftLeg.position.set(-0.26, 0.52, 0.28);
        charObj.rightLeg.position.set(0.26, 0.52, 0.28);
        charObj.headGroup.rotation.x = 0;
    });

    Object.keys(roomCharacterMap).forEach(key => {
        if (!activeIds.has(key)) {
            partyRoomGroup.remove(roomCharacterMap[key].group);
            delete roomCharacterMap[key];
        }
    });
}

function updatePartyRoomHUD() {
    const isHost = !currentRoomInfo || currentRoomInfo.role === 'HOST';
    const roundBadge = document.getElementById('party-round-badge');
    const statusText = document.getElementById('party-status-text');
    const spinBtn = document.getElementById('spin-roulette-btn');
    const startMgBtn = document.getElementById('start-minigame-btn');
    const returnBtn = document.getElementById('return-lobby-btn');

    if (currentRoomInfo) {
        roundBadge.textContent = `방 ${currentRoomInfo.code} • ${currentRoomInfo.currentRound}/${currentRoomInfo.totalRounds}판`;
    }
    returnBtn.classList.toggle('hidden', !isHost || window.hasPlayedFirstRound);

    if (rouletteState === 'IDLE') {
        statusText.textContent = isHost
            ? `🛋️ 팀원 ${currentRoomInfo ? currentRoomInfo.members.length : 1}명 착석! 룰렛을 돌려주세요!`
            : `🛋️ 착석 완료! 방장이 룰렛을 돌릴 때까지 대기 중...`;
        spinBtn.classList.toggle('hidden', !isHost);
        startMgBtn.classList.add('hidden');
    } else if (rouletteState === 'SPINNING') {
        statusText.textContent = '🎲 두구두구두구... 미니게임 룰렛 회전 중!';
        spinBtn.classList.add('hidden');
        startMgBtn.classList.add('hidden');
    } else if (rouletteState === 'DONE' && selectedRouletteGame) {
        statusText.textContent = `🎉 당첨: ${selectedRouletteGame.icon} ${selectedRouletteGame.subtitle}`;
        spinBtn.classList.add('hidden');
        startMgBtn.textContent = `미니게임 시작! ${selectedRouletteGame.icon}`;
        startMgBtn.classList.toggle('hidden', !isHost);
    }
}

function startPartySequence() {
    gamePhase = 'PARTY_ROOM';
    phaseTimer = 0;
    rouletteState = 'IDLE';
    selectedRouletteGame = null;
    drawRouletteMonitor();

    lobbyGroup.visible = false;
    partyRoomGroup.visible = true;
    if (bombGameGroup) bombGameGroup.visible = false;
    if (awardCeremonyGroup) awardCeremonyGroup.visible = false;
    window.isAwardCeremonyActive = false;
    document.getElementById('award-ceremony-overlay').classList.add('hidden');
    scene.background = new THREE.Color(0xdff9fb);
    scene.fog = new THREE.Fog(0xdff9fb, 35, 95);

    document.getElementById('open-selector-btn').classList.add('hidden');
    document.getElementById('room-status-hud').classList.add('hidden');
    document.getElementById('lobby-population-hud').classList.add('hidden');
    document.getElementById('interaction-prompt').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('party-room-hud').classList.remove('hidden');
    document.getElementById('party-scoreboard-hud').classList.remove('hidden');
    renderPartyScoreboard();

    syncPartyRoomCharacters();
    updatePartyRoomHUD();

    if (window.PartySound) {
        window.PartySound.playSfx('portal');
        window.PartySound.startPartyRoomBGM();
    }

    if (window.syncUpdateLobbyState && playerChameleon) {
        window.syncUpdateLobbyState({
            name: getPlayerNickname(),
            charType: selectedCharType,
            colorHex: selectedColorHex,
            x: playerChameleon.group.position.x,
            y: 0,
            z: playerChameleon.group.position.z,
            rotY: 0,
            inLobby: false
        }, true);
    }
}

function triggerRouletteSpin() {
    if (rouletteState === 'SPINNING') return;
    if (currentRoomInfo && currentRoomInfo.role !== 'HOST') return;

    const total = ROULETTE_GAMES.length;
    const targetIdx = Math.floor(Math.random() * total);
    const currentBase = Math.floor(rouletteOffset);
    rouletteTargetOffset = currentBase + total * 5 + ((targetIdx - (currentBase % total) + total) % total);
    rouletteState = 'SPINNING';
    lastRouletteTickSlot = -1;
    updatePartyRoomHUD();

    if (window.syncSpinRoulette && currentRoomInfo) {
        window.syncSpinRoulette(currentRoomInfo.code, Date.now(), targetIdx);
    }
}

window.startRemoteRouletteSpin = function(targetIdx) {
    const total = ROULETTE_GAMES.length;
    const currentBase = Math.floor(rouletteOffset);
    rouletteTargetOffset = currentBase + total * 5 + ((targetIdx - (currentBase % total) + total) % total);
    rouletteState = 'SPINNING';
    lastRouletteTickSlot = -1;
    updatePartyRoomHUD();
};

function triggerStartSelectedMinigame() {
    if (currentRoomInfo && currentRoomInfo.role !== 'HOST') return;
    const gameId = selectedRouletteGame ? selectedRouletteGame.id : 'BOMB_DEFUSAL';

    if (window.syncStartMinigame && currentRoomInfo) {
        window.syncStartMinigame(currentRoomInfo.code, gameId);
    }
    if (gameId === 'GRAMMAR_WALL' && typeof window.enterGrammarWallMinigame === 'function') {
        window.enterGrammarWallMinigame(Date.now());
    } else if (gameId === 'RHYTHM_STAGE' && typeof window.enterRhythmStageMinigame === 'function') {
        window.enterRhythmStageMinigame(Date.now());
    } else if (typeof window.enterBombDefusalMinigame === 'function') {
        window.enterBombDefusalMinigame();
    }
}

function returnToLobby() {
    if (window.currentRoomInfo && window.currentRoomInfo.role !== 'HOST') return;
    gamePhase = 'LOBBY';
    partyRoomGroup.visible = false;
    if (bombGameGroup) bombGameGroup.visible = false;
    if (awardCeremonyGroup) awardCeremonyGroup.visible = false;
    window.isAwardCeremonyActive = false;
    document.getElementById('award-ceremony-overlay').classList.add('hidden');
    lobbyGroup.visible = true;
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 45, 135);

    document.getElementById('party-room-hud').classList.add('hidden');
    document.getElementById('party-scoreboard-hud').classList.add('hidden');
    document.getElementById('open-selector-btn').classList.remove('hidden');
    document.getElementById('lobby-population-hud').classList.remove('hidden');
    updateMonitorCanvas();

    if (currentRoomInfo) {
        document.getElementById('room-status-hud').classList.remove('hidden');
        document.getElementById('hud-room-code').textContent = currentRoomInfo.code;
        const isHost = currentRoomInfo.role === 'HOST';
        document.getElementById('hud-start-game-btn').classList.toggle('hidden', !isHost);
        document.getElementById('hud-guest-wait-badge').classList.toggle('hidden', isHost);
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
    if (window.PartySound) {
        window.PartySound.startLobbyBGM();
    }
}

function attachMedalToCharacter(charObj, rankIndex) {
    if (!charObj || !charObj.bodyPivot) return;
    const medalColors = [0xffd32a, 0xdcdde1, 0xcd6133]; // 금, 은, 동
    const ribbonColors = [0xff4757, 0x1e90ff, 0x2ed573];
    const mColor = medalColors[rankIndex];
    const rColor = ribbonColors[rankIndex];

    const medalGroup = new THREE.Group();
    const ribbon = new THREE.Mesh(
        new THREE.TorusGeometry(0.46, 0.045, 8, 24),
        new THREE.MeshStandardMaterial({ color: rColor, roughness: 0.4 })
    );
    ribbon.rotation.x = Math.PI / 2.3;
    ribbon.position.set(0, 1.16, 0.06);

    const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20),
        new THREE.MeshStandardMaterial({ color: mColor, metalness: 0.75, roughness: 0.2, emissive: mColor, emissiveIntensity: 0.2 })
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, 0.92, 0.56);

    medalGroup.add(ribbon, disc);
    charObj.bodyPivot.add(medalGroup);
}

window.enterAwardCeremony = function() {
    window.isAwardCeremonyActive = true;
    gamePhase = 'AWARD_CEREMONY';
    phaseTimer = 0;

    if (!awardCeremonyGroup) {
        awardCeremonyGroup = new THREE.Group();
        scene.add(awardCeremonyGroup);
    }
    while (awardCeremonyGroup.children.length > 0) {
        awardCeremonyGroup.remove(awardCeremonyGroup.children[0]);
    }
    awardCeremonyActors = [];
    awardConfetti = [];

    lobbyGroup.visible = false;
    partyRoomGroup.visible = false;
    if (bombGameGroup) bombGameGroup.visible = false;
    if (typeof wallGameGroup !== 'undefined' && wallGameGroup) wallGameGroup.visible = false;
    if (typeof rhythmGameGroup !== 'undefined' && rhythmGameGroup) rhythmGameGroup.visible = false;
    awardCeremonyGroup.visible = true;

    scene.background = new THREE.Color(0x1b1464);
    scene.fog = new THREE.Fog(0x1b1464, 24, 75);

    const stageFloor = new THREE.Mesh(
        new THREE.CylinderGeometry(11, 11.5, 0.5, 48),
        new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.35, metalness: 0.25 })
    );
    stageFloor.position.y = -0.25;
    stageFloor.receiveShadow = true;

    const carpet = new THREE.Mesh(
        new THREE.BoxGeometry(8.5, 0.06, 6.5),
        new THREE.MeshStandardMaterial({ color: 0xff4757, roughness: 0.7 })
    );
    carpet.position.set(0, 0.03, 0.5);
    awardCeremonyGroup.add(stageFloor, carpet);

    const podiumConfigs = [
        { rank: 1, x: 0.0,  h: 2.1, color: 0xffd32a, label: '1st' },
        { rank: 2, x: -2.4, h: 1.4, color: 0xdcdde1, label: '2nd' },
        { rank: 3, x: 2.4,  h: 0.9, color: 0xcd6133, label: '3rd' }
    ];
    podiumConfigs.forEach(cfg => {
        const block = new THREE.Mesh(
            new THREE.BoxGeometry(2.1, cfg.h, 2.0),
            new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.3, metalness: 0.35 })
        );
        block.position.set(cfg.x, cfg.h / 2, -0.5);
        block.castShadow = true;

        const cnv = document.createElement('canvas');
        cnv.width = 256;
        cnv.height = 128;
        const c = cnv.getContext('2d');
        c.fillStyle = '#141a2e';
        c.font = '900 72px "Fredoka", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(cfg.label, 128, 64);
        const badge = new THREE.Mesh(
            new THREE.PlaneGeometry(1.5, 0.75),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cnv), transparent: true })
        );
        badge.position.set(cfg.x, cfg.h / 2, 0.52);

        awardCeremonyGroup.add(block, badge);
    });

    const members = (window.currentRoomInfo && window.currentRoomInfo.members.length > 0)
        ? [...window.currentRoomInfo.members]
        : [{ id: window.myPlayerId || 'local', name: getPlayerNickname(), charType: selectedCharType, colorHex: selectedColorHex, points: 0 }];
    members.sort((a, b) => (b.points || 0) - (a.points || 0));

    const spotPositions = [
        { x: 0.0,  y: 2.1, z: -0.5 },
        { x: -2.4, y: 1.4, z: -0.5 },
        { x: 2.4,  y: 0.9, z: -0.5 },
        { x: 4.5,  y: 0.0, z: 0.3 }
    ];

    members.slice(0, 4).forEach((m, idx) => {
        const sp = spotPositions[idx] || spotPositions[3];
        const charObj = new JellyCharacter(
            m.charType || 'chameleon',
            m.colorHex !== undefined ? m.colorHex : 0x2ed573,
            sp.x,
            sp.z,
            `${m.name} (${m.points || 0}PT)`,
            awardCeremonyGroup
        );
        charObj.group.position.set(sp.x, sp.y, sp.z);
        charObj.group.rotation.y = 0;
        if (idx < 3) {
            attachMedalToCharacter(charObj, idx);
        }
        awardCeremonyActors.push({
            char: charObj,
            baseY: sp.y,
            rankIdx: idx
        });
    });

    const confettiColors = [0xffd32a, 0xff4757, 0x2ed573, 0x1e90ff, 0xff9ff3, 0xffffff];
    for (let i = 0; i < 80; i++) {
        const piece = new THREE.Mesh(
            new THREE.PlaneGeometry(0.18, 0.12),
            new THREE.MeshBasicMaterial({ color: confettiColors[i % confettiColors.length], side: THREE.DoubleSide })
        );
        piece.position.set((Math.random() - 0.5) * 12, 2 + Math.random() * 8, (Math.random() - 0.5) * 8);
        piece.userData = {
            vy: 1.2 + Math.random() * 1.8,
            sway: Math.random() * Math.PI * 2,
            rx: (Math.random() - 0.5) * 6,
            ry: (Math.random() - 0.5) * 6
        };
        awardCeremonyGroup.add(piece);
        awardConfetti.push(piece);
    }

    const champName = members[0] ? members[0].name : '우승자';
    const champPts = members[0] ? (members[0].points || 0) : 0;
    document.getElementById('award-champion-banner').textContent = `🏆 최종 우승: ${champName} (${champPts} PT)! 축하합니다!`;

    document.getElementById('party-room-hud').classList.add('hidden');
    document.getElementById('party-scoreboard-hud').classList.remove('hidden');
    renderPartyScoreboard();
    document.getElementById('award-ceremony-overlay').classList.remove('hidden');

    const isHost = !window.currentRoomInfo || window.currentRoomInfo.role === 'HOST';
    document.getElementById('award-host-controls').classList.toggle('hidden', !isHost);
    document.getElementById('award-guest-controls').classList.toggle('hidden', isHost);

    if (window.PartySound) {
        window.PartySound.startAwardBGM();
    }
};

function restartSameParty() {
    if (window.currentRoomInfo && window.currentRoomInfo.role !== 'HOST') return;
    if (window.currentRoomInfo) {
        window.currentRoomInfo.currentRound = 1;
        window.currentRoomInfo.members.forEach(m => { m.points = 0; });
        if (window.syncRestartSameParty) {
            window.syncRestartSameParty(window.currentRoomInfo.code, window.currentRoomInfo.members);
        }
    }
    window.exitAwardCeremonyToRoom();
}

window.exitAwardCeremonyToRoom = function() {
    window.isAwardCeremonyActive = false;
    window.hasPlayedFirstRound = false;
    if (window.PartySound) window.PartySound.stopBGM();
    document.getElementById('award-ceremony-overlay').classList.add('hidden');
    if (awardCeremonyGroup) awardCeremonyGroup.visible = false;
    if (window.currentRoomInfo) {
        window.currentRoomInfo.currentRound = 1;
        window.currentRoomInfo.members.forEach(m => { m.points = 0; });
    }
    startPartySequence();
};

function leaveAwardToLobby() {
    window.isAwardCeremonyActive = false;
    window.hasPlayedFirstRound = false;
    if (window.PartySound) window.PartySound.stopBGM();
    document.getElementById('award-ceremony-overlay').classList.add('hidden');
    if (awardCeremonyGroup) awardCeremonyGroup.visible = false;
    window.currentRoomInfo = null;

    gamePhase = 'LOBBY';
    partyRoomGroup.visible = false;
    if (bombGameGroup) bombGameGroup.visible = false;
    lobbyGroup.visible = true;
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 45, 135);

    document.getElementById('party-room-hud').classList.add('hidden');
    document.getElementById('party-scoreboard-hud').classList.add('hidden');
    document.getElementById('room-status-hud').classList.add('hidden');
    document.getElementById('open-selector-btn').classList.remove('hidden');
    document.getElementById('lobby-population-hud').classList.remove('hidden');
    updateMonitorCanvas();

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
    if (window.PartySound) window.PartySound.startLobbyBGM();
}

function closeModal() {
    const modal = document.getElementById('custom-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    resetPortalModal();
}

function triggerInteraction() {
    if (isSelectingCharacter || gamePhase !== 'LOBBY' || !isNearPortal) return;
    resetPortalModal();
    const modal = document.getElementById('custom-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function setupControls() {
    window.addEventListener('keydown', (e) => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            if (e.code === 'Enter' && isSelectingCharacter) confirmCharacterSelection();
            return;
        }
        if (isSelectingCharacter) {
            if (e.code === 'ArrowLeft') prevCharacter();
            if (e.code === 'ArrowRight') nextCharacter();
            if (e.code === 'Enter') confirmCharacterSelection();
            return;
        }
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': keys.up = true; break;
            case 'KeyS': case 'ArrowDown': keys.down = true; break;
            case 'KeyA': case 'ArrowLeft': keys.left = true; break;
            case 'KeyD': case 'ArrowRight': keys.right = true; break;
            case 'KeyE':
            case 'Enter':
                if (gamePhase === 'LOBBY' && isNearPortal) {
                    triggerInteraction();
                }
                break;
            case 'Space':
                if (gamePhase === 'LOBBY') {
                    if (isNearPortal) {
                        triggerInteraction();
                    } else {
                        playerChameleon.jump();
                        if (window.PartySound) window.PartySound.playSfx('jump');
                    }
                }
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'KeyW': case 'ArrowUp': keys.up = false; break;
            case 'KeyS': case 'ArrowDown': keys.down = false; break;
            case 'KeyA': case 'ArrowLeft': keys.left = false; break;
            case 'KeyD': case 'ArrowRight': keys.right = false; break;
        }
    });

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', (e) => {
        if (e.button === 0 && !isSelectingCharacter) {
            handleShoveAttack();
        }
        isDragging = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
        if (!isDragging || isSelectingCharacter) return;
        cameraAngle -= (e.clientX - prevMouseX) * 0.008;
        cameraPitch = Math.max(0.1, Math.min(0.85, cameraPitch + (e.clientY - prevMouseY) * 0.006));
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
    });
    window.addEventListener('pointerup', () => { isDragging = false; });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    if (gamePhase === 'MINIGAME_BOMB' && typeof window.updateAndRenderBombMinigame === 'function') {
        window.updateAndRenderBombMinigame(dt, elapsed);
        return;
    }

    if (gamePhase === 'MINIGAME_WALL' && typeof window.updateAndRenderWallMinigame === 'function') {
        window.updateAndRenderWallMinigame(dt, elapsed);
        return;
    }

    if (gamePhase === 'MINIGAME_RHYTHM' && typeof window.updateAndRenderRhythmMinigame === 'function') {
        window.updateAndRenderRhythmMinigame(dt, elapsed);
        return;
    }

    if (gamePhase === 'AWARD_CEREMONY') {
        phaseTimer += dt;
        awardCeremonyActors.forEach((act, idx) => {
            const jumpFreq = act.rankIdx === 0 ? 7.2 : act.rankIdx === 1 ? 5.6 : 4.5;
            const jumpAmp = act.rankIdx === 0 ? 0.72 : act.rankIdx === 1 ? 0.45 : 0.3;
            const jump = Math.abs(Math.sin(elapsed * jumpFreq + idx * 0.9)) * jumpAmp;
            act.char.group.position.y = act.baseY + jump;
            act.char.leftArm.rotation.z = 2.45 + Math.sin(elapsed * 9 + idx) * 0.25;
            act.char.rightArm.rotation.z = -2.45 - Math.sin(elapsed * 9 + idx) * 0.25;
            act.char.group.rotation.y = Math.sin(elapsed * 2.5 + idx) * 0.25;
        });

        awardConfetti.forEach(p => {
            p.position.y -= p.userData.vy * dt;
            p.position.x += Math.sin(elapsed * 2.5 + p.userData.sway) * 0.6 * dt;
            p.rotation.x += p.userData.rx * dt;
            p.rotation.y += p.userData.ry * dt;
            if (p.position.y < 0.1) p.position.y = 9.5;
        });

        camera.position.lerp(new THREE.Vector3(0, 3.8, 9.2), 4 * dt);
        camera.lookAt(0, 2.0, -0.5);
        renderer.render(scene, camera);
        return;
    }

    Object.values(remoteLobbyPlayers).forEach((remote) => {
        const ch = remote.char;
        const dx = remote.targetPos.x - ch.group.position.x;
        const dz = remote.targetPos.z - ch.group.position.z;
        const moveDist = Math.hypot(dx, dz);

        ch.group.position.x += dx * 12 * dt + ch.velocity.x * dt;
        ch.group.position.z += dz * 12 * dt + ch.velocity.z * dt;
        ch.velocity.x *= 0.85;
        ch.velocity.z *= 0.85;

        if (!ch.isGrounded || ch.velocity.y !== 0) {
            ch.velocity.y -= 20 * dt;
            ch.group.position.y += ch.velocity.y * dt;
            if (ch.group.position.y <= remote.targetPos.y) {
                ch.group.position.y = remote.targetPos.y;
                ch.velocity.y = 0;
                ch.isGrounded = true;
            }
        } else {
            ch.group.position.y += (remote.targetPos.y - ch.group.position.y) * 12 * dt;
        }

        let rDiff = remote.targetRotY - ch.group.rotation.y;
        while (rDiff < -Math.PI) rDiff += Math.PI * 2;
        while (rDiff > Math.PI) rDiff -= Math.PI * 2;
        ch.group.rotation.y += rDiff * 12 * dt;

        if (ch.isShoving) {
            ch.shoveTimer -= dt;
            const progress = 1 - Math.max(0, ch.shoveTimer / 0.34);
            const punchCurve = Math.sin(progress * Math.PI);
            ch.bodyPivot.rotation.x = punchCurve * 0.42;
            ch.leftArm.rotation.x = -punchCurve * 1.45;
            ch.rightArm.rotation.x = -punchCurve * 1.45;
            if (ch.shoveTimer <= 0) {
                ch.isShoving = false;
                ch.bodyPivot.rotation.x = 0;
                ch.leftArm.rotation.x = 0;
                ch.rightArm.rotation.x = 0;
            }
        } else if (moveDist > 0.04) {
            ch.walkTime += dt * 14;
            const bounce = Math.abs(Math.sin(ch.walkTime));
            ch.bodyPivot.position.y = bounce * 0.15;
            ch.leftLeg.position.z = Math.sin(ch.walkTime) * 0.2;
            ch.rightLeg.position.z = -Math.sin(ch.walkTime) * 0.2;
        } else {
            ch.bodyPivot.position.y = Math.sin(elapsed * 3) * 0.03;
            ch.leftLeg.position.z = 0;
            ch.rightLeg.position.z = 0;
        }
    });

    if (gamePhase === 'LOBBY') {
        if (portalRing) portalRing.rotation.z = elapsed * 0.5;
        if (portalInnerRing) portalInnerRing.rotation.z = -elapsed * 0.9;
        if (portalInner) portalInner.rotation.z = elapsed * 1.1;
        portalParticles.forEach(p => {
            p.userData.angle += p.userData.speed * dt;
            p.position.x = Math.cos(p.userData.angle) * p.userData.radius;
            p.position.y = 2.65 + Math.sin(p.userData.angle) * p.userData.radius;
        });
        clouds.forEach(c => {
            c.group.position.x += c.speed * dt;
            if (c.group.position.x > 48) c.group.position.x = -48;
        });
        flowers.forEach(f => { f.group.rotation.z = Math.sin(elapsed * 2.2 + f.phase) * 0.08; });

        for (let i = shoveEffects.length - 1; i >= 0; i--) {
            const eff = shoveEffects[i];
            eff.life -= dt;
            if (eff.life <= 0) {
                lobbyGroup.remove(eff.group);
                shoveEffects.splice(i, 1);
            } else {
                const ratio = 1 - eff.life / eff.maxLife;
                eff.group.scale.setScalar(1 + ratio * 2.2);
                eff.mat.opacity = (1 - ratio) * 0.9;
            }
        }

        const moveDir = new THREE.Vector3();
        if (!isSelectingCharacter) {
            const forward = new THREE.Vector3(-Math.sin(cameraAngle), 0, -Math.cos(cameraAngle));
            const right = new THREE.Vector3(Math.cos(cameraAngle), 0, -Math.sin(cameraAngle));
            if (keys.up) moveDir.add(forward);
            if (keys.down) moveDir.sub(forward);
            if (keys.left) moveDir.sub(right);
            if (keys.right) moveDir.add(right);
        }
        playerChameleon.update(dt, moveDir);

        if (!isSelectingCharacter) {
            syncMyLobbyData(false);
        }

        if (isSelectingCharacter) {
            playerChameleon.group.rotation.y = 0;
            const targetPos = playerChameleon.group.position;
            camera.position.lerp(new THREE.Vector3(targetPos.x, targetPos.y + 1.85, targetPos.z + 4.4), 10 * dt);
            camera.lookAt(targetPos.x, targetPos.y + 1.15, targetPos.z);
        } else {
            const targetPos = playerChameleon.group.position;
            const camDist = 11.5;
            const desiredCamPos = new THREE.Vector3(
                targetPos.x + Math.sin(cameraAngle) * camDist * Math.cos(cameraPitch),
                targetPos.y + 2.2 + Math.sin(cameraPitch) * camDist,
                targetPos.z + Math.cos(cameraAngle) * camDist * Math.cos(cameraPitch)
            );
            camera.position.lerp(desiredCamPos, 8 * dt);
            camera.lookAt(targetPos.x, targetPos.y + 1.1, targetPos.z);

            const distToPortal = Math.hypot(targetPos.x, targetPos.z + 9);
            const promptEl = document.getElementById('interaction-prompt');
            if (distToPortal < 3.6) {
                isNearPortal = true;
                promptEl.classList.remove('opacity-0', 'pointer-events-none');
            } else {
                isNearPortal = false;
                promptEl.classList.add('opacity-0', 'pointer-events-none');
            }
        }
    } else if (gamePhase === 'PARTY_ROOM') {
        phaseTimer += dt;

        Object.values(roomCharacterMap).forEach((ch, idx) => {
            if (ch.seatHopTimer && ch.seatHopTimer > 0) {
                ch.seatHopTimer = Math.max(0, ch.seatHopTimer - dt);
                const hop = Math.sin((1 - ch.seatHopTimer / 0.55) * Math.PI) * 0.65;
                ch.group.position.y = 0.72 + hop;
            } else {
                ch.group.position.y = 0.72;
            }
            ch.bodyPivot.position.y = Math.sin(elapsed * 4 + idx) * 0.035;
            ch.leftLeg.rotation.x = -Math.PI / 2 + Math.sin(elapsed * 5 + idx) * 0.12;
            ch.rightLeg.rotation.x = -Math.PI / 2 - Math.sin(elapsed * 5 + idx) * 0.12;

            if (rouletteState === 'IDLE') {
                // 처음 입장 & 대기 중: 앞(카메라)을 보고 앉아서 여유롭게 흔들거리는 모션
                ch.group.rotation.y += (0 - ch.group.rotation.y) * 8 * dt;
                ch.headGroup.rotation.x = Math.sin(elapsed * 3 + idx) * 0.05;
                ch.leftArm.rotation.z = 0.55;
                ch.rightArm.rotation.z = -0.55;
                ch.leftArm.rotation.x = -0.35;
                ch.rightArm.rotation.x = -0.35;
            } else {
                // 룰렛 돌아갈 때 & 당첨 시: 뒤쪽 TV 모니터를 돌아보며 기대·환호!
                ch.group.rotation.y += (Math.PI - ch.group.rotation.y) * 8 * dt;
                ch.headGroup.rotation.x = 0.26;
                if (rouletteState === 'DONE') {
                    ch.leftArm.rotation.z = 2.4 + Math.sin(elapsed * 10 + idx) * 0.25;
                    ch.rightArm.rotation.z = -2.4 - Math.sin(elapsed * 10 + idx) * 0.25;
                }
            }
        });

        if (rouletteState === 'SPINNING') {
            const remaining = rouletteTargetOffset - rouletteOffset;
            rouletteSpeed = Math.max(0.45, Math.min(24, remaining * 3.1));
            rouletteOffset += rouletteSpeed * dt;
            const currentSlot = Math.floor(rouletteOffset);
            if (currentSlot !== lastRouletteTickSlot) {
                lastRouletteTickSlot = currentSlot;
                if (window.PartySound) window.PartySound.playSfx('roulette_tick');
            }
            if (rouletteOffset >= rouletteTargetOffset) {
                rouletteOffset = rouletteTargetOffset;
                rouletteState = 'DONE';
                const total = ROULETTE_GAMES.length;
                const finalIdx = ((Math.round(rouletteOffset) % total) + total) % total;
                selectedRouletteGame = ROULETTE_GAMES[finalIdx];
                if (window.PartySound) window.PartySound.playSfx('roulette_win');
                updatePartyRoomHUD();
            }
            drawRouletteMonitor();
        }

        if (rouletteState === 'SPINNING' || rouletteState === 'DONE') {
            // 룰렛 돌릴 때만 대형 TV 모니터로 줌인 확대!
            camera.position.lerp(new THREE.Vector3(0, 6.2, 0.2), 3.6 * dt);
            camera.lookAt(0, 6.35, -6.2);
        } else {
            // 처음 입장 & 대기 시: 소파에 앉은 전체 모습과 TV가 함께 보이는 전체 풀샷 구도
            camera.position.lerp(new THREE.Vector3(0, 4.4, 7.6), 4.0 * dt);
            camera.lookAt(0, 3.6, -4.5);
        }
    }

    renderer.render(scene, camera);
}

window.onload = function () {
    console.log("13");
    initScene();
    initCharacterSelectUI();
    setupControls();
    animate();
};
