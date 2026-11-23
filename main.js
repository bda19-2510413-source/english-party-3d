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

let lobbyGroup, partyRoomGroup;
let gamePhase = 'LOBBY';
let phaseTimer = 0;
let roomCharacters = [];
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
}

function openCharacterSelector() {
    isSelectingCharacter = true;
    if (showcasePedestal && playerChameleon) {
        showcasePedestal.position.set(playerChameleon.group.position.x, 0.04, playerChameleon.group.position.z);
        showcasePedestal.visible = true;
    }
    document.getElementById('character-select-overlay').classList.remove('hidden');
    document.getElementById('open-selector-btn').classList.add('hidden');
    updateShowcaseUI();
}

function checkProximity() {
    if (isSelectingCharacter) return;
    const pPos = playerChameleon.group.position;
    const promptEl = document.getElementById('interaction-prompt');
    const distToPortal = pPos.distanceTo(new THREE.Vector3(0, 0, -9));
    if (distToPortal < 3.6) {
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

window.onRoomMembersUpdated = function() {
    updateMonitorCanvas();
    if (gamePhase !== 'LOBBY') {
        rebuildSofaCharacters();
    }
};

function rebuildSofaCharacters() {
    roomCharacters.forEach(rc => partyRoomGroup.remove(rc.char.group));
    roomCharacters = [];

    const seatXPositions = [-2.4, -0.8, 0.8, 2.4, -3.1];
    const members = (window.currentRoomInfo && window.currentRoomInfo.members.length > 0)
        ? window.currentRoomInfo.members
        : [{ name: getPlayerNickname(), charType: selectedCharType, colorHex: selectedColorHex, isHost: true }];

    members.forEach((m, idx) => {
        const cType = m.charType || selectedCharType;
        const cColor = m.colorHex !== undefined ? m.colorHex : selectedColorHex;
        const seatX = seatXPositions[idx % seatXPositions.length];
        const startX = seatX + (idx % 2 === 0 ? -1.1 : 1.1);
        const startZ = 2.6;

        const charObj = new JellyCharacter(cType, cColor, startX, startZ, m.name, partyRoomGroup);
        charObj.group.rotation.y = Math.PI;
        roomCharacters.push({
            char: charObj,
            targetX: seatX,
            targetZ: -2.18,
            seated: false,
            jumped: false
        });
    });
}

function startPartySequence() {
    closeModal();
    isSelectingCharacter = false;
    document.getElementById('character-select-overlay').classList.add('hidden');
    document.getElementById('interaction-prompt').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('open-selector-btn').classList.add('hidden');
    document.getElementById('room-status-hud').classList.add('hidden');

    lobbyGroup.visible = false;
    partyRoomGroup.visible = true;
    scene.background = new THREE.Color(0xdff9fb);
    scene.fog = new THREE.Fog(0xdff9fb, 35, 95);

    rebuildSofaCharacters();

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

        roomCharacters.forEach((rc) => {
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
    }

    renderer.render(scene, camera);
}

window.onload = function () {
    initScene();
    initCharacterSelectorUI();
    setupEvents();
    animate();
};