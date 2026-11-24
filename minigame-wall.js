// ==========================================
// 미니게임 2: 영어 문법 벽 돌파 (GRAMMAR WALL) 독립 모듈
// - 끊김 없는 연속 벽 전진 웨이브 + 오답 벽에 밀려 뒤로 밀려나는 물리 연출
// - 바다, 하늘 섬, 구름, 응원 깃발 기둥 등 풍부한 3D 배경 포함
// ==========================================
window.isWallMinigameActive = false;

// 3D 캐릭터 밀치기 팔 뻗기 애니메이션 헬퍼
function animateWallCharShove(charObj, dt) {
    if (!charObj || !charObj.isShoving) return;
    charObj.shoveTimer -= dt;
    const progress = 1 - Math.max(0, charObj.shoveTimer / 0.34);
    const punchCurve = Math.sin(progress * Math.PI);
    charObj.bodyPivot.rotation.x = punchCurve * 0.42;
    charObj.bodyPivot.position.z = punchCurve * 0.24;
    charObj.leftArm.rotation.x = -punchCurve * 1.45;
    charObj.rightArm.rotation.x = -punchCurve * 1.45;
    charObj.leftArm.rotation.z = 0.4 - punchCurve * 0.35;
    charObj.rightArm.rotation.z = -0.4 + punchCurve * 0.35;
    charObj.leftArm.position.z = 0.05 + punchCurve * 0.38;
    charObj.rightArm.position.z = 0.05 + punchCurve * 0.38;
    charObj.bodyPivot.scale.set(1 - punchCurve * 0.12, 1 - punchCurve * 0.08, 1 + punchCurve * 0.22);

    if (charObj.shoveTimer <= 0) {
        charObj.isShoving = false;
        charObj.bodyPivot.rotation.x = 0;
        charObj.bodyPivot.position.z = 0;
        charObj.leftArm.rotation.x = 0;
        charObj.rightArm.rotation.x = 0;
        charObj.leftArm.rotation.z = 0.4;
        charObj.rightArm.rotation.z = -0.4;
        charObj.leftArm.position.z = 0.05;
        charObj.rightArm.position.z = 0.05;
        charObj.bodyPivot.scale.set(1, 1, 1);
    }
}

let wallGameGroup = null;
let wallSubPhase = 'INTRO'; // 'INTRO' (2초 시작 안내) | 'RUN' (연속 벽 전진 플레이) | 'RESULT' (최종 순위)
let wallPhaseTimer = 0;
let wallWaveTimer = 0;
const WALL_WAVE_DURATION = 6.5; // 한 문제당 벽이 다가와 통과하는 총 시간(초)

let wallQuestionIndex = 0;
let wallQuestionOrder = [];
let wallPlayers = {};
let wallMonitorCanvas = null, wallMonitorCtx = null, wallMonitorTexture = null;
let leftWallMesh = null, rightWallMesh = null;
let leftWallCanvas = null, leftWallCtx = null, leftWallTex = null;
let rightWallCanvas = null, rightWallCtx = null, rightWallTex = null;

