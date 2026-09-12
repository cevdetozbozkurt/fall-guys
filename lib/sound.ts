export class Sound {
  context: AudioContext | null = null;
  private active = true;
  private musicGain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private beat = 0;
  private nextNote = 0;
  musicEnabled = true;
  get enabled() {
    return this.active;
  }
  set enabled(value: boolean) {
    this.active = value;
    this.updateMusic();
  }
  setMusic(value: boolean) {
    this.musicEnabled = value;
    this.updateMusic();
  }
  private updateMusic() {
    if (this.context && this.musicGain)
      this.musicGain.gain.setTargetAtTime(
        this.active && this.musicEnabled ? 0.18 : 0,
        this.context.currentTime,
        0.08,
      );
  }
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume();
      this.startMusic();
    } catch {
      /* Audio is optional. */
    }
  }
  play(event: string) {
    if (!this.enabled || !this.context) return;
    const melodies: Record<string, number[]> = {
      jump: [420, 630],
      dive: [270, 180],
      kick: [200, 330, 160],
      hit: [130, 80],
      fall: [210, 150, 80],
      checkpoint: [530, 670, 800],
      go: [660, 880],
      finish: [520, 660, 780, 1040],
    };
    (melodies[event] ?? []).forEach((f, i) => {
      const o = this.context!.createOscillator(),
        g = this.context!.createGain(),
        t = this.context!.currentTime + i * 0.075;
      o.type = event === 'hit' ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g);
      g.connect(this.context!.destination);
      o.start(t);
      o.stop(t + 0.16);
    });
  }
  private startMusic() {
    if (!this.context || this.timer) return;
    const ctx = this.context;
    this.musicGain = ctx.createGain();
    this.musicGain.connect(ctx.destination);
    this.updateMusic();
    this.nextNote = ctx.currentTime + 0.08;
    // Original eight-bar cosmic-pop loop: soft plucks, a bouncy bass and gentle pulse.
    const melody = [
      76, 79, 83, 79, 74, 78, 81, 78, 72, 76, 79, 83, 74, 78, 81, 86, 76, 79,
      88, 83, 74, 81, 86, 81, 72, 79, 84, 79, 74, 78, 81, 74,
    ];
    const bass = [48, 45, 41, 43];
    const note = (
      midi: number,
      time: number,
      length: number,
      level: number,
      type: OscillatorType,
    ) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(level, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
      oscillator.connect(gain);
      gain.connect(this.musicGain!);
      oscillator.start(time);
      oscillator.stop(time + length + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    };
    this.timer = setInterval(() => {
      if (ctx.state !== 'running') return;
      if (this.nextNote < ctx.currentTime - 0.4)
        this.nextNote = ctx.currentTime + 0.05;
      while (this.nextNote < ctx.currentTime + 0.3) {
        const i = this.beat % 64,
          time = this.nextNote;
        if (i % 2 === 0)
          note(melody[(i / 2) % melody.length], time, 0.28, 0.24, 'sine');
        if (i % 4 === 0) {
          const root = bass[Math.floor(i / 16)];
          note(root, time, 0.38, 0.35, 'triangle');
          note(28, time, 0.12, 0.24, 'sine');
        }
        if (i % 8 === 4) note(91, time, 0.06, 0.035, 'triangle');
        this.nextNote += 60 / 112 / 2;
        this.beat++;
      }
    }, 100);
  }
  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.context?.close();
  }
}
