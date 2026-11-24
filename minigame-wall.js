// ==========================================
// 미니게임 2: 영어 문법 벽 돌파 (GRAMMAR WALL) 독립 모듈
// - 분할 화면 없이 파티원 전원이 하나의 3D 트랙에서 경쟁
// - 정답 벽은 파편으로 산산조각 나며 통과, 오답 벽은 뒤로 밀려 추락 탈락!
// ==========================================
window.isWallMinigameActive = false;

let wallGameGroup = null;
let wallSubPhase = 'INTRO'; // 'INTRO' (3초 안내) | 'CHOOSE' (10초 이동/밀치기) | 'IMPACT' (벽 충돌/파괴 연출) | 'RESULT' (최종 순위)
let wallPhaseTimer = 0;
let wallQuestionIndex = 0;
let wallQuestionOrder = [];
let wallPlayers = {}; // { [playerId]: { member, char, x, z, vx, vz, alive, eliminatedRound, rank, isFalling, fallVy } }
let wallMonitorCanvas = null, wallMonitorCtx = null, wallMonitorTexture = null;
let leftWallMesh = null, rightWallMesh = null;
let leftWallCanvas = null, leftWallCtx = null, leftWallTex = null;
let rightWallCanvas = null, rightWallCtx = null, rightWallTex = null;
let wallFragments = [];
let wallShoveWaves = [];
let lastWallPosSync = 0;
let wallRoundAnswerSide = 'LEFT'; // 'LEFT' | 'RIGHT'

const GRAMMAR_QUESTIONS = [
    { q: 'She ___ to school every day.', left: 'go', right: 'goes', ans: 'RIGHT', exp: '3인칭 단수(She) 현재형은 goes!' },
    { q: 'They ___ soccer yesterday.', left: 'played', right: 'play', ans: 'LEFT', exp: 'yesterday(어제)는 과거형 played!' },
    { q: 'There ___ two apples on the desk.', left: 'is', right: 'are', ans: 'RIGHT', exp: '복수 명사(two apples)는 are!' },
    { q: 'He ___ like spicy food.', left: "doesn't", right: "don't", ans: 'LEFT', exp: '3인칭 단수 부정은 doesn\'t!' },
    { q: 'I am interested ___ music.', left: 'on', right: 'in', ans: 'RIGHT', exp: '~에 관심이 있다는 be interested in!' },
    { q: 'Look! The baby ___ now.', left: 'is sleeping', right: 'sleeps', ans: 'LEFT', exp: 'Look! / now는 현재진행형 is sleeping!' },
    { q: 'This book is ___ than that one.', left: 'more big', right: 'bigger', ans: 'RIGHT', exp: 'big의 비교급은 bigger!' },
    { q: 'Can you ___ me a favor?', left: 'do', right: 'make', ans: 'LEFT', exp: '부탁을 들어주다는 do a favor!' },
    { q: 'We ___ go to the park tomorrow.', left: 'will', right: 'did', ans: 'LEFT', exp: 'tomorrow(내일)는 미래 조동사 will!' },
    { q: 'How ___ water do you drink?', left: 'many', right: 'much', ans: 'RIGHT', exp: '셀 수 없는 명사(water)는 How much!' },
    { q: 'My sister is good ___ drawing.', left: 'at', right: 'for', ans: 'LEFT', exp: '~을 잘하다는 be good at!' },
    { q: 'I have lived here ___ 2020.', left: 'for', right: 'since', ans: 'RIGHT', exp: '특정 시점(2020년) 이후로는 since!' },
    { q: 'You ___ cross on a red light.', left: 'must not', right: 'have to', ans: 'LEFT', exp: '빨간불에는 건너면 안 된다(must not)!' },
    { q: 'She bought ___ umbrella.', left: 'a', right: 'an', ans: 'RIGHT', exp: '모음 발음(umbrella) 앞에는 an!' },
    { q: 'Let’s ___ a movie tonight.', left: 'watch', right: 'watching', ans: 'LEFT', exp: 'Let’s 뒤에는 동사원형 watch!' }
];

