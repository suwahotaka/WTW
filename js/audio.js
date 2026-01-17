// --- 効果音 & 高度なBGMシーケンサー ---
const SoundFX = {
    ctx: null,
    bgmNodes: [], 
    nextNoteTime: 0,
    timerID: null,
    isPlaying: false,
    currentTempo: 120,
    currentType: null,
    beatCount: 0, // 何拍目かを管理

    init: function() {
        if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        if (this.ctx.state === 'suspended') { this.ctx.resume(); }
    },

    // --- BGM制御 ---
    playBGM: function(type) {
        if (!this.ctx) this.init();
        if (this.currentType === type && this.isPlaying) return;

        this.stopBGM();
        this.currentType = type;
        this.isPlaying = true;
        this.beatCount = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.1;

        if (type === 'title') {
            this.currentTempo = 60; // ゆったり
            this.scheduler();
        } else if (type === 'normal') {
            this.currentTempo = 110; // 軽快
            this.scheduler();
        } else if (type === 'hurry') {
            this.currentTempo = 160; // 高速
            this.scheduler();
        }
    },

    stopBGM: function() {
        this.isPlaying = false;
        clearTimeout(this.timerID);
        this.bgmNodes.forEach(n => {
            try { n.stop(); n.disconnect(); } catch(e){}
        });
        this.bgmNodes = [];
    },

    // --- シーケンサー（リズム管理） ---
    scheduler: function() {
        if (!this.isPlaying) return;

        // 先読みして音を予約する
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.playBeat(this.nextNoteTime, this.beatCount, this.currentType);
            this.nextNoteTime += (60.0 / this.currentTempo) / 4; // 16分音符刻み
            this.beatCount++;
        }
        this.timerID = setTimeout(() => this.scheduler(), 25);
    },

    // --- 実際の演奏処理 ---
    playBeat: function(time, beat, type) {
        const bar16 = beat % 16; // 1小節(16分音符x16)のどこか
        const bar32 = beat % 32; // 2小節ループ用

        if (type === 'title') {
            // 【タイトル：荘厳】
            // 0拍目: 重厚な和音パッド
            if (bar32 === 0) this.playPad(time, [110, 164.8, 196], 4); // Am7 (A2, E3, G3)
            if (bar32 === 16) this.playPad(time, [87.3, 130.8, 174.6], 4); // Fmaj7 (F2, C3, F3)
            
            // ランダムなベル音（きらめき）
            if (Math.random() < 0.2) {
                const notes = [523, 659, 784, 1046];
                this.playBell(time, notes[Math.floor(Math.random()*notes.length)]);
            }
        } 
        
        else if (type === 'normal') {
            // 【通常：華やか】
            // バスドラム (4つ打ち)
            if (bar16 % 4 === 0) this.playKick(time);
            
            // ベース (裏打ちでグルーヴ)
            const bassNote = (bar32 < 16) ? 110 : 146.8; // A -> D
            if (bar16 === 2 || bar16 === 10 || bar16 === 14) this.playBass(time, bassNote);

            // コードバッキング (短く刻む)
            if (bar16 % 2 === 0) {
                const chord = (bar32 < 16) ? [440, 523, 659] : [587, 739, 880]; // Am -> D
                this.playChord(time, chord, 0.1);
            }

            // メロディ (アルペジオ)
            const arp = [523, 659, 784, 880];
            if (beat % 2 === 0) this.playLead(time, arp[(beat/2) % 4]);
        } 
        
        else if (type === 'hurry') {
            // 【焦り：緊急】
            // 高速ドラム
            if (bar16 % 2 === 0) this.playKick(time);
            if (bar16 % 2 !== 0) this.playNoise(time); // ハイハット

            // 不安を煽るベース (半音階)
            const pNotes = [110, 116, 110, 103]; // A -> Bb -> A -> G#
            if (bar16 % 4 === 0) this.playBass(time, pNotes[Math.floor(bar16/4)]);

            // 警告音シーケンス
            if (bar16 % 2 === 0) {
                this.playLead(time, (beat % 8 === 0) ? 880 : 830, 'sawtooth');
            }
        }
    },

    // --- 楽器定義 ---
    // パッド（持続音）
    playPad: function(time, freqs, dur) {
        const gain = this.ctx.createGain();
        gain.connect(this.ctx.destination);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.1, time + 1); // ふわっと入る
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        freqs.forEach(f => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = f;
            osc.connect(gain);
            osc.start(time);
            osc.stop(time + dur);
            this.bgmNodes.push(osc);
        });
    },
    // キックドラム
    playKick: function(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.5);
    },
    // ベース
    playBass: function(time, freq) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        
        // フィルターで丸くする
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.3);
    },
    // コード（短音）
    playChord: function(time, freqs, dur) {
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        gain.connect(this.ctx.destination);
        freqs.forEach(f => {
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = f;
            osc.connect(gain);
            osc.start(time);
            osc.stop(time + dur);
        });
    },
    // リード（メロディ）
    playLead: function(time, freq, type='sine') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.2);
    },
    // ベル（キラキラ）
    playBell: function(time, freq) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        // 倍音成分
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2.5; // 金属的な響き

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.1, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);
        
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc2.start(time);
        osc.stop(time + 1.5);
        osc2.stop(time + 1.5);
    },
    // ノイズ（ハイハット的）
    playNoise: function(time) {
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        
        // ハイパスフィルター
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;

        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(time);
    },

    // --- SE (既存) ---
    playKey: function() { this.playTone(800, 'square', 0.05, 0.03); },
    playNext: function() { this.playTone(1200, 'sine', 0.1, 0.1); setTimeout(() => this.playTone(1800, 'sine', 0.2, 0.1), 100); },
    playConquer: function() { this.playTone(150, 'sawtooth', 0.4, 0.2); this.playTone(100, 'square', 0.4, 0.2); },
    playWin: function() { 
        this.stopBGM(); 
        [440, 554, 659, 880, 1108, 1318].forEach((f, i) => setTimeout(() => this.playTone(f, 'triangle', 0.6, 0.4), i * 150)); 
    },
    playOver: function() { 
        this.stopBGM(); 
        this.playTone(100, 'sawtooth', 1.0, 0.3); setTimeout(() => this.playTone(80, 'sawtooth', 1.5, 0.3), 300); 
    },
    playTone: function(freq, type, duration, vol = 0.1) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
};