import siiiUrl from '../../assets/siiii.mp3?url';
import menuMusicUrl from '../../assets/Caldeira_Fury.mp3?url';
import dragaoMusicUrl from '../../assets/caldeira-bola.mp3?url';

let ctx = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export function resumeAudio() {
  const c = ac();
  if (c.state === 'suspended') c.resume();
  unlockSiii();
  resumeWantedMusic();
}

const menuMusic = new Audio(menuMusicUrl);
menuMusic.preload = 'auto';
menuMusic.volume = 0.62;
menuMusic.loop = true;

const dragaoMusic = new Audio(dragaoMusicUrl);
dragaoMusic.preload = 'auto';
dragaoMusic.volume = 0.58;
dragaoMusic.loop = true;

let wantedMusic = null;
let menuRestartTimer = null;

function tryPlay(audio) {
  const p = audio.play();
  if (p?.catch) p.catch(() => {});
}

function stopAudio(audio) {
  audio.pause();
  audio.currentTime = 0;
}

function stopMenuRestart() {
  if (!menuRestartTimer) return;
  clearInterval(menuRestartTimer);
  menuRestartTimer = null;
}

function resumeWantedMusic() {
  if (wantedMusic === 'menu') tryPlay(menuMusic);
  if (wantedMusic === 'dragao') tryPlay(dragaoMusic);
}

export function startMenuAmbience(options = {}) {
  wantedMusic = 'menu';
  stopMenuRestart();
  stopAudio(dragaoMusic);
  menuMusic.loop = !options.restartEvery10;
  menuMusic.currentTime = 0;
  tryPlay(menuMusic);
  if (options.restartEvery10) {
    menuRestartTimer = setInterval(() => {
      menuMusic.currentTime = 0;
      tryPlay(menuMusic);
    }, 10000);
  }
}

export function stopMenuAmbience() {
  if (wantedMusic === 'menu') wantedMusic = null;
  stopMenuRestart();
  stopAudio(menuMusic);
}

export function startGameplayMusic(mode) {
  if (mode === 'tutorial') {
    startMenuAmbience({ restartEvery10: true });
    return;
  }
  wantedMusic = 'dragao';
  stopMenuRestart();
  stopAudio(menuMusic);
  dragaoMusic.loop = true;
  if (dragaoMusic.paused) dragaoMusic.currentTime = 0;
  tryPlay(dragaoMusic);
}

let crowd = null;
export function startCrowd() {
  if (crowd) return;
  const c = ac();
  crowd = createSoftStadiumBed(c, { volume: 0.038, swell: 0.02, lowpass: 680 });
  crowd.g.gain.setValueAtTime(0.0001, c.currentTime);
  crowd.g.gain.linearRampToValueAtTime(0.038, c.currentTime + 1.4);
}

function createSoftStadiumBed(c, { volume, swell, lowpass }) {
  const dur = 7;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    last = (last * 0.985) + (w * 0.015);
    d[i] = last * 1.15;
  }

  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 90;
  hp.Q.value = 0.5;

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = lowpass;
  lp.Q.value = 0.45;

  const body = c.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 260;
  body.Q.value = 0.8;
  body.gain.value = 3;

  const g = c.createGain();
  g.gain.value = volume;

  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.055;
  const lg = c.createGain();
  lg.gain.value = swell;

  const swellOsc = c.createOscillator();
  swellOsc.type = 'sine';
  swellOsc.frequency.value = 0.017;
  const sg = c.createGain();
  sg.gain.value = swell * 0.65;

  lfo.connect(lg); lg.connect(g.gain);
  swellOsc.connect(sg); sg.connect(g.gain);
  src.connect(hp); hp.connect(lp); lp.connect(body); body.connect(g); g.connect(c.destination);
  src.start(); lfo.start(); swellOsc.start();

  return { src, g, lfo, swell: swellOsc };
}

function blip({ type = 'sine', f0, f1, dur = 0.18, vol = 0.25, delay = 0 }) {
  const c = ac();
  if (c.state === 'suspended') c.resume();
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseBurst(dur = 0.12, vol = 0.3, freq = 1800) {
  const c = ac();
  if (c.state === 'suspended') c.resume();
  const t = c.currentTime;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 0.9;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(bp); bp.connect(g); g.connect(c.destination);
  src.start(t); src.stop(t + dur);
}

export function playWhistle() {
  const c = ac();
  if (c.state === 'suspended') c.resume();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = 2300;
  const lfo = c.createOscillator();
  const lg = c.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 28;
  lg.gain.value = 120;
  lfo.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
  g.gain.setValueAtTime(0.3, t + 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(g); g.connect(c.destination);
  o.start(t); lfo.start(t); o.stop(t + 0.72); lfo.stop(t + 0.72);
  noiseBurst(0.12, 0.12, 3000);
}

export function playKick() {
  noiseBurst(0.10, 0.28, 2200);
  blip({ type: 'sine', f0: 160, f1: 60, dur: 0.14, vol: 0.3 });
}

export function playHurt() {
  blip({ type: 'sawtooth', f0: 380, f1: 90, dur: 0.28, vol: 0.28 });
}

export function playPickup() {
  blip({ type: 'square', f0: 660, f1: 660, dur: 0.08, vol: 0.2 });
  blip({ type: 'square', f0: 990, f1: 990, dur: 0.12, vol: 0.2, delay: 0.08 });
}

export function playJump() {
  const c = ac();
  if (c.state === 'suspended') c.resume();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(240, t);
  o.frequency.exponentialRampToValueAtTime(720, t + 0.13);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.24);
}

const siii = new Audio(siiiUrl);
siii.preload = 'auto';
siii.volume = 0.9;
let siiiUnlocked = false;

function unlockSiii() {
  if (siiiUnlocked) return;
  siiiUnlocked = true;
  const oldMuted = siii.muted;
  const oldVolume = siii.volume;
  siii.muted = true;
  siii.volume = 0;
  const p = siii.play();
  if (p?.then) {
    p.then(() => {
      siii.pause();
      siii.currentTime = 0;
      siii.muted = oldMuted;
      siii.volume = oldVolume;
    }).catch(() => {
      siii.muted = oldMuted;
      siii.volume = oldVolume;
    });
  } else {
    siii.pause();
    siii.currentTime = 0;
    siii.muted = oldMuted;
    siii.volume = oldVolume;
  }
}

export function playSiii() {
  try {
    siii.muted = false;
    siii.volume = 0.9;
    siii.currentTime = 0;
    const p = siii.play();
    if (p?.catch) p.catch(() => {
      blip({ type: 'sawtooth', f0: 520, f1: 980, dur: 0.22, vol: 0.28 });
      blip({ type: 'square', f0: 980, f1: 740, dur: 0.32, vol: 0.22, delay: 0.18 });
    });
  } catch (e) {
    blip({ type: 'sawtooth', f0: 520, f1: 980, dur: 0.22, vol: 0.28 });
  }
}