function buildWallMinigameStage() {
    if (!wallGameGroup) {
        wallGameGroup = new THREE.Group();
        scene.add(wallGameGroup);
    }
    while (wallGameGroup.children.length > 0) {
        wallGameGroup.remove(wallGameGroup.children[0]);
    }
    wallFragments = [];
    wallShoveWaves = [];

    // 1. 공중 트랙(다리) 바닥: 가로 폭 12 (-6 ~ +6), 세로 길이 18 (-9 ~ +9)
    const trackGeo = new THREE.BoxGeometry(12, 0.8, 18);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0xf1f2f6, roughness: 0.55 });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.position.set(0, -0.4, 0);
    trackMesh.receiveShadow = true;
    wallGameGroup.add(trackMesh);

    // 트랙 테두리 안전선(노랑/검정 경고 라인)
    const borderMat = new THREE.MeshStandardMaterial({ color: 0xffa502, roughness: 0.4 });
    [-5.85, 5.85].forEach(bx => {
        const sideBorder = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.84, 18), borderMat);
        sideBorder.position.set(bx, -0.39, 0);
        wallGameGroup.add(sideBorder);
    });
    const backBorder = new THREE.Mesh(new THREE.BoxGeometry(12, 0.84, 0.35), new THREE.MeshStandardMaterial({ color: 0xff4757 }));
    backBorder.position.set(0, -0.39, 8.85);
    wallGameGroup.add(backBorder);

    // 중앙 분리선 (왼쪽 구역 vs 오른쪽 구역 경계)
    const centerLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.04, 18),
        new THREE.MeshBasicMaterial({ color: 0x3742fa })
    );
    centerLine.position.set(0, 0.02, 0);
    wallGameGroup.add(centerLine);

    // 2. 상단 대형 3D 문법 문제 모니터
    const monitorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(13.5, 4.4, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.3 })
    );
    monitorFrame.position.set(0, 6.2, -9.5);
    wallGameGroup.add(monitorFrame);

    [-5.5, 5.5].forEach(px => {
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.3, 6.2, 12),
            new THREE.MeshStandardMaterial({ color: 0x2f3542 })
        );
        leg.position.set(px, 3.1, -9.5);
        wallGameGroup.add(leg);
    });

    wallMonitorCanvas = document.createElement('canvas');
    wallMonitorCanvas.width = 1024;
    wallMonitorCanvas.height = 340;
    wallMonitorCtx = wallMonitorCanvas.getContext('2d');
    wallMonitorTexture = new THREE.CanvasTexture(wallMonitorCanvas);

    const monitorScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(12.8, 3.9),
        new THREE.MeshBasicMaterial({ map: wallMonitorTexture })
    );
    monitorScreen.position.set(0, 6.2, -9.22);
    wallGameGroup.add(monitorScreen);

    // 3. 왼쪽 / 오른쪽 선택 벽 생성
    leftWallCanvas = document.createElement('canvas');
    leftWallCanvas.width = 512;
    leftWallCanvas.height = 384;
    leftWallCtx = leftWallCanvas.getContext('2d');
    leftWallTex = new THREE.CanvasTexture(leftWallCanvas);

    rightWallCanvas = document.createElement('canvas');
    rightWallCanvas.width = 512;
    rightWallCanvas.height = 384;
    rightWallCtx = rightWallCanvas.getContext('2d');
    rightWallTex = new THREE.CanvasTexture(rightWallCanvas);

    const leftWallGeo = new THREE.BoxGeometry(5.7, 3.6, 0.7);
    const leftMats = [
        new THREE.MeshStandardMaterial({ color: 0x3742fa }),
        new THREE.MeshStandardMaterial({ color: 0x3742fa }),
        new THREE.MeshStandardMaterial({ color: 0x5352ed }),
        new THREE.MeshStandardMaterial({ color: 0x2f3542 }),
        new THREE.MeshBasicMaterial({ map: leftWallTex }), // 앞면(+Z)
        new THREE.MeshStandardMaterial({ color: 0x3742fa })
    ];
    leftWallMesh = new THREE.Mesh(leftWallGeo, leftMats);
    leftWallMesh.position.set(-2.95, 1.8, -8.2);
    leftWallMesh.castShadow = true;

    const rightWallGeo = new THREE.BoxGeometry(5.7, 3.6, 0.7);
    const rightMats = [
        new THREE.MeshStandardMaterial({ color: 0xff4757 }),
        new THREE.MeshStandardMaterial({ color: 0xff4757 }),
        new THREE.MeshStandardMaterial({ color: 0xff6b81 }),
        new THREE.MeshStandardMaterial({ color: 0x2f3542 }),
        new THREE.MeshBasicMaterial({ map: rightWallTex }), // 앞면(+Z)
        new THREE.MeshStandardMaterial({ color: 0xff4757 })
    ];
    rightWallMesh = new THREE.Mesh(rightWallGeo, rightMats);
    rightWallMesh.position.set(2.95, 1.8, -8.2);
    rightWallMesh.castShadow = true;

    wallGameGroup.add(leftWallMesh, rightWallMesh);
}

