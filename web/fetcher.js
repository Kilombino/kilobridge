// The only part of the bridge web that reaches the internet: fetches LNURL-pay pages (a
// Lightning address's .well-known/lnurlp and its callback) for server.js, which itself only
// talks to localhost and holds the participant code. It runs as its own service with no
// secrets, listens on localhost only and answers POST /get {"url": "..."} with
// {"status", "body"} (or {"error"}).
//
// Guards against being used to reach what it should not (SSRF): https only (an onion may be
// http, and goes through Tor's SOCKS port); the host name is resolved here and every address
// it has must be public, and the connection goes to the address that was checked (no second
// lookup to rebind); this machine's own addresses are refused too; redirects are followed at
// most twice, each one checked again; GET only, no cookies or credentials; a short timeout,
// a small answer and few requests at once. Its systemd unit also denies private ranges.
'use strict';
const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const dns = require('dns');
const os = require('os');

const PORT = Number(process.env.FETCHER_PORT || 3252);
const TOR = (process.env.TOR_SOCKS || '127.0.0.1:9050').split(':');
const TIMEOUT_MS = 10_000, ONION_TIMEOUT_MS = 30_000;
const MAX_BODY = 64 * 1024;
const MAX_INFLIGHT = 20;
const UA = 'Kilobridge-LNURL/1';

// Addresses that are not on the public internet.
const blocked = new net.BlockList();
for (const [a, p] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) blocked.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::', 128], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64],
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]]) blocked.addSubnet(a, p, 'ipv6');
// This machine's own addresses (a public IPv6 here reaches services the firewall hides from
// outside), read again every minute.
// If they cannot be read (the unit needs AF_NETLINK), nothing is fetched.
let own = null;
function readOwn() {
  try {
    const s = new Set();
    for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) s.add(i.address.toLowerCase());
    own = s;
  } catch (e) { own = null; console.error('cannot read this machine\'s addresses:', e.message); }
}
readOwn();
setInterval(readOwn, 60_000).unref();

function isPublic(ip) {
  const fam = net.isIP(ip);
  if (!fam) return false;
  if (!own || own.has(ip.toLowerCase())) return false;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d or ::ffff:xxxx:xxxx): refused whatever is inside. (Not in
  // the BlockList: Node matches its ::ffff:0:0/96 against every IPv4 address.)
  if (fam === 6 && /^(0{0,4}:){0,5}:?ffff:/i.test(ip.replace(/^::/, '0::'))) return false;
  return !blocked.check(ip, fam === 4 ? 'ipv4' : 'ipv6');
}

// Every address of a name, all of them public, or an error.
async function resolvePublic(name) {
  const host = name.replace(/^\[(.*)\]$/, '$1');
  if (net.isIP(host)) {
    if (!isPublic(host)) throw new Error('blocked');
    return host;
  }
  let addrs;
  try { addrs = await dns.promises.lookup(host, { all: true, verbatim: true }); } catch { throw new Error('dns'); }
  if (!addrs.length) throw new Error('dns');
  for (const a of addrs) if (!isPublic(a.address)) throw new Error('blocked');
  return (addrs.find((a) => a.family === 4) || addrs[0]).address;
}

// A socket to host:port through Tor (SOCKS5, the name resolved by Tor).
function socks(host, port, timeout) {
  return new Promise((resolve, reject) => {
    const s = net.connect({ host: TOR[0], port: Number(TOR[1]) });
    s.setTimeout(timeout, () => s.destroy(new Error('timeout')));
    let stage = 0, buf = Buffer.alloc(0);
    s.once('error', reject);
    s.on('connect', () => s.write(Buffer.from([5, 1, 0])));
    s.on('data', function onData(d) {
      buf = Buffer.concat([buf, d]);
      if (stage === 0 && buf.length >= 2) {
        if (buf[0] !== 5 || buf[1] !== 0) return s.destroy(new Error('socks'));
        buf = buf.subarray(2); stage = 1;
        const h = Buffer.from(host);
        s.write(Buffer.concat([Buffer.from([5, 1, 0, 3, h.length]), h, Buffer.from([port >> 8, port & 255])]));
      }
      if (stage === 1 && buf.length >= 10) {
        if (buf[1] !== 0) return s.destroy(new Error('unreachable'));
        s.removeListener('data', onData);
        s.removeListener('error', reject);
        s.setTimeout(0);
        resolve(s);
      }
    });
  });
}

