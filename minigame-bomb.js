// ==========================================
// 미니게임 1: 폭탄 해체하기 (BOMB DEFUSAL) 독립 모듈
// ==========================================
window.isBombMinigameActive = false;
let bombSubPhase = 'INTRO'; // 'INTRO' (3초 묶임 연출) | 'PLAY' (30초 타이핑) | 'RESULT' (1등 환호/폭발)
let bombPhaseElapsed = 0;
let bombStages = [];
let bombScoreMap = {};
let myBombScore = 0;
let currentBombWordObj = null;
let isWordTransitioning = false;

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

// 플레이어별 3D 폭탄 해체 무대 생성
function createBombStageForMember(member, slotIndex) {
    const stageGroup = new THREE.Group();
    const baseX = slotIndex * 30;
    stageGroup.position.set(baseX, 0, 0);

    const floor = new THREE.Mesh(
        new THREE.CylinderGeometry(6.5, 6.5, 0.3, 32),
        new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.7 })
    );
    floor.position.y = -0.15;
    floor.receiveShadow = true;

    const dangerRing = new THREE.Mesh(
        new THREE.RingGeometry(2.6, 3.0, 32),
        new THREE.MeshBasicMaterial({ color: 0xff4757, side: THREE.DoubleSide })
    );
    dangerRing.rotation.x = -Math.PI / 2;
    dangerRing.position.y = 0.02;

    const backWall = new THREE.Mesh(
        new THREE.BoxGeometry(14, 9, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.85 })
    );
    backWall.position.set(0, 4.5, -4.5);

    const spotLight = new THREE.PointLight(0xffdd59, 1.4, 18);
    spotLight.position.set(0, 5.5, 3.5);
    stageGroup.add(floor, dangerRing, backWall, spotLight);

    const charObj = new JellyCharacter(
        member.charType || 'chameleon',
        member.colorHex !== undefined ? member.colorHex : 0x2ed573,
        -0.75,
        0.2,
        member.name || '플레이어',
        stageGroup
    );
    charObj.group.rotation.y = 0.25;

    // 밧줄 메쉬
    const ropeGroup = new THREE.Group();
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.9 });
    [0.58, 0.82, 1.06].forEach((ry, idx) => {
        const ropeRing = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.075, 10, 24), ropeMat);
        ropeRing.rotation.x = Math.PI / 2 + (idx - 1) * 0.12;
        ropeRing.position.set(0, ry, 0.02);
        ropeGroup.add(ropeRing);
    });
    charObj.bodyPivot.add(ropeGroup);

    // 대형 시한폭탄
    const bombGroup = new THREE.Group();
    bombGroup.position.set(0.95, 0, 0.35);

    const bombSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.78, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.3, metalness: 0.4 })
    );
    bombSphere.position.y = 0.78;
    bombSphere.castShadow = true;

    const bombCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 0.22, 16),
        new THREE.MeshStandardMaterial({ color: 0x747d8c, metalness: 0.6 })
    );
    bombCap.position.y = 1.56;

    const bombLed = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xff4757 })
    );
    bombLed.position.set(0, 0.95, 0.74);

    const spark = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        new THREE.MeshBasicMaterial({ color: 0xffa502 })
    );
    spark.position.set(0, 1.82, 0);

    bombGroup.add(bombSphere, bombCap, bombLed, spark);
    stageGroup.add(bombGroup);

    // 폭발 파티클
    const explosionMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 20, 20),
        new THREE.MeshBasicMaterial({ color: 0xff6b35, transparent: true, opacity: 0.95 })
    );
    explosionMesh.position.set(0.4, 1.1, 0.3);
    explosionMesh.visible = false;
    stageGroup.add(explosionMesh);

    bombGameGroup.add(stageGroup);

    return {
        member,
        baseX,
        stageGroup,
        charObj,
        ropeGroup,
        bombGroup,
        bombLed,
        spark,
        explosionMesh,
        score: 0,
        isWinner: false,
        exploded: false
    };
}

// 미니게임 입장 및 초기화
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
    document.getElementById('interaction-prompt').classList.add('opacity-0', 'pointer-events-none');
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
    let next = BOMB_WORD_BANK[Math.floor(Math.random() * BOMB_WORD_BANK.length)];
    if (currentBombWordObj && BOMB_WORD_BANK.length > 1) {
        while (next.en === currentBombWordObj.en) {
            next = BOMB_WORD_BANK[Math.floor(Math.random() * BOMB_WORD_BANK.length)];
        }
    }
    currentBombWordObj = next;
    document.getElementById('bomb-word-meaning').textContent = `뜻: ${next.ko}`;
    document.getElementById('bomb-target-word').textContent = next.en;
    const inp = document.getElementById('bomb-word-input');
    if (inp) {
        // 입력기(IME) 조합 버퍼를 완전히 비우기 위해 blur 후 초기화 및 재포커스
        inp.blur();
        inp.value = '';
        setTimeout(() => {
            if (bombSubPhase === 'PLAY') {
                inp.value = '';
                inp.focus();
            }
            isWordTransitioning = false;
        }, 15);
    } else {
        isWordTransitioning = false;
    }
}

