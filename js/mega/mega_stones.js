/* =====================================================================
 * mega_stones.js — Vật phẩm Mega Stone + kiểm tra điều kiện mở khoá
 *
 * QUY TẮC CỨNG (RULE 3, 4):
 *   - Muốn Mega phải thắng Boss của chính form đó.
 *   - Phải có đúng Mega Stone của form đó (trừ Rayquaza: Dragon Ascent).
 *   - Dùng sai đá => từ chối, có lý do rõ ràng.
 * ===================================================================== */
(function () {
  const M = (window.PS_MEGA = window.PS_MEGA || {});

  // Màu đá theo hệ chính
  const TYPE_COLOR = {
    fire: '#ff6b35', water: '#3aa0ff', electric: '#ffd93d', grass: '#4cd964',
    psychic: '#ff5fa2', ghost: '#9b59b6', dragon: '#6f6bff', dark: '#5b4b6b',
    ice: '#8fe3ff', fairy: '#ffb3e6', steel: '#b8c0c8', rock: '#c9a227',
    ground: '#d9a066', flying: '#a8d8ff', fighting: '#e74c3c', bug: '#a2d149',
    poison: '#b05ecb', normal: '#d9d9d9',
  };

  const ST = {
    colorOf(form) {
      const t = (form.types && form.types[0]) || 'normal';
      return TYPE_COLOR[t] || TYPE_COLOR.normal;
    },

    /** Tên đá hiển thị (rayquaza => cơ chế đặc biệt) */
    nameOf(form) {
      if (form.kind === 'primal') return 'Orb nguyên thuỷ';
      if (form.pokemon === 'Rayquaza') return 'Dragon Ascent';
      return form.stone || (form.pokemon + 'nite' + (form.variant ? ' ' + form.variant : ''));
    },

    descOf(form) {
      if (form.pokemon === 'Rayquaza')
        return 'Không cần Mega Stone. Rayquaza tự Mega Tiến hoá khi học chiêu Dragon Ascent.';
      if (form.kind === 'primal')
        return 'Primal Reversion — KHÔNG phải Mega Evolution. Cần Orb nguyên thuỷ tương ứng.';
      return 'Đá tiến hoá dành riêng cho ' + form.pokemon +
        (form.variant ? ' (dạng ' + form.variant + ')' : '') +
        '. Chỉ dùng được sau khi đánh bại Boss ' + form.form + '.';
    },

    /**
     * Kiểm tra có được Mega hay không.
     * @returns {{ok:boolean, reason:string, code:string}}
     */
    canMega(form, save) {
      if (!form) return { ok: false, code: 'NO_FORM', reason: 'Không có dữ liệu dạng Mega.' };
      if (!save.isBossDefeated(form.id))
        return { ok: false, code: 'BOSS', reason: 'Chưa đánh bại Boss ' + form.form + '.' };
      if (!save.isUnlocked(form.id))
        return { ok: false, code: 'LOCKED', reason: 'Chưa mở khoá ' + form.form + '.' };
      if (form.pokemon !== 'Rayquaza' && form.kind === 'mega' && !save.hasStone(form.stone))
        return { ok: false, code: 'STONE', reason: 'Thiếu ' + this.nameOf(form) + '.' };
      return { ok: true, code: 'OK', reason: '' };
    },

    /** Trạng thái cho UI: LOCKED / UNLOCKED / AVAILABLE / ACTIVE */
    statusOf(form, save, activeDex) {
      if (save.getActive(form.dex) === form.id) return 'ACTIVE';
      if (!save.isBossDefeated(form.id)) return 'LOCKED';
      if (!save.isUnlocked(form.id)) return 'UNLOCKED';
      return 'AVAILABLE';
    },

    /** Vẽ icon đá 2D (dùng chung cho UI + VFX) */
    draw(ctx, x, y, r, form, phase, opts) {
      opts = opts || {};
      const c = this.colorOf(form);
      ctx.save();
      ctx.translate(x, y);

      // Hào quang
      if (opts.glow !== false) {
        const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.4);
        g.addColorStop(0, hexA(c, 0.55));
        g.addColorStop(0.55, hexA(c, 0.18));
        g.addColorStop(1, hexA(c, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, 6.2832); ctx.fill();
      }

      // Thân đá: đa giác 6 cạnh hơi xoay theo phase
      ctx.rotate(Math.sin(phase * 0.9) * 0.12);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.2832 - 1.57;
        const rr = r * (i % 2 === 0 ? 1 : 0.82);
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      const grd = ctx.createLinearGradient(-r, -r, r, r);
      grd.addColorStop(0, shade(c, 1.45));
      grd.addColorStop(0.5, c);
      grd.addColorStop(1, shade(c, 0.55));
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.stroke();

      // Lấp lánh
      const sp = (phase * 1.7) % 1;
      ctx.globalAlpha = 1 - sp;
      ctx.fillStyle = '#fff';
      star(ctx, Math.cos(phase * 2.1) * r * 0.9, Math.sin(phase * 2.1) * r * 0.9, r * 0.28 * (1 - sp));
      star(ctx, Math.cos(phase * 1.3 + 2) * r * 1.15, Math.sin(phase * 1.3 + 2) * r * 1.15, r * 0.2 * (1 - sp));
      ctx.globalAlpha = 1;
      ctx.restore();
    },
  };

  function star(ctx, x, y, r) {
    if (r <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  M.Stones = ST;
  M.T = M.T || {};
  M.T.hexA = hexA;
  M.T.shade = shade;
})();
