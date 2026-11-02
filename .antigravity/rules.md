# Antigravity Engineering Standards · Muntrume Motorsport
# ATM Software Labs Ecosystem

This repository is governed by the ATM Software Labs engineering standards and verified via Google Antigravity (AGY).

## 1. Zero-Trust & Architectural Hygiene
- Never expose or hardcode secrets, API keys, or unverified bypasses.
- All edge endpoints authenticate via Cloudflare Workers (`worker/index.js`), D1 (`muntrume_vault`), or signed HMAC/Ed25519 JWT sessions.
- Inbound and outbound emails strictly adhere to verified domain policies (`trujillomingorance.com`, DKIM, SPF 100%, and Cloudflare Email Routing with PostalMime parsing).

## 2. Simplicity & Surgical Changes
- Minimal code that solves the problem. Nothing speculative.
- Touch only what you must. Preserve existing comments and docstrings.
- Ensure 0 build warnings and 100% test pass on `scripts/e2e-verify.mjs`.

## 3. Autonomous Verification Loops
1. Static analysis & HTML compression: `npm run build`
2. End-to-end headless verification: `node scripts/e2e-verify.mjs`
3. Worker lint & type check: `npx wrangler deploy --dry-run`