function drawWallQuestionBoard(qObj, roundNum, totalRounds, statusMsg = '') {
    if (!wallMonitorCtx) return;
    const ctx = wallMonitorCtx;
    const W = 1024, H = 340;

    ctx.fillStyle = '#141a2e';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#ffd32a';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    ctx.fillStyle = '#70a1ff';
    ctx.font = '900 28px "Fredoka", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`QUESTION ${roundNum} / ${totalRounds}`, W / 2, 52);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px "Fredoka", "Noto Sans KR", sans-serif';
    ctx.fillText(qObj.q, W / 2, 155);

    ctx.fillStyle = '#2ed573';
    ctx.font = 'bold 28px "Noto Sans KR", sans-serif';
    ctx.fillText(statusMsg || '◀ 왼쪽 벽 또는 오른쪽 벽 ▶ 앞으로 이동하세요!', W / 2, 265);

    wallMonitorTexture.needsUpdate = true;
}

function drawChoiceWallTexture(ctx, tex, labelTag, optionText, bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 384);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.strokeRect(14, 14, 484, 356);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '900 34px "Fredoka", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labelTag, 256, 82);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 66px "Fredoka", "Noto Sans KR", sans-serif';
    ctx.fillText(optionText, 256, 225);

    tex.needsUpdate = true;
}

function spawnWallDestructionFragments(centerX, zPos, colorHex) {
    const fragMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 });
    for (let i = 0; i < 24; i++) {
        const size = 0.35 + Math.random() * 0.45;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), fragMat);
        mesh.position.set(
            centerX + (Math.random() - 0.5) * 5.0,
            0.4 + Math.random() * 3.0,
            zPos + (Math.random() - 0.5) * 0.6
        );
        wallGameGroup.add(mesh);
        wallFragments.push({
            mesh,
            vx: (Math.random() - 0.5) * 9,
            vy: 4 + Math.random() * 7,
            vz: -4 - Math.random() * 8,
            rx: (Math.random() - 0.5) * 10,
            ry: (Math.random() - 0.5) * 10,
            life: 1.4
        });
    }
}

function setupWallQuestion(idx) {
    const qData = GRAMMAR_QUESTIONS[wallQuestionOrder[idx % GRAMMAR_QUESTIONS.length]];
    wallRoundAnswerSide = qData.ans;

    leftWallMesh.visible = true;
    rightWallMesh.visible = true;
    leftWallMesh.position.set(-2.95, 1.8, -8.2);
    rightWallMesh.position.set(2.95, 1.8, -8.2);

    drawWallQuestionBoard(qData, idx + 1, wallQuestionOrder.length);
    drawChoiceWallTexture(leftWallCtx, leftWallTex, '◀ LEFT', qData.left, '#3742fa');
    drawChoiceWallTexture(rightWallCtx, rightWallTex, 'RIGHT ▶', qData.right, '#ff4757');

    document.getElementById('wall-question-text').textContent = `Q${idx + 1}. ${qData.q}`;
    document.getElementById('wall-left-label').textContent = `◀ ${qData.left}`;
    document.getElementById('wall-right-label').textContent = `${qData.right} ▶`;
}

