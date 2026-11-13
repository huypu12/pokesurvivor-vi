/* =====================================================================
 * mega_vfx.js — Hệ hạt 2D cho 18 hệ Pokémon + shockwave/arc/trail
 * Tất cả vẽ bằng Canvas 2D, có object pooling, có cấp chất lượng.
 * Không dùng 3D, không dùng ảnh ngoài.
 * ===================================================================== */
(function () {
  const M = (window.PS_MEGA = window.PS_MEGA || {});
  const T = M.T;

  const TYPE_STYLE = {
    fire:     { c1: '#fff3b0', c2: '#ff8c2b', c3: '#c93000', shape: 'flame' },
    water:    { c1: '#d8f6ff', c2: '#3aa0ff', c3: '#0b4f9e', shape: 'drop' },
    electric: { c1: '#ffffff', c2: '#ffe94d', c3: '#ffa000', shape: 'spark' },
    grass:    { c1: '#e6ffcd', c2: '#4cd964', c3: '#1c7a35', shape: 'leaf' },
    psychic:  { c1: '#ffd9f4', c2: '#ff5fa2', c3: '#8a1f7a', shape: 'ring' },
    ghost:    { c1: '#dcc9ff', c2: '#9b59b6', c3: '#3b1f4d', shape: 'mist' },
    dragon:   { c1: '#d9d6ff', c2: '#6f6bff', c3: '#2a1f8f', shape: 'diamond' },
    dark:     { c1: '#8f7fa8', c2: '#4a3a5c', c3: '#120a1c', shape: 'smoke' },
    ice:      { c1: '#ffffff', c2: '#8fe3ff', c3: '#3aa6c9', shape: 'shard' },
    fairy:    { c1: '#ffffff', c2: '#ffb3e6', c3: '#c94f9b', shape: 'star' },
    steel:    { c1: '#ffffff', c2: '#c8d3dc', c3: '#5d6c78', shape: 'metal' },
    rock:     { c1: '#e3cfa5', c2: '#c9a227', c3: '#6b4a12', shape: 'rock' },
    ground:   { c1: '#f0d8a8', c2: '#d9a066', c3: '#8a5a1f', shape: 'sand' },
    flying:   { c1: '#ffffff', c2: '#a8d8ff', c3: '#4a8fc9', shape: 'wind' },
    fighting: { c1: '#ffd6c9', c2: '#e74c3c', c3: '#8a1a10', shape: 'impact' },
    bug:      { c1: '#f0ffcf', c2: '#a2d149', c3: '#4f6d10', shape: 'wing' },
    poison:   { c1: '#f0c9ff', c2: '#b05ecb', c3: '#4a0f5e', shape: 'cloud' },
    normal:   { c1: '#ffffff', c2: '#e8e8e8', c3: '#9a9a9a', shape: 'burst' },
  };

  const QMAX = { low: 90, medium: 220, high: 460, ultra: 900 };

  function rnd(a, b) { return a + Math.random() * (b - a); }

  const VFX = {
    pool: [],
    live: [],
    max: 460,
    quality: 'high',

    style(type) { return TYPE_STYLE[type] || TYPE_STYLE.normal; },

    setQuality(q) { this.quality = q; this.max = QMAX[q] || 460; },

    _get() {
      return this.pool.pop() || {};
    },
    _free(p) {
      if (this.pool.length < 600) this.pool.push(p);
    },

    /** Sinh 1 hạt */
    spawn(o) {
      if (this.live.length >= this.max) {
        // tái sử dụng hạt cũ nhất
        const old = this.live.shift();
        this._free(old);
      }
      const p = this._get();
      p.x = o.x; p.y = o.y;
      p.vx = o.vx || 0; p.vy = o.vy || 0;
      p.g = o.g || 0;
      p.life = p.maxLife = o.life || 0.8;
      p.size = o.size || 3;
      p.size0 = p.size;
      p.color = o.color || '#fff';
      p.color2 = o.color2 || null;
      p.shape = o.shape || 'dot';
      p.rot = o.rot || 0;
      p.vrot = o.vrot || 0;
      p.add = o.add !== false;
      p.drag = o.drag !== undefined ? o.drag : 0.98;
      p.trail = o.trail || 0;
      p.px = p.x; p.py = p.y;
      p.grow = o.grow || 0;
      this.live.push(p);
      return p;
    },

    /** Bùng nổ theo hệ */
    burst(type1, type2, x, y, power) {
      power = power || 1;
      const n = Math.round((this.quality === 'low' ? 10 : this.quality === 'medium' ? 18 : 30) * power);
      const apply = (tp, cnt, spread) => {
        const st = this.style(tp);
        for (let i = 0; i < cnt; i++) {
          const a = Math.random() * 6.2832;
          const sp = rnd(60, 260) * power;
          this.spawn({
            x: x + Math.cos(a) * spread, y: y + Math.sin(a) * spread,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rnd(10, 60),
            g: rnd(20, 120), life: rnd(0.45, 1.05),
            size: rnd(2, 6) * power, color: Math.random() < 0.5 ? st.c1 : st.c2,
            color2: st.c3, shape: st.shape, vrot: rnd(-6, 6),
          });
        }
      };
      apply(type1 || 'normal', n, 4);
      if (type2) apply(type2, Math.round(n * 0.6), 2);
    },

    /** Vòng năng lượng hội tụ về tâm */
    converge(type, x, y, radius, count) {
      const st = this.style(type);
      const n = Math.round((count || 18) * (this.quality === 'low' ? 0.4 : 1));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.2832;
        const r = radius * rnd(0.9, 1.6);
        this.spawn({
          x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
          vx: -Math.cos(a) * r / 0.9, vy: -Math.sin(a) * r / 0.9,
          life: 0.9, size: rnd(1.6, 3.6), color: st.c2, color2: st.c1,
          shape: st.shape, add: true, drag: 0.995,
        });
      }
    },

    /** Hào quang bao quanh sprite */
    aura(type, x, y, r, t) {
      const st = this.style(type);
      const n = this.quality === 'low' ? 1 : 3;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.2832;
        this.spawn({
          x: x + Math.cos(a) * r * rnd(0.6, 1.0),
          y: y + Math.sin(a) * r * rnd(0.6, 1.0),
          vx: Math.cos(a) * 6, vy: -rnd(18, 50),
          life: rnd(0.5, 1.1), size: rnd(1.5, 3.4),
          color: Math.random() < 0.6 ? st.c1 : st.c2, color2: st.c3,
          shape: st.shape, add: true, drag: 0.96,
        });
      }
    },

    /** Vệt lửa/nước phía sau (trail) */
    trail(type1, type2, x, y, dirx, diry) {
      const st = this.style(type1);
      this.spawn({
        x: x + rnd(-3, 3), y: y + rnd(-3, 3),
        vx: -dirx * rnd(10, 40), vy: -diry * rnd(10, 40),
        life: rnd(0.28, 0.55), size: rnd(2, 4.5),
        color: st.c2, color2: st.c1, shape: st.shape, add: true,
      });
      if (type2) {
        const s2 = this.style(type2);
        this.spawn({ x, y, vx: -dirx * 20, vy: -diry * 20, life: 0.35,
          size: rnd(1.5, 3), color: s2.c1, shape: s2.shape, add: true });
      }
    },

    /** Cập nhật tất cả hạt */
    update(dt) {
      const L = this.live;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.life -= dt;
        if (p.life <= 0) { L.splice(i, 1); this._free(p); continue; }
        p.px = p.x; p.py = p.y;
        p.vy += p.g * dt;
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        if (p.grow) p.size += p.grow * dt;
      }
    },

    /** Vẽ hạt */
    draw(ctx) {
      const L = this.live;
      ctx.save();
      for (let i = 0; i < L.length; i++) {
        const p = L[i];
        const k = p.life / p.maxLife;
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
        const s = p.size * (0.35 + 0.65 * k);
        ctx.fillStyle = p.color;
        switch (p.shape) {
          case 'flame': drawFlame(ctx, p.x, p.y, s, k); break;
          case 'drop': drawDrop(ctx, p.x, p.y, s); break;
          case 'spark': drawSpark(ctx, p.x, p.y, s); break;
          case 'leaf': drawLeaf(ctx, p.x, p.y, s, p.rot); break;
          case 'ring': drawRing(ctx, p.x, p.y, s, p.color2); break;
          case 'mist': drawMist(ctx, p.x, p.y, s, p.color2); break;
          case 'diamond': drawDiamond(ctx, p.x, p.y, s, p.rot); break;
          case 'smoke': drawMist(ctx, p.x, p.y, s * 1.6, p.color2, 0.55); break;
          case 'shard': drawShard(ctx, p.x, p.y, s, p.rot); break;
          case 'star': drawStar(ctx, p.x, p.y, s, p.rot); break;
          case 'metal': drawMetal(ctx, p.x, p.y, s, p.rot); break;
          case 'rock': drawRock(ctx, p.x, p.y, s, p.rot); break;
          case 'sand': drawDot(ctx, p.x, p.y, s * 0.7); break;
          case 'wind': drawWind(ctx, p.px, p.py, p.x, p.y, s); break;
          case 'impact': drawImpact(ctx, p.x, p.y, s, p.rot); break;
          case 'wing': drawLeaf(ctx, p.x, p.y, s, p.rot); break;
          case 'cloud': drawMist(ctx, p.x, p.y, s * 1.3, p.color2); break;
          case 'burst': drawDot(ctx, p.x, p.y, s); break;
          default: drawDot(ctx, p.x, p.y, s);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    },

    /** Vòng xung kích mở rộng */
    shockwave(x, y, color, maxR, life) {
      this.spawn({ x, y, life: life || 0.55, size: 4, grow: (maxR || 120) / (life || 0.55),
        color: color || '#fff', shape: 'wave', add: true, drag: 1 });
    },

    clear() { while (this.live.length) this._free(this.live.pop()); },
    count() { return this.live.length; },
  };

  // ---------- hình vẽ ----------
  function drawDot(ctx, x, y, s) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.6, s), 0, 6.2832); ctx.fill(); }

  function drawFlame(ctx, x, y, s, k) {
    ctx.beginPath();
    ctx.moveTo(x, y - s * 2.2 * k);
    ctx.quadraticCurveTo(x + s * 1.4, y - s * 0.4, x + s * 0.5, y + s);
    ctx.quadraticCurveTo(x, y + s * 0.3, x - s * 0.5, y + s);
    ctx.quadraticCurveTo(x - s * 1.4, y - s * 0.4, x, y - s * 2.2 * k);
    ctx.fill();
  }
  function drawDrop(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.5);
    ctx.quadraticCurveTo(x + s, y, x, y + s);
    ctx.quadraticCurveTo(x - s, y, x, y - s * 1.5);
    ctx.fill();
  }
  function drawSpark(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - s * 1.6, y - s * 0.35); ctx.lineTo(x + s * 0.4, y - s * 0.15);
    ctx.lineTo(x - s * 0.2, y + s * 0.15); ctx.lineTo(x + s * 1.6, y + s * 0.5);
    ctx.lineTo(x - s * 0.4, y + s * 0.4); ctx.lineTo(x + s * 0.1, y - s * 0.02);
    ctx.closePath(); ctx.fill();
  }
  function drawLeaf(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.5, s * 0.65, 0, 0, 6.2832); ctx.fill();
    ctx.restore();
  }
  function drawRing(ctx, x, y, s, c2) {
    ctx.strokeStyle = c2 || ctx.fillStyle; ctx.lineWidth = Math.max(1, s * 0.45);
    ctx.beginPath(); ctx.arc(x, y, s * 1.6, 0, 6.2832); ctx.stroke();
  }
  function drawMist(ctx, x, y, s, c2, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 2);
    g.addColorStop(0, ctx.fillStyle); g.addColorStop(1, 'rgba(0,0,0,0)');
    const old = ctx.globalAlpha;
    ctx.globalAlpha = old * (alpha || 0.8);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, s * 2, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = old;
  }
  function drawDiamond(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(0, -s * 1.6); ctx.lineTo(s, 0);
    ctx.lineTo(0, s * 1.6); ctx.lineTo(-s, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawShard(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(0, -s * 1.8); ctx.lineTo(s * 0.7, 0);
    ctx.lineTo(0, s * 1.2); ctx.lineTo(-s * 0.7, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawStar(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a1 = (i / 5) * 6.2832 - 1.57, a2 = a1 + 0.628;
      ctx.lineTo(Math.cos(a1) * s * 1.6, Math.sin(a1) * s * 1.6);
      ctx.lineTo(Math.cos(a2) * s * 0.7, Math.sin(a2) * s * 0.7);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function drawMetal(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillRect(-s * 1.2, -s * 0.35, s * 2.4, s * 0.7);
    ctx.restore();
  }
  function drawRock(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.5); ctx.lineTo(-s * 0.2, -s);
    ctx.lineTo(s, -s * 0.2); ctx.lineTo(s * 0.5, s);
    ctx.lineTo(-s * 0.6, s * 0.8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawWind(ctx, x0, y0, x1, y1, s) {
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = Math.max(1, s * 0.4);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 - s * 2, x1, y1); ctx.stroke();
  }
  function drawImpact(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.2832;
      const r = i % 2 ? s * 0.6 : s * 1.8;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  M.VFX = VFX;
})();
