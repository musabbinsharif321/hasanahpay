'use client';

export interface BiometricDeviceProfile {
  credentialId: string;
  email: string;
  displayName: string;
  companyName: string;
  rpId: string;
  createdAt: number;
  lastUsedAt: number;
}

interface StoredBiometricVaultRecord extends BiometricDeviceProfile {
  id: string;
  publicKeySpki: ArrayBuffer | null;
  publicKeyAlgorithm: number;
  iv: Uint8Array;
  encryptedPassword: ArrayBuffer;
  wrappingKey: CryptoKey;
}

export interface BiometricAvailability {
  supported: boolean;
  platformAuthenticator: boolean;
  label: string;
}

const DB_NAME = 'hasanah_biometric_vault';
const DB_VERSION = 1;
const STORE_NAME = 'credentials';
const PRIMARY_KEY = 'primary';

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLength);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function getBiometricLabel(): string {
  if (typeof window === 'undefined') return 'Biometric Passkey';
  const ua = window.navigator.userAgent.toLowerCase();
  const platform = (window.navigator.platform || '').toLowerCase();

  if (/iphone|ipad|ipod/.test(ua) || (platform === 'macintel' && window.navigator.maxTouchPoints > 1)) {
    return 'Face ID / Touch ID';
  }
  if (/mac/.test(platform) || /macintosh/.test(ua)) {
    return 'Touch ID';
  }
  if (/android/.test(ua)) {
    return 'Fingerprint / Biometrics';
  }
  if (/win/.test(platform) || /windows/.test(ua)) {
    return 'Windows Hello';
  }
  return 'Fingerprint / Face ID';
}

export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  const label = getBiometricLabel();
  if (
    typeof window === 'undefined' ||
    typeof window.PublicKeyCredential === 'undefined' ||
    typeof navigator.credentials?.create !== 'function' ||
    typeof navigator.credentials?.get !== 'function' ||
    typeof window.crypto?.subtle === 'undefined' ||
    typeof window.indexedDB === 'undefined' ||
    !window.isSecureContext
  ) {
    return { supported: false, platformAuthenticator: false, label };
  }

  try {
    const platformAuthenticator =
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
        ? await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        : false;
    return {
      supported: true,
      platformAuthenticator,
      label,
    };
  } catch {
    return { supported: true, platformAuthenticator: false, label };
  }
}

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open biometric vault.'));
  });
}