// ==========================================
// 미니게임 2 진입 및 초기화
// ==========================================
window.enterGrammarWallMinigame = function(seedNum) {
    if (window.isWallMinigameActive) return;
    window.isWallMinigameActive = true;
    gamePhase = 'MINIGAME_WALL';
    wallSubPhase = 'INTRO';
    wallPhaseTimer = 0;
    wallQuestionIndex = 0;

    // 모든 클라이언트가 동일한 문제 순서를 갖도록 시드 기반 셔플
    const indices = GRAMMAR_QUESTIONS.map((_, i) => i);
    let s = Number(seedNum || 12345);
    for (let i = indices.length - 1; i > 0; i--) {
        s = (s * 9301 + 49297) % 233280;
        const j = Math.floor((s / 233280) * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    wallQuestionOrder = indices.slice(0, 5); // 총 5문제 진행

    buildWallMinigameStage();
    wallPlayers = {};

    const members = (window.currentRoomInfo && window.currentRoomInfo.members.length > 0)
        ? window.currentRoomInfo.members
        : [{ id: window.myPlayerId || 'local', name: getPlayerNickname(), charType: selectedCharType, colorHex: selectedColorHex, isHost: true }];

    members.forEach((m, idx) => {
        const spawnX = (idx - (members.length - 1) / 2) * 1.8;
        const charObj = new JellyCharacter(
            m.charType || 'chameleon',
            m.colorHex !== undefined ? m.colorHex : 0x2ed573,
            spawnX,
            2.2,
            m.name || '플레이어',
            wallGameGroup
        );
        charObj.group.rotation.y = Math.PI; // 위쪽 모니터를 바라봄
        wallPlayers[m.id] = {
            member: m,
            char: charObj,
            x: spawnX,
            z: 2.2,
            vx: 0,
            vz: 0,
            targetX: spawnX,
            targetZ: 2.2,
            alive: true,
            survivedCount: 0,
            isFalling: false,
            fallVy: 0,
            pushedBack: false,
            lastShoveId: 0
        };
    });

    lobbyGroup.visible = false;
    partyRoomGroup.visible = false;
    if (bombGameGroup) bombGameGroup.visible = false;
    wallGameGroup.visible = true;

    scene.background = new THREE.Color(0x70a1ff);
    scene.fog = new THREE.Fog(0x70a1ff, 28, 85);

    document.getElementById('party-room-hud').classList.add('hidden');
    document.getElementById('party-scoreboard-hud').classList.add('hidden');
    document.getElementById('wall-game-overlay').classList.remove('hidden');
    document.getElementById('wall-result-panel').classList.add('hidden');
    document.getElementById('wall-phase-banner').textContent = '🧱 위쪽 모니터의 영어 문법 문제를 보고 정답 벽 앞에 서세요!';
    document.getElementById('wall-timer-text').textContent = '10.0';

    setupWallQuestion(0);
    renderWallAliveBadges();
};

function renderWallAliveBadges() {
    const listEl = document.getElementById('wall-alive-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    Object.values(wallPlayers).forEach(p => {
        const badge = document.createElement('span');
        badge.className = `px-3 py-1 rounded-full text-xs font-black shadow ${p.alive ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-slate-300 line-through'}`;
        badge.textContent = `${p.member.emoji || ''} ${p.member.name} (${p.survivedCount}승)`;
        listEl.appendChild(badge);
    });
}

// ==========================================
// 실시간 플레이어 위치 & 밀치기 동기화 콜백
// ==========================================
window.onWallPlayersUpdated = function(playersState) {
    if (!window.isWallMinigameActive || !playersState) return;
    const myId = window.myPlayerId || 'local';

    Object.entries(playersState).forEach(([pid, st]) => {
        const wp = wallPlayers[pid];
        if (!wp || pid === myId) return;
        wp.targetX = st.x !== undefined ? st.x : wp.targetX;
        wp.targetZ = st.z !== undefined ? st.z : wp.targetZ;

        if (st.shoveId && st.shoveId !== wp.lastShoveId) {
            wp.lastShoveId = st.shoveId;
            wp.char.isShoving = false;
            wp.char.shove();

            const me = wallPlayers[myId];
            if (me && me.alive && st.shoveTargetId === myId && wallSubPhase === 'CHOOSE') {
                me.vx += (st.shoveVx || 0);
                me.vz += (st.shoveVz || 0);
            }
        }
    });
};

window.handleWallLocalShove = function() {
    if (!window.isWallMinigameActive || wallSubPhase !== 'CHOOSE') return;
    const myId = window.myPlayerId || 'local';
    const me = wallPlayers[myId];
    if (!me || !me.alive) return;

    me.char.shove();
    const wave = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.35, 20),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    wave.position.set(me.x, 0.9, me.z);
    wave.rotation.y = me.char.group.rotation.y;
    wallGameGroup.add(wave);
    wallShoveWaves.push({ mesh: wave, life: 0.25 });

    const fwdX = Math.sin(me.char.group.rotation.y);
    const fwdZ = Math.cos(me.char.group.rotation.y);
    let hitTargetId = '';
    let pushVx = 0, pushVz = 0;

    Object.entries(wallPlayers).forEach(([pid, other]) => {
        if (pid === myId || !other.alive) return;
        const dx = other.x - me.x;
        const dz = other.z - me.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 2.2) {
            hitTargetId = pid;
            pushVx = fwdX * 14.0;
            pushVz = fwdZ * 14.0;
        }
    });

    if (window.syncWallPlayerState && window.currentRoomInfo) {
        window.syncWallPlayerState(window.currentRoomInfo.code, {
            x: me.x,
            z: me.z,
            shoveId: Date.now(),
            shoveTargetId: hitTargetId,
            shoveVx: pushVx,
            shoveVz: pushVz
        });
    }
};

