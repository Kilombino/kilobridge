// Just enough BOLT 11 to check an invoice before and after the bridge sees it:
// amount, timestamp, expiry, payment hash, feature bits and who signed it (the
// payee node, recovered from the signature, or the n field when present).
'use strict';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values) {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}

function hrpExpand(hrp) {
  const out = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

function toBytes(words) {
  let acc = 0, bits = 0;
  const out = [];
  for (const w of words) {
    acc = (acc << 5) | w;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

// secp256k1, only what recovering the signer of an invoice needs.
const P = 2n ** 256n - 2n ** 32n - 977n;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const G = [0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n];
const mod = (a, m) => ((a % m) + m) % m;
function inv(a, m) {
  let [r0, r1, s0, s1] = [mod(a, m), m, 1n, 0n];
  while (r1) { const q = r0 / r1; [r0, r1, s0, s1] = [r1, r0 - q * r1, s1, s0 - q * s1]; }
  return mod(s0, m);
}
function pow(b, e, m) {
  let r = 1n;
  for (b = mod(b, m); e; e >>= 1n, b = b * b % m) if (e & 1n) r = r * b % m;
  return r;
}
function add(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a[0] === b[0] && mod(a[1] + b[1], P) === 0n) return null;
  const l = a[0] === b[0] ? 3n * a[0] * a[0] * inv(2n * a[1], P) : (b[1] - a[1]) * inv(b[0] - a[0], P);
  const x = mod(l * l - a[0] - b[0], P);
  return [x, mod(l * (a[0] - x) - a[1], P)];
}
function mul(k, pt) {
  let r = null;
  for (; k; k >>= 1n, pt = add(pt, pt)) if (k & 1n) r = add(r, pt);
  return r;
}
const big = b => BigInt('0x' + (b.toString('hex') || '0'));

// The compressed public key that made a recoverable signature over hash, or null.
function recover(hash, sig, recid) {
  const r = big(sig.subarray(0, 32)), s = big(sig.subarray(32, 64));
  if (!r || r >= N || !s || s >= N || recid > 1) return null;
  const y2 = mod(r ** 3n + 7n, P);
  let y = pow(y2, (P + 1n) / 4n, P);
  if (y * y % P !== y2) return null;
  if ((y & 1n) !== BigInt(recid & 1)) y = P - y;
  const ri = inv(r, N);
  const q = add(mul(mod(s * ri, N), [r, y]), mul(mod(-big(hash) * ri, N), G));
  if (!q) return null;
  return ((q[1] & 1n) ? '03' : '02') + q[0].toString(16).padStart(64, '0');
}

// The bytes the signature covers: the human-readable part, then the data words
// before the signature as bytes, the last one padded with zero bits.
function signedBytes(hrp, words) {
  let acc = 0, bits = 0;
  const out = [];
  for (const w of words) {
    acc = ((acc << 5) | w) & 0xffff;
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
  }
  if (bits) out.push((acc << (8 - bits)) & 0xff);
  return Buffer.concat([Buffer.from(hrp, 'utf8'), Buffer.from(out)]);
}

const MULT = { m: 100_000_000n, u: 100_000n, n: 100n, p: 1n }; // msat per unit of 1e-3, 1e-6, 1e-9, 1e-12 BTC

function decode(invoice) {
  if (typeof invoice !== 'string') throw new Error('not_text');
  let s = invoice.trim();
  if (s.toLowerCase().startsWith('lightning:')) s = s.slice(10);
  if (s.length > 2000 || s.length < 100) throw new Error('bad_length');
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) throw new Error('mixed_case');
  s = s.toLowerCase();
  const sep = s.lastIndexOf('1');
  const hrp = s.slice(0, sep);
  const data = [];
  for (const c of s.slice(sep + 1)) {
    const v = CHARSET.indexOf(c);
    if (v < 0) throw new Error('bad_char');
    data.push(v);
  }
  if (polymod([...hrpExpand(hrp), ...data]) !== 1) throw new Error('checksum');

  const m = /^ln(bc|tb|bcrt|tbs)(\d+)?([munp])?$/.exec(hrp);
  if (!m) throw new Error('not_lightning');
  let msat = null;
  if (m[2]) {
    const n = BigInt(m[2]);
    if (!m[3]) msat = n * 100_000_000_000n;
    else if (m[3] === 'p') {
      if (n % 10n) throw new Error('bad_amount');
      msat = n / 10n;
    } else msat = n * MULT[m[3]];
  }

  const words = data.slice(0, -6 - 104); // drop the checksum and the signature
  let timestamp = 0;
  for (const w of words.slice(0, 7)) timestamp = timestamp * 32 + w;
  let expiry = 3600, hash = null, features = [], minCltv = 18, nodeField = null;
  for (let i = 7; i + 3 <= words.length;) {
    const tag = words[i], len = words[i + 1] * 32 + words[i + 2];
    const field = words.slice(i + 3, i + 3 + len);
    i += 3 + len;
    if (tag === 1 && len === 52) hash = toBytes(field).subarray(0, 32).toString('hex');
    else if (tag === 19 && len === 53) nodeField = toBytes(field).subarray(0, 33).toString('hex');
    else if (tag === 6) expiry = field.reduce((a, w) => a * 32 + w, 0);
    else if (tag === 24) minCltv = field.reduce((a, w) => a * 32 + w, 0);
    else if (tag === 5) {
      // Feature bits, most significant first: bit 0 is the last word's lowest bit.
      for (let w = 0; w < field.length; w++) {
        for (let b = 0; b < 5; b++) {
          if ((field[field.length - 1 - w] >> b) & 1) features.push(w * 5 + b);
        }
      }
    }
  }
  if (!hash) throw new Error('no_hash');
  // The payee: with an n field the signature must be by that key; without one, the key is
  // recovered from it. null if the signature does not hold.
  const sigBytes = toBytes(data.slice(-6 - 104, -6));
  const digest = require('crypto').createHash('sha256').update(signedBytes(hrp, words)).digest();
  const signer = recover(digest, sigBytes.subarray(0, 64), sigBytes[64]);
  const payee = signer && (!nodeField || nodeField === signer) ? signer : null;
  return {
    network: m[1], msat, timestamp, expiry, expiresAt: timestamp + expiry, hash, features, minCltv, payee,
    blake2b: features.includes(512) || features.includes(513),
  };
}

module.exports = { decode };
