/* =====================================================================
 * mega_main.js — Nối hệ thống Mega vào game PokéSurvivor đang chạy
 *
 * Cơ chế: chèn một lớp render/update NGOÀI vòng lặp game, dùng chung canvas
 * và kích thước (w, h, dpr) của game. Không sửa app.min.js.
 *
 * Ba chế độ xếp lớp:
 *   overlay  — vẽ đè lên game (Boss arena, Cinematic)
 *   replace  — thay nhân vật bằng sprite Mega khi đang Mega
 *
 * API cho UI:
 *   M.Game.requestMega(form)   bắt đầu Mega (kiểm tra unlock)
 *   M.Game.requestRevert(dex)
 *   M.Game.isMega(dex)
 * ===================================================================== */
(function () {
  const M = (window.PS_MEGA = window.MEGA = window.PS_MEGA || {});
  const T = M.T;

  const Game = {
    ready: false,
    canvas: null,
    ctx: null,
    W: 0, H: 0, dpr: 1,
    lastT: 0,
    running: false,
    cinematicDeck: null,
    _raf: 0,
    inRun: false,
    megaActive: {},       // dex -> formId (cache nhanh, đồng bộ với Save)
    pendingMega: null,
    hitBanner: 0,
    banner: null,

    /* ------------------------------------------------------------ */
    init() {
      M.Save.load();
      M.VFX.setQuality(M.Save.opt('quality') || 'medium');
      M.UI.init();
      this.ready = true;

      this._hookMegaMeta();
      this._bindCanvas();
      this._bindInput();
      this._bindUIEntry();

      // đồng bộ active từ save
      this.megaActive = Object.assign({}, M.Save.data.active || {});

      // ---- Phần 19: sự kiện Boss
      M.Event.beginRun();
      M.Event.resumeFromSave();

      this.running = true;
      this.lastT = performance.now();
      requestAnimationFrame((t) => this._loop(t));

      console.log('[Mega] hệ thống sẵn sàng ·', M.FORMS.length, 'dạng');
    },

    /** Gắn meta sprite mega vào M.META để UI và renderer dùng */
    _hookMegaMeta() {
      M.META = M.META || {};
      // mega_meta được sinh sẵn trong assets/mega/sprites_meta.json → nạp bất đồng bộ
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'assets/mega/sprites_meta.json', true);
      xhr.onload = () => {
        try {
          const j = JSON.parse(xhr.responseText);
          for (const k in j) M.META[k] = j[k];
          console.log('[Mega] meta sprite:', Object.keys(j).length, 'dạng');
        } catch (e) { console.warn('[Mega] meta lỗi', e); }
      };
      xhr.onerror = () => console.warn('[Mega] không nạp được sprites_meta.json');
      xhr.send();
    },

    _bindCanvas() {
      const list = Array.from(document.querySelectorAll('canvas'));
      // canvas hiển thị thật = canvas có diện tích khung lớn nhất
      let best = null, bestArea = 0;
      for (const c of list) {
        const r = c.getBoundingClientRect();
        const a = r.width * r.height;
        if (a > bestArea) { bestArea = a; best = c; }
      }
      if (!best || bestArea < 1000) { setTimeout(() => this._bindCanvas(), 300); return; }
      this.canvas = best;
      this.ctx = best.getContext('2d');
      this._syncSize();
      if (!this._resizeBound) {
        this._resizeBound = true;
        window.addEventListener('resize', () => this._syncSize());
        window.addEventListener('orientationchange', () => setTimeout(() => this._syncSize(), 250));
      }
    },

    _syncSize() {
      const c = this.canvas;
      if (!c) return;
      const r = c.getBoundingClientRect();
      if (r.width > 0) { this.W = Math.round(r.width); this.H = Math.round(r.height); return; }
      this.W = c.width || window.innerWidth;
      this.H = c.height || window.innerHeight;
    },

    _bindInput() {
      const on = (name, fn) => window.addEventListener(name, fn, { passive: false });
      on('keydown', (e) => {
        if (M.Boss.open) { M.Boss.key(e.code, true); if (e.code === 'Space') e.preventDefault(); }
        if (e.code === 'Escape' && M.Cine.active) { /* không cho thoát giữa chừng */ }
        if (e.code === 'KeyM' && !e.repeat && !M.Boss.open) {
          if (M.UI.isOpen()) M.UI.close(); else M.UI.open();
        }
      });
      on('keyup', (e) => { if (M.Boss.open) M.Boss.key(e.code, false); });

      const ptr = (cv) => {
        const toXY = (ev) => {
          const r = cv.getBoundingClientRect();
          const p = ev.touches ? ev.touches[0] : ev;
          return { x: p.clientX - r.left, y: p.clientY - r.top };
        };
        cv.addEventListener('pointerdown', (ev) => {
          const p = toXY(ev);
          if (M.Boss.open) { M.Boss.pointer('down', p.x, p.y); ev.preventDefault(); }
        }, { passive: false });
        cv.addEventListener('pointermove', (ev) => {
          if (M.Boss.open) {
            const p = toXY(ev);
            M.Boss.pointer('move', p.x, p.y);
          }
        }, { passive: true });
        cv.addEventListener('pointerup', (ev) => {
          if (M.Boss.open) M.Boss.pointer('up');
        }, { passive: true });
        cv.addEventListener('pointercancel', () => { if (M.Boss.open) M.Boss.pointer('up'); });
      };
      const wire = () => { if (this.canvas) ptr(this.canvas); else setTimeout(wire, 500); };
      wire();
    },

    _bindUIEntry() {
      // Nút M luôn hiện khi vào game
      setTimeout(() => M.UI.showFab(true), 1500);
      // Long-press vào logo/tiêu đề cũng mở (dự phòng)
      document.addEventListener('dblclick', (e) => {
        if (e.target && e.target.tagName === 'CANVAS' && !M.Boss.open) M.UI.open();
      });
    },

    /* ------------------------------------------------------------ */
    /** Người chơi yêu cầu Mega cho 1 dạng */
    requestMega(form) {
      const chk = M.Stones.canMega(form, M.Save);
      if (!chk.ok) { M.UI.toast('❌ ' + chk.reason); return false; }
      if (M.Cine.active) { M.UI.toast('Đang trong cảnh biến hình…'); return false; }
      const already = M.Save.getActive(form.dex);
      if (already) { M.UI.toast('Đang ở dạng Mega khác rồi'); return false; }

      this._startCinematic(form, () => {
        M.Save.setActive(form.dex, form.id);
        this.megaActive[form.dex] = form.id;
        M.Save.data.stats.megaCount = (M.Save.data.stats.megaCount || 0) + 1;
        M.Save.save();
        M.UI.refreshFab();
        M.UI.toast('✨ ' + form.form + ' đã Mega!');
      });
      return true;
    },

    requestRevert(dex) {
      const fid = M.Save.getActive(dex);
      if (!fid) return false;
      const form = M.BY_ID[fid];
      this._startRevert(form, () => {
        M.Save.setActive(dex, null);
        delete this.megaActive[dex];
        M.Save.save();
        M.UI.refreshFab();
        M.UI.toast('Đã trở lại bình thường');
      });
      return true;
    },

    isMega(dex) { return !!this.megaActive[dex]; },
    activeForm(dex) { const id = this.megaActive[dex]; return id ? M.BY_ID[id] : null; },

    /* ------------------------------------------------------------ */
    _startCinematic(form, onDone) {
      M.UI.close();
      const W = this.W, H = this.H;
      const cx = W / 2, cy = H / 2 + 30;
      const dex = form.dex;

      const opener = (ctx, o) => {
        // vẽ sprite thường của player: dùng G.Sprites nếu có
        if (o && o.silhouette) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
          // vẽ đen silhouette bằng filter
          try { ctx.filter = 'brightness(0) contrast(2)'; } catch (e) {}
          this._drawPlayerSprite(ctx, cx, cy);
          try { ctx.filter = 'none'; } catch (e) {}
          ctx.restore();
          return;
        }
        this._drawPlayerSprite(ctx, cx, cy);
      };

      M.Cine.start(form, cx, cy, opener, {
        onDone: () => {
          this.cinematicDeck = null;
          onDone && onDone();
        },
      });
    },

    _startRevert(form, onDone) {
      M.UI.close();
      const cx = this.W / 2, cy = this.H / 2 + 30;
      M.Cine.start(form, cx, cy, null, { onDone: () => { } });
      M.Cine.speed = 1;
      // chuyển ngay sang reversion
      M.Cine.phase = 4;
      M.Cine.pt = 1;
      M.Cine.megaK = 1;
      M.Cine.core = 1;
      M.Cine.revert(cx, cy, () => { onDone && onDone(); this.cinematicDeck = null; });
    },

    _drawPlayerSprite(ctx, x, y, scale) {
      const E = M.ENG && M.ENG();
      if (E && E.Sprites && E.Sprites.Animator) {
        if (!this._playerAnimCache) this._playerAnimCache = {};
        const dex = (E.Dex && E.Dex.current) || 1;
        if (!this._playerAnimCache[dex]) this._playerAnimCache[dex] = new E.Sprites.Animator(dex, 1.6 * (scale || 1));
        const a = this._playerAnimCache[dex];
        a.loop('Idle', 1);
        a.dir = 0;
        try { a.draw(ctx, x, y, {}); return; } catch (e) {}
      }
      // fallback
      ctx.fillStyle = '#4fc3f7';
      ctx.beginPath(); ctx.arc(x, y - 34, 14, 0, 6.2832); ctx.fill();
      ctx.fillRect(x - 9, y - 22, 18, 24);
    },

    /* ------------------------------------------------------------ */
    _loop(t) {
      if (!this.running) return;
      this._raf = requestAnimationFrame((n) => this._loop(n));
      const now = t || performance.now();
      let dt = (now - this.lastT) / 1000;
      this.lastT = now;
      if (!isFinite(dt) || dt <= 0) dt = 0.016;
      if (dt > 0.1) dt = 0.1;

      try { this._tick(dt); } catch (e) { console.error('[Mega] tick', e); }
    },

    _tick(dt) {
      if (!this.canvas || !this.ctx || this.canvas !== null) {
        if (!this.canvas) this._bindCanvas();
      }
      if (!this.ctx) return;

      M.Event.update(dt);

      const bossOn = M.Boss.open;
      const cineOn = M.Cine.active;

      // HUD đếm giờ luôn hiện (Phần 19.1)
      this._drawEventHud();

      if (!bossOn && !cineOn) {
        M.Cam.update(dt);
        return;
      }

      // ---- chế độ Boss arena: vẽ lên canvas overlay riêng
      if (bossOn) {
        if (M.Cine.active) M.Cine.update(dt);
        else M.Boss.update(dt);
        this._drawBossOverlay(bossOn);
        return;
      }

      // ---- chế độ Cinematic trên nền game
      M.Cine.update(dt);
      const cv = this._ensureOverlay();
      const W = window.innerWidth, H = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      }
      cv.style.display = 'block';
      cv.style.pointerEvents = 'none';
      const ctx = this._ovCtx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(0, 0, W, H);
      M.Cam.drawOverlay(ctx, W, H);
      M.Cine.draw(ctx, W, H);
      if (!M.Cine.active) { cv.style.display = 'none'; }
    },

    /** HUD sự kiện ở lớp riêng (không chặn chạm) */
    _drawEventHud() {
      if (!this._hud) {
        const cv = document.createElement('canvas');
        cv.id = 'psm-hud';
        cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;' +
          'z-index:99984;pointer-events:none;';
        document.body.appendChild(cv);
        this._hud = cv;
        this._hudCtx = cv.getContext('2d');
      }
      const cv = this._hud;
      const W = window.innerWidth, H = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      }
      const ctx = this._hudCtx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      M.Event.draw(ctx, W, H);
    },

    /** Canvas overlay riêng: luôn đúng kích thước, không đụng canvas game */
    _ensureOverlay() {
      if (this._ov && document.body.contains(this._ov)) return this._ov;
      const cv = document.createElement('canvas');
      cv.id = 'psm-overlay';
      cv.style.cssText =
        'position:fixed;left:0;top:0;width:100%;height:100%;' +
        'z-index:99985;display:none;touch-action:none;pointer-events:auto;';
      document.body.appendChild(cv);
      this._ov = cv;
      this._ovCtx = cv.getContext('2d');
      // pointer cho boss
      const toXY = (ev) => {
        const r = cv.getBoundingClientRect();
        return { x: ev.clientX - r.left, y: ev.clientY - r.top };
      };
      cv.addEventListener('pointerdown', (ev) => {
        const p = toXY(ev);
        M.Boss.pointer('down', p.x, p.y);
        ev.preventDefault();
      }, { passive: false });
      cv.addEventListener('pointermove', (ev) => {
        const p = toXY(ev); M.Boss.pointer('move', p.x, p.y);
      }, { passive: true });
      cv.addEventListener('pointerup', () => M.Boss.pointer('up'), { passive: true });
      cv.addEventListener('pointercancel', () => M.Boss.pointer('up'), { passive: true });
      return cv;
    },

    _drawBossOverlay(show) {
      const cv = this._ensureOverlay();
      const W = window.innerWidth, H = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      if (!show) { cv.style.display = 'none'; return; }
      cv.style.display = 'block';
      cv.style.pointerEvents = 'auto';
      const ctx = this._ovCtx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      this.W = W; this.H = H;
      M.Boss.draw(ctx, W, H);
    },

    /* ------------------------------------------------------------ */
    /** Gọi khi người chơi bắt đầu/kết thúc một run để bật/tắt nút M */
    setInRun(v) {
      this.inRun = v;
      M.UI.showFab(true);
    },

    /** Hoàn nguyên tất cả Mega khi run kết thúc (RULE 9: tạm thời) */
    revertAll(cb) {
      const actives = Object.keys(this.megaActive);
      if (!actives.length) { cb && cb(); return; }
      M.Save.clearActives();
      this.megaActive = {};
      M.Save.save();
      M.UI.toast('Mega đã hoàn nguyên — biến đổi chỉ kéo dài 1 trận');
      cb && cb();
    },
  };

  M.Game = Game;

  function boot() {
    try { Game.init(); } catch (e) { console.error('[Mega] init fail', e); }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 600);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(boot, 600));
  }
})();