async function readVaultRecord(): Promise<StoredBiometricVaultRecord | null> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return null;
  }
  let db: IDBDatabase | null = null;
  try {
    db = await openVaultDB();
    return await new Promise((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(PRIMARY_KEY);
      req.onsuccess = () => {
        resolve((req.result as StoredBiometricVaultRecord | undefined) ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

async function writeVaultRecord(record: StoredBiometricVaultRecord): Promise<void> {
  const db = await openVaultDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to store biometric record.'));
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hasanah-biometric-updated'));
    }
  } finally {
    db.close();
  }
}

export async function clearBiometricCredential(): Promise<void> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return;
  let db: IDBDatabase | null = null;
  try {
    db = await openVaultDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(PRIMARY_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    window.dispatchEvent(new Event('hasanah-biometric-updated'));
  } finally {
    db?.close();
  }
}

export async function getEnrolledBiometricProfile(): Promise<BiometricDeviceProfile | null> {
  const record = await readVaultRecord();
  if (!record) return null;
  if (typeof window !== 'undefined' && record.rpId !== window.location.hostname) {
    return null;
  }
  return {
    credentialId: record.credentialId,
    email: record.email,
    displayName: record.displayName,
    companyName: record.companyName,
    rpId: record.rpId,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
  };
}

/**
 * Converts an ASN.1 DER-encoded ECDSA signature from a WebAuthn hardware authenticator
 * into raw 64-byte IEEE P1363 (r || s) format required by SubtleCrypto.verify().
 */
function derToP1363(der: Uint8Array): Uint8Array {
  if (der.length < 8 || der[0] !== 0x30) {
    throw new Error('Invalid DER signature format.');
  }
  let offset = 2;
  if (der[1] & 0x80) {
    const lenBytes = der[1] & 0x7f;
    offset = 2 + lenBytes;
  }
  if (der[offset] !== 0x02) throw new Error('Invalid DER R integer.');
  const rLen = der[offset + 1];
  const rStart = offset + 2;
  const rSlice = der.slice(rStart, rStart + rLen);

  const sTagOffset = rStart + rLen;
  if (der[sTagOffset] !== 0x02) throw new Error('Invalid DER S integer.');
  const sLen = der[sTagOffset + 1];
  const sStart = sTagOffset + 2;
  const sSlice = der.slice(sStart, sStart + sLen);

  const normalize32 = (bytes: Uint8Array): Uint8Array => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0x00) {
      start += 1;
    }
    const trimmed = bytes.slice(start);
    if (trimmed.length > 32) {
      return trimmed.slice(trimmed.length - 32);
    }
    const out = new Uint8Array(32);
    out.set(trimmed, 32 - trimmed.length);
    return out;
  };

  const result = new Uint8Array(64);
  result.set(normalize32(rSlice), 0);
  result.set(normalize32(sSlice), 32);
  return result;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function enrollBiometricCredential(params: {
  uid: string;
  email: string;
  displayName: string;
  companyName: string;
  password: string;
}): Promise<BiometricDeviceProfile> {
  const availability = await checkBiometricAvailability();
  if (!availability.supported) {
    throw new Error('Web Authentication is not supported in this browser.');
  }

  const rpId = window.location.hostname;
  const challenge = window.crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(params.uid).slice(0, 64);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: toArrayBuffer(challenge),
      rp: {
        name: 'Hasanah Tech Solutions',
        id: rpId,
      },
      user: {
        id: toArrayBuffer(userIdBytes),
        name: params.email,
        displayName: params.displayName || params.email,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Biometric registration was cancelled.');
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  const clientDataRaw = new Uint8Array(response.clientDataJSON);
  const clientData = JSON.parse(new TextDecoder().decode(clientDataRaw)) as {
    type?: string;
    challenge?: string;
    origin?: string;
  };

  if (
    clientData.type !== 'webauthn.create' ||
    clientData.challenge !== bufferToBase64Url(challenge) ||
    clientData.origin !== window.location.origin
  ) {
    throw new Error('WebAuthn registration validation failed.');
  }

  // Optional SPKI public key extraction for strict hardware assertion signature verification
  const publicKeySpki =
    typeof response.getPublicKey === 'function' ? response.getPublicKey() : null;
  const publicKeyAlgorithm =
    typeof response.getPublicKeyAlgorithm === 'function'
      ? response.getPublicKeyAlgorithm()
      : -7;

  // Generate a non-extractable AES-GCM 256-bit wrapping key stored only in IndexedDB
  const wrappingKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedPassword = new TextEncoder().encode(params.password);
  const encryptedPassword = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    wrappingKey,
    toArrayBuffer(encodedPassword)
  );

  const now = Date.now();
  const record: StoredBiometricVaultRecord = {
    id: PRIMARY_KEY,
    credentialId: bufferToBase64Url(credential.rawId),
    email: params.email,
    displayName: params.displayName,
    companyName: params.companyName,
    rpId,
    publicKeySpki,
    publicKeyAlgorithm,
    iv,
    encryptedPassword,
    wrappingKey,
    createdAt: now,
    lastUsedAt: now,
  };

  await writeVaultRecord(record);

  return {
    credentialId: record.credentialId,
    email: record.email,
    displayName: record.displayName,
    companyName: record.companyName,
    rpId: record.rpId,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
  };
}

export async function authenticateWithBiometrics(): Promise<{
  email: string;
  password: string;
  profile: BiometricDeviceProfile;
}> {
  const record = await readVaultRecord();
  if (!record) {
    throw new Error('No biometric passkey is registered on this device.');
  }
  if (record.rpId !== window.location.hostname) {
    throw new Error('Biometric passkey domain mismatch. Please re-enroll on this domain.');
  }

  const challenge = window.crypto.getRandomValues(new Uint8Array(32));
  const credIdBytes = base64UrlToUint8Array(record.credentialId);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: toArrayBuffer(challenge),
      rpId: record.rpId,
      allowCredentials: [
        {
          id: toArrayBuffer(credIdBytes),
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error('Biometric verification was cancelled.');
  }

  const response = assertion.response as AuthenticatorAssertionResponse;
  const clientDataBytes = new Uint8Array(response.clientDataJSON);
  const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes)) as {
    type?: string;
    challenge?: string;
    origin?: string;
  };

  if (
    clientData.type !== 'webauthn.get' ||
    clientData.challenge !== bufferToBase64Url(challenge) ||
    clientData.origin !== window.location.origin
  ) {
    throw new Error('WebAuthn challenge or origin check failed.');
  }

  const authDataBytes = new Uint8Array(response.authenticatorData);
  if (authDataBytes.byteLength < 37) {
    throw new Error('Malformed authenticator data.');
  }

  const expectedRpIdHash = new Uint8Array(
    await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(record.rpId))
  );
  if (!bytesEqual(authDataBytes.slice(0, 32), expectedRpIdHash)) {
    throw new Error('Authenticator RP ID hash mismatch.');
  }

  const flags = authDataBytes[32];
  const userPresent = (flags & 0x01) !== 0;
  const userVerified = (flags & 0x04) !== 0;
  if (!userPresent || !userVerified) {
    throw new Error('Biometric user verification was not confirmed by device.');
  }

  if (record.publicKeySpki) {
    const clientDataHash = new Uint8Array(
      await window.crypto.subtle.digest('SHA-256', toArrayBuffer(clientDataBytes))
    );
    const signedData = concatBytes(authDataBytes, clientDataHash);
    const signatureRaw = new Uint8Array(response.signature);

    if (record.publicKeyAlgorithm === -7) {
      const cryptoKey = await window.crypto.subtle.importKey(
        'spki',
        record.publicKeySpki,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );
      const p1363Sig = derToP1363(signatureRaw);
      const valid = await window.crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        toArrayBuffer(p1363Sig),
        toArrayBuffer(signedData)
      );
      if (!valid) {
        throw new Error('Biometric cryptographic signature verification failed.');
      }
    } else if (record.publicKeyAlgorithm === -257) {
      const cryptoKey = await window.crypto.subtle.importKey(
        'spki',
        record.publicKeySpki,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      const valid = await window.crypto.subtle.verify(
        { name: 'RSASSA-PKCS1-v1_5' },
        cryptoKey,
        toArrayBuffer(signatureRaw),
        toArrayBuffer(signedData)
      );
      if (!valid) {
        throw new Error('Biometric cryptographic signature verification failed.');
      }
    }
  }

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(record.iv) },
    record.wrappingKey,
    record.encryptedPassword
  );
  const password = new TextDecoder().decode(decryptedBuffer);

  const updatedRecord: StoredBiometricVaultRecord = {
    ...record,
    lastUsedAt: Date.now(),
  };
  await writeVaultRecord(updatedRecord);

  return {
    email: record.email,
    password,
    profile: {
      credentialId: updatedRecord.credentialId,
      email: updatedRecord.email,
      displayName: updatedRecord.displayName,
      companyName: updatedRecord.companyName,
      rpId: updatedRecord.rpId,
      createdAt: updatedRecord.createdAt,
      lastUsedAt: updatedRecord.lastUsedAt,
    },
  };
}

export function formatWebAuthnError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') {
      return 'Biometric prompt was cancelled or blocked by this preview frame. Open in a direct mobile or desktop browser tab to use Fingerprint / Face ID.';
    }
    if (err.name === 'SecurityError') {
      return 'WebAuthn requires a secure HTTPS origin with matching domain.';
    }
    if (err.name === 'InvalidStateError') {
      return 'A biometric credential is already registered on this device.';
    }
    if (err.name === 'NotSupportedError') {
      return 'This device does not have a compatible Fingerprint or Face ID authenticator.';
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Biometric authentication could not be completed.';
}
