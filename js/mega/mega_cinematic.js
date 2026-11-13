/* =====================================================================
 * mega_cinematic.js — Hoạt ảnh Mega Evolution 5 giai đoạn bằng Canvas 2D
 *
 *  State machine chính xác (không cho animation chồng nhau):
 *   NORMAL_IDLE → MEGA_ACTIVATION → MEGA_CHARGING → MEGA_TRANSFORMING
 *               → MEGA_BURST → MEGA_REVEAL → MEGA_IDLE
 *   … và MEGA_REVERSION khi kết thúc trận.
 *
 *  Điểm cốt lõi: KHÔNG đổi sprite tức thời. Trong TRANSFORMING, sprite
 *  thường tan dần (silhouette + méo + xé hạt) trong khi sprite Mega hiện
 *  dần bằng mask loang + viền năng lượng.
 * ===================================================================== */
(function () {
  const M = (window.PS_MEGA = window.PS_MEGA || {});
  const T = M.T;

  const PH = [
    { k: 'ACTIVATION', d: 0.85 },
    { k: 'CHARGING', d: 1.15 },
    { k: 'TRANSFORMING', d: 1.35 },
    { k: 'BURST', d: 0.75 },
    { k: 'REVEAL', d: 1.05 },
  ];

  // Cấu hình riêng cho từng Pokémon đặc biệt (RULE: không dùng 1 anim chung)
  const UNIQUE = {
    'Charizard': { aura: ['#001a3a', '#00e5ff', '#7b2cff'], extra: 'dragonflame', burstColor: '#00e5ff', shake: 14 },
    'Mewtwo': { aura: ['#2a0040', '#c56cff', '#6a8dff'], extra: 'psychic', burstColor: '#c56cff', shake: 16 },
    'Gengar': { aura: ['#12001f', '#8b2fff', '#ff2f9e'], extra: 'ghost', burstColor: '#8b2fff', shake: 12 },
    'Gyarados': { aura: ['#001a2e', '#2f9bff', '#003d6b'], extra: 'whirlpool', burstColor: '#2f9bff', shake: 15 },
    'Metagross': { aura: ['#101820', '#b8d4ff', '#5f7d95'], extra: 'gravity', burstColor: '#b8d4ff', shake: 13 },
    'Absol': { aura: ['#1a0010', '#ff4d7d', '#ffffff'], extra: 'wind', burstColor: '#ff4d7d', shake: 10 },
    'Rayquaza': { aura: ['#001a12', '#00ffa3', '#7bffd6'], extra: 'storm', burstColor: '#00ffa3', shake: 20 },
    'Lucario': { aura: ['#001a2e', '#2f8bff', '#7fffd4'], extra: 'aura', burstColor: '#2f8bff', shake: 12 },
    'Blaziken': { aura: ['#2e0000', '#ff6b2b', '#ffd93d'], extra: 'flame', burstColor: '#ff6b2b', shake: 13 },
    'Garchomp': { aura: ['#1a0f00', '#c9a227', '#ff8c42'], extra: 'sand', burstColor: '#c9a227', shake: 14 },
    'Greninja': { aura: ['#001226', '#3aa0ff', '#0b0f1a'], extra: 'water', burstColor: '#3aa0ff', shake: 11 },
    'Diancie': { aura: ['#2a0030', '#ffb3e6', '#ffffff'], extra: 'crystal', burstColor: '#ffb3e6', shake: 12 },
    'Zygarde': { aura: ['#001a0d', '#4cd964', '#00ff88'], extra: 'cell', burstColor: '#4cd964', shake: 16 },
    'Salamence': { aura: ['#001a2e', '#5f8bff', '#ff4d4d'], extra: 'dragonflame', burstColor: '#5f8bff', shake: 13 },
    'Tyranitar': { aura: ['#1a0f00', '#8b6b3f', '#ff9f1c'], extra: 'earth', burstColor: '#8b6b3f', shake: 16 },
    'Steelix': { aura: ['#0d1014', '#9fb3c8', '#ffffff'], extra: 'metal', burstColor: '#9fb3c8', shake: 14 },
    'Aggron': { aura: ['#0d1014', '#7b8b9b', '#c9a227'], extra: 'metal', burstColor: '#7b8b9b', shake: 14 },
    'Gardevoir': { aura: ['#2a0030', '#ff8fd6', '#b8a6ff'], extra: 'psychic', burstColor: '#ff8fd6', shake: 10 },
  };

  const C = {
    active: false,
    form: null,
    phase: 0,
    pt: 0,        // thời gian trong phase
    total: 0,
    x: 0, y: 0,
    onDone: null,
    cfg: null,
    reversed: false,
    burstRings: [],
    silhouetteK: 1,
    megaK: 0,
    flashK: 0,
    core: 0,
    revealed: false,

    /**
     * @param form  dạng Mega (M.BY_ID)
     * @param x,y   toạ độ vẽ (màn hình)
     * @param opener  hàm(ctx) vẽ sprite thường (nhân vật hiện tại)
     * @param opts  { onDone, quick }
     */
    start(form, x, y, opener, opts) {
      opts = opts || {};
      this.form = form;
      this.cfg = UNIQUE[form.pokemon] || {
        aura: [T.shade(M.Stones.colorOf(form), 0.3), M.Stones.colorOf(form), '#ffffff'],
        extra: null,
        burstColor: M.Stones.colorOf(form),
        shake: 12,
      };
      this.x = x; this.y = y;
      this.opener = opener || null;
      this.phase = 0; this.pt = 0; this.total = 0;
      this.active = true;
      this.reversed = false;
      this.burstRings.length = 0;
      this.silhouetteK = 1;
      this.megaK = 0;
      this.flashK = 0;
      this.core = 0;
      this.revealed = false;
      this.onDone = opts.onDone || null;
      this.quick = !!opts.quick;
      this.speed = this.quick ? 2.4 : 1;

      M.VFX.clear();
      M.Sound.activate(form.types);
      M.Spr.preload(form.id, ['Idle', 'Attack']);
      M.Cam.darkenTo(0.45, 0.6);
      M.Cam.zoomTo(1.16, 0.9);

      return this;
    },

    /** Giai đoạn hiện tại theo tên chuẩn spec */
    phaseName() {
      if (this.reversed) return 'MEGA_REVERSION';
      return 'MEGA_' + (PH[this.phase] ? PH[this.phase].k : 'IDLE');
    },

    /** Bắt đầu hoàn nguyên */
    revert(x, y, onDone) {
      if (!this.active) return;
      this.reversed = true;
      this.x = x != null ? x : this.x;
      this.y = y != null ? y : this.y;
      this.onDone = onDone || null;
      this.rt = 0;
      this.rdur = 0.9;
      M.Sound.revert(this.form.types);
      M.VFX.converge(this.form.types[0], this.x, this.y - 30, 90, 26);
    },

    update(dt) {
      if (!this.active) return;
      const spd = this.speed;
      dt *= spd;

      if (this.reversed) {
        this.rt += dt;
        const k = Math.min(1, this.rt / this.rdur);
        this.megaK = 1 - k;
        this.flashK = k;
        M.VFX.update(dt);
        if (k >= 1) {
          this.active = false; this.reversed = false;
          M.Cam.darkenTo(0, 0.4); M.Cam.zoomTo(1, 0.4);
          const cb = this.onDone; this.onDone = null;
          cb && cb();
        }
        return;
      }

      this.pt += dt;
      this.total += dt;
      const ph = PH[this.phase];
      if (!ph) { this.finish(); return; }

      const k = Math.min(1, this.pt / ph.d);
      const f = this.form, ax = this.x, ay = this.y - 30;
      const type1 = f.types[0], type2 = f.types[1];

      switch (ph.k) {
        case 'ACTIVATION': {
          // đá phát sáng, đường năng lượng nối vào Pokémon
          this.core = k;
          if (Math.random() < 0.55) M.VFX.converge(type1, ax, ay, 130, 2);
          if (this.pt === dt) {
            M.VFX.spawn({ x: ax, y: ay, life: 0.85, size: 6, color: this.cfg.aura[2], shape: 'ring', add: true, grow: 120 });
          }
          if (k >= 1) { this._next(); M.Sound.charge(f.types); }
          break;
        }
        case 'CHARGING': {
          // vòng năng lượng xoay, hào quang mạnh dần, nền tối hơn
          this.core = 1;
          if (Math.random() < 0.85) M.VFX.converge(type1, ax, ay, 120 + Math.sin(this.total * 6) * 18, 3);
          if (type2 && Math.random() < 0.5) M.VFX.converge(type2, ax, ay, 100, 2);
          M.Cam.darkenTo(0.45 + k * 0.25, 0.2);
          if (k >= 1) { this._next(); M.Sound.transform(f.types); }
          break;
        }
        case 'TRANSFORMING': {
          // sprite thường tan dần + silhouette, sprite Mega hiện dần
          this.silhouetteK = Math.max(0, 1 - k * 1.35);
          this.megaK = Math.min(1, Math.max(0, (k - 0.28) * 1.6));
          this.core = 1;
          if (Math.random() < 0.9) M.VFX.aura(type1, ax, ay - 20, 40, this.total);
          if (type2 && Math.random() < 0.6) M.VFX.aura(type2, ax, ay - 20, 34, this.total);
          if (k >= 1) { this._next(); M.Sound.burst(f.types); }
          break;
        }
        case 'BURST': {
          if (this.pt === dt) {
            // vòng xung kích + flash + shake + slowmo
            this.burstRings.push({ r: 0, life: 0.75, max: Math.max(window.innerWidth, window.innerHeight) * 0.9 });
            this.burstRings.push({ r: 0, life: 0.55, max: 260 });
            M.VFX.burst(type1, type2, ax, ay, 3.2);
            M.VFX.shockwave(ax, ay, this.cfg.burstColor, 320, 0.7);
            this.flashK = 1;
            M.Cam.flash(this.cfg.burstColor, 0.9, 0.4);
            M.Cam.shake(this.cfg.shake, 0.7);
            M.Cam.slowmo(0.25, 0.55);
          }
          this.megaK = 1;
          this.silhouetteK = 0;
          if (k >= 1) { this._next(); M.Sound.roar(f.types); }
          break;
        }
        case 'REVEAL': {
          this.megaK = 1;
          this.flashK = Math.max(0, 1 - k * 1.8);
          if (Math.random() < 0.5) M.VFX.aura(type1, ax, ay - 18, 46, this.total);
          if (k >= 1) {
            this._next();
            M.Sound.complete(f.types);
            M.Cam.darkenTo(0, 0.5);
            M.Cam.zoomTo(1, 0.5);
          }
          break;
        }
      }

      // rings
      for (const r of this.burstRings) { r.r += (r.max - r.r) * Math.min(1, dt * 3.2); r.life -= dt; }
      for (let i = this.burstRings.length - 1; i >= 0; i--) if (this.burstRings[i].life <= 0) this.burstRings.splice(i, 1);

      M.VFX.update(dt);
      if (this.flashK > 0) this.flashK = Math.max(0, this.flashK - dt * 1.6);
    },

    _next() { this.phase++; this.pt = 0; },

    finish() {
      this.active = false;
      M.Cam.darkenTo(0, 0.4);
      M.Cam.zoomTo(1, 0.4);
      const cb = this.onDone; this.onDone = null;
      cb && cb(true);
    },

    /** Vẽ — gọi trong toạ độ màn hình */
    draw(ctx, W, H) {
      if (!this.active) return;
      const f = this.form, type1 = f.types[0], type2 = f.types[1];
      const ax = this.x, ay = this.y;

      ctx.save();

      // ---- 1) sprite thường (tan dần) + silhouette
      if (this.opener && this.silhouetteK > 0.01) {
        ctx.save();
        ctx.globalAlpha = this.silhouetteK;
        this.opener(ctx);
        ctx.restore();

        // silhouette đen hoá
        ctx.save();
        ctx.globalAlpha = (1 - this.silhouetteK) * 0.85;
        this.opener(ctx, { silhouette: true });
        ctx.restore();
      }

      // ---- 2) năng lượng nền (đường/aura)
      const auraCol = this.cfg.aura;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(ax, ay - 20, 0, ax, ay - 20, 150 + Math.sin(this.total * 4) * 20);
      grad.addColorStop(0, T.hexA(auraCol[1], 0.35 * this.core));
      grad.addColorStop(0.45, T.hexA(auraCol[0], 0.18 * this.core));
      grad.addColorStop(1, T.hexA(auraCol[0], 0));
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(ax, ay - 20, 210, 0, 6.2832); ctx.fill();
      ctx.restore();

      // ---- 3) vòng năng lượng xoay
      if (this.core > 0.05 && this.phase <= 2) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rings = [
          { baseY: ay - 18, rw: 78, rh: 22, rot: this.total * 2.4, col: auraCol[1], a: 0.8 },
          { baseY: ay - 58, rw: 96, rh: 26, rot: -this.total * 1.7, col: auraCol[2], a: 0.55 },
          { baseY: ay - 100, rw: 70, rh: 20, rot: this.total * 3.1, col: auraCol[1], a: 0.45 },
        ];
        for (const r of rings) {
          ctx.globalAlpha = this.core * r.a;
          ctx.strokeStyle = r.col;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(ax, r.baseY, r.rw, r.rh, r.rot, 0, 6.2832);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ---- 4) sprite Mega hiện dần
      if (this.megaK > 0.01) {
        ctx.save();
        ctx.globalAlpha = this.megaK;

        // "mask loang": vẽ nhiều dải từ trên xuống để trông như đang lớn dần
        const frame = this.phase >= 3 ? (this.total * 10 | 0) % 3 : 0;
        M.Spr.draw(ctx, f.id, this.revealed ? 'Idle' : 'Charge', ax, ay, {
          frame: Math.min(frame, 2), dir: 0, scale: 1.25 + (1 - this.megaK) * 0.25,
          shadow: this.megaK > 0.9,
        });
        ctx.restore();

        // viền năng lượng
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - this.megaK) * 0.8;
        M.Spr.draw(ctx, f.id, 'Charge', ax, ay, { frame: 0, dir: 0, scale: 1.27, shadow: false });
        ctx.restore();
      }

      // ---- 5) hạt VFX
      M.VFX.draw(ctx);

      // ---- 6) xung kích
      for (const r of this.burstRings) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.max(0, r.life) * 0.9;
        ctx.strokeStyle = this.cfg.burstColor;
        ctx.lineWidth = 6 * Math.max(0.2, r.life);
        ctx.beginPath(); ctx.arc(ax, ay - 20, r.r, 0, 6.2832); ctx.stroke();
        ctx.restore();
      }

      // ---- 7) hiệu ứng riêng theo Pokémon
      this._unique(ctx, ax, ay);

      // ---- 8) flash trắng
      if (this.flashK > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(0.9, this.flashK);
        ctx.fillStyle = this.cfg.burstColor;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // ---- 9) tên hiển thị ở REVEAL
      if (this.phase >= 4 || this.phaseName() === 'MEGA_REVEAL') {
        const a = Math.min(1, Math.max(0, (this.pt - 0.1) * 2));
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.font = 'bold ' + Math.round(W * 0.062) + 'px system-ui,sans-serif';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = this.cfg.burstColor;
        ctx.shadowBlur = 24;
        ctx.fillText(f.form.toUpperCase(), W / 2, H * 0.2);
        ctx.shadowBlur = 0;
        ctx.font = Math.round(W * 0.03) + 'px system-ui';
        ctx.fillStyle = T.hexA(this.cfg.burstColor, 0.95);
        ctx.fillText('MEGA TIẾN HOÁ HOÀN TẤT', W / 2, H * 0.245);
        ctx.textAlign = 'left';
        ctx.restore();
      }

      ctx.restore();
    },

    /** Hiệu ứng đặc trưng theo loài */
    _unique(ctx, ax, ay) {
      const t = this.total, e = this.cfg.extra;
      if (!e && this.phase < 3) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, this.core);

      switch (e) {
        case 'dragonflame': {
          for (let i = 0; i < 6; i++) {
            const a = t * 1.6 + i * 1.05;
            const r = 60 + Math.sin(t * 3 + i) * 22;
            ctx.fillStyle = T.hexA(this.cfg.aura[1], 0.5);
            ctx.beginPath();
            ctx.arc(ax + Math.cos(a) * r, ay - 40 + Math.sin(a) * r * 0.6, 5 + Math.sin(t * 9 + i) * 2.5, 0, 6.2832);
            ctx.fill();
          }
          break;
        }
        case 'psychic': {
          for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = T.hexA(this.cfg.aura[2], 0.55);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ax, ay - 40, 40 + i * 26 + Math.sin(t * 4 + i) * 8, t * 2 + i, t * 2 + i + 3.4);
            ctx.stroke();
          }
          break;
        }
        case 'ghost': {
          for (let i = 0; i < 5; i++) {
            const a = t * 0.9 + i * 1.25;
            ctx.fillStyle = T.hexA(this.cfg.aura[1], 0.35);
            ctx.beginPath();
            ctx.ellipse(ax + Math.cos(a) * 55, ay - 30 + Math.sin(a * 1.3) * 40, 14, 22, a, 0, 6.2832);
            ctx.fill();
          }
          break;
        }
        case 'whirlpool': {
          for (let i = 0; i < 4; i++) {
            ctx.strokeStyle = T.hexA(this.cfg.aura[1], 0.45);
            ctx.lineWidth = 3;
            ctx.beginPath();
            const rr = 60 + i * 20;
            ctx.ellipse(ax, ay - 20, rr, rr * 0.32, t * 1.5 + i, 0, 6.2832);
            ctx.stroke();
          }
          break;
        }
        case 'gravity': {
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * 6.2832 + t;
            ctx.fillStyle = T.hexA(this.cfg.aura[1], 0.5);
            ctx.fillRect(ax + Math.cos(a) * 70 - 3, ay - 30 + Math.sin(a) * 40 - 3, 6, 6);
          }
          break;
        }
        case 'wind': {
          for (let i = 0; i < 5; i++) {
            ctx.strokeStyle = T.hexA(this.cfg.aura[1], 0.4);
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(ax, ay - 30, 50 + i * 18, t * 2.2 + i, t * 2.2 + i + 1.6);
            ctx.stroke();
          }
          break;
        }
        case 'storm': {
          if (Math.random() < 0.25) {
            ctx.strokeStyle = T.hexA('#ffffff', 0.85);
            ctx.lineWidth = 2;
            ctx.beginPath();
            let x = ax + (Math.random() * 2 - 1) * 160, y = 0;
            ctx.moveTo(x, y);
            for (let i = 0; i < 6; i++) {
              x += (Math.random() * 2 - 1) * 26; y += H_() / 6;
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          break;
        }
        case 'aura': {
          for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = T.hexA(this.cfg.aura[1], 0.5);
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.ellipse(ax, ay - 40 - i * 18, 44 + i * 8, 16 + i * 4, -t * 1.4 + i, 0, 6.2832);
            ctx.stroke();
          }
          break;
        }
        case 'flame': {
          for (let i = 0; i < 7; i++) {
            const a = t * 2 + i * 0.9;
            ctx.fillStyle = T.hexA(i % 2 ? '#ffd93d' : this.cfg.aura[1], 0.55);
            ctx.beginPath();
            ctx.ellipse(ax + Math.cos(a) * 46, ay - 50 + Math.sin(a * 1.4) * 50, 7, 16, a, 0, 6.2832);
            ctx.fill();
          }
          break;
        }
        case 'sand': {
          for (let i = 0; i < 10; i++) {
            ctx.fillStyle = T.hexA('#e3cfa5', 0.45);
            ctx.fillRect(ax + Math.sin(t * 2 + i) * 80, ay - (i * 9) % 120, 3, 3);
          }
          break;
        }
        case 'water': {
          for (let i = 0; i < 6; i++) {
            const a = t * 1.8 + i * 1.04;
            ctx.fillStyle = T.hexA(this.cfg.aura[1], 0.45);
            ctx.beginPath();
            ctx.arc(ax + Math.cos(a) * 62, ay - 40 + Math.sin(a) * 30, 4, 0, 6.2832);
            ctx.fill();
          }
          break;
        }
        case 'crystal': {
          for (let i = 0; i < 6; i++) {
            const a = t * 1.2 + i * 1.04;
            const r = 64;
            const x = ax + Math.cos(a) * r, y = ay - 40 + Math.sin(a) * r * 0.7;
            ctx.fillStyle = T.hexA('#ffffff', 0.6);
            ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.fill();
          }
          break;
        }
        case 'cell': {
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * 6.2832 + t * 1.1;
            ctx.fillStyle = T.hexA(this.cfg.aura[1], 0.5);
            ctx.beginPath();
            ctx.arc(ax + Math.cos(a) * 74, ay - 40 + Math.sin(a) * 48, 6, 0, 6.2832);
            ctx.fill();
          }
          break;
        }
        case 'earth': {
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * 6.2832;
            ctx.fillStyle = T.hexA(this.cfg.aura[1], 0.5);
            ctx.beginPath();
            ctx.ellipse(ax + Math.cos(a) * 64, ay - 10 + Math.sin(a) * 20, 9, 6, a, 0, 6.2832);
            ctx.fill();
          }
          break;
        }
        case 'metal': {
          for (let i = 0; i < 6; i++) {
            const a = t * 2.4 + i * 1.05;
            ctx.strokeStyle = T.hexA('#ffffff', 0.55);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ax, ay - 40, 40 + i * 14, a, a + 0.8);
            ctx.stroke();
          }
          break;
        }
      }
      ctx.restore();
      function H_() { return typeof window !== 'undefined' ? window.innerHeight : 720; }
    },
  };

  M.Cine = C;
})();
