'use strict';
(() => {
  const T = {
    en: {
      lead: 'Pay a {CHAIN} Lightning invoice with your {COIN}. Your {COIN} payment is held and only collected once the invoice has been paid; otherwise it comes back to you by itself.',
      paste: '{CHAIN} Lightning invoice to pay', pasteBtn: 'Paste', scan: 'Scan QR', check: 'Check price',
      youSend: 'Invoice to pay', youPay: 'You pay about', price: 'Price', fee: 'Fee',
      estimateNote: 'The final price is set when you press the button: you then have 2 minutes to pay.',
      back: 'Back', getInvoice: 'Get the {COIN} invoice',
      payExactly: 'Pay', ownUnit: '{OWN}', expiresIn: 'Price held for', copy: 'Copy invoice', copied: 'Copied ✓', open: 'Open in wallet',
      holdNote: 'Pay it from any {COIN} Lightning wallet. The payment stays on hold until the {CHAIN} invoice is paid.',
      waiting: 'Waiting for your payment…', funded: 'Payment received, paying the invoice…', paying: 'Paying the invoice…',
      doneTitle: 'Paid ✓', doneText: (s) => `The ${s} {SHA} invoice has been paid.`,
      proof: 'Proof of payment (preimage):',
      expiredTitle: 'The price expired', expiredText: 'Nothing was charged. You can get a new price.',
      failedTitle: 'Not paid', failedText: 'The invoice could not be paid. Your {COIN} payment has been returned, nothing was charged.',
      lostTitle: 'Needs a look', lostText: 'Something unusual happened. Contact {OP} with the payment hash.',
      again: 'Pay another invoice', newPrice: 'Get a new price',
      howTitle: 'How it works',
      how1: 'Paste or scan the {CHAIN} invoice you want paid and check the price.',
      how2: 'Get a {COIN} invoice with the same payment hash and pay it within 2 minutes.',
      how3: 'The bridge pays the {CHAIN} invoice and only then collects your {COIN}. If it cannot, your payment comes back by itself.',
      limits: (min, max) => `Invoices from ${min} to ${max} {SHA}. No accounts, nothing stored about you.`,
      footer: 'Non-custodial bridge by {OP}',
      ownTitle: 'Run your own bridge',
      own1: 'One bridge is a single point of failure: it can run out of liquidity, go offline or be pressured. Many bridges run by different people make crossing between {COIN} and {CHAIN} as decentralized as the chains themselves. More bridges are welcome.',
      own2: 'The bridge itself is Paul’s Lightning Fork (its bridgerpc sub-server, open source): any Lightning Fork node with a {CHAIN} lnd next to it can turn it on. This page is a thin, non-custodial front end on top: it holds only a scoped participant code (quote and status, nothing else), checks the hold invoice before showing it, and adds a daily cap, a liquidity reserve and rate limits.',
      ownUseT: 'Using a bridge:', ownUse: 'paste the invoice above. This page and its .onion are listed at the top of the README.',
      ownRunT: 'Running one:', ownRun: 'two nodes, Lightning Fork on {COIN} and an lnd on {CHAIN}. The README walks through turning the bridge on, a macaroon with its own root key locked to one IP, the participant code, an isolated install, and Tor or Cloudflare.',
      ownBtn: 'Setup guide and code (MIT) on GitHub',
      scanHint: 'Point the camera at the invoice QR.', close: 'Close',
      noCamera: 'This browser cannot use the camera here. Paste the invoice instead.',
      e: {
        checksum: 'That invoice is damaged (checksum). Copy it again, ideally from the wallet itself.',
        invalid_invoice: 'That doesn’t look like a Lightning invoice.', wrong_network: 'That invoice is not for mainnet.',
        is_xbt: 'That is a {COIN} invoice: pay it directly from your {COIN} wallet.', no_amount: 'The invoice has no amount. Ask for one with an amount.',
        expires_soon: 'The invoice expires too soon. Ask for a new one.', too_small: (d) => `Too small: at least ${d.min_sat} {SHA}.`,
        too_large: (d) => `Too large: at most ${d.max_sat} {SHA}.`, daily_cap: 'The bridge has reached its limit for today. Try again tomorrow.',
        no_liquidity: 'Not enough liquidity right now for that amount. Try a smaller one or later.',
        price_unavailable: 'No reliable price right now (the market is moving or can’t be read). Try again in a few minutes.',
        chain_unmeasured: 'The bridge is warming up. Try again in a few minutes.',
        self_payment: 'That invoice can’t be paid through this bridge.', route_budget: 'That invoice can’t be paid safely (its timing).',
        in_progress: 'This invoice is already being paid. Wait a moment.', already_paid: 'This invoice has already been paid through the bridge.',
        needs_operator: 'This invoice needs {OP} to look at it.', limit: 'Too many requests. Wait a minute and try again.',
        pow_expired: 'That took too long. Try again.', pow_used: 'Try again.', pow_invalid: 'Try again.', pow_missing: 'Reload the page and try again.',
        wait: (d) => `Wait ${d.wait_s} s before asking for a new price for this invoice.`,
        no_direction: 'This bridge doesn’t pay that kind of invoice.', bad_hold: 'The bridge gave an invoice that didn’t check out, so it isn’t shown. Try again.',
        unavailable: 'The bridge is not available right now. Try again later.', network: 'Can’t reach the server. Check your connection.',
      },
    },
    es: {
      lead: 'Paga una factura Lightning {CHAIN} con tu {COIN}. Tu pago en {COIN} queda retenido y solo se cobra cuando la factura se ha pagado; si no, vuelve a ti solo.',
      paste: 'Factura Lightning {CHAIN} a pagar', pasteBtn: 'Pegar', scan: 'Escanear QR', check: 'Ver precio',
      youSend: 'Factura a pagar', youPay: 'Pagas unos', price: 'Precio', fee: 'Comisión',
      estimateNote: 'El precio final se fija al pulsar el botón: desde ese momento tienes 2 minutos para pagar.',
      back: 'Atrás', getInvoice: 'Obtener la factura {COIN}',
      payExactly: 'Paga', ownUnit: '{OWN}', expiresIn: 'Precio garantizado durante', copy: 'Copiar factura', copied: 'Copiada ✓', open: 'Abrir en la wallet',
      holdNote: 'Págala desde cualquier wallet Lightning de {COIN}. El pago queda retenido hasta que se paga la factura {CHAIN}.',
      waiting: 'Esperando tu pago…', funded: 'Pago recibido, pagando la factura…', paying: 'Pagando la factura…',
      doneTitle: 'Pagada ✓', doneText: (s) => `La factura de ${s} {SHA} está pagada.`,
      proof: 'Justificante de pago (preimagen):',
      expiredTitle: 'El precio ha caducado', expiredText: 'No se ha cobrado nada. Puedes pedir un precio nuevo.',
      failedTitle: 'No se ha pagado', failedText: 'No se pudo pagar la factura. Tu pago en {COIN} ha vuelto, no se ha cobrado nada.',
      lostTitle: 'Hay que revisarlo', lostText: 'Ha pasado algo raro. Escribe a {OP} con el hash del pago.',
      again: 'Pagar otra factura', newPrice: 'Pedir precio nuevo',
      howTitle: 'Cómo funciona',
      how1: 'Pega o escanea la factura {CHAIN} que quieres pagar y mira el precio.',
      how2: 'Obtén una factura {COIN} con el mismo hash de pago y págala en menos de 2 minutos.',
      how3: 'El bridge paga la factura {CHAIN} y solo entonces cobra tus {COIN}. Si no puede, tu pago vuelve solo.',
      limits: (min, max) => `Facturas de ${min} a ${max} {SHA}. Sin cuentas, no se guarda nada sobre ti.`,
      footer: 'Bridge sin custodia de {OP}',
      ownTitle: 'Monta tu propio bridge',
      own1: 'Un solo bridge es un punto único de fallo: se puede quedar sin liquidez, caerse o sufrir presiones. Muchos bridges de personas distintas hacen que pasar entre {COIN} y {CHAIN} sea tan descentralizado como las propias cadenas. Cuantos más bridges, mejor.',
      own2: 'El bridge en sí es Lightning Fork de Paul (su subservidor bridgerpc, de código abierto): cualquier nodo Lightning Fork con un lnd de {CHAIN} al lado puede activarlo. Esta página es solo una capa web sin custodia por encima: guarda únicamente un código de participante limitado (precio y estado, nada más), comprueba la hold invoice antes de enseñarla y añade un límite diario, una reserva de liquidez y límites de uso.',
      ownUseT: 'Para usar un bridge:', ownUse: 'pega la factura arriba. Esta página y su .onion están al principio del README.',
      ownRunT: 'Para montar uno:', ownRun: 'dos nodos, Lightning Fork en {COIN} y un lnd en {CHAIN}. El README explica cómo activar el bridge, un macaroon con su propia root key limitado a una IP, el código de participante, una instalación aislada, y Tor o Cloudflare.',
      ownBtn: 'Guía de instalación y código (MIT) en GitHub',
      scanHint: 'Apunta la cámara al QR de la factura.', close: 'Cerrar',
      noCamera: 'Este navegador no puede usar la cámara aquí. Pega la factura.',
      e: {
        checksum: 'Esa factura está dañada (checksum). Cópiala otra vez, mejor desde la propia wallet.',
        invalid_invoice: 'Eso no parece una factura Lightning.', wrong_network: 'Esa factura no es de mainnet.',
        is_xbt: 'Esa es una factura {COIN}: págala directamente desde tu wallet {COIN}.', no_amount: 'La factura no lleva importe. Pide una con importe.',
        expires_soon: 'La factura caduca demasiado pronto. Pide una nueva.', too_small: (d) => `Demasiado pequeña: mínimo ${d.min_sat} {SHA}.`,
        too_large: (d) => `Demasiado grande: máximo ${d.max_sat} {SHA}.`, daily_cap: 'El bridge ha llegado a su límite de hoy. Prueba mañana.',
        no_liquidity: 'Ahora no hay liquidez suficiente para ese importe. Prueba con menos o más tarde.',
        price_unavailable: 'Ahora no hay un precio fiable (el mercado se mueve o no se puede leer). Prueba en unos minutos.',
        chain_unmeasured: 'El bridge está arrancando. Prueba en unos minutos.',
        self_payment: 'Esa factura no se puede pagar por este bridge.', route_budget: 'Esa factura no se puede pagar con seguridad (por sus plazos).',
        in_progress: 'Esta factura ya se está pagando. Espera un momento.', already_paid: 'Esta factura ya se pagó por el bridge.',
        needs_operator: 'Esta factura necesita que la revise {OP}.', limit: 'Demasiadas peticiones. Espera un minuto y vuelve a probar.',
        pow_expired: 'Ha tardado demasiado. Prueba otra vez.', pow_used: 'Prueba otra vez.', pow_invalid: 'Prueba otra vez.', pow_missing: 'Recarga la página y prueba otra vez.',
        wait: (d) => `Espera ${d.wait_s} s antes de pedir otro precio para esta factura.`,
        no_direction: 'Este bridge no paga ese tipo de factura.', bad_hold: 'El bridge dio una factura que no cuadraba y no se muestra. Prueba otra vez.',
        unavailable: 'El bridge no está disponible ahora. Prueba más tarde.', network: 'No se puede contactar con el servidor. Revisa tu conexión.',
      },
    },
  };

  const $ = (id) => document.getElementById(id);
  let lang = 'en';
  try { lang = localStorage.getItem('lang') || ''; } catch {}
  if (!T[lang]) lang = (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
  // What this bridge's operator calls things; replaced by /api/info's labels.
  let L = { op: 'the operator', chain: 'SHA-256', sha: 'sats SHA-256', own: 'sats', coin: 'BTC', price: 'SHA-256 per coin' };
  const fill = (v) => typeof v === 'string'
    ? v.replace(/\{OP\}/g, L.op).replace(/\{CHAIN\}/g, L.chain).replace(/\{SHA\}/g, L.sha)
        .replace(/\{OWN\}/g, L.own).replace(/\{COIN\}/g, L.coin).replace(/\{PRICE\}/g, L.price)
    : typeof v === 'function' ? (...a) => fill(v(...a)) : v;
  const t = () => new Proxy(T[lang], { get: (o, k) => k === 'e' ? new Proxy(o.e, { get: (e, c) => fill(e[c]) }) : fill(o[k]) });
  let meta = null, quote = null, timer = null, poll = null, sat = 0, payHash = '';

  const nf = () => new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-US', { useGrouping: 'always' });
  const fmt = (n) => nf().format(n);

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach((el) => { const v = t()[el.dataset.t]; if (typeof v === 'string') el.textContent = v; });
    document.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
    if (meta) $('limitsNote').textContent = t().limits(fmt(meta.min_sat), fmt(meta.max_sat));
  }
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang; try { localStorage.setItem('lang', lang); } catch {}
    applyLang();
  }));

  function show(step) { ['step1', 'step2', 'step3', 'step4'].forEach((s) => { $(s).hidden = s !== step; }); }
  function errText(d) { const v = t().e[d.error] || t().e.unavailable; return typeof v === 'function' ? v(d) : v; }
  function showErr(id, d) { const el = $(id); el.textContent = errText(d); el.hidden = false; }
  function clearErr() { $('err1').hidden = true; $('err2').hidden = true; }

  async function api(path, body) {
    let r;
    try {
      r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    } catch { return { error: 'network' }; }
    try { return await r.json(); } catch { return { error: 'unavailable' }; }
  }

  const invoice = () => $('invoice').value.trim().replace(/^lightning:/i, '').replace(/\s+/g, '');

  $('pasteBtn').addEventListener('click', async () => {
    try { $('invoice').value = await navigator.clipboard.readText(); } catch { $('invoice').focus(); }
  });

  $('checkBtn').addEventListener('click', async () => {
    clearErr();
    if (!invoice()) return;
    $('checkBtn').disabled = true;
    const d = await api('/api/check', { invoice: invoice() });
    $('checkBtn').disabled = false;
    if (d.error) return showErr('err1', d);
    sat = d.sat;
    payHash = d.hash || '';
    $('sumSat').textContent = `${fmt(d.sat)} ${L.sha}`;
    $('sumPay').textContent = `${fmt(d.estimate_sat)} ${L.own}`;
    $('sumRate').textContent = `${d.rate.toFixed(8)} ${L.price}`;
    $('sumFee').textContent = `${(d.spread * 100).toFixed(2)} %`;
    show('step2');
    if (d.wait_s) showErr('err2', { error: 'wait', wait_s: d.wait_s });
  });

  $('backBtn').addEventListener('click', () => { clearErr(); show('step1'); });
  let retryMode = false;
  $('againBtn').addEventListener('click', () => {
    reset();
    if (retryMode) return $('checkBtn').click(); // same invoice, fresh price
    $('invoice').value = '';
    show('step1');
  });

  // --- proof of work: SHA-256("<challenge>:<payment hash>:<nonce>") with `bits` leading zero
  // bits, found in slices so the page stays responsive (about a second).
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb,
    0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f,
    0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const W = new Uint32Array(64);
  // The first 32 bits of SHA-256 of an ASCII string (enough to count leading zeros up to 32).
  function sha256Head(str) {
    const n = str.length, blocks = ((n + 9 + 63) >> 6);
    const m = new Uint32Array(blocks * 16);
    for (let i = 0; i < n; i++) m[i >> 2] |= str.charCodeAt(i) << (24 - (i & 3) * 8);
    m[n >> 2] |= 0x80 << (24 - (n & 3) * 8);
    m[blocks * 16 - 1] = n * 8;
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    for (let b = 0; b < blocks; b++) {
      for (let i = 0; i < 16; i++) W[i] = m[b * 16 + i];
      for (let i = 16; i < 64; i++) {
        const x = W[i - 15], y = W[i - 2];
        const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let a = h0, bb = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const t2 = (S0 + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    return h0 >>> 0;
  }
  async function work(hash) {
    const c = await api('/api/pow');
    if (c.error) return c;
    const prefix = `${c.challenge}:${hash}:`, bits = Math.min(c.bits, 32);
    const limit = bits === 32 ? 0 : 2 ** (32 - bits);
    for (let n = 0; ; ) {
      const stop = n + 20000;
      for (; n < stop; n++) {
        const nonce = n.toString(36);
        if (sha256Head(prefix + nonce) < limit) return { challenge: c.challenge, nonce };
      }
      await new Promise(r => setTimeout(r, 0));
    }
  }

  async function getQuote() {
    clearErr();
    $('quoteBtn').disabled = true;
    const pow = await work(payHash);
    const d = pow.error ? pow : await api('/api/quote', { invoice: invoice(), pow });
    $('quoteBtn').disabled = false;
    if (d.error) { show('step2'); return showErr('err2', d); }
    quote = d;
    $('paySat').textContent = fmt(d.pay_sat);
    const uri = 'lightning:' + d.hold_invoice;
    const qr = qrcode(0, 'L');
    qr.addData(d.hold_invoice.toUpperCase(), 'Alphanumeric');
    qr.make();
    $('qr').src = qr.createDataURL(6, 2);
    $('qrLink').href = uri;
    $('openBtn').href = uri;
    $('copyBtn').textContent = t().copy;
    $('status').textContent = t().waiting;
    $('status').className = 'status';
    show('step3');
    tick();
    timer = setInterval(tick, 1000);
    poll = setInterval(check, 3000);
  }
  $('quoteBtn').addEventListener('click', getQuote);

  $('copyBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(quote.hold_invoice); $('copyBtn').textContent = t().copied; } catch {}
  });

  function tick() {
    const left = Math.max(0, quote.expires_at - Math.floor(Date.now() / 1000));
    $('countdown').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    $('countdown').parentElement.classList.toggle('low', left < 30);
  }

  function reset() { clearInterval(timer); clearInterval(poll); timer = poll = null; quote = null; }

  async function check() {
    if (!quote) return;
    const d = await api('/api/swap/' + quote.hash + '?t=' + encodeURIComponent(quote.token || ''));
    if (d.error) return;
    switch (d.state) {
      case 'quoted': case 'offered': return;
      case 'funded': case 'paid': $('status').textContent = t().funded; clearInterval(timer); return;
      case 'paying': $('status').textContent = t().paying; clearInterval(timer); return;
      case 'failing': case 'aborting': case 'expiring': return;
      case 'settled': return finish('doneTitle', t().doneText(fmt(sat)), d.preimage);
      case 'expired': return finish('expiredTitle', t().expiredText, '', true);
      case 'failed': case 'aborted': return finish('failedTitle', t().failedText, '', true);
      case 'lost': return finish('lostTitle', `${t().lostText} ${quote.hash}`, '');
    }
  }

  function finish(title, text, preimage, retry) {
    reset();
    $('doneTitle').textContent = t()[title];
    $('doneText').textContent = text;
    $('proof').hidden = !preimage;
    $('preimage').textContent = preimage || '';
    $('againBtn').textContent = retry ? t().newPrice : t().again;
    retryMode = !!retry;
    show('step4');
  }

  // Theme: dark unless chosen otherwise, remembered in this browser only.
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    $('themeBtn').textContent = t === 'dark' ? '☀' : '☾';
    try { localStorage.setItem('theme', t); } catch {}
  }
  let theme = 'dark';
  try { theme = localStorage.getItem('theme') || 'dark'; } catch {}
  setTheme(theme === 'light' ? 'light' : 'dark');
  $('themeBtn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

  // Camera: the browser's own QR detector where there is one, jsQR (served from here) otherwise.
  let stream = null, scanning = false;
  const detector = ('BarcodeDetector' in window) ? (() => { try { return new BarcodeDetector({ formats: ['qr_code'] }); } catch { return null; } })() : null;
  function stopScan() {
    scanning = false;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    $('scanner').hidden = true;
  }
  function found(text) {
    const inv = String(text).trim().replace(/^lightning:/i, '');
    if (!/^ln[a-z0-9]+$/i.test(inv)) return false;
    stopScan();
    $('invoice').value = inv;
    $('checkBtn').click();
    return true;
  }
  async function frame() {
    if (!scanning) return;
    const v = $('video');
    if (v.readyState >= 2) {
      try {
        if (detector) {
          const codes = await detector.detect(v);
          for (const c of codes) if (found(c.rawValue)) return;
        } else if (window.jsQR) {
          const c = $('canvas'), w = v.videoWidth, h = v.videoHeight;
          c.width = w; c.height = h;
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(v, 0, 0, w, h);
          const r = jsQR(g.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          if (r && found(r.data)) return;
        }
      } catch {}
    }
    requestAnimationFrame(frame);
  }
  $('scanBtn').addEventListener('click', async () => {
    clearErr();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      $('err1').textContent = t().noCamera; $('err1').hidden = false; return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      $('err1').textContent = t().noCamera; $('err1').hidden = false; return;
    }
    $('scanner').hidden = false;
    const v = $('video');
    v.srcObject = stream;
    await v.play().catch(() => {});
    scanning = true;
    requestAnimationFrame(frame);
  });
  $('scanClose').addEventListener('click', stopScan);
  $('scanner').addEventListener('click', (e) => { if (e.target === $('scanner')) stopScan(); });

  api('/api/info').then((d) => {
    if (d.labels) L = { ...L, ...d.labels };
    if (!d.error && d.min_sat) meta = d;
    applyLang();
  });
  applyLang();
})();
