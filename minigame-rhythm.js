// ==========================================
// 미니게임 3: 스타디움 리듬 스테이지 (RHYTHM STAGE) 독립 모듈
// - 360도 3층 스타디움 관중석 + 야광봉 환호 + 마이크 댄스 + 시네마틱 오프닝 + READY / START!
// - 긴 단어에서도 예고 연주와 내 타이핑이 겹치지 않는 동적 리듬 패턴(Call & Response)
// ==========================================
window.isRhythmMinigameActive = false;

let rhythmGameGroup = null;
let rhythmSubPhase = 'INTRO'; // 'INTRO' (3.4초 콘서트 오프닝) | 'PLAY' (리듬 타이핑) | 'RESULT' (최종 순위)
let rhythmPhaseTimer = 0;
let rhythmPlayTime = 0;
let rhythmPlayers = {};
let rhythmCrowd = [];
let rhythmSpotlights = [];
let rhythmMonitorCanvas = null, rhythmMonitorCtx = null, rhythmMonitorTexture = null;

let rhythmWaveQueue = [];
let currentWaveIdx = 0;
let currentRhythmWave = null;
let myRhythmScore = 0;
let myRhythmCombo = 0;

const RHYTHM_WORD_PATTERNS = [
    { word: 'CAT', ko: '고양이', style: '따! - 따! - 따!', beats: [0.0, 0.65, 1.30], pitches: [523.25, 659.25, 783.99] },
    { word: 'SUN', ko: '태양',   style: '따-단! ... 따!', beats: [0.0, 0.34, 1.15], pitches: [587.33, 783.99, 880.00] },
    { word: 'FLY', ko: '날다',   style: '따! ... 다-단!', beats: [0.0, 0.85, 1.22], pitches: [523.25, 698.46, 1046.50] },
    { word: 'STAR', ko: '별',     style: '따-따-따-따!', beats: [0.0, 0.50, 1.00, 1.50], pitches: [523.25, 587.33, 659.25, 783.99] },
    { word: 'JUMP', ko: '점프',   style: '따-단! ... 다-단!', beats: [0.0, 0.32, 0.98, 1.30], pitches: [523.25, 783.99, 659.25, 1046.50] },
    { word: 'BEAT', ko: '박자',   style: '다-다-단! ... 따!', beats: [0.0, 0.30, 0.60, 1.35], pitches: [523.25, 587.33, 659.25, 880.00] },
    { word: 'SONG', ko: '노래',   style: '따! ... 다-단! ... 따!', beats: [0.0, 0.68, 1.00, 1.68], pitches: [659.25, 587.33, 783.99, 1046.50] },
    { word: 'DANCE', ko: '춤추다', style: '따-따! ... 다-다-단!', beats: [0.0, 0.45, 1.05, 1.35, 1.65], pitches: [523.25, 659.25, 587.33, 698.46, 880.00] },
    { word: 'MUSIC', ko: '음악',   style: '다-다-다-다-단!', beats: [0.0, 0.34, 0.68, 1.02, 1.36], pitches: [523.25, 587.33, 659.25, 783.99, 1046.50] },
    { word: 'SMILE', ko: '미소',   style: '따! ... 다-다-단! ... 따!', beats: [0.0, 0.62, 0.94, 1.26, 1.92], pitches: [587.33, 659.25, 783.99, 880.00, 1046.50] },
    { word: 'PARTY', ko: '파티',   style: '따! ... 따! ... 다-다-다!', beats: [0.0, 0.62, 1.24, 1.54, 1.84], pitches: [523.25, 659.25, 783.99, 880.00, 1046.50] },
    { word: 'RHYTHM', ko: '리듬',   style: '다-다-단! ... 다-다-단!', beats: [0.0, 0.30, 0.60, 1.25, 1.55, 1.85], pitches: [523.25, 659.25, 783.99, 587.33, 783.99, 1046.50] },
    { word: 'MELODY', ko: '멜로디', style: '따-따-따! ... 다-다-단!', beats: [0.0, 0.48, 0.96, 1.52, 1.82, 2.12], pitches: [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50] },
    { word: 'STAGE!', ko: '무대',   style: '다-다-다-단! ... 따-단!', beats: [0.0, 0.28, 0.56, 0.84, 1.48, 1.82], pitches: [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50] }
];

function attachMicrophoneToCharacter(charObj) {
    if (!charObj || !charObj.rightArm) return;
    const micGroup = new THREE.Group();
    const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.045, 0.34, 12),
        new THREE.MeshStandardMaterial({ color: 0x2f3542, metalness: 0.7, roughness: 0.25 })
    );
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 14, 14),
        new THREE.MeshStandardMaterial({ color: 0xffd32a, metalness: 0.8, roughness: 0.2, emissive: 0xaa7700, emissiveIntensity: 0.25 })
    );
    head.position.y = 0.21;
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.105, 0.018, 8, 18),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.21;

    micGroup.add(handle, head, ring);
    micGroup.position.set(0.06, -0.18, 0.18);
    micGroup.rotation.x = Math.PI / 3.2;
    charObj.rightArm.add(micGroup);
}

