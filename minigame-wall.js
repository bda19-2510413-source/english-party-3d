// ==========================================
// 미니게임 2: 영어 문법 벽 돌파 (GRAMMAR WALL) 독립 모듈
// - 끊김 없는 연속 웨이브 + 중반 라인 이후 정답 벽 파괴 & 후반 급가속
// - 바다/하늘 섬/구름/깃발 기둥 배경 + 3.4초 시네마틱 오프닝 + READY / START! + 질주 BGM
// ==========================================
window.isWallMinigameActive = false;

let wallGameGroup = null;
let wallSubPhase = 'INTRO'; // 'INTRO' (3.4초 활주로 오프닝) | 'RUN' (연속 벽 돌진) | 'RESULT' (최종 순위)
let wallPhaseTimer = 0;
let wallWaveTimer = 0;
let wallQuestionQueue = [];
let currentWallIdx = 0;
let currentWallZ = -14;
let leftWallMesh = null, rightWallMesh = null;
let leftWallLabel = null, rightWallLabel = null;
let wallBoardCanvas = null, wallBoardCtx = null, wallBoardTexture = null;
let wallFragments = [];
let wallSceneryProps = [];
let wallSeaMesh = null;
let wallPlayers = {};
let lastWallSyncTime = 0;
let leftWallShattered = false;
let rightWallShattered = false;

const GRAMMAR_WALL_QUESTIONS = [
    { q: 'She ___ to school every day.', left: 'go', right: 'goes', ans: 'RIGHT', tip: '3인칭 단수(She) 현재형은 goes!' },
    { q: 'I am interested ___ music.', left: 'on', right: 'in', ans: 'RIGHT', tip: 'be interested in (~에 관심이 있다)' },
    { q: 'They ___ soccer yesterday.', left: 'played', right: 'play', ans: 'LEFT', tip: 'yesterday(어제)는 과거형 played!' },
    { q: 'This book is ___ than that one.', left: 'more good', right: 'better', ans: 'RIGHT', tip: 'good의 비교급은 better!' },
    { q: 'There ___ many apples on the table.', left: 'is', right: 'are', ans: 'RIGHT', tip: '복수 명사(apples) 앞에는 are!' },
    { q: 'He ___ like spicy food.', left: "doesn't", right: "don't", ans: 'LEFT', tip: "3인칭 단수 부정은 doesn't!" },
    { q: 'We have lived here ___ 2020.', left: 'for', right: 'since', ans: 'RIGHT', tip: '특정 시점(2020년) 이후로는 since!' },
    { q: 'Look! The baby is ___ now.', left: 'sleeping', right: 'sleep', ans: 'LEFT', tip: '현재진행형은 be + ~ing!' },
    { q: 'You ___ cross the red light.', left: 'must', right: "mustn't", ans: 'RIGHT', tip: '빨간불에는 건너면 안 된다(must not)!' },
    { q: 'Can you help ___ with my homework?', left: 'me', right: 'I', ans: 'LEFT', tip: '동사 뒤 목적격은 me!' }
];

function createWallTextCanvas(text, bgColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 384);

    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 14;
    ctx.strokeRect(14, 14, 484, 356);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 76px "Fredoka", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 200);

    return new THREE.CanvasTexture(canvas);
}

