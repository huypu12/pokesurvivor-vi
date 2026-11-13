/* =====================================================================
 * mega_ui.js — Giao diện Mega: Pokédex, Boss, Kho đá, Cài đặt, Patch Notes
 * Thuần DOM overlay (không che vùng chiến đấu khi đóng), có animation.
 * ===================================================================== */
(function () {
  const M = (window.PS_MEGA = window.PS_MEGA || {});

  const CSS = `
  .psm-root{position:fixed;inset:0;z-index:99990;display:none;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    background:rgba(4,6,12,.86);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#eaf0ff}
  .psm-root.on{display:flex;flex-direction:column;animation:psmIn .18s ease-out}
  @keyframes psmIn{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:scale(1)}}
  .psm-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.1);
    background:linear-gradient(180deg,rgba(30,40,70,.9),rgba(12,16,28,.6))}
  .psm-title{font-weight:800;font-size:15px;letter-spacing:.4px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .psm-x{width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);
    color:#fff;font-size:18px;line-height:1;cursor:pointer}
  .psm-x:active{transform:scale(.94)}
  .psm-tabs{display:flex;gap:6px;padding:8px 10px;overflow-x:auto;no-scrollbar}
  .psm-tab{flex:0 0 auto;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.07);
    border:1px solid rgba(255,255,255,.12);font-size:12.5px;font-weight:700;color:#c8d4ee;cursor:pointer;white-space:nowrap}
  .psm-tab.act{background:linear-gradient(135deg,#3b6bff,#8b5cf6);color:#fff;border-color:transparent;box-shadow:0 4px 16px rgba(90,110,255,.4)}
  .psm-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px 10px 30px}
  .psm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:9px}
  .psm-card{position:relative;border-radius:14px;padding:8px 6px 7px;text-align:center;cursor:pointer;
    background:linear-gradient(180deg,rgba(38,48,78,.95),rgba(16,20,34,.95));border:1px solid rgba(255,255,255,.1);
    transition:transform .12s,border-color .12s}
  .psm-card:active{transform:scale(.96)}
  .psm-card.on{border-color:#ffd93d;box-shadow:0 0 0 1px #ffd93d,0 6px 18px rgba(255,217,61,.25)}
  .psm-card.lock{opacity:.55}
  .psm-card img{width:64px;height:64px;object-fit:contain;image-rendering:pixelated;
    filter:drop-shadow(0 4px 6px rgba(0,0,0,.6))}
  .psm-card.lock img{filter:grayscale(1) brightness(.6)}
  .psm-nm{font-size:10.5px;font-weight:700;line-height:1.2;margin-top:2px;min-height:24px;
    display:flex;align-items:center;justify-content:center}
  .psm-bdg{position:absolute;top:5px;right:5px;font-size:8.5px;font-weight:800;padding:2px 5px;border-radius:6px;letter-spacing:.3px}
  .b-lock{background:#5b2333;color:#ffb3c1}
  .b-unl{background:#4a3d0f;color:#ffe08a}
  .b-av{background:#123f2a;color:#7dffb0}
  .b-act{background:#4a2f7a;color:#d9b8ff}
  .psm-row{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:14px;margin-bottom:8px;
    background:linear-gradient(180deg,rgba(38,48,78,.92),rgba(16,20,34,.92));border:1px solid rgba(255,255,255,.1)}
  .psm-row img{width:56px;height:56px;object-fit:contain;image-rendering:pixelated}
  .psm-info{flex:1;min-width:0}
  .psm-info b{font-size:13px}
  .psm-sub{font-size:11px;color:#93a3c4;margin-top:2px}
  .psm-btn{padding:9px 14px;border-radius:11px;border:none;font-weight:800;font-size:12.5px;cursor:pointer;color:#fff;
    background:linear-gradient(135deg,#3b6bff,#8b5cf6)}
  .psm-btn:active{transform:scale(.95)}
  .psm-btn.ghost{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16)}
  .psm-btn:disabled{opacity:.4;filter:grayscale(.6)}
  .psm-sheet{position:fixed;left:0;right:0;bottom:0;z-index:99992;background:linear-gradient(180deg,#1a2035,#0b0e18);
    border-radius:20px 20px 0 0;padding:14px 16px 26px;transform:translateY(100%);transition:transform .22s cubic-bezier(.2,.9,.3,1);
    max-height:82vh;overflow-y:auto;box-shadow:0 -10px 40px rgba(0,0,0,.7)}
  .psm-sheet.on{transform:translateY(0)}
  .psm-hero{display:flex;gap:14px;align-items:center;margin-bottom:12px}
  .psm-hero img{width:96px;height:96px;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 6px 12px rgba(0,0,0,.7))}
  .psm-hero h3{margin:0;font-size:17px}
  .psm-chip{display:inline-block;font-size:10px;font-weight:800;padding:3px 8px;border-radius:8px;margin:3px 4px 0 0;
    background:rgba(255,255,255,.1);color:#cfe0ff}
  .psm-desc{font-size:12.5px;line-height:1.55;color:#b8c6e0;margin:8px 0 12px}
  .psm-opt{display:flex;align-items:center;justify-content:space-between;padding:11px 2px;border-bottom:1px solid rgba(255,255,255,.07);font-size:13px}
  .psm-sw{width:46px;height:26px;border-radius:999px;background:#333c52;position:relative;cursor:pointer;transition:background .15s}
  .psm-sw.on{background:linear-gradient(135deg,#3b6bff,#8b5cf6)}
  .psm-sw i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}
  .psm-sw.on i{left:23px}
  .psm-note{font-size:12px;line-height:1.7;color:#b8c6e0}
  .psm-note h4{color:#fff;margin:14px 0 6px;font-size:13px}
  .psm-note li{margin-bottom:5px}
  .psm-toast{position:fixed;left:50%;bottom:78px;transform:translateX(-50%) translateY(20px);z-index:99995;
    background:rgba(20,26,44,.96);border:1px solid rgba(120,150,255,.4);color:#fff;padding:11px 18px;border-radius:12px;
    font-size:12.5px;font-weight:600;opacity:0;transition:.22s;pointer-events:none;max-width:88vw;text-align:center;
    box-shadow:0 10px 32px rgba(0,0,0,.6)}
  .psm-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
  .psm-fab{position:fixed;right:12px;top:12px;z-index:99980;width:46px;height:46px;border-radius:14px;border:none;
    background:linear-gradient(135deg,#ff3d7f,#8b5cf6);color:#fff;font-size:20px;font-weight:900;cursor:pointer;
    box-shadow:0 6px 20px rgba(160,60,220,.5);display:none;align-items:center;justify-content:center}
  .psm-fab.on{display:flex}
  .psm-fab:active{transform:scale(.93)}
  .psm-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:#ff3d3d;
    font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;padding:0 4px}
  `;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  const PART_LABEL = { ACTIVATION: 'Kích hoạt', CHARGING: 'Nạp năng lượng', TRANSFORMING: 'Biến đổi', BURST: 'Bùng nổ', REVEAL: 'Hiển lộ' };

  const UI = {
    root: null, body: null, tabsEl: null, titleEl: null,
    tab: 'dex',
    filterRegion: 'all',
    selected: null,
    onSave: null,
    props: [],

    init() {
      if (this.root) return;
      const st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);

      const root = el('div', 'psm-root');
      const head = el('div', 'psm-head');
      this.titleEl = el('div', 'psm-title', 'MEGA');
      const x = el('button', 'psm-x', '✕');
      x.onclick = () => this.close();
      head.appendChild(this.titleEl); head.appendChild(x);

      this.tabsEl = el('div', 'psm-tabs');
      const body = el('div', 'psm-body');

      root.appendChild(head); root.appendChild(this.tabsEl); root.appendChild(body);
      document.body.appendChild(root);
      this.root = root; this.body = body;

      const toast = el('div', 'psm-toast');
      document.body.appendChild(toast);
      this.toastEl = toast;

      this.fab = el('button', 'psm-fab', 'M');
      const bd = el('span', 'psm-badge', '');
      this.fab.appendChild(bd);
      this.fabBadge = bd;
      this.fab.onclick = () => this.open();
      document.body.appendChild(this.fab);

      this.buildTabs();
      this.refreshFab();

      window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && this.isOpen()) this.close();
      });
    },

    isOpen() { return this.root && this.root.classList.contains('on'); },

    buildTabs() {
      const tabs = [
        ['dex', 'Pokédex Mega'],
        ['boss', 'Boss'],
        ['inv', 'Kho đá'],
        ['set', 'Cài đặt'],
        ['note', 'Cập nhật'],
      ];
      this.tabsEl.innerHTML = '';
      for (const [k, label] of tabs) {
        const t = el('div', 'psm-tab' + (this.tab === k ? ' act' : ''), label);
        t.onclick = () => { this.tab = k; M.Sound.click(); this.buildTabs(); this.render(); };
        this.tabsEl.appendChild(t);
      }
    },

    open(tab) {
      this.init();
      if (tab) this.tab = tab;
      this.buildTabs();
      this.render();
      this.root.classList.add('on');
      M.Sound.click();
    },

    close() {
      if (this.root) this.root.classList.remove('on');
      this.closeSheet();
    },

    toast(msg, ms) {
      if (!this.toastEl) this.init();
      this.toastEl.textContent = msg;
      this.toastEl.classList.add('on');
      clearTimeout(this._tt);
      this._tt = setTimeout(() => this.toastEl.classList.remove('on'), ms || 2200);
    },

    refreshFab() {
      if (!this.fab || !M.Save) return;
      const pending = M.FORMS.filter((f) => !M.Save.isUnlocked(f.id)).length;
      const ready = M.FORMS.filter((f) => M.Stones.canMega(f, M.Save).ok).length;
      this.fabBadge.textContent = ready ? String(ready) : '';
      this.fabBadge.style.display = ready ? 'flex' : 'none';
    },

    showFab(v) { if (this.fab) this.fab.classList.toggle('on', !!v); },

    /* ---------------------------------------------------------------- */
    render() {
      if (!this.body) return;
      this.closeSheet();
      const t = this.tab;
      this.titleEl.textContent =
        t === 'dex' ? 'MEGA POKÉDEX  ·  ' + M.FORMS.length + ' dạng' :
        t === 'boss' ? 'BOSS BATTLE' :
        t === 'inv' ? 'KHO ĐÁ MEGA' :
        t === 'set' ? 'CÀI ĐẶT MEGA' : 'CÓ GÌ MỚI';
      this.body.innerHTML = '';
      if (t === 'dex') this.renderDex();
      else if (t === 'boss') this.renderBoss();
      else if (t === 'inv') this.renderInv();
      else if (t === 'set') this.renderSet();
      else this.renderNotes();
    },

    _sprite(f) { return 'assets/mega/' + f.id + '/Idle.png'; },

    /** Ảnh tĩnh: cắt khung đầu tiên ra <img> nhỏ để nhẹ và đẹp */
    _icon(f, size) {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = f.form;
      img.src = this._sprite(f);
      img.style.width = (size || 64) + 'px';
      img.style.height = (size || 64) + 'px';
      img.style.objectFit = 'contain';
      img.style.objectPosition = '0 0';
      img.style.clipPath = 'none';
      // chuyển background-position để chỉ hiện frame 0, dòng 0
      img.style.objectFit = 'none';
      img.style.width = (size || 64) + 'px';
      img.style.height = (size || 64) + 'px';
      img.style.transformOrigin = '0 0';
      const meta = M.META && M.META[f.id];
      const cw = meta && meta.a.Idle ? meta.a.Idle.w : 64;
      const ch = meta && meta.a.Idle ? meta.a.Idle.h : 64;
      const k = (size || 64) / cw;
      img.style.transform = 'scale(' + k + ')';
      img.style.clipPath = 'inset(0 ' + (cw * 0) + 'px 0 0)';
      img.style.imageRendering = 'pixelated';
      img.style.marginRight = (-cw * (k - 1)) + 'px';
      img.style.marginBottom = (-ch * (k - 1)) + 'px';
      return img;
    },

    renderDex() {
      const regions = ['all', ...Array.from(new Set(M.FORMS.map((f) => f.region)))];
      const bar = el('div', 'psm-tabs');
      bar.style.padding = '0 0 10px';
      for (const r of regions) {
        const b = el('div', 'psm-tab' + (this.filterRegion === r ? ' act' : ''),
          r === 'all' ? 'Tất cả' : r);
        b.onclick = () => { this.filterRegion = r; M.Sound.click(); this.render(); };
        bar.appendChild(b);
      }
      this.body.appendChild(bar);

      const stats = el('div', 'psm-sub');
      stats.style.margin = '0 2px 10px';
      const unlocked = M.FORMS.filter((f) => M.Save.isUnlocked(f.id)).length;
      stats.textContent = 'Đã mở khoá ' + unlocked + '/' + M.FORMS.length +
        '  ·  Khoá = chưa hạ Boss  ·  chạm vào thẻ để xem chi tiết';
      this.body.appendChild(stats);

      const grid = el('div', 'psm-grid');
      const list = M.FORMS.filter((f) => this.filterRegion === 'all' || f.region === this.filterRegion);
      for (const f of list) {
        const st = M.Stones.statusOf(f, M.Save);
        const card = el('div', 'psm-card' + (st === 'LOCKED' ? ' lock' : '') + (st === 'ACTIVE' ? ' on' : ''));
        const bd = el('div', 'psm-bdg ' + (
          st === 'LOCKED' ? 'b-lock' : st === 'UNLOCKED' ? 'b-unl' : st === 'AVAILABLE' ? 'b-av' : 'b-act'),
          st === 'LOCKED' ? 'KHÓA' : st === 'UNLOCKED' ? 'MỞ' : st === 'AVAILABLE' ? 'SẴN SÀNG' : 'ĐANG MEGA');
        card.appendChild(bd);
        card.appendChild(this._icon(f, 64));
        const nm = el('div', 'psm-nm', f.form.replace('Mega ', 'M-'));
        card.appendChild(nm);
        card.onclick = () => { M.Sound.click(); this.openDetail(f); };
        grid.appendChild(card);
      }
      this.body.appendChild(grid);
    },

    openDetail(f) {
      if (!this.sheet) {
        this.sheet = el('div', 'psm-sheet');
        document.body.appendChild(this.sheet);
      }
      const sh = this.sheet;
      const st = M.Stones.statusOf(f, M.Save);
      const can = M.Stones.canMega(f, M.Save);
      const tier = f.tier || 2;
      sh.innerHTML = '';
      const hero = el('div', 'psm-hero');
      hero.appendChild(this._icon(f, 96));
      const info = el('div');
      const h3 = el('h3', null, f.form);
      info.appendChild(h3);
      const chips = el('div');
      for (const t of f.types) chips.appendChild(el('span', 'psm-chip', M.VFX.style(t).c1 ? t.toUpperCase() : t));
      chips.appendChild(el('span', 'psm-chip', 'Tier ' + tier));
      chips.appendChild(el('span', 'psm-chip', f.kind === 'primal' ? 'PRIMAL' : 'MEGA'));
      if (f.variant) chips.appendChild(el('span', 'psm-chip', 'Dạng ' + f.variant));
      info.appendChild(chips);
      hero.appendChild(info);
      sh.appendChild(hero);

      const desc = el('div', 'psm-desc');
      desc.innerHTML =
        '<b>' + f.pokemon + '</b> · Dex #' + f.dex + '<br>' +
        'Mega Stone: <b>' + (f.stone ? M.Stones.nameOf(f) : 'Dragon Ascent (không cần đá)') + '</b><br>' +
        M.Stones.descOf(f);
      sh.appendChild(desc);

      const stTxt = el('div', 'psm-desc');
      stTxt.innerHTML = 'Trạng thái: <b style="color:' +
        (st === 'LOCKED' ? '#ff8fa3' : st === 'UNLOCKED' ? '#ffe08a' : st === 'AVAILABLE' ? '#7dffb0' : '#d9b8ff') + '">' +
        st + '</b>' + (can.ok ? '' : ' — ' + can.reason);
      sh.appendChild(stTxt);

      const row = el('div', 'psm-row');
      row.style.background = 'none'; row.style.border = 'none'; row.style.padding = '0';

      if (st === 'LOCKED' || st === 'UNLOCKED') {
        const b = el('button', 'psm-btn ghost', '🔒 Chưa mở khoá');
        b.style.flex = '1';
        b.disabled = true;
        row.appendChild(b);
        const hint = el('div', 'psm-desc');
        hint.style.marginTop = '8px';
        hint.innerHTML = 'Vào game, chờ đồng hồ đạt <b>20:00</b>. ' +
          'Một <b>Grieta</b> sẽ mở ra — bước vào đó để đấu boss Mega ' + f.form + '.';
        sh.appendChild(hint);
      }
      if (st === 'AVAILABLE') {
        const b = el('button', 'psm-btn', '✨ MEGA TIẾN HOÁ');
        b.style.flex = '1';
        b.onclick = () => {
          this.closeSheet(); this.close();
          M.Game.requestMega(f);
        };
        row.appendChild(b);
      }
      if (st === 'ACTIVE') {
        const b = el('button', 'psm-btn ghost', '↩ Hoàn nguyên');
        b.style.flex = '1';
        b.onclick = () => { this.closeSheet(); this.close(); M.Game.requestRevert(f.dex); };
        row.appendChild(b);
      }
      const close = el('button', 'psm-btn ghost', 'Đóng');
      close.onclick = () => this.closeSheet();
      row.appendChild(close);
      sh.appendChild(row);

      requestAnimationFrame(() => sh.classList.add('on'));
    },

    closeSheet() {
      if (this.sheet) this.sheet.classList.remove('on');
    },

    afterBoss(r) {
      this.open('boss');
      if (r && r.win) {
        this.toast('🎉 Đã hạ Boss! Mở khoá ' + r.reward.form);
        this.refreshFab();
      } else if (r) {
        this.toast('Thất bại — thử lại nhé');
      }
    },

    renderBoss() {
      const groups = [[4, 'Tier 4 — Huyền thoại'], [3, 'Tier 3 — Cực mạnh'], [2, 'Tier 2 — Mạnh'], [1, 'Tier 1 — Thường']];
      for (const [tier, label] of groups) {
        const list = M.FORMS.filter((f) => (f.tier || 2) === tier);
        if (!list.length) continue;
        const h = el('div', 'psm-sub');
        h.style.margin = '6px 2px 8px';
        h.style.fontWeight = '800';
        h.style.color = '#cfe0ff';
        h.textContent = label + ' (' + list.length + ')';
        this.body.appendChild(h);

        for (const f of list) {
          const done = M.Save.isBossDefeated(f.id);
          const row = el('div', 'psm-row');
          row.appendChild(this._icon(f, 56));
          const info = el('div', 'psm-info');
          info.innerHTML = '<b>' + f.form + '</b>' +
            '<div class="psm-sub">' + (done ? '✅ Đã hạ · đã mở khoá' : 'HP ' + (f.tier === 4 ? 1700 : f.tier === 3 ? 1250 : f.tier === 2 ? 900 : 620) +
              ' · Cần hạ để mở khoá') + '</div>';
          row.appendChild(info);
          const b = el('button', 'psm-btn ghost', done ? 'Đã hạ' : 'Chờ 20:00');
          b.disabled = !done;
          row.appendChild(b);
          this.body.appendChild(row);
        }
      }
    },

    renderInv() {
      const owned = M.FORMS.filter((f) => f.stone && M.Save.hasStone(f.stone));
      const head = el('div', 'psm-sub');
      head.style.margin = '0 2px 10px';
      head.textContent = 'Bạn có ' + owned.length + ' đá. Đá nhận được sau khi hạ Boss tương ứng.';
      this.body.appendChild(head);

      if (!owned.length) {
        const e = el('div', 'psm-desc', 'Chưa có đá nào. Vào tab <b>Boss</b> để chiến và nhận đá đầu tiên.');
        this.body.appendChild(e);
        return;
      }
      for (const f of owned) {
        const row = el('div', 'psm-row');
        row.appendChild(this._icon(f, 56));
        const info = el('div', 'psm-info');
        info.innerHTML = '<b>' + M.Stones.nameOf(f) + '</b>' +
          '<div class="psm-sub">Dành cho ' + f.pokemon + (f.variant ? ' · dạng ' + f.variant : '') + '</div>';
        row.appendChild(info);
        this.body.appendChild(row);
      }
      // phần chưa có
      const miss = M.FORMS.filter((f) => f.stone && !M.Save.hasStone(f.stone));
      if (miss.length) {
        const h = el('div', 'psm-sub');
        h.style.margin = '16px 2px 8px';
        h.style.fontWeight = '800';
        h.textContent = 'Chưa sở hữu (' + miss.length + ')';
        this.body.appendChild(h);
        for (const f of miss) {
          const row = el('div', 'psm-row');
          row.style.opacity = '.5';
          row.appendChild(this._icon(f, 56));
          const info = el('div', 'psm-info');
          info.innerHTML = '<b>' + M.Stones.nameOf(f) + '</b><div class="psm-sub">Khoá — cần hạ ' + f.form + '</div>';
          row.appendChild(info);
          this.body.appendChild(row);
        }
      }
    },

    renderSet() {
      const opts = [
        ['cinematic', 'Hiệu ứng điện ảnh khi Mega'],
        ['camera', 'Camera zoom / pan'],
        ['shake', 'Rung màn hình'],
        ['flash', 'Chớp sáng'],
        ['slowmo', 'Slow motion'],
        ['sound', 'Âm thanh Mega'],
      ];
      for (const [k, label] of opts) {
        const r = el('div', 'psm-opt');
        r.appendChild(el('div', null, label));
        const sw = el('div', 'psm-sw' + (M.Save.opt(k) !== false ? ' on' : ''));
        sw.appendChild(el('i'));
        sw.onclick = () => {
          const v = !(M.Save.opt(k) !== false);
          M.Save.setOpt(k, v);
          sw.classList.toggle('on', v);
          M.Sound.click();
        };
        r.appendChild(sw);
        this.body.appendChild(r);
      }
      const q = el('div', 'psm-opt');
      q.appendChild(el('div', null, 'Chất lượng hiệu ứng'));
      const sel = document.createElement('select');
      sel.style.cssText = 'background:#232b3f;color:#fff;border:1px solid rgba(255,255,255,.2);padding:7px 10px;border-radius:9px;font-size:12px';
      for (const v of ['low', 'medium', 'high', 'ultra']) {
        const o = document.createElement('option');
        o.value = v; o.textContent = v.toUpperCase();
        if (M.Save.opt('quality') === v) o.selected = true;
        sel.appendChild(o);
      }
      sel.onchange = () => { M.Save.setOpt('quality', sel.value); M.VFX.setQuality(sel.value); };
      q.appendChild(sel);
      this.body.appendChild(q);

      const st = el('div', 'psm-desc');
      st.style.marginTop = '18px';
      const s = M.Save.data.stats;
      st.innerHTML = 'Thắng Boss: <b>' + s.wins + '</b> · Thua: <b>' + s.losses + '</b><br>' +
        'Đã mở khoá: <b>' + M.FORMS.filter((f) => M.Save.isUnlocked(f.id)).length + '/' + M.FORMS.length + '</b><br>' +
        'Dạng Mega đã dùng: <b>' + (s.megaCount || 0) + '</b>';
      this.body.appendChild(st);

      const row = el('div', 'psm-row');
      row.style.background = 'none'; row.style.border = 'none'; row.style.padding = '12px 0 0';
      const ex = el('button', 'psm-btn ghost', 'Xuất save');
      ex.onclick = () => {
        const txt = M.Save.exportJSON();
        navigator.clipboard && navigator.clipboard.writeText(txt);
        this.toast('Đã copy save vào clipboard');
      };
      const rs = el('button', 'psm-btn ghost', 'Đặt lại');
      rs.style.marginLeft = '8px';
      rs.onclick = () => {
        if (confirm('Xoá toàn bộ tiến trình Mega? Không hoàn tác được.')) {
          M.Save.reset(); this.refreshFab(); this.render(); this.toast('Đã đặt lại');
        }
      };
      row.appendChild(ex); row.appendChild(rs);
      this.body.appendChild(row);
    },

    renderNotes() {
      const n = el('div', 'psm-note');
      n.innerHTML = `
      <div style="background:rgba(30,70,120,.55);border:1px solid #4aa8ff;border-radius:12px;padding:10px 12px;margin-bottom:12px">
        <b style="color:#8ecdff">⏱ CÁCH ĐÁNH BOSS MEGA</b>
        <div style="font-size:11.5px;color:#cfe6ff;margin-top:5px">
          Vào game, chờ đồng hồ trên HUD đạt <b>20:00</b>. Hệ thống <b>Grieta</b> của game
          sẽ mở cổng dẫn tới boss Mega. Bước vào cổng và hạ boss trong <b>5 phút</b>.
          Hết giờ hoặc bị hạ → về chỗ cũ, máu giữ nguyên.
        </div>
      </div>
      <h4>🎮 BẢN CẬP NHẬT: HỆ THỐNG MEGA EVOLUTION</h4>
      <div style="color:#93a3c4;font-size:11.5px;margin-bottom:10px">v2.0 · Mega Evolution 2D</div>
      <ul>
        <li><b>98 dạng Mega</b> gồm đủ X / Y / Z, Primal Reversion, Floette Eternal Flower.</li>
        <li><b>Sprite 8 hướng + 7 animation</b> cho từng dạng (Idle / Walk / Attack / Shoot / Charge / Hurt / Faint).</li>
        <li><b>Boss trong Grieta có sẵn</b>: đồng hồ HUD đạt 20:00 → cổng mở → vào đấu boss Mega, giới hạn 5 phút.</li>
        <li><b>Mở khoá theo Boss</b>: chưa hạ Boss thì không thể Mega.</li>
        <li><b>Mega Stone</b>: nhận sau khi hạ Boss, dùng sai đá bị từ chối.</li>
        <li><b>Cinematic 5 giai đoạn</b>: Kích hoạt → Nạp năng lượng → Biến đổi → Bùng nổ → Hiển lộ.</li>
        <li><b>Hiệu ứng riêng cho từng loài</b> (Charizard, Rayquaza, Mewtwo, Gengar, Metagross…).</li>
        <li><b>Hạt 2D theo 18 hệ</b>, có cấp chất lượng LOW → ULTRA.</li>
        <li><b>Camera 2D</b>: zoom, pan, shake, flash, slow-mo, tối nền.</li>
        <li><b>Âm thanh tổng hợp</b> riêng cho 7 giai đoạn, cao độ đổi theo hệ.</li>
        <li><b>Lưu tiến trình</b> tự động vào máy — tắt game mở lại vẫn còn.</li>
      </ul>
      <h4>LƯU Ý</h4>
      <ul>
        <li>Mega là biến đổi <b>tạm thời</b>: hết trận tự hoàn nguyên.</li>
        <li>Rayquaza dùng <b>Dragon Ascent</b>, không gán Mega Stone không tồn tại.</li>
        <li>Nút <b>M</b> ở góc trên phải để mở bảng này trong game.</li>
      </ul>`;
      this.body.appendChild(n);
    },

    onSave() { this.refreshFab(); },
  };

  M.UI = UI;
})();
