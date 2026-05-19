import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

function getKey(): Buffer {
  const hex = process.env.MARGARITA_TOKEN_SECRET || "";
  if (hex.length < 64) {
    // Fallback: derive from ANTHROPIC_API_KEY if secret not set (dev only)
    const fallback = process.env.ANTHROPIC_API_KEY || "dev-fallback-key-not-secure-32b!";
    return Buffer.from(fallback.padEnd(32, "0").slice(0, 32));
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptToken(ciphertext: string): string {
  try {
    const key = getKey();
    const parts = ciphertext.split(":");
    if (parts.length !== 2) return "";
    const iv = Buffer.from(parts[0], "hex");
    const enc = Buffer.from(parts[1], "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}