let wallFragments = [];
let wallShoveWaves = [];
let wallSceneryProps = []; // 뒤로 스쳐 지나가는 기둥/구름/속도선
let lastWallPosSync = 0;
let wallRoundAnswerSide = 'LEFT';
let wallPassCheckedThisWave = false;
let leftWallShattered = false;
let rightWallShattered = false;

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
    wallSceneryProps = [];

    // 1. 아래쪽 에메랄드 바다 & 반짝이는 물결 원판
    const seaMesh = new THREE.Mesh(
        new THREE.CircleGeometry(140, 48),
        new THREE.MeshStandardMaterial({ color: 0x1e90ff, roughness: 0.35, metalness: 0.1 })
    );
    seaMesh.rotation.x = -Math.PI / 2;
    seaMesh.position.set(0, -14, -10);
    wallGameGroup.add(seaMesh);

    const seaFoamRing = new THREE.Mesh(
        new THREE.RingGeometry(18, 22, 48),
        new THREE.MeshBasicMaterial({ color: 0x70a1ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    seaFoamRing.rotation.x = -Math.PI / 2;
    seaFoamRing.position.set(0, -13.9, 0);
    wallGameGroup.add(seaFoamRing);

    // 2. 좌우 원경 하늘 섬(Floating Islands) & 파스텔 나무 장식
    const islandConfigs = [
        { x: -17, y: -2.5, z: -12, r: 5.2, treeColor: 0x2ed573 },
        { x: 18,  y: -1.8, z: -15, r: 5.8, treeColor: 0xffa502 },
        { x: -15, y: -3.2, z: 4,   r: 4.2, treeColor: 0xff6b81 },
        { x: 16,  y: -2.8, z: 3,   r: 4.5, treeColor: 0x2ed573 },
        { x: -24, y: 1.5,  z: -32, r: 8.5, treeColor: 0x7bed9f },
        { x: 25,  y: 2.0,  z: -34, r: 9.0, treeColor: 0x70a1ff }
    ];
    islandConfigs.forEach(isl => {
        const islGroup = new THREE.Group();
        islGroup.position.set(isl.x, isl.y, isl.z);

        const rockCone = new THREE.Mesh(
            new THREE.ConeGeometry(isl.r, isl.r * 1.4, 7),
            new THREE.MeshStandardMaterial({ color: 0xcd6133, roughness: 0.85, flatShading: true })
        );
        rockCone.rotation.x = Math.PI;
        rockCone.position.y = -isl.r * 0.7;

        const grassTop = new THREE.Mesh(
            new THREE.CylinderGeometry(isl.r * 1.02, isl.r, 0.7, 12),
            new THREE.MeshStandardMaterial({ color: 0x7bed9f, roughness: 0.75 })
        );

        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.38, 1.8, 8),
            new THREE.MeshStandardMaterial({ color: 0x845422 })
        );
        trunk.position.set(0, 1.1, 0);

        const crown = new THREE.Mesh(
            new THREE.DodecahedronGeometry(1.4, 1),
            new THREE.MeshStandardMaterial({ color: isl.treeColor, roughness: 0.5 })
        );
        crown.position.set(0, 2.7, 0);

        islGroup.add(rockCone, grassTop, trunk, crown);
        wallGameGroup.add(islGroup);
    });

    // 3. 트랙 양옆을 스쳐 지나가는 아치형 기둥 & 깃발 장식 (연속 전진 속도감!)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.4 });
    const flagColors = [0xff4757, 0xffa502, 0x2ed573, 0x1e90ff];
    for (let i = 0; i < 6; i++) {
        const zPos = -14 + i * 4.5;
        [-6.4, 6.4].forEach((px, sideIdx) => {
            const propGroup = new THREE.Group();
            propGroup.position.set(px, 0, zPos);

            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3.6, 10), poleMat);
            pole.position.y = 1.8;

            const flag = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.65, 1.1),
                new THREE.MeshStandardMaterial({ color: flagColors[(i + sideIdx) % flagColors.length] })
            );
            flag.position.set(sideIdx === 0 ? 0.35 : -0.35, 3.1, 0);

            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.24, 12, 12),
                new THREE.MeshBasicMaterial({ color: 0xffd32a })
            );
            orb.position.y = 3.75;

            propGroup.add(pole, flag, orb);
            wallGameGroup.add(propGroup);
            wallSceneryProps.push({ mesh: propGroup, speed: 6.5, resetZ: -16, maxZ: 11 });
        });
    }

    // 4. 하늘을 떠다니는 입체 구름
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    [
        { x: -18, y: 12, z: -22, s: 1.4 },
        { x: 16,  y: 14, z: -26, s: 1.6 },
        { x: -8,  y: 16, z: -32, s: 1.3 },
        { x: 22,  y: 11, z: -14, s: 1.2 }
    ].forEach(c => {
        const cg = new THREE.Group();
        cg.position.set(c.x, c.y, c.z);
        cg.scale.setScalar(c.s);
        [
            { x: 0, y: 0, z: 0, r: 1.8 },
            { x: -1.4, y: -0.2, z: 0.1, r: 1.3 },
            { x: 1.5, y: -0.2, z: -0.1, r: 1.4 }
        ].forEach(p => {
            const m = new THREE.Mesh(new THREE.DodecahedronGeometry(p.r, 1), cloudMat);
            m.position.set(p.x, p.y, p.z);
            cg.add(m);
        });
        wallGameGroup.add(cg);
    });

    // 5. 공중 트랙(다리) 바닥: 가로 폭 12 (-6 ~ +6), 세로 길이 20 (-11 ~ +9)
    const trackGeo = new THREE.BoxGeometry(12, 0.9, 20);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.5 });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.position.set(0, -0.45, -1);
    trackMesh.receiveShadow = true;
    wallGameGroup.add(trackMesh);

    // 트랙 하단 받침 빔(다리 입체감)
    const underBeam = new THREE.Mesh(
        new THREE.BoxGeometry(8.5, 1.4, 20),
        new THREE.MeshStandardMaterial({ color: 0x57606f, roughness: 0.7 })
    );
    underBeam.position.set(0, -1.5, -1);
    wallGameGroup.add(underBeam);

    // 트랙 테두리 안전선(노랑/검정 경고 라인)
    const borderMat = new THREE.MeshStandardMaterial({ color: 0xffa502, roughness: 0.4 });
    [-5.85, 5.85].forEach(bx => {
        const sideBorder = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.94, 20), borderMat);
        sideBorder.position.set(bx, -0.44, -1);
        wallGameGroup.add(sideBorder);
    });
    const backBorder = new THREE.Mesh(new THREE.BoxGeometry(12, 0.94, 0.4), new THREE.MeshStandardMaterial({ color: 0xff4757 }));
    backBorder.position.set(0, -0.44, 8.8);
    wallGameGroup.add(backBorder);

    // 중앙 분리선 (왼쪽 구역 vs 오른쪽 구역 경계)
    const centerLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.04, 20),
        new THREE.MeshBasicMaterial({ color: 0x3742fa })
    );
    centerLine.position.set(0, 0.02, -1);
    wallGameGroup.add(centerLine);

    // 6. 상단 대형 3D 문법 문제 전광판 모니터
    const monitorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(13.8, 4.5, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.3 })
    );
    monitorFrame.position.set(0, 6.8, -11.2);
    wallGameGroup.add(monitorFrame);

    [-5.6, 5.6].forEach(px => {
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.26, 0.32, 6.8, 12),
            new THREE.MeshStandardMaterial({ color: 0x2f3542 })
        );
        leg.position.set(px, 3.4, -11.2);
        wallGameGroup.add(leg);
    });

    wallMonitorCanvas = document.createElement('canvas');
    wallMonitorCanvas.width = 1024;
    wallMonitorCanvas.height = 340;
    wallMonitorCtx = wallMonitorCanvas.getContext('2d');
    wallMonitorTexture = new THREE.CanvasTexture(wallMonitorCanvas);

    const monitorScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(13.1, 4.0),
        new THREE.MeshBasicMaterial({ map: wallMonitorTexture })
    );
    monitorScreen.position.set(0, 6.8, -10.9);
    wallGameGroup.add(monitorScreen);

    // 7. 왼쪽 / 오른쪽 선택 벽 생성
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

    const leftWallGeo = new THREE.BoxGeometry(5.75, 3.6, 0.8);
    const leftMats = [
        new THREE.MeshStandardMaterial({ color: 0x3742fa }),
        new THREE.MeshStandardMaterial({ color: 0x3742fa }),
        new THREE.MeshStandardMaterial({ color: 0x5352ed }),
        new THREE.MeshStandardMaterial({ color: 0x2f3542 }),
        new THREE.MeshBasicMaterial({ map: leftWallTex }),
        new THREE.MeshStandardMaterial({ color: 0x3742fa })
    ];
    leftWallMesh = new THREE.Mesh(leftWallGeo, leftMats);
    leftWallMesh.position.set(-2.95, 1.8, -10.5);
    leftWallMesh.castShadow = true;

    const rightWallGeo = new THREE.BoxGeometry(5.75, 3.6, 0.8);
    const rightMats = [
        new THREE.MeshStandardMaterial({ color: 0xff4757 }),
        new THREE.MeshStandardMaterial({ color: 0xff4757 }),
        new THREE.MeshStandardMaterial({ color: 0xff6b81 }),
        new THREE.MeshStandardMaterial({ color: 0x2f3542 }),
        new THREE.MeshBasicMaterial({ map: rightWallTex }),
        new THREE.MeshStandardMaterial({ color: 0xff4757 })
    ];
    rightWallMesh = new THREE.Mesh(rightWallGeo, rightMats);
    rightWallMesh.position.set(2.95, 1.8, -10.5);
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
    ctx.fillText(`WAVE ${roundNum} / ${totalRounds}`, W / 2, 52);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px "Fredoka", "Noto Sans KR", sans-serif';
    ctx.fillText(qObj.q, W / 2, 155);

    ctx.fillStyle = '#2ed573';
    ctx.font = 'bold 28px "Noto Sans KR", sans-serif';
    ctx.fillText(statusMsg || '◀ 정답 벽 줄에 서면 벽이 부서지고, 오답 벽은 뒤로 밀어냅니다! ▶', W / 2, 265);

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
    for (let i = 0; i < 26; i++) {
        const size = 0.35 + Math.random() * 0.45;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), fragMat);
        mesh.position.set(
            centerX + (Math.random() - 0.5) * 5.2,
            0.4 + Math.random() * 3.0,
            zPos + (Math.random() - 0.5) * 0.6
        );
        wallGameGroup.add(mesh);
        wallFragments.push({
            mesh,
            vx: (Math.random() - 0.5) * 9,
            vy: 3.5 + Math.random() * 6.5,
            vz: 2.5 + Math.random() * 5.0,
            rx: (Math.random() - 0.5) * 10,
            ry: (Math.random() - 0.5) * 10,
            life: 1.2
        });
    }
}

