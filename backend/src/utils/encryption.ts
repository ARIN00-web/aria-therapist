import crypto from 'crypto';
import { getConfig } from '../config/env';


const getEncryptionKey = (): Buffer => {
  const secret = getConfig().encryptionKey;
  return crypto.createHash('sha256').update(secret).digest();
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function encrypt(text: string): string {
  if (!text) return text;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}


export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    const [ivHex, authTagHex, encryptedHex] = parts;

    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[encryption:decrypt_failed]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'unknown'
    });

    return '[Encrypted Content - Decryption Failed]';
  }
}
