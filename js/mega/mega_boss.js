/* =====================================================================
 * mega_boss.js — Boss Battle 2D thật (arena riêng, AI, hitbox, HP)
 *
 * Boss dùng sprite Mega của chính nó (assets/mega/<id>/…) ở scale lớn.
 * Người chơi dùng sprite thường trong game (G.Sprites) hoặc Mega đang active.
 *
 * Điều khiển: WASD / phím mũi tên / chạm-vuốt trên màn hình.
 * Tấn công: Space / phím J / nút ATTACK.
 *
 * Thắng -> M.Save.defeatBoss + addStone + unlock  (RULE 3)
 * ===================================================================== */
(function () {
  const M = (window.PS_MEGA = window.PS_MEGA || {});
  let T = M.T;

  const TIER = {
    1: { hp: 620, atk: 9, spd: 55, size: 1.55, ai: 1.0 },
    2: { hp: 900, atk: 12, spd: 62, size: 1.7, ai: 1.15 },
    3: { hp: 1250, atk: 15, spd: 70, size: 1.85, ai: 1.3 },
    4: { hp: 1700, atk: 19, spd: 78, size: 2.0, ai: 1.5 },
  };

  const B = {
    open: false,
    form: null,
    cfg: null,
    time: 0,
    state: 'intro',        // intro | fight | win | lose
    stateT: 0,
    result: null,          // {win:bool, reward:object}
    hud: { hp: 0, hpMax: 0, bossHp: 0, bossHpMax: 0, bossName: '', pips: 0, pipsMax: 0 },

    // actors
    player: null,
    boss: null,
    projectiles: [],
    hitFx: [],

    // input
    keys: {},
    touch: { active: false, x: 0, y: 0, dx: 0, dy: 0, startX: 0, startY: 0 },
    buttons: [],
    onEnd: null,

    /* ---------------------------------------------------------------- */
    start(form, playerDex, onEnd) {
      if (!form) return false;
      M.Save.load();
      const cfg = TIER[form.tier] || TIER[2];
      this.form = form;
      this.cfg = cfg;
      this.onEnd = onEnd || null;
      this.open = true;
      this.time = 0;
      this.state = 'intro';
      this.stateT = 0;
      this.result = null;
      this.projectiles.length = 0;
      this.hitFx.length = 0;
      this.playerDex = playerDex || this._defaultDex(form);

      this.player = {
        x: 0, y: 150, vx: 0, vy: 0, dir: 4,
        hp: 100, hpMax: 100, atk: 14, shield: 0,
        anim: 'Idle', animT: 0, frame: 0, frameT: 0,
        invuln: 0, cooldown: 0, megaCharge: 0,
        flash: 0, hitFlash: 0,
      };
      this.boss = {
        x: 0, y: -170, vx: 0, vy: 0, dir: 0,
        hp: cfg.hp, hpMax: cfg.hp,
        atk: cfg.atk, state: 'idle', stateT: 0,
        frame: 0, frameT: 0, anim: 'Idle', dir: 0,
        flash: 0, rage: 0, telegraph: 0,
      };
      this.hud.hp = 100; this.hud.hpMax = 100;
      this.hud.bossHp = cfg.hp; this.hud.bossHpMax = cfg.hp;
      this.hud.bossName = form.form;

      M.Spr.preload(form.id, ['Idle', 'Walk', 'Attack', 'Charge', 'Hurt', 'Faint'])
        .then(() => { /* sẵn sàng */ });

      M.Sound && M.Sound.bossStart && M.Sound.bossStart();
      return true;
    },

    _defaultDex(form) {
      // dex gốc của form (ví dụ Charizard = 6)
      if (M.DEX_MAP && M.DEX_MAP[form.pokemon]) return M.DEX_MAP[form.pokemon];
      return form.dex;
    },

    end(win, reason) {
      if (this.state === 'win' || this.state === 'lose') return;
      this.state = win ? 'win' : 'lose';
      this.stateT = 0;
      const form = this.form;
      let reward = null;

      if (win) {
        M.Save.defeatBoss(form.id);
        M.Save.addStone(form.stone);
        M.Save.unlock(form.id);
        M.Save.data.party[form.dex] = true;
        M.Save.save();
        reward = {
          stone: form.stone ? M.Stones.nameOf(form) : null,
          form: form.form,
          bossDefeated: true,
        };
      }
      this.result = { win, reason: reason || '', reward };
      M.Sound && M.Sound[win ? 'win' : 'lose'] && M.Sound[win ? 'win' : 'lose']();
    },

    close() {
      this.open = false;
      if (M.Game && M.Game._ov) M.Game._ov.style.display = 'none';
      const r = this.result;
      if (this.onEnd) { const f = this.onEnd; this.onEnd = null; f(r); }
    },

    /* ---------------------------------------------------------------- */
    key(code, down) {
      this.keys[code] = down;
    },

    _input() {
      const k = this.keys;
      const left = k['KeyA'] || k['ArrowLeft'] || (this.touch.active && this.touch.dx < -18);
      const right = k['KeyD'] || k['ArrowRight'] || (this.touch.active && this.touch.dx > 18);
      const up = k['KeyW'] || k['ArrowUp'] || (this.touch.active && this.touch.dy < -18);
      const down = k['KeyS'] || k['ArrowDown'] || (this.touch.active && this.touch.dy > 18);
      let x = (right ? 1 : 0) - (left ? 1 : 0);
      let y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x && y) { x *= 0.7071; y *= 0.7071; }
      return { x, y, atk: !!(k['Space'] || k['KeyJ'] || k['KeyK']) };
    },

    /* ---------------------------------------------------------------- */
    update(dt) {
      if (!this.open) return;
      this.time += dt;
      this.stateT += dt;

      if (this.state === 'intro' && this.stateT > 1.2) { this.state = 'fight'; this.stateT = 0; }
      if (this.state === 'win' && this.stateT > 2.4) { this.close(); return; }
      if (this.state === 'lose' && this.stateT > 2.4) { this.close(); return; }

      const fighting = this.state === 'fight';
      const p = this.player, b = this.boss;

      // ---- player anim tick
      this._tickPlayer(p, dt);

      if (!fighting) { if (p) this._residual(dt); return; }

      // ---- player move
      const inp = this._input();
      const SPD = 205;
      p.vx = inp.x * SPD; p.vy = inp.y * SPD;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const R = this._bounds();
      p.x = Math.max(-R.w, Math.min(R.w, p.x));
      p.y = Math.max(-60, Math.min(R.h, p.y));
      if (inp.x || inp.y) {
        p.dir = M.Spr.dir(Math.atan2(inp.y, inp.x) + Math.PI / 2);
        p.anim = 'Walk';
        M.VFX.trail(this.form.types[0], this.form.types[1], p.x, p.y - 20, inp.x, inp.y);
      } else {
        p.anim = 'Idle';
      }

      p.cooldown -= dt;
      p.invuln -= dt;
      p.flash = Math.max(0, p.flash - dt);
      p.megaCharge = Math.min(1, p.megaCharge + dt * 0.08);

      if (inp.atk && p.cooldown <= 0) this._playerAttack();

      // ---- boss AI
      this._bossAI(dt);

      // ---- projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
        if (pr.hit) pr.hit -= dt;
        if (pr.owner === 'boss') {
          const d = Math.hypot(pr.x - p.x, pr.y - (p.y - 18));
          if (d < pr.r + 16 && p.invuln <= 0 && !pr.dead) {
            this._damagePlayer(pr.dmg);
            pr.dead = true;
            M.VFX.burst(pr.type, null, pr.x, pr.y, 0.8);
          }
        } else {
          const d = Math.hypot(pr.x - b.x, pr.y - (b.y - 40));
          if (d < pr.r + 34 && !pr.dead) {
            this._damageBoss(pr.dmg);
            pr.dead = true;
            M.VFX.burst(this.form.types[0], this.form.types[1], pr.x, pr.y, 0.7);
          }
        }
        if (pr.life <= 0 || pr.dead || Math.abs(pr.x) > 900 || Math.abs(pr.y) > 900) {
          if (pr.dead) M.VFX.burst(pr.type || 'normal', null, pr.x, pr.y, 0.5);
          this.projectiles.splice(i, 1);
        }
      }

      // ---- fx
      M.VFX.update(dt);
      for (let i = this.hitFx.length - 1; i >= 0; i--) {
        const h = this.hitFx[i]; h.t += dt;
        if (h.t > h.life) this.hitFx.splice(i, 1);
      }

      // ---- hud
      this.hud.hp = p.hp; this.hud.hpMax = p.hpMax;
      this.hud.bossHp = b.hp; this.hud.bossHpMax = b.hpMax;
    },

    _residual(dt) { M.VFX.update(dt); },

    _tickPlayer(p, dt) {
      if (!p) return;
      p.frameT += dt * 60;
      const am = M.Spr.metaOf && null;
      // dùng animator của game nếu có sprite thường
      const E = M.ENG && M.ENG(); if (!E || !E.Sprites) return;
    },

    _bounds() {
      const E = M.ENG && M.ENG(); const c = E && E.Camera;
      const w = c ? (c.VIEW_W || 768) / 2 - 80 : 360;
      return { w, h: 230 };
    },

    _playerAttack() {
      const p = this.player;
      p.cooldown = 0.42;
      p.anim = 'Attack';
      M.Sound && M.Sound.hit && M.Sound.hit();
      const b = this.boss;
      const ang = Math.atan2((b.y - 40) - (p.y - 18), b.x - p.x);
      const t = this.form.types;
      for (let i = 0; i < 2; i++) {
        const a = ang + (i ? 0.16 : -0.16);
        this.projectiles.push({
          owner: 'player', x: p.x, y: p.y - 18,
          vx: Math.cos(a) * 420, vy: Math.sin(a) * 420,
          r: 9, dmg: p.atk * (0.85 + Math.random() * 0.3), life: 1.6,
          type: t[i % t.length],
        });
      }
      M.VFX.burst(t[0], t[1], p.x, p.y - 18, 0.45);
    },

    _bossAI(dt) {
      const b = this.boss, p = this.player, cfg = this.cfg;
      b.stateT += dt;
      b.flash = Math.max(0, b.flash - dt);
      const rageBonus = b.hp / b.hpMax < 0.35 ? 1.6 : 1.0;
      const aiSpeed = cfg.ai;

      switch (b.state) {
        case 'idle': {
          b.anim = 'Idle';
          if (b.stateT > 0.6 / aiSpeed) { b.state = 'chase'; b.stateT = 0; }
          break;
        }
        case 'chase': {
          b.anim = 'Walk';
          const dx = p.x - b.x, dy = (p.y - 120) - b.y;
          const d = Math.hypot(dx, dy) || 1;
          b.vx = (dx / d) * cfg.spd * rageBonus;
          b.vy = (dy / d) * cfg.spd * rageBonus * 0.7;
          b.x += b.vx * dt; b.y += b.vy * dt;
          b.dir = M.Spr.dir(Math.atan2(dy, dx) + Math.PI / 2);
          if (b.stateT > 1.4 / aiSpeed) {
            b.state = Math.random() < 0.55 ? 'telegraph' : 'special';
            b.stateT = 0;
            b.telegraph = b.state === 'telegraph' ? 0.55 : 0.8;
          }
          break;
        }
        case 'telegraph': {
          b.anim = 'Charge';
          b.telegraph -= dt;
          if (b.telegraph <= 0) { b.state = 'attack'; b.stateT = 0; }
          break;
        }
        case 'attack': {
          b.anim = 'Attack';
          if (b.stateT < dt * 1.5) {
            // bắn 3 đạn toả
            const base = Math.atan2((p.y - 18) - (b.y - 40), p.x - b.x);
            for (let i = -1; i <= 1; i++) {
              const a = base + i * 0.32;
              this.projectiles.push({
                owner: 'boss', x: b.x, y: b.y - 40,
                vx: Math.cos(a) * 260 * rageBonus, vy: Math.sin(a) * 260 * rageBonus,
                r: 11, dmg: cfg.atk, life: 2.2, type: this.form.types[0],
              });
            }
            M.VFX.burst(this.form.types[0], this.form.types[1], b.x, b.y - 40, 1.0);
            M.Sound && M.Sound.bossAtk && M.Sound.bossAtk();
          }
          if (b.stateT > 0.55) { b.state = 'idle'; b.stateT = 0; }
          break;
        }
        case 'special': {
          b.anim = 'Charge';
          b.telegraph -= dt;
          if (b.telegraph <= 0) {
            b.anim = 'Shoot';
            // đạn tỏa tròn 10 hướng
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * 6.2832 + this.time;
              this.projectiles.push({
                owner: 'boss', x: b.x, y: b.y - 40,
                vx: Math.cos(a) * 190 * rageBonus, vy: Math.sin(a) * 190 * rageBonus,
                r: 10, dmg: cfg.atk * 0.7, life: 2.6,
                type: this.form.types[1] || this.form.types[0],
              });
            }
            M.VFX.burst(this.form.types[1] || this.form.types[0], this.form.types[0],
              b.x, b.y - 40, 1.6);
            M.Sound && M.Sound.bossSpecial && M.Sound.bossSpecial();
            b.state = 'idle'; b.stateT = 0;
          }
          break;
        }
        case 'hurt': {
          b.anim = 'Hurt';
          if (b.stateT > 0.3) { b.state = 'chase'; b.stateT = 0; }
          break;
        }
        case 'defeat': {
          b.anim = 'Faint';
          break;
        }
      }

      // chạm người chơi -> sát thương
      const d = Math.hypot(p.x - b.x, b.y - (p.y - 18));
      if (d < 40 + 20 && p.invuln <= 0 && b.state !== 'defeat') {
        this._damagePlayer(cfg.atk * 0.6);
      }
    },

    _damageBoss(dmg) {
      const b = this.boss;
      b.hp -= dmg;
      b.flash = 0.12;
      b.state = b.hp > 0 ? 'hurt' : 'defeat';
      b.stateT = 0;
      M.VFX.burst(this.form.types[0], this.form.types[1], b.x, b.y - 40, 0.5);
      if (b.hp <= 0) {
        b.hp = 0;
        M.VFX.burst(this.form.types[0], this.form.types[1], b.x, b.y - 40, 3.0);
        M.Cam && M.Cam.shake(14, 0.9);
        this.end(true, 'boss_defeated');
      }
    },

    _damagePlayer(dmg) {
      const p = this.player;
      p.hp -= dmg;
      p.invuln = 0.7;
      p.flash = 0.25;
      M.Cam && M.Cam.shake(9, 0.4);
      M.Sound && M.Sound.hurt && M.Sound.hurt();
      if (p.hp <= 0) {
        p.hp = 0;
        this.end(false, 'player_defeated');
      }
    },

    /* ---------------------------------------------------------------- */
    /** Vẽ arena. Gọi trong không gian màn hình (sau khi camera reset). */
    draw(ctx, W, H) {
      if (!this.open) return;
      const t = this.time;
      const form = this.form;

      // ---- nền
      const g = ctx.createLinearGradient(0, 0, 0, H);
      const c1 = M.Stones.colorOf(form);
      g.addColorStop(0, M.T.shade(c1, 0.18));
      g.addColorStop(0.55, '#0d0f16');
      g.addColorStop(1, '#05060a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // background chuyển động (parallax)
      ctx.save();
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < 3; i++) {
        const off = ((t * (18 + i * 12)) % (W + 400)) - 200;
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.ellipse(W * 0.5 + Math.sin(t * 0.3 + i) * 90, H * (0.25 + i * 0.18) + off * 0.1,
          W * (0.42 - i * 0.08), 90 - i * 18, 0, 0, 6.2832);
        ctx.fill();
      }
      ctx.restore();

      // ---- nền sàn
      const cx = W / 2, cy = H * 0.5;
      ctx.save();
      ctx.strokeStyle = M.T.hexA(c1, 0.18);
      ctx.lineWidth = 1;
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - 40);
        ctx.lineTo(cx + i * 140, cy + 260);
        ctx.stroke();
      }
      for (let i = 1; i <= 5; i++) {
        const yy = cy - 40 + Math.pow(i / 5, 1.7) * 300;
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
      }
      ctx.restore();

      // ---- boss
      const b = this.boss;
      const scale = this.cfg.size * (W / 768);
      M.Spr.draw(ctx, form.id, b.anim, cx + b.x * (W / 768), cy + b.y * (W / 768), {
        frame: (t * 8 | 0) % 3, dir: b.dir, flash: b.flash > 0 || b.state === 'telegraph',
        flashAlpha: b.state === 'telegraph' ? 0.4 : 0.8, scale,
      });
      if (b.state === 'telegraph') {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(t * 30) * 0.3;
        ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx + b.x * (W / 768), cy + b.y * (W / 768) - 40, 70 * scale / 2, 26 * scale / 2, 0, 0, 6.2832);
        ctx.stroke();
        ctx.restore();
      }

      // ---- player
      const p = this.player;
      const px = cx + p.x * (W / 768), py = cy + p.y * (W / 768);
      if (p.invuln > 0) ctx.globalAlpha = 0.55 + Math.sin(t * 40) * 0.35;
      this._drawPlayer(ctx, px, py, t);
      ctx.globalAlpha = 1;

      // ---- projectiles
      for (const pr of this.projectiles) {
        const st = M.VFX.style(pr.type);
        const x = cx + pr.x * (W / 768), y = cy + pr.y * (W / 768);
        const g2 = ctx.createRadialGradient(x, y, 0, x, y, pr.r * 2.4);
        g2.addColorStop(0, st.c1); g2.addColorStop(0.5, st.c2); g2.addColorStop(1, M.T.hexA(st.c3, 0));
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(x, y, pr.r * 2.4, 0, 6.2832); ctx.fill();
      }

      // ---- VFX
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(W / 768, W / 768);
      M.VFX.draw(ctx);
      ctx.restore();

      // ---- HUD
      this._drawHUD(ctx, W, H, t);

      // ---- trạng thái
      if (this.state === 'intro') {
        this._overlayText(ctx, W, H, form.form.toUpperCase(), 'BOSS BATTLE',
          Math.min(1, this.stateT / 0.5), M.Stones.colorOf(form));
      }
      if (this.state === 'win') {
        this._overlayText(ctx, W, H, 'CHIẾN THẮNG!', 'Đã mở khoá ' + form.form, Math.min(1, this.stateT / 0.4), '#ffd93d');
      }
      if (this.state === 'lose') {
        this._overlayText(ctx, W, H, 'THẤT BẠI', 'Thử lại sau', Math.min(1, this.stateT / 0.4), '#ff5050');
      }
    },

    _drawPlayer(ctx, x, y, t) {
      const p = this.player;
      // Mega đang active? -> vẽ sprite mega; nếu không -> sprite thường của game
      const activeForm = M.Save.getActive(this.form.dex);
      if (activeForm) {
        M.Spr.draw(ctx, activeForm, p.anim, x, y, {
          frame: (t * 10 | 0) % 3, dir: p.dir, scale: 1.25 * (window.innerWidth > 0 ? 1 : 1),
        });
        return;
      }
      // sprite thường dùng G.Sprites.Animator nếu có
      const E = M.ENG && M.ENG();
      if (E && E.Sprites && E.Sprites.Animator && this.playerDex) {
        if (!this._anim) this._anim = new E.Sprites.Animator(this.playerDex, 1.55);
        this._anim.loop(p.anim === 'Walk' ? 'Walk' : 'Idle', p.anim === 'Walk' ? 1.2 : 1);
        this._anim.dir = p.dir;
        try { this._anim.draw(ctx, x, y, { flash: p.flash > 0 }); }
        catch (e) { this._fallbackPlayer(ctx, x, y, t); }
        return;
      }
      this._fallbackPlayer(ctx, x, y, t);
    },

    _fallbackPlayer(ctx, x, y, t) {
      const c = '#4fc3f7';
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x, y - 34, 12, 0, 6.2832); ctx.fill();
      ctx.fillRect(x - 8, y - 24, 16, 22);
      ctx.fillStyle = '#222';
      ctx.fillRect(x - 7, y - 2, 6, 4); ctx.fillRect(x + 1, y - 2, 6, 4);
    },

    _drawHUD(ctx, W, H, t) {
      const pad = 12;
      // boss bar
      const bw = W - pad * 2;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(pad, pad, bw, 26);
      const kr = Math.max(0, this.boss.hp / this.boss.hpMax);
      const gg = ctx.createLinearGradient(pad, 0, pad + bw, 0);
      gg.addColorStop(0, '#ff4d6d'); gg.addColorStop(1, '#ffb703');
      ctx.fillStyle = gg;
      ctx.fillRect(pad + 2, pad + 2, (bw - 4) * kr, 22);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
      ctx.strokeRect(pad + 0.5, pad + 0.5, bw - 1, 25);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui,sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(this.boss.form.form + '  Lv.' + (this.boss.hpMax / 10 | 0), pad + 8, pad + 17);

      // player bar
      const pw = Math.min(240, W * 0.5);
      const py = H - pad - 24;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(pad, py, pw, 18);
      const kp = Math.max(0, this.player.hp / this.player.hpMax);
      ctx.fillStyle = kp > 0.5 ? '#4cd964' : kp > 0.25 ? '#ffd93d' : '#ff5050';
      ctx.fillRect(pad + 2, py + 2, (pw - 4) * kp, 14);
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.strokeRect(pad + 0.5, py + 0.5, pw, 18);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui';
      ctx.fillText('HP ' + Math.ceil(this.player.hp) + '/' + this.player.hpMax, pad + 6, py + 14);

      // nút tấn công (góc phải dưới)
      const br = 34;
      const bx = W - pad - br, by = H - pad - br;
      ctx.fillStyle = 'rgba(255,120,90,.85)';
      ctx.beginPath(); ctx.arc(bx, by, br, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('TẤN', bx, by + 1);
      ctx.fillText('CÔNG', bx, by + 14);
      ctx.textAlign = 'left';
      this._btn = { x: bx, y: by, r: br };
    },

    _overlayText(ctx, W, H, title, sub, k, color) {
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(0, H * 0.36, W, H * 0.22);
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.font = 'bold ' + Math.round(W * 0.06) + 'px system-ui,sans-serif';
      ctx.fillText(title, W / 2, H * 0.46);
      ctx.fillStyle = '#fff';
      ctx.font = Math.round(W * 0.035) + 'px system-ui,sans-serif';
      ctx.fillText(sub, W / 2, H * 0.52);
      ctx.textAlign = 'left';
      ctx.restore();
    },

    /* ---------------------------------------------------------------- */
    /** Pointer events từ canvas game */
    pointer(type, x, y) {
      if (!this.open) return false;
      const btn = this._btn;
      if (type === 'down') {
        if (btn && Math.hypot(x - btn.x, y - btn.y) < btn.r * 1.3) {
          this.keys['Space'] = true;
          setTimeout(() => { this.keys['Space'] = false; }, 90);
          return true;
        }
        this.touch.active = true;
        this.touch.startX = this.touch.x = x;
        this.touch.startY = this.touch.y = y;
        this.touch.dx = this.touch.dy = 0;
        return true;
      }
      if (type === 'move') {
        if (!this.touch.active) return false;
        this.touch.x = x; this.touch.y = y;
        this.touch.dx = x - this.touch.startX;
        this.touch.dy = y - this.touch.startY;
        return true;
      }
      if (type === 'up') {
        this.touch.active = false; this.touch.dx = this.touch.dy = 0;
        return true;
      }
      return false;
    },
  };

  M.Boss = B;
})();
