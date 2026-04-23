import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX   = process.env.ENCRYPTION_KEY ?? '';

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length < 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate one with: openssl rand -hex 32'
    );
  }
  return Buffer.from(KEY_HEX, 'hex');
}

export interface EncryptedToken {
  encrypted: string;
  iv: string;
  authTag: string;
}

export function encryptToken(plaintext: string): EncryptedToken {
  const iv     = randomBytes(12);
  const key    = getKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    encrypted: encrypted.toString('base64'),
    iv:        iv.toString('base64'),
    authTag:   cipher.getAuthTag().toString('base64'),
  };
}

export function decryptToken({ encrypted, iv, authTag }: EncryptedToken): string {
  const key      = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Serialize for DB storage: packs encrypted + iv + authTag into one string */
export function packToken(token: EncryptedToken): string {
  return JSON.stringify(token);
}

/** Deserialize from DB storage */
export function unpackToken(packed: string): EncryptedToken {
  return JSON.parse(packed) as EncryptedToken;
}
