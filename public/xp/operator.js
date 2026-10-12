// The AI's voice: ZW-Core types its lines into the terminal after a short
// thinking indicator, drives the orb's mood and announces each finished line
// once to screen readers. Lines are queued; a new line fast-forwards the one
// still typing so the AI never falls behind the visitor.

import { NARRATION } from './content.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const AI_PROMPT = 'zw-core> ';

export function createOperator({ term, liveEl, getCore, restingState = () => 'idle', voice = null, speed = 22, thinkMs = [300, 600] }) {
  let queue = Promise.resolve();
  let generation = 0;

  async function speak(text, voiceId, gen) {
    if (gen === generation) {
      getCore()?.setState('thinking');
      const thinking = term.print(`${AI_PROMPT}...`, 'ai ai-thinking');
      thinking.setAttribute('aria-hidden', 'true');
      await sleep(thinkMs[0] + Math.random() * (thinkMs[1] - thinkMs[0]));
      thinking.remove();
    }
    getCore()?.setState('speaking');
    if (voiceId) voice?.play(voiceId);
    const line = await term.typeLine(text, { prompt: AI_PROMPT, cls: 'ai', speed, skip: () => gen !== generation });
    line.setAttribute('aria-hidden', 'true');
    liveEl.textContent = text;
    if (gen === generation) getCore()?.setState(restingState());
  }

  return {
    say(idOrText) {
      const isId = typeof idOrText === 'string' && Object.hasOwn(NARRATION, idOrText);
      const text = isId ? NARRATION[idOrText] : String(idOrText);
      const gen = ++generation;
      queue = queue.then(() => speak(text, isId ? idOrText : null, gen)).catch(() => {});
      return queue;
    },
  };
}