function buildWallArena() {
    if (!wallGameGroup) {
        wallGameGroup = new THREE.Group();
        scene.add(wallGameGroup);
    }
    while (wallGameGroup.children.length > 0) {
        wallGameGroup.remove(wallGameGroup.children[0]);
    }
    wallFragments = [];
    wallSceneryProps = [];

    wallSeaMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(240, 240),
        new THREE.MeshStandardMaterial({ color: 0x38ada9, roughness: 0.35, metalness: 0.1 })
    );
    wallSeaMesh.rotation.x = -Math.PI / 2;
    wallSeaMesh.position.set(0, -14, -10);
    wallGameGroup.add(wallSeaMesh);

    const islandSpots = [
        { x: -16, y: -1.5, z: -14, r: 5.5, treeColor: 0x2ed573 },
        { x: 16,  y: -1.0, z: -12, r: 5.8, treeColor: 0xffa502 },
        { x: -18, y: -2.2, z: 2,   r: 4.8, treeColor: 0x1e90ff },
        { x: 18,  y: -1.8, z: 4,   r: 5.0, treeColor: 0xff6b81 },
        { x: -13, y: -3.0, z: -28, r: 6.2, treeColor: 0x7bed9f },
        { x: 14,  y: -2.8, z: -26, r: 6.0, treeColor: 0x70a1ff }
    ];
    islandSpots.forEach(isl => {
        const islGroup = new THREE.Group();
        islGroup.position.set(isl.x, isl.y, isl.z);

        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(isl.r, isl.r * 1.4, 7),
            new THREE.MeshStandardMaterial({ color: 0xb3743b, roughness: 0.85, flatShading: true })
        );
        cone.position.y = -isl.r * 0.7;

        const topGrass = new THREE.Mesh(
            new THREE.CylinderGeometry(isl.r * 1.02, isl.r, 0.7, 7),
            new THREE.MeshStandardMaterial({ color: 0xa3ecc9, roughness: 0.75 })
        );
        topGrass.position.y = 0.2;

        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.42, 2.0, 8),
            new THREE.MeshStandardMaterial({ color: 0x778beb })
        );
        trunk.position.y = 1.4;
        const crown = new THREE.Mesh(
            new THREE.DodecahedronGeometry(1.5, 1),
            new THREE.MeshStandardMaterial({ color: isl.treeColor, roughness: 0.5 })
        );
        crown.position.y = 3.2;

        islGroup.add(cone, topGrass, trunk, crown);
        wallGameGroup.add(islGroup);
    });

    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    [
        { x: -24, y: 12, z: -24 },
        { x: 24,  y: 14, z: -22 },
        { x: -10, y: 16, z: -34 },
        { x: 12,  y: 15, z: -32 }
    ].forEach(cp => {
        const cl = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 1), cloudMat);
        cl.scale.set(1.8, 0.85, 1.1);
        cl.position.set(cp.x, cp.y, cp.z);
        wallGameGroup.add(cl);
    });

    const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.8, 26),
        new THREE.MeshStandardMaterial({ color: 0xf1f2f6, roughness: 0.65 })
    );
    bridge.position.set(0, -0.4, -3);
    bridge.receiveShadow = true;
    wallGameGroup.add(bridge);

    const centerLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.04, 26),
        new THREE.MeshBasicMaterial({ color: 0x3742fa })
    );
    centerLine.position.set(0, 0.02, -3);
    wallGameGroup.add(centerLine);

    const flagColors = [0xff4757, 0xffd32a, 0x2ed573, 0x1e90ff];
    [-6.15, 6.15].forEach((bx, sideIdx) => {
        const curb = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.25, 26),
            new THREE.MeshStandardMaterial({ color: 0xffd32a, roughness: 0.4 })
        );
        curb.position.set(bx, 0.12, -3);
        wallGameGroup.add(curb);

        for (let i = 0; i < 8; i++) {
            const zPos = -15 + i * 3.4;
            const postGroup = new THREE.Group();
            postGroup.position.set(bx + (sideIdx === 0 ? -0.45 : 0.45), 0, zPos);

            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1, 0.12, 2.8, 8),
                new THREE.MeshStandardMaterial({ color: 0x2f3542 })
            );
            pole.position.y = 1.4;
            const topBall = new THREE.Mesh(
                new THREE.SphereGeometry(0.2, 10, 10),
                new THREE.MeshBasicMaterial({ color: 0xffd32a })
            );
            topBall.position.y = 2.85;
            const flag = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, 0.55, 0.8),
                new THREE.MeshStandardMaterial({ color: flagColors[(i + sideIdx) % flagColors.length] })
            );
            flag.position.set(sideIdx === 0 ? -0.35 : 0.35, 2.3, 0);

            postGroup.add(pole, topBall, flag);
            wallGameGroup.add(postGroup);
            wallSceneryProps.push(postGroup);
        }
    });

    const boardFrame = new THREE.Mesh(
        new THREE.BoxGeometry(13.2, 4.4, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.4 })
    );
    boardFrame.position.set(0, 5.4, -16.8);
    wallGameGroup.add(boardFrame);

    [-5.4, 5.4].forEach(px => {
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.35, 5.4, 12),
            new THREE.MeshStandardMaterial({ color: 0x2f3542 })
        );
        leg.position.set(px, 2.7, -16.8);
        wallGameGroup.add(leg);
    });

    wallBoardCanvas = document.createElement('canvas');
    wallBoardCanvas.width = 1024;
    wallBoardCanvas.height = 340;
    wallBoardCtx = wallBoardCanvas.getContext('2d');
    wallBoardTexture = new THREE.CanvasTexture(wallBoardCanvas);

    const boardScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(12.6, 3.9),
        new THREE.MeshBasicMaterial({ map: wallBoardTexture })
    );
    boardScreen.position.set(0, 5.4, -16.58);
    wallGameGroup.add(boardScreen);

    const wallGeo = new THREE.BoxGeometry(5.8, 3.6, 0.85);
    leftWallMesh = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0x3742fa, roughness: 0.4 }));
    rightWallMesh = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0xff4757, roughness: 0.4 }));

    leftWallLabel = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3.3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    leftWallLabel.position.z = 0.44;
    leftWallMesh.add(leftWallLabel);

    rightWallLabel = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3.3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    rightWallLabel.position.z = 0.44;
    rightWallMesh.add(rightWallLabel);

    leftWallMesh.position.set(-2.95, 1.8, -14);
    rightWallMesh.position.set(2.95, 1.8, -14);
    wallGameGroup.add(leftWallMesh, rightWallMesh);
}

