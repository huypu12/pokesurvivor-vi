/* =====================================================================
 * mega_sprites.js — Renderer sprite cho dạng Mega
 *
 * Dùng ĐÚNG công thức của G.Sprites (PX=2, pivot ax/ay, 8 dòng hướng) nên
 * hình Mega khớp tỷ lệ + vị trí chân với sprite thường trong game.
 *
 * Không ghi đè G.Sprites: chỉ bổ sung G.Sprites.Mega.*
 * ===================================================================== */
(function () {
  const M = (window.PS_MEGA = window.PS_MEGA || {});
  const PX = 2;

  /** Truy cập an toàn vào engine game (G có thể chưa tồn tại). */
  function ENG() {
    try { return (typeof G !== 'undefined' && G) ? G : (window.G || null); }
    catch (e) { return window.G || null; }
  }
  M.ENG = ENG;

  const SHEETS = new Map();   // "formId/Anim" -> {img, ready, failed, src}
  const MAX = 60;             // giới hạn bộ nhớ (mỗi sheet ~0.5MB đã giải mã)

  function metaOf(formId) {
    if (!M.META) return null;
    return M.META[formId] || null;
  }

  function evict() {
    if (SHEETS.size <= MAX) return;
    const it = SHEETS.keys();
    for (let i = 0; i < SHEETS.size - Math.floor(MAX * 0.8); i++) {
      const k = it.next().value;
      const s = SHEETS.get(k);
      if (s) { s.img.onload = s.img.onerror = null; s.img.src = ''; SHEETS.delete(k); }
    }
  }

  function sheet(formId, anim) {
    const meta = metaOf(formId);
    if (!meta) return null;
    const name = meta.a[anim] ? anim : (meta.a.Idle ? 'Idle' : 'Walk');
    const k = formId + '/' + name;
    let s = SHEETS.get(k);
    if (s) return s;
    evict();
    s = { ready: false, failed: false, img: new Image(), src: `assets/mega/${formId}/${name}.png` };
    s.img.onload = () => { s.ready = true; };
    s.img.onerror = () => { s.failed = true; };
    s.img.src = s.src;
    SHEETS.set(k, s);
    return s;
  }

  function animMeta(formId, anim) {
    const meta = metaOf(formId);
    if (!meta) return null;
    const name = meta.a[anim] ? anim : (meta.a.Idle ? 'Idle' : 'Walk');
    return meta.a[name] || null;
  }

  /** Hướng 0..7 từ vector (khớp G.Sprites.dirFromAngle nếu có). */
  function dir(a) {
    const E = ENG(); if (E && E.Sprites && E.Sprites.dirFromAngle) return E.Sprites.dirFromAngle(a);
    const d = Math.round(((a + Math.PI / 2) / (Math.PI / 4))) % 8;
    return (d + 8) % 8;
  }

  /** Vẽ 1 khung, chân ở (x, y). opts:{frame, dir, alpha, flash, tint, scale} */
  function draw(ctx, formId, anim, x, y, opts) {
    opts = opts || {};
    const meta = metaOf(formId);
    if (!meta) return false;
    const am = animMeta(formId, anim);
    const s = sheet(formId, anim);
    if (!am || !s) return false;

    const E = ENG(); const dpr = (E && E.Camera && E.Camera.dpr) || 1;
    const scale = (opts.scale || 1) * dpr;
    const frame = Math.min(am.n - 1, Math.max(0, opts.frame | 0));
    const row = Math.min(am.r - 1, Math.max(0, (opts.dir || 0) | 0));

    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;

    if (!s.ready) {
      // chưa tải xong: vẽ đĩa mờ để không "biến mất"
      ctx.globalAlpha *= 0.25;
      ctx.fillStyle = opts.tint || '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, y - 20 * scale / dpr, 16 * scale, 24 * scale, 0, 0, 6.2832);
      ctx.fill();
      ctx.restore();
      return false;
    }

    const dw = am.w * PX * scale;
    const dh = am.h * PX * scale;
    const dx = x - (am.ax * PX * scale);
    const dy = y - (am.ay * PX * scale);

    // bóng
    if (opts.shadow !== false) {
      ctx.save();
      ctx.globalAlpha *= 0.34;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(x, y, 14 * scale, 6 * scale, 0, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }

    if (opts.flash) {
      // vẽ bản trắng bằng cách tô đè
      ctx.drawImage(s.img, frame * am.w, row * am.h, am.w, am.h, dx, dy, dw, dh);
      ctx.globalCompositeOperation = 'source-atop';
    }

    ctx.drawImage(s.img, frame * am.w, row * am.h, am.w, am.h, dx, dy, dw, dh);

    if (opts.flash) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      // vẽ lại bản trắng đè lên
      ctx.save();
      ctx.globalAlpha = opts.flashAlpha != null ? opts.flashAlpha : 0.75;
      ctx.filter = 'none';
      const c = whiteCache(s.img);
      ctx.drawImage(c, frame * am.w, row * am.h, am.w, am.h, dx, dy, dw, dh);
      ctx.restore();
      return true;
    }

    if (opts.tint) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha *= 0.45;
      ctx.fillStyle = opts.tint;
      ctx.fillRect(dx, dy, dw, dh);
    }
    ctx.restore();
    return true;
  }

  const WHITE = new WeakMap();
  function whiteCache(img) {
    let c = WHITE.get(img);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, c.width, c.height);
    WHITE.set(img, c);
    return c;
  }

  /** Tiền tải các animation của 1 form */
  function preload(formId, anims, timeout) {
    const meta = metaOf(formId);
    if (!meta) return Promise.resolve(false);
    const list = anims || Object.keys(meta.a);
    const hs = list.map((a) => sheet(formId, a)).filter(Boolean);
    return new Promise((res) => {
      const t0 = performance.now();
      (function chk() {
        if (hs.every((h) => h.ready || h.failed) || performance.now() - t0 > (timeout || 8000)) return res(hs.every((h) => h.ready));
        setTimeout(chk, 50);
      })();
    });
  }

  M.Spr = { draw, sheet, animMeta, dir, preload, metaOf, get count() { return SHEETS.size; } };
})();
