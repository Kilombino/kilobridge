// bridge-watch: tells the bridge's operator on Telegram about every swap the
// bridge finishes, and raises alerts when the bridge needs them: a swap waiting
// on the operator, a lost swap, the SHA-256 side short of outbound (below the
// reserve kept for other uses of that node), the bridge down, or the day's
// volume past its cap. It also publishes what the web front end needs to
// enforce the cap and the reserve (LIMITS_FILE), so the web needs no access to
// the node.
//
// Configuration (environment):
//   TELEGRAM_TOKEN   bot token                       (required)
//   TELEGRAM_CHAT    chat id to tell                 (required)
//   LND_CONTAINER    the bridge's lnd container      (default: lnd)
//   LND_NETWORK      lncli --network                 (default: mainnet)
//   JOURNAL          swap journal inside the container
//                    (default: /root/.lnd/data/chain/bitcoin/mainnet/bridge/swaps.journal)
//   STATE_FILE       where this keeps what it told   (default: ~/.config/bridge-watch/state.json)
//   LIMITS_FILE      published for the web           (default: /srv/bridge-limits/limits.json)
//   RESERVE_SAT      SHA-256 outbound kept for other uses of that node (default: 0)
//   DAILY_CAP_SAT    SHA-256 sats the bridge may pay out a day (default: 1000000)
//   TIMEZONE         the day boundary                (default: UTC)
//   WATCH_SPLICES    tell about channel resizes (splices) of this node too (default: 1; 0 = off)
'use strict';
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const env = process.env;
const CHAT = env.TELEGRAM_CHAT;
const TOKEN = env.TELEGRAM_TOKEN;
const CONTAINER = env.LND_CONTAINER || 'lnd';
const NETWORK = env.LND_NETWORK || 'mainnet';
const JOURNAL = env.JOURNAL || '/root/.lnd/data/chain/bitcoin/mainnet/bridge/swaps.journal';
const STATE = env.STATE_FILE || path.join(env.HOME, '.config/bridge-watch/state.json');
const RESERVE_MSAT = Number(env.RESERVE_SAT || 0) * 1000;
const DAILY_CAP_MSAT = Number(env.DAILY_CAP_SAT || 1_000_000) * 1000;
const TZ = env.TIMEZONE || 'UTC';
// Words: the language of the messages and what the two sides are called.
const LANG = env.LANG_MESSAGES === 'es' ? 'es' : 'en';
const CHAIN = env.SHA_CHAIN || 'SHA-256';          // the chain the bridge pays on
const SHA = env.SHA_UNIT || 'sats SHA-256';        // its units
const OWN = env.OWN_UNIT || 'sats';                // the units the bridge is paid in
const PRICE = env.PRICE_UNIT || 'SHA-256 per coin';
// USDT value of each swap, from NonKYC's last prices: the market tickers of the two coins.
const USDT_OWN = env.USDT_TICKER_OWN || '';         // e.g. BTCB2_USDT; empty = no USDT line
const USDT_SHA = env.USDT_TICKER_SHA || 'BTC_USDT';
const OWN_COIN = env.OWN_COIN || 'coin';            // names for those prices
const SHA_COIN = env.SHA_COIN || 'SHA-256 coin';

