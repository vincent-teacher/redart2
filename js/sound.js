/* 音效：全部以 Web Audio 即時合成，不需要任何外部音檔 */
(function () {
  let ctx = null, master = null, musicGain = null, musicTimer = null;
  const S = { sfx: true, music: false, vol: 0.6 };

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = S.vol; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, t0, dur, { type = 'sine', gain = 0.3, attack = 0.005, dest, slide } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(t0, dur, { gain = 0.2, from = 800, to = 3000, q = 1.2 } = {}) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(master); src.start(t0);
  }

  // 五聲音階（宮商角徵羽）帶東方味
  const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

  const FX = {
    click(t) { tone(880, t, 0.08, { type: 'triangle', gain: 0.18 }); },
    hover(t) { tone(1320, t, 0.04, { gain: 0.05 }); },
    open(t) { [0, 2, 4].forEach((k, i) => tone(PENTA[k + 2], t + i * 0.06, 0.35, { type: 'triangle', gain: 0.16 })); },
    flip(t) { noise(t, 0.28, { gain: 0.35, from: 600, to: 4000 }); tone(520, t + 0.12, 0.12, { type: 'triangle', gain: 0.08, slide: 780 }); },
    whoosh(t) { noise(t, 0.4, { gain: 0.25, from: 300, to: 2400, q: .7 }); },
    page(t) { noise(t, 0.18, { gain: 0.25, from: 2000, to: 800 }); },
    zoom(t) { tone(500, t, 0.12, { type: 'sine', gain: 0.12, slide: 900 }); },
    unzoom(t) { tone(900, t, 0.12, { type: 'sine', gain: 0.12, slide: 500 }); },
    like(t) { tone(660, t, 0.12, { type: 'triangle', gain: 0.2 }); tone(990, t + 0.09, 0.25, { type: 'triangle', gain: 0.2 }); },
    unlike(t) { tone(660, t, 0.12, { type: 'triangle', gain: 0.15, slide: 440 }); },
    success(t) { [0, 2, 4, 7].forEach((k, i) => tone(PENTA[k], t + i * 0.09, 0.5, { type: 'triangle', gain: 0.18 })); tone(PENTA[9], t + 0.4, 0.8, { gain: 0.12 }); },
    wrong(t) { tone(220, t, 0.18, { type: 'square', gain: 0.07 }); tone(180, t + 0.14, 0.26, { type: 'square', gain: 0.07 }); },
    tick(t) { tone(1800, t, 0.03, { type: 'square', gain: 0.04 }); },
    gong(t) { [196, 293.7, 392].forEach((f, i) => tone(f, t, 2.2 - i * .4, { gain: 0.14 / (i + 1), attack: 0.01 })); },
    badge(t) { [4, 5, 7, 9].forEach((k, i) => tone(PENTA[k], t + i * 0.07, 0.4, { type: 'sine', gain: 0.16 })); noise(t + .3, .5, { gain: .08, from: 5000, to: 9000 }); },
    pop(t) { tone(400, t, 0.1, { gain: 0.2, slide: 1200 }); },
  };

  function play(name) {
    if (!S.sfx || !FX[name]) return;
    if (!ensure()) return;
    FX[name](ctx.currentTime + 0.01);
  }

  // 背景音樂：慢速五聲音階隨機旋律 + 和弦長音
  function musicStep() {
    if (!S.music || !ctx) return;
    const t = ctx.currentTime + 0.05;
    const base = [0, 3, 1, 4][Math.floor(t / 8) % 4];
    tone(PENTA[base] / 2, t, 4.5, { gain: 0.08, attack: 0.8, dest: musicGain });
    tone(PENTA[base + 2] / 2, t, 4.5, { gain: 0.05, attack: 1, dest: musicGain });
    for (let i = 0; i < 4; i++) {
      if (Math.random() < 0.7) {
        const n = PENTA[Math.floor(Math.random() * PENTA.length)];
        tone(n, t + i * 0.5 + Math.random() * 0.1, 1.6, { type: 'triangle', gain: 0.06, attack: 0.02, dest: musicGain });
      }
    }
  }
  function setMusic(on) {
    S.music = on;
    clearInterval(musicTimer);
    if (on) { if (!ensure()) return; musicStep(); musicTimer = setInterval(musicStep, 2000); }
  }

  window.SFX = {
    play,
    get sfx() { return S.sfx; }, set sfx(v) { S.sfx = !!v; },
    get music() { return S.music; }, set music(v) { setMusic(!!v); },
    get vol() { return S.vol; }, set vol(v) { S.vol = +v; if (master) master.gain.value = S.vol; },
    unlock: ensure,
  };
})();
