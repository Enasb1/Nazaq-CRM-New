const CryptoJS = require('crypto-js');

const KEY = process.env.ENCRYPTION_KEY;
if (!KEY || KEY.length < 32) {
  console.warn('⚠️  ENCRYPTION_KEY should be at least 32 characters');
}

/**
 * Encrypt a sensitive string value (e.g. ID number)
 * Returns a string safe to store in the database
 */
function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  return CryptoJS.AES.encrypt(String(plaintext), KEY).toString();
}

/**
 * Decrypt a previously encrypted value
 */
function decrypt(ciphertext) {
  if (!ciphertext) return ciphertext;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return ciphertext; // Return as-is if not encrypted (migration safety)
  }
}

/**
 * Encrypt sensitive fields in a student object before storing
 */
function encryptStudent(student) {
  if (!student) return student;
  const s = { ...student };
  if (s.id_number) s.id_number = encrypt(s.id_number);
  return s;
}

/**
 * Decrypt sensitive fields in a student object after reading
 */
function decryptStudent(student) {
  if (!student) return student;
  const s = { ...student };
  if (s.id_number) s.id_number = decrypt(s.id_number);
  return s;
}

module.exports = { encrypt, decrypt, encryptStudent, decryptStudent };
