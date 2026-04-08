import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const getSecretKey = () => {
  const secret = process.env.SESSION_SECRET || "fallback-secret-key-32-chars-long!";
  return crypto.createHash("sha256").update(String(secret)).digest('base64').substring(0, 32);
};
const KEY = Buffer.from(getSecretKey(), "utf8");
const IV_LENGTH = 16;

/**
 * Encrypts a string using AES-256-CBC
 */
export function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a cipher back to plain text
 */
export function decrypt(cipherText: string | null | undefined): string {
  if (!cipherText) return "";
  try {
    const [ivHex, encryptedHex] = cipherText.split(":");
    if (!ivHex || !encryptedHex) return cipherText; // Return original if not in IV:Encrypted format

    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Decryption failed:", error);
    return cipherText; // Return original if decryption fails
  }
}