function getOnce(href, deadline) {
  return new Promise((resolve, reject) => {
    const u = new URL(href);
    const onion = /^[a-z2-7]{56}\.onion$/.test(u.hostname);
    if (u.username || u.password) return reject(new Error('bad_url'));
    if (!(u.protocol === 'https:' || (onion && u.protocol === 'http:'))) return reject(new Error('insecure'));
    const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
    const left = deadline - Date.now();
    if (left <= 0) return reject(new Error('timeout'));
    const opts = {
      method: 'GET', path: u.pathname + u.search, timeout: left,
      headers: { host: u.host, accept: 'application/json', 'user-agent': UA },
    };
    const go = (lib, extra) => {
      const req = lib.request({ ...opts, ...extra }, (res) => {
        let size = 0;
        const parts = [];
        res.on('data', (c) => {
          size += c.length;
          if (size > MAX_BODY) { req.destroy(new Error('too_big')); return; }
          parts.push(c);
        });
        res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, body: Buffer.concat(parts).toString('utf8') }));
        res.on('error', reject);
      });
      const timer = setTimeout(() => req.destroy(new Error('timeout')), left);
      req.on('close', () => clearTimeout(timer));
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', reject);
      req.end();
    };
    if (onion) {
      socks(u.hostname, port, left).then((sock) => {
        if (u.protocol === 'http:') return go(http, { createConnection: () => sock });
        // An onion address authenticates the server by itself; its certificate is usually self-signed.
        const t = tls.connect({ socket: sock, servername: u.hostname, rejectUnauthorized: false });
        t.once('secureConnect', () => go(https, { createConnection: () => t }));
        t.once('error', reject);
      }, reject);
      return;
    }
    resolvePublic(u.hostname).then((ip) => {
      // Connect to the address checked above; the certificate is still checked against the name.
      go(https, {
        host: u.hostname, port, agent: false, servername: /^\[|^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) ? undefined : u.hostname,
        lookup: (_h, o, cb) => (o && o.all ? cb(null, [{ address: ip, family: net.isIP(ip) }]) : cb(null, ip, net.isIP(ip))),
      });
    }, reject);
  });
}

async function get(href) {
  let u = href;
  const deadline = Date.now() + (/\.onion(:\d+)?\//.test(href) ? ONION_TIMEOUT_MS : TIMEOUT_MS);
  for (let hop = 0; hop < 3; hop++) {
    const r = await getOnce(u, deadline);
    if ([301, 302, 303, 307, 308].includes(r.status) && r.location) {
      u = new URL(r.location, u).href;
      continue;
    }
    return { status: r.status, body: r.body };
  }
  throw new Error('redirects');
}

let inflight = 0;
const server = http.createServer((req, res) => {
  const reply = (st, o) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method !== 'POST' || req.url !== '/get') return reply(404, { error: 'not_found' });
  let buf = '';
  req.on('data', (c) => { buf += c; if (buf.length > 4096) req.destroy(); });
  req.on('end', async () => {
    let url;
    try { url = JSON.parse(buf).url; } catch { return reply(400, { error: 'bad_request' }); }
    if (typeof url !== 'string' || url.length > 2100) return reply(400, { error: 'bad_request' });
    if (inflight >= MAX_INFLIGHT) return reply(503, { error: 'busy' });
    inflight++;
    try {
      reply(200, await get(url));
    } catch (e) {
      const known = ['blocked', 'dns', 'insecure', 'bad_url', 'timeout', 'too_big', 'redirects', 'unreachable', 'socks'];
      reply(200, { error: known.includes(e.message) ? e.message : 'unreachable' });
    } finally { inflight--; }
  });
});
server.headersTimeout = 5_000;
server.requestTimeout = 40_000;
server.listen(PORT, '127.0.0.1', () => console.log(`bridge-lnurl fetcher on 127.0.0.1:${PORT}`));
