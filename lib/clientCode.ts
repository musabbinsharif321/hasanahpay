import { doc, getDoc, type Firestore } from 'firebase/firestore';

const CLIENT_CODE_REGEX = /^HP-[0-9]{6}$/;

/**
 * Normalizes user input such as "hp-123456", "HP123456", or "123456"
 * into the canonical "HP-XXXXXX" format. Returns null if not a client ID.
 */
export function normalizeClientCode(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return null;

  if (CLIENT_CODE_REGEX.test(cleaned)) {
    return cleaned;
  }

  const digitsOnly = cleaned.startsWith('HP') ? cleaned.slice(2).replace(/^-/, '') : cleaned;
  if (/^[0-9]{6}$/.test(digitsOnly)) {
    return `HP-${digitsOnly}`;
  }

  return null;
}

/**
 * Normalizes a phone number into E.164 format (e.g. Bangladesh 017XXXXXXXX -> +88017XXXXXXXX).
 * Returns null if the number does not look valid.
 */
export function normalizePhoneE164(raw: string): string | null {
  const cleaned = raw.trim().replace(/[\s\-()]/g, '');
  if (!cleaned) return null;

  if (cleaned.startsWith('+')) {
    return /^\+[1-9][0-9]{9,14}$/.test(cleaned) ? cleaned : null;
  }

  if (/^8801[3-9][0-9]{8}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  if (/^01[3-9][0-9]{8}$/.test(cleaned)) {
    return `+88${cleaned}`;
  }

  if (/^[1-9][0-9]{9,14}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return null;
}

/**
 * Generates a random 6-digit Client ID (HP-XXXXXX) and verifies uniqueness
 * against the `clientIds` lookup collection.
 */
export async function generateUniqueClientCode(db: Firestore): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const num = Math.floor(100000 + Math.random() * 900000);
    const candidate = `HP-${num}`;
    const snap = await getDoc(doc(db, 'clientIds', candidate));
    if (!snap.exists()) {
      return candidate;
    }
  }
  // Fallback using timestamp suffix if random collisions occur
  const fallbackNum = String(Date.now()).slice(-6);
  return `HP-${fallbackNum}`;
}
