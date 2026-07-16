import type { UAVInput } from '../types';

/** Base64url-encodes a UAVInput into a URL-safe string for shareable links. */
export function encodeConfig(input: UAVInput): string {
  const json = JSON.stringify(input);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes a config string produced by encodeConfig. Returns null on any
 * malformed input rather than throwing, since this typically comes from a
 * pasted URL that could be edited or truncated by the user. */
export function decodeConfig(encoded: string): UAVInput | null {
  try {
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as UAVInput;
  } catch {
    return null;
  }
}

export function buildShareableUrl(input: UAVInput): string {
  const encoded = encodeConfig(input);
  const url = new URL(window.location.href);
  url.pathname = '/input';
  url.search = `?config=${encoded}`;
  return url.toString();
}
