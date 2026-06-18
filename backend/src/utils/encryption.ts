import crypto from 'crypto';


const getEncryptionKey = (): Buffer => {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  return crypto.createHash('sha256').update(secret).digest();
};

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; 

export function encrypt(text: string): string {
  if (!text) return text;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  
  return `${iv.toString('hex')}:${encrypted}`;
}


export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    const ivHex = parts.shift();
    const encryptedHex = parts.join(':');

    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[Encryption Utility]: Decryption failed:', error);

    return '[Encrypted Content - Decryption Failed]';
  }
}
