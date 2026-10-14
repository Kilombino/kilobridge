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
  let meta = null, quote = null, timer = null, poll = null, sat = 0;

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

  async function getQuote() {
    clearErr();
    $('quoteBtn').disabled = true;
    const d = await api('/api/quote', { invoice: invoice() });
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
    const d = await api('/api/swap/' + quote.hash);
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
