// Paying a Lightning address (LUD-16) or an LNURL-pay (LUD-01/06, LUD-17 lnurlp://) instead
// of an invoice: what the destination field accepts, the payRequest it points to, and the
// checks on the invoice its callback returns. Only the parsing and the checks live here; the
// fetching is done by fetcher.js, a separate process that may reach the internet (this server
// may not).
'use strict';
const crypto = require('crypto');
const { decode, bech32 } = require('./bolt11');

const MAX_DEST = 2000;

// The text people paste, as a URL to fetch: { kind, url, address? } or { err }.
// On-chain addresses and BIP21 URIs without a lightning= part are refused on purpose.
function parseDest(text) {
  if (typeof text !== 'string') return { err: 'invalid_request' };
  let s = text.trim().replace(/\s+/g, '');
  if (!s || s.length > MAX_DEST) return { err: 'lnurl_bad' };
  // bitcoin:<address>?lightning=<invoice or LNURL>: only the Lightning part counts.
  if (/^bitcoin:/i.test(s)) {
    const m = /[?&]lightning=([^&]+)/i.exec(s);
    if (!m) return { err: 'onchain' };
    try { s = decodeURIComponent(m[1]); } catch { return { err: 'lnurl_bad' }; }
  }
  s = s.replace(/^lightning:/i, '');
  // A web link carrying the LNURL in its lightning= parameter (LUD-01's fallback scheme).
  if (/^https?:\/\//i.test(s)) {
    const m = /[?&]lightning=(lnurl1[0-9a-z]+)/i.exec(s);
    if (!m) return { err: 'lnurl_bad' };
    s = m[1];
  }
  if (/^lnurl1/i.test(s)) {
    const url = decodeLnurl(s);
    return url ? checkUrl(url, 'lnurl') : { err: 'lnurl_bad' };
  }
  const p = /^lnurlp:\/\/(.+)$/i.exec(s);
  if (p) {
    let u;
    try { u = new URL('https://' + p[1]); } catch { return { err: 'lnurl_bad' }; }
    if (u.hostname.endsWith('.onion')) u.protocol = 'http:';
    return checkUrl(u.href, 'lnurl');
  }
  const a = /^([a-z0-9\-_.+]{1,64})@([a-z0-9.-]{1,253})$/i.exec(s);
  if (a) {
    const name = a[1].toLowerCase(), host = a[2].toLowerCase();
    if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/.test(host)) return { err: 'lnurl_bad' };
    const scheme = host.endsWith('.onion') ? 'http' : 'https';
    return { kind: 'address', address: `${name}@${host}`, url: `${scheme}://${host}/.well-known/lnurlp/${encodeURIComponent(name)}` };
  }
  // An on-chain address of either chain: not accepted.
  if (/^(bc1|tb1|bcrt1)[0-9a-z]{8,87}$/i.test(s) || /^[13mn2][1-9A-HJ-NP-Za-km-z]{25,39}$/.test(s)) return { err: 'onchain' };
  return { err: 'lnurl_bad' };
}

// The URL inside an lnurl1… string, or null.
function decodeLnurl(str) {
  const s = str.toLowerCase();
  if (str !== s && str !== str.toUpperCase()) return null;
  const sep = s.lastIndexOf('1');
  const hrp = s.slice(0, sep);
  if (hrp !== 'lnurl' || s.length - sep < 8) return null;
  const data = [];
  for (const c of s.slice(sep + 1)) {
    const v = bech32.CHARSET.indexOf(c);
    if (v < 0) return null;
    data.push(v);
  }
  if (bech32.polymod([...bech32.hrpExpand(hrp), ...data]) !== 1) return null;
  const url = bech32.toBytes(data.slice(0, -6)).toString('utf8');
  return /^[\x21-\x7e]+$/.test(url) ? url : null;
}

// Only https, or http/https to an onion; no user:password@, nothing but a host name or address.
function checkUrl(href, kind) {
  let u;
  try { u = new URL(href); } catch { return { err: 'lnurl_bad' }; }
  if (u.username || u.password) return { err: 'lnurl_bad' };
  const onion = /^[a-z2-7]{56}\.onion$/.test(u.hostname);
  if (!(u.protocol === 'https:' || (onion && u.protocol === 'http:'))) return { err: 'lnurl_insecure' };
  return { kind, url: u.href };
}

const isInt = (v) => Number.isSafeInteger(v) && v > 0;

// A payRequest answer, checked: { callback, min, max (msat), commentAllowed, metadata,
// description, identifier } or { err, reason? }.
function payParams(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return { err: 'lnurl_unreadable' };
  if (j.status === 'ERROR') return { err: 'lnurl_error', reason: cleanReason(j.reason) };
  if (j.tag !== 'payRequest') return { err: 'lnurl_not_pay' };
  const min = Number(j.minSendable), max = Number(j.maxSendable);
  if (!isInt(min) || !isInt(max) || min > max) return { err: 'lnurl_unreadable' };
  if (typeof j.callback !== 'string' || j.callback.length > 2000) return { err: 'lnurl_unreadable' };
  const cb = checkUrl(j.callback, 'callback');
  if (cb.err) return cb;
  if (typeof j.metadata !== 'string' || j.metadata.length > 100_000) return { err: 'lnurl_unreadable' };
  let meta;
  try { meta = JSON.parse(j.metadata); } catch { return { err: 'lnurl_unreadable' }; }
  if (!Array.isArray(meta)) return { err: 'lnurl_unreadable' };
  const get = (type) => {
    const e = meta.find((x) => Array.isArray(x) && x[0] === type && typeof x[1] === 'string');
    return e ? e[1] : '';
  };
  const ca = Number(j.commentAllowed);
  return {
    callback: cb.url, min, max, metadata: j.metadata,
    commentAllowed: Number.isSafeInteger(ca) && ca > 0 ? Math.min(ca, 2000) : 0,
    description: get('text/plain').slice(0, 300),
    identifier: (get('text/identifier') || get('text/email')).slice(0, 200),
  };
}

// What a remote server says, made safe to show: one line, printable, short.
function cleanReason(r) {
  return typeof r === 'string' ? r.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').trim().slice(0, 200) : '';
}

// The callback URL for an amount (msat) and an optional comment.
function callbackUrl(callback, msat, comment) {
  const u = new URL(callback);
  u.searchParams.set('amount', String(msat));
  if (comment) u.searchParams.set('comment', comment);
  return u.href;
}

// The invoice a callback returned, checked against what was asked: { inv } or { err }.
// The amount must be exactly the one asked for and, when the invoice commits to a description
// hash, it must be the hash of the metadata (LUD-06/LUD-16).
function checkPr(j, msat, metadata) {
  if (!j || typeof j !== 'object') return { err: 'lnurl_unreadable' };
  if (j.status === 'ERROR') return { err: 'lnurl_error', reason: cleanReason(j.reason) };
  if (typeof j.pr !== 'string') return { err: 'lnurl_unreadable' };
  let inv;
  try { inv = decode(j.pr); } catch { return { err: 'lnurl_bad_invoice' }; }
  if (inv.msat === null || inv.msat !== BigInt(msat)) return { err: 'lnurl_bad_invoice' };
  if (inv.descriptionHash && inv.descriptionHash !== crypto.createHash('sha256').update(metadata, 'utf8').digest('hex')) {
    return { err: 'lnurl_bad_invoice' };
  }
  if (!inv.payee) return { err: 'lnurl_bad_invoice' };
  return { inv, pr: j.pr.trim().replace(/^lightning:/i, '') };
}

module.exports = { parseDest, decodeLnurl, payParams, callbackUrl, checkPr, cleanReason };
