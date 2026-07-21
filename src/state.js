import { LIGHT, ALL_UNLOCKABLES } from './config.js';

const STORAGE_KEY = 'floating-lantern-v1';

export class GameState {
  constructor() {
    this.light = LIGHT.start;
    this.harmony = 0;
    this.settings = {
      time: 0.35,
      mist: false,
      fireflies: false,
      shooting: false,
      sound: false,
      volume: 0.6,
    };
    this.lanterns = [];
    this.introSeen = false;
    this._regenAcc = 0;
    this._saveAcc = 0;
    this.onChange = null; // UI refresh callback
    this.onUnlock = null; // toast callback (label)
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.light = Math.min(data.light ?? LIGHT.start, LIGHT.cap);
      this.harmony = data.harmony ?? 0;
      this.settings = { ...this.settings, ...(data.settings || {}) };
      this.lanterns = data.lanterns || [];
      this.introSeen = data.introSeen || false;
    } catch {
      /* corrupted save, start fresh */
    }
  }

  save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          light: this.light,
          harmony: this.harmony,
          settings: this.settings,
          lanterns: this.lanterns,
          introSeen: this.introSeen,
        })
      );
    } catch {
      /* storage unavailable */
    }
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
  }

  tick(dt) {
    if (this.light < LIGHT.cap) {
      this._regenAcc += dt;
      if (this._regenAcc >= LIGHT.regenSeconds) {
        this._regenAcc = 0;
        this.light = Math.min(LIGHT.cap, this.light + 1);
        this.onChange?.();
        this.onLightGain?.();
      }
    }
    this._saveAcc += dt;
    if (this._saveAcc > 5) {
      this._saveAcc = 0;
      this.save();
    }
  }

  canAfford(cost) {
    return this.light >= cost;
  }

  spend(cost) {
    if (!this.canAfford(cost)) return false;
    this.light -= cost;
    this.addHarmony(cost);
    this.onChange?.();
    this.save();
    return true;
  }

  addHarmony(n) {
    const before = this.harmony;
    this.harmony += n;
    this.onHarmonyGain?.();
    const newly = ALL_UNLOCKABLES.filter((u) => u.unlock > before && u.unlock <= this.harmony);
    if (newly.length && this.onUnlock) {
      // Group by threshold so one toast lists everything that opened together.
      const byThreshold = new Map();
      for (const u of newly) {
        if (!byThreshold.has(u.unlock)) byThreshold.set(u.unlock, []);
        byThreshold.get(u.unlock).push(u.label);
      }
      for (const labels of byThreshold.values()) {
        this.onUnlock(labels.join('  \u00b7  '));
      }
    }
  }

  isUnlocked(item) {
    return (item.unlock || 0) <= this.harmony;
  }

  nextUnlock() {
    const future = ALL_UNLOCKABLES.filter((u) => u.unlock > this.harmony).sort(
      (a, b) => a.unlock - b.unlock
    );
    if (!future.length) return null;
    const at = future[0].unlock;
    return { at, labels: future.filter((u) => u.unlock === at).map((u) => u.label) };
  }
}
