// ==========================================
// 공용 Web Audio 사운드 & 리듬 반주 엔진 (sound-engine.js)
// - 외부 오디오 파일 없이도 드럼(킥/스네어/하이햇), 베이스, 멜로디, 효과음 재생
// ==========================================
class PartySoundEngine {
    constructor() {
        this.ctx = null;
        this.bgmTimer = null;
        this.step = 0;
        this.isMuted = false;
    }

    ensureContext() {
        if (this.isMuted) return null;
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    playTone(freq, duration = 0.14, type = 'triangle', gainVal = 0.14, delay = 0) {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(gainVal, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    playKick(delay = 0) {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(145, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.13);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
    }

    playSnare(delay = 0) {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime + delay;
        const bufferSize = Math.floor(ctx.sampleRate * 0.11);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 950;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
    }

    playHiHat(delay = 0) {
        const ctx = this.ensureContext();
        if (!ctx) return;
        const now = ctx.currentTime + delay;
        const bufferSize = Math.floor(ctx.sampleRate * 0.045);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5200;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
    }

    // 리듬 스테이지 전용 경쾌한 팝/아이돌 120BPM 반주 루프 시작
    startRhythmStageBGM(bpm = 116) {
        this.stopBGM();
        this.step = 0;
        const eighthMs = (60 / bpm / 2) * 1000;
        const bassNotes = [130.81, 130.81, 164.81, 164.81, 174.61, 174.61, 196.00, 196.00]; // C3 - E3 - F3 - G3

        const tick = () => {
            const s = this.step % 8;
            if (s === 0 || s === 4) this.playTone(65, 0.12, 'sine', 0.11);
            if (s === 2 || s === 6) this.playHiHat();
            if (s % 2 === 0) {
                this.playTone(bassNotes[s], 0.16, 'triangle', 0.055);
            }
            this.step++;
        };
        tick();
        this.bgmTimer = setInterval(tick, eighthMs);
    }

    stopBGM() {
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
    }

    // 단어 고유 리듬 패턴(예: 따! ... 따! ... 다-다-다!)을 먼저 들려주는 리듬 천국 스타일 가이드
    playRhythmPatternPreview(beatsArray, pitchesArray) {
        const ctx = this.ensureContext();
        if (!ctx || !Array.isArray(beatsArray)) return;
        const defaultPitches = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        beatsArray.forEach((offsetSec, idx) => {
            const freq = (pitchesArray && pitchesArray[idx]) ? pitchesArray[idx] : defaultPitches[idx % defaultPitches.length];
            // 또렷한 실로폰/브라스 2중 톤으로 리듬 간격을 명확히 각인시킴
            this.playTone(freq, 0.11, 'triangle', 0.22, offsetSec);
            this.playTone(freq * 2, 0.07, 'sine', 0.09, offsetSec);
        });
    }

    // 리듬 노트 예고음 (노트가 판정선에 닿는 정박 타이밍 가이드 틱)
    playNoteGuideCue(noteIndex = 0, customPitch = null) {
        const scale = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00];
        const freq = customPitch || scale[noteIndex % scale.length];
        this.playTone(freq, 0.08, 'sine', 0.07);
    }

    // 판정별 사운드
    playJudge(grade, combo = 1, customPitch = null) {
        if (grade === 'PERFECT') {
            const baseFreq = customPitch || (783.99 + Math.min(200, combo * 15));
            this.playTone(baseFreq, 0.13, 'triangle', 0.22, 0);
            this.playTone(baseFreq * 1.25, 0.18, 'sine', 0.18, 0.04);
        } else if (grade === 'GOOD') {
            const baseFreq = customPitch || 659.25;
            this.playTone(baseFreq, 0.14, 'triangle', 0.17, 0);
        } else {
            this.playTone(220, 0.16, 'sawtooth', 0.09, 0);
        }
    }

    // 공용 효과음 (점프, 밀치기, 벽 파괴, 폭탄 해제, 룰렛)
    playSfx(name) {
        if (name === 'jump') {
            this.playTone(340, 0.08, 'sine', 0.1, 0);
            this.playTone(520, 0.12, 'sine', 0.1, 0.05);
        } else if (name === 'shove') {
            this.playSnare(0);
            this.playTone(180, 0.1, 'triangle', 0.14, 0);
        } else if (name === 'roulette_tick') {
            this.playTone(620, 0.04, 'square', 0.07, 0);
        } else if (name === 'win') {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
                this.playTone(f, 0.22, 'triangle', 0.16, i * 0.09);
            });
        } else if (name === 'wall_break') {
            this.playSnare(0);
            this.playTone(440, 0.12, 'triangle', 0.15, 0.02);
            this.playTone(660, 0.16, 'triangle', 0.15, 0.08);
        } else if (name === 'bomb_clear') {
            this.playTone(587.33, 0.09, 'triangle', 0.15, 0);
            this.playTone(880.00, 0.14, 'triangle', 0.16, 0.06);
        } else if (name === 'intro_fanfare') {
            [392.00, 523.25, 659.25, 783.99].forEach((f, i) => {
                this.playTone(f, 0.18, 'triangle', 0.14, i * 0.1);
            });
        }
    }
}

window.PartySound = new PartySoundEngine();