// ==========================================
// 벽 충돌 및 정답 파괴 / 오답 밀려남 판정
// ==========================================
function triggerWallImpactCheck() {
    wallSubPhase = 'IMPACT';
    wallPhaseTimer = 0;

    const qData = GRAMMAR_QUESTIONS[wallQuestionOrder[wallQuestionIndex]];
    const isLeftCorrect = wallRoundAnswerSide === 'LEFT';

    // 정답 벽은 산산조각 파괴!
    if (isLeftCorrect) {
        leftWallMesh.visible = false;
        spawnWallDestructionFragments(-2.95, 1.2, 0x3742fa);
    } else {
        rightWallMesh.visible = false;
        spawnWallDestructionFragments(2.95, 1.2, 0xff4757);
    }

    drawWallQuestionBoard(
        qData,
        wallQuestionIndex + 1,
        wallQuestionOrder.length,
        `정답: ${isLeftCorrect ? qData.left : qData.right} (${qData.exp})`
    );
    document.getElementById('wall-phase-banner').textContent = `💥 정답은 [${isLeftCorrect ? qData.left : qData.right}]!`;

    // 각 플레이어의 위치(x < 0 왼쪽 vs x >= 0 오른쪽)로 생존/탈락 판정
    Object.values(wallPlayers).forEach(p => {
        if (!p.alive) return;
        const choseLeft = p.x < 0;
        const isCorrect = (choseLeft && isLeftCorrect) || (!choseLeft && !isLeftCorrect);

        if (isCorrect) {
            p.survivedCount += 1;
            p.char.jump();
        } else {
            // 오답 벽에 부딪혀 뒤(+Z)로 강하게 밀려남!
            p.pushedBack = true;
            p.vz = 15.5;
        }
    });

    renderWallAliveBadges();
}

