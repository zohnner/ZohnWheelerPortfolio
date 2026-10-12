// Renders public/xp/voice/<id>.mp3 for every line in NARRATION with Piper
// (free, local TTS) and ffmpeg. Re-run after editing narration text.
//
//   node scripts/render-voice.mjs [--voice en_GB-alan-medium] [--only intro,bio] [--out public/xp/voice]

import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { NARRATION } from '../public/xp/content.js';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const voice = opt('voice', 'en_GB-alan-medium');
const outDir = resolve(opt('out', 'public/xp/voice'));
const only = opt('only', '').split(',').filter(Boolean);
const dataDir = resolve('.voices');
const python = process.env.PYTHON || 'python';
const MAX_BYTES = 30 * 1024;

function run(cmd, args, input) {
  const r = spawnSync(cmd, args, { input, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`${cmd} ${args.join(' ')}\n${r.stderr || r.error}`);
    process.exit(1);
  }
}

mkdirSync(outDir, { recursive: true });
mkdirSync(dataDir, { recursive: true });
if (!existsSync(join(dataDir, `${voice}.onnx`))) run(python, ['-m', 'piper.download_voices', '--data-dir', dataDir, voice]);

let over = 0;
for (const [id, text] of Object.entries(NARRATION)) {
  if (only.length && !only.includes(id)) continue;
  const wav = join(tmpdir(), `zw-voice-${id}.wav`);
  const mp3 = join(outDir, `${id}.mp3`);
  run(python, ['-m', 'piper', '--data-dir', dataDir, '-m', voice, '-f', wav], text);
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', '22050', '-b:a', '32k', mp3]);
  rmSync(wav, { force: true });
  const size = statSync(mp3).size;
  if (size > MAX_BYTES) over += 1;
  console.log(`${size > MAX_BYTES ? 'OVER' : 'ok  '} ${id}.mp3 ${(size / 1024).toFixed(1)} KB`);
}
if (over) {
  console.error(`${over} clip(s) over 30 KB. Shorten those lines in content.js and re-run.`);
  process.exit(1);
}
