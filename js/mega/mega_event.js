/* =====================================================================
 * mega_event.js — Hệ thống sự kiện Boss (Phần 19)
 *
 *  HAI BỘ ĐẾM ĐỘC LẬP
 *  ─────────────────────────────────────────────────────────────
 *  A) GLOBAL (20:00) — đồng hồ toàn ván, chạy từ lúc bắt đầu chơi.
 *     Đạt 20:00 ⇒ tự động dịch chuyển sang Boss Dimension (19.2).
 *     KHÔNG reset khi chuyển scene / thoát game / tải lại (19.1).
 *
 *  B) RAID (05:00) — chỉ chạy khi đã ở trong Boss Dimension.
 *     Hết 5:00 hoặc bị Boss giết ⇒ đưa về đúng vị trí trước đó,
 *     HP phục hồi đúng bằng lúc bước vào trận (19.1).
 * ===================================================================== */
(function () {
  const M = (window.PS_MEGA = window.PS_MEGA || {});

  const GLOBAL_LIMIT = 20 * 60;   // 1200s
  const RAID_LIMIT = 5 * 60;      // 300s

  // Vùng đất theo hệ (19.3)
  const DIMENSION = {
    fire:     { name: 'Chiều Không Lửa',      sky1: '#3a0d00', sky2: '#ff6b35' },
    water:    { name: 'Chiều Không Nước',     sky1: '#001830', sky2: '#3aa0ff' },
    electric: { name: 'Chiều Không Điện',     sky1: '#20180a', sky2: '#ffd93d' },
    grass:    { name: 'Rừng Cổ Đại',          sky1: '#04170a', sky2: '#4cd964' },
    psychic:  { name: 'Chiều Không Tâm Linh', sky1: '#1a0030', sky2: '#ff5fa2' },
    ghost:    { name: 'Chiều Không U Minh',   sky1: '#0b0014', sky2: '#9b59b6' },
    dragon:   { name: 'Chiều Không Rồng',     sky1: '#0a0a2e', sky2: '#6f6bff' },
    dark:     { name: 'Chiều Không Bóng Tối', sky1: '#08060c', sky2: '#4a3a5c' },
    ice:      { name: 'Chiều Không Băng',     sky1: '#001a26', sky2: '#8fe3ff' },
    fairy:    { name: 'Chiều Không Tiên',     sky1: '#2a0026', sky2: '#ffb3e6' },
    steel:    { name: 'Chiều Không Kim Loại', sky1: '#0d1116', sky2: '#c8d3dc' },
    rock:     { name: 'Chiều Không Đá',       sky1: '#1a1206', sky2: '#c9a227' },
    ground:   { name: 'Chiều Không Đất',      sky1: '#1a1206', sky2: '#d9a066' },
    flying:   { name: 'Chiều Không Trời',     sky1: '#0a1a2e', sky2: '#a8d8ff' },
    fighting: { name: 'Chiều Không Võ Đạo',   sky1: '#1f0403', sky2: '#e74c3c' },
    bug:      { name: 'Chiều Không Côn Trùng', sky1: '#0e1606', sky2: '#a2d149' },
    poison:   { name: 'Chiều Không Độc',      sky1: '#160420', sky2: '#b05ecb' },
    normal:   { name: 'Chiều Không Trung Tính', sky1: '#161616', sky2: '#d9d9d9' },
  };

  const E = {
    // ---- trạng thái ----
    active: false,          // đang trong sự kiện boss
    global: GLOBAL_LIMIT,   // đếm ngược 20:00
    raid: RAID_LIMIT,       // đếm ngược 05:00 (chỉ khi active)
    form: null,
    saved: null,            // snapshot vị trí + HP lúc vào (19.5)
    phase: 'idle',          // idle | warn | warp | explore | battle | return | failed
    phaseT: 0,
    hpAtEntry: 100,
    warpFx: 0,
    msg: null,
    msgT: 0,
    lastPersist: 0,
    transitionLock: false,

    LIMITS: { global: GLOBAL_LIMIT, raid: RAID_LIMIT },
    DIMENSION,

    /* ------------------------------------------------------------ */
    /** Gọi 1 lần khi bắt đầu ván chơi mới */
    beginRun(opts) {
      opts = opts || {};
      this.active = false;
      this.phase = 'idle';
      this.saved = null;
      this.form = null;
      this._fired = false;
      const st = M.Save.data;
      if (st.event && st.event.runStart) {
        // khôi phục đồng hồ đã lưu (19.1: không reset khi tải lại game)
        const elapsed = (Date.now() - st.event.runStart) / 1000;
        this.global = Math.max(0, GLOBAL_LIMIT - elapsed);
      } else {
        st.event = st.event || {};
        st.event.runStart = Date.now();
        this.global = GLOBAL_LIMIT;
        M.Save.save();
      }
      this._persist(true);
      return this.global;
    },

    _persist(force) {
      const now = performance.now();
      if (!force && now - this.lastPersist < 2000) return;
      this.lastPersist = now;
      const st = M.Save.data;
      st.event = st.event || {};
      st.event.globalLeft = this.global;
      st.event.raidLeft = this.raid;
      st.event.phase = this.phase;
      st.event.active = this.active;
      st.event.formId = this.form ? this.form.id : null;
      st.event.hpAtEntry = this.hpAtEntry;
      st.event.saved = this.saved;
      if (!this.active) st.event.raidLeft = null;
      M.Save.save();
    },

    /** Khôi phục trạng thái khi tải lại giữa sự kiện (19.1) */
    resumeFromSave() {
      const st = M.Save.data.event;
      if (!st || !st.active || !st.formId) return false;
      const form = M.BY_ID[st.formId];
      if (!form) return false;
      this.form = form;
      this.active = true;
      this.phase = 'explore';
      this.raid = Math.max(0, st.raidLeft != null ? st.raidLeft : RAID_LIMIT);
      this.hpAtEntry = st.hpAtEntry || 100;
      this.saved = st.saved || null;
      this.global = st.globalLeft != null ? st.globalLeft : GLOBAL_LIMIT;
      this._flash('Đã trở lại ' + this.dimName() + ' · còn ' + fmt(this.raid));
      return true;
    },

    dimName() {
      if (!this.form) return '';
      const d = DIMENSION[this.form.types[0]] || DIMENSION.normal;
      const d2 = this.form.types[1] ? DIMENSION[this.form.types[1]] : null;
      return d2 ? d.name + ' / ' + d2.name : d.name;
    },

    dimColors() {
      const d = (this.form && DIMENSION[this.form.types[0]]) || DIMENSION.normal;
      const d2 = this.form && this.form.types[1] ? DIMENSION[this.form.types[1]] : null;
      return { c1: d.sky1, c2: d.sky2, c3: d2 ? d2.sky2 : d.sky2 };
    },

    _flash(msg) {
      this.msg = msg;
      this.msgT = 3.2;
      if (M.UI && M.UI.toast) M.UI.toast(msg, 3200);
    },

    /* ------------------------------------------------------------ */
    update(dt) {
      if (!this.active) {
        // đồng hồ 20:00 chạy liên tục
        if (this.global > 0) {
          this.global = Math.max(0, this.global - dt);
          this._persist(false);
        }
        if (this.global <= 0 && !this.transitionLock && !this._fired) {
          this._fired = true;
          this.onGlobalReached();
        }
        if (this.msgT > 0) this.msgT -= dt;
        return;
      }

      // đang trong sự kiện: cả 2 đồng hồ
      this.global = Math.max(0, this.global - dt);
      this.raid = Math.max(0, this.raid - dt);
      this.phaseT += dt;
      this.warpFx = Math.max(0, this.warpFx - dt * 1.5);
      if (this.msgT > 0) this.msgT -= dt;
      this._persist(false);

      if (this.raid <= 0 && this.phase !== 'return' && this.phase !== 'failed') {
        this.fail('Hết 5 phút — chưa hạ được Boss');
      }
    },

    /* ------------------------------------------------------------ */
    /** Mốc 20:00 → bắt buộc dịch chuyển (19.2) */
    onGlobalReached() {
      if (this.transitionLock) return;
      this.transitionLock = true;
      // chọn boss: ưu tiên boss chưa hạ, tier cao nhất
      const pool = M.FORMS.filter((f) => !M.Save.isBossDefeated(f.id));
      const pick = (pool.length ? pool : M.FORMS).slice().sort((a, b) => (b.tier || 2) - (a.tier || 2))[0];
      this.warpTo(pick, { auto: true });
    },

    /* ------------------------------------------------------------ */
    /** Snapshot vị trí hiện tại để trả về đúng chỗ (19.5) */
    _getPlayer() {
      const E0 = M.ENG && M.ENG();
      if (!E0) return null;
      try { if (typeof E0.getPlayer === 'function') return E0.getPlayer(); } catch (e) {}
      if (E0.Player && E0.Player.inst) return E0.Player.inst;
      return null;
    },

    _snapshot() {
      const E0 = M.ENG && M.ENG();
      const p = this._getPlayer();
      const snap = {
        scene: (E0 && E0.Scene && E0.Scene.current) || 'game',
        x: p && typeof p.x === 'number' ? p.x : 0,
        y: p && typeof p.y === 'number' ? p.y : 0,
        dir: p && typeof p.dir === 'number' ? p.dir : 0,
        hp: p && typeof p.hp === 'number' ? p.hp : null,
        hpMax: p && typeof p.hpMax === 'number' ? p.hpMax : null,
        ts: Date.now(),
      };
      return snap;
    },

    /** Dịch chuyển vào Boss Dimension */
    warpTo(form, opts) {
      if (this.transitionLock && !opts.force) return false;
      opts = opts || {};
      this.form = form;
      this.saved = this._snapshot();
      this.hpAtEntry = this.saved.hp != null ? this.saved.hp : 100;
      this.active = true;
      this.phase = 'warp';
      this.phaseT = 0;
      this.warpFx = 1.6;
      this.raid = RAID_LIMIT;
      this.transitionLock = true;
      this._persist(true);

      M.Sound && M.Sound.bossStart && M.Sound.bossStart();
      this._flash('Cổng không gian mở — ' + this.dimName());

      // hiệu ứng cổng rồi mới cho xuất hiện
      setTimeout(() => {
        this.phase = 'explore';
        this.phaseT = 0;
        this.transitionLock = false;
        this._flash('Đã đến ' + this.dimName() + ' · Boss: ' + form.form + ' · giới hạn ' + fmt(RAID_LIMIT));
      }, 1500);
      return true;
    },

    /** Bắt đầu trận đánh thật */
    startBattle() {
      if (!this.form) return false;
      this.phase = 'battle';
      this.phaseT = 0;
      M.Boss.start(this.form, null, (r) => {
        if (r && r.win) this.onWin();
        else this.fail('Bạn đã bị Boss hạ');
      });
      return true;
    },

    onWin() {
      this.phase = 'return';
      this.phaseT = 0;
      this._flash('Đã hạ ' + (this.form ? this.form.form : 'Boss') + '! Đang trở về…');
      setTimeout(() => this.returnHome(true), 1800);
    },

    /** Bị giết / hết giờ → trả về đúng chỗ cũ, HP như lúc vào (19.1) */
    fail(reason) {
      if (this.phase === 'return' || this.phase === 'failed') return;
      this.phase = 'failed';
      this.phaseT = 0;
      this._flash(reason + ' — trở về vị trí cũ');
      setTimeout(() => this.returnHome(false), 1600);
    },

    /** Trở về vị trí ban đầu */
    returnHome(success) {
      const snap = this.saved;
      const p0 = this._getPlayer();
      if (snap && p0) {
        const p = p0;
        try {
          if (typeof p.setPos === 'function') p.setPos(snap.x, snap.y);
          else { p.x = snap.x; p.y = snap.y; }
          if (snap.dir != null && 'dir' in p) p.dir = snap.dir;
          // HP trả đúng như lúc vào trận (19.1)
          if (snap.hp != null && 'hp' in p) p.hp = snap.hp;
        } catch (e) { console.warn('[Mega] return pos fail', e); }
      }
      this.active = false;
      this.phase = 'idle';
      this.saved = null;
      this.raid = RAID_LIMIT;
      this.transitionLock = false;
      this.warpFx = 1.4;
      const st = M.Save.data;
      if (st.event) { st.event.active = false; st.event.raidLeft = null; }
      M.Save.save();
      if (M.Game && M.Game._ov) M.Game._ov.style.display = 'none';
      this._flash(success ? 'Đã trở về vị trí ban đầu' : 'Trở về an toàn · HP đã khôi phục');
    },

    /** Huỷ sự kiện (dùng cho nút thoát) */
    abort() { if (this.active) this.returnHome(false); },

    /* ------------------------------------------------------------ */
    /** Vẽ HUD đếm giờ (19.1) + cảnh báo + hiệu ứng cổng */
    draw(ctx, W, H) {
      const t = performance.now() / 1000;

      // ---- hiệu ứng cổng không gian
      if (this.warpFx > 0) {
        const k = this.warpFx / 1.6;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const cx = W / 2, cy = H / 2;
        const cols = this.form ? this.dimColors() : { c2: '#8b5cf6' };
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = k * (0.5 - i * 0.12);
          ctx.strokeStyle = cols.c2;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, (1 - k) * W * 0.85 + i * 30, 0, 6.2832);
          ctx.stroke();
        }
        ctx.globalAlpha = k * 0.6;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, cols.c2); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // ---- thông báo
      if (this.msgT > 0 && this.msg) {
        ctx.save();
        const a = Math.min(1, this.msgT);
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(8,10,18,.82)';
        const pw = Math.min(W - 40, 420);
        ctx.fillRect(W / 2 - pw / 2, H * 0.13, pw, 34);
        ctx.strokeStyle = 'rgba(140,170,255,.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(W / 2 - pw / 2, H * 0.13, pw, 34);
        ctx.fillStyle = '#dbe6ff';
        ctx.font = '600 12.5px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.msg, W / 2, H * 0.13 + 22);
        ctx.textAlign = 'left';
        ctx.restore();
      }

      // ---- đồng hồ 05:00 trong sự kiện
      if (this.active && (this.phase === 'explore' || this.phase === 'battle')) {
        const ratio = this.raid / RAID_LIMIT;
        const bw = Math.min(W * 0.72, 320), bh = 30;
        const x = W / 2 - bw / 2, y = 12;
        ctx.save();
        ctx.fillStyle = 'rgba(6,8,16,.86)';
        ctx.fillRect(x, y, bw, bh);
        ctx.strokeStyle = ratio < 0.25 ? '#ff4d6d' : 'rgba(150,180,255,.55)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
        // thanh thời gian
        ctx.fillStyle = ratio < 0.25 ? '#ff4d6d' : ratio < 0.5 ? '#ffb703' : '#4cd964';
        ctx.globalAlpha = 0.28;
        ctx.fillRect(x + 2, y + 2, (bw - 4) * ratio, bh - 4);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⏱ ' + fmt(this.raid) + '  ·  ' + (this.form ? this.form.form : ''), W / 2, y + 20);
        ctx.font = '10px system-ui';
        ctx.fillStyle = '#9fb0d0';
        ctx.fillText(this.dimName(), W / 2, y + bh + 12);
        ctx.textAlign = 'left';
        ctx.restore();
      }

      // ---- cảnh báo mốc 20:00 (60 giây cuối)
      if (!this.active && this.global > 0 && this.global <= 60) {
        const a = 0.55 + Math.sin(t * 5) * 0.35;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(60,0,0,.85)';
        const bw = Math.min(W - 30, 340);
        ctx.fillRect(W / 2 - bw / 2, 10, bw, 30);
        ctx.strokeStyle = '#ff4d6d';
        ctx.strokeRect(W / 2 - bw / 2, 10, bw, 30);
        ctx.fillStyle = '#ffd0d8';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ Cổng Boss mở sau ' + fmt(this.global), W / 2, 30);
        ctx.textAlign = 'left';
        ctx.restore();
      }
    },
  };

  function fmt(s) {
    s = Math.max(0, Math.ceil(s));
    const m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  M.Event = E;
  M.fmtTime = fmt;
})();
