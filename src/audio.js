// Generative ambient audio, no sample files needed.
// A low drone, soft water noise, and occasional pentatonic bell tones.

const PENTATONIC = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

export class ZenAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.volume = 0.6;
    this._bellTimeout = null;
  }

  enable() {
    if (!this.ctx) this._build();
    this.ctx.resume();
    this.enabled = true;
    this.master.gain.setTargetAtTime(this.volume * 0.5, this.ctx.currentTime, 1.2);
    this._scheduleBell();
  }

  disable() {
    this.enabled = false;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
    clearTimeout(this._bellTimeout);
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx && this.enabled) {
      this.master.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.3);
    }
  }

  _build() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Reverb bus from a generated impulse response.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.2, 2.4);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.55;
    this.reverb.connect(reverbGain);
    reverbGain.connect(this.master);

    // Drone: two detuned sines through a dark lowpass, slowly breathing.
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 360;
    droneFilter.connect(droneGain);
    droneGain.connect(this.master);
    droneGain.connect(this.reverb);
    for (const [freq, detune] of [[55, 0], [110, 4], [164.81, -3]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = freq < 100 ? 0.5 : 0.22;
      osc.connect(g);
      g.connect(droneFilter);
      osc.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.03;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);
    lfo.start();

    // Water: looping filtered noise with a slow swell.
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 480;
    noiseFilter.Q.value = 0.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.028;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.master);
    const nLfo = ctx.createOscillator();
    nLfo.frequency.value = 0.07;
    const nLfoGain = ctx.createGain();
    nLfoGain.gain.value = 0.013;
    nLfo.connect(nLfoGain);
    nLfoGain.connect(noiseGain.gain);
    nLfo.start();
    noise.start();
  }

  _impulse(duration, decay) {
    const rate = this.ctx.sampleRate;
    const len = rate * duration;
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _scheduleBell() {
    clearTimeout(this._bellTimeout);
    if (!this.enabled) return;
    this._bellTimeout = setTimeout(() => {
      if (this.enabled) {
        this._bell(PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)], 0.06);
        this._scheduleBell();
      }
    }, 5000 + Math.random() * 9000);
  }

  _bell(freq, gain, when = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    // A faint octave shimmer on top.
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.01;
    const g = this.ctx.createGain();
    const g2 = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(gain * 0.25, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    osc.connect(g);
    osc2.connect(g2);
    g.connect(this.master);
    g.connect(this.reverb);
    g2.connect(this.reverb);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 5);
    osc2.stop(t + 3);
  }

  // Interaction sounds stay subtle and only play while sound is on.
  placeSound() {
    if (!this.enabled || !this.ctx) return;
    this._bell(PENTATONIC[Math.floor(Math.random() * 4) + 2], 0.09);
    // Soft water plop: a short filtered noise burst.
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.18, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + 0.16);
    const g = this.ctx.createGain();
    g.gain.value = 0.14;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    g.connect(this.reverb);
    src.start(t);
  }

  unlockSound() {
    if (!this.enabled || !this.ctx) return;
    this._bell(523.25, 0.07);
    this._bell(783.99, 0.05, 0.28);
  }

  upgradeSound() {
    if (!this.enabled || !this.ctx) return;
    this._bell(392, 0.07);
    this._bell(587.33, 0.05, 0.18);
  }
}
