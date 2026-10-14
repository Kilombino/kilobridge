# Kilobridge

A web front end for a [Lightning Fork](https://github.com/paulscode/lightning-fork) bridge: anyone pastes (or scans) a Lightning invoice of the SHA-256 chain and pays it with coins of the BLAKE2b chain, without accounts and without trusting the bridge with funds.

Live: **https://bridge.kilombino.com** (also `http://li7nwmrffmt6iut2ygolrs6mgrzwdxe26mtatzpgxvff3fri3rnq4iid.onion`). Kilowallet pays SHA-256 invoices through the same service from its PAY screen.

## How a payment works

1. The page reads the SHA-256 invoice and shows what paying it costs (`/v2/bridge/info`); nothing is reserved.
2. On *Get the invoice* the bridge quotes it (`/v2/bridge/quote`) and returns a **hold invoice on the BLAKE2b chain with the same payment hash**. The page checks it before showing it: the same hash, the exact amount quoted, `option_blake2b` set.
3. The payer pays it within the quote's two minutes. The payment is only *held*: the bridge can collect it only with the preimage, which it gets by paying the SHA-256 invoice. If it cannot pay (no route, the price moved against it, the quote lapsed), the hold invoice is cancelled and the payment returns by itself.
4. The page follows the swap (`/v2/bridge/swap`) until it is paid and shows the preimage as proof.

The price, the volatility stops and the recheck before paying out are the bridge's own (Neoxa's BTCB2_BTC market, cross-checked against BTCB2_USDC × BTC/USD; see Lightning Fork's `docs/bridge.md`). Kilobridge adds what a public page needs on top.

## What is in here

| Directory | What it is |
|---|---|
| `web/` | The page and its server (Node, no dependencies). Holds only a **participant code** of the bridge: info, quote and the state of its own swaps, nothing else. Adds a daily cap, a reserve of SHA-256 outbound for other uses of that node, per-visitor and overall rate limits, and a guard against re-quoting an invoice while an earlier hold invoice's expiry timer could still cancel the new one ([lightning-fork-bridge#2](https://github.com/paulscode/lightning-fork-bridge/issues/2)). Dark and light themes, English and Spanish, camera QR scanning. |
| `watch/` | Tells the operator on Telegram about every swap and raises alerts (a swap waiting on the operator, a lost one, outbound under the reserve, the bridge down, the daily cap). It also writes the limits file the web reads, so the web never needs access to the node. |
| `sni-proxy/` | Only if your SHA-256 lnd runs with `tlsencryptkey=true`: such an lnd answers clients that do not name it (SNI) with a short-lived ephemeral certificate, and the bridge dials by IP. The proxy names it and pins its real certificate. |
| `deploy/` | systemd units and example environment files. |

## Run your own bridge

You need two Lightning nodes: **Lightning Fork** on the BLAKE2b chain (it runs the bridge and is paid there) and a stock **lnd** on the SHA-256 chain with outbound liquidity (it pays the invoices). The bridge only ever pays out what it has been paid for, but price risk is yours: start with low limits.

### 1. Turn the bridge on

In the Lightning Fork node's `lnd.conf` (`lnd --help | grep bridgerpc` lists every option of your version; the market price source needs `v0.21.3-beta-blake2b.17` or later):

```ini
[bridgerpc]
bridgerpc.enabled=true
bridgerpc.tosha256=true
bridgerpc.sha256.rpchost=<sha256 lnd host>:10009
bridgerpc.sha256.tlscertpath=/path/to/sha256-tls.cert
bridgerpc.sha256.macaroonpath=/path/to/sha256-bridge.macaroon
bridgerpc.ratesource=neoxa
bridgerpc.fee.tosha256=0.02          # your fee; wallets refuse quotes more than 5 % above market
bridgerpc.maxswapmsat=100000000      # 100k sats SHA-256 per swap
bridgerpc.inventorytargetmsat=1200000000
```

The SHA-256 macaroon should be baked for this alone, with a **root key of its own** (so it can be revoked without touching `admin.macaroon`) and locked to the IP the bridge connects from:

```sh
# on the SHA-256 node
lncli bakemacaroon --root_key_id 7210 info:read onchain:read invoices:read invoices:write \
  offchain:read offchain:write --save_to sha256-bridge.macaroon
# anywhere: lock it to the bridge host's IP
lncli constrainmacaroon --ip_address <bridge host IP> sha256-bridge.macaroon sha256-bridge.macaroon
```

Revoke it any time with `lncli deletemacaroonid 7210` on the SHA-256 node. Restart the Lightning Fork node and check `lncli bridge status`: the SHA-256 node `ready`, a `rate` from `neoxa`, the direction open.

### 2. A participant code for the web

```sh
lncli bridge code --url https://127.0.0.1:<rest port> \
  --cert $(openssl x509 -in tls.cert -noout -fingerprint -sha256 | cut -d= -f2) --label "<your name>"
```

Save the `lfbridge:…` line as `/etc/kilobridge/code.json` (mode 600); the server accepts it as printed. The code can only quote and follow its own swaps; revoke it with `lncli deletemacaroonid <root_key_id>`. Every limit of `bridgerpc.participant.*` applies to the whole page, since the page is one participant.

### 3. Install

```sh
sudo mkdir -p /opt/kilobridge /etc/kilobridge /srv/bridge-limits
sudo cp -r web watch /opt/kilobridge/
sudo chown <watch user> /srv/bridge-limits
sudo cp deploy/web.env.example /etc/kilobridge/web.env        # set OPERATOR and the words
sudo cp deploy/kilobridge-web.service /etc/systemd/system/
sudo systemctl enable --now kilobridge-web
# the watcher runs as a user in the docker group, with watch.env from deploy/watch.env.example
```

Put `PORT` behind your tunnel or reverse proxy (it trusts `CF-Connecting-IP` there) and `TOR_PORT` behind an onion service (`HiddenServicePort 80 127.0.0.1:3251`; headers are not believed on that port). Without fresh limits from the watcher the page refuses to quote, so start the watcher first.

## Security notes

- No custody: a hold invoice with the payer's payment hash; nothing is paid out that was not paid for.
- The web holds one URI-scoped macaroon (three calls) and runs as a throwaway user that can only reach localhost.
- No accounts, no logs of invoices; strict CSP, no third-party scripts, the QR libraries are served from the page.
- The daily cap and the reserve are enforced by the web. A participant code given to anyone else (for example a Lightning Fork dashboard) would not go through them.

## Licence

MIT, see `LICENSE`.