function drawWallQuestionBoard(qObj, revealAnswer = false) {
    if (!wallBoardCtx || !qObj) return;
    const ctx = wallBoardCtx;
    ctx.fillStyle = '#141a2e';
    ctx.fillRect(0, 0, 1024, 340);

    ctx.strokeStyle = '#ffd32a';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 1004, 320);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px "Fredoka", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(qObj.q, 512, 125);

    if (revealAnswer) {
        ctx.fillStyle = '#2ed573';
        ctx.font = '900 32px "Noto Sans KR", sans-serif';
        ctx.fillText(`정답: ${qObj.ans === 'LEFT' ? qObj.left : qObj.right} (${qObj.tip})`, 512, 245);
    } else {
        ctx.fillStyle = '#70a1ff';
        ctx.font = 'bold 28px "Noto Sans KR", sans-serif';
        ctx.fillText('◀ 정답 벽 줄에 서면 벽이 부서지고, 오답 벽은 뒤로 밀어냅니다! ▶', 512, 245);
    }
    wallBoardTexture.needsUpdate = true;
}

function spawnWallDestructionFragments(centerX, centerZ, colorHex) {
    const fragMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 });
    for (let i = 0; i < 24; i++) {
        const frag = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.55, 0.55), fragMat);
        frag.position.set(
            centerX + (Math.random() - 0.5) * 5.0,
            0.4 + Math.random() * 3.0,
            centerZ + (Math.random() - 0.5) * 0.6
        );
        frag.userData = {
            vx: (Math.random() - 0.5) * 9,
            vy: 3 + Math.random() * 6,
            vz: 4 + Math.random() * 8,
            rx: (Math.random() - 0.5) * 10,
            ry: (Math.random() - 0.5) * 10,
            life: 1.0
        };
        wallGameGroup.add(frag);
        wallFragments.push(frag);
    }
}