function startNextWallWave(idx) {
    wallQuestionIndex = idx;
    wallWaveTimer = 0;
    wallPassCheckedThisWave = false;
    leftWallShattered = false;
    rightWallShattered = false;

    const qData = GRAMMAR_QUESTIONS[wallQuestionOrder[idx % GRAMMAR_QUESTIONS.length]];
    wallRoundAnswerSide = qData.ans;

    leftWallMesh.visible = true;
    rightWallMesh.visible = true;
    leftWallMesh.position.set(-2.95, 1.8, -10.5);
    rightWallMesh.position.set(2.95, 1.8, -10.5);

    drawWallQuestionBoard(qData, idx + 1, wallQuestionOrder.length);
    drawChoiceWallTexture(leftWallCtx, leftWallTex, '◀ LEFT', qData.left, '#3742fa');
    drawChoiceWallTexture(rightWallCtx, rightWallTex, 'RIGHT ▶', qData.right, '#ff4757');

    document.getElementById('wall-question-text').textContent = `Q${idx + 1}. ${qData.q}`;
    document.getElementById('wall-left-label').textContent = `◀ ${qData.left}`;
    document.getElementById('wall-right-label').textContent = `${qData.right} ▶`;
    document.getElementById('wall-phase-banner').textContent = `🧱 WAVE ${idx + 1}: 정답 벽 앞으로 이동! (좌클릭 밀치기!)`;
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

    const indices = GRAMMAR_QUESTIONS.map((_, i) => i);
    let s = Number(seedNum || 12345);
    for (let i = indices.length - 1; i > 0; i--) {
        s = (s * 9301 + 49297) % 233280;
        const j = Math.floor((s / 233280) * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    wallQuestionOrder = indices.slice(0, 6); // 총 6개 연속 웨이브

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
            2.6,
            m.name || '플레이어',
            wallGameGroup
        );
        charObj.group.rotation.y = Math.PI;
        wallPlayers[m.id] = {
            member: m,
            char: charObj,
            x: spawnX,
            z: 2.6,
            vx: 0,
            vz: 0,
            targetX: spawnX,
            targetZ: 2.6,
            alive: true,
            survivedCount: 0,
            beingPushedByWall: false,
            isFalling: false,
            fallVy: 0,
            lastShoveId: 0
        };
    });

    lobbyGroup.visible = false;
    partyRoomGroup.visible = false;
    if (bombGameGroup) bombGameGroup.visible = false;
    wallGameGroup.visible = true;

    scene.background = new THREE.Color(0x70a1ff);
    scene.fog = new THREE.Fog(0x70a1ff, 35, 110);

    document.getElementById('party-room-hud').classList.add('hidden');
    document.getElementById('party-scoreboard-hud').classList.add('hidden');
    document.getElementById('wall-game-overlay').classList.remove('hidden');
    document.getElementById('wall-result-panel').classList.add('hidden');
    document.getElementById('wall-phase-banner').textContent = '🧱 연속해서 다가오는 문법 벽을 돌파하세요!';
    document.getElementById('wall-timer-text').textContent = 'READY';

    startNextWallWave(0);
    renderWallAliveBadges();
};

