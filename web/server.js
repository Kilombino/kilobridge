// Kilobridge web: a page where anyone pastes (or scans) a Lightning invoice of
// the SHA-256 chain and pays it with BLAKE2b-chain coins through a Lightning
// Fork bridge.
//
// The server holds one participant code of the bridge (info, quote and the
// state of its own swaps; nothing else) and never touches funds: the payer pays
// a hold invoice with the same payment hash, which the bridge can only collect
// by paying the SHA-256 invoice. On top of the bridge's own limits it enforces
// the daily cap and a reserve of SHA-256 outbound from what the watcher publishes, a
// per-visitor rate limit, and a guard against re-quoting an invoice while an
// earlier hold invoice's expiry timer could still cancel the new one
// (paulscode/lightning-fork-bridge#2). It talks to lnd only after checking its
// certificate against the code, offers a hold invoice only if the bridge's
// node signed it, and hands the preimage only to whoever got the quote.
'use strict';
const http = require('http');
const https = require('https');
const tls = require('tls');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { decode } = require('./bolt11');

const PORT = Number(process.env.PORT || 3250);         // Cloudflare's tunnel
const TOR_PORT = Number(process.env.TOR_PORT || 3251); // the onion: headers are not trusted
// The participant code, as `lncli bridge code` prints it (lfbridge:…) or decoded to JSON.
const CODE = (() => {
  const raw = fs.readFileSync(process.env.BRIDGE_CODE_FILE, 'utf8').trim();
  const m = /lfbridge:([A-Za-z0-9_-]+)/.exec(raw);
  const c = JSON.parse(m ? Buffer.from(m[1], 'base64url').toString('utf8') : raw);
  // The web reaches the bridge's REST port directly (not over Tor), so the code must pin its certificate.
  if (c.v !== 1 || !c.url || !c.macaroon || !c.cert) {
    throw new Error('need a version 1 bridge code with url, macaroon and cert (make it with --url https://127.0.0.1:<rest port> --cert <sha256>)');
  }
  return c;
})();
const LIMITS = process.env.LIMITS_FILE || '/srv/bridge-limits/limits.json';
const STATE_DIR = process.env.STATE_DIRECTORY || path.join(__dirname, 'state');
const REQUOTES = path.join(STATE_DIR, 'requotes.json');
const LIVE = path.join(STATE_DIR, 'live.json');
const NODE = String(CODE.node || '').toLowerCase(); // the bridge's node: hold invoices must be signed by it
const PUBLIC = path.join(__dirname, 'public');

// What the page calls things: the operator and the two sides. The defaults are neutral.
const LABELS = {
  op: process.env.OPERATOR || 'the operator',
  chain: process.env.SHA_CHAIN || 'SHA-256',          // the chain the bridge pays on
  sha: process.env.SHA_UNIT || 'sats SHA-256',        // its units
  own: process.env.OWN_UNIT || 'sats',                // the units the bridge is paid in
  coin: process.env.OWN_COIN || 'BTC',                // the coin the bridge is paid in
  price: process.env.PRICE_UNIT || 'SHA-256 per coin',
};

const HOLD_EXPIRY_S = 600;     // what the bridge gives its hold invoices
const GUARD_S = 150;           // a quote lives 120 s; keep the old timer clear of it
const LIMITS_MAX_AGE = 120_000;

// --- the bridge, through the participant code -------------------------------

const url = new URL(CODE.url);
const pin = CODE.cert.replace(/:/g, '').toLowerCase();
// lnd's certificate is self-signed, so Node's own verification always fails and, with
// rejectUnauthorized off, a checkServerIdentity callback would never run. The pin is checked
// here instead, once the handshake is done and before http gets the socket: nothing of the
// request (the macaroon header) is written to a server that does not match.
class PinnedAgent extends https.Agent {
  createConnection(options, done) {
    const sock = tls.connect({ host: options.host, port: options.port, servername: undefined, rejectUnauthorized: false });
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      sock.removeListener('error', finish);
      if (err) { sock.destroy(); done(err); } else done(null, sock);
    };
    sock.once('secureConnect', () => {
      const cert = sock.getPeerCertificate(false);
      const fp = cert && cert.raw ? crypto.createHash('sha256').update(cert.raw).digest('hex') : '';
      finish(fp === pin ? null : new Error('unavailable: bridge certificate does not match the code'));
    });
    sock.once('error', finish);
  }
}
const agent = new PinnedAgent({ keepAlive: true });

