// ==========================================
// 전 구역 전용 BGM(로비, 파티룸, 폭탄, 벽돌파, 리듬스테이지) & 효과음 엔진
// ==========================================
class PartySoundEngine {
    constructor() {
        this.ctx = null;
        this.bgmTimer = null;
        this.currentBgmMode = null;
        this.step = 0;
        this.isMuted = false;
    }

    ensureContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    playTone(freq, duration = 0.15, type = 'sine', volume = 0.14, delay = 0) {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime + delay;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.002, volume), now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    playKick(delay = 0, vol = 0.24) {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime + delay;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(145, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);

        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
    }

    playSnare(delay = 0, vol = 0.12) {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime + delay;

        const bufferSize = ctx.sampleRate * 0.11;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1100, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
    }

    playHiHat(delay = 0, vol = 0.045) {
        if (this.isMuted) return;
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime + delay;

        const bufferSize = ctx.sampleRate * 0.04;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(5500, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
    }

    // 1. 로비 들판: 밝고 경쾌한 마리오풍 모험 필드 BGM
    startLobbyBGM() {
        if (this.currentBgmMode === 'LOBBY' && this.bgmTimer) return;
        this.stopBGM();
        this.currentBgmMode = 'LOBBY';
        this.step = 0;
        const melody = [
            523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880.00, 783.99,
            659.25, 523.25, 587.33, 659.25, 523.25, 0,      392.00, 0
        ];
        const bass = [
            261.63, 196.00, 261.63, 196.00, 293.66, 220.00, 293.66, 220.00,
            220.00, 164.81, 196.00, 246.94, 261.63, 196.00, 261.63, 196.00
        ];
        this.bgmTimer = setInterval(() => {
            const idx = this.step % melody.length;
            if (melody[idx] > 0) this.playTone(melody[idx], 0.19, 'sine', 0.045);
            if (idx % 2 === 0) this.playTone(bass[idx], 0.24, 'triangle', 0.048);
            this.step++;
        }, 260);
    }

    // 2. 파티 룸 & 룰렛: 두근두근 소파 파티 라운지 BGM
    startPartyRoomBGM() {
        if (this.currentBgmMode === 'PARTY_ROOM' && this.bgmTimer) return;
        this.stopBGM();
        this.currentBgmMode = 'PARTY_ROOM';
        this.step = 0;
        const chords = [
            [261.63, 329.63, 392.00],
            [220.00, 261.63, 329.63],
            [174.61, 220.00, 261.63],
            [196.00, 246.94, 293.66]
        ];
        this.bgmTimer = setInterval(() => {
            const s = this.step % 8;
            const bar = Math.floor(this.step / 8) % chords.length;
            const chord = chords[bar];
            if (s === 0 || s === 4) this.playKick(0, 0.14);
            if (s === 2 || s === 6) this.playHiHat(0, 0.035);
            if (s % 2 === 0) {
                this.playTone(chord[s / 2 % chord.length] * 2, 0.18, 'triangle', 0.042);
            }
            this.step++;
        }, 240);
    }

    // 3. 미니게임 1 (폭탄 해체): 긴박한 미션 & 시한폭탄 틱톡 스릴 BGM
    startBombBGM() {
        if (this.currentBgmMode === 'BOMB' && this.bgmTimer) return;
        this.stopBGM();
        this.currentBgmMode = 'BOMB';
        this.step = 0;
        const bassLine = [110.00, 110.00, 130.81, 146.83, 110.00, 110.00, 164.81, 146.83];
        this.bgmTimer = setInterval(() => {
            const s = this.step % 8;
            if (s % 2 === 0) this.playKick(0, 0.19);
            if (s === 2 || s === 6) this.playSnare(0, 0.09);
            this.playHiHat(0, s % 2 === 0 ? 0.05 : 0.025);
            this.playTone(bassLine[s], 0.14, 'sawtooth', 0.045);
            if (s % 4 === 0) {
                this.playTone(880, 0.04, 'sine', 0.035);
            }
            this.step++;
        }, 195);
    }

    // 4. 미니게임 2 (문법 벽 돌파): 질주감 넘치는 스피드 런 댄스 BGM
    startWallBGM() {
        if (this.currentBgmMode === 'WALL' && this.bgmTimer) return;
        this.stopBGM();
        this.currentBgmMode = 'WALL';
        this.step = 0;
        const lead = [523.25, 0, 659.25, 783.99, 880.00, 783.99, 659.25, 587.33];
        const bass = [130.81, 261.63, 130.81, 261.63, 174.61, 349.23, 196.00, 392.00];
        this.bgmTimer = setInterval(() => {
            const s = this.step % 8;
            if (s % 2 === 0) this.playKick(0, 0.2);
            if (s === 2 || s === 6) this.playSnare(0, 0.1);
            this.playTone(bass[s], 0.13, 'triangle', 0.08);
            if (lead[s] > 0) this.playTone(lead[s], 0.12, 'sine', 0.055);
            this.step++;
        }, 185);
    }

    // 5. 미니게임 3 (리듬 스테이지): 122 BPM 신나는 아이돌 팝 콘서트 BGM
    startRhythmStageBGM(bpm = 122) {
        this.stopBGM();
        this.currentBgmMode = 'RHYTHM';
        this.step = 0;
        const sixteenthMs = (60 / bpm / 4) * 1000;
        const chordRoots = [130.81, 196.00, 220.00, 174.61];
        const arpNotes = [
            [523.25, 659.25, 783.99, 1046.50],
            [392.00, 493.88, 587.33, 783.99],
            [440.00, 523.25, 659.25, 880.00],
            [349.23, 440.00, 523.25, 698.46]
        ];

        const tick = () => {
            const s = this.step % 16;
            const bar = Math.floor(this.step / 16) % 4;
            const root = chordRoots[bar];
            const arp = arpNotes[bar];

            if (s % 4 === 0) this.playKick(0, 0.22);
            if (s === 4 || s === 12) this.playSnare(0, 0.11);
            if (s % 2 === 1) this.playHiHat(0, 0.04);

            if (s % 2 === 0) {
                const bassFreq = (s % 4 === 2) ? root * 2 : root;
                this.playTone(bassFreq, 0.13, 'triangle', 0.095);
                const note = arp[(s / 2) % arp.length];
                this.playTone(note, 0.1, 'sine', 0.04);
            }
            this.step++;
        };
        tick();
        this.bgmTimer = setInterval(tick, sixteenthMs);
    }

    stopBGM() {
        this.currentBgmMode = null;
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
    }

    // 단어가 처음 나올 때 고유 리듬 패턴(예: 따! ... 따! ... 다-다-다!)을 먼저 귀로 들려주는 예고 멜로디
    playRhythmPatternPreview(beats, pitches) {
        if (!Array.isArray(beats)) return;
        const defaultScale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        beats.forEach((beatSec, idx) => {
            const freq = (pitches && pitches[idx]) ? pitches[idx] : defaultScale[idx % defaultScale.length];
            const d = beatSec + 0.06;
            this.playTone(freq, 0.16, 'triangle', 0.24, d);
            this.playTone(freq * 2, 0.11, 'sine', 0.09, d);
        });
    }

    playNoteGuideCue(noteIndex = 0, customPitch = null) {
        const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        const freq = customPitch || scale[noteIndex % scale.length];
        this.playTone(freq, 0.09, 'sine', 0.09, 0);
    }

    playJudge(grade, combo = 1, customPitch = null) {
        if (grade === 'PERFECT') {
            const base = customPitch || Math.min(1174.66, 659.25 + combo * 22);
            this.playTone(base, 0.16, 'triangle', 0.24, 0);
            this.playTone(base * 1.5, 0.2, 'sine', 0.16, 0.03);
        } else if (grade === 'GOOD') {
            const base = customPitch || 523.25;
            this.playTone(base, 0.14, 'sine', 0.19, 0);
            this.playTone(base * 1.25, 0.15, 'sine', 0.12, 0.03);
        } else {
            this.playTone(180, 0.14, 'sawtooth', 0.11, 0);
            this.playTone(145, 0.18, 'sawtooth', 0.11, 0.08);
        }
    }

    playSfx(name) {
        if (name === 'jump') {
            this.playTone(340, 0.08, 'sine', 0.13, 0);
            this.playTone(540, 0.13, 'sine', 0.13, 0.05);
        } else if (name === 'shove') {
            this.playSnare(0, 0.14);
            this.playTone(180, 0.1, 'triangle', 0.16, 0);
        } else if (name === 'portal') {
            [440, 554.37, 659.25, 880].forEach((f, i) => this.playTone(f, 0.14, 'sine', 0.13, i * 0.05));
        } else if (name === 'roulette_tick') {
            this.playTone(720, 0.035, 'triangle', 0.09, 0);
        } else if (name === 'roulette_win') {
            [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => this.playTone(f, 0.2, 'triangle', 0.17, i * 0.07));
        } else if (name === 'ready') {
            this.playTone(440, 0.16, 'triangle', 0.18, 0);
            this.playTone(554.37, 0.18, 'triangle', 0.18, 0.14);
        } else if (name === 'start') {
            this.playSnare(0, 0.16);
            [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
                this.playTone(f, 0.24, 'triangle', 0.2, i * 0.05);
            });
        } else if (name === 'wrong') {
            this.playTone(175, 0.14, 'sawtooth', 0.11, 0);
            this.playTone(145, 0.18, 'sawtooth', 0.11, 0.09);
        } else if (name === 'win') {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
                this.playTone(f, 0.22, 'triangle', 0.16, i * 0.09);
            });
        } else if (name === 'wall_break') {
            this.playSnare(0, 0.16);
            this.playTone(440, 0.12, 'triangle', 0.15, 0.02);
            this.playTone(660, 0.16, 'triangle', 0.15, 0.08);
        } else if (name === 'fall') {
            this.playTone(420, 0.14, 'sine', 0.13, 0);
            this.playTone(260, 0.22, 'sine', 0.13, 0.12);
        } else if (name === 'bomb_clear') {
            this.playTone(587.33, 0.09, 'triangle', 0.16, 0);
            this.playTone(880.00, 0.14, 'triangle', 0.18, 0.06);
        } else if (name === 'explosion') {
            this.playKick(0, 0.35);
            this.playSnare(0.02, 0.28);
            this.playTone(95, 0.38, 'sawtooth', 0.22, 0);
        } else if (name === 'intro_fanfare') {
            [392.00, 523.25, 659.25, 783.99].forEach((f, i) => {
                this.playTone(f, 0.18, 'triangle', 0.15, i * 0.1);
            });
        }
    }
}

window.PartySound = new PartySoundEngine();
