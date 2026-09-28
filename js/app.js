/* 楊梅高中紅土藝術空間 — 前端主程式（純原生 JavaScript，可直接以 file:// 開啟） */
(function () {
  'use strict';

  // ================= 資料 =================
  const RAW = (window.HONGTU && window.HONGTU.exhibitions) || [];
  const EX = RAW.slice().sort((a, b) => a.code.localeCompare(b.code));
  const TEXT = window.HONGTU_TEXT || {};
  const BY = Object.fromEntries(EX.map(e => [e.code, e]));
  const YEARS = [...new Set(EX.map(e => e.roc))].sort((a, b) => a - b);
  const YC = ['#9466b4', '#e0192a', '#f4b43c', '#1fa39c', '#3d92da', '#ef6a9a', '#c8553d', '#6bb349'];
  const yearColor = y => YC[YEARS.indexOf(y) % YC.length];
  const CAT = {
    '個展': ['🎨', '#e0192a'], '聯展': ['🤝', '#9466b4'], '班級展': ['🏫', '#1fa39c'], '校友展': ['🎓', '#3d92da'],
    '學生成果': ['🌱', '#6bb349'], '攝影展': ['📷', '#e39b1c'], '講座／特展': ['✨', '#c8553d'], '主題展': ['🖌️', '#ef6a9a'],
  };
  const catInfo = c => CAT[c] || ['🖼️', '#9466b4'];
  const CATS = Object.keys(CAT).filter(c => EX.some(e => e.category === c));
  const KIND = { poster: '海報', 'invite-front': '邀請卡正面', 'invite-back': '邀請卡背面', 'card-front': '小卡正面', 'card-back': '小卡背面' };
  const GROUP = { poster: '海報', invite: '邀請卡', card: '小卡' };
  const grp = k => k === 'poster' ? 'poster' : k.split('-')[0];
  const N_IMG = EX.reduce((s, e) => s + e.items.length, 0);
  const ARTISTS = new Set(EX.flatMap(e => e.artist ? e.artist.split('、') : []));

  const thumb = (e, id) => `img/thumb/${e.code}/${id}.webp`;
  const web = (e, id) => `img/web/${e.code}/${id}.webp`;
  const orig = (e, it) => `../紅土藝術空間/${encodeURIComponent(e.dir)}/${encodeURIComponent(it.file)}`;
  const cover = e => thumb(e, e.cover);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const periodLabel = e => `民國 ${e.roc} 年 第 ${e.seq} 檔`;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.random() * a.length | 0];

  // ================= 本機儲存 =================
  const store = {
    get(k, d) { try { const v = localStorage.getItem('hongtu.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('hongtu.' + k, JSON.stringify(v)); } catch (e) { } },
  };
  const opt = Object.assign({ fs: 1, sfx: true, music: false, petals: true, tilt: true, vol: 0.6 }, store.get('opt', {}));
  let favs = new Set(store.get('fav', []));
  let seen = store.get('seen', {});
  let stats = Object.assign({ searches: 0, memory: 0, quizBest: 0, puzzle: 0, tour: 0, flips: 0 }, store.get('stats', {}));
  let badgesGot = new Set(store.get('badges', []));
  const saveOpt = () => store.set('opt', opt);
  const saveStats = () => { store.set('stats', stats); checkBadges(); };

  // ================= 共用元件 =================
  const app = $('#app');
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600); }

  function kindsBadges(e) {
    const g = new Set(e.items.map(i => grp(i.kind)));
    return `<span class="kinds">${g.has('poster') ? '<span class="k-poster">海報</span>' : ''}${g.has('invite') ? '<span class="k-invite">邀請卡</span>' : ''}${g.has('card') ? '<span class="k-card">小卡</span>' : ''}</span>`;
  }
  function exCard(e, i = 0) {
    const [ic] = catInfo(e.category);
    return `<a class="ex-card" href="#/ex/${e.code}" style="--c:${e.color};--i:${i}">
      <div class="thumb"><img loading="lazy" src="${cover(e)}" alt="${esc(e.title)}"></div>
      <span class="code">${e.code}</span>
      ${favs.has(e.code) ? '<span class="fav-dot">💖</span>' : ''}
      ${seen[e.code] ? '<span class="seen">👁 看過</span>' : ''}
      <div class="body"><h3>${esc(e.title)}</h3>
        <div class="meta"><span>${ic} ${esc(e.category)}</span><span>民國 ${e.roc}</span>${kindsBadges(e)}</div></div></a>`;
  }
  function bindTilt(root) {
    if (!opt.tilt || matchMedia('(hover: none)').matches) return;
    $$('.ex-card', root).forEach(c => {
      c.addEventListener('mousemove', ev => {
        const r = c.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - .5, y = (ev.clientY - r.top) / r.height - .5;
        c.style.transform = `perspective(700px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateY(-4px)`;
      });
      c.addEventListener('mouseleave', () => { c.style.transform = ''; });
      c.addEventListener('mouseenter', () => SFX.play('hover'));
    });
  }
  function confetti(n = 70) {
    const cols = ['#e0192a', '#9466b4', '#f4b43c', '#1fa39c', '#3d92da', '#ef6a9a'];
    for (let i = 0; i < n; i++) {
      const d = document.createElement('i');
      d.className = 'confetti';
      d.style.cssText = `left:${Math.random() * 100}vw;background:${pick(cols)};animation-duration:${2 + Math.random() * 2}s;animation-delay:${Math.random() * .5}s;border-radius:${Math.random() < .5 ? '50%' : '2px'}`;
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 5000);
    }
  }
  function countUp(el) {
    const to = +el.dataset.to, t0 = performance.now(), dur = 1200;
    const f = t => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }

  // ================= 首頁 =================
  function viewHome() {
    const latest = EX[EX.length - 1];
    const ring = EX.slice(-12).reverse();
    const cw = innerWidth < 980 ? 120 : 150;
    const R = Math.round(ring.length * cw / (2 * Math.PI) * 1.12);
    const perYear = YEARS.map(y => [y, EX.filter(e => e.roc === y).length]);
    const max = Math.max(...perYear.map(p => p[1]));
    const recent = Object.keys(seen).filter(c => BY[c]).slice(-6).reverse();
    app.innerHTML = `<div class="view">
    <section class="hero">
      <div>
        <div class="hero-logos"><img src="assets/badge.png" alt="楊梅高中校徽"><img src="assets/logo.svg" alt="紅土藝術空間 Logo"></div>
        <h1><span class="s1">國立楊梅高級中學</span><span class="s2">紅土藝術空間</span></h1>
        <svg class="brush" viewBox="0 0 420 26" aria-hidden="true"><path d="M4 16 C 80 4, 160 24, 240 12 S 380 8, 416 14" stroke="url(#bg1)" stroke-width="8" fill="none" stroke-linecap="round"/>
          <defs><linearGradient id="bg1"><stop offset="0" stop-color="#c8553d"/><stop offset=".5" stop-color="#e0192a"/><stop offset="1" stop-color="#9466b4"/></linearGradient></defs></svg>
        <p class="lead">梅岡紅土，孕育藝術的沃土。自民國 97 年落成至今，這裡展出校內外藝術家、校友與學生的精彩創作。
        在這裡翻閱歷屆畫展的<b>海報、邀請卡與小卡</b>，一起走進梅岡的藝術時光。</p>
        <div class="hero-actions">
          <a class="btn" href="#/browse">🖼️ 開始瀏覽展覽</a>
          <a class="btn gold" href="#/tour">🎞️ 導覽放映</a>
          <button class="btn teal" id="luckyBtn">🎲 隨機看一展</button>
        </div>
        <div class="stats">
          <div class="stat" style="--c:#e0192a"><b data-to="${EX.length}">0</b><span>期展覽</span></div>
          <div class="stat" style="--c:#9466b4"><b data-to="${N_IMG}">0</b><span>張典藏圖片</span></div>
          <div class="stat" style="--c:#1fa39c"><b data-to="${YEARS.length}">0</b><span>個展出年度</span></div>
          <div class="stat" style="--c:#f4b43c"><b data-to="${new Date().getFullYear() - 1911 - 97}">0</b><span>年藝術耕耘</span></div>
        </div>
      </div>
      <div class="ring-wrap" aria-label="最新展覽旋轉畫廊"><div class="ring">
        ${ring.map((e, i) => `<a href="#/ex/${e.code}" title="${esc(e.code + ' ' + e.title)}" style="transform:rotateY(${i * 360 / ring.length}deg) translateZ(${R}px)"><img src="${cover(e)}" alt="${esc(e.title)}"></a>`).join('')}
      </div></div>
    </section>

    <div class="home-grid" style="margin-top:28px">
      <section class="card featured" style="--c:${latest.color}">
        <img src="${web(latest, latest.cover)}" alt="${esc(latest.title)}" data-lb="${latest.code}|${latest.cover}">
        <div>
          <span class="ribbon">★ 最新一期</span>
          <h3>${esc(latest.title)}</h3>
          <p class="muted">${latest.code}｜${periodLabel(latest)}${latest.period ? '｜展期 ' + esc(latest.period) : ''}</p>
          <p>${catInfo(latest.category)[0]} ${esc(latest.category)}　${latest.artist ? '🧑‍🎨 ' + esc(latest.artist) : ''}</p>
          <p>${kindsBadges(latest)}　共 ${latest.items.length} 張圖片</p>
          <a class="btn" href="#/ex/${latest.code}">走進展覽 →</a>
        </div>
      </section>
      <section class="card gacha">
        <h3>🎁 今天看哪一展？</h3>
        <p class="muted" style="margin:0">按下按鈕，讓紅土幫你抽一檔展覽！</p>
        <div class="gacha-window" id="gWin"><img src="${cover(pick(EX))}" alt="" id="gImg"></div>
        <div class="gacha-name" id="gName">　</div>
        <button class="btn gold" id="gBtn">🎰 抽一張</button>
        <a class="btn ghost" id="gGo" hidden>前往 →</a>
      </section>
    </div>

    <section class="card chart-card">
      <h2 class="section-title" style="margin:0"><span class="bar"></span>歷年展覽數量<small>點選長條可查看該年度展覽</small></h2>
      <div class="bars">${perYear.map(([y, n], i) => `<a class="b" href="#/browse?y=${y}" title="民國 ${y} 年：${n} 期"><i data-n="${n}" style="height:${n / max * 100}%;--c:${yearColor(y)};animation-delay:${i * 50}ms"></i><span>${y}</span></a>`).join('')}</div>
    </section>

    <h2 class="section-title"><span class="bar"></span>依展覽類型探索</h2>
    <div class="cat-row">${CATS.map(c => { const [ic, col] = catInfo(c); return `<a class="cat-tile" href="#/browse?c=${encodeURIComponent(c)}" style="--c:${col}"><b>${esc(c)}</b>${EX.filter(e => e.category === c).length} 期<span class="big">${ic}</span></a>`; }).join('')}</div>

    ${recent.length ? `<h2 class="section-title"><span class="bar"></span>最近看過<small><a href="#/fav">我的足跡 →</a></small></h2><div class="grid">${recent.map((c, i) => exCard(BY[c], i)).join('')}</div>` : ''}

    <h2 class="section-title"><span class="bar"></span>近期展覽<small><a href="#/browse">看全部 ${EX.length} 期 →</a></small></h2>
    <div class="grid" id="recentGrid">${EX.slice(-8).reverse().map((e, i) => exCard(e, i)).join('')}</div>
    </div>`;
    $$('.stat b').forEach(countUp);
    bindTilt(app);
    $('#luckyBtn').onclick = ev => { Petals.bloom(ev.clientX, ev.clientY); SFX.play('pop'); location.hash = '#/ex/' + pick(EX).code; };
    let spinning = false;
    $('#gBtn').onclick = () => {
      if (spinning) return; spinning = true;
      const win = $('#gWin'), img = $('#gImg'), name = $('#gName'), go = $('#gGo');
      go.hidden = true; win.classList.add('spin');
      let n = 0; const total = 18 + (Math.random() * 6 | 0);
      const step = () => {
        const e = pick(EX); img.src = cover(e); name.textContent = e.title; SFX.play('tick'); n++;
        if (n < total) setTimeout(step, 50 + n * n * .6);
        else {
          win.classList.remove('spin'); spinning = false; SFX.play('success');
          const r = img.getBoundingClientRect(); Petals.bloom(r.left + r.width / 2, r.top + r.height / 2, 24);
          name.innerHTML = `🎉 ${e.code}　${esc(e.title)}`; go.href = '#/ex/' + e.code; go.hidden = false;
        }
      };
      step();
    };
  }

  // ================= 瀏覽 =================
  function viewBrowse(params) {
    const st = { q: params.get('q') || '', y: params.get('y') || '', c: params.get('c') || '', k: params.get('k') || '', s: params.get('s') || 'new', v: params.get('v') || store.get('view', 'grid') };
    app.innerHTML = `<div class="view">
      <h1 class="section-title" style="margin-top:6px"><span class="bar"></span>展覽瀏覽</h1>
      <div class="card filters">
        <div class="filter-row">
          <input class="input" type="search" id="fQ" placeholder="🔎 輸入展名、藝術家或期別代碼（例：個展、校友、11501）" value="${esc(st.q)}">
          <select class="input" id="fY" aria-label="年度"><option value="">全部年度</option>${YEARS.slice().reverse().map(y => `<option value="${y}" ${st.y == y ? 'selected' : ''}>民國 ${y} 年（${y + 1911}）</option>`).join('')}</select>
          <select class="input" id="fS" aria-label="排序">
            <option value="new">由新到舊</option><option value="old">由舊到新</option><option value="title">依展名筆畫</option><option value="many">圖片數多→少</option>
          </select>
          <button class="chip" id="fV" title="切換顯示方式">${st.v === 'grid' ? '☰ 清單' : '▦ 格狀'}</button>
        </div>
        <div class="filter-row"><label>類型</label>
          <button class="chip ${!st.c ? 'on' : ''}" data-c="">全部</button>
          ${CATS.map(c => { const [ic, col] = catInfo(c); return `<button class="chip ${st.c === c ? 'on' : ''}" data-c="${esc(c)}" style="--c:${col}">${ic} ${esc(c)}</button>`; }).join('')}
        </div>
        <div class="filter-row"><label>文宣品</label>
          <button class="chip ${!st.k ? 'on' : ''}" data-k="">不限</button>
          <button class="chip ${st.k === 'poster' ? 'on' : ''}" data-k="poster" style="--c:var(--plum)">📜 有海報</button>
          <button class="chip ${st.k === 'invite' ? 'on' : ''}" data-k="invite" style="--c:var(--purple)">💌 有邀請卡</button>
          <button class="chip ${st.k === 'card' ? 'on' : ''}" data-k="card" style="--c:var(--teal)">🃏 有小卡</button>
          <span class="result-count" id="fCount"></span>
        </div>
      </div>
      <div class="grid" id="bGrid"></div>
    </div>`;
    $('#fS').value = st.s;
    const render = () => {
      const q = norm(st.q);
      let list = EX.filter(e =>
        (!st.y || e.roc == st.y) && (!st.c || e.category === st.c) &&
        (!st.k || e.items.some(i => grp(i.kind) === st.k)) &&
        (!q || q.split(' ').every(t => norm(`${e.code} ${e.title} ${e.artist} ${e.category} 民國${e.roc} ${e.year}`).includes(t))));
      if (st.s === 'new') list.reverse();
      if (st.s === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant-TW-u-co-stroke'));
      if (st.s === 'many') list.sort((a, b) => b.items.length - a.items.length);
      const g = $('#bGrid');
      g.className = 'grid' + (st.v === 'list' ? ' list' : '');
      g.innerHTML = list.length ? list.map((e, i) => exCard(e, Math.min(i, 20))).join('') : `<div class="empty"><span class="big">🎨</span>找不到符合條件的展覽，換個條件試試看！<br><a href="#/search?q=${encodeURIComponent(st.q)}">改用全文檢索（含海報文字）→</a></div>`;
      $('#fCount').textContent = `共 ${list.length} 期`;
      bindTilt(g);
      const p = new URLSearchParams(); Object.entries(st).forEach(([k, v]) => { if (v && !(k === 's' && v === 'new') && k !== 'v') p.set(k, v); });
      history.replaceState(null, '', '#/browse' + (p.toString() ? '?' + p : ''));
    };
    let t;
    $('#fQ').oninput = ev => { clearTimeout(t); t = setTimeout(() => { st.q = ev.target.value.trim(); render(); }, 200); };
    $('#fY').onchange = ev => { st.y = ev.target.value; SFX.play('click'); render(); };
    $('#fS').onchange = ev => { st.s = ev.target.value; SFX.play('click'); render(); };
    $('#fV').onclick = ev => { st.v = st.v === 'grid' ? 'list' : 'grid'; store.set('view', st.v); ev.target.textContent = st.v === 'grid' ? '☰ 清單' : '▦ 格狀'; render(); };
    $$('[data-c]').forEach(b => b.onclick = () => { st.c = b.dataset.c; $$('[data-c]').forEach(x => x.classList.toggle('on', x === b)); render(); });
    $$('[data-k]').forEach(b => b.onclick = () => { st.k = b.dataset.k; $$('[data-k]').forEach(x => x.classList.toggle('on', x === b)); render(); });
    render();
  }

  // ================= 展覽頁 =================
  function viewEx(code, params) {
    const e = BY[code];
    if (!e) { app.innerHTML = `<div class="view empty"><span class="big">🧭</span>找不到期別 ${esc(code)}。<br><a href="#/browse">回展覽瀏覽</a></div>`; return; }
    seen[code] = (seen[code] || 0) + 1; store.set('seen', seen); checkBadges();
    const idx = EX.indexOf(e), prev = EX[idx - 1], next = EX[idx + 1];
    const [ic] = catInfo(e.category);
    const hl = (params.get('hl') || '').trim();
    const byGroup = { poster: [], invite: [], card: [] };
    e.items.forEach(it => byGroup[grp(it.kind)].push(it));
    const pairHTML = (g, list) => {
      const nums = [...new Set(list.map(i => i.n))];
      return nums.map(n => {
        const f = list.find(i => i.n === n && i.kind.endsWith('front')), b = list.find(i => i.n === n && i.kind.endsWith('back'));
        const cap = `${GROUP[g]}${nums.length > 1 ? ' ' + n : ''}`;
        if (f && b) {
          return `<div class="flip" data-flip tabindex="0" role="button" aria-label="${cap}，點擊翻面">
            <div class="flip-inner">
              <div class="face front"><span class="side-label">正面</span><img src="${web(e, f.id)}" alt="${esc(e.title)} ${cap}正面" loading="lazy"></div>
              <div class="face back"><span class="side-label">背面</span><img src="${web(e, b.id)}" alt="${esc(e.title)} ${cap}背面" loading="lazy"></div>
            </div>
            <div class="flip-bar"><button class="btn small" data-flipbtn>🔄 翻面</button><button class="btn small ghost" data-lb="${e.code}|${f.id}">🔍 放大正面</button><button class="btn small ghost" data-lb="${e.code}|${b.id}">🔍 放大背面</button></div>
            <figcaption style="text-align:center;font-weight:700;margin-top:4px">${cap}</figcaption></div>`;
        }
        return [f, b].filter(Boolean).map(it => shot(e, it)).join('');
      }).join('');
    };
    const shot = (e, it) => `<figure class="shot" data-lb="${e.code}|${it.id}" style="margin:0"><img src="${web(e, it.id)}" alt="${esc(e.title)} ${it.label}${it.n}" loading="lazy"><figcaption>${it.label}${it.n > 1 ? ' ' + it.n : ''}</figcaption></figure>`;
    const ocrParts = e.items.map(it => [it, TEXT[e.code + '/' + it.id] || '']).filter(p => p[1].trim());
    const isFav = favs.has(code);
    app.innerHTML = `<div class="view" style="--c:${e.color}">
      <section class="ex-hero" style="--c:${e.color}">
        <div>
          <div class="crumb"><a href="#/">首頁</a> › <a href="#/browse">展覽瀏覽</a> › <a href="#/browse?y=${e.roc}">民國 ${e.roc} 年</a></div>
          <h1>${esc(e.title)}</h1>
          <div class="ex-facts">
            <span>📅 ${periodLabel(e)}（${e.year}）</span>
            ${e.period ? `<span title="${e.periodGuess ? '由海報文字自動辨識，僅供參考' : ''}">🗓️ 展期 ${esc(e.period)}${e.periodGuess ? ' *' : ''}</span>` : ''}
            <span>${ic} ${esc(e.category)}</span>
            ${e.artist ? `<span>🧑‍🎨 ${esc(e.artist)}</span>` : ''}
            <span>🖼️ ${e.items.length} 張</span>
          </div>
          ${e.intro ? `<p style="margin:14px 0 0">${esc(e.intro)}</p>` : ''}
        </div>
        <div class="ex-num">${e.code.slice(0, 3)}<small>第 ${e.seq} 檔・${e.code}</small></div>
      </section>
      <div class="ex-tools">
        <button class="btn ghost fav-btn ${isFav ? 'on' : ''}" id="favBtn">${isFav ? '💖 已收藏' : '🤍 加入收藏'}</button>
        <button class="btn ghost" id="allBtn">🔍 放大檢視全部</button>
        ${(byGroup.invite.length || byGroup.card.length) ? '<button class="btn ghost" id="flipAll">🔄 全部翻面</button>' : ''}
        <a class="btn ghost" href="#/browse?y=${e.roc}">📚 同年度展覽</a>
        <a class="btn ghost" href="#/browse?c=${encodeURIComponent(e.category)}">${ic} 同類型展覽</a>
      </div>
      ${byGroup.poster.length ? `<section class="material" style="--c:var(--plum)"><h2><span class="dot"></span>海報</h2><div class="mat-grid">${byGroup.poster.map(it => shot(e, it)).join('')}</div></section>` : ''}
      ${byGroup.invite.length ? `<section class="material" style="--c:var(--purple)"><h2><span class="dot"></span>邀請卡 <small class="muted" style="font-size:.9rem">點卡片可翻到背面</small></h2><div class="mat-grid">${pairHTML('invite', byGroup.invite)}</div></section>` : ''}
      ${byGroup.card.length ? `<section class="material" style="--c:var(--teal)"><h2><span class="dot"></span>小卡 <small class="muted" style="font-size:.9rem">點卡片可翻到背面</small></h2><div class="mat-grid">${pairHTML('card', byGroup.card)}</div></section>` : ''}
      ${ocrParts.length ? `<details class="card ocr-box" ${hl ? 'open' : ''}><summary>📝 圖片文字（電腦 OCR 自動辨識，可能有錯字）</summary>
        ${ocrParts.map(([it, t]) => `<h4>${it.label}${it.n > 1 ? ' ' + it.n : ''}</h4><pre>${markText(t, hl)}</pre>`).join('')}</details>` : ''}
      <nav class="pager">
        ${prev ? `<a class="card prev" href="#/ex/${prev.code}"><span class="arrow">‹</span><img src="${cover(prev)}" alt=""><span><small class="muted">上一期 ${prev.code}</small><br><b>${esc(prev.title)}</b></span></a>` : '<span></span>'}
        ${next ? `<a class="card next" href="#/ex/${next.code}"><span class="arrow">›</span><img src="${cover(next)}" alt=""><span><small class="muted">下一期 ${next.code}</small><br><b>${esc(next.title)}</b></span></a>` : '<span></span>'}
      </nav>
    </div>`;
    $$('[data-flip]').forEach(f => {
      const flip = () => { f.classList.toggle('flipped'); SFX.play('flip'); stats.flips++; saveStats(); };
      f.addEventListener('click', ev => { if (ev.target.closest('[data-lb]')) return; flip(); });
      f.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); flip(); } });
    });
    $('#flipAll') && ($('#flipAll').onclick = () => { $$('[data-flip]').forEach(f => f.classList.toggle('flipped')); SFX.play('flip'); });
    $('#allBtn').onclick = () => Lightbox.open(e, e.items[0].id);
    $('#favBtn').onclick = ev => {
      const b = ev.currentTarget;
      if (favs.has(code)) { favs.delete(code); b.classList.remove('on'); b.textContent = '🤍 加入收藏'; SFX.play('unlike'); toast('已從收藏移除'); }
      else { favs.add(code); b.classList.add('on'); b.textContent = '💖 已收藏'; SFX.play('like'); Petals.bloom(ev.clientX, ev.clientY, 18); toast('已加入我的收藏 💖'); }
      store.set('fav', [...favs]); checkBadges();
    };
    SFX.play('open');
  }

  // ================= 檢索 =================
  const FW = s => s.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const norm = s => FW(String(s || '')).toLowerCase().replace(/[\s·・,，。、]+/g, ' ').trim();
  const squash = s => FW(String(s || '')).toLowerCase().replace(/[\s·・]+/g, '');
  function markText(text, q) {
    if (!q) return esc(text);
    const terms = q.split(/\s+/).filter(Boolean).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!terms.length) return esc(text);
    const re = new RegExp('(' + terms.join('|') + ')', 'gi');
    return esc(text).replace(re, '<mark>$1</mark>');
  }
  function snippet(text, term) {
    const flat = text.replace(/\s+/g, ' ');
    const i = flat.toLowerCase().indexOf(term.toLowerCase());
    if (i < 0) return '';
    const a = Math.max(0, i - 22), b = Math.min(flat.length, i + term.length + 30);
    return (a > 0 ? '…' : '') + esc(flat.slice(a, i)) + '<mark>' + esc(flat.slice(i, i + term.length)) + '</mark>' + esc(flat.slice(i + term.length, b)) + (b < flat.length ? '…' : '');
  }
  function doSearch(q, useOcr, kind) {
    const terms = norm(q).split(' ').filter(Boolean);
    if (!terms.length) return [];
    const out = [];
    for (const e of EX) {
      const metaTxt = squash(`${e.code} ${e.title} ${e.artist} ${e.category} 民國${e.roc}年 ${e.roc} ${e.year} ${e.period}`);
      const items = e.items.filter(it => !kind || grp(it.kind) === kind);
      if (kind && !items.length) continue;
      const texts = useOcr ? items.map(it => [it, TEXT[e.code + '/' + it.id] || '']) : [];
      let score = 0; const snips = [];
      let ok = true;
      for (const t of terms) {
        const st = t.replace(/\s/g, '');
        let hit = false;
        if (squash(e.title).includes(st)) { score += 10; hit = true; }
        else if (metaTxt.includes(st)) { score += 6; hit = true; }
        for (const [it, tx] of texts) {
          if (squash(tx).includes(st)) {
            score += 2; hit = true;
            if (snips.length < 3) { const s = snippet(tx.replace(/\s+/g, ''), st); if (s) snips.push([it, s]); }
          }
        }
        if (!hit) { ok = false; break; }
      }
      if (ok) out.push({ e, score, snips });
    }
    return out.sort((a, b) => b.score - a.score || b.e.code.localeCompare(a.e.code));
  }
  function viewSearch(params) {
    const q = params.get('q') || '';
    const hist = store.get('hist', []);
    const sugg = ['個展', '聯展', '班展', '校友', '攝影', '水彩', '油畫', '書法', '水墨', '版畫', '開幕', '文教基金會', '115'];
    app.innerHTML = `<div class="view">
      <section class="card search-hero">
        <h1>🔍 紅土全文檢索</h1>
        <p class="muted" style="margin:0">可搜尋展名、藝術家、年度、期別代碼，以及<b>海報與卡片上的文字</b>（電腦辨識）。多個關鍵字以空格分開。</p>
        <form class="big-search" id="sForm"><input type="search" id="sQ" value="${esc(q)}" placeholder="例如：水彩、高國堂、民國105年、開幕茶會" autofocus><button class="btn" type="submit">搜尋</button></form>
        <div class="search-opts">
          <label><input type="checkbox" id="sOcr" checked> 包含圖片文字</label>
          <label>文宣品：<select class="input" id="sKind" style="padding:2px 8px"><option value="">全部</option><option value="poster">海報</option><option value="invite">邀請卡</option><option value="card">小卡</option></select></label>
        </div>
        <div class="suggest">${sugg.map(s => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        ${hist.length ? `<div class="history">最近搜尋：${hist.map(h => `<button data-s="${esc(h)}">${esc(h)}</button>`).join('')} <button id="clrHist">（清除）</button></div>` : ''}
      </section>
      <div id="sInfo" style="margin-top:18px;font-weight:700"></div>
      <div class="results" id="sRes"></div>
    </div>`;
    const run = (record) => {
      const qq = $('#sQ').value.trim();
      const res = doSearch(qq, $('#sOcr').checked, $('#sKind').value);
      history.replaceState(null, '', '#/search' + (qq ? '?q=' + encodeURIComponent(qq) : ''));
      if (!qq) { $('#sInfo').textContent = ''; $('#sRes').innerHTML = ''; return; }
      if (record) {
        const h = [qq, ...store.get('hist', []).filter(x => x !== qq)].slice(0, 8); store.set('hist', h);
        stats.searches++; saveStats();
      }
      $('#sInfo').innerHTML = res.length ? `找到 <span style="color:var(--plum)">${res.length}</span> 期展覽符合「${esc(qq)}」` : '';
      $('#sRes').innerHTML = res.length ? res.map((r, i) => `<a class="card hit" style="--c:${r.e.color};--i:${Math.min(i, 20)}" href="#/ex/${r.e.code}?hl=${encodeURIComponent(qq)}">
        <img src="${cover(r.e)}" alt="" loading="lazy">
        <div><h3>${markText(r.e.title, qq)}</h3>
          <div class="muted" style="font-size:.88rem">${r.e.code}｜${periodLabel(r.e)}｜${catInfo(r.e.category)[0]} ${esc(r.e.category)}${r.e.artist ? '｜' + markText(r.e.artist, qq) : ''}</div>
          <div class="snips">${r.snips.map(([it, s]) => `<div><span class="where">${it.label}</span>${s}</div>`).join('')}</div></div></a>`).join('')
        : `<div class="empty"><span class="big">🔎</span>找不到「${esc(qq)}」，試試較短的關鍵字，或點上方的建議詞。</div>`;
      if (record) SFX.play(res.length ? 'open' : 'wrong');
    };
    $('#sForm').onsubmit = ev => { ev.preventDefault(); run(true); };
    let t; $('#sQ').oninput = () => { clearTimeout(t); t = setTimeout(() => run(false), 250); };
    $('#sOcr').onchange = () => run(false); $('#sKind').onchange = () => run(false);
    $$('[data-s]').forEach(b => b.onclick = () => { $('#sQ').value = b.dataset.s; run(true); });
    $('#clrHist') && ($('#clrHist').onclick = () => { store.set('hist', []); viewSearch(new URLSearchParams('q=' + $('#sQ').value)); });
    if (q) run(false);
  }

  // ================= 時光軸 =================
  function viewTimeline() {
    app.innerHTML = `<div class="view">
      <h1 class="section-title" style="margin-top:6px"><span class="bar"></span>紅土時光軸<small>民國 ${YEARS[0]} – ${YEARS[YEARS.length - 1]} 年</small></h1>
      <div class="year-jump">${YEARS.map(y => `<a class="chip" href="#y${y}" data-y="${y}" style="--c:${yearColor(y)}">${y}</a>`).join('')}</div>
      <div class="timeline">
        <div class="t-year" style="--c:var(--gold)"><div class="node">🎉 97 年 5 月 9 日<small>紅土藝術空間落成啟用</small></div></div>
        ${YEARS.map(y => `<div class="t-year" id="y${y}" style="--c:${yearColor(y)}"><div class="node">民國 ${y} 年<small>${y + 1911}・${EX.filter(e => e.roc === y).length} 期</small></div>
          <div class="t-items">${EX.filter(e => e.roc === y).map(e => `<a class="card t-item" href="#/ex/${e.code}" style="--c:${e.color}"><img src="${cover(e)}" alt="" loading="lazy"><span><small class="muted">${e.code}${e.period ? '｜' + esc(e.period) : ''}</small><b>${esc(e.title)}</b><small>${catInfo(e.category)[0]} ${esc(e.category)}</small></span></a>`).join('')}</div></div>`).join('')}
      </div></div>`;
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .15 });
    $$('.t-item').forEach(el => io.observe(el));
    $$('.year-jump a').forEach(a => a.onclick = ev => { ev.preventDefault(); SFX.play('whoosh'); $('#y' + a.dataset.y).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }

  // ================= 導覽放映 =================
  let tourTimer = null;
  function viewTour() {
    let list = EX.slice(), i = list.length - 1, playing = true, t0 = 0;
    const DUR = 6500;
    app.innerHTML = `<div class="view"><h1 class="section-title" style="margin-top:6px"><span class="bar"></span>導覽放映<small>空白鍵：播放／暫停　←→：切換</small></h1>
      <section class="tour">
        <div class="tour-stage"><div class="bg" id="tBg"></div><img id="tImg" alt=""></div>
        <div class="tour-info">
          <div class="code" id="tCode"></div>
          <h2 id="tTitle"></h2>
          <div id="tMeta"></div>
          <div class="progress"><i id="tProg"></i></div>
          <div class="tour-ctrl">
            <button class="icon-btn" id="tPrev" title="上一展">⏮</button>
            <button class="icon-btn" id="tPlay" title="播放／暫停">⏸</button>
            <button class="icon-btn" id="tNext" title="下一展">⏭</button>
            <button class="icon-btn" id="tShuf" title="隨機順序">🔀</button>
            <a class="btn small gold" id="tGo">走進展覽 →</a>
          </div>
          <p class="muted" style="color:#d9c9e6;font-size:.88rem;margin:0">小提示：打開右上角 ⚙️ 的「背景音樂」，邊聽邊看更有氣氛 🎵</p>
        </div>
      </section></div>`;
    const show = () => {
      const e = list[i];
      const img = $('#tImg'); img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
      img.src = web(e, e.cover); img.alt = e.title;
      $('#tBg').style.backgroundImage = `url("${cover(e)}")`;
      $('#tCode').textContent = e.code;
      $('#tTitle').textContent = e.title;
      $('#tMeta').innerHTML = `<p style="margin:0">📅 ${periodLabel(e)}（${e.year}）</p>${e.period ? `<p style="margin:0">🗓️ 展期 ${esc(e.period)}</p>` : ''}<p style="margin:0">${catInfo(e.category).join(' ').split(' ')[0]} ${esc(e.category)}${e.artist ? '　🧑‍🎨 ' + esc(e.artist) : ''}</p><p style="margin:0">${kindsBadges(e)}</p>`;
      $('#tGo').href = '#/ex/' + e.code;
      t0 = performance.now();
      stats.tour++; saveStats();
    };
    const go = d => { i = (i + d + list.length) % list.length; SFX.play('page'); show(); };
    const tick = () => {
      if (!document.body.contains($('#tProg'))) { cancelAnimationFrame(tourTimer); return; }
      const p = playing ? Math.min(1, (performance.now() - t0) / DUR) : null;
      if (p !== null) { $('#tProg').style.width = p * 100 + '%'; if (p >= 1) go(-1); }
      else t0 = performance.now() - (parseFloat($('#tProg').style.width) || 0) / 100 * DUR;
      tourTimer = requestAnimationFrame(tick);
    };
    $('#tPrev').onclick = () => go(1);
    $('#tNext').onclick = () => go(-1);
    $('#tPlay').onclick = () => { playing = !playing; $('#tPlay').textContent = playing ? '⏸' : '▶️'; SFX.play('click'); };
    $('#tShuf').onclick = () => { list = shuffle(EX); i = 0; toast('已切換為隨機順序 🔀'); SFX.play('whoosh'); show(); };
    tourKeys = ev => {
      if (ev.key === ' ') { ev.preventDefault(); $('#tPlay').click(); }
      if (ev.key === 'ArrowLeft') go(1);
      if (ev.key === 'ArrowRight') go(-1);
    };
    show(); cancelAnimationFrame(tourTimer); tourTimer = requestAnimationFrame(tick);
    SFX.play('gong');
  }
  let tourKeys = null;

  // ================= 互動遊戲 =================
  function viewGame(sub) {
    sub = sub || 'memory';
    app.innerHTML = `<div class="view"><h1 class="section-title" style="margin-top:6px"><span class="bar"></span>互動遊戲<small>邊玩邊認識紅土的展覽</small></h1>
      <div class="game-tabs">
        <a class="chip ${sub === 'memory' ? 'on' : ''}" href="#/game/memory">🃏 翻牌配對</a>
        <a class="chip ${sub === 'quiz' ? 'on' : ''}" href="#/game/quiz" style="--c:var(--plum)">❓ 展覽知識王</a>
        <a class="chip ${sub === 'puzzle' ? 'on' : ''}" href="#/game/puzzle" style="--c:var(--teal)">🧩 海報拼圖</a>
      </div>
      <section class="card game-card" id="game"></section></div>`;
    ({ memory: gameMemory, quiz: gameQuiz, puzzle: gamePuzzle }[sub] || gameMemory)($('#game'));
  }

  function gameMemory(root, pairs = 8) {
    const picks = shuffle(EX).slice(0, pairs);
    const deck = shuffle(picks.flatMap(e => [e, e]));
    const cols = innerWidth < 640 ? 4 : (pairs > 8 ? 6 : 4);
    let open = [], moves = 0, done = 0, t0 = 0, timer;
    root.innerHTML = `<div class="game-hud">
        <span class="hud">⏱ <span id="mT">0</span> 秒</span><span class="hud">👆 <span id="mM">0</span> 步</span><span class="hud">✅ <span id="mD">0</span> / ${pairs}</span>
        <span style="margin-left:auto"></span>
        ${[6, 8, 12].map(n => `<button class="chip ${n === pairs ? 'on' : ''}" data-p="${n}">${{ 6: '簡單', 8: '普通', 12: '困難' }[n]}</button>`).join('')}
      </div>
      <p class="muted" style="margin-top:0">翻開兩張相同展覽的海報就能配對成功！配對後可點「看展」進入該展覽。</p>
      <div class="memory" style="grid-template-columns:repeat(${cols},1fr);max-width:${cols * 125}px">${deck.map((e, i) => `<button class="mcard" data-i="${i}" data-c="${e.code}" aria-label="翻牌"><div class="in"><div class="f"><img src="assets/logo.svg" alt=""></div><div class="b"><img src="${cover(e)}" alt="${esc(e.title)}"></div></div></button>`).join('')}</div>
      <div id="mDone" style="text-align:center;margin-top:18px"></div>`;
    $$('[data-p]', root).forEach(b => b.onclick = () => { clearInterval(timer); gameMemory(root, +b.dataset.p); });
    $$('.mcard', root).forEach(c => c.onclick = () => {
      if (c.classList.contains('open') || c.classList.contains('done') || open.length === 2) return;
      if (!t0) { t0 = Date.now(); timer = setInterval(() => { if (!document.body.contains(root)) return clearInterval(timer); $('#mT').textContent = Math.round((Date.now() - t0) / 1000); }, 500); }
      c.classList.add('open'); SFX.play('flip'); open.push(c);
      if (open.length === 2) {
        moves++; $('#mM').textContent = moves;
        const [a, b] = open;
        if (a.dataset.c === b.dataset.c) {
          setTimeout(() => {
            a.classList.add('done'); b.classList.add('done'); open = []; done++; $('#mD').textContent = done; SFX.play('like');
            const r = b.getBoundingClientRect(); Petals.bloom(r.left + r.width / 2, r.top + r.height / 2, 10);
            if (done === pairs) {
              clearInterval(timer); const sec = Math.round((Date.now() - t0) / 1000);
              SFX.play('success'); confetti(); stats.memory++; saveStats();
              $('#mDone').innerHTML = `<h3>🎉 全部配對完成！用了 ${sec} 秒、${moves} 步</h3><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${picks.map(e => `<a class="chip" href="#/ex/${e.code}">看展：${esc(e.title)}</a>`).join('')}</div><p><button class="btn" id="mAgain">再玩一次</button></p>`;
              $('#mAgain').onclick = () => gameMemory(root, pairs);
            }
          }, 450);
        } else {
          setTimeout(() => { a.classList.remove('open'); b.classList.remove('open'); open = []; SFX.play('unzoom'); }, 900);
        }
      }
    });
  }

  function gameQuiz(root) {
    const TOTAL = 10;
    let n = 0, score = 0, streak = 0;
    const ask = () => {
      if (n >= TOTAL) {
        const best = Math.max(stats.quizBest, score); stats.quizBest = best; saveStats();
        SFX.play(score >= 7 ? 'success' : 'open'); if (score >= 7) confetti();
        root.innerHTML = `<div style="text-align:center"><h2>${score >= 9 ? '🏆 紅土知識王！' : score >= 7 ? '🥇 太厲害了！' : score >= 4 ? '👍 不錯喔！' : '🌱 再接再厲！'}</h2>
          <p style="font-size:1.4rem">答對 <b style="color:var(--plum)">${score}</b> / ${TOTAL} 題　（最佳紀錄 ${best} 題）</p><button class="btn" id="qAgain">再挑戰一次</button> <a class="btn ghost" href="#/browse">去逛展覽複習 →</a></div>`;
        $('#qAgain').onclick = () => gameQuiz(root); return;
      }
      n++;
      const e = pick(EX);
      const type = pick(['year', 'title', 'cat']);
      let q, opts, right;
      if (type === 'year') {
        q = '這張文宣是哪一年（民國）的展覽？'; right = e.roc + ' 年';
        opts = shuffle([e.roc, ...shuffle(YEARS.filter(y => y !== e.roc)).slice(0, 3)]).map(y => y + ' 年');
      } else if (type === 'title') {
        q = '這張文宣屬於哪一檔展覽？'; right = e.title;
        opts = shuffle([e.title, ...shuffle([...new Set(EX.filter(x => x.title !== e.title).map(x => x.title))]).slice(0, 3)]);
      } else {
        q = '這檔展覽屬於哪一種類型？'; right = e.category;
        opts = shuffle([e.category, ...shuffle(CATS.filter(c => c !== e.category)).slice(0, 3)]);
      }
      const it = pick(e.items);
      root.innerHTML = `<div class="game-hud"><span class="hud">第 ${n} / ${TOTAL} 題</span><span class="hud">⭐ ${score} 分</span>${streak >= 2 ? `<span class="hud" style="background:#fff0cf;color:#b07400">🔥 連續答對 ${streak} 題</span>` : ''}</div>
        <div class="quiz"><img class="q-img" src="${web(e, it.id)}" alt="題目圖片">
          <div><h2>${q}</h2><div class="opts">${opts.map(o => `<button class="opt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="qFb" style="margin-top:14px;min-height:3em"></div></div></div>`;
      $$('.opt', root).forEach(b => b.onclick = () => {
        if (root.dataset.lock) return; root.dataset.lock = 1;
        const ok = b.dataset.o === right;
        b.classList.add(ok ? 'right' : 'wrong');
        if (!ok) $$('.opt', root).find(x => x.dataset.o === right).classList.add('right');
        if (ok) { score++; streak++; SFX.play('success'); const r = b.getBoundingClientRect(); Petals.bloom(r.left + r.width / 2, r.top, 12); } else { streak = 0; SFX.play('wrong'); }
        $('#qFb').innerHTML = `${ok ? '✅ 答對了！' : '❌ 答錯了～'} 這是 <a href="#/ex/${e.code}">${e.code}「${esc(e.title)}」</a>（${esc(e.category)}，民國 ${e.roc} 年）<br><button class="btn small" id="qNext" style="margin-top:8px">下一題 →</button>`;
        $('#qNext').onclick = () => { delete root.dataset.lock; ask(); };
      });
    };
    delete root.dataset.lock;
    ask();
  }

  function gamePuzzle(root, size = 3) {
    const e = pick(EX.filter(x => x.items.some(i => i.kind === 'poster')));
    const it = e.items.find(i => i.kind === 'poster');
    const src = web(e, it.id);
    const N = size * size;
    let order = shuffle([...Array(N).keys()]);
    while (order.every((v, i) => v === i)) order = shuffle(order);
    let sel = null, moves = 0;
    root.innerHTML = `<div class="game-hud"><span class="hud">👆 <span id="pM">0</span> 步</span><span style="margin-left:auto"></span>
      ${[3, 4].map(s => `<button class="chip ${s === size ? 'on' : ''}" data-s="${s}">${s}×${s}</button>`).join('')}<button class="chip" id="pNew">🔀 換一張</button><button class="chip" id="pPeek">👀 偷看原圖</button></div>
      <p class="muted" style="margin-top:0">依序點選兩塊拼圖可互換位置，把海報拼回原樣吧！</p>
      <div class="puzzle" id="pz" style="grid-template-columns:repeat(${size},1fr)"></div>
      <div id="pDone" style="text-align:center;margin-top:14px"></div>`;
    const draw = () => {
      $('#pz').innerHTML = order.map((p, i) => {
        const x = p % size, y = p / size | 0;
        return `<button data-i="${i}" class="${sel === i ? 'sel' : ''}" style="background-image:url('${src}');background-size:${size * 100}% ${size * 100}%;background-position:${x / (size - 1) * 100}% ${y / (size - 1) * 100}%" aria-label="拼圖第 ${i + 1} 塊"></button>`;
      }).join('');
      $$('#pz button').forEach(b => b.onclick = () => {
        const i = +b.dataset.i;
        if (sel === null) { sel = i; SFX.play('click'); draw(); return; }
        if (sel !== i) { [order[sel], order[i]] = [order[i], order[sel]]; moves++; $('#pM').textContent = moves; SFX.play('flip'); }
        sel = null; draw();
        if (order.every((v, k) => v === k)) {
          $('#pz').classList.add('solved'); SFX.play('success'); confetti(); stats.puzzle++; saveStats();
          $('#pDone').innerHTML = `<h3>🧩 完成！${moves} 步拼好「${esc(e.title)}」</h3><a class="btn" href="#/ex/${e.code}">看這檔展覽 →</a> <button class="btn ghost" id="pAgain">再來一張</button>`;
          $('#pAgain').onclick = () => gamePuzzle(root, size);
          $$('#pz button').forEach(x => x.onclick = null);
        }
      });
    };
    draw();
    $$('[data-s]', root).forEach(b => b.onclick = () => gamePuzzle(root, +b.dataset.s));
    $('#pNew').onclick = () => gamePuzzle(root, size);
    $('#pPeek').onclick = () => Lightbox.open(e, it.id);
  }

  // ================= 收藏 / 足跡 / 徽章 =================
  const BADGES = [
    ['first', '🌱', '初訪紅土', '看過第 1 檔展覽', () => Object.keys(seen).length >= 1],
    ['ten', '🎨', '小小策展人', '看過 10 檔展覽', () => Object.keys(seen).length >= 10],
    ['thirty', '🏛️', '紅土常客', '看過 30 檔展覽', () => Object.keys(seen).length >= 30],
    ['all', '👑', '全展制霸', `看過全部 ${EX.length} 檔展覽`, () => EX.every(e => seen[e.code])],
    ['fav', '💖', '收藏家', '收藏 5 檔展覽', () => favs.size >= 5],
    ['search', '🔍', '檢索達人', '完成 10 次搜尋', () => stats.searches >= 10],
    ['flip', '🔄', '翻卡高手', '翻面邀請卡／小卡 20 次', () => stats.flips >= 20],
    ['memory', '🃏', '過目不忘', '完成一局翻牌配對', () => stats.memory >= 1],
    ['quiz', '🏆', '紅土知識王', '知識王答對 8 題以上', () => stats.quizBest >= 8],
    ['puzzle', '🧩', '拼圖大師', '完成一幅海報拼圖', () => stats.puzzle >= 1],
    ['tour', '🎞️', '放映室觀眾', '在導覽放映看 20 檔', () => stats.tour >= 20],
    ['year', '🕰️', '穿越時空', '看過 10 個不同年度的展覽', () => new Set(Object.keys(seen).filter(c => BY[c]).map(c => BY[c].roc)).size >= 10],
  ];
  function checkBadges() {
    for (const [id, e, name, , test] of BADGES) {
      if (!badgesGot.has(id) && test()) {
        badgesGot.add(id); store.set('badges', [...badgesGot]);
        setTimeout(() => { toast(`${e} 獲得徽章「${name}」！`); SFX.play('badge'); Petals.bloom(innerWidth / 2, innerHeight - 60, 20); }, 600);
      }
    }
  }
  function viewFav() {
    const list = EX.filter(e => favs.has(e.code)).reverse();
    const seenN = EX.filter(e => seen[e.code]).length;
    app.innerHTML = `<div class="view">
      <h1 class="section-title" style="margin-top:6px"><span class="bar"></span>我的收藏<small>資料只存在這台電腦的瀏覽器中</small></h1>
      ${list.length ? `<div class="grid">${list.map((e, i) => exCard(e, i)).join('')}</div>` : `<div class="card empty"><span class="big">🤍</span>還沒有收藏任何展覽。在展覽頁按「加入收藏」就會出現在這裡！</div>`}
      <h2 class="section-title"><span class="bar"></span>我的看展足跡</h2>
      <div class="card" style="padding:20px 24px">
        <b>已看過 ${seenN} / ${EX.length} 檔展覽（${Math.round(seenN / EX.length * 100)}%）</b>
        <div class="meter"><i style="width:${seenN / EX.length * 100}%"></i></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${EX.map(e => `<a href="#/ex/${e.code}" title="${esc(e.code + ' ' + e.title)}" style="width:22px;height:22px;border-radius:6px;background:${seen[e.code] ? e.color : '#eee4f3'};display:inline-block"></a>`).join('')}</div>
        <p class="muted" style="margin-bottom:0">每個方格代表一檔展覽，有顏色的是你看過的，點方格可前往。</p>
      </div>
      <h2 class="section-title"><span class="bar"></span>成就徽章<small>${badgesGot.size} / ${BADGES.length}</small></h2>
      <div class="badges">${BADGES.map(([id, e, name, desc]) => `<div class="card badge ${badgesGot.has(id) ? 'got' : ''}"><span class="e">${e}</span><b>${name}</b><small>${desc}</small></div>`).join('')}</div>
    </div>`;
    bindTilt(app);
  }

  // ================= 關於 =================
  function viewAbout() {
    const facts = [
      ['📍', '座落', '國立楊梅高級中學 啟明樓四樓', '#9466b4'], ['📐', '坪數', '70 坪', '#e0192a'],
      ['🖼️', '功能', '提供校內外各項藝術創作展示', '#1fa39c'], ['✏️', '空間規劃、設計', '楊松裕（中國科技大學室內設計系教授）', '#3d92da'],
      ['🔨', '施工廠商', '順裕企業工程社', '#c8553d'], ['🎉', '落成啟用', '民國 97 年 5 月 9 日', '#e39b1c'],
    ];
    const sv = (inner) => `<svg viewBox="0 0 120 110" aria-hidden="true">${inner}</svg>`;
    const soil = '<path d="M5 90 Q60 70 115 90 L115 110 L5 110Z" fill="#c8553d"/>';
    app.innerHTML = `<div class="view">
      <h1 class="section-title" style="margin-top:6px"><span class="bar"></span>關於紅土藝術空間</h1>
      <div class="about">
        <div>
          <div class="facts">${facts.map(([e, k, v, c]) => `<div class="card fact" style="--c:${c}"><span class="e">${e}</span><span><b>${k}</b>${v}</span></div>`).join('')}</div>
          <div class="card" style="padding:18px;margin-top:16px;text-align:center">
            <div style="display:flex;justify-content:center;gap:20px;align-items:center"><img src="assets/badge.png" alt="楊梅高中校徽" style="height:110px;width:auto"><img src="assets/logo.svg" alt="紅土藝術空間 Logo" style="height:110px;border-radius:20px"></div>
            <p class="muted" style="margin-bottom:0">網站配色取自校徽的<b style="color:var(--purple)">紫</b>、<b style="color:var(--plum)">梅紅</b>與白，並以「紅土」色點綴。</p>
          </div>
        </div>
        <article class="card essay">
          <h2>「紅土藝術空間」落成誌</h2>
          <p>本校「紅土藝術空間」於民國 97 初即由楊松裕教授展開構思、設計，4 月招標後隨即動工，並於 5 月初告竣，5 月 9 日舉辦盛大之落成揭碑典禮。</p>
          <p>「紅土」一辭之命名發想，意在緬懷前達先賢華路藍縷的建校精神（命名者：本校邱逸華老師）。梅岡建校初期，高山頂上是一片貧瘠的紅土，在已故史校長振鼎的號召下，師生們從家中或他處移來肥沃的「客土」耘填，才能造就梅岡今日的蓊鬱宜人。沒有岡上「紅土」為基礎，如何造就這一片豐腴的沃土，培養一代又一代的梅岡菁莪，在各個領域出類拔萃？藝術的創作更需要土壤，才能生根、發芽、開花與茁壯。</p>
          <p>在蘇校長景進的多方請益後，選定了「藝術空間」作為此一藝術展示區的專名，期待它的功能是多元且充滿彈性的，它的價值是兼具現實感與歷史性的。「紅土藝術空間」之名，便是在這樣的感性基礎下產生的。</p>
          <p>同時，在蘇校長景進的盛情下，有幸能邀請知名書法家張穆希先生為「紅土藝術空間」題字，讓此一藝術之門充滿樸雅之妍。張穆希先生特別採清代冬心先生極具樸厚個性與金石趣味之「漆書」題字，展現了凝重與飄逸之美。</p>
          <p>民國 97 年 5 月 9 日落成啟用之後，首度展出的將是配合楊梅高中校慶六十週年之「校友及師長藝術創作美展」──這是梅岡藝術薪傳的勝舉，並將成為梅岡校史上重要的里程碑；未來，也將作為更多藝術展示的舞台。「紅土藝術空間」的設置，除了是校園人文藝術理想的落實，與眾多師生殷切期盼的實踐外，也將裨益楊梅鄉土藝術文化的推動，成為校園與地方文化精神的重要資源。</p>
          <p class="sign">2008/05/09 誌於梅岡</p>
        </article>
      </div>
      <h2 class="section-title"><span class="bar"></span>「紅土」的故事<small>點圖卡聽聽看</small></h2>
      <div class="story">
        <div class="card step" data-sfx="whoosh">${sv(soil + '<circle cx="30" cy="30" r="14" fill="#f4b43c"/><path d="M60 40 l6 -10 l6 10z M80 50 l4 -8 l4 8z" fill="#86779a"/>')}<b>① 貧瘠紅土</b><p class="muted" style="margin:0">建校初期，岡上是一片紅土</p></div>
        <div class="card step" data-sfx="page">${sv(soil + '<path d="M40 60 l14 0 l-4 18 l-6 0z" fill="#6a3f8e"/><path d="M70 50 q10 -20 20 0 q-10 8 -20 0" fill="#8a5a3c"/><circle cx="52" cy="84" r="6" fill="#5a3a2a"/><circle cx="70" cy="86" r="5" fill="#5a3a2a"/>')}<b>② 客土耘填</b><p class="muted" style="margin:0">師生移來沃土，一鏟一鏟耕耘</p></div>
        <div class="card step" data-sfx="pop">${sv(soil + '<path d="M60 88 C60 70 60 60 60 50" stroke="#6bb349" stroke-width="5" fill="none"/><path d="M60 62 q-20 -6 -22 -22 q18 2 22 22z M60 56 q18 -4 22 -20 q-18 0 -22 20z" fill="#6bb349"/>')}<b>③ 生根發芽</b><p class="muted" style="margin:0">藝術需要土壤，才能萌芽</p></div>
        <div class="card step" data-sfx="success">${sv(soil + '<path d="M60 88 L60 44" stroke="#6bb349" stroke-width="5"/><g transform="translate(60 36)">' + [0, 72, 144, 216, 288].map(a => `<ellipse rx="9" ry="13" cy="-12" fill="#e0192a" transform="rotate(${a})"/>`).join('') + '<circle r="6" fill="#f4b43c"/></g>')}<b>④ 開花茁壯</b><p class="muted" style="margin:0">一代又一代的梅岡菁莪綻放</p></div>
      </div>
      <section class="card howto">
        <h2>🛠️ 如何新增期別？（給網站管理者）</h2>
        <ol>
          <li>在「紅土藝術空間」資料夾中新增資料夾，命名為 <code>期別代碼(展覽名稱)</code>，例如 <code>11502(某某個展)</code>；期別代碼前三碼為民國年、後兩碼為當年序號。</li>
          <li>圖片依規則命名後放入：<code>11502(某某個展)海報1.JPG</code>、<code>…邀請卡正面1.JPG</code>、<code>…邀請卡背面1.JPG</code>、<code>…小卡正面1.JPG</code>、<code>…小卡背面1.JPG</code>（流水號可為 1、2、3…）。</li>
          <li>雙擊網站資料夾中的 <code>更新網站.bat</code>，程式只會處理新增或更動的圖片，並自動辨識圖片文字供檢索。</li>
          <li>（選用）編輯 <code>data/meta.json</code> 可手動補充或修正展名、藝術家、展期、簡介與分類。</li>
        </ol>
        <p class="muted" style="margin:0">資料最後更新：${esc((window.HONGTU || {}).updated || '')}</p>
      </section>
    </div>`;
    $$('.story .step').forEach(s => s.onclick = ev => { SFX.play(s.dataset.sfx); Petals.bloom(ev.clientX, ev.clientY, 10); s.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06) rotate(-1deg)' }, { transform: 'scale(1)' }], { duration: 400 }); });
  }

  // ================= 燈箱 =================
  const Lightbox = (() => {
    const lb = $('#lightbox'), img = $('#lbImg'), stage = $('#lbStage');
    let ex, list, i, z = 1, x = 0, y = 0;
    const apply = () => { img.style.transform = `translate(${x}px, ${y}px) scale(${z})`; };
    const pairOf = it => {
      if (it.kind === 'poster') return null;
      const [g, side] = it.kind.split('-');
      return list.find(o => o.kind === `${g}-${side === 'front' ? 'back' : 'front'}` && o.n === it.n);
    };
    function show(k, fx) {
      i = (k + list.length) % list.length;
      const it = list[i];
      z = 1; x = 0; y = 0; apply();
      if (fx) { img.classList.remove('flipping'); void img.offsetWidth; img.classList.add('flipping'); }
      img.src = web(ex, it.id); img.alt = `${ex.title} ${it.label}`;
      $('#lbCaption').innerHTML = `${esc(ex.title)}｜${it.label}${it.n > 1 ? ' ' + it.n : ''}<small>${ex.code}・${periodLabel(ex)}・第 ${i + 1} / ${list.length} 張・滾輪或雙擊可放大</small>`;
      $('#lbOrig').href = orig(ex, it);
      $('#lbFlip').hidden = !pairOf(it);
      $$('#lbStrip img').forEach((t, n) => t.classList.toggle('on', n === i));
      const on = $('#lbStrip img.on'); on && on.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    function open(e, id) {
      ex = e; list = e.items;
      $('#lbStrip').innerHTML = list.map((it, n) => `<img src="${thumb(e, it.id)}" alt="${it.label}" data-n="${n}">`).join('');
      $$('#lbStrip img').forEach(t => t.onclick = () => { SFX.play('page'); show(+t.dataset.n); });
      lb.hidden = false; document.body.style.overflow = 'hidden';
      show(Math.max(0, list.findIndex(it => it.id === id)));
      SFX.play('zoom');
    }
    function close() { lb.hidden = true; document.body.style.overflow = ''; SFX.play('unzoom'); }
    const zoom = (f, cx, cy) => {
      const nz = Math.min(6, Math.max(1, z * f));
      if (cx != null) { const r = stage.getBoundingClientRect(); const ox = cx - r.left - r.width / 2, oy = cy - r.top - r.height / 2; x = ox - (ox - x) * nz / z; y = oy - (oy - y) * nz / z; }
      z = nz; if (z === 1) { x = 0; y = 0; } apply();
    };
    $('#lbClose').onclick = close;
    $('#lbPrev').onclick = () => { SFX.play('page'); show(i - 1); };
    $('#lbNext').onclick = () => { SFX.play('page'); show(i + 1); };
    $('#lbZoomIn').onclick = () => { SFX.play('zoom'); zoom(1.5); };
    $('#lbZoomOut').onclick = () => { SFX.play('unzoom'); zoom(1 / 1.5); };
    $('#lbZoomReset').onclick = () => { z = 1; x = 0; y = 0; apply(); };
    $('#lbFlip').onclick = () => { const p = pairOf(list[i]); if (p) { SFX.play('flip'); show(list.indexOf(p), true); stats.flips++; saveStats(); } };
    stage.addEventListener('wheel', ev => { ev.preventDefault(); zoom(ev.deltaY < 0 ? 1.2 : 1 / 1.2, ev.clientX, ev.clientY); }, { passive: false });
    stage.addEventListener('dblclick', ev => { if (z > 1) { z = 1; x = 0; y = 0; apply(); SFX.play('unzoom'); } else { zoom(2.5, ev.clientX, ev.clientY); SFX.play('zoom'); } });
    stage.addEventListener('click', ev => { if (ev.target === stage) close(); });
    // 拖曳與雙指縮放
    const pts = new Map(); let last = null, pinch = null, moved = false;
    stage.addEventListener('pointerdown', ev => { if (ev.target !== img) return; stage.setPointerCapture(ev.pointerId); pts.set(ev.pointerId, [ev.clientX, ev.clientY]); last = [ev.clientX, ev.clientY]; moved = false; stage.classList.add('dragging'); img.style.transition = 'none'; });
    stage.addEventListener('pointermove', ev => {
      if (!pts.has(ev.pointerId)) return;
      pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) zoom(d / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); pinch = d; return;
      }
      if (last) { const dx = ev.clientX - last[0], dy = ev.clientY - last[1]; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; if (z > 1) { x += dx; y += dy; apply(); } last = [ev.clientX, ev.clientY]; }
    });
    const up = ev => {
      if (!pts.has(ev.pointerId)) return;
      const start = last; pts.delete(ev.pointerId); if (pts.size < 2) pinch = null;
      if (!pts.size) { stage.classList.remove('dragging'); img.style.transition = ''; last = null; }
    };
    // 手機左右滑動換圖
    let sx = null;
    stage.addEventListener('touchstart', ev => { sx = ev.touches.length === 1 ? ev.touches[0].clientX : null; }, { passive: true });
    stage.addEventListener('touchend', ev => { if (sx != null && z === 1) { const dx = ev.changedTouches[0].clientX - sx; if (Math.abs(dx) > 60) { SFX.play('page'); show(i + (dx < 0 ? 1 : -1)); } } sx = null; });
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    document.addEventListener('keydown', ev => {
      if (lb.hidden) return;
      const k = ev.key;
      if (k === 'Escape') close();
      else if (k === 'ArrowLeft') $('#lbPrev').click();
      else if (k === 'ArrowRight') $('#lbNext').click();
      else if (k === '+' || k === '=') $('#lbZoomIn').click();
      else if (k === '-') $('#lbZoomOut').click();
      else if (k === '0') $('#lbZoomReset').click();
      else if (k === 'f' || k === 'F') $('#lbFlip').click();
      else return;
      ev.preventDefault(); ev.stopPropagation();
    }, true);
    return { open, close, get isOpen() { return !lb.hidden; } };
  })();

  // 任何帶 data-lb="期別|圖片id" 的元素點擊即開燈箱
  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-lb]');
    if (!t) return;
    ev.preventDefault();
    const [c, id] = t.dataset.lb.split('|');
    if (BY[c]) Lightbox.open(BY[c], id);
  });

  // ================= 路由 =================
  function route() {
    if (Lightbox.isOpen) Lightbox.close();
    cancelAnimationFrame(tourTimer); tourKeys = null;
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const params = new URLSearchParams(qs || '');
    const [v, arg] = path.split('/');
    const view = v || 'home';
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === (view === 'ex' ? 'browse' : view)));
    $('#nav').classList.remove('open');
    const T = { home: '首頁', browse: '展覽瀏覽', timeline: '時光軸', search: '檢索', tour: '導覽放映', game: '互動遊戲', fav: '我的收藏', about: '關於空間' };
    if (view === 'ex' && BY[arg]) document.title = `${BY[arg].title}｜楊梅高中紅土藝術空間`;
    else document.title = (view === 'home' ? '' : (T[view] || '') + '｜') + '楊梅高中紅土藝術空間';
    ({ home: viewHome, browse: () => viewBrowse(params), ex: () => viewEx(arg, params), search: () => viewSearch(params), timeline: viewTimeline,
      tour: viewTour, game: () => viewGame(arg), fav: viewFav, about: viewAbout }[view] || viewHome)();
    if (!/^y\d+/.test(h)) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  window.addEventListener('hashchange', () => { if (/^#y\d+$/.test(location.hash)) return; route(); });
  document.addEventListener('keydown', ev => { if (tourKeys && !Lightbox.isOpen && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) tourKeys(ev); });

  // ================= 全域介面 =================
  const applyOpt = () => {
    document.documentElement.style.setProperty('--fs', opt.fs);
    $$('#fontSeg button').forEach(b => b.classList.toggle('on', +b.dataset.fs === +opt.fs));
    SFX.sfx = opt.sfx; SFX.vol = opt.vol;
    $('#optSfx').checked = opt.sfx; $('#optMusic').checked = opt.music; $('#optPetals').checked = opt.petals; $('#optTilt').checked = opt.tilt; $('#optVol').value = opt.vol;
    $('#btnSound').textContent = opt.sfx ? '🔊' : '🔇';
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce && store.get('opt', null) === null) opt.petals = false;
  applyOpt();
  Petals.set(opt.petals);
  $$('#fontSeg button').forEach(b => b.onclick = () => { opt.fs = +b.dataset.fs; saveOpt(); applyOpt(); SFX.play('click'); });
  $('#optSfx').onchange = ev => { opt.sfx = ev.target.checked; saveOpt(); applyOpt(); SFX.play('click'); };
  $('#optMusic').onchange = ev => { opt.music = ev.target.checked; saveOpt(); SFX.music = opt.music; toast(opt.music ? '🎵 背景音樂已開啟' : '背景音樂已關閉'); };
  $('#optPetals').onchange = ev => { opt.petals = ev.target.checked; saveOpt(); Petals.set(opt.petals); };
  $('#optTilt').onchange = ev => { opt.tilt = ev.target.checked; saveOpt(); };
  $('#optVol').oninput = ev => { opt.vol = +ev.target.value; saveOpt(); applyOpt(); };
  $('#optVol').onchange = () => SFX.play('click');
  $('#btnSound').onclick = () => { opt.sfx = !opt.sfx; saveOpt(); applyOpt(); SFX.play('click'); toast(opt.sfx ? '🔊 音效已開啟' : '🔇 音效已關閉'); };
  $('#btnSettings').onclick = () => { const p = $('#settings'); p.hidden = !p.hidden; SFX.play('pop'); };
  $('#settings [data-close]').onclick = () => { $('#settings').hidden = true; SFX.play('click'); };
  $('#btnMenu').onclick = () => { $('#nav').classList.toggle('open'); SFX.play('click'); };
  $('#btnReset').onclick = () => {
    if (!confirm('確定要清除這台電腦上的瀏覽紀錄、收藏、搜尋紀錄與徽章嗎？')) return;
    ['fav', 'seen', 'stats', 'badges', 'hist'].forEach(k => { try { localStorage.removeItem('hongtu.' + k); } catch (e) { } });
    favs = new Set(); seen = {}; badgesGot = new Set();
    stats = { searches: 0, memory: 0, quizBest: 0, puzzle: 0, tour: 0, flips: 0 };
    toast('已清除'); route();
  };
  $('#quickSearch').onsubmit = ev => { ev.preventDefault(); const q = $('#quickQ').value.trim(); if (q) { stats.searches++; saveStats(); location.hash = '#/search?q=' + encodeURIComponent(q); } };
  document.addEventListener('click', ev => {
    const a = ev.target.closest('a, button, .chip');
    if (!a) return;
    SFX.unlock();
    if (opt.music && !SFX.music) SFX.music = true;
    if (a.matches('.btn')) Petals.bloom(ev.clientX, ev.clientY, 8);
    if (a.matches('a:not([data-lb]), .chip') && !a.closest('.lb-actions')) SFX.play('click');
    if (!ev.target.closest('#settings, #btnSettings')) $('#settings').hidden = true;
  }, true);
  document.addEventListener('keydown', ev => { if (ev.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { ev.preventDefault(); location.hash = '#/search'; } });
  $('#footerStat').textContent = `目前典藏 ${EX.length} 期展覽・${N_IMG} 張圖片（民國 ${YEARS[0]}–${YEARS[YEARS.length - 1]} 年）｜資料更新：${(window.HONGTU || {}).updated || ''}`;

  if (!EX.length) { app.innerHTML = '<div class="empty"><span class="big">📂</span>尚未產生展覽資料，請先執行「更新網站.bat」。</div>'; return; }
  route();
})();
