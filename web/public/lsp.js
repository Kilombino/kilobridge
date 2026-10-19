'use strict';
// Second tab: buy an inbound channel from the operator's node (a kilo-lsp server behind
// /api/lsp/). The buyer proves the node is theirs by signing a request with it, pays a hold
// invoice for the fee, and the fee is only collected once the channel's funding is out.
(() => {
  const T = {
    en: {
      lead: (n) => `Get inbound liquidity: ${n} opens a channel from its node to yours so you can receive. You pay a fee per million, held until the channel's funding transaction is out; if it can't open, the payment comes back by itself.`,
      feeL: 'Fee', fee: (f) => `${f} {OWN} per million`, availL: 'Available now', availNone: 'none right now', daysL: 'Kept open at least', days: (d) => `${d} days`,
      pubkeyL: 'Your node (pubkey@host:port)', sizeL: 'Channel size', million: (m) => `${m} million {OWN}`, payL: 'You pay',
      prep: 'Request the channel',
      copied: 'Copied ✓',
      payNowL: 'Pay', invLeftL: 'Invoice valid for', copyInv: 'Copy invoice', openInv: 'Open in wallet',
      holdNote: 'Pay it from any {COIN} Lightning wallet. Your node is already connected and the channel was checked; the payment is held and only collected once the channel is opening, otherwise it goes back to you.',
      st: { waiting_payment: 'Waiting for your payment…', paid: 'Payment received: opening the channel…', opening: 'The channel is opening: waiting for confirmations.' },
      openT: 'Channel opening ✓', openText: (s, tx) => `A channel of ${s} {OWN} to your node is on its way. Funding transaction: ${tx}`,
      activeT: 'Channel open ✓', activeText: (s) => `Your node now has a channel of ${s} {OWN} from ours, ready to receive.`,
      failedT: 'Not opened', failedText: (r) => `The channel couldn't be opened${r ? ` (${r})` : ''}. Your payment has been returned.`,
      expiredT: 'Expired', expiredText: 'The invoice was not paid in time. Nothing was charged.',
      again: 'Request another channel',
      howT: 'How it works',
      how1: 'Enter your node as pubkey@host:port (an .onion address works) and the size you want.',
      how2: 'Our node connects to yours and checks it can open the channel: liquidity, limits and that your node answers.',
      how3: 'Pay the fee invoice. It stays on hold, not collected yet.',
      how4: 'The channel opens from our node to yours and only then is the fee collected. If it can’t open, the payment comes back.',
      rules: (min, max, d, priv) => `Channels from ${min} to ${max} million, in whole millions; one request per node at a time. ${priv ? 'Private channel (not announced): your node receives through route hints in its invoices. ' : ''}Opened with confirmed coins only; kept at least ${d} days.`,
      e: {
        pubkey: 'Write it as pubkey@host:port: the public key (66 hex characters, 02… or 03…), @, and the address your node listens on.',
        limit: 'Too many requests. Wait a few minutes and try again.', unavailable: 'The service is not available right now. Try again later.',
        network: 'Can’t reach the server. Check your connection.', bad_hold: 'The fee invoice didn’t check out, so it isn’t shown. Try again.',
      },
      lsp: [
        ['could not connect to your node', 'Our node could not connect to yours at that address. Check that it is online and reachable there (an .onion address works if your node uses Tor).'],
        ['that address is not a public one', 'That address is a private one: give the public address or the .onion of your node.'],
        ['that address does not resolve', 'That address does not resolve.'],
        ['you already have a request waiting', 'You already have a request waiting for payment: pay it or wait 5 minutes for it to expire.'],
      ],
    },
    es: {
      lead: (n) => `Consigue liquidez de entrada: ${n} abre un canal desde su nodo hasta el tuyo para que puedas recibir. Pagas una comisión por millón, retenida hasta que sale la transacción de apertura; si no se puede abrir, el pago vuelve solo.`,
      feeL: 'Comisión', fee: (f) => `${f} {OWN} por millón`, availL: 'Disponible ahora', availNone: 'nada ahora mismo', daysL: 'Abierto como mínimo', days: (d) => `${d} días`,
      pubkeyL: 'Tu nodo (pubkey@host:puerto)', sizeL: 'Tamaño del canal', million: (m) => `${m} ${m === 1 ? 'millón' : 'millones'} de {OWN}`, payL: 'Pagas',
      prep: 'Pedir el canal',
      copied: 'Copiado ✓',
      payNowL: 'Paga', invLeftL: 'Factura válida durante', copyInv: 'Copiar factura', openInv: 'Abrir en la wallet',
      holdNote: 'Págala desde cualquier wallet Lightning de {COIN}. Tu nodo ya está conectado y el canal comprobado; el pago queda retenido y solo se cobra cuando el canal se está abriendo; si no, vuelve a ti.',
      st: { waiting_payment: 'Esperando tu pago…', paid: 'Pago recibido: abriendo el canal…', opening: 'El canal se está abriendo: esperando confirmaciones.' },
      openT: 'Canal en camino ✓', openText: (s, tx) => `Un canal de ${s} {OWN} hacia tu nodo se está abriendo. Transacción de apertura: ${tx}`,
      activeT: 'Canal abierto ✓', activeText: (s) => `Tu nodo ya tiene un canal de ${s} {OWN} desde el nuestro, listo para recibir.`,
      failedT: 'No se ha abierto', failedText: (r) => `No se pudo abrir el canal${r ? ` (${r})` : ''}. Tu pago se ha devuelto.`,
      expiredT: 'Caducada', expiredText: 'La factura no se pagó a tiempo. No se ha cobrado nada.',
      again: 'Pedir otro canal',
      howT: 'Cómo funciona',
      how1: 'Pon tu nodo como pubkey@host:puerto (vale una dirección .onion) y el tamaño que quieres.',
      how2: 'Nuestro nodo se conecta al tuyo y comprueba que puede abrir el canal: liquidez, límites y que tu nodo responde.',
      how3: 'Paga la factura de la comisión. Queda retenida, todavía sin cobrar.',
      how4: 'El canal se abre desde nuestro nodo hasta el tuyo y solo entonces se cobra la comisión. Si no se puede abrir, el pago vuelve.',
      rules: (min, max, d, priv) => `Canales de ${min} a ${max} millones, en millones enteros; una petición por nodo a la vez. ${priv ? 'Canal privado (sin anunciar): tu nodo recibe mediante pistas de ruta en sus facturas. ' : ''}Se abre solo con monedas confirmadas y se mantiene al menos ${d} días.`,
      e: {
        pubkey: 'Escríbelo como pubkey@host:puerto: la clave pública (66 caracteres hexadecimales, 02… o 03…), @, y la dirección donde escucha tu nodo.',
        limit: 'Demasiadas peticiones. Espera unos minutos y vuelve a probar.', unavailable: 'El servicio no está disponible ahora. Prueba más tarde.',
        network: 'No se puede contactar con el servidor. Revisa tu conexión.', bad_hold: 'La factura de la comisión no cuadraba y no se muestra. Prueba otra vez.',
      },
      // The service answers in English; these are its messages, by how they start.
      lsp: [
        ['the signature is not from that node', 'La firma no es de ese nodo: fírmalo con el nodo de esa clave pública.'],
        ['the request is too old', 'La petición ha caducado o el reloj del equipo va mal. Prepárala otra vez.'],
        ['this request was already used', 'Esa petición ya se usó. Prepara una nueva.'],
        ['your node already has a request in progress', 'Tu nodo ya tiene una petición en curso.'],
        ['busy with other requests', 'Hay otras peticiones en curso. Prueba en unos minutos.'],
        ['your node is not connected to ours', 'Tu nodo no está conectado al nuestro: ejecuta el paso 1, espera unos segundos y vuelve a probar.'],
        ['we already have', 'Ya tenemos con tu nodo el máximo de canales permitido.'],
        ['not enough confirmed liquidity', 'Ahora no hay liquidez confirmada suficiente: prueba un canal más pequeño o después del próximo bloque.'],
        ['sats must be whole millions', 'El tamaño tiene que ser de millones enteros.'],
        ['your node went offline', 'Tu nodo se desconectó antes de abrir el canal.'],
        ['could not connect to your node', 'Nuestro nodo no ha podido conectarse al tuyo en esa dirección. Comprueba que está encendido y accesible ahí (si tu nodo usa Tor, vale la .onion).'],
        ['that address is not a public one', 'Esa dirección es privada: pon la dirección pública o la .onion de tu nodo.'],
        ['that address does not resolve', 'Esa dirección no existe.'],
        ['you already have a request waiting', 'Ya tienes una petición esperando el pago: págala o espera 5 minutos a que caduque.'],
      ],
    },
  };

  const $ = (id) => document.getElementById(id);
  const lang = () => { try { return T[localStorage.getItem('lang')] ? localStorage.getItem('lang') : null; } catch { return null; } };
  let L = { own: 'sats', coin: 'BTC' };
  const fill = (v) => typeof v === 'string' ? v.replace(/\{OWN\}/g, L.own).replace(/\{COIN\}/g, L.coin)
    : typeof v === 'function' ? (...a) => fill(v(...a)) : v;
  const t = () => {
    const l = lang() || ((navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en');
    return new Proxy(T[l], { get: (o, k) => (k === 'e' || k === 'st' || k === 'lsp' ? o[k] : fill(o[k])) });
  };
  const fmt = (n) => new Intl.NumberFormat(document.documentElement.lang === 'es' ? 'es-ES' : 'en-US', { useGrouping: 'always' }).format(n);

  let info = null, order = null, invTimer = null, poll = null;

  async function api(path, body) {
    try {
      const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
      return await r.json();
    } catch { return { error: 'network' }; }
  }
  function errText(d) {
    if (d.error === 'lsp') {
      const hit = t().lsp.find(([k]) => (d.message || '').startsWith(k));
      return hit ? hit[1] : (d.message || t().e.unavailable);
    }
    return t().e[d.error] || t().e.unavailable;
  }
  function showErr(id, msg) { $(id).textContent = msg; $(id).hidden = !msg; }
  function step(n) { ['lsp1', 'lsp3', 'lsp4'].forEach((s) => { $(s).hidden = s !== n; }); }
  const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function render() {
    if (!info) return;
    const x = t();
    $('tabLspBtn').textContent = info.name;
    $('lspLead').textContent = x.lead(info.name);
    $('lspFeeL').textContent = x.feeL; $('lspFee').textContent = x.fee(fmt(info.feePerMillion));
    $('lspAvailL').textContent = x.availL;
    $('lspAvail').textContent = info.availableSats >= info.minSats ? x.million(info.availableSats / 1e6) : x.availNone;
    $('lspDaysL').textContent = x.daysL; $('lspDays').textContent = x.days(info.minDays);
    $('lspPubkeyL').textContent = x.pubkeyL; $('lspSizeL').textContent = x.sizeL; $('lspPayL').textContent = x.payL;
    const sel = $('lspSize'); const keep = sel.value;
    const top = Math.min(info.maxSats, Math.max(info.minSats, info.availableSats));
    sel.innerHTML = '';
    for (let s = info.minSats; s <= top; s += info.stepSats) sel.add(new Option(x.million(s / 1e6), String(s)));
    if (keep && [...sel.options].some((o) => o.value === keep)) sel.value = keep;
    updatePay();
    $('lspPrepBtn').textContent = x.prep; $('lspPrepBtn').disabled = info.availableSats < info.minSats;
    $('lspPayNowL').textContent = x.payNowL; $('lspInvLeftL').textContent = x.invLeftL;
    $('lspCopyInv').textContent = x.copyInv; $('lspOpenInv').textContent = x.openInv; $('lspHoldNote').textContent = x.holdNote;
    $('lspAgain').textContent = x.again;
    $('lspHowT').textContent = x.howT;
    ['lspHow1', 'lspHow2', 'lspHow3', 'lspHow4'].forEach((id, i) => { $(id).textContent = x[`how${i + 1}`]; });
    $('lspRules').textContent = x.rules(info.minSats / 1e6, info.maxSats / 1e6, info.minDays, info.private);
    if (order) showOrder(order);
  }
  function updatePay() {
    const s = Number($('lspSize').value || 0);
    $('lspPay').textContent = s ? `${fmt((s / 1e6) * info.feePerMillion)} ${L.own}` : '–';
  }
  $('lspSize').addEventListener('change', updatePay);

  // Tabs, by the address: #lsp opens this one.
  function route() {
    const lsp = location.hash === '#lsp' && !!info;
    $('tabBridge').hidden = lsp; $('tabLsp').hidden = !lsp;
    $('tabBridgeBtn').classList.toggle('on', !lsp); $('tabLspBtn').classList.toggle('on', lsp);
  }
  window.addEventListener('hashchange', route);
  $('tabBridgeBtn').addEventListener('click', (ev) => { ev.preventDefault(); history.pushState(null, '', location.pathname); route(); });
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => setTimeout(render, 0)));

  $('lspPrepBtn').addEventListener('click', async () => {
    showErr('lspErr1', '');
    const m = /^\s*(0[23][0-9a-fA-F]{64})@(\S+:\d{1,5})\s*$/.exec($('lspPubkey').value);
    if (!m) return showErr('lspErr1', t().e.pubkey);
    const sats = Number($('lspSize').value);
    $('lspPrepBtn').disabled = true;
    const d = await api('/api/lsp/quote', { pubkey: m[1].toLowerCase(), host: m[2], sats });
    $('lspPrepBtn').disabled = false;
    if (d.error) return showErr('lspErr1', errText(d));
    order = { id: d.id, status: 'waiting_payment', sats: d.sats, fee: d.fee, expires: d.expires };
    $('lspPayNow').textContent = `${fmt(d.fee)} ${L.own}`;
    const qr = qrcode(0, 'L');
    qr.addData(d.invoice.toUpperCase(), 'Alphanumeric');
    qr.make();
    $('lspQr').src = qr.createDataURL(6, 2);
    $('lspQrLink').href = $('lspOpenInv').href = 'lightning:' + d.invoice;
    $('lspCopyInv').onclick = async () => { try { await navigator.clipboard.writeText(d.invoice); $('lspCopyInv').textContent = t().copied; } catch {} };
    step('lsp3');
    showOrder(order);
    clearInterval(invTimer);
    const tick = () => {
      const left = Math.max(0, d.expires - Math.floor(Date.now() / 1000));
      $('lspInvLeft').textContent = clock(left);
      $('lspInvLeft').parentElement.classList.toggle('low', left < 60);
    };
    tick(); invTimer = setInterval(tick, 1000);
    clearInterval(poll);
    poll = setInterval(async () => {
      const o = await api(`/api/lsp/order/${order.id}`);
      if (!o.error) { order = { ...order, ...o }; showOrder(order); }
    }, 4000);
  });

  function showOrder(o) {
    const x = t();
    const done = (title, text) => {
      clearInterval(invTimer);
      if (o.status !== 'opening') clearInterval(poll);
      $('lspDoneT').textContent = title; $('lspDoneText').textContent = text; step('lsp4');
    };
    if (o.status === 'waiting_payment' || o.status === 'paid') {
      $('lspStatus').textContent = x.st[o.status];
      $('lspStatus').className = 'status';
      if (o.status === 'paid') { clearInterval(invTimer); $('lspInvLeft').parentElement.hidden = true; }
    } else if (o.status === 'opening') done(x.openT, x.openText(fmt(o.sats), o.fundingTxid || ''));
    else if (o.status === 'open') done(x.activeT, x.activeText(fmt(o.sats)));
    else if (o.status === 'failed') done(x.failedT, x.failedText(o.reason || ''));
    else if (o.status === 'expired') done(x.expiredT, x.expiredText);
  }
  $('lspAgain').addEventListener('click', () => {
    clearInterval(poll); clearInterval(invTimer); order = null; $('lspInvLeft').parentElement.hidden = false; step('lsp1'); load();
  });

  async function load() {
    const [d, b] = await Promise.all([api('/api/lsp/info'), api('/api/info')]);
    if (b && b.labels) L = { ...L, ...b.labels };
    if (!d || d.error) return;           // no LSP behind this page: no tab
    info = d;
    $('tabs').hidden = false;
    render(); route();
  }
  load();
  setInterval(() => { if (info && !order) api('/api/lsp/info').then((d) => { if (!d.error) { info = d; render(); } }); }, 120_000);
})();
