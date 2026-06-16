// Web Audio API Synthesizer Preset Player for Class Landmark Alerts
export interface SoundPreset {
  id: string;
  name: string;
}

export const SOUND_PRESETS: SoundPreset[] = [
  { id: 'crystal', name: '💎 Crystal Chime (Default 1)' },
  { id: 'double', name: '🔔 Double Sweet Chime (Default 2)' },
  { id: 'triple', name: '⚠️ Triple Warning Chime (Default 3)' },
  { id: 'digital', name: '⚡ Digital Tech Alert' },
  { id: 'success', name: '🎉 Uplifting Tada Melody' },
  { id: 'ambient', name: '🌊 Gentle Deep Pulse' },
];

export const playSoundPreset = (presetName: string) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    switch (presetName) {
      case 'crystal': {
        // High crystal chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }
      case 'double': {
        // Double sweet dynamic chime
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.5);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, now + 0.15); // G5
        gain2.gain.setValueAtTime(0.12, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.7);
        break;
      }
      case 'triple': {
        // Triple progressive warm notes
        const notes = [329.63, 349.23, 392.00]; // E4 -> F4 -> G4
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.2);
          gain.gain.setValueAtTime(0.1, now + idx * 0.2);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.2 + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.2);
          osc.stop(now + idx * 0.2 + 0.25);
        });
        break;
      }
      case 'digital': {
        // Dynamic sharp digital/tech bip bip
        [600, 600].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.05, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.1);
        });
        break;
      }
      case 'success': {
        // Ascending rich melody tada
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4 -> E4 -> G4 -> C5
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.1, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.35);
        });
        break;
      }
      case 'ambient': {
        // Deep ambient warm chord/pulse
        [220, 330].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.3);
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error('Failed to play synthesized sound preset:', error);
  }
};
