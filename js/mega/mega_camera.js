/* =====================================================================
 * mega_camera.js — Hiệu ứng camera 2D (zoom, pan, shake, flash, slowmo,
 * fade, darken). Không 3D, có công tắc ON/OFF từ Save.opts.
 * ===================================================================== */
(function () {
  const M = (window.PS_MEGA = window.PS_MEGA || {});

  const Cam = {
    zoom: 1, zoomTarget: 1,
    panX: 0, panY: 0, panXTarget: 0, panYTarget: 0,
    shakeAmp: 0, shakeT: 0, shakeDur: 0,
    flashA: 0, flashColor: '#fff',
    fadeA: 0, fadeColor: '#000', fadeTarget: 0,
    darken: 0, darkenTarget: 0,
    timeScale: 1, timeTarget: 1,
    _sx: 0, _sy: 0,

    reset() {
      this.zoom = this.zoomTarget = 1;
      this.panX = this.panY = this.panXTarget = this.panYTarget = 0;
      this.shakeAmp = 0; this.flashA = 0; this.fadeA = 0;
      this.darken = this.darkenTarget = 0;
      this.timeScale = this.timeTarget = 1;
    },

    zoomTo(z, dur) { if (!this._on('camera')) return; this.zoomTarget = z; this._zd = dur || 0.6; },
    panTo(x, y, dur) { if (!this._on('camera')) return; this.panXTarget = x; this.panYTarget = y; this._pd = dur || 0.6; },
    shake(amp, dur) { if (!this._on('shake')) return; this.shakeAmp = amp; this.shakeDur = dur || 0.4; this.shakeT = 0; },
    flash(color, a, dur) {
      if (!this._on('flash')) return;
      this.flashColor = color || '#fff'; this.flashA = a || 0.8; this._fd = dur || 0.35; this._fA = this.flashA;
    },
    fadeTo(a, color, dur) { this.fadeColor = color || '#000'; this.fadeTarget = a; this._fadeDur = dur || 0.5; },
    darkenTo(a, dur) { this.darkenTarget = a; this._dd = dur || 0.5; },
    slowmo(s, dur) { if (!this._on('slowmo')) return; this.timeTarget = s; this._smDur = dur || 0.6; this._smT = 0; this._smBase = s; },

    _on(k) { return !M.Save || !M.Save.data || M.Save.opt(k) !== false; },

    /** Trả về scale thời gian cho dt của game */
    dtScale() { return this.timeScale; },

    update(dt) {
      // zoom
      this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 6);
      this.panX += (this.panXTarget - this.panX) * Math.min(1, dt * 5);
      this.panY += (this.panYTarget - this.panY) * Math.min(1, dt * 5);

      // shake
      if (this.shakeAmp > 0) {
        this.shakeT += dt;
        const k = 1 - this.shakeT / this.shakeDur;
        if (k <= 0) { this.shakeAmp = 0; this._sx = this._sy = 0; }
        else {
          this._sx = (Math.random() * 2 - 1) * this.shakeAmp * k;
          this._sy = (Math.random() * 2 - 1) * this.shakeAmp * k;
        }
      } else { this._sx = this._sy = 0; }

      // flash
      if (this.flashA > 0) {
        this.flashA -= dt / (this._fd || 0.35) * this._fA;
        if (this.flashA < 0) this.flashA = 0;
      }
      // fade
      this.fadeA += (this.fadeTarget - this.fadeA) * Math.min(1, dt * 4);
      // darken
      this.darken += (this.darkenTarget - this.darken) * Math.min(1, dt * 4);
      // slowmo
      if (this.timeScale !== this.timeTarget) {
        this.timeScale += (this.timeTarget - this.timeScale) * Math.min(1, dt * 8);
      }
      if (this._smT !== undefined) {
        this._smT += dt;
        if (this._smT > (this._smDur || 0.6) && this.timeTarget !== 1) {
          this.timeTarget = 1;
        }
      }
    },

    /** Áp transform lên ctx (dùng quanh vùng vẽ world) */
    apply(ctx, W, H) {
      ctx.save();
      ctx.translate(W / 2 + this._sx + this.panX, H / 2 + this._sy + this.panY);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-W / 2, -H / 2);
    },
    restore(ctx) { ctx.restore(); },

    /** Vẽ lớp phủ (flash/fade/darken) — gọi sau cùng */
    drawOverlay(ctx, W, H) {
      if (this.darken > 0.01) {
        ctx.fillStyle = 'rgba(0,0,0,' + this.darken.toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
      }
      if (this.flashA > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, this.flashA);
        ctx.fillStyle = this.flashColor;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      if (this.fadeA > 0.01) {
        ctx.fillStyle = this.fadeColor;
        ctx.globalAlpha = Math.min(1, this.fadeA);
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    },
  };

  M.Cam = Cam;
})();