function createJudgeSprite(judgeText, colorHexCss) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    ctx.font = '900 74px "Fredoka", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#141a2e';
    ctx.strokeText(judgeText, 256, 80);

    ctx.fillStyle = colorHexCss;
    ctx.fillText(judgeText, 256, 80);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.8, 0.88, 1);
    return sprite;
}

function buildRhythmStadiumStage() {
    if (!rhythmGameGroup) {
        rhythmGameGroup = new THREE.Group();
        scene.add(rhythmGameGroup);
    }
    while (rhythmGameGroup.children.length > 0) {
        rhythmGameGroup.remove(rhythmGameGroup.children[0]);
    }
    rhythmCrowd = [];
    rhythmSpotlights = [];

    const arenaFloor = new THREE.Mesh(
        new THREE.CircleGeometry(55, 48),
        new THREE.MeshStandardMaterial({ color: 0x161c28, roughness: 0.8 })
    );
    arenaFloor.rotation.x = -Math.PI / 2;
    arenaFloor.position.y = -0.35;
    rhythmGameGroup.add(arenaFloor);

    const stageDeck = new THREE.Mesh(
        new THREE.CylinderGeometry(7.2, 7.6, 0.7, 36),
        new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.35, metalness: 0.3 })
    );
    stageDeck.position.set(0, 0.0, -0.5);
    stageDeck.receiveShadow = true;
    rhythmGameGroup.add(stageDeck);

    const neonRing1 = new THREE.Mesh(
        new THREE.TorusGeometry(7.25, 0.12, 12, 48),
        new THREE.MeshBasicMaterial({ color: 0xff4757 })
    );
    neonRing1.rotation.x = Math.PI / 2;
    neonRing1.position.set(0, 0.36, -0.5);

    const neonRing2 = new THREE.Mesh(
        new THREE.TorusGeometry(5.6, 0.08, 10, 48),
        new THREE.MeshBasicMaterial({ color: 0x00d2d3 })
    );
    neonRing2.rotation.x = Math.PI / 2;
    neonRing2.position.set(0, 0.36, -0.5);
    rhythmGameGroup.add(neonRing1, neonRing2);

    [-8.6, 8.6].forEach((sx, sideIdx) => {
        const tower = new THREE.Group();
        tower.position.set(sx, 0, -2.5);

        for (let b = 0; b < 3; b++) {
            const box = new THREE.Mesh(
                new THREE.BoxGeometry(2.1, 1.8, 1.8),
                new THREE.MeshStandardMaterial({ color: 0x191d2b, roughness: 0.5 })
            );
            box.position.y = 0.9 + b * 1.9;
            const woofer = new THREE.Mesh(
                new THREE.TorusGeometry(0.55, 0.12, 10, 24),
                new THREE.MeshBasicMaterial({ color: sideIdx === 0 ? 0xff6b81 : 0x70a1ff })
            );
            woofer.position.set(0, 0.9 + b * 1.9, 0.92);
            tower.add(box, woofer);
        }
        rhythmGameGroup.add(tower);
    });

    const screenFrame = new THREE.Mesh(
        new THREE.BoxGeometry(13.6, 5.2, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x141a2e, roughness: 0.3 })
    );
    screenFrame.position.set(0, 5.6, -7.2);
    rhythmGameGroup.add(screenFrame);

    rhythmMonitorCanvas = document.createElement('canvas');
    rhythmMonitorCanvas.width = 1024;
    rhythmMonitorCanvas.height = 400;
    rhythmMonitorCtx = rhythmMonitorCanvas.getContext('2d');
    rhythmMonitorTexture = new THREE.CanvasTexture(rhythmMonitorCanvas);

    const screenMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(13.0, 4.7),
        new THREE.MeshBasicMaterial({ map: rhythmMonitorTexture })
    );
    screenMesh.position.set(0, 5.6, -6.92);
    rhythmGameGroup.add(screenMesh);

    const standMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.85 });
    const railMat = new THREE.MeshBasicMaterial({ color: 0x3742fa });
    [
        { rInner: 14.5, rOuter: 18.0, y: 1.2 },
        { rInner: 18.0, rOuter: 21.8, y: 3.1 },
        { rInner: 21.8, rOuter: 26.0, y: 5.2 }
    ].forEach((tier) => {
        const tierMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(tier.rOuter, tier.rInner, 1.9, 48, 1, true),
            standMat
        );
        tierMesh.position.set(0, tier.y, -2.5);
        const neonBand = new THREE.Mesh(
            new THREE.TorusGeometry(tier.rInner + 0.1, 0.08, 8, 48),
            railMat
        );
        neonBand.rotation.x = Math.PI / 2;
        neonBand.position.set(0, tier.y - 0.85, -2.5);
        rhythmGameGroup.add(tierMesh, neonBand);
    });

    const crowdColors = [0xff4757, 0x2ed573, 0x1e90ff, 0xffa502, 0x9c88ff, 0xff9ff3, 0x00d2d3];
    for (let i = 0; i < 95; i++) {
        const angle = (i / 95) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
        const normAngle = Math.atan2(Math.sin(angle), Math.cos(angle));
        if (Math.abs(normAngle - Math.PI) < 0.34 && i % 2 === 0) continue;

        const tierPick = i % 3;
        const dist = tierPick === 0 ? (11.5 + Math.random() * 2.5) : tierPick === 1 ? (16.2 + Math.random() * 1.4) : (20.0 + Math.random() * 1.5);
        const baseY = tierPick === 0 ? -0.35 : tierPick === 1 ? 1.55 : 3.55;
        const cx = Math.sin(angle) * dist;
        const cz = -2.5 + Math.cos(angle) * dist;

        const fanGroup = new THREE.Group();
        fanGroup.position.set(cx, baseY, cz);
        fanGroup.rotation.y = Math.atan2(-cx, -0.5 - cz);

        const cHex = crowdColors[i % crowdColors.length];
        const fanBody = new THREE.Mesh(
            new THREE.SphereGeometry(0.46, 10, 10),
            new THREE.MeshStandardMaterial({ color: cHex, roughness: 0.5 })
        );
        fanBody.position.y = 0.45;

        const fanHead = new THREE.Mesh(
            new THREE.SphereGeometry(0.36, 10, 10),
            new THREE.MeshStandardMaterial({ color: cHex, roughness: 0.5 })
        );
        fanHead.position.y = 0.98;

        const glowStick = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 0.65, 8),
            new THREE.MeshBasicMaterial({ color: crowdColors[(i + 3) % crowdColors.length] })
        );
        glowStick.position.set(0.38, 1.2, 0.15);
        glowStick.rotation.z = -0.35;

        fanGroup.add(fanBody, fanHead, glowStick);
        rhythmGameGroup.add(fanGroup);
        rhythmCrowd.push({
            group: fanGroup,
            stick: glowStick,
            baseY,
            phase: Math.random() * Math.PI * 2,
            speed: 5.5 + Math.random() * 4.5
        });
    }

    [-4.2, 0, 4.2].forEach((lx, i) => {
        const colors = [0xff4757, 0xffd32a, 0x1e90ff];
        const beam = new THREE.Mesh(
            new THREE.ConeGeometry(2.1, 11, 20, 1, true),
            new THREE.MeshBasicMaterial({
                color: colors[i],
                transparent: true,
                opacity: 0.16,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        beam.position.set(lx, 5.5, -0.5);
        rhythmGameGroup.add(beam);
        rhythmSpotlights.push({ mesh: beam, baseX: lx, phase: i * 1.4 });
    });
}

function drawRhythmBigMonitor() {
    if (!rhythmMonitorCtx) return;
    const ctx = rhythmMonitorCtx;
    const W = 1024, H = 400;

    ctx.fillStyle = '#0f1526';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, W - 20, H - 20);

    const barCount = 24;
    const barW = (W - 80) / barCount;
    for (let i = 0; i < barCount; i++) {
        const amp = Math.abs(Math.sin(rhythmPlayTime * 7 + i * 0.65)) * 120 + 25;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(55, 66, 250, 0.35)' : 'rgba(255, 71, 87, 0.32)';
        ctx.fillRect(40 + i * barW + 4, H - 35 - amp, barW - 8, amp);
    }

    ctx.textAlign = 'center';
    if (rhythmSubPhase === 'INTRO') {
        ctx.fillStyle = '#ffd32a';
        ctx.font = '900 44px "Fredoka", "Noto Sans KR", sans-serif';
        ctx.fillText('🎤 WELCOME TO RHYTHM STAGE! 🎤', W / 2, 135);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px "Noto Sans KR", sans-serif';
        ctx.fillText('먼저 들리는 리듬 박자를 듣고 그대로 따라 입력하세요!', W / 2, 225);
        ctx.fillStyle = '#2ed573';
        ctx.font = 'bold 26px "Noto Sans KR", sans-serif';
        ctx.fillText('PERFECT = 100점  •  GOOD = 60점  •  AGAIN = 20점', W / 2, 295);
    } else if (currentRhythmWave) {
        const wObj = currentRhythmWave;
        ctx.fillStyle = '#70a1ff';
        ctx.font = '900 26px "Fredoka", "Noto Sans KR", sans-serif';
        ctx.fillText(`STAGE ${currentWaveIdx + 1} / ${rhythmWaveQueue.length}   •   리듬: [${wObj.style}] (${wObj.word.length}글자)`, W / 2, 54);

        ctx.fillStyle = '#ffd32a';
        ctx.font = 'bold 28px "Noto Sans KR", sans-serif';
        ctx.fillText(`뜻: ${wObj.ko}`, W / 2, 108);

        const letters = wObj.word.split('');
        const cardW = 105;
        const gap = 18;
        const totalW = letters.length * cardW + (letters.length - 1) * gap;
        const startX = (W - totalW) / 2;

        letters.forEach((ch, idx) => {
            const cx = startX + idx * (cardW + gap);
            const cy = 155;
            const isTyped = idx < wObj.typedCount;
            const isNext = idx === wObj.typedCount;

            ctx.fillStyle = isTyped ? '#2ed573' : (isNext ? '#ffd32a' : '#222b45');
            ctx.fillRect(cx, cy, cardW, 115);
            ctx.lineWidth = isNext ? 6 : 3;
            ctx.strokeStyle = isNext ? '#ffffff' : 'rgba(255,255,255,0.35)';
            ctx.strokeRect(cx, cy, cardW, 115);

            ctx.fillStyle = isTyped || isNext ? '#141a2e' : '#ffffff';
            ctx.font = '900 64px "Fredoka", sans-serif';
            ctx.fillText(ch, cx + cardW / 2, cy + 78);
        });

        const barLeft = 110, barRight = W - 110, barY = 335;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(barLeft, barY);
        ctx.lineTo(barRight, barY);
        ctx.stroke();

        ctx.fillStyle = '#ffd32a';
        ctx.beginPath();
        ctx.arc(barLeft, barY, 22, 0, Math.PI * 2);
        ctx.fill();

        const waveElapsed = rhythmPlayTime - wObj.startTime;
        const leadTime = 1.45;

        wObj.beats.forEach((beatOffset, idx) => {
            if (idx < wObj.typedCount) return;
            const timeDiff = beatOffset - waveElapsed;
            const ratio = timeDiff / leadTime;
            if (ratio >= -0.35 && ratio <= 1.25) {
                const nx = barLeft + ratio * (barRight - barLeft);
                ctx.fillStyle = idx === wObj.typedCount ? '#ff4757' : '#70a1ff';
                ctx.beginPath();
                ctx.arc(nx, barY, 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = '900 20px "Fredoka", sans-serif';
                ctx.fillText(wObj.word[idx], nx, barY + 7);
            }
        });
    }

    rhythmMonitorTexture.needsUpdate = true;
}

function setupRhythmWave(idx) {
    currentWaveIdx = idx;
    const base = rhythmWaveQueue[idx % rhythmWaveQueue.length];
    const lastBeatOffset = base.beats[base.beats.length - 1] || 0;
    const leadDelay = lastBeatOffset + 0.85;
    currentRhythmWave = {
        word: base.word,
        ko: base.ko,
        style: base.style,
        pitches: base.pitches || [],
        previewDuration: lastBeatOffset + 0.35,
        beats: base.beats.map(b => b + leadDelay),
        cuedBeats: base.beats.map(() => false),
        startTime: rhythmPlayTime,
        typedCount: 0,
        maxDuration: base.beats[base.beats.length - 1] + leadDelay + 1.35
    };

    if (window.PartySound) {
        window.PartySound.playRhythmPatternPreview(base.beats, base.pitches);
    }

    document.getElementById('rhythm-word-ko').textContent = `${base.ko} [${base.style}]`;
    document.getElementById('rhythm-stage-badge').textContent = `${idx + 1} / ${rhythmWaveQueue.length}곡`;
    document.getElementById('rhythm-combo-text').textContent = '👂 LISTEN! 리듬을 먼저 들으세요!';
    renderRhythmWordSlots();
}

function renderRhythmWordSlots() {
    const slotBox = document.getElementById('rhythm-letter-slots');
    if (!slotBox || !currentRhythmWave) return;
    slotBox.innerHTML = '';
    currentRhythmWave.word.split('').forEach((ch, idx) => {
        const done = idx < currentRhythmWave.typedCount;
        const curr = idx === currentRhythmWave.typedCount;
        const span = document.createElement('span');
        span.className = `inline-flex items-center justify-center w-10 h-11 md:w-12 md:h-13 rounded-xl font-black text-xl md:text-2xl border-2 transition-transform ${
            done ? 'bg-emerald-500 text-white border-emerald-300 scale-95' :
            curr ? 'bg-amber-400 text-slate-900 border-white scale-110 shadow-lg' :
                   'bg-slate-800/80 text-white border-slate-600'
        }`;
        span.textContent = ch;
        slotBox.appendChild(span);
    });
}

function triggerPlayerDanceAction(playerObj, judgeGrade) {
    if (!playerObj) return;
    playerObj.danceTimer = 0.55;
    playerObj.danceStyle = (playerObj.danceStyle + 1) % 3;
    playerObj.char.jump();

    if (playerObj.judgeSprite) {
        rhythmGameGroup.remove(playerObj.judgeSprite);
    }
    const label = judgeGrade === 'PERFECT' ? '✨ PERFECT!' : judgeGrade === 'GOOD' ? '👍 GOOD!' : '💦 AGAIN!';
    const color = judgeGrade === 'PERFECT' ? '#ffd32a' : judgeGrade === 'GOOD' ? '#2ed573' : '#ff6b81';
    const sp = createJudgeSprite(label, color);
    sp.position.set(playerObj.x, 3.2, playerObj.z);
    rhythmGameGroup.add(sp);
    playerObj.judgeSprite = sp;
    playerObj.judgeLife = 0.75;
}

function handleRhythmKeyInput(e) {
    if (!window.isRhythmMinigameActive || rhythmSubPhase !== 'PLAY' || !currentRhythmWave) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const pressed = (e.key || '').toUpperCase();
    if (pressed.length !== 1) return;

    const expectedChar = currentRhythmWave.word[currentRhythmWave.typedCount];
    if (!expectedChar) return;

    const myId = window.myPlayerId || 'local';
    const me = rhythmPlayers[myId];

    if (pressed === expectedChar) {
        const waveElapsed = rhythmPlayTime - currentRhythmWave.startTime;
        const targetBeat = currentRhythmWave.beats[currentRhythmWave.typedCount];
        const diff = Math.abs(waveElapsed - targetBeat);

        let grade = 'AGAIN';
        let addScore = 20;
        if (diff <= 0.25) {
            grade = 'PERFECT';
            addScore = 100;
            myRhythmCombo += 1;
        } else if (diff <= 0.52) {
            grade = 'GOOD';
            addScore = 60;
            myRhythmCombo += 1;
        } else {
            grade = 'AGAIN';
            addScore = 20;
            myRhythmCombo = 0;
        }

        if (window.PartySound) {
            const notePitch = currentRhythmWave.pitches ? currentRhythmWave.pitches[currentRhythmWave.typedCount] : null;
            window.PartySound.playJudge(grade, myRhythmCombo, notePitch);
        }

        const comboBonus = myRhythmCombo >= 3 ? Math.min(40, myRhythmCombo * 5) : 0;
        myRhythmScore += addScore + comboBonus;
        currentRhythmWave.typedCount += 1;

        document.getElementById('rhythm-my-score').textContent = String(myRhythmScore);
        document.getElementById('rhythm-combo-text').textContent = myRhythmCombo >= 2 ? `${myRhythmCombo} COMBO 🔥` : 'KEEP BEAT!';

        if (me) {
            me.score = myRhythmScore;
            triggerPlayerDanceAction(me, grade);
        }
        renderRhythmWordSlots();
        renderRhythmLiveScoreBadges();

        if (window.syncRhythmPlayerState && window.currentRoomInfo) {
            window.syncRhythmPlayerState(window.currentRoomInfo.code, {
                score: myRhythmScore,
                combo: myRhythmCombo,
                lastGrade: grade,
                danceEventId: Date.now()
            });
        }

        if (currentRhythmWave.typedCount >= currentRhythmWave.word.length) {
            setTimeout(() => {
                if (!window.isRhythmMinigameActive || rhythmSubPhase !== 'PLAY') return;
                if (currentWaveIdx + 1 >= rhythmWaveQueue.length) {
                    finishRhythmMinigameResults();
                } else {
                    setupRhythmWave(currentWaveIdx + 1);
                }
            }, 260);
        }
    } else {
        myRhythmCombo = 0;
        document.getElementById('rhythm-combo-text').textContent = 'AGAIN! 박자에 맞춰 입력!';
        if (window.PartySound) window.PartySound.playJudge('AGAIN', 0);
        if (me) triggerPlayerDanceAction(me, 'AGAIN');
    }
}

window.addEventListener('keydown', handleRhythmKeyInput);

window.enterRhythmStageMinigame = function(seedNum) {
    if (window.isRhythmMinigameActive) return;
    window.isRhythmMinigameActive = true;
    gamePhase = 'MINIGAME_RHYTHM';
    rhythmSubPhase = 'INTRO';
    rhythmPhaseTimer = 0;
    rhythmPlayTime = 0;
    myRhythmScore = 0;
    myRhythmCombo = 0;
    window._rhythmReadyPlayed = false;

    if (window.PartySound) {
        window.PartySound.playSfx('intro_fanfare');
        window.PartySound.startRhythmStageBGM(122);
    }

    const indices = RHYTHM_WORD_PATTERNS.map((_, i) => i);
    let s = Number(seedNum || 54321);
    for (let i = indices.length - 1; i > 0; i--) {
        s = (s * 9301 + 49297) % 233280;
        const j = Math.floor((s / 233280) * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    rhythmWaveQueue = indices.slice(0, 8).map(i => RHYTHM_WORD_PATTERNS[i]);

    buildRhythmStadiumStage();
    rhythmPlayers = {};

    const members = (window.currentRoomInfo && window.currentRoomInfo.members.length > 0)
        ? window.currentRoomInfo.members
        : [{ id: window.myPlayerId || 'local', name: getPlayerNickname(), charType: selectedCharType, colorHex: selectedColorHex, isHost: true }];

    members.forEach((m, idx) => {
        const stageX = (idx - (members.length - 1) / 2) * 2.3;
        const charObj = new JellyCharacter(
            m.charType || 'chameleon',
            m.colorHex !== undefined ? m.colorHex : 0x2ed573,
            stageX,
            0.2,
            m.name || '플레이어',
            rhythmGameGroup
        );
        charObj.group.position.y = 0.35;
        charObj.group.rotation.y = 0;
        attachMicrophoneToCharacter(charObj);

        rhythmPlayers[m.id] = {
            member: m,
            char: charObj,
            x: stageX,
            z: 0.2,
            score: 0,
            danceTimer: 0,
            danceStyle: idx % 3,
            judgeSprite: null,
            judgeLife: 0,
            lastDanceEventId: 0
        };
    });

    lobbyGroup.visible = false;
    partyRoomGroup.visible = false;
    if (bombGameGroup) bombGameGroup.visible = false;
    if (typeof wallGameGroup !== 'undefined' && wallGameGroup) wallGameGroup.visible = false;
    rhythmGameGroup.visible = true;

    scene.background = new THREE.Color(0x0b0e1a);
    scene.fog = new THREE.Fog(0x0b0e1a, 28, 85);

    document.getElementById('party-room-hud').classList.add('hidden');
    document.getElementById('party-scoreboard-hud').classList.add('hidden');
    document.getElementById('rhythm-game-overlay').classList.remove('hidden');
    document.getElementById('rhythm-play-hud').classList.add('hidden');
    document.getElementById('rhythm-result-panel').classList.add('hidden');
    document.getElementById('rhythm-phase-banner').textContent = '🎬 OPENING: 스타디움 콘서트 개막! 관중들이 열광합니다!';
    document.getElementById('rhythm-my-score').textContent = '0';

    drawRhythmBigMonitor();
    renderRhythmLiveScoreBadges();
};

function renderRhythmLiveScoreBadges() {
    const box = document.getElementById('rhythm-live-scores');
    if (!box) return;
    box.innerHTML = '';
    Object.values(rhythmPlayers).forEach(p => {
        const badge = document.createElement('div');
        badge.className = 'glass-panel rounded-full px-3.5 py-1 text-xs font-black text-slate-800 flex items-center gap-1.5 shadow';
        badge.innerHTML = `<span>${p.member.emoji || '🎤'} ${p.member.name}</span><span class="text-indigo-600">${p.score}점</span>`;
        box.appendChild(badge);
    });
}

window.onRhythmPlayersUpdated = function(playersState) {
    if (!window.isRhythmMinigameActive || !playersState) return;
    const myId = window.myPlayerId || 'local';

    Object.entries(playersState).forEach(([pid, st]) => {
        const rp = rhythmPlayers[pid];
        if (!rp || pid === myId) return;
        if (st.score !== undefined) rp.score = st.score;
        if (st.danceEventId && st.danceEventId !== rp.lastDanceEventId) {
            rp.lastDanceEventId = st.danceEventId;
            triggerPlayerDanceAction(rp, st.lastGrade || 'GOOD');
        }
    });
    renderRhythmLiveScoreBadges();
};

function finishRhythmMinigameResults() {
    if (rhythmSubPhase === 'RESULT') return;
    rhythmSubPhase = 'RESULT';
    if (window.PartySound) {
        window.PartySound.stopBGM();
        window.PartySound.playSfx('win');
    }
    document.getElementById('rhythm-play-hud').classList.add('hidden');
    document.getElementById('rhythm-phase-banner').textContent = '🏆 스타디움 리듬 공연 최종 결과!';

    const sorted = Object.values(rhythmPlayers).sort((a, b) => b.score - a.score);
    const rankPointTable = [10, 7, 5, 3, 2];
    const awardedPointsMap = {};
    const rankDisplayMap = {};
    const winners = [];

    let currentRank = 1;
    sorted.forEach((p, idx) => {
        if (idx > 0 && p.score < sorted[idx - 1].score) {
            currentRank = idx + 1;
        }
        rankDisplayMap[p.member.id] = currentRank;
        awardedPointsMap[p.member.id] = rankPointTable[currentRank - 1] || 2;
        if (currentRank === 1) winners.push(p.member.name);
    });

    if (typeof window.awardMinigamePoints === 'function') {
        window.awardMinigamePoints(awardedPointsMap);
    }

    const listEl = document.getElementById('rhythm-ranking-list');
    listEl.innerHTML = '';
    sorted.forEach(p => {
        const rNum = rankDisplayMap[p.member.id] || 1;
        const isFirst = rNum === 1;
        const isTied = sorted.filter(x => x.score === p.score).length > 1;
        const rankLabel = isTied ? `공동 ${rNum}등` : `${rNum}등`;
        const earned = awardedPointsMap[p.member.id] || 0;
        const total = window.getMemberTotalPoints ? window.getMemberTotalPoints(p.member.id) : earned;

        const row = document.createElement('div');
        row.className = `flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 ${isFirst ? 'bg-amber-50 border-amber-400' : 'bg-slate-100 border-slate-200'}`;
        row.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="font-black text-base ${isFirst ? 'text-amber-600' : 'text-slate-500'}">${rankLabel}</span>
                <span class="font-black text-slate-800">${p.member.name}</span>
                ${isFirst ? '<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-900">🌟 슈퍼스타</span>' : ''}
            </div>
            <div class="text-right">
                <div class="font-black text-indigo-600 text-sm">${p.score}점 <span class="text-emerald-600">(+${earned} PT)</span></div>
                <div class="text-[11px] font-bold text-slate-500">누적 ${total} PT</div>
            </div>
        `;
        listEl.appendChild(row);
    });

    document.getElementById('rhythm-winner-desc').textContent = `🎤 ${winners.join(', ')}님이 최고의 무대로 우승했습니다!`;
    document.getElementById('rhythm-result-panel').classList.remove('hidden');

    if (window.syncPlayerMinigameFinished && window.currentRoomInfo) {
        window.syncPlayerMinigameFinished(window.currentRoomInfo.code);
    }

    const isHost = !window.currentRoomInfo || window.currentRoomInfo.role === 'HOST';
    const nextBtn = document.getElementById('rhythm-next-round-btn');
    const waitEl = document.getElementById('rhythm-guest-next-wait');
    const totalMembers = window.currentRoomInfo ? window.currentRoomInfo.members.length : 1;

    if (isHost) {
        nextBtn.classList.remove('hidden');
        if (totalMembers > 1) {
            nextBtn.disabled = true;
            nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
            nextBtn.textContent = '⏳ 다른 파티원 결과 집계 대기 중...';
        } else {
            nextBtn.disabled = false;
            nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            nextBtn.textContent = '파티 룸으로 돌아가기 🛋️';
        }
        waitEl.classList.add('hidden');
    } else {
        nextBtn.classList.add('hidden');
        waitEl.classList.remove('hidden');
    }
}

function finishRhythmMinigameToRoom() {
    const nextBtn = document.getElementById('rhythm-next-round-btn');
    if (nextBtn && nextBtn.disabled) return;
    window.hasPlayedFirstRound = true;
    let nextRound = 2;
    if (window.currentRoomInfo) {
        window.currentRoomInfo.currentRound = (window.currentRoomInfo.currentRound || 1) + 1;
        nextRound = window.currentRoomInfo.currentRound;
    }
    if (window.syncReturnToPartyRoom && window.currentRoomInfo) {
        window.syncReturnToPartyRoom(window.currentRoomInfo.code, nextRound);
    }
    window.exitRhythmMinigameToRoom();
}

window.exitRhythmMinigameToRoom = function() {
    window.hasPlayedFirstRound = true;
    window.isRhythmMinigameActive = false;
    if (window.PartySound) window.PartySound.stopBGM();
    document.getElementById('rhythm-game-overlay').classList.add('hidden');
    if (rhythmGameGroup) rhythmGameGroup.visible = false;
    startPartySequence();
};

window.updateAndRenderRhythmMinigame = function(dt, elapsed) {
    rhythmPhaseTimer += dt;
    rhythmPlayTime += dt;

    rhythmCrowd.forEach(fan => {
        const jump = Math.abs(Math.sin(elapsed * fan.speed + fan.phase)) * 0.35;
        fan.group.position.y = fan.baseY + jump;
        fan.stick.rotation.z = Math.sin(elapsed * (fan.speed * 1.6) + fan.phase) * 0.55;
    });

    rhythmSpotlights.forEach(sp => {
        sp.mesh.rotation.z = Math.sin(elapsed * 1.8 + sp.phase) * 0.24;
    });

    Object.values(rhythmPlayers).forEach((p, idx) => {
        const beatBounce = Math.abs(Math.sin(elapsed * 6.5 + idx * 0.7));
        p.char.bodyPivot.position.y = beatBounce * 0.1;

        if (p.danceTimer > 0) {
            p.danceTimer -= dt;
            const prog = 1 - Math.max(0, p.danceTimer / 0.55);
            const wave = Math.sin(prog * Math.PI);

            if (p.danceStyle === 0) {
                p.char.group.rotation.y = prog * Math.PI * 2;
                p.char.group.position.y = 0.35 + wave * 0.85;
            } else if (p.danceStyle === 1) {
                p.char.leftArm.rotation.z = 0.4 + wave * 2.1;
                p.char.rightArm.rotation.z = -0.4 - wave * 2.1;
                p.char.bodyPivot.rotation.z = Math.sin(prog * Math.PI * 2) * 0.28;
                p.char.group.position.y = 0.35 + wave * 0.45;
            } else {
                p.char.rightArm.rotation.x = -wave * 1.25;
                p.char.leftArm.rotation.z = 0.4 + wave * 1.4;
                p.char.bodyPivot.rotation.x = wave * 0.22;
                p.char.group.position.y = 0.35 + wave * 0.55;
            }

            if (p.danceTimer <= 0) {
                p.char.group.rotation.y = 0;
                p.char.group.position.y = 0.35;
                p.char.leftArm.rotation.z = 0.4;
                p.char.rightArm.rotation.z = -0.4;
                p.char.rightArm.rotation.x = 0;
                p.char.bodyPivot.rotation.z = 0;
                p.char.bodyPivot.rotation.x = 0;
            }
        } else {
            p.char.group.position.y = 0.35;
            p.char.bodyPivot.rotation.z = Math.sin(elapsed * 3.25 + idx) * 0.08;
            p.char.headGroup.rotation.z = -Math.sin(elapsed * 3.25 + idx) * 0.1;
        }

        if (p.judgeSprite && p.judgeLife > 0) {
            p.judgeLife -= dt;
            p.judgeSprite.position.y += 1.4 * dt;
            p.judgeSprite.material.opacity = Math.max(0, p.judgeLife / 0.75);
            if (p.judgeLife <= 0) {
                rhythmGameGroup.remove(p.judgeSprite);
                p.judgeSprite = null;
            }
        }
    });

    if (rhythmSubPhase === 'INTRO') {
        const camT = Math.min(1, rhythmPhaseTimer / 3.4);
        const orbitAngle = (1 - camT) * 0.85;
        camera.position.set(
            Math.sin(orbitAngle) * (13.5 - camT * 3.2),
            7.8 - camT * 2.8,
            Math.cos(orbitAngle) * (13.5 - camT * 3.2)
        );
        camera.lookAt(0, 2.4 + camT * 0.5, -2.2);

        if (rhythmPhaseTimer >= 2.1 && !window._rhythmReadyPlayed) {
            window._rhythmReadyPlayed = true;
            document.getElementById('rhythm-phase-banner').textContent = '✨ READY...';
            if (typeof window.showMinigameCountdown === 'function') window.showMinigameCountdown('READY...');
            if (window.PartySound) window.PartySound.playSfx('ready');
        }

        if (rhythmPhaseTimer >= 3.4) {
            window._rhythmReadyPlayed = false;
            rhythmSubPhase = 'PLAY';
            rhythmPhaseTimer = 0;
            document.getElementById('rhythm-phase-banner').textContent = '🎶 리듬에 맞춰 영단어를 타이핑하세요!';
            document.getElementById('rhythm-play-hud').classList.remove('hidden');
            if (typeof window.showMinigameCountdown === 'function') window.showMinigameCountdown('START! 🎤');
            if (window.PartySound) window.PartySound.playSfx('start');
            setupRhythmWave(0);
        }
    } else if (rhythmSubPhase === 'PLAY') {
        if (currentRhythmWave) {
            const waveElapsed = rhythmPlayTime - currentRhythmWave.startTime;
            if (waveElapsed >= currentRhythmWave.previewDuration && currentRhythmWave.typedCount === 0) {
                document.getElementById('rhythm-combo-text').textContent = '🔥 YOUR TURN! 따라 입력하세요!';
            }
            const trackEl = document.getElementById('rhythm-note-track');
            if (trackEl) {
                trackEl.innerHTML = '';
                const leadTime = 1.45;
                currentRhythmWave.beats.forEach((bTime, idx) => {
                    if (!currentRhythmWave.cuedBeats[idx] && waveElapsed >= bTime) {
                        currentRhythmWave.cuedBeats[idx] = true;
                        const notePitch = currentRhythmWave.pitches ? currentRhythmWave.pitches[idx] : null;
                        if (window.PartySound) window.PartySound.playNoteGuideCue(idx, notePitch);
                    }
                    if (idx < currentRhythmWave.typedCount) return;
                    const diff = bTime - waveElapsed;
                    const pct = (diff / leadTime) * 100;
                    if (pct >= -15 && pct <= 115) {
                        const note = document.createElement('div');
                        const isCurrent = idx === currentRhythmWave.typedCount;
                        note.style.left = `${Math.max(0, Math.min(94, pct))}%`;
                        note.className = `absolute top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center font-black text-base shadow-lg border-2 ${
                            isCurrent ? 'bg-rose-500 text-white border-yellow-300 scale-110 z-10' : 'bg-indigo-500 text-white border-white/70'
                        }`;
                        note.textContent = currentRhythmWave.word[idx];
                        trackEl.appendChild(note);
                    }
                });
            }

            if (waveElapsed >= currentRhythmWave.maxDuration) {
                if (currentWaveIdx + 1 >= rhythmWaveQueue.length) {
                    finishRhythmMinigameResults();
                } else {
                    setupRhythmWave(currentWaveIdx + 1);
                }
            }
        }

        camera.position.lerp(new THREE.Vector3(0, 5.1, 10.6), 4 * dt);
        camera.lookAt(0, 2.7, -2.5);
    }

    drawRhythmBigMonitor();
    renderer.render(scene, camera);
};
