'use strict';
// Third tab: Kiloswap, the operator's on-chain ⇄ Lightning swap. Not framed:
// the swap's site keeps the user's swaps and rescue key in its own storage,
// which a frame inside this page would keep apart. The tab explains and
// opens it (over Tor, its onion when this page is on Tor).
(() => {
  const SITE = 'https://swap.kilombino.com';
  const ONION = 'swapkqsnxocu2rnmwtaswpvchgl3teooeqgx43ookk5qqhzyx4rzqhid.onion';
  const T = {
    en: {
      lead: 'Swap between on-chain BTC and Lightning, without custody: your keys stay in your browser and a rescue key gets your coins back even if the service were gone.',
      inL: 'On-chain → Lightning', outL: 'Lightning → on-chain', limL: 'Per swap',
      in: '0.01 %', out: '0.15 %', lim: '10,000 – 100,000,000',
      open: 'Open Kiloswap',
      note: 'Plus the on-chain fee. Keep the rescue file it asks you to save. Up to 2 BTC a day across all swaps.',
    },
    es: {
      lead: 'Cambia entre BTC on-chain y Lightning, sin custodia: tus claves se quedan en tu navegador y una clave de rescate te devuelve las monedas aunque el servicio desapareciera.',
      inL: 'On-chain → Lightning', outL: 'Lightning → on-chain', limL: 'Por swap',
      in: '0,01 %', out: '0,15 %', lim: '10.000 – 100.000.000',
      open: 'Abrir Kiloswap',
      note: 'Más la comisión de red. Guarda el archivo de rescate que te pide. Hasta 2 BTC al día entre todos los swaps.',
    },
  };
  const $ = (id) => document.getElementById(id);
  const lang = () => { try { return localStorage.getItem('lang') || ''; } catch { return ''; } };
  function render() {
    const l = T[lang()] ? lang() : ((navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en');
    const x = T[l];
    $('swapLead').textContent = x.lead;
    $('swapInL').textContent = x.inL; $('swapIn').textContent = x.in;
    $('swapOutL').textContent = x.outL; $('swapOut').textContent = x.out;
    $('swapLimL').textContent = x.limL; $('swapLim').textContent = `${x.lim} sats`;
    $('swapOpen').textContent = x.open;
    $('swapNote').textContent = x.note;
  }
  const onTor = location.hostname.endsWith('.onion');
  if (onTor && ONION) $('swapOpen').href = `http://${ONION}`;
  render();
  $('tabs').hidden = false;
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => setTimeout(render, 0)));
  if (location.hash === '#kiloswap') window.dispatchEvent(new HashChangeEvent('hashchange'));
})();
