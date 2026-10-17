# Armada Safe Verification — Cloudflare deploy

A tiny Safe Custom App that asks the currently selected Safe to sign an Armada control-verification message. It never constructs or submits a transaction.

## What the recipient does

1. Open the intended Safe on Ethereum Mainnet in Safe{Wallet}.
2. Go to **Apps → My custom apps → Add custom Safe App**.
3. Paste your deployed URL, e.g. `https://verify.armada.blue`.
4. Open **Armada Safe Verification**.
5. Check the Safe address and click **Sign verification message**.
6. Keep the Safe signing window open while the Safe's required owners approve the message.
7. Download the JSON receipt and send it to Armada.

The app uses Safe's off-chain message flow. If Safe returns no portable signature, check **Safe Settings → Safe Apps** and make sure on-chain message signing is disabled, then retry.

## Cloudflare Pages — easiest deployment (GitHub)

Push this directory to a GitHub repository, then in Cloudflare:

- **Workers & Pages → Create application → Pages → Import an existing Git repository**
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`

Cloudflare runs `npm install` automatically before the build.

After the first deployment, Cloudflare gives you a `*.pages.dev` HTTPS URL. Test that URL as a Custom Safe App first.

### Custom domain

In the Pages project, use **Custom domains → Set up a domain**, e.g. `verify.armada.blue`.

## Required Safe manifest/CORS

`public/manifest.json` is copied to `/manifest.json` by Vite. Safe requires that file at the app root. `public/_headers` adds the required CORS headers on Cloudflare Pages.

Verify after deployment:

- `https://YOUR_DOMAIN/manifest.json` loads
- response includes `Access-Control-Allow-Origin: *`
- the app URL uses HTTPS

## Local development

```bash
npm install
npm run dev
```

For actual Safe Custom App testing, deploying a preview to Cloudflare is easier than local development because Safe embeds the app over HTTPS.

## Security properties

- No backend, database, API key, wallet seed or private key.
- No `eth_sendTransaction` call in this app.
- The only signing request is `personal_sign` from the Safe address via `SafeAppProvider`.
- The challenge binds the selected Safe address, chain ID, current app origin, timestamp and a fresh random nonce.
- The receipt contains the exact message and returned Safe signature.
- The app requires Ethereum Mainnet (`chainId = 1`) before enabling signing.

## Dependencies

Pinned to the Safe Apps packages current when this bundle was prepared:

- `@safe-global/safe-apps-sdk` 9.1.0
- `@safe-global/safe-apps-provider` 0.18.6

