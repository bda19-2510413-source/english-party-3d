// ... existing code ...
let lobbyGroup, partyRoomGroup, bombGameGroup, awardCeremonyGroup;
let gamePhase = 'LOBBY';
let phaseTimer = 0;
let roomCharacterMap = {};
let tvCanvas, tvCtx, tvTexture;
window.isAwardCeremonyActive = false;
let awardCeremonyActors = [];
let awardConfetti = [];
// ... existing code ...
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
// ... existing code ...
    lobbyGroup.visible = false;
    partyRoomGroup.visible = true;
    if (bombGameGroup) bombGameGroup.visible = false;
    if (awardCeremonyGroup) awardCeremonyGroup.visible = false;
    window.isAwardCeremonyActive = false;
    document.getElementById('award-ceremony-overlay').classList.add('hidden');
    scene.background = new THREE.Color(0xdff9fb);
    scene.fog = new THREE.Fog(0xdff9fb, 35, 95);
// ... existing code ...
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
// ... existing code ...
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

    // 시상대 무대 바닥 & 레드카펫
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

    // 1등(중앙), 2등(좌측), 3등(우측) 단상 블록
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

    // 누적 점수(PT) 순 정렬 후 캐릭터 배치 & 금/은/동 메달 수여
    const members = (window.currentRoomInfo && window.currentRoomInfo.members.length > 0)
        ? [...window.currentRoomInfo.members]
        : [{ id: window.myPlayerId || 'local', name: getPlayerNickname(), charType: selectedCharType, colorHex: selectedColorHex, points: 0 }];
    members.sort((a, b) => (b.points || 0) - (a.points || 0));

    const spotPositions = [
        { x: 0.0,  y: 2.1, z: -0.5 }, // 1등 (금메달)
        { x: -2.4, y: 1.4, z: -0.5 }, // 2등 (은메달)
        { x: 2.4,  y: 0.9, z: -0.5 }, // 3등 (동메달)
        { x: 4.5,  y: 0.0, z: 0.3 }   // 4등
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

    // 축하 꽃가루 파티클 생성
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
// ... existing code ...
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
// ... existing code ...
window.onload = function () {
    console.log("11");
    initScene();
// ... existing code ...
