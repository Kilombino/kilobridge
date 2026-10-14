// Just enough BOLT 11 to check an invoice before and after the bridge sees it:
// amount, timestamp, expiry, payment hash and feature bits. The signature is
// not checked here; the bridge's nodes decode every invoice themselves.
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
  let expiry = 3600, hash = null, features = [], minCltv = 18;
  for (let i = 7; i + 3 <= words.length;) {
    const tag = words[i], len = words[i + 1] * 32 + words[i + 2];
    const field = words.slice(i + 3, i + 3 + len);
    i += 3 + len;
    if (tag === 1 && len === 52) hash = toBytes(field).subarray(0, 32).toString('hex');
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
  return {
    network: m[1], msat, timestamp, expiry, expiresAt: timestamp + expiry, hash, features, minCltv,
    blake2b: features.includes(512) || features.includes(513),
  };
}

module.exports = { decode };
