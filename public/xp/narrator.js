// Captions first, voice second. Every line is typed into the visible caption
// and announced once, in full, to screen readers. Audio plays only when the
// visitor has turned sound on, and a missing clip is silently skipped.

import { NARRATION } from './content.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createNarrator({
  captionEl,
  liveEl,
  voiceBase = '/xp/voice/',
  charMs = 32,
  onSpeakStart = () => {},
  onSpeakEnd = () => {},
}) {
  let sound = false;
  let audio = null;
  let release = null;
  let token = 0;

  function stopAudio() {
    if (audio) { audio.pause(); audio = null; }
    if (release) { release(); release = null; }
  }

  async function show(text, voiceId) {
    const mine = ++token;
    stopAudio();
    liveEl.textContent = text;
    captionEl.textContent = '';
    onSpeakStart();

    let done = sleep(700);
    if (sound && voiceId) {
      const clip = new Audio(`${voiceBase}${voiceId}.mp3`);
      audio = clip;
      done = new Promise((resolve) => {
        release = resolve;
        clip.addEventListener('ended', resolve, { once: true });
        clip.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 15000);
      });
      clip.play().catch(() => { if (mine === token) stopAudio(); });
    }

    for (const ch of text) {
      if (mine !== token) return;
      captionEl.textContent += ch;
      await sleep(charMs);
    }
    await done;
    if (mine === token) onSpeakEnd();
  }

  return {
    say(id) {
      const text = NARRATION[id];
      return text ? show(text, id) : Promise.resolve();
    },
    caption(text) { return show(String(text), null); },
    setSound(on) {
      sound = !!on;
      if (!sound) stopAudio();
    },
    get sound() { return sound; },
  };
}
