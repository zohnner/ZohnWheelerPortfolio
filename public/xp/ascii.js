// Image to ASCII art. toAscii and luminance are pure; imageToAscii draws the
// image to a canvas in the browser and caches the result per image and width.

export const RAMP = ' .:-=+*#%@';

export function luminance(rgba) {
  const out = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  }
  return out;
}

export function toAscii(gray, w, h, cols, ramp = RAMP, aspect = 0.5) {
  const rows = Math.max(1, Math.round((h / w) * cols * aspect));
  const lines = [];
  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor((r * h) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((r + 1) * h) / rows));
    let line = '';
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c * w) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((c + 1) * w) / cols));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += gray[y * w + x]; n += 1; }
      line += ramp[Math.min(ramp.length - 1, Math.floor(((sum / n) / 256) * ramp.length))];
    }
    lines.push(line);
  }
  return lines;
}

const cache = new Map();

export function imageToAscii(src, cols) {
  const key = `${src}|${cols}`;
  if (!cache.has(key)) {
    cache.set(key, new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          const w = cols * 4;
          const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(toAscii(luminance(ctx.getImageData(0, 0, w, h).data), w, h, cols));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return cache.get(key);
}
