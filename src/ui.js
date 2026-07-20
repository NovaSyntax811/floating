import { MODELS, MATERIALS, COLORS, PATTERNS, FEATURES, UPGRADE_COST, MAX_LEVEL, LIGHT } from './config.js';

const PATTERN_ICONS = {
  plain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="5" width="14" height="14" rx="4"/></svg>',
  waves: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M4 9c2.7-2.4 5.3-2.4 8 0s5.3 2.4 8 0"/><path d="M4 15c2.7-2.4 5.3-2.4 8 0s5.3 2.4 8 0"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="8" r="1.8"/><circle cx="16" cy="8" r="1.8"/><circle cx="8" cy="16" r="1.8"/><circle cx="16" cy="16" r="1.8"/><circle cx="12" cy="12" r="1.8"/></svg>',
  rings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/></svg>',
};

export class UI {
  constructor(state, audio) {
    this.state = state;
    this.audio = audio;
    this.selection = {
      model: 'paper',
      material: 'paper',
      color: COLORS[0],
      pattern: 'plain',
    };
    this.editHandlers = null;
    this.editLantern = null;
    this._toastQueue = [];
    this._toastBusy = false;

    this._buildDock();
    this._wireAmbience();
    this.refresh();
  }

  // ---------- dock ----------
  _buildDock() {
    const modelBox = document.getElementById('model-items');
    for (const m of MODELS) {
      const el = document.createElement('button');
      el.className = 'dock-item';
      el.dataset.id = m.id;
      el.innerHTML = `${m.icon}<span class="cost">${m.cost}</span>`;
      el.addEventListener('click', () => {
        if (!this.state.isUnlocked(m)) return;
        this.selection.model = m.id;
        this._bounce(el);
        this.refresh();
      });
      modelBox.appendChild(el);
    }

    const matBox = document.getElementById('material-items');
    for (const m of MATERIALS) {
      const el = document.createElement('button');
      el.className = 'dock-item mat';
      el.dataset.id = m.id;
      el.textContent = m.name;
      el.title = m.desc;
      el.addEventListener('click', () => {
        this.selection.material = m.id;
        this._bounce(el);
        this.refresh();
      });
      matBox.appendChild(el);
    }

    const colorBox = document.getElementById('color-items');
    for (const c of COLORS) {
      const el = document.createElement('button');
      el.className = 'dock-item swatch';
      el.dataset.id = c.id;
      el.style.background = c.hex;
      el.style.color = c.hex;
      el.title = c.name;
      el.addEventListener('click', () => {
        if (!this.state.isUnlocked(c)) return;
        this.selection.color = c;
        this._bounce(el);
        this.refresh();
      });
      colorBox.appendChild(el);
    }

    const patternBox = document.getElementById('pattern-items');
    for (const p of PATTERNS) {
      const el = document.createElement('button');
      el.className = 'dock-item';
      el.dataset.id = p.id;
      el.innerHTML = PATTERN_ICONS[p.id];
      el.title = p.name;
      el.addEventListener('click', () => {
        if (!this.state.isUnlocked(p)) return;
        this.selection.pattern = p.id;
        this._bounce(el);
        this.refresh();
      });
      patternBox.appendChild(el);
    }
  }

  _bounce(el) {
    el.classList.remove('just-picked');
    void el.offsetWidth;
    el.classList.add('just-picked');
  }

  // ---------- ambience ----------
  _wireAmbience() {
    const panel = document.getElementById('ambience-panel');
    document.getElementById('ambience-btn').addEventListener('click', () => {
      panel.classList.toggle('hidden');
    });

    const s = this.state.settings;
    const timeSlider = document.getElementById('time-slider');
    timeSlider.value = s.time;
    timeSlider.addEventListener('input', () => {
      s.time = parseFloat(timeSlider.value);
      this.onTimeChange?.(s.time);
    });

    for (const [id, key] of [
      ['mist-toggle', 'mist'],
      ['firefly-toggle', 'fireflies'],
      ['shooting-toggle', 'shooting'],
    ]) {
      const box = document.getElementById(id);
      box.checked = s[key];
      box.addEventListener('change', () => {
        const feature = FEATURES.find((f) => f.id === key || (key === 'fireflies' && f.id === 'fireflies'));
        if (feature && !this.state.isUnlocked(feature)) {
          box.checked = false;
          this.toast(`${feature.name} will unlock as harmony grows`);
          return;
        }
        s[key] = box.checked;
        this.onWeatherChange?.(key, box.checked);
        this.state.save();
      });
    }

    const soundToggle = document.getElementById('sound-toggle');
    soundToggle.checked = false; // browsers require a gesture, start off
    soundToggle.addEventListener('change', () => {
      s.sound = soundToggle.checked;
      soundToggle.checked ? this.audio.enable() : this.audio.disable();
      this.state.save();
    });

    const volSlider = document.getElementById('volume-slider');
    volSlider.value = s.volume;
    volSlider.addEventListener('input', () => {
      s.volume = parseFloat(volSlider.value);
      this.audio.setVolume(s.volume);
    });

    const resetBtn = document.getElementById('reset-btn');
    resetBtn.addEventListener('click', () => {
      if (resetBtn.dataset.armed) {
        this.state.reset();
        location.reload();
      } else {
        resetBtn.dataset.armed = '1';
        resetBtn.textContent = 'Sure? Click again';
        setTimeout(() => {
          delete resetBtn.dataset.armed;
          resetBtn.textContent = 'Start over';
        }, 2600);
      }
    });
  }