function bridge(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      host: url.hostname, port: url.port, path: p, method, agent, timeout: 20_000,
      headers: { 'Grpc-Metadata-macaroon': CODE.macaroon, ...(data ? { 'content-type': 'application/json' } : {}) },
    }, res => {
      let buf = '';
      res.on('data', c => { buf += c; if (buf.length > 1 << 20) req.destroy(); });
      res.on('end', () => {
        let j;
        try { j = JSON.parse(buf); } catch { return reject(new Error('unavailable: unreadable answer')); }
        if (res.statusCode >= 400 || j.code) return reject(new Error(j.message || 'unavailable: error'));
        resolve(j);
      });
    });
    req.on('timeout', () => req.destroy(new Error('unavailable: the bridge did not answer')));
    req.on('error', e => reject(e.message.includes(':') && /^[a-z_]+:/.test(e.message) ? e : new Error('unavailable: ' + e.message)));
    if (data) req.write(data);
    req.end();
  });
}

const refusal = e => {
  const m = /^([a-z_]+): /.exec(e.message || '');
  return m ? m[1] : 'unavailable';
};

// --- limits that the bridge does not know about ----------------------------

// Anything missing, stale or of the wrong type closes the page: a check that cannot be made
// is not passed.
const isMsat = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
function limits() {
  let l;
  try { l = JSON.parse(fs.readFileSync(LIMITS, 'utf8')); } catch { return { ok: false, why: 'unavailable' }; }
  if (!l || typeof l !== 'object' || !isMsat(l.updated) || Date.now() - l.updated > LIMITS_MAX_AGE || l.healthy !== true) {
    return { ok: false, why: 'unavailable' };
  }
  if (![l.today_msat, l.daily_cap_msat, l.outbound_msat, l.reserve_msat].every(isMsat)) return { ok: false, why: 'unavailable' };
  const pending = l.pending && typeof l.pending === 'object' ? l.pending : {};
  if (!Object.values(pending).every(isMsat)) return { ok: false, why: 'unavailable' };
  return { ok: true, ...l, pending };
}

// Quotes of ours still able to be paid or in progress, so a burst of quotes
// cannot overrun the caps between two readings of the node. Kept on disk, so a
// restart does not forget them; the watcher adds every swap the bridge has
// funded and not finished (pending), however long it takes.
// A quote holds its place until it can no longer be paid; once paid, the watcher's pending
// takes over. Each quote also has a token, kept for an hour: whoever got the quote shows it
// to read the preimage (proof of payment) at the end.
const live = new Map();   // hash -> { out, until }
const tokens = new Map(); // hash -> { token, until }
const TOKEN_MS = 3_600_000;
try {
  const j = JSON.parse(fs.readFileSync(LIVE, 'utf8'));
  for (const [h, q] of Object.entries(j.live || {})) {
    if (/^[0-9a-f]{64}$/.test(h) && isMsat(q.out) && isMsat(q.until)) live.set(h, { out: q.out, until: q.until });
  }
  for (const [h, q] of Object.entries(j.tokens || {})) {
    if (/^[0-9a-f]{64}$/.test(h) && /^[0-9a-f]{32}$/.test(q.token) && isMsat(q.until)) tokens.set(h, { token: q.token, until: q.until });
  }
} catch {}
function saveLive() {
  const now = Date.now();
  for (const [h, q] of live) if (q.until < now) live.delete(h);
  for (const [h, q] of tokens) if (q.until < now) tokens.delete(h);
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(LIVE + '.tmp', JSON.stringify({ live: Object.fromEntries(live), tokens: Object.fromEntries(tokens) }), { mode: 0o600 });
    fs.renameSync(LIVE + '.tmp', LIVE);
  } catch (e) { console.error('saving live quotes:', e.message); }
}
function pendingMsat(l) {
  const now = Date.now();
  const sum = { ...l.pending };
  for (const [h, q] of live) {
    if (q.until < now) live.delete(h); else sum[h] = Math.max(sum[h] || 0, q.out);
  }
  return Object.values(sum).reduce((a, b) => a + b, 0);
}