function checkBombWordMatch(rawVal) {
    if (bombSubPhase !== 'PLAY' || !currentBombWordObj || isWordTransitioning) return;
    const cleaned = (rawVal || '').replace(/\s+/g, '').toUpperCase();
    if (cleaned === currentBombWordObj.en) {
        isWordTransitioning = true;
        myBombScore += 1;
        document.getElementById('bomb-my-score').textContent = String(myBombScore);
        const myId = window.myPlayerId || 'local';
        bombScoreMap[myId] = myBombScore;

        // 내 스테이지 찾기 (ID 일치 또는 index 0 fallback)
        const myStage = bombStages.find(s => s.member.id === myId) || bombStages[0];
        if (myStage) {
            myStage.score = myBombScore;
            myStage.charObj.jump();
            const badge = document.getElementById(`bomb-cell-score-${myStage.member.id}`);
            if (badge) badge.textContent = String(myBombScore);
        }

        if (window.syncUpdateMinigameScore && window.currentRoomInfo) {
            window.syncUpdateMinigameScore(window.currentRoomInfo.code, myBombScore);
        }
        pickNextBombWord();
    }
}

function onBombWordInput(val) {
    checkBombWordMatch(val);
}

function onBombWordKeyUp(e) {
    const inp = document.getElementById('bomb-word-input');
    if (inp) checkBombWordMatch(inp.value);
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

    // 등수별 포인트 테이블 (1등: 10점, 2등: 7점, 3등: 5점, 4등: 3점, 5등 이하: 2점)
    const rankPointTable = [10, 7, 5, 3, 2];
    const awardedPointsMap = {};
    const rankDisplayMap = {};
    const winners = [];

    let currentRank = 1;
    sorted.forEach((st, idx) => {
        // 앞사람과 점수가 같으면 같은 공동 순위 유지!
        if (idx > 0 && st.score < sorted[idx - 1].score) {
            currentRank = idx + 1;
        }
        rankDisplayMap[st.member.id] = currentRank;
        const earnedPt = rankPointTable[currentRank - 1] || 2;
        awardedPointsMap[st.member.id] = earnedPt;

        // 공동 1등까지 모두 탈출 성공!
        if (currentRank === 1) {
            st.isWinner = true;
            st.ropeGroup.visible = false;
            st.bombGroup.visible = false;
            winners.push(st.member.name);
        } else {
            st.isWinner = false;
            st.exploded = true;
            st.bombGroup.visible = false;
            st.explosionMesh.visible = true;
            st.charObj.setColor(0x2f3542);
        }
    });

    // 누적 점수(PT) 반영 (방장이 서버/로컬 누적 점수 갱신)
    if (typeof window.awardMinigamePoints === 'function') {
        window.awardMinigamePoints(awardedPointsMap);
    }

    const rankListEl = document.getElementById('bomb-ranking-list');
    rankListEl.innerHTML = '';
    sorted.forEach((st) => {
        const isFirst = st.isWinner;
        const rankNum = rankDisplayMap[st.member.id] || 1;
        const isTied = sorted.filter(x => x.score === st.score).length > 1;
        const rankLabel = isTied ? `공동 ${rankNum}등` : `${rankNum}등`;
        const earnedPt = awardedPointsMap[st.member.id] || 0;
        const totalPt = (window.getMemberTotalPoints ? window.getMemberTotalPoints(st.member.id) : earnedPt);

        const row = document.createElement('div');
        row.className = `flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 ${isFirst ? 'bg-amber-50 border-amber-400' : 'bg-slate-100 border-slate-200'}`;
        row.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="font-black text-base ${isFirst ? 'text-amber-600' : 'text-slate-500'}">${rankLabel}</span>
                <span class="font-black text-slate-800">${st.member.name}</span>
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${isFirst ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}">
                    ${isFirst ? '🎉 탈출!' : '💥 폭발!'}
                </span>
            </div>
            <div class="text-right">
                <div class="font-black text-indigo-600 text-sm">${st.score}개 <span class="text-emerald-600">(+${earnedPt} PT)</span></div>
                <div class="text-[11px] font-bold text-slate-500">누적 ${totalPt} PT</div>
            </div>
        `;
        rankListEl.appendChild(row);
    });

    const winnerNamesText = winners.length > 1 ? `공동 1등 ${winners.join(', ')}` : (winners[0] || '1등');
    document.getElementById('bomb-winner-desc').textContent = `👑 ${winnerNamesText}님이 폭탄을 해체해 탈출했습니다!`;
    document.getElementById('bomb-result-panel').classList.remove('hidden');

    if (window.syncPlayerMinigameFinished && window.currentRoomInfo) {
        window.syncPlayerMinigameFinished(window.currentRoomInfo.code);
    }

    const isHost = !window.currentRoomInfo || window.currentRoomInfo.role === 'HOST';
    const nextBtn = document.getElementById('bomb-next-round-btn');
    const waitEl = document.getElementById('bomb-guest-next-wait');
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

function finishBombMinigameToRoom() {
    const nextBtn = document.getElementById('bomb-next-round-btn');
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
    window.exitBombMinigameToRoom();
}

window.exitBombMinigameToRoom = function() {
    window.hasPlayedFirstRound = true;
    window.isBombMinigameActive = false;
    document.getElementById('bomb-game-overlay').classList.add('hidden');
    if (bombGameGroup) bombGameGroup.visible = false;
    startPartySequence();
};

// 매 프레임 폭탄 해체 애니메이션 및 분할 화면(Viewport) 렌더링
window.updateAndRenderBombMinigame = function(dt, elapsed) {
    if (bombStages.length === 0) return;
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
};