  // ---------- edit panel ----------
  showEdit(lantern, handlers) {
    this.editLantern = lantern;
    this.editHandlers = handlers;
    const panel = document.getElementById('edit-panel');
    panel.classList.remove('hidden');

    const colorBox = document.getElementById('edit-colors');
    colorBox.innerHTML = '';
    for (const c of COLORS.filter((c) => this.state.isUnlocked(c))) {
      const el = document.createElement('button');
      el.className = 'dock-item swatch' + (lantern.colorHex === c.hex ? ' active' : '');
      el.style.background = c.hex;
      el.style.color = c.hex;
      el.title = c.name;
      el.addEventListener('click', () => {
        handlers.onColor(c.hex);
        this.showEdit(lantern, handlers);
      });
      colorBox.appendChild(el);
    }

    const patternBox = document.getElementById('edit-patterns');
    patternBox.innerHTML = '';
    for (const p of PATTERNS.filter((p) => this.state.isUnlocked(p))) {
      const el = document.createElement('button');
      el.className = 'dock-item' + (lantern.pattern === p.id ? ' active' : '');
      el.innerHTML = PATTERN_ICONS[p.id];
      el.title = p.name;
      el.addEventListener('click', () => {
        handlers.onPattern(p.id);
        this.showEdit(lantern, handlers);
      });
      patternBox.appendChild(el);
    }

    const model = MODELS.find((m) => m.id === lantern.model);
    const material = MATERIALS.find((m) => m.id === lantern.material);
    document.getElementById('edit-info').textContent =
      `${model?.name || 'Lantern'} of ${material?.name.toLowerCase() || 'paper'}, light level ${lantern.level}`;

    const upBtn = document.getElementById('upgrade-btn');
    if (lantern.level >= MAX_LEVEL) {
      upBtn.textContent = 'Fully radiant';
      upBtn.disabled = true;
    } else {
      upBtn.textContent = `Raise the light  ·  ${UPGRADE_COST}`;
      upBtn.disabled = !this.state.canAfford(UPGRADE_COST);
    }
    upBtn.onclick = () => {
      handlers.onUpgrade();
      if (this.editLantern) this.showEdit(this.editLantern, handlers);
    };
    document.getElementById('release-btn').onclick = () => handlers.onRelease();
  }

  hideEdit() {
    this.editLantern = null;
    document.getElementById('edit-panel').classList.add('hidden');
  }

  // ---------- refresh ----------
  refresh() {
    const st = this.state;

    document.getElementById('light-count').textContent = `${Math.floor(st.light)} / ${LIGHT.cap}`;

    const next = st.nextUnlock();
    const fill = document.getElementById('harmony-fill');
    const label = document.getElementById('harmony-label');
    if (next) {
      const prevThresholds = [0, ...new Set(
        [...MODELS, ...COLORS, ...PATTERNS, ...FEATURES]
          .map((u) => u.unlock || 0)
          .filter((u) => u <= st.harmony)
      )];
      const from = Math.max(...prevThresholds);
      const pct = Math.min(100, ((st.harmony - from) / (next.at - from)) * 100);
      fill.style.width = `${pct}%`;
      label.textContent = `harmony ${st.harmony}  ·  something new at ${next.at}`;
    } else {
      fill.style.width = '100%';
      label.textContent = `harmony ${st.harmony}  ·  everything has unfolded`;
    }

    // Dock lock and active states.
    const apply = (boxId, items, activeId) => {
      const box = document.getElementById(boxId);
      for (const el of box.children) {
        const item = items.find((i) => i.id === el.dataset.id);
        const locked = item.unlock !== undefined && !st.isUnlocked(item);
        el.classList.toggle('locked', locked);
        el.classList.toggle('active', el.dataset.id === activeId && !locked);
        if (locked) el.title = 'Keep creating to unlock';
        else if (item.name) el.title = item.desc || item.name;
      }
    };
    apply('model-items', MODELS, this.selection.model);
    apply('material-items', MATERIALS, this.selection.material);
    apply('color-items', COLORS, this.selection.color.id);
    apply('pattern-items', PATTERNS, this.selection.pattern);

    // If the selected model got outleveled by a lock (fresh reset), fall back.
    const selModel = MODELS.find((m) => m.id === this.selection.model);
    if (!st.isUnlocked(selModel)) this.selection.model = 'paper';
  }

  // ---------- HUD micro feedback ----------
  pulseLight() {
    const row = document.getElementById('light-row');
    row.classList.remove('pulse');
    void row.offsetWidth; // restart the animation
    row.classList.add('pulse');
  }

  pulseHarmony() {
    const bar = document.querySelector('.harmony-bar');
    bar.classList.remove('glow');
    void bar.offsetWidth;
    bar.classList.add('glow');
  }

  // ---------- toast ----------
  toast(text) {
    this._toastQueue.push(text);
    if (!this._toastBusy) this._nextToast();
  }

  _nextToast() {
    const el = document.getElementById('toast');
    if (this._toastQueue.length === 0) {
      this._toastBusy = false;
      el.classList.add('hidden');
      return;
    }
    this._toastBusy = true;
    el.textContent = this._toastQueue.shift();
    el.classList.remove('hidden');
    setTimeout(() => {
      el.classList.add('hidden');
      setTimeout(() => this._nextToast(), 750);
    }, 2900);
  }

  showGameUI() {
    for (const id of ['hud', 'dock', 'ambience-btn']) {
      document.getElementById(id).classList.remove('hidden');
    }
  }
}