const M = {
  en: {
    settled: (o, i, f, sp, r) => ['✅ Swap done on your bridge', `You paid ${o} ${SHA} and received ${i} ${OWN}.`,
      `Your fee: ~${f} ${OWN} (${sp} %).`, `Price: ${r} ${PRICE}.`],
    usdt: (got, own, sha) => `You got ${OWN_COIN} at ${got} (market ${own}); ${SHA_COIN} was at ${sha}.`,
    failed: (o, i) => ['↩️ Swap failed, refunded', `The ${CHAIN} invoice of ${o} ${SHA} could not be paid; the payer's ${i} ${OWN} went back. You lose nothing.`],
    aborted: (o, i) => ['↩️ Swap called off before paying', `The price moved against you (${o} ${SHA}); the payer's ${i} ${OWN} went back. You lose nothing.`],
    lost: (o, i) => ['🚨 Swap LOST', `${o} ${SHA} were paid but the ${i} ${OWN} could not be collected.`, 'Look at `lncli bridge status` now.'],
    cap: (pct, t, c) => `${pct === 1 ? '⛔ Daily cap reached' : '⚠️ 80 % of the daily cap'}: ${t} of ${c} ${SHA} paid out today.`,
    down: (why) => `🔴 The bridge cannot serve: ${why}.`, up: '🟢 The bridge is serving again.',
    closed: (code, why) => `⏸️ The bridge is not quoting (${code}): ${why}.${code === 'chain_unmeasured' ? ' It reopens by itself once enough blocks of the new difficulty epoch have been seen.' : ''}`,
    open: '▶️ The bridge is quoting again.',
    ops: (n) => `🛠️ ${n} swap(s) need you: lncli bridge status`,
    low: (o, r) => `🟠 The ${CHAIN} node's outbound is down to ${o} ${SHA}, under the ${r} reserve. The web stops quoting until it is back.`,
    ok: (o) => `🟢 The ${CHAIN} node's outbound is above the reserve again (${o} ${SHA}).`,
    test: '🧪 Bridge watcher test: from now on you hear about every swap here.', off: 'disabled',
    you: 'you', peer: 'the peer',
    spStart: (a, who, l, r, cap, fee, our) => ['🔀 Channel resize started', `Channel with ${a}, started by ${who}.`,
      `Your balance ${l}, the peer's ${r} ${OWN}. New capacity: ${cap} ${OWN}.`, `Fee: ${fee} ${OWN} (${our} yours).`],
    spOnChain: (a, n) => `⛓️ The resize of the channel with ${a} is on chain; it counts after ${n} confirmations.`,
    spLocked: (a, l, r) => ['✅ Channel resized', `Channel with ${a}: your balance ${l}, the peer's ${r} ${OWN}.`],
    spEnded: (a, how, why) => ['⚠️ Channel resize did not go through', `Channel with ${a}: ${how}${why ? ` (${why})` : ''}. The channel keeps working at its old size.`],
    spHow: { aborted: 'called off', dead: 'one of its coins was spent elsewhere' }, spPeerSaid: 'the peer says',
    spRejected: (a, why) => `🟠 The resize transaction of the channel with ${a} was rejected by the node: ${why}. Look at it: lncli listchannels`,
    spUnknown: (a) => `🚨 The funding output of the channel with ${a} was spent by a transaction this node doesn't recognise. Its link is down; look at it now.`,
  },
  es: {
    settled: (o, i, f, sp, r) => ['✅ Cambio hecho en tu bridge', `Pagaste ${o} ${SHA} y te han llegado ${i} ${OWN}.`,
      `Tu comisión: ~${f} ${OWN} (${sp} %).`, `Precio: ${r} ${PRICE}.`],
    usdt: (got, own, sha) => `Conseguiste ${OWN_COIN} a ${got} (mercado ${own}); ${SHA_COIN} estaba a ${sha}.`,
    failed: (o, i) => ['↩️ Cambio fallido, devuelto', `No se pudo pagar la factura ${CHAIN} de ${o} ${SHA}; los ${i} ${OWN} han vuelto a quien pagó. No pierdes nada.`],
    aborted: (o, i) => ['↩️ Cambio anulado antes de pagar', `El precio se movió en tu contra (${o} ${SHA}); los ${i} ${OWN} han vuelto a quien pagó. No pierdes nada.`],
    lost: (o, i) => ['🚨 Swap PERDIDO', `Se pagaron ${o} ${SHA} pero no se pudo cobrar la otra parte (${i} ${OWN}).`, 'Mira `lncli bridge status` cuanto antes.'],
    cap: (pct, t, c) => `${pct === 1 ? '⛔ Tope diario alcanzado' : '⚠️ 80 % del tope diario'}: hoy van ${t} de ${c} ${SHA} pagados por el bridge.`,
    down: (why) => `🔴 El bridge no puede dar servicio: ${why}.`, up: '🟢 El bridge vuelve a dar servicio.',
    closed: (code, why) => `⏸️ El bridge no está cotizando (${code}): ${why}.${code === 'chain_unmeasured' ? ' Vuelve solo cuando haya visto bastantes bloques de la época de dificultad nueva.' : ''}`,
    open: '▶️ El bridge vuelve a cotizar.',
    ops: (n) => `🛠️ ${n} swap(s) necesitan que mires: lncli bridge status`,
    low: (o, r) => `🟠 La salida del nodo ${CHAIN} ha bajado a ${o} ${SHA}, por debajo de la reserva de ${r}. La web deja de cotizar hasta que se reponga.`,
    ok: (o) => `🟢 La salida del nodo ${CHAIN} vuelve a estar por encima de la reserva (${o} ${SHA}).`,
    test: '🧪 Prueba del vigilante del bridge: a partir de ahora te aviso aquí de cada cambio.', off: 'desactivado',
    you: 'ti', peer: 'el otro nodo',
    spStart: (a, who, l, r, cap, fee, our) => ['🔀 Redimensionado de canal empezado', `Canal con ${a}, empezado por ${who}.`,
      `Tu saldo ${l}, el del otro ${r} ${OWN}. Capacidad nueva: ${cap} ${OWN}.`, `Comisión: ${fee} ${OWN} (${our} tuyos).`],
    spOnChain: (a, n) => `⛓️ El redimensionado del canal con ${a} ya está en cadena; cuenta a las ${n} confirmaciones.`,
    spLocked: (a, l, r) => ['✅ Canal redimensionado', `Canal con ${a}: tu saldo ${l}, el del otro ${r} ${OWN}.`],
    spEnded: (a, how, why) => ['⚠️ El redimensionado del canal no ha salido', `Canal con ${a}: ${how}${why ? ` (${why})` : ''}. El canal sigue funcionando con su tamaño de antes.`],
    spHow: { aborted: 'se ha cancelado', dead: 'una de sus monedas se gastó en otra transacción' }, spPeerSaid: 'el otro nodo dice',
    spRejected: (a, why) => `🟠 El nodo ha rechazado la transacción del redimensionado del canal con ${a}: ${why}. Míralo: lncli listchannels`,
    spUnknown: (a) => `🚨 La salida de financiación del canal con ${a} se ha gastado con una transacción que el nodo no reconoce. Su enlace está caído: míralo ya.`,
  },
}[LANG];
const EVERY_MS = 20_000;
const SPLICES = env.WATCH_SPLICES !== '0';
const SPLICE_EVERY = 3; // ticks: once a minute
// What the web page needs to enforce the caps, without access to the node.
const LIMITS = env.LIMITS_FILE || '/srv/bridge-limits/limits.json';