function capCheck(outMsat) {
  const l = limits();
  if (!l.ok) return 'unavailable';
  const pending = pendingMsat(l);
  if (l.today_msat + pending + outMsat > l.daily_cap_msat) return 'daily_cap';
  if (l.outbound_msat - pending - outMsat < l.reserve_msat) return 'no_liquidity';
  return null;
}

// --- re-quote guard (lightning-fork-bridge#2) -------------------------------

let requotes = {};
try { requotes = JSON.parse(fs.readFileSync(REQUOTES, 'utf8')); } catch {}
function saveRequotes() {
  const now = Date.now() / 1000;
  for (const h of Object.keys(requotes)) {
    requotes[h] = requotes[h].filter(t => t + HOLD_EXPIRY_S + 60 > now);
    if (!requotes[h].length) delete requotes[h];
  }
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(REQUOTES + '.tmp', JSON.stringify(requotes), { mode: 0o600 });
    fs.renameSync(REQUOTES + '.tmp', REQUOTES);
  } catch (e) { console.error('saving re-quote guard:', e.message); }
}
// Seconds to wait before this hash may be quoted again, or 0.
function requoteWait(hash) {
  const now = Date.now() / 1000;
  let wait = 0;
  for (const t of requotes[hash] || []) {
    const fires = t + HOLD_EXPIRY_S;
    if (fires > now && fires < now + GUARD_S) wait = Math.max(wait, Math.ceil(fires - now) + 2);
  }
  return wait;
}

// --- visitors ---------------------------------------------------------------

// Behind Cloudflare the visitor is in CF-Connecting-IP. Over Tor everyone
// shares one bucket, and a header is not believed there: anyone could send one.
// An IPv6 visitor is their /64: one machine usually has the whole of it.
function visitor(req) {
  if (req.socket.localPort === TOR_PORT) return 'tor';
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf !== 'string' || cf.length >= 64) return 'no-ip';
  if (!cf.includes(':')) return cf;
  const [head, tail = ''] = cf.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const full = cf.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return full.slice(0, 4).map(x => x.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

const buckets = new Map();
const MAX_BUCKETS = 50_000;
function allow(key, max, windowMs) {
  const now = Date.now();
  if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) return false;
  const b = (buckets.get(key) || []).filter(t => t > now - windowMs);
  if (b.length >= max) { buckets.set(key, b); return false; }
  b.push(now);
  buckets.set(key, b);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (!b.some(t => t > now - 3_600_000)) buckets.delete(k);
}, 600_000).unref();

// --- the API ----------------------------------------------------------------

function checkInvoice(text) {
  let inv;
  try { inv = decode(text); } catch (e) { return { err: e.message === 'checksum' ? 'checksum' : 'invalid_invoice' }; }
  if (inv.network !== 'bc') return { err: 'wrong_network' };
  if (inv.blake2b) return { err: 'is_xbt' };
  if (inv.msat === null) return { err: 'no_amount' };
  if (inv.expiresAt < Date.now() / 1000 + 300) return { err: 'expires_soon' };
  return { inv };
}

async function info() {
  const i = await bridge('GET', '/v2/bridge/info');
  const d = (i.directions || []).find(x => x.name === 'toSHA256');
  if (!d) throw new Error('no_direction: closed');
  return d;
}

