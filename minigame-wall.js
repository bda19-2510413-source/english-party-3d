// ... existing code ...
    document.getElementById('wall-game-overlay').classList.remove('hidden');
    document.getElementById('wall-result-panel').classList.add('hidden');
    document.getElementById('wall-phase-banner').textContent = '🎬 OPENING: 전광판 문제를 보고 정답 벽으로 달려가세요!';
    document.getElementById('wall-timer-text').textContent = 'INTRO';

    if (window.PartySound) window.PartySound.playSfx('intro_fanfare');

    startNextWallWave(0);
    renderWallAliveBadges();
};
// ... existing code ...
                if (isRevealPointReached && inCorrectZone) {
                    // 중반 이후 정답 벽: 산산조각 파편으로 부서지며 통과!
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
// ... existing code ...
    // 3. 상태별 진행 (3.2초 시네마틱 활주로 오프닝 카메라 -> 연속 벽 돌진)
    if (wallSubPhase === 'INTRO') {
        const introT = Math.min(1, wallPhaseTimer / 3.2);
        camera.position.set(
            Math.sin((1 - introT) * 1.1) * 9.0,
            6.5 + introT * 3.1,
            -4.5 + introT * 21.3
        );
        camera.lookAt(0, 2.4, -2.5);
        if (wallPhaseTimer >= 3.2) {
            wallSubPhase = 'RUN';
            wallWaveTimer = 0;
            document.getElementById('wall-phase-banner').textContent = '🧱 WAVE 1: 정답 벽 앞으로 이동! (좌클릭 밀치기!)';
        }
        renderer.render(scene, camera);
        return;
    } else if (wallSubPhase === 'RUN') {
// ... existing code ...