function finishWallMinigameResults() {
    wallSubPhase = 'RESULT';
    document.getElementById('wall-phase-banner').textContent = '🏆 문법 벽 돌파 최종 결과!';

    const sorted = Object.values(wallPlayers).sort((a, b) => {
        if (b.alive !== a.alive) return (b.alive ? 1 : 0) - (a.alive ? 1 : 0);
        return b.survivedCount - a.survivedCount;
    });

    const rankPointTable = [10, 7, 5, 3, 2];
    const awardedPointsMap = {};
    const rankDisplayMap = {};
    const winners = [];

    let currentRank = 1;
    sorted.forEach((p, idx) => {
        if (idx > 0 && (p.alive !== sorted[idx - 1].alive || p.survivedCount < sorted[idx - 1].survivedCount)) {
            currentRank = idx + 1;
        }
        rankDisplayMap[p.member.id] = currentRank;
        awardedPointsMap[p.member.id] = rankPointTable[currentRank - 1] || 2;
        if (currentRank === 1) winners.push(p.member.name);
    });

    if (typeof window.awardMinigamePoints === 'function') {
        window.awardMinigamePoints(awardedPointsMap);
    }

    const listEl = document.getElementById('wall-ranking-list');
    listEl.innerHTML = '';
    sorted.forEach(p => {
        const rNum = rankDisplayMap[p.member.id] || 1;
        const isFirst = rNum === 1;
        const isTied = sorted.filter(x => x.alive === p.alive && x.survivedCount === p.survivedCount).length > 1;
        const rankLabel = isTied ? `공동 ${rNum}등` : `${rNum}등`;
        const earned = awardedPointsMap[p.member.id] || 0;
        const total = window.getMemberTotalPoints ? window.getMemberTotalPoints(p.member.id) : earned;

        const row = document.createElement('div');
        row.className = `flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 ${isFirst ? 'bg-amber-50 border-amber-400' : 'bg-slate-100 border-slate-200'}`;
        row.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="font-black text-base ${isFirst ? 'text-amber-600' : 'text-slate-500'}">${rankLabel}</span>
                <span class="font-black text-slate-800">${p.member.name}</span>
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${p.alive ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}">
                    ${p.alive ? '🎉 완주!' : '💨 탈락'}
                </span>
            </div>
            <div class="text-right">
                <div class="font-black text-indigo-600 text-sm">${p.survivedCount}문제 돌파 <span class="text-emerald-600">(+${earned} PT)</span></div>
                <div class="text-[11px] font-bold text-slate-500">누적 ${total} PT</div>
            </div>
        `;
        listEl.appendChild(row);
    });

    document.getElementById('wall-winner-desc').textContent = `👑 ${winners.join(', ')}님이 문법 벽 돌파에서 우승했습니다!`;
    document.getElementById('wall-result-panel').classList.remove('hidden');

    const isHost = !window.currentRoomInfo || window.currentRoomInfo.role === 'HOST';
    document.getElementById('wall-next-round-btn').classList.toggle('hidden', !isHost);
    document.getElementById('wall-guest-next-wait').classList.toggle('hidden', isHost);
}

function finishWallMinigameToRoom() {
    window.hasPlayedFirstRound = true;
    let nextRound = 2;
    if (window.currentRoomInfo) {
        window.currentRoomInfo.currentRound = (window.currentRoomInfo.currentRound || 1) + 1;
        nextRound = window.currentRoomInfo.currentRound;
    }
    if (window.syncReturnToPartyRoom && window.currentRoomInfo) {
        window.syncReturnToPartyRoom(window.currentRoomInfo.code, nextRound);
    }
    window.exitWallMinigameToRoom();
}

window.exitWallMinigameToRoom = function() {
    window.hasPlayedFirstRound = true;
    window.isWallMinigameActive = false;
    document.getElementById('wall-game-overlay').classList.add('hidden');
    if (wallGameGroup) wallGameGroup.visible = false;
    startPartySequence();
};

// ==========================================
// 매 프레임 업데이트 및 단일 화면 카메라 렌더링
// ==========================================
window.updateAndRenderWallMinigame = function(dt, elapsed) {
    wallPhaseTimer += dt;
    const myId = window.myPlayerId || 'local';
    const me = wallPlayers[myId];

    // 파편 & 밀치기 충격파 업데이트
    for (let i = wallFragments.length - 1; i >= 0; i--) {
        const f = wallFragments[i];
        f.life -= dt;
        f.vy -= 18 * dt;
        f.mesh.position.x += f.vx * dt;
        f.mesh.position.y += f.vy * dt;
        f.mesh.position.z += f.vz * dt;
        f.mesh.rotation.x += f.rx * dt;
        f.mesh.rotation.y += f.ry * dt;
        if (f.life <= 0) {
            wallGameGroup.remove(f.mesh);
            wallFragments.splice(i, 1);
        }
    }
    for (let i = wallShoveWaves.length - 1; i >= 0; i--) {
        const w = wallShoveWaves[i];
        w.life -= dt;
        w.mesh.scale.addScalar(8 * dt);
        w.mesh.material.opacity = Math.max(0, w.life * 3.5);
        if (w.life <= 0) {
            wallGameGroup.remove(w.mesh);
            wallShoveWaves.splice(i, 1);
        }
    }

    // 1. 내 캐릭터 이동(WASD/방향키) 처리
    if (me && me.alive && wallSubPhase === 'CHOOSE') {
        let moveX = 0, moveZ = 0;
        if (keys.left) moveX -= 1;
        if (keys.right) moveX += 1;
        if (keys.up) moveZ -= 1;
        if (keys.down) moveZ += 1;

        if (moveX !== 0 || moveZ !== 0) {
            const len = Math.hypot(moveX, moveZ);
            me.vx = (moveX / len) * 6.5;
            me.vz = (moveZ / len) * 6.5;
            me.char.group.rotation.y = Math.atan2(me.vx, me.vz);
        } else {
            me.vx *= 0.8;
            me.vz *= 0.8;
        }

        me.x = Math.max(-5.3, Math.min(5.3, me.x + me.vx * dt));
        me.z = Math.max(-1.0, Math.min(8.2, me.z + me.vz * dt));
        me.char.group.position.set(me.x, 0, me.z);

        // 걷기 애니메이션
        if (Math.hypot(me.vx, me.vz) > 0.3) {
            const bounce = Math.abs(Math.sin(elapsed * 14));
            me.char.bodyPivot.position.y = bounce * 0.14;
            me.char.leftLeg.position.z = Math.sin(elapsed * 14) * 0.2;
            me.char.rightLeg.position.z = -Math.sin(elapsed * 14) * 0.2;
        } else {
            me.char.bodyPivot.position.y = Math.sin(elapsed * 3) * 0.03;
        }

        // 서버로 내 트랙 위치 전송
        if (Date.now() - lastWallPosSync > 70 && window.syncWallPlayerState && window.currentRoomInfo) {
            lastWallPosSync = Date.now();
            window.syncWallPlayerState(window.currentRoomInfo.code, { x: me.x, z: me.z });
        }
    }

    // 2. 모든 플레이어 보간, 몸통 충돌 & 오답 벽 밀려남/추락 물리
    Object.entries(wallPlayers).forEach(([pid, p]) => {
        if (pid !== myId && p.alive && !p.pushedBack) {
            const prevX = p.x, prevZ = p.z;
            p.x += (p.targetX - p.x) * 10 * dt;
            p.z += (p.targetZ - p.z) * 10 * dt;
            p.char.group.position.set(p.x, 0, p.z);
            const moved = Math.hypot(p.x - prevX, p.z - prevZ);
            if (moved > 0.01) {
                p.char.group.rotation.y = Math.atan2(p.x - prevX, p.z - prevZ);
                p.char.bodyPivot.position.y = Math.abs(Math.sin(elapsed * 14)) * 0.14;
            }
        }

        // 오답 벽에 밀려 뒤로 날아가 낭떠러지 추락!
        if (p.pushedBack) {
            p.z += p.vz * dt;
            p.char.group.rotation.x += 6 * dt;
            if (p.z > 9.0) {
                p.isFalling = true;
                p.fallVy -= 24 * dt;
                p.char.group.position.y += p.fallVy * dt;
                if (p.char.group.position.y < -12) {
                    p.alive = false;
                    p.pushedBack = false;
                    p.char.group.visible = false;
                    renderWallAliveBadges();
                }
            }
            p.char.group.position.x = p.x;
            p.char.group.position.z = p.z;
        }
    });

    // 3. 라운드 상태 머신
    if (wallSubPhase === 'INTRO') {
        document.getElementById('wall-timer-text').textContent = '10.0';
        if (wallPhaseTimer >= 2.5) {
            wallSubPhase = 'CHOOSE';
            wallPhaseTimer = 0;
            document.getElementById('wall-phase-banner').textContent = '🏃 정답 벽 앞으로 이동! (좌클릭으로 밀치기 가능!)';
        }
    } else if (wallSubPhase === 'CHOOSE') {
        const remain = Math.max(0, 10.0 - wallPhaseTimer);
        document.getElementById('wall-timer-text').textContent = remain.toFixed(1);

        // 남은 시간 3.5초부터 선택 벽이 플레이어들 앞(z = 1.2)으로 서서히 다가옴!
        if (remain <= 3.5) {
            const t = 1 - (remain / 3.5);
            const wallZ = -8.2 + t * 9.4; // -8.2 -> +1.2
            leftWallMesh.position.z = wallZ;
            rightWallMesh.position.z = wallZ;
        }

        if (remain <= 0) {
            triggerWallImpactCheck();
        }
    } else if (wallSubPhase === 'IMPACT') {
        if (wallPhaseTimer >= 3.2) {
            const aliveCount = Object.values(wallPlayers).filter(p => p.alive).length;
            wallQuestionIndex += 1;

            if (aliveCount <= 1 && Object.keys(wallPlayers).length > 1 || aliveCount === 0 || wallQuestionIndex >= wallQuestionOrder.length) {
                finishWallMinigameResults();
            } else {
                wallSubPhase = 'CHOOSE';
                wallPhaseTimer = 0;
                setupWallQuestion(wallQuestionIndex);
                document.getElementById('wall-phase-banner').textContent = `🏃 문제 ${wallQuestionIndex + 1}! 정답 벽 앞으로 이동하세요!`;
            }
        }
    }

    // 4. 단일 통합 3D 카메라 뷰 (트랙 전체와 상단 모니터가 한눈에 들어오는 구도)
    camera.position.lerp(new THREE.Vector3(0, 9.5, 16.5), 5 * dt);
    camera.lookAt(0, 2.2, -2.5);
    renderer.render(scene, camera);
};