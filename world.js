// ==========================================
// 3D 로비 들판, 산, 포탈, 파티 룸(소파 + 모니터 룰렛), 폭탄 해체 무대
// ==========================================
function initScene() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 45, 135);

    lobbyGroup = new THREE.Group();
    partyRoomGroup = new THREE.Group();
    partyRoomGroup.visible = false;
    bombGameGroup = new THREE.Group();
    bombGameGroup.visible = false;
    scene.add(lobbyGroup, partyRoomGroup, bombGameGroup);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 220);
    camera.position.set(0, 6, 15);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x99f2c8, 0.72);
    hemiLight.position.set(0, 35, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e4, 0.85);
    dirLight.position.set(18, 28, 16);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 75;
    const d = 28;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(65, 64),
        new THREE.MeshStandardMaterial({ color: 0xbef5db, roughness: 0.88 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    lobbyGroup.add(ground);

    const grassPatches = [
        { x: -12, z: -8, r: 9, color: 0xa3ecc9 },
        { x: 14, z: -6, r: 10, color: 0xa3ecc9 },
        { x: -15, z: 12, r: 8, color: 0x9be6c1 },
        { x: 13, z: 13, r: 9.5, color: 0x9be6c1 },
        { x: 0, z: -18, r: 14, color: 0xaaeecf },
        { x: 8, z: 2, r: 6, color: 0x9be6c1 }
    ];
    grassPatches.forEach((p, idx) => {
        const patch = new THREE.Mesh(
            new THREE.CircleGeometry(p.r, 32),
            new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.9 })
        );
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(p.x, 0.008 + idx * 0.003, p.z);
        patch.receiveShadow = true;
        lobbyGroup.add(patch);
    });

    createBackgroundMountains();
    createClouds();

    const pathMat = new THREE.MeshStandardMaterial({ color: 0xf6f7f9, roughness: 0.9 });
    const spawnPlaza = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), pathMat);
    spawnPlaza.rotation.x = -Math.PI / 2;
    spawnPlaza.position.set(0, 0.035, 6);
    spawnPlaza.receiveShadow = true;
    lobbyGroup.add(spawnPlaza);

    for (let z = 3; z >= -7; z -= 1.2) {
        const step = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), pathMat);
        step.rotation.x = -Math.PI / 2;
        step.position.set(Math.sin(z * 0.4) * 0.35, 0.036 + Math.abs(z) * 0.0005, z);
        step.receiveShadow = true;
        lobbyGroup.add(step);
    }

    createShowcasePedestal();
    playerChameleon = new JellyCharacter(selectedCharType, selectedColorHex, 0, 6, '카멜레온', lobbyGroup);

    createPortal();
    createMonitor();
    createTrees();
    createRocksAndLamps();
    createFlowers();
    createPartyRoom();
}

function createShowcasePedestal() {
    showcasePedestal = new THREE.Group();
    showcasePedestal.position.set(0, 0.04, 6);
    const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(1.55, 1.75, 0.14, 32),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })
    );
    disc.position.y = 0.07;
    disc.receiveShadow = true;
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.62, 0.06, 12, 36),
        new THREE.MeshStandardMaterial({ color: 0x4b7bec, roughness: 0.3, emissive: 0x2244aa, emissiveIntensity: 0.25 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    showcasePedestal.add(disc, ring);
    lobbyGroup.add(showcasePedestal);
}

function createBackgroundMountains() {
    const mountains = [
        { x: -28, z: -48, r: 19, h: 24, color: 0x8ea8db, snowColor: 0xf4f7fc },
        { x: 2,   z: -54, r: 23, h: 31, color: 0x7c98d4, snowColor: 0xffffff },
        { x: 31,  z: -46, r: 18, h: 22, color: 0x95afe0, snowColor: 0xf4f7fc }
    ];
    mountains.forEach(m => {
        const mGroup = new THREE.Group();
        mGroup.position.set(m.x, 0, m.z);
        const body = new THREE.Mesh(
            new THREE.ConeGeometry(m.r, m.h, 7),
            new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.85, flatShading: true })
        );
        body.position.y = m.h / 2 - 0.5;
        const capH = m.h * 0.36;
        const cap = new THREE.Mesh(
            new THREE.ConeGeometry(m.r * 0.36, capH, 7),
            new THREE.MeshStandardMaterial({ color: m.snowColor, roughness: 0.5, flatShading: true })
        );
        cap.position.y = m.h - capH / 2 - 0.45;
        mGroup.add(body, cap);
        lobbyGroup.add(mGroup);
    });
}

function createClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    [
        { x: -26, y: 20, z: -32, s: 1.3 },
        { x: 16,  y: 23, z: -36, s: 1.5 },
        { x: 34,  y: 18, z: -26, s: 1.1 },
        { x: -12, y: 24, z: -40, s: 1.2 }
    ].forEach(cp => {
        const cGroup = new THREE.Group();
        cGroup.position.set(cp.x, cp.y, cp.z);
        cGroup.scale.setScalar(cp.s);
        [
            { x: 0, y: 0, z: 0, r: 2.1 },
            { x: -1.8, y: -0.3, z: 0.2, r: 1.5 },
            { x: 1.9, y: -0.2, z: -0.1, r: 1.6 },
            { x: 0.6, y: 0.8, z: 0.3, r: 1.4 }
        ].forEach(p => {
            const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(p.r, 1), cloudMat);
            mesh.position.set(p.x, p.y, p.z);
            cGroup.add(mesh);
        });
        lobbyGroup.add(cGroup);
        clouds.push({ group: cGroup, speed: 0.25 + Math.random() * 0.2 });
    });
}

function createPortal() {
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, 0, -9);

    const baseStep1 = new THREE.Mesh(
        new THREE.CylinderGeometry(3.4, 3.8, 0.35, 32),
        new THREE.MeshStandardMaterial({ color: 0x747d8c, roughness: 0.7 })
    );
    baseStep1.position.y = 0.175;
    baseStep1.receiveShadow = true;

    const baseStep2 = new THREE.Mesh(
        new THREE.CylinderGeometry(2.7, 3.0, 0.25, 32),
        new THREE.MeshStandardMaterial({ color: 0xa4b0be, roughness: 0.6 })
    );
    baseStep2.position.y = 0.45;
    baseStep2.receiveShadow = true;
    portalGroup.add(baseStep1, baseStep2);

    [-2.9, 2.9].forEach(px => {
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.36, 2.2, 16),
            new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.5 })
        );
        pillar.position.set(px, 1.1, 0);
        pillar.castShadow = true;
        const orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0x00d2d3, emissive: 0x00a8ff, emissiveIntensity: 0.6 })
        );
        orb.position.set(px, 2.35, 0);
        portalGroup.add(pillar, orb);
        colliders.push({ x: px, z: -9, r: 0.45 });
    });

    portalRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.15, 0.26, 20, 48),
        new THREE.MeshStandardMaterial({ color: 0xffeaa7, emissive: 0xffa502, emissiveIntensity: 0.35, roughness: 0.2 })
    );
    portalRing.position.y = 2.65;
    portalRing.castShadow = true;
    portalGroup.add(portalRing);

    portalInnerRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.85, 0.08, 12, 36),
        new THREE.MeshStandardMaterial({ color: 0x70a1ff, emissive: 0x1e90ff, emissiveIntensity: 0.5 })
    );
    portalInnerRing.position.y = 2.65;
    portalGroup.add(portalInnerRing);

    const pCanvas = document.createElement('canvas');
    pCanvas.width = 256;
    pCanvas.height = 256;
    const pCtx = pCanvas.getContext('2d');
    const grad = pCtx.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(220, 245, 255, 0.95)');
    grad.addColorStop(0.55, 'rgba(84, 160, 255, 0.85)');
    grad.addColorStop(1, 'rgba(55, 66, 250, 0.9)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 256, 256);

    portalInner = new THREE.Mesh(
        new THREE.CircleGeometry(1.9, 32),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pCanvas), transparent: true, opacity: 0.88, side: THREE.DoubleSide })
    );
    portalInner.position.set(0, 2.65, 0.02);
    portalGroup.add(portalInner);

    for (let i = 0; i < 16; i++) {
        const p = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const angle = (i / 16) * Math.PI * 2;
        const radius = 2.35 + Math.random() * 0.45;
        p.position.set(Math.cos(angle) * radius, 2.65 + Math.sin(angle) * radius, (Math.random() - 0.5) * 0.7);
        p.userData = { angle, radius, speed: 0.7 + Math.random() * 0.8 };
        portalGroup.add(p);
        portalParticles.push(p);
    }

    lobbyGroup.add(portalGroup);
}

