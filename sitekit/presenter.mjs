// Presenter mode = Zohn's own tablet during a sales visit. The cookie value is
// an HMAC of a fixed string keyed with ADMIN_TOKEN, so it can be verified
// without storing sessions, and rotating ADMIN_TOKEN logs every device out.

export const PRESENTER_COOKIE = 'sk_presenter';
const enc = new TextEncoder();

export function safeEqual(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  if (!x || x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export function readCookie(header, name) {
  for (const part of String(header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export async function presenterCookieValue(adminToken) {
  const key = await crypto.subtle.importKey('raw', enc.encode(adminToken), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('sitekit-presenter'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function isPresenter(cookieHeader, adminToken) {
  if (!adminToken) return false;
  const value = readCookie(cookieHeader, PRESENTER_COOKIE);
  if (!value) return false;
  return safeEqual(value, await presenterCookieValue(adminToken));
}

export function deviceFromUA(ua) {
  const s = String(ua ?? '');
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(s)) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(s)) return 'mobile';
  return 'desktop';
}
