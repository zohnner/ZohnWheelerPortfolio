// Everything that reaches HTML goes through here. Content will come from
// scraped sites and AI drafts, so treat every string as hostile.

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
}

const SAFE_URL = /^(https:\/\/|tel:|mailto:|\/(?!\/)|#)/i;

export function safeUrl(url) {
  const u = String(url ?? '').trim();
  return SAFE_URL.test(u) ? u : '#';
}

// Input is already HTML-escaped, so link URLs are safe inside the attribute.
function inline(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => `<a href="${safeUrl(url)}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// Deliberately tiny markdown subset: paragraphs, "- " lists, **bold**,
// *italic*, [links](https:|tel:|mailto:|/path). Anything else is plain text.
export function md(src) {
  const blocks = String(src ?? '').replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  return blocks
    .filter((b) => b.trim())
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(esc(l.replace(/^\s*[-*]\s+/, '')))}</li>`).join('')}</ul>`;
      }
      return `<p>${inline(esc(lines.map((l) => l.trim()).join(' ')))}</p>`;
    })
    .join('');
}
