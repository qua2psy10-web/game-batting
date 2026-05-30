/**
 * CYBER AUDIO SYSTEM (Synthesized Sound System)
 * Uses the Web Audio API to dynamically synthesize 100% of the game's sounds.
 * Avoids any external MP3 asset downloads. Implements iOS audio unlock,
 * SE generation (swings, hits, buzzer, cheers) and a procedural Synthwave BGM sequencer.
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isUnlocked = false;
    this.bgmEnabled = true;
    
    // BGM Sequencer variables
    this.bgmIntervalId = null;
    this.nextNoteTime = 0.0;
    this.currentStep = 0;
    this.bpm = 112;
    this.tempoSeconds = 60.0 / this.bpm / 4; // 16th note duration
    
    // Synth BGM configuration
    // Simple synthwave chord progression in A Minor: Am - C - G - F
    this.bassline = [
      // Am (step 0-15)
      33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 45, 33,
      // C (step 16-31)
      36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 48, 36,
      // G (step 32-47)
      31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 43, 31,
      // F (step 48-63)
      29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 41, 29
    ];
    
    this.melody = [
      // Am
      57, 0, 60, 64, 57, 0, 60, 64, 57, 60, 64, 67, 64, 60, 57, 0,
      // C
      60, 0, 64, 67, 60, 0, 64, 67, 60, 64, 67, 72, 67, 64, 60, 0,
      // G
      55, 0, 59, 62, 55, 0, 59, 62, 55, 59, 62, 67, 62, 59, 55, 0,
      // F
      53, 0, 57, 60, 53, 0, 57, 60, 53, 57, 60, 65, 60, 57, 53, 0
    ];
  }

  /**
   * Unlock AudioContext on initial user gesture (iOS Requirement)
   */
  unlock() {
    if (this.isUnlocked) return;
    
    // Create audio context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    
    this.ctx = new AudioContextClass();
    
    // Resume if suspended (iOS default state)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    // Test silent play to trigger lock release
    const buffer = this.ctx.createBuffer(1, 1, 22050);
    const node = this.ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(this.ctx.destination);
    node.start(0);
    
    this.isUnlocked = true;
    
    // Start procedural BGM
    if (this.bgmEnabled) {
      this.startBGM();
    }
  }

  // Convert MIDI note number to frequency (Hz)
  midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  /* ==========================================================================
     BGM SYNTHESIZED SEQUENCER (Tale of Two Clocks Pattern)
     ========================================================================== */
  startBGM() {
    if (!this.ctx || !this.bgmEnabled) return;
    this.stopBGM();
    
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.currentStep = 0;
    
    // Tick scheduler running every 25ms
    this.bgmIntervalId = setInterval(() => {
      this.scheduleLoop();
    }, 25);
  }

  stopBGM() {
    if (this.bgmIntervalId) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }

  scheduleLoop() {
    // Schedule ahead 100ms
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      
      // Advance sequencer step (loop at 64 steps)
      this.currentStep = (this.currentStep + 1) % 64;
      this.nextNoteTime += this.tempoSeconds;
    }
  }

  /**
   * Schedule synthesizer nodes for a specific sequencer step
   */
  scheduleStep(step, time) {
    // 1. Play Synthesizer Bassline (Every 8th Note: steps 0, 2, 4...)
    if (step % 2 === 0) {
      const midiNote = this.bassline[step];
      this.synthesizeBass(midiNote, time, this.tempoSeconds * 1.8);
    }
    
    // 2. Play Arpeggio Melody (Selected 16th Notes)
    const midiNote = this.melody[step];
    if (midiNote > 0 && Math.random() > 0.1) {
      this.synthesizeArp(midiNote, time, this.tempoSeconds * 1.0);
    }
    
    // 3. Play Synth Hi-Hat (Every odd step to keep beat rhythm)
    if (step % 4 === 2) {
      this.synthesizeHihat(time);
    }
  }

  synthesizeBass(midiNote, startTime, duration) {
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(this.midiToFreq(midiNote), startTime);
    
    // Low-pass filter to give warm retro synthwave feel
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, startTime);
    filter.frequency.exponentialRampToValueAtTime(150, startTime + duration);
    
    // Volume envelope
    gain.gain.setValueAtTime(0.0, startTime);
    gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  synthesizeArp(midiNote, startTime, duration) {
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Triangle wave for soft sci-fi lead
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.midiToFreq(midiNote), startTime);
    
    // Soft delay effect via simple volume fade
    gain.gain.setValueAtTime(0.0, startTime);
    gain.gain.linearRampToValueAtTime(0.07, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  synthesizeHihat(startTime) {
    if (!this.ctx) return;
    
    // White noise simulation for hi-hat tick using small buffer
    const bufferSize = this.ctx.sampleRate * 0.05; // 50ms buffer
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, startTime);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.015, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.04);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    noiseSource.start(startTime);
  }

  /* ==========================================================================
     SOUND EFFECTS (SE) GENERATORS
     ========================================================================== */
  
  // 1. Cyber Pitch Release Sound (energy discharge "shhhwp")
  playPitchSE() {
    if (!this.ctx) return;
    
    const startTime = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, startTime);
    osc.frequency.exponentialRampToValueAtTime(800, startTime + 0.25);
    
    gain.gain.setValueAtTime(0.0, startTime);
    gain.gain.linearRampToValueAtTime(0.05, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + 0.25);
  }

  // 2. Bat Swing Sound (compressed sweep noise)
  playSwingSE() {
    if (!this.ctx) return;
    
    const startTime = this.ctx.currentTime;
    const duration = 0.15;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, startTime);
    osc.frequency.exponentialRampToValueAtTime(80, startTime + duration);
    
    gain.gain.setValueAtTime(0.12, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // 3. Bat Contact Sound (metallic retro ding/impact)
  playHitSE(quality) {
    if (!this.ctx) return;
    
    const startTime = this.ctx.currentTime;
    
    if (quality === 'MISS') {
      // Dull low swoosh
      this.playSwingSE();
      return;
    }
    
    // Core high pitched impact node (metalllic resonance)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    let baseFreq = 880; // GOOD
    let subFreq = 523;
    let vol = 0.2;
    let duration = 0.25;
    
    if (quality === 'PERFECT') {
      baseFreq = 1568; // High C - shiny crystal chime
      subFreq = 987;
      vol = 0.35;
      duration = 0.6;
      
      // Cyber Laser Boom drop
      this.playLaserDrop();
    } else if (quality === 'GREAT') {
      baseFreq = 1174;
      subFreq = 659;
      vol = 0.26;
      duration = 0.4;
    }
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, startTime);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, startTime + duration);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(subFreq, startTime);
    osc2.frequency.exponentialRampToValueAtTime(subFreq * 0.2, startTime + duration);
    
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc1.start(startTime);
    osc2.start(startTime);
    
    osc1.stop(startTime + duration);
    osc2.stop(startTime + duration);
  }

  // Laser frequency sweep used in Perfect hits
  playLaserDrop() {
    const startTime = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, startTime);
    osc.frequency.exponentialRampToValueAtTime(150, startTime + 0.4);
    
    gain.gain.setValueAtTime(0.12, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + 0.4);
  }

  // 4. Crowd Cheer / Home Run Anthem
  playHomeRunSE() {
    if (!this.ctx) return;
    
    const startTime = this.ctx.currentTime;
    
    // Retro alarm buzzer (cyber arcade triumph)
    const duration = 1.2;
    const step = 0.12;
    
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      const freq = 330 * (i * 0.25 + 1); // Harmonic tones
      osc.frequency.setValueAtTime(freq, startTime + i * step);
      osc.frequency.setValueAtTime(freq * 1.5, startTime + i * step + 0.08);
      
      gain.gain.setValueAtTime(0.0, startTime + i * step);
      gain.gain.linearRampToValueAtTime(0.06, startTime + i * step + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + i * step + 0.12);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(startTime + i * step);
      osc.stop(startTime + i * step + 0.12);
    }
    
    // Simulate cheering white noise rising in volume
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2.0, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const crowdSource = this.ctx.createBufferSource();
    crowdSource.buffer = noiseBuffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, startTime);
    filter.Q.setValueAtTime(1.5, startTime);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0, startTime);
    gain.gain.linearRampToValueAtTime(0.05, startTime + 0.4); // volume swells
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 2.0); // fades away
    
    crowdSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    crowdSource.start(startTime);
  }
}