function renderWallAliveBadges() {
    const listEl = document.getElementById('wall-alive-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    Object.values(wallPlayers).forEach(p => {
        const badge = document.createElement('span');
        badge.className = `px-3 py-1 rounded-full text-xs font-black shadow ${p.alive ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-slate-300 line-through'}`;
        badge.textContent = `${p.member.emoji || ''} ${p.member.name} (${p.survivedCount}돌파)`;
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
            if (me && me.alive && !me.beingPushedByWall && st.shoveTargetId === myId && wallSubPhase === 'RUN') {
                me.vx += (st.shoveVx || 0);
                me.vz += (st.shoveVz || 0);
            }
        }
    });
};

window.handleWallLocalShove = function() {
    if (!window.isWallMinigameActive || wallSubPhase !== 'RUN') return;
    const myId = window.myPlayerId || 'local';
    const me = wallPlayers[myId];
    if (!me || !me.alive || me.beingPushedByWall) return;

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
    me.vx += fwdX * 4.5;
    me.vz += fwdZ * 4.5;
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

function finishWallMinigameResults() {
    if (wallSubPhase === 'RESULT') return;
    wallSubPhase = 'RESULT';
    document.getElementById('wall-phase-banner').textContent = '🏆 문법 벽 돌파 최종 결과!';
    document.getElementById('wall-timer-text').textContent = 'END';

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
// 매 프레임 업데이트: 끊김 없는 연속 벽 전진 & 오답 벽 밀림 물리
// ==========================================
window.updateAndRenderWallMinigame = function(dt, elapsed) {
    wallPhaseTimer += dt;
    const myId = window.myPlayerId || 'local';
    const me = wallPlayers[myId];

    // 배경 가로등/깃발 기둥들이 뒤(+Z)로 계속 흘러가며 전진 속도감 연출
    if (wallSubPhase === 'RUN') {
        wallSceneryProps.forEach(prop => {
            prop.mesh.position.z += prop.speed * dt;
            if (prop.mesh.position.z > prop.maxZ) {
                prop.mesh.position.z = prop.resetZ;
            }
        });
    }

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

    // 1. 내 캐릭터 이동 (오답 벽에 밀리는 중이 아닐 때 자유 이동)
    if (me && me.alive && !me.beingPushedByWall && wallSubPhase === 'RUN') {
        let moveX = 0, moveZ = 0;
        if (keys.left) moveX -= 1;
        if (keys.right) moveX += 1;
        if (keys.up) moveZ -= 1;
        if (keys.down) moveZ += 1;

        if (moveX !== 0 || moveZ !== 0) {
            const len = Math.hypot(moveX, moveZ);
            me.vx = (moveX / len) * 6.8;
            me.vz = (moveZ / len) * 6.8;
            me.char.group.rotation.y = Math.atan2(me.vx, me.vz);
        } else {
            me.vx *= 0.8;
            me.vz *= 0.8;
        }

        me.x = Math.max(-5.3, Math.min(5.3, me.x + me.vx * dt));
        me.z = Math.max(-0.5, Math.min(8.2, me.z + me.vz * dt));
        me.char.group.position.set(me.x, 0, me.z);

        if (me.char.isShoving) {
            animateWallCharShove(me.char, dt);
        } else if (Math.hypot(me.vx, me.vz) > 0.3) {
            const bounce = Math.abs(Math.sin(elapsed * 14));
            me.char.bodyPivot.position.y = bounce * 0.14;
            me.char.leftLeg.position.z = Math.sin(elapsed * 14) * 0.2;
            me.char.rightLeg.position.z = -Math.sin(elapsed * 14) * 0.2;
        } else {
            me.char.bodyPivot.position.y = Math.sin(elapsed * 3) * 0.03;
        }

        if (Date.now() - lastWallPosSync > 70 && window.syncWallPlayerState && window.currentRoomInfo) {
            lastWallPosSync = Date.now();
            window.syncWallPlayerState(window.currentRoomInfo.code, { x: me.x, z: me.z });
        }
    }

    // 2. 원격 플레이어 보간
    Object.entries(wallPlayers).forEach(([pid, p]) => {
        if (pid !== myId && p.alive && !p.beingPushedByWall) {
            const prevX = p.x, prevZ = p.z;
            p.x += (p.targetX - p.x) * 10 * dt;
            p.z += (p.targetZ - p.z) * 10 * dt;
            p.char.group.position.set(p.x, 0, p.z);
            const moved = Math.hypot(p.x - prevX, p.z - prevZ);
            if (p.char.isShoving) {
                animateWallCharShove(p.char, dt);
            } else if (moved > 0.01) {
                p.char.group.rotation.y = Math.atan2(p.x - prevX, p.z - prevZ);
                p.char.bodyPivot.position.y = Math.abs(Math.sin(elapsed * 14)) * 0.14;
            }
        }
    });

    // 3. 상태별 진행
    if (wallSubPhase === 'INTRO') {
        if (wallPhaseTimer >= 1.8) {
            wallSubPhase = 'RUN';
            wallWaveTimer = 0;
        }
    } else if (wallSubPhase === 'RUN') {
        wallWaveTimer += dt;
        const remain = Math.max(0, WALL_WAVE_DURATION - wallWaveTimer);
        document.getElementById('wall-timer-text').textContent = `${remain.toFixed(1)}s`;

        // 벽이 z = -10.5 에서 z = +10.2 까지 멈춤 없이 일정한 속도로 쭉 전진!
        const wallStartZ = -10.5;
        const wallEndZ = 10.2;
        const wallSpeed = (wallEndZ - wallStartZ) / WALL_WAVE_DURATION;
        const currentWallZ = wallStartZ + wallWaveTimer * wallSpeed;

        leftWallMesh.position.z = currentWallZ;
        rightWallMesh.position.z = currentWallZ;

        const isLeftCorrect = wallRoundAnswerSide === 'LEFT';
        const wallFrontZ = currentWallZ + 0.65;

        // 각 살아있는 플레이어와 다가오는 벽의 실시간 접촉 판정!
        Object.values(wallPlayers).forEach(p => {
            if (!p.alive) return;
            const onLeftSide = p.x < 0;

            // 벽 앞면이 플레이어 위치(p.z)에 도달했을 때!
            if (wallFrontZ >= p.z && currentWallZ - 0.5 <= p.z + 0.6) {
                if ((onLeftSide && isLeftCorrect) || (!onLeftSide && !isLeftCorrect)) {
                    // 정답 벽: 벽이 파편으로 산산조각 부서지며 플레이어는 그대로 통과!
                    if (onLeftSide && !leftWallShattered) {
                        leftWallShattered = true;
                        leftWallMesh.visible = false;
                        spawnWallDestructionFragments(-2.95, currentWallZ, 0x3742fa);
                    } else if (!onLeftSide && !rightWallShattered) {
                        rightWallShattered = true;
                        rightWallMesh.visible = false;
                        spawnWallDestructionFragments(2.95, currentWallZ, 0xff4757);
                    }
                } else {
                    // 오답 벽: 튕겨 날아가는 게 아니라 벽 앞면에 밀착되어 뒤(+Z)로 쭉 밀려남!
                    p.beingPushedByWall = true;
                    p.z = wallFrontZ;
                    p.char.group.position.z = p.z;
                    p.char.bodyPivot.rotation.x = -0.25; // 벽에 밀려 버둥거리는 자세
                    p.char.leftLeg.position.z = Math.sin(elapsed * 26) * 0.25;
                    p.char.rightLeg.position.z = -Math.sin(elapsed * 26) * 0.25;
                }
            }

            // 트랙 뒤쪽 끝(z > 9.0)까지 밀려나면 낭떠러지로 추락 탈락!
            if (p.z > 9.0 && !p.isFalling) {
                p.isFalling = true;
            }
            if (p.isFalling) {
                p.z += wallSpeed * 0.6 * dt;
                p.fallVy -= 26 * dt;
                p.char.group.position.y += p.fallVy * dt;
                p.char.group.position.z = p.z;
                if (p.char.group.position.y < -12) {
                    p.alive = false;
                    p.beingPushedByWall = false;
                    p.char.group.visible = false;
                    renderWallAliveBadges();
                }
            }
        });

        // 벽이 플레이어 라인(z = 4.5)을 지나갈 때 정답 공개 & 생존자 돌파 횟수 +1
        if (!wallPassCheckedThisWave && currentWallZ > 4.5) {
            wallPassCheckedThisWave = true;
            const qData = GRAMMAR_QUESTIONS[wallQuestionOrder[wallQuestionIndex]];
            if (isLeftCorrect && !leftWallShattered) {
                leftWallShattered = true;
                leftWallMesh.visible = false;
                spawnWallDestructionFragments(-2.95, currentWallZ, 0x3742fa);
            } else if (!isLeftCorrect && !rightWallShattered) {
                rightWallShattered = true;
                rightWallMesh.visible = false;
                spawnWallDestructionFragments(2.95, currentWallZ, 0xff4757);
            }

            Object.values(wallPlayers).forEach(p => {
                if (p.alive && !p.beingPushedByWall && !p.isFalling) {
                    p.survivedCount += 1;
                    p.char.jump();
                }
            });
            drawWallQuestionBoard(
                qData,
                wallQuestionIndex + 1,
                wallQuestionOrder.length,
                `정답: ${isLeftCorrect ? qData.left : qData.right} (${qData.exp})`
            );
            renderWallAliveBadges();
        }

        // 벽이 트랙 뒤로 완전히 빠져나가자마자 끊김 없이 즉시 다음 문제 벽 등장!
        if (wallWaveTimer >= WALL_WAVE_DURATION) {
            const alivePlayers = Object.values(wallPlayers).filter(p => p.alive);
            const totalPlayers = Object.keys(wallPlayers).length;
            const nextIdx = wallQuestionIndex + 1;

            if ((totalPlayers > 1 && alivePlayers.length <= 1) || alivePlayers.length === 0 || nextIdx >= wallQuestionOrder.length) {
                finishWallMinigameResults();
            } else {
                startNextWallWave(nextIdx);
            }
        }
    }

    // 4. 단일 통합 3D 카메라 뷰
    camera.position.lerp(new THREE.Vector3(0, 9.6, 16.8), 5 * dt);
    camera.lookAt(0, 2.0, -2.5);
    renderer.render(scene, camera);
};
