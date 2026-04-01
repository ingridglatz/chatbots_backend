const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;

const getEncryptionKey = () => {
  const secret =
    process.env.JWT_SECRET || "fallback-secret-change-in-production";
  return crypto.scryptSync(secret, "chatbots-salt-v1", KEY_LENGTH);
};

const encrypt = (text) => {
  if (!text) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  try {
    const [ivHex, authTagHex, cipherHex] = encryptedText.split(":");
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const cipherText = Buffer.from(cipherHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return (
      decipher.update(cipherText, undefined, "utf8") + decipher.final("utf8")
    );
  } catch {
    return null;
  }
};

const maskApiKey = (key) => {
  if (!key || key.length < 12) return "••••••••";
  return key.slice(0, 12) + "••••••••" + key.slice(-4);
};

module.exports = { encrypt, decrypt, maskApiKey };