async function apiCheck(body, who) {
  if (!allow('check:' + who, who === 'tor' ? 90 : 30, 60_000)) return [429, { error: 'limit' }];
  const { inv, err } = checkInvoice(body.invoice);
  if (err) return [400, { error: err }];
  const d = await info();
  if (!d.open) return [400, { error: d.refusal_code || 'unavailable' }];
  const out = Number(inv.msat);
  if (out < Number(d.min_msat)) return [400, { error: 'too_small', min_sat: Number(d.min_msat) / 1000 }];
  if (out > Number(d.max_msat)) return [400, { error: 'too_large', max_sat: Number(d.max_msat) / 1000 }];
  const cap = capCheck(out);
  if (cap) return [400, { error: cap }];
  return [200, {
    sat: out / 1000,
    estimate_sat: Math.ceil(out / d.rate * (1 + d.spread) / 1000),
    rate: d.rate, spread: d.spread, wait_s: requoteWait(inv.hash),
  }];
}

async function apiQuote(body, who) {
  const { inv, err } = checkInvoice(body.invoice);
  if (err) return [400, { error: err }];
  const wait = requoteWait(inv.hash);
  if (wait) return [409, { error: 'wait', wait_s: wait }];
  // Over Tor everyone shares one bucket (Kilowallet asks over Tor), so it is wider there and
  // kept apart from the clearnet total: neither side can use up the other's.
  const ok = who === 'tor' ? allow('quote:tor', 30, 600_000) : allow('quote:' + who, 6, 600_000) && allow('quote:clearnet', 40, 600_000);
  if (!ok) return [429, { error: 'limit' }];
  const out = Number(inv.msat);
  // Reserve before asking the bridge, so quotes arriving together all count against the caps.
  const cap = capCheck(out);
  if (cap) return [400, { error: cap }];
  const before = live.get(inv.hash);
  live.set(inv.hash, { out, until: Date.now() + 5 * 60_000 });
  const drop = () => { if (before) live.set(inv.hash, before); else live.delete(inv.hash); saveLive(); };

  let q;
  try { q = await bridge('POST', '/v2/bridge/quote', { invoice: body.invoice.trim().replace(/^lightning:/i, '') }); } catch (e) {
    drop();
    return [400, { error: refusal(e) }];
  }
  (requotes[inv.hash] ||= []).push(Math.floor(Date.now() / 1000));
  saveRequotes();

  // Check the hold invoice the way the payer API asks a payer to, its signer included.
  let hold;
  try { hold = decode(q.hold_invoice); } catch { drop(); return [502, { error: 'bad_hold' }]; }
  const hashHex = Buffer.from(q.hash, 'base64').toString('hex');
  if (hold.hash !== inv.hash || hashHex !== inv.hash || !hold.blake2b || hold.network !== 'bc' ||
      hold.msat === null || hold.msat !== BigInt(q.incoming_msat) || Number(q.outgoing_msat) !== out ||
      (NODE && hold.payee !== NODE)) {
    console.error('hold invoice did not match the quote; not offering it');
    drop();
    return [502, { error: 'bad_hold' }];
  }
  // Until the quote can no longer be paid, plus a minute for the watcher to see it funded.
  live.set(inv.hash, { out, until: Math.max(Number(q.expires_at) * 1000, Date.now()) + 60_000 });
  const token = crypto.randomBytes(16).toString('hex');
  tokens.set(inv.hash, { token, until: Date.now() + TOKEN_MS });
  saveLive();
  return [200, {
    hold_invoice: q.hold_invoice, hash: inv.hash, sat: out / 1000,
    pay_sat: Math.ceil(Number(q.incoming_msat) / 1000), rate: q.rate, spread: q.spread,
    expires_at: Number(q.expires_at), node: hold.payee, cltv: hold.minCltv, token,
  }];
}

