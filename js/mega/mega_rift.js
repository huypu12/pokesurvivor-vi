/* =====================================================================
 * mega_rift.js — Nối Mega vào HỆ THỐNG GRIETA (G.Rift) CÓ SẴN của game
 *
 * KHÔNG tạo sàn đấu riêng, KHÔNG thêm nút "đánh boss" vào menu.
 * Dùng đúng những gì game đã có:
 *   • G.Game.st.time  — đồng hồ HUD (hiện ở góc màn hình)
 *   • G.Rift          — hệ thống Grieta: cổng → arena → boss → về chỗ cũ
 *
 * LUẬT (Phần 19):
 *  • st.time >= 20:00 (1200s)  →  tự mở Grieta dẫn tới BOSS MEGA.
 *    Trước mốc này, Rift vẫn chạy bình thường như game cũ.
 *  • Trong arena, giới hạn 05:00 (300s) thay cho 120s mặc định.
 *  • Thắng  → mở khoá Mega + trao đá.
 *  • Hết giờ / chết → G.Rift.lost() → finish() đưa về đúng chỗ cũ.
 *    Máu giữ nguyên vì game tự khôi phục khi rời arena.
 * ===================================================================== */
(function () {
  const M = (window.PS_MEGA = window.PS_MEGA || {});

  const MEGA_AT = 20 * 60;    // 20:00 — mốc bắt buộc mở cổng
  const MEGA_TIME = 5 * 60;   // 05:00 — giới hạn trong arena

  const R = {
    fired: false,
    form: null,          // form Mega đang nhắm tới
    inArena: null,       // form đang đánh (null nếu arena thường)
    hookedArena: null,   // tham chiếu arena đã hook
    warned60: false,

    /* ------------------------------------------------------------ */
    _pickForm() {
      // Ưu tiên form chưa mở khoá, tier cao nhất
      const pool = M.FORMS.filter((f) => !M.Save.isUnlocked(f.id));
      const list = pool.length ? pool : M.FORMS;
      const score = (f) => (f.tier || 2) * 100 - (M.Save.isBossDefeated(f.id) ? 0 : 0);
      return list.slice().sort((a, b) => score(b) - score(a))[0];
    },

    /** Gọi mỗi frame */
    tick(st) {
      if (!st || !G || !G.Rift) return;
      const t = st.time || 0;

      // --- cảnh báo 60 giây cuối (hiển thị bằng FX của game)
      if (!this.fired && t >= MEGA_AT - 60 && !this.warned60) {
        this.warned60 = true;
        try {
          G.Spawner.say('¡Cổng MEGA mở sau 60 giây!', 3, true);
          G.Audio.sfx('rift');
        } catch (e) {}
      }

      // --- mốc 20:00
      if (!this.fired && t >= MEGA_AT) {
        this.fired = true;
        this.openPortal();
      }

      // --- trong arena: gia hạn lên 5 phút
      const a = G.Rift.arena;
      if (a) {
        // arena đầu tiên sau mốc 20:00 → biến thành arena Mega
        if (!a.__hooked) {
          if (this.fired && this.form) this.hookArena(a);
          else a.__hooked = 'normal';
        }
        if (a.__mega && a.phase === 'fight' && a.t > MEGA_TIME) {
          try { G.Rift.onEvent(['al']); } catch (e) {}
        }
      }
    },

    /** Mở cổng tới arena Mega */
    openPortal() {
      const f = (this.form = this._pickForm());
      try {
        G.Rift.debugNextType(f.types[0]);
        G.Rift.debugOpen();
      } catch (e) { console.warn('[Mega] openPortal', e); }
      try {
        G.Spawner.say('⚠ ¡GRIETA MEGA! Entra y vence a ' + f.form, 4, true);
        G.Audio.sfx('rift');
        G.Game.flash('#c9a6ff', 1.0);
      } catch (e) {}
      M.UI && M.UI.toast('⚠ Cổng MEGA đã mở — vào cổng để đấu ' + f.form, 5000);
      M.Sound && M.Sound.bossStart();
    },

    /** Khi arena của game đã dựng xong: biến nó thành arena Mega */
    hookArena(a) {
      a.__hooked = true;
      if (!this.fired || !this.form) return;   // arena thường của game, không đụng
      const f = this.form;
      this.inArena = f;
      a.__mega = f;

      try {
        const e = G.EnemyMgr && G.EnemyMgr.get ? G.EnemyMgr.get(a.bossId) : null;
        if (e) {
          e.name = f.form;
          e.megaForm = f;
          e.hp = Math.round(2800 + a.t * 4);
          e.hpMax = e.hp;
          e.dmg = Math.round(e.dmg * 1.3);
        }
        G.Spawner.say('¡BOSS MEGA: ' + f.form + '! (5:00)', 3.6, true);
        G.Audio.sfx('legend');
      } catch (err) { console.warn('[Mega] hookArena', err); }
      M.UI && M.UI.toast('⚔ BOSS MEGA: ' + f.form + ' — giới hạn 5:00', 4000);
    },

    /** Gọi sau khi arena kết thúc (phase won hoặc lost) */
    onArenaEnd(phase) {
      const f = this.inArena;
      this.inArena = null;
      if (!f) return;
      if (phase === 'won') {
        if (!M.Save.isUnlocked(f.id)) {
          M.Save.defeatBoss(f.id);
          M.Save.addStone(f.stone);
          M.Save.unlock(f.id);
          M.Save.save();
          M.UI && M.UI.refreshFab();
          M.UI && M.UI.toast('🎉 Mở khoá ' + f.form +
            (f.stone ? ' + ' + M.Stones.nameOf(f) : ' (Dragon Ascent)'), 5000);
          M.Sound && M.Sound.unlock();
        }
      } else {
        M.UI && M.UI.toast('Bị đẩy khỏi cổng MEGA — về chỗ cũ, máu giữ nguyên', 4000);
      }
    },

    reset() { this.fired = false; this.form = null; this.inArena = null; this.warned60 = false; },
  };

  M.Rift = R;

  /* ---- Bộ dò trạng thái arena để phát hiện won/lost ---------------- */
  let lastPhase = null;
  M.Rift.pollArena = function () {
    if (!G || !G.Rift) return;
    const a = G.Rift.arena;
    const ph = a ? a.phase : null;
    if (ph && ph !== lastPhase) {
      if (lastPhase === 'fight' && (ph === 'won' || ph === 'lost')) {
        R.onArenaEnd(ph);
      }
    }
    if (!a) { if (lastPhase) lastPhase = null; }
    else lastPhase = ph;
  };
})();