function createMonitor() {
    const monitorGroup = new THREE.Group();
    monitorGroup.position.set(-7.5, 0, -2.5);
    monitorGroup.rotation.y = 0.52;

    const legMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.6 });
    [-2.2, 2.2].forEach(lx => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 2.5, 16), legMat);
        leg.position.set(lx, 1.25, 0);
        leg.castShadow = true;
        monitorGroup.add(leg);

        const worldPos = new THREE.Vector3(lx, 0, 0);
        worldPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.52);
        worldPos.add(monitorGroup.position);
        colliders.push({ x: worldPos.x, z: worldPos.z, r: 0.45 });
    });

    const frame = new THREE.Mesh(
        new THREE.BoxGeometry(6.4, 3.8, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x3742fa, roughness: 0.35 })
    );
    frame.position.y = 3.9;
    frame.castShadow = true;
    monitorGroup.add(frame);

    monitorCanvas = document.createElement('canvas');
    monitorCanvas.width = 512;
    monitorCanvas.height = 300;
    monitorCtx = monitorCanvas.getContext('2d');
    monitorTexture = new THREE.CanvasTexture(monitorCanvas);
    updateMonitorCanvas();

    const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(5.85, 3.25),
        new THREE.MeshBasicMaterial({ map: monitorTexture })
    );
    screen.position.set(0, 3.9, 0.24);
    monitorGroup.add(screen);
    lobbyGroup.add(monitorGroup);
}

function updateMonitorCanvas() {
    if (!monitorCtx) return;
    const ctx = monitorCtx;
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(0, 0, 512, 300);
    ctx.strokeStyle = '#3742fa';
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, 488, 276);

    ctx.fillStyle = '#70a1ff';
    ctx.font = 'bold 20px "Fredoka", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ENGLISH PARTY LOBBY', 256, 48);

    if (currentRoomInfo) {
        ctx.fillStyle = '#ffa502';
        ctx.font = '900 32px "Fredoka", "Noto Sans KR", sans-serif';
        ctx.fillText(`ROOM: ${currentRoomInfo.code} (${currentRoomInfo.totalRounds}판)`, 256, 98);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px "Noto Sans KR", sans-serif';
        const names = currentRoomInfo.members.map(m => `${m.emoji} ${m.name}`).join('  |  ');
        ctx.fillText(names, 256, 152);
        ctx.fillStyle = '#2ed573';
        ctx.font = 'bold 18px "Noto Sans KR", sans-serif';
        ctx.fillText(`현재 인원: ${currentRoomInfo.members.length}명 대기 중`, 256, 205);
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px "Noto Sans KR", sans-serif';
        ctx.fillText('포탈에 들어가 팀을 생성하세요!', 256, 138);
        ctx.fillStyle = '#2ed573';
        ctx.font = 'bold 19px "Noto Sans KR", sans-serif';
        ctx.fillText('Firebase 실시간 서버 연결 준비 완료', 256, 185);
    }
    ctx.fillStyle = '#a4b0be';
    ctx.font = '15px "Noto Sans KR", sans-serif';
    ctx.fillText('이동: WASD / 방향키   •   밀치기: 좌클릭', 256, 258);
    if (monitorTexture) monitorTexture.needsUpdate = true;
}

function createTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x778beb, roughness: 0.8 });
    [
        { x: -13, z: -9,  color: 0x2ed573, subColor: 0x7bed9f, scale: 1.15 },
        { x: -4.5, z: -13, color: 0x1e90ff, subColor: 0x70a1ff, scale: 0.95 },
        { x: 5.5, z: -13, color: 0xffa502, subColor: 0xffdd59, scale: 0.9 },
        { x: 10,  z: -8.5, color: 0x2ed573, subColor: 0x7bed9f, scale: 1.1 },
        { x: 17,  z: -6,  color: 0x1e90ff, subColor: 0x70a1ff, scale: 1.2 },
        { x: -16, z: 3,   color: 0xff6b81, subColor: 0xffa5b2, scale: 1.0 },
        { x: 16,  z: 5,   color: 0x2ed573, subColor: 0x7bed9f, scale: 1.05 }
    ].forEach(data => {
        const treeGroup = new THREE.Group();
        treeGroup.position.set(data.x, 0, data.z);
        treeGroup.scale.setScalar(data.scale);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 1.8, 12), trunkMat);
        trunk.position.y = 0.9;
        trunk.castShadow = true;
        const crown = new THREE.Mesh(
            new THREE.DodecahedronGeometry(1.3, 1),
            new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.55 })
        );
        crown.position.y = 2.6;
        crown.castShadow = true;
        treeGroup.add(trunk, crown);
        lobbyGroup.add(treeGroup);
        colliders.push({ x: data.x, z: data.z, r: 0.55 * data.scale });
    });
}

function createRocksAndLamps() {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xc8d6e5, roughness: 0.85, flatShading: true });
    [
        { x: 6.8, z: -6.5, s: 0.85 },
        { x: -11, z: -3.5, s: 0.75 },
        { x: 11.5, z: 1.5, s: 0.9 }
    ].forEach(r => {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), rockMat);
        rock.scale.set(r.s * 1.2, r.s * 0.75, r.s);
        rock.position.set(r.x, 0.4 * r.s, r.z);
        rock.castShadow = true;
        lobbyGroup.add(rock);
        colliders.push({ x: r.x, z: r.z, r: 0.85 * r.s, height: 0.95 * r.s });
    });
}

function createFlowers() {
    const flowerColors = [0xff6b81, 0xffdd59, 0x70a1ff, 0xffffff, 0xe056fd];
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2ed573 });
    for (let i = 0; i < 36; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5.5 + Math.random() * 16;
        const fx = Math.cos(angle) * dist;
        const fz = Math.sin(angle) * dist;
        if (Math.abs(fx) < 2.2 && fz > -9 && fz < 9) continue;
        const fGroup = new THREE.Group();
        fGroup.position.set(fx, 0, fz);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), stemMat);
        stem.position.y = 0.175;
        const petal = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.16, 0),
            new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.4 })
        );
        petal.position.y = 0.38;
        fGroup.add(stem, petal);
        lobbyGroup.add(fGroup);
        flowers.push({ group: fGroup, phase: Math.random() * Math.PI * 2 });
    }
}

function createPartyRoom() {
    const roomFloor = new THREE.Mesh(
        new THREE.BoxGeometry(18, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: 0xecc498, roughness: 0.65 })
    );
    roomFloor.position.set(0, -0.15, 0);
    roomFloor.receiveShadow = true;
    partyRoomGroup.add(roomFloor);

    const rug = new THREE.Mesh(
        new THREE.CylinderGeometry(4.2, 4.2, 0.04, 36),
        new THREE.MeshStandardMaterial({ color: 0x70a1ff, roughness: 0.85 })
    );
    rug.position.set(0, 0.02, -0.5);
    partyRoomGroup.add(rug);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfff5e4, roughness: 0.8 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 0.4), wallMat);
    backWall.position.set(0, 5, -6.5);
    partyRoomGroup.add(backWall);

    const sofaGroup = new THREE.Group();
    sofaGroup.position.set(0, 0, -2.5);
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0xff6b81, roughness: 0.65 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xff8fa3, roughness: 0.55 });

    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.85, 2.2), sofaMat);
    seatBase.position.set(0, 0.425, 0);
    seatBase.castShadow = true;

    const backRest = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.1, 0.65), sofaMat);
    backRest.position.set(0, 1.35, -0.82);
    backRest.castShadow = true;

    [-3.45, 3.45].forEach(ax => {
        const armRest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.35, 2.2), sofaMat);
        armRest.position.set(ax, 0.68, 0);
        sofaGroup.add(armRest);
    });
    [-2.0, 0, 2.0].forEach(cx => {
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 1.65), cushionMat);
        cushion.position.set(cx, 0.92, 0.15);
        sofaGroup.add(cushion);
    });
    sofaGroup.add(seatBase, backRest);
    partyRoomGroup.add(sofaGroup);

    const tvGroup = new THREE.Group();
    tvGroup.position.set(0, 6.4, -6.22);
    const tvFrame = new THREE.Mesh(
        new THREE.BoxGeometry(7.8, 4.4, 0.28),
        new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.3 })
    );
    tvGroup.add(tvFrame);

    tvCanvas = document.createElement('canvas');
    tvCanvas.width = 1024;
    tvCanvas.height = 576;
    tvCtx = tvCanvas.getContext('2d');
    tvTexture = new THREE.CanvasTexture(tvCanvas);
    drawRouletteMonitor();

    const tvScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(7.35, 4.0),
        new THREE.MeshBasicMaterial({ map: tvTexture })
    );
    tvScreen.position.z = 0.16;
    tvGroup.add(tvScreen);
    partyRoomGroup.add(tvGroup);
}

