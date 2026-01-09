import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY is not defined');

  // Derive a 32-byte key from the provided key using SHA-256
  return createHash('sha256').update(key).digest();
}

/**
 * Encrypts data using AES-256-GCM
 * Returns: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext
 */
export function encrypt(plaintext: string): Buffer {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine: IV + Auth Tag + Ciphertext
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypts data encrypted with the encrypt function
 * Expects: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext
 */
export function decrypt(encryptedData: Buffer): string {
  const key = getEncryptionKey();

  // Extract components
  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Hash a value using SHA-256 (for tokens, IP addresses, etc.)
 */
export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

/**
 * Hash an IP address for privacy-preserving storage
 */
export function hashIpAddress(ip: string): string {
  // Add a salt to prevent rainbow table attacks
  const salt = process.env.ENCRYPTION_KEY || 'default-salt';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}