// The state of a swap is answered to anyone with the hash (Kilowallet follows its own payment
// this way); the preimage only to whoever got the quote, with its token.
async function apiSwap(hash, token, who) {
  if (!/^[0-9a-f]{64}$/.test(hash)) return [400, { error: 'invalid_request' }];
  if (!allow('swap:' + who, 120, 60_000)) return [429, { error: 'limit' }];
  let s;
  try { s = await bridge('POST', '/v2/bridge/swap', { hash: Buffer.from(hash, 'hex').toString('base64') }); } catch (e) {
    return [404, { error: refusal(e) }];
  }
  const t = tokens.get(hash);
  const owner = !!(t && t.until > Date.now() && typeof token === 'string' && token.length === t.token.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(t.token)));
  if (['settled', 'failed', 'aborted', 'expired', 'lost'].includes(s.state) && live.delete(hash)) saveLive();
  return [200, {
    state: s.state,
    preimage: owner && s.preimage ? Buffer.from(s.preimage, 'base64').toString('hex') : '',
  }];
}

// --- HTTP -------------------------------------------------------------------

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const HEADERS = {
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(self), microphone=(), geolocation=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
};
const HSTS = 'max-age=31536000'; // Cloudflare side only: the onion is plain http

function headers(res) {
  return res.req.socket.localPort === PORT ? { ...HEADERS, 'strict-transport-security': HSTS } : HEADERS;
}

function send(res, status, obj) {
  res.writeHead(status, { ...headers(res), 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > 4096) { req.removeAllListeners('data'); req.destroy(); reject(new Error('too big')); } });
    req.on('end', () => { try { resolve(JSON.parse(buf || '{}')); } catch { reject(new Error('bad json')); } });
  });
}

const server = http.createServer({ connectionsCheckingInterval: 2_000 }, async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const who = visitor(req);
  try {
    if (req.method === 'POST' && (u.pathname === '/api/check' || u.pathname === '/api/quote')) {
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'invalid_request' });
      const body = await readBody(req).catch(() => null);
      if (!body || typeof body.invoice !== 'string') return send(res, 400, { error: 'invalid_request' });
      const [st, obj] = await (u.pathname === '/api/check' ? apiCheck(body, who) : apiQuote(body, who));
      return send(res, st, obj);
    }
    if (req.method === 'GET' && u.pathname.startsWith('/api/swap/')) {
      const [st, obj] = await apiSwap(u.pathname.slice(10), u.searchParams.get('t'), who);
      return send(res, st, obj);
    }
    if (req.method === 'GET' && u.pathname === '/api/info') {
      const d = await info().catch(() => null);
      const l = limits();
      return send(res, 200, d ? {
        open: d.open && l.ok, rate: d.rate, spread: d.spread,
        min_sat: Number(d.min_msat) / 1000, max_sat: Number(d.max_msat) / 1000, labels: LABELS,
      } : { open: false, labels: LABELS });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method' });
    const name = u.pathname === '/' ? 'index.html' : u.pathname.slice(1);
    if (!/^[a-z0-9_-]+\.(html|js|css|svg|png|ico)$/.test(name)) return send(res, 404, { error: 'not_found' });
    const file = path.join(PUBLIC, name);
    fs.readFile(file, (e, data) => {
      if (e) return send(res, 404, { error: 'not_found' });
      res.writeHead(200, { ...headers(res), 'content-type': TYPES[path.extname(name)], 'cache-control': 'public, max-age=300' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  } catch (e) {
    console.error(req.method, u.pathname, e.message);
    send(res, 503, { error: refusal(e) });
  }
});
// Slow or idle connections are dropped quickly: over Tor nothing sits in front.
function harden(srv) {
  srv.headersTimeout = 10_000;
  srv.requestTimeout = 30_000;
  srv.keepAliveTimeout = 5_000;
  srv.maxHeadersCount = 50;
  srv.maxConnections = 300;
  return srv;
}
harden(server).listen(PORT, '127.0.0.1', () => console.log(`bridge-web on 127.0.0.1:${PORT}`));
harden(http.createServer({ connectionsCheckingInterval: 2_000 }, server.listeners('request')[0]))
  .listen(TOR_PORT, '127.0.0.1', () => console.log(`bridge-web (onion) on 127.0.0.1:${TOR_PORT}`));
