/* =====================================================================
 * mega_sound.js — Âm thanh Mega tổng hợp bằng WebAudio (không cần file mp3)
 * 7 âm thanh riêng biệt theo từng giai đoạn; cao độ đổi theo hệ Pokémon
 * nên mỗi Pokémon có "giọng" khác nhau (không dùng 1 âm cho tất cả).
 * ===================================================================== */
(function () {
  const M = (window.PS_MEGA = window.PS_MEGA || {});

  let AC = null;
  function ac() {
    if (!AC) {
      try { AC = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { AC = null; }
    }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }

  function enabled() { return !M.Save || !M.Save.data || M.Save.opt('sound') !== false; }

  // Bán âm theo hệ để mỗi Pokémon nghe khác nhau
  const TYPE_PITCH = {
    fire: 0, water: -2, electric: 3, grass: 1, psychic: 4, ghost: -3,
    dragon: 5, dark: -4, ice: 2, fairy: 6, steel: -1, rock: -5,
    ground: -3, flying: 2, fighting: 0, bug: 1, poison: -2, normal: 0,
  };

  function note(base, semi) { return base * Math.pow(2, semi / 12); }

  function tone(freq, dur, type, gain, slideTo, when) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (when || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.16, t0 + Math.min(0.03, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, gain, hp, when) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (when || 0);
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 400;
    const g = c.createGain(); g.gain.value = gain || 0.2;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t0);
  }

  const S = {
    // 1. Kích hoạt đá
    activate(types) {
      if (!enabled()) return;
      const s = TYPE_PITCH[types && types[0]] || 0;
      tone(note(520, s), 0.35, 'triangle', 0.14);
      tone(note(780, s), 0.45, 'sine', 0.10, null, 0.05);
      noise(0.25, 0.07, 1800);
    },
    // 2. Nạp năng lượng (kéo dài)
    charge(types) {
      if (!enabled()) return;
      const s = TYPE_PITCH[types && types[0]] || 0;
      tone(note(220, s), 1.1, 'sawtooth', 0.06, note(880, s));
      tone(note(330, s), 1.1, 'sine', 0.05, note(1320, s));
    },
    // 3. Biến đổi
    transform(types) {
      if (!enabled()) return;
      const s = TYPE_PITCH[types && types[0]] || 0;
      for (let i = 0; i < 5; i++) {
        tone(note(300 + i * 120, s), 0.18, 'square', 0.05, note(600 + i * 200, s), i * 0.09);
      }
      noise(0.8, 0.10, 600);
    },
    // 4. Bùng nổ
    burst(types) {
      if (!enabled()) return;
      const s = TYPE_PITCH[types && types[0]] || 0;
      tone(note(90, s), 0.6, 'sawtooth', 0.22, 40);
      tone(note(1200, s), 0.5, 'square', 0.08, 200);
      noise(0.7, 0.28, 200);
    },
    // 5. Tiếng gầm Pokémon
    roar(types, timer) {
      if (!enabled()) return;
      const s = TYPE_PITCH[types && types[0]] || 0;
      tone(note(140, s), 0.45, 'sawtooth', 0.16, note(105, s));
      tone(note(210, s), 0.4, 'square', 0.06, note(160, s));
      noise(0.5, 0.12, 300);
    },
    // 6. Hoàn tất
    complete(types) {
      if (!enabled()) return;
      const s = TYPE_PITCH[types && types[0]] || 0;
      [0, 4, 7, 12].forEach((n, i) => tone(note(523.25, s + n), 0.4, 'triangle', 0.11, null, i * 0.09));
    },
    // 7. Hoàn nguyên
    revert(types) {
      if (!enabled()) return;
      const s = TYPE_PITCH[types && types[0]] || 0;
      tone(note(880, s), 0.7, 'sine', 0.10, note(220, s));
      noise(0.4, 0.06, 900);
    },

    // ---- phụ ----
    hit() { if (!enabled()) return; noise(0.09, 0.12, 1200); },
    hurt() { if (!enabled()) return; tone(260, 0.16, 'square', 0.10, 140); },
    win() {
      if (!enabled()) return;
      [0, 4, 7, 12, 16].forEach((n, i) => tone(note(523.25, n), 0.35, 'triangle', 0.12, null, i * 0.10));
    },
    lose() {
      if (!enabled()) return;
      [0, -2, -5, -9].forEach((n, i) => tone(note(440, n), 0.4, 'sine', 0.12, null, i * 0.13));
    },
    bossStart() { if (!enabled()) return; tone(110, 0.8, 'sawtooth', 0.14, 80); noise(0.6, 0.14, 200); },
    bossAtk() { if (!enabled()) return; noise(0.14, 0.16, 800); tone(180, 0.2, 'square', 0.08, 90); },
    bossSpecial() { if (!enabled()) return; tone(90, 0.5, 'sawtooth', 0.16, 60); noise(0.4, 0.2, 300); },
    click() { if (!enabled()) return; tone(660, 0.06, 'square', 0.06); },
    unlock() {
      if (!enabled()) return;
      [0, 7, 12].forEach((n, i) => tone(note(659.25, n), 0.5, 'triangle', 0.12, null, i * 0.12));
    },
  };

  M.Sound = S;
})();
