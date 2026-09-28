/* 梅花花瓣飄落（呼應校徽梅花）— 以 canvas 繪製，不使用任何外部圖片 */
(function () {
  const cv = document.getElementById('petals');
  const g = cv.getContext('2d');
  const COLORS = ['#e0192a', '#ef6a9a', '#9466b4', '#f4b43c', '#f7a1b5', '#c8553d'];
  let W, H, ps = [], on = true, raf = 0, burst = [];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function size() { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function mk(y) {
    return { x: Math.random() * W, y: y ?? -20 - Math.random() * H, r: 5 + Math.random() * 7, vy: .35 + Math.random() * .7, vx: -.2 + Math.random() * .6,
      a: Math.random() * 6.28, va: -.02 + Math.random() * .04, sw: Math.random() * 6.28, c: COLORS[Math.random() * COLORS.length | 0], whole: Math.random() < .3 };
  }
  function flower(p) {
    g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = p.alpha ?? .45; g.fillStyle = p.c;
    if (p.whole) {
      for (let i = 0; i < 5; i++) { g.rotate(1.2566); g.beginPath(); g.ellipse(0, -p.r * .9, p.r * .55, p.r * .75, 0, 0, 6.28); g.fill(); }
      g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(0, 0, p.r * .3, 0, 6.28); g.fill();
    } else {
      g.beginPath(); g.moveTo(0, -p.r); g.quadraticCurveTo(p.r, 0, 0, p.r); g.quadraticCurveTo(-p.r, 0, 0, -p.r); g.fill();
    }
    g.restore();
  }
  function frame() {
    g.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.sw += .02; p.y += p.vy; p.x += p.vx + Math.sin(p.sw) * .4; p.a += p.va;
      if (p.y > H + 20) Object.assign(p, mk(-20));
      flower(p);
    }
    burst = burst.filter(p => p.life > 0);
    for (const p of burst) { p.x += p.vx; p.y += p.vy; p.vy += .12; p.a += p.va; p.life -= 1; p.alpha = Math.min(1, p.life / 30); flower(p); }
    raf = (on || burst.length) ? requestAnimationFrame(frame) : 0;
    if (!on && !burst.length) g.clearRect(0, 0, W, H);
  }
  function count() { return Math.round(Math.min(26, W / 60)); }
  function set(v) {
    on = v;
    ps = on ? Array.from({ length: count() }, () => mk(Math.random() * H)) : [];
    if (!raf) raf = requestAnimationFrame(frame);
  }
  // 點擊綻放效果
  function bloom(x, y, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = 2 + Math.random() * 4;
      burst.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, r: 5 + Math.random() * 6, a: 0, va: .1, c: COLORS[i % COLORS.length], whole: Math.random() < .5, life: 60 });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  addEventListener('resize', () => { size(); if (on) ps = Array.from({ length: count() }, () => mk(Math.random() * H)); });
  size();
  window.Petals = { set, bloom, get on() { return on; } };
})();