window.enterGrammarWallMinigame = function(seedNum) {
    if (window.isWallMinigameActive) return;
    window.isWallMinigameActive = true;
    gamePhase = 'MINIGAME_WALL';
    wallSubPhase = 'INTRO';
    wallPhaseTimer = 0;
    wallWaveTimer = 0;
    window._wallReadyPlayed = false;

    const indices = GRAMMAR_WALL_QUESTIONS.map((_, i) => i);
    let s = Number(seedNum || 12345);
    for (let i = indices.length - 1; i > 0; i--) {
        s = (s * 9301 + 49297) % 233280;
        const j = Math.floor((s / 233280) * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    wallQuestionQueue = indices.slice(0, 6).map(i => GRAMMAR_WALL_QUESTIONS[i]);

    buildWallArena();
    wallPlayers = {};

    const members = (window.currentRoomInfo && window.currentRoomInfo.members.length > 0)
        ? window.currentRoomInfo.members
        : [{ id: window.myPlayerId || 'local', name: getPlayerNickname(), charType: selectedCharType, colorHex: selectedColorHex, isHost: true }];

    members.forEach((m, idx) => {
        const startX = (idx - (members.length - 1) / 2) * 1.45;
        const startZ = 2.8;
        const charObj = new JellyCharacter(
            m.charType || 'chameleon',
            m.colorHex !== undefined ? m.colorHex : 0x2ed573,
            startX,
            startZ,
            m.name || '플레이어',
            wallGameGroup
        );
        charObj.group.rotation.y = Math.PI;
        wallPlayers[m.id] = {
            member: m,
            char: charObj,
            x: startX,
            z: startZ,
            y: 0,
            vx: 0,
            vz: 0,
            vy: 0,
            rotY: Math.PI,
            alive: true,
            eliminatedWave: 999,
            survivedCount: 0,
            beingPushedByWall: false
        };
    });

    lobbyGroup.visible = false;
    partyRoomGroup.visible = false;
    if (bombGameGroup) bombGameGroup.visible = false;
    wallGameGroup.visible = true;

    scene.background = new THREE.Color(0x74b9ff);
    scene.fog = new THREE.Fog(0x74b9ff, 35, 110);

    document.getElementById('party-room-hud').classList.add('hidden');
    document.getElementById('party-scoreboard-hud').classList.add('hidden');
    document.getElementById('wall-game-overlay').classList.remove('hidden');
    document.getElementById('wall-result-panel').classList.add('hidden');
    document.getElementById('wall-phase-banner').textContent = '🎬 OPENING: 전광판 문제를 보고 정답 벽으로 달려가세요!';
    document.getElementById('wall-timer-text').textContent = 'INTRO';

    if (window.PartySound) {
        window.PartySound.playSfx('intro_fanfare');
        window.PartySound.startWallBGM();
    }

    startNextWallWave(0);
    renderWallAliveBadges();
};

function startNextWallWave(idx) {
    currentWallIdx = idx;
    const qObj = wallQuestionQueue[idx % wallQuestionQueue.length];
    currentWallZ = -14.5;
    wallWaveTimer = 0;
    leftWallShattered = false;
    rightWallShattered = false;

    leftWallMesh.visible = true;
    rightWallMesh.visible = true;
    leftWallMesh.position.set(-2.95, 1.8, currentWallZ);
    rightWallMesh.position.set(2.95, 1.8, currentWallZ);

    leftWallLabel.material.map = createWallTextCanvas(qObj.left, '#3742fa');
    leftWallLabel.material.needsUpdate = true;
    rightWallLabel.material.map = createWallTextCanvas(qObj.right, '#ff4757');
    rightWallLabel.material.needsUpdate = true;

    drawWallQuestionBoard(qObj, false);

    document.getElementById('wall-question-text').textContent = `Q${idx + 1}. ${qObj.q}`;
    document.getElementById('wall-left-label').textContent = `◀ ${qObj.left}`;
    document.getElementById('wall-right-label').textContent = `${qObj.right} ▶`;
    if (wallSubPhase === 'RUN') {
        document.getElementById('wall-phase-banner').textContent = `🧱 WAVE ${idx + 1}/${wallQuestionQueue.length}: 정답 벽 앞으로 이동!`;
    }

    Object.values(wallPlayers).forEach(p => {
        p.beingPushedByWall = false;
    });
}

function renderWallAliveBadges() {
    const box = document.getElementById('wall-alive-list');
    if (!box) return;
    box.innerHTML = '';
    Object.values(wallPlayers).forEach(p => {
        const badge = document.createElement('div');
        badge.className = `px-3 py-1 rounded-full text-xs font-black shadow ${p.alive ? 'bg-white/90 text-slate-800' : 'bg-slate-800/75 text-slate-400 line-through'}`;
        badge.textContent = `${p.member.emoji || '🦎'} ${p.member.name} (${p.survivedCount}돌파)`;
        box.appendChild(badge);
    });
}

window.handleWallLocalShove = function() {
    if (!window.isWallMinigameActive || wallSubPhase !== 'RUN') return;
    const myId = window.myPlayerId || 'local';
    const me = wallPlayers[myId];
    if (!me || !me.alive) return;

    me.char.isShoving = false;
    me.char.shove();
    if (window.PartySound) window.PartySound.playSfx('shove');

    const forward = new THREE.Vector3(Math.sin(me.rotY), 0, Math.cos(me.rotY));
    me.vx += forward.x * 4.5;
    me.vz += forward.z * 4.5;

    let hitTargetId = '';
    let pushVx = 0, pushVz = 0;

    Object.entries(wallPlayers).forEach(([pid, target]) => {
        if (pid === myId || !target.alive) return;
        const dx = target.x - me.x;
        const dz = target.z - me.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 2.2) {
            const nx = dist > 0.01 ? dx / dist : forward.x;
            const nz = dist > 0.01 ? dz / dist : forward.z;
            if (nx * forward.x + nz * forward.z > 0.1) {
                hitTargetId = pid;
                pushVx = forward.x * 11.5;
                pushVz = forward.z * 11.5;
                target.vx += pushVx;
                target.vz += pushVz;
            }
        }
    });

    if (window.syncWallPlayerState && window.currentRoomInfo) {
        window.syncWallPlayerState(window.currentRoomInfo.code, {
            x: me.x, y: me.y, z: me.z, rotY: me.rotY,
            alive: me.alive,
            shoveEventId: Date.now(),
            shoveTargetId: hitTargetId,
            shoveVx: pushVx,
            shoveVz: pushVz
        });
    }
};

window.onWallPlayersUpdated = function(playersState) {
    if (!window.isWallMinigameActive || !playersState) return;
    const myId = window.myPlayerId || 'local';

    Object.entries(playersState).forEach(([pid, st]) => {
        const p = wallPlayers[pid];
        if (!p) return;

        if (pid !== myId) {
            if (st.x !== undefined) p.targetX = st.x;
            if (st.z !== undefined) p.targetZ = st.z;
            if (st.y !== undefined) p.targetY = st.y;
            if (st.rotY !== undefined) p.rotY = st.rotY;
            if (st.alive === false && p.alive) {
                p.alive = false;
                renderWallAliveBadges();
            }
            if (st.shoveEventId && st.shoveEventId !== p.lastShoveEventId) {
                p.lastShoveEventId = st.shoveEventId;
                p.char.group.rotation.y = p.rotY;
                p.char.isShoving = false;
                p.char.shove();
                if (st.shoveTargetId === myId && wallPlayers[myId] && wallPlayers[myId].alive) {
                    wallPlayers[myId].vx += (st.shoveVx || 0);
                    wallPlayers[myId].vz += (st.shoveVz || 0);
                }
            }
        }
    });
};

function finishWallMinigameResults() {
    if (wallSubPhase === 'RESULT') return;
    wallSubPhase = 'RESULT';
    if (window.PartySound) {
        window.PartySound.stopBGM();
        window.PartySound.playSfx('win');
    }
    document.getElementById('wall-phase-banner').textContent = '🏆 문법 벽 돌파 최종 결과!';
    document.getElementById('wall-timer-text').textContent = '0.0';

    const sorted = Object.values(wallPlayers).sort((a, b) => {
        if (a.alive !== b.alive) return a.alive ? -1 : 1;
        return b.survivedCount - a.survivedCount;
    });

    const rankPointTable = [10, 7, 5, 3, 2];
    const awardedPointsMap = {};
    const rankDisplayMap = {};
    const winners = [];

    let currentRank = 1;
    sorted.forEach((p, idx) => {
        if (idx > 0) {
            const prev = sorted[idx - 1];
            if (p.alive !== prev.alive || p.survivedCount < prev.survivedCount) {
                currentRank = idx + 1;
            }
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
                    ${p.alive ? '🎉 생존!' : '👋 탈락'}
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

    if (window.syncPlayerMinigameFinished && window.currentRoomInfo) {
        window.syncPlayerMinigameFinished(window.currentRoomInfo.code);
    }

    const isHost = !window.currentRoomInfo || window.currentRoomInfo.role === 'HOST';
    const nextBtn = document.getElementById('wall-next-round-btn');
    const waitEl = document.getElementById('wall-guest-next-wait');
    const totalMembers = window.currentRoomInfo ? window.currentRoomInfo.members.length : 1;
    const isFinalRound = window.currentRoomInfo && (window.currentRoomInfo.currentRound >= window.currentRoomInfo.totalRounds);

    if (isHost) {
        nextBtn.classList.remove('hidden');
        if (totalMembers > 1) {
            nextBtn.disabled = true;
            nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
            nextBtn.textContent = '⏳ 다른 파티원 결과 집계 대기 중...';
        } else {
            nextBtn.disabled = false;
            nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            nextBtn.textContent = isFinalRound ? '최종 시상식 이동! 🏆' : '파티 룸으로 돌아가기 🛋️';
        }
        waitEl.classList.add('hidden');
    } else {
        nextBtn.classList.add('hidden');
        waitEl.classList.remove('hidden');
    }
}

function finishWallMinigameToRoom() {
    const nextBtn = document.getElementById('wall-next-round-btn');
    if (nextBtn && nextBtn.disabled) return;
    window.hasPlayedFirstRound = true;
    const isFinalRound = window.currentRoomInfo && (window.currentRoomInfo.currentRound >= window.currentRoomInfo.totalRounds);

    if (isFinalRound) {
        if (window.syncStartAwardCeremony && window.currentRoomInfo) {
            window.syncStartAwardCeremony(window.currentRoomInfo.code);
        }
        window.exitWallMinigameToRoom(true);
        return;
    }

    let nextRound = 2;
    if (window.currentRoomInfo) {
        window.currentRoomInfo.currentRound = (window.currentRoomInfo.currentRound || 1) + 1;
        nextRound = window.currentRoomInfo.currentRound;
    }
    if (window.syncReturnToPartyRoom && window.currentRoomInfo) {
        window.syncReturnToPartyRoom(window.currentRoomInfo.code, nextRound);
    }
    window.exitWallMinigameToRoom(false);
}

window.exitWallMinigameToRoom = function(goToCeremony = false) {
    window.hasPlayedFirstRound = true;
    window.isWallMinigameActive = false;
    if (window.PartySound) window.PartySound.stopBGM();
    document.getElementById('wall-game-overlay').classList.add('hidden');
    if (wallGameGroup) wallGameGroup.visible = false;
    if (goToCeremony && typeof window.enterAwardCeremony === 'function') {
        window.enterAwardCeremony();
    } else {
        startPartySequence();
    }
};

window.updateAndRenderWallMinigame = function(dt, elapsed) {
    wallPhaseTimer += dt;
    wallWaveTimer += dt;

    const scrollSpeed = wallSubPhase === 'RUN' ? 6.5 : 2.0;
    wallSceneryProps.forEach(prop => {
        prop.position.z += scrollSpeed * dt;
        if (prop.position.z > 10.5) {
            prop.position.z -= 27.2;
        }
    });

    for (let i = wallFragments.length - 1; i >= 0; i--) {
        const f = wallFragments[i];
        f.userData.life -= dt * 1.1;
        f.userData.vy -= 18 * dt;
        f.position.x += f.userData.vx * dt;
        f.position.y += f.userData.vy * dt;
        f.position.z += f.userData.vz * dt;
        f.rotation.x += f.userData.rx * dt;
        f.rotation.y += f.userData.ry * dt;
        if (f.userData.life <= 0) {
            wallGameGroup.remove(f);
            wallFragments.splice(i, 1);
        }
    }

    if (wallSubPhase === 'INTRO') {
        const introT = Math.min(1, wallPhaseTimer / 3.4);
        camera.position.set(
            Math.sin((1 - introT) * 1.1) * 9.0,
            6.5 + introT * 3.1,
            -4.5 + introT * 21.3
        );
        camera.lookAt(0, 2.4, -2.5);
        if (wallPhaseTimer >= 2.1 && !window._wallReadyPlayed) {
            window._wallReadyPlayed = true;
            document.getElementById('wall-phase-banner').textContent = '✨ READY...';
            if (typeof window.showMinigameCountdown === 'function') window.showMinigameCountdown('READY...');
            if (window.PartySound) window.PartySound.playSfx('ready');
        }
        if (wallPhaseTimer >= 3.4) {
            window._wallReadyPlayed = false;
            wallSubPhase = 'RUN';
            wallWaveTimer = 0;
            document.getElementById('wall-phase-banner').textContent = '🧱 WAVE 1: 정답 벽 앞으로 이동! (좌클릭 밀치기!)';
            if (typeof window.showMinigameCountdown === 'function') window.showMinigameCountdown('START! 🧱');
            if (window.PartySound) window.PartySound.playSfx('start');
        }
        renderer.render(scene, camera);
        return;
    } else if (wallSubPhase === 'RUN') {
        const revealZ = 4.2;
        const isRevealPointReached = currentWallZ >= revealZ;
        const baseWallSpeed = 4.2 + currentWallIdx * 0.45;
        const lateBoost = isRevealPointReached ? 2.15 : (currentWallZ > 0 ? 1.25 : 1.0);
        const wallSpeed = baseWallSpeed * lateBoost;

        currentWallZ += wallSpeed * dt;
        leftWallMesh.position.z = currentWallZ;
        rightWallMesh.position.z = currentWallZ;

        const qObj = wallQuestionQueue[currentWallIdx % wallQuestionQueue.length];
        const isLeftCorrect = qObj.ans === 'LEFT';
        const rem = Math.max(0, (10.5 - currentWallZ) / wallSpeed);
        document.getElementById('wall-timer-text').textContent = rem.toFixed(1);

        if (isRevealPointReached && !leftWallShattered && !rightWallShattered) {
            drawWallQuestionBoard(qObj, true);
        }

        const wallFrontZ = currentWallZ + 0.55;
        Object.values(wallPlayers).forEach(p => {
            if (!p.alive) return;
            const onLeftSide = p.x < 0;
            const inCorrectZone = (onLeftSide && isLeftCorrect) || (!onLeftSide && !isLeftCorrect);

            if (wallFrontZ >= p.z - 0.35 && currentWallZ - 0.55 <= p.z + 0.45) {
                if (isRevealPointReached && inCorrectZone) {
                    if (onLeftSide && !leftWallShattered) {
                        leftWallShattered = true;
                        leftWallMesh.visible = false;
                        spawnWallDestructionFragments(-2.95, currentWallZ, 0x3742fa);
                        if (window.PartySound) window.PartySound.playSfx('wall_break');
                    } else if (!onLeftSide && !rightWallShattered) {
                        rightWallShattered = true;
                        rightWallMesh.visible = false;
                        spawnWallDestructionFragments(2.95, currentWallZ, 0xff4757);
                        if (window.PartySound) window.PartySound.playSfx('wall_break');
                    }
                } else {
                    p.beingPushedByWall = true;
                    p.z = Math.max(p.z, wallFrontZ + 0.15);
                }
            } else {
                p.beingPushedByWall = false;
            }
        });

        if (currentWallZ > 10.6) {
            Object.values(wallPlayers).forEach(p => {
                if (p.alive) {
                    p.survivedCount += 1;
                    p.beingPushedByWall = false;
                }
            });
            renderWallAliveBadges();

            const aliveCount = Object.values(wallPlayers).filter(p => p.alive).length;
            const totalMembers = Object.keys(wallPlayers).length;
            if ((totalMembers > 1 && aliveCount <= 1) || aliveCount === 0 || currentWallIdx + 1 >= wallQuestionQueue.length) {
                finishWallMinigameResults();
            } else {
                startNextWallWave(currentWallIdx + 1);
            }
        }
    }

    const myId = window.myPlayerId || 'local';
    Object.entries(wallPlayers).forEach(([pid, p]) => {
        if (pid === myId) {
            if (p.alive && wallSubPhase === 'RUN') {
                let moveX = 0, moveZ = 0;
                if (keys.left) moveX -= 1;
                if (keys.right) moveX += 1;
                if (!p.beingPushedByWall) {
                    if (keys.up) moveZ -= 1;
                    if (keys.down) moveZ += 1;
                }

                const len = Math.hypot(moveX, moveZ);
                if (len > 0) {
                    moveX /= len;
                    moveZ /= len;
                    p.x += moveX * 6.4 * dt;
                    p.z += moveZ * 6.4 * dt;
                    p.rotY = Math.atan2(moveX, moveZ);
                }

                p.x += p.vx * dt;
                p.z += p.vz * dt;
                p.vx *= Math.pow(0.05, dt);
                p.vz *= Math.pow(0.05, dt);

                p.x = Math.max(-5.4, Math.min(5.4, p.x));
                p.z = Math.max(-12.5, p.z);

                if (p.z > 9.0) {
                    p.alive = false;
                    p.beingPushedByWall = false;
                    if (window.PartySound) window.PartySound.playSfx('fall');
                    renderWallAliveBadges();
                }

                if (window.syncWallPlayerState && window.currentRoomInfo && elapsed - lastWallSyncTime > 0.08) {
                    lastWallSyncTime = elapsed;
                    window.syncWallPlayerState(window.currentRoomInfo.code, {
                        x: p.x, y: p.y, z: p.z, rotY: p.rotY, alive: p.alive
                    });
                }
            } else if (!p.alive) {
                p.vy -= 22 * dt;
                p.y += p.vy * dt;
                p.z += 2.5 * dt;
                p.rotY += 5 * dt;
            }
        } else {
            if (p.alive) {
                if (p.targetX !== undefined) p.x += (p.targetX - p.x) * 10 * dt;
                if (p.targetZ !== undefined) p.z += (p.targetZ - p.z) * 10 * dt;
            } else {
                p.vy -= 22 * dt;
                p.y += p.vy * dt;
                p.rotY += 5 * dt;
            }
        }

        p.char.group.position.set(p.x, p.y, p.z);
        p.char.group.rotation.y = p.rotY;

        if (p.char.isShoving) {
            p.char.shoveTimer -= dt;
            const progress = 1 - Math.max(0, p.char.shoveTimer / 0.34);
            const punchCurve = Math.sin(progress * Math.PI);
            p.char.bodyPivot.rotation.x = punchCurve * 0.42;
            p.char.bodyPivot.position.z = punchCurve * 0.24;
            p.char.leftArm.rotation.x = -punchCurve * 1.45;
            p.char.rightArm.rotation.x = -punchCurve * 1.45;
            p.char.leftArm.rotation.z = 0.4 - punchCurve * 0.35;
            p.char.rightArm.rotation.z = -0.4 + punchCurve * 0.35;
            p.char.leftArm.position.z = 0.05 + punchCurve * 0.38;
            p.char.rightArm.position.z = 0.05 + punchCurve * 0.38;
            p.char.bodyPivot.scale.set(1 - punchCurve * 0.12, 1 - punchCurve * 0.08, 1 + punchCurve * 0.22);

            if (p.char.shoveTimer <= 0) {
                p.char.isShoving = false;
                p.char.bodyPivot.rotation.x = 0;
                p.char.bodyPivot.position.z = 0;
                p.char.leftArm.rotation.x = 0;
                p.char.rightArm.rotation.x = 0;
                p.char.leftArm.rotation.z = 0.4;
                p.char.rightArm.rotation.z = -0.4;
                p.char.leftArm.position.z = 0.05;
                p.char.rightArm.position.z = 0.05;
                p.char.bodyPivot.scale.set(1, 1, 1);
            }
        } else if (p.alive) {
            const bounce = Math.abs(Math.sin(elapsed * 12 + p.x));
            p.char.bodyPivot.position.y = bounce * 0.12;
            p.char.leftArm.rotation.z = 0.4;
            p.char.rightArm.rotation.z = -0.4;
        } else {
            p.char.leftArm.rotation.z = 2.5;
            p.char.rightArm.rotation.z = -2.5;
        }
    });

    camera.position.lerp(new THREE.Vector3(0, 9.6, 16.8), 5 * dt);
    camera.lookAt(0, 2.4, -2.5);

    renderer.render(scene, camera);
};
