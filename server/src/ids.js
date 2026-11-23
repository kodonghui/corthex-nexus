// The contract's IDs for the store's rows: a prefix, an underscore and 12 characters of [0-9a-hjkmnp-tv-z], such as
// ac_ for an agent credential (components.schemas of api/openapi.yaml).
//
// The store keeps no ID of its own: each row has its INTEGER key with AUTOINCREMENT, which is never given out twice
// (db/nexus.sql). So a row's ID is its key written in base 32 with those 32 characters, 12 of them with leading zeros,
// and an ID is read back to its key. An ID is not a secret: an agent credential is checked by its secret, and the
// same refusal answers an unknown ID and a wrong secret (access_missing).

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
const DIGITS = 12;
const PREFIX = /^[a-z]{2}$/;
const BASE = 32;
const LARGEST = BigInt(Number.MAX_SAFE_INTEGER);

// The ID of the row whose key is number, with its prefix.
export function idOf(prefix, number) {
  checkPrefix(prefix);
  if (!Number.isSafeInteger(number) || number < 1) throw new TypeError('a row key is a positive integer');
  let text = '';
  for (let rest = number; rest > 0; rest = Math.floor(rest / BASE)) text = ALPHABET[rest % BASE] + text;
  return `${prefix}_${text.padStart(DIGITS, '0')}`;
}

// The key of the row an ID names, or null when the text is not an ID with this prefix or names no key the store can
// hold, such as one past JavaScript's safe integers.
export function keyOf(prefix, text) {
  checkPrefix(prefix);
  if (typeof text !== 'string' || text.length !== prefix.length + 1 + DIGITS || !text.startsWith(`${prefix}_`)) return null;
  let value = 0n;
  for (const char of text.slice(prefix.length + 1)) {
    const digit = ALPHABET.indexOf(char);
    if (digit === -1) return null;
    value = value * BigInt(BASE) + BigInt(digit);
  }
  return value >= 1n && value <= LARGEST ? Number(value) : null;
}

function checkPrefix(prefix) {
  if (typeof prefix !== 'string' || !PREFIX.test(prefix)) throw new TypeError('an ID prefix is two lowercase letters');
}