function drawRouletteMonitor() {
    if (!tvCtx) return;
    const ctx = tvCtx;
    const W = 1024, H = 576;
    ctx.fillStyle = '#141a2e';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#3742fa';
    ctx.fillRect(0, 0, W, 86);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px "Fredoka", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const roomHeader = currentRoomInfo
        ? `ROOM ${currentRoomInfo.code}  •  ROUND ${currentRoomInfo.currentRound} / ${currentRoomInfo.totalRounds}`
        : '🎰 ENGLISH MINI-GAME ROULETTE 🎰';
    ctx.fillText(roomHeader, W / 2, 44);

    ctx.save();
    ctx.beginPath();
    ctx.rect(60, 110, W - 120, 380);
    ctx.clip();

    const itemH = 140;
    const total = ROULETTE_GAMES.length;
    const centerY = 300;
    const baseIdx = Math.floor(rouletteOffset);
    const frac = rouletteOffset - baseIdx;

    for (let k = -2; k <= 2; k++) {
        // 부호(+)를 통일하여 모니터 중앙에 멈추는 카드와 당첨 게임 인덱스가 100% 일치하도록 수정
        const itemIdx = (((baseIdx + k) % total) + total) % total;
        const game = ROULETTE_GAMES[itemIdx];
        const y = centerY + (k - frac) * itemH;
        const isWinnerSlot = Math.abs(k - frac) < 0.35;

        ctx.fillStyle = isWinnerSlot ? game.color : '#222b45';
        ctx.fillRect(90, y - 58, W - 180, 116);
        ctx.lineWidth = isWinnerSlot ? 6 : 2;
        ctx.strokeStyle = isWinnerSlot ? '#ffd32a' : 'rgba(255,255,255,0.2)';
        ctx.strokeRect(90, y - 58, W - 180, 116);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 36px "Fredoka", "Noto Sans KR", sans-serif';
        ctx.fillText(`${game.icon}  ${game.title}`, W / 2, y - 12);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '700 22px "Noto Sans KR", sans-serif';
        ctx.fillText(game.subtitle, W / 2, y + 28);
    }
    ctx.restore();

    ctx.fillStyle = '#ffd32a';
    ctx.beginPath(); ctx.moveTo(45, centerY - 22); ctx.lineTo(82, centerY); ctx.lineTo(45, centerY + 22); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W - 45, centerY - 22); ctx.lineTo(W - 82, centerY); ctx.lineTo(W - 45, centerY + 22); ctx.closePath(); ctx.fill();

    ctx.font = '900 26px "Noto Sans KR", sans-serif';
    if (rouletteState === 'DONE' && selectedRouletteGame) {
        ctx.fillStyle = '#2ed573';
        ctx.fillText(`🎉 당첨 미션: ${selectedRouletteGame.icon} ${selectedRouletteGame.subtitle}`, W / 2, H - 38);
    } else if (rouletteState === 'SPINNING') {
        ctx.fillStyle = '#ffd32a';
        ctx.fillText('🎲 두구두구두구... 미니게임 추첨 중!', W / 2, H - 38);
    } else {
        ctx.fillStyle = '#dfe4ea';
        ctx.fillText('👑 방장이 [룰렛 돌리기] 버튼을 누르면 시작됩니다!', W / 2, H - 38);
    }
    tvTexture.needsUpdate = true;
}
