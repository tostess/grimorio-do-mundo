import QRCode from 'qrcode';

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateShortCode(): string {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

export function buildSessionUrl(code: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?join=${code}`;
}

export function parseJoinCode(): string | null {
  return new URLSearchParams(window.location.search).get('join');
}

export async function generateQRDataUrl(code: string): Promise<string> {
  const url = buildSessionUrl(code);
  return QRCode.toDataURL(url, {
    width: 240,
    margin: 1,
    color: { dark: '#c9a84c', light: '#13131a' },
  });
}
