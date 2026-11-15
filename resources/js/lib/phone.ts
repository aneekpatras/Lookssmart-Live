/**
 * Phone helper matching App\Support\Phone (keep both in step). Numbers are stored as digits with the
 * country code and no plus sign. Accepted: 03XXXXXXXXX, +923XXXXXXXXX, 923XXXXXXXXX, 00923XXXXXXXXX and
 * other international numbers written with a leading + (8 to 15 digits).
 */
export const PHONE_MESSAGE = 'Enter a valid WhatsApp number, for example 0300 1234567.';

export function normalizePhone(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (/[^\d\s\-().+]/.test(text)) return null;

  let hasPlus = text.startsWith('+');
  let digits = text.replace(/\D/g, '');

  if (digits.startsWith('0092')) {
    digits = digits.slice(2);
    hasPlus = true;
  }
  if (!hasPlus && /^03\d{9}$/.test(digits)) return `92${digits.slice(1)}`;
  if (digits.startsWith('92') && (hasPlus || digits.length === 12)) {
    return /^923\d{9}$/.test(digits) ? digits : null;
  }
  if (hasPlus && /^[1-9]\d{7,14}$/.test(digits)) return digits;
  return null;
}

/** "923001234567" becomes "+92 300 1234567". */
export function displayPhone(stored: string | null | undefined): string {
  const digits = (stored ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const match = digits.match(/^92(3\d{2})(\d{7})$/);
  return match ? `+92 ${match[1]} ${match[2]}` : `+${digits}`;
}
