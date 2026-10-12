// Audio-only clip player for narration. Used only when VOICE_ENABLED is true.

export function createVoice({ base = '/xp/voice/' } = {}) {
  let on = false;
  let audio = null;
  const stop = () => { if (audio) { audio.pause(); audio = null; } };
  return {
    play(id) {
      if (!on || !id) return;
      stop();
      audio = new Audio(`${base}${id}.mp3`);
      audio.play().catch(() => {});
    },
    stop,
    setOn(value) { on = !!value; if (!on) stop(); },
    get on() { return on; },
  };
}
