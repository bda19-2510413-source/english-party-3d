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

let lobbyGroup, partyRoomGroup;
let gamePhase = 'LOBBY';
let phaseTimer = 0;
// 파티 룸 소파 캐릭터 맵 (playerId -> { char, targetX, targetZ, seated, jumped })
let roomCharacterMap = {};
let tvCanvas, tvCtx, tvTexture;

const ROULETTE_GAMES = [
    { title: 'SPEED VOCAB QUIZ', subtitle: '제한시간 영단어 스피드 퀴즈!', color: '#3742fa', icon: '⚡' },
    { title: 'WORD SCRAMBLE', subtitle: '뒤섞인 알파벳 블록 맞추기!', color: '#2ed573', icon: '🔤' },
    { title: 'BOMB WORD CHAIN', subtitle: '폭탄 돌리기 영어 끝말잇기!', color: '#ff4757', icon: '💣' },
    { title: 'SENTENCE BUILDER', subtitle: '영어 문장 순서 조립하기!', color: '#ffa502', icon: '🧩' },
    { title: 'MYSTERY 20 Q&A', subtitle: '스무고개 영어 힌트 추리!', color: '#9c88ff', icon: '🕵️' },
    { title: 'LISTENING MATCH', subtitle: '발음 듣고 그림 카드 찾기!', color: '#1e90ff', icon: '🎧' }
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

    // 로비(포탈 들판) 실시간 멀티플레이 입장 동기화
    if (window.syncJoinLobby && playerChameleon) {
        window.syncJoinLobby({
            name: finalNick,
            charType: selectedCharType,
            colorHex: selectedColorHex,
            x: playerChameleon.group.position.x,
            y: playerChameleon.group.position.y,
            z: playerChameleon.group.position.z,
            rotY: playerChameleon.group.rotation.y
        });
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
// 로비(포탈 들판) 다른 플레이어 실시간 동기화 & 밀치기 판정
// ==========================================
window.onLobbyPlayersUpdated = function(allPlayers, myId) {
    const now = Date.now();
    const activeIds = new Set();

    Object.entries(allPlayers).forEach(([pid, pData]) => {
        if (pid === myId) return;
        // 파티 룸에 들어갔거나 15초 이상 응답 없는 플레이어는 로비에서 숨김
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

        // 상대방이 밀치기를 사용했을 때 이펙트 및 피격 넉백 적용
        if (pData.shoveEventId && pData.shoveEventId !== remote.lastShoveEventId) {
            remote.lastShoveEventId = pData.shoveEventId;
            const forward = new THREE.Vector3(Math.sin(remote.targetRotY), 0, Math.cos(remote.targetRotY));
            const wavePos = remote.char.group.position.clone().add(new THREE.Vector3(0, 0.9, 0)).add(forward.multiplyScalar(0.95));
            spawnShoveWave(wavePos, remote.targetRotY);

            if (pData.shoveTargetId === myId && playerChameleon && gamePhase === 'LOBBY') {
                playerChameleon.velocity.x += (pData.shoveVx || 0);
                playerChameleon.velocity.z += (pData.shoveVz || 0);
                playerChameleon.velocity.y = 5.5;
                playerChameleon.isGrounded = false;
            }
        }
    });

    // 로비를 떠난 플레이어 제거
    Object.keys(remoteLobbyPlayers).forEach(pid => {
        if (!activeIds.has(pid)) {
            lobbyGroup.remove(remoteLobbyPlayers[pid].char.group);
            delete remoteLobbyPlayers[pid];
        }
    });
};

// 내가 로비에서 좌클릭 밀치기를 할 때 주변 다른 플레이어 넉백 처리
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
    if (gamePhase !== 'LOBBY') {
        syncSofaCharacters();
    }
};

// 기존 앉아 있는 캐릭터는 그대로 두고 새로 들어온 플레이어만 소파로 걸어가 앉도록 관리
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
            // 이미 방에 있는 캐릭터는 seated 상태와 포즈를 그대로 유지!
            roomCharacterMap[mId].targetX = seatX;
        }
    });

    // 방에서 나간 멤버만 제거
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

    // 로비에서는 퇴장 상태로 표시
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
    scene.background = new THREE.Color(0xdff9fb);
    scene.fog = new THREE.Fog(0xdff9fb, 35, 95);

    // 이전 파티룸 캐릭터 맵 초기화 후 현재 멤버 배치
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
    const isHost = !window.currentRoomInfo || window.currentRoomInfo.role === 'HOST';
    document.getElementById('return-lobby-btn').classList.toggle('hidden', !isHost);
    document.getElementById('party-status-text').textContent = '🛋️ 소파로 걸어가 자리에 앉는 중...';

    camera.position.set(0, 4.2, 8.8);
    camera.lookAt(0, 3.2, -3.5);
}

function triggerRouletteSpin() {
    if (window.currentRoomInfo && window.currentRoomInfo.role !== 'HOST') return;
    const targetIdx = Math.floor(Math.random() * ROULETTE_GAMES.length);
    beginRouletteAnimation(targetIdx);

    if (window.syncSpinRoulette && window.currentRoomInfo) {
        window.syncSpinRoulette(window.currentRoomInfo.code, Date.now(), targetIdx);
    }
}

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
    document.getElementById('party-status-text').textContent = '🎰 모니터 확대 및 룰렛 회전 중!';
}

function returnToLobby() {
    if (window.currentRoomInfo && window.currentRoomInfo.role !== 'HOST') return;
    gamePhase = 'LOBBY';
    partyRoomGroup.visible = false;
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

    if (gamePhase !== 'LOBBY') {
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
                // 이미 앉은 캐릭터는 좌석 X 미세 보정 및 부드러운 호흡 모션만 재생
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
                        const spinBtn = document.getElementById('spin-roulette-btn');
                        spinBtn.textContent = '룰렛 다시 돌리기 🎰';
                        spinBtn.classList.toggle('hidden', !isHost);
                    }
                }
                drawRouletteMonitor();
            }
        }
        renderer.render(scene, camera);
        return;
    }

    // 로비 다른 플레이어 위치 보간 및 걷기 애니메이션 업데이트
    Object.values(remoteLobbyPlayers).forEach(remote => {
        const g = remote.char.group;
        const prevX = g.position.x;
        const prevZ = g.position.z;
        g.position.lerp(remote.targetPos, 10 * dt);

        let diff = remote.targetRotY - g.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        g.rotation.y += diff * 10 * dt;

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
                        const spinBtn = document.getElementById('spin-roulette-btn');
                        spinBtn.textContent = '룰렛 다시 돌리기 🎰';
                        spinBtn.classList.toggle('hidden', !isHost);
                    }
                }
                drawRouletteMonitor();
            }
        }
        renderer.render(scene, camera);
        return;
    }

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
    } else {
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