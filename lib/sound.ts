export class Sound {
  context: AudioContext | null = null;
  enabled = true;
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume();
    } catch {
      /* Audio is optional. */
    }
  }
  play(event: string) {
    if (!this.enabled || !this.context) return;
    const melodies: Record<string, number[]> = {
      jump: [420, 630],
      dive: [270, 180],
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
  destroy() {
    void this.context?.close();
  }
}