if (!TOKEN || !CHAT) { console.error('TELEGRAM_TOKEN and TELEGRAM_CHAT are required'); process.exit(1); }

function sh(args) {
  return new Promise((ok, ko) => execFile('docker', args, { maxBuffer: 64 << 20, timeout: 30_000 },
    (e, out, err) => e ? ko(new Error((err || e.message).trim())) : ok(out)));
}
const lncli = (...a) => sh(['exec', CONTAINER, 'lncli', '--network', NETWORK, ...a]).then(JSON.parse);

async function tell(text) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error(`telegram ${r.status} ${await r.text()}`);
}

const sats = msat => Math.round(Number(msat) / 1000).toLocaleString(LANG === 'es' ? 'es-ES' : 'en-US', { useGrouping: 'always' });
const dayOf = d => new Date(d).toLocaleDateString('sv-SE', { timeZone: TZ });

function load() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return null; }
}
function save(s) {
  fs.writeFileSync(STATE + '.tmp', JSON.stringify(s), { mode: 0o600 });
  fs.renameSync(STATE + '.tmp', STATE);
}

// Every line is "<checksum> {record}"; the newest record of a swap wins. The
// same invoice quoted twice shares a hash, so a swap is its hash plus when it
// was created.
async function swaps() {
  const text = await sh(['exec', CONTAINER, 'cat', JOURNAL]);
  const last = new Map();
  for (const line of text.split('\n')) {
    const i = line.indexOf('{');
    if (i < 0) continue;
    let r;
    try { r = JSON.parse(line.slice(i)); } catch { continue; }
    if (!r.hash || !r.state) continue;
    const key = `${r.hash}@${r.created || ''}`;
    last.set(key, { ...(last.get(key) || {}), ...r });
  }
  return last;
}

async function lastUsdt(ticker) {
  const r = await fetch(`https://api.nonkyc.io/api/v2/ticker/${ticker}`, { signal: AbortSignal.timeout(10_000) });
  const p = Number((await r.json()).last_price);
  if (!(p > 0)) throw new Error(`no price for ${ticker}`);
  return p;
}

