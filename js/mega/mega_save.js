/* =====================================================================
 * mega_save.js — Lưu tiến trình Mega (boss, stone, unlock, tùy chọn hiệu ứng)
 * Lưu localStorage, tự động ghi khi thay đổi, an toàn khi thiếu dữ liệu.
 * ===================================================================== */
(function () {
  const M = (window.PS_MEGA = window.PS_MEGA || {});
  const KEY = 'psmega.save.v1';

  const DEFAULT = {
    v: 1,
    bossesDefeated: {},   // formId -> timestamp
    stones: {},           // stoneName -> true
    unlocked: {},         // formId -> true
    active: {},           // dex -> formId (đang Mega)
    party: {},            // dex -> true (đã sở hữu)
    opts: {
      cinematic: true, camera: true, shake: true,
      flash: true, slowmo: true, quality: 'high', sound: true,
    },
    stats: { wins: 0, losses: 0, megaCount: 0 },
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  const S = {
    data: clone(DEFAULT),
    dirty: false,

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const p = JSON.parse(raw);
          this.data = Object.assign(clone(DEFAULT), p);
          this.data.opts = Object.assign(clone(DEFAULT.opts), p.opts || {});
        }
      } catch (e) {
        console.warn('[Mega] save load fail', e);
        this.data = clone(DEFAULT);
      }
      return this.data;
    },

    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
        this.dirty = false;
        if (M.UI && M.UI.onSave) M.UI.onSave();
      } catch (e) { console.warn('[Mega] save fail', e); }
    },

    // ---- boss ----
    isBossDefeated(formId) { return !!this.data.bossesDefeated[formId]; },
    defeatBoss(formId) {
      this.data.bossesDefeated[formId] = Date.now();
      this.data.stats.wins++;
      this.save();
    },
    // ---- stone ----
    hasStone(name) { return !name || !!this.data.stones[name]; },
    addStone(name) {
      if (!name) return;
      this.data.stones[name] = true;
      this.save();
    },
    // ---- unlock ----
    isUnlocked(formId) { return !!this.data.unlocked[formId]; },
    unlock(formId) {
      this.data.unlocked[formId] = true;
      this.save();
    },
    // ---- active mega ----
    setActive(dex, formId) {
      if (formId) this.data.active[dex] = formId; else delete this.data.active[dex];
      this.save();
    },
    getActive(dex) { return this.data.active[dex] || null; },
    clearActives() { this.data.active = {}; this.save(); },

    // ---- options ----
    opt(k) { return this.data.opts[k]; },
    setOpt(k, v) { this.data.opts[k] = v; this.save(); },

    reset() { this.data = clone(DEFAULT); this.save(); },

    exportJSON() { return JSON.stringify(this.data, null, 2); },
    importJSON(txt) {
      try {
        const p = JSON.parse(txt);
        this.data = Object.assign(clone(DEFAULT), p);
        this.data.opts = Object.assign(clone(DEFAULT.opts), p.opts || {});
        this.save();
        return true;
      } catch (e) { return false; }
    },
  };

  M.Save = S;
})();
