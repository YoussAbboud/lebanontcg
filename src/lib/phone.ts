// Phone numbers shared in chat. Stored in E.164 form (+96170123456) so the
// database can check them and the Call / WhatsApp links work everywhere.
// A number typed without a country code is read as Lebanese: the site is
// Lebanese and that is how people write their own number ("70 123 456",
// "03 123 456").

export const LEBANON_CODE = '961';

/** E.164 form of what was typed, or null if it isn't a plausible number. */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw || /[^\d\s+().-]/.test(raw)) return null;
  const digits = raw.replace(/\D/g, '');
  let intl: string;
  if (raw.startsWith('+')) intl = digits;
  else if (digits.startsWith('00')) intl = digits.slice(2);
  else intl = LEBANON_CODE + digits.replace(/^0/, '');
  // E.164: country code never starts with 0, at most 15 digits in all.
  if (!/^[1-9]\d{6,14}$/.test(intl)) return null;
  // Lebanese numbers are 7 (landline, with area code) or 8 digits after 961.
  if (intl.startsWith(LEBANON_CODE)) {
    const local = intl.slice(LEBANON_CODE.length);
    if (local.length < 7 || local.length > 8) return null;
  }
  return `+${intl}`;
}

/** Readable form: +961 70 123 456 for Lebanese numbers, as stored otherwise. */
export function formatPhone(e164: string): string {
  const intl = e164.replace(/^\+/, '');
  if (intl.startsWith(LEBANON_CODE)) {
    const local = intl.slice(LEBANON_CODE.length);
    const head = local.length === 8 ? local.slice(0, 2) : local.slice(0, 1);
    const rest = local.slice(head.length);
    return `+${LEBANON_CODE} ${head} ${rest.slice(0, 3)} ${rest.slice(3)}`;
  }
  return e164;
}

export const telHref = (e164: string): string => `tel:${e164}`;
export const whatsappHref = (e164: string): string => `https://wa.me/${e164.replace(/^\+/, '')}`;