const usdt = v => v.toLocaleString(LANG === 'es' ? 'es-ES' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT';

// The USDT prices of both coins when the swap is told, and what one coin cost the payer here:
// the SHA-256 side paid out, valued at its price, over the coins received.
async function usdtLine(r) {
  if (!USDT_OWN || r.state !== 'settled') return null;
  try {
    const [own, sha] = await Promise.all([lastUsdt(USDT_OWN), lastUsdt(USDT_SHA)]);
    const got = Number(r.outgoing_msat) * sha / Number(r.incoming_msat);
    return M.usdt(usdt(got), usdt(own), usdt(sha));
  } catch { return null; }
}

function swapText(r) {
  const out = Number(r.outgoing_msat), inc = Number(r.incoming_msat), rate = Number(r.rate);
  const fee = rate > 0 ? inc - out / rate : 0;
  const lines = [];
  switch (r.state) {
    case 'settled':
      lines.push(...M.settled(sats(out), sats(inc), sats(fee), (Number(r.spread) * 100).toFixed(2), rate.toFixed(8)));
      break;
    case 'failed': lines.push(...M.failed(sats(out), sats(inc))); break;
    case 'aborted': lines.push(...M.aborted(sats(out), sats(inc))); break;
    case 'lost': lines.push(...M.lost(sats(out), sats(inc))); break;
    default:
      return null;
  }
  lines.push(`Hash: ${r.hash.slice(0, 16)}…`);
  return lines.join('\n');
}

async function tick(st) {
  // Swaps.
  const all = await swaps();
  const first = !st.seen;
  st.seen ||= {};
  const today = dayOf(Date.now());
  let todayMsat = 0;
  for (const [key, r] of all) {
    if (r.state === 'settled' && dayOf(r.updated || r.created) === today) todayMsat += Number(r.outgoing_msat);
    const done = ['settled', 'failed', 'aborted', 'lost', 'expired'].includes(r.state);
    if (!done || st.seen[key]) continue;
    // A swap that was never funded only expired: nothing to say.
    let text = first ? null : swapText(r);
    if (text) {
      const u = await usdtLine(r);
      if (u) text = text.replace(/\nHash:/, `\n${u}\nHash:`);
      await tell(text);
    }
    st.seen[key] = r.state;
  }

  // The day's volume.
  st.dayAlert ||= {};
  for (const pct of [1, 0.8]) {
    const k = `${today}:${pct}`;
    if (todayMsat >= DAILY_CAP_MSAT * pct && !st.dayAlert[k]) {
      await tell(M.cap(pct, sats(todayMsat), sats(DAILY_CAP_MSAT)));
      st.dayAlert[k] = true;
      break;
    }
  }

  // The bridge itself.
  let s;
  try { s = await lncli('bridge', 'status'); } catch (e) { s = { enabled: false, error: e.message }; }
  const node = s.sha256_node || {};
  const healthy = s.enabled && node.state === 'ready' && node.synced_to_chain;
  st.bad = healthy ? 0 : (st.bad || 0) + 1;
  if (st.bad === 3 && !st.downTold) {
    await tell(M.down(s.error || node.detail || node.state || M.off));
    st.downTold = true;
  } else if (healthy && st.downTold) {
    await tell(M.up);
    st.downTold = false;
  }

  // Whether it quotes: the node can be ready while the bridge refuses every quote (17 Oct 2026:
  // ~17 h closed with chain_unmeasured after a difficulty epoch began). Only while healthy, so a
  // node that is down is told once, as down.
  if (healthy) {
    let dir = null;
    try { dir = ((await lncli('bridge', 'info')).directions || []).find(d => d.name === 'toSHA256'); } catch {}
    if (dir) {
      st.closed = dir.open ? 0 : (st.closed || 0) + 1;
      if (st.closed === 3 && !st.closedTold) {
        await tell(M.closed(dir.refusal_code || '?', dir.refusal || '?'));
        st.closedTold = true;
      } else if (dir.open && st.closedTold) {
        await tell(M.open);
        st.closedTold = false;
      }
    }
  }

  const ops = (s.needs_operator || []).map(x => typeof x === 'string' ? x : (x.hash || JSON.stringify(x)));
  const opsKey = ops.join(',');
  if (opsKey && opsKey !== st.opsKey) {
    await tell(`${M.ops(ops.length)}\n${ops.map(h => String(h).slice(0, 16) + '…').join('\n')}`);
  }
  st.opsKey = opsKey;

  const limits = {
    updated: Date.now(), day: today, today_msat: todayMsat, daily_cap_msat: DAILY_CAP_MSAT,
    healthy: !!healthy, outbound_msat: node.outbound_msat === undefined ? null : Number(node.outbound_msat),
    reserve_msat: RESERVE_MSAT,
  };
  fs.writeFileSync(LIMITS + '.tmp', JSON.stringify(limits), { mode: 0o644 });
  fs.renameSync(LIMITS + '.tmp', LIMITS);

  // Only when the balances were really read: when the SHA-256 node stalls, the bridge still says
  // "ready" but reports them as zero, with "cannot be read" in its detail (16 Oct 2026: a
  // two-minute timeout of that node raised a false "outbound 0"). The web still stops quoting
  // meanwhile: the limits file keeps the zero.
  const balancesRead = !/cannot be read/i.test(node.detail || '');
  if (healthy && balancesRead && node.outbound_msat !== undefined) {
    const outMsat = Number(node.outbound_msat);
    if (outMsat < RESERVE_MSAT && !st.lowTold) {
      await tell(M.low(sats(outMsat), sats(RESERVE_MSAT)));
      st.lowTold = true;
    } else if (outMsat >= RESERVE_MSAT * 1.05 && st.lowTold) {
      await tell(M.ok(sats(outMsat)));
      st.lowTold = false;
    }
  }
}

// Channel resizes (splices) of this node: started, on chain, locked, or not.
// A channel is known by the outpoint it was opened with, which a resize keeps.
const signed = n => (n > 0 ? '+' : '') + Number(n).toLocaleString(LANG === 'es' ? 'es-ES' : 'en-US', { useGrouping: 'always' });
const plain = n => Number(n).toLocaleString(LANG === 'es' ? 'es-ES' : 'en-US', { useGrouping: 'always' });
async function splices(st) {
  const { channels } = await lncli('listchannels');
  const first = !st.splices;
  st.splices ||= {};
  for (const c of channels) {
    const key = c.original_channel_point || c.channel_point;
    const k = st.splices[key] ||= {};
    const who = (c.peer_alias || c.remote_pubkey.slice(0, 16)).slice(0, 40);
    const p = c.pending_splice;
    if (p && p.state) {
      const id = p.txid || p.new_channel_point || p.state;
      if (!first && !k.started) {
        await tell(M.spStart(who, p.initiator === 'INITIATOR_LOCAL' ? M.you : M.peer, signed(p.local_delta_sat),
          signed(p.remote_delta_sat), plain(p.new_capacity_sat), plain(p.fee_sat), plain(p.our_fee_sat)).join('\n'));
      }
      k.started = true;
      if (p.txid && ['broadcast', 'confirmed'].includes(p.state) && k.onChain !== p.txid) {
        if (!first) await tell(M.spOnChain(who, p.lock_depth || 6) + `\nTx: ${p.txid}`);
        k.onChain = p.txid;
      }
      if (p.relay_status === 'rejected' && k.rejected !== id) {
        if (!first) await tell(M.spRejected(who, p.relay_reason || '?'));
        k.rejected = id;
      }
    } else {
      k.started = false;
    }
    const last = c.last_splice;
    if (last && last.time && String(last.time) !== k.lastTime) {
      if (!first) {
        if (last.outcome === 'locked') {
          await tell([...M.spLocked(who, signed(last.local_delta_sat), signed(last.remote_delta_sat)), last.txid ? `Tx: ${last.txid}` : ''].filter(Boolean).join('\n'));
        } else {
          const why = last.reason ? (last.reason_from_peer ? `${M.spPeerSaid}: «${last.reason}»` : last.reason) : '';
          await tell(M.spEnded(who, M.spHow[last.outcome] || last.outcome, why).join('\n'));
        }
      }
      k.lastTime = String(last.time);
    }
    const unknown = c.splice_status === 'funding_spent_unknown';
    if (unknown && !k.unknownTold && !first) await tell(M.spUnknown(who));
    k.unknownTold = unknown;
  }
}

(async () => {
  const st = load() || {};
  if (process.argv[2] === '--test') { await tell(M.test); return; }
  let n = 0;
  for (;;) {
    try { await tick(st); save(st); } catch (e) { console.error(new Date().toISOString(), e.message); }
    if (SPLICES && n++ % SPLICE_EVERY === 0) {
      try { await splices(st); save(st); } catch (e) { console.error(new Date().toISOString(), 'splices:', e.message); }
    }
    await new Promise(r => setTimeout(r, EVERY_MS));
  }
})();
