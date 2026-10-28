// Phone numbers shared in chat. Stored in E.164 form (+96170123456) so the
// database can check them and the Call / WhatsApp links work everywhere.
// The picker supplies the country code and the person types the number the
// way they say it ("70 123 456", "03 123 456"); a number typed with its own
// "+" or "00" prefix wins over the picker.

import { countryOfPhone } from './countries';

export const LEBANON_CODE = '961';

// Countries whose numbers keep their leading 0 after the country code.
const KEEPS_LEADING_ZERO = new Set(['39', '378']); // Italy (and Vatican), San Marino

/** E.164 form of what was typed, or null if it isn't a plausible number. */
export function normalizePhone(input: string, dial: string = LEBANON_CODE): string | null {
  const raw = input.trim();
  if (!raw || /[^\d\s+().-]/.test(raw)) return null;
  const digits = raw.replace(/\D/g, '');
  let intl: string;
  if (raw.startsWith('+')) intl = digits;
  else if (digits.startsWith('00')) intl = digits.slice(2);
  else intl = dial + (KEEPS_LEADING_ZERO.has(dial) ? digits : digits.replace(/^0/, ''));
  // E.164: country code never starts with 0, at most 15 digits in all.
  if (!/^[1-9]\d{6,14}$/.test(intl)) return null;
  // Lebanese numbers are 7 (landline, with area code) or 8 digits after 961.
  if (intl.startsWith(LEBANON_CODE)) {
    const local = intl.slice(LEBANON_CODE.length);
    if (local.length < 7 || local.length > 8) return null;
  }
  return `+${intl}`;
}

/** The national part of an E.164 number for a given calling code, for
    prefilling the field ('+96170123456', '961' → '70 123 456'). */
export function nationalPart(e164: string, dial: string): string {
  const intl = e164.replace(/^\+/, '');
  if (!intl.startsWith(dial)) return e164;
  const local = intl.slice(dial.length);
  return dial === LEBANON_CODE ? groupLebanese(local) : local;
}

function groupLebanese(local: string): string {
  const head = local.length === 8 ? local.slice(0, 2) : local.slice(0, 1);
  const rest = local.slice(head.length);
  return `${head} ${rest.slice(0, 3)} ${rest.slice(3)}`;
}

/** Readable form: "+961 70 123 456" for Lebanese numbers, "+33 612345678"
    (code, then the rest) for others. */
export function formatPhone(e164: string): string {
  const intl = e164.replace(/^\+/, '');
  if (intl.startsWith(LEBANON_CODE)) {
    return `+${LEBANON_CODE} ${groupLebanese(intl.slice(LEBANON_CODE.length))}`;
  }
  const country = countryOfPhone(e164);
  return country ? `+${country.dial} ${intl.slice(country.dial.length)}` : e164;
}

export const telHref = (e164: string): string => `tel:${e164}`;
export const whatsappHref = (e164: string): string => `https://wa.me/${e164.replace(/^\+/, '')}`;
