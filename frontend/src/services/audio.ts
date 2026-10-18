class IndustrialAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private lastWarningTime = 0;
  private lastBreachTime = 0;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playWarningChime() {
    if (!this.enabled) return;
    const now = Date.now();
    if (now - this.lastWarningTime < 3500) return; // throttle
    this.lastWarningTime = now;

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(680, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  playBreachAlarm() {
    if (!this.enabled) return;
    const now = Date.now();
    if (now - this.lastBreachTime < 3000) return; // throttle
    this.lastBreachTime = now;

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(880, t);
      osc1.frequency.setValueAtTime(700, t + 0.12);
      osc1.frequency.setValueAtTime(880, t + 0.24);

      gain1.gain.setValueAtTime(0.12, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start();
      osc1.stop(t + 0.45);
    } catch {
      // Audio autoplay policy fallback
    }
  }
}

export const industrialAudio = new IndustrialAudioSynthesizer();
