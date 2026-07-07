# ACFC Camp Check-In · Cloudflare Deployment Guide

Two PWA apps in one Cloudflare Pages project:
- `/shine.html` → ⭐ Shine Squad Check-In
- `/launch.html` → 🚀 Launch Pad Leadership Check-In

Data is stored in **Cloudflare KV** and shared in real time across all devices.

---

## Prerequisites

| Tool | Install |
|------|---------|
| Node.js 18+ | https://nodejs.org |
| Wrangler CLI | `npm install -g wrangler` |
| Cloudflare account | https://dash.cloudflare.com/sign-up (free) |

---

## Step 1 — Install dependencies & build

```bash
cd camp-app
npm install
npm run build
```

This creates a `dist/` folder with both apps compiled and ready to deploy.

---

## Step 2 — Create a Cloudflare KV namespace

KV is the database that stores all your camp data (campers, staff, events).

1. Go to **Cloudflare Dashboard → Workers & Pages → KV**
2. Click **Create namespace**
3. Name it `camp-kv` → click **Add**
4. Copy the **Namespace ID** shown

Now open `wrangler.toml` and paste your IDs:

```toml
[[kv_namespaces]]
binding    = "CAMP_KV"
id         = "paste-your-namespace-id-here"
preview_id = "paste-your-namespace-id-here"   # can use same ID for both
```

---

## Step 3 — Log in to Cloudflare via Wrangler

```bash
wrangler login
```

A browser window will open. Approve the access.

---

## Step 4 — Deploy

```bash
wrangler pages deploy dist --project-name=acfc-camp-checkin
```

On first run Wrangler will ask you to create the project — say yes.

After deploy you'll get a URL like:
`https://acfc-camp-checkin.pages.dev`

Your two apps will be live at:
- `https://acfc-camp-checkin.pages.dev/shine.html`
- `https://acfc-camp-checkin.pages.dev/launch.html`

---

## Step 5 — Bind the KV namespace to your Pages project

This connects your database to the deployed app.

1. **Cloudflare Dashboard → Workers & Pages → acfc-camp-checkin**
2. Click **Settings → Functions → KV namespace bindings**
3. Click **Add binding**
   - Variable name: `CAMP_KV`
   - KV namespace: `camp-kv`
4. Click **Save**
5. **Re-deploy** (either push a change or click Deploy again in the dashboard)

---

## Step 6 — Set a custom domain (optional but recommended)

1. **Dashboard → acfc-camp-checkin → Custom domains**
2. Add something like `camp.acatalyst4changetx.org`
3. Cloudflare handles the SSL automatically

Your apps become:
- `https://camp.acatalyst4changetx.org/shine.html`
- `https://camp.acatalyst4changetx.org/launch.html`

---

## Step 7 — Add to Homescreen (PWA)

### iPhone / iPad (Safari)
1. Open the app URL in Safari
2. Tap the **Share** button (box with arrow)
3. Scroll down → **Add to Home Screen**
4. Name it "Shine Squad" or "Launch Pad" → tap **Add**

### Android (Chrome)
1. Open the URL in Chrome
2. Tap the **three-dot menu**
3. Tap **Add to Home screen**

The app opens full-screen (no browser UI) just like a native app.

---

## Local development

To run locally with hot reload (uses localStorage instead of KV):

```bash
# Shine Squad (opens at http://localhost:5173/shine.html)
npm run dev:shine

# Launch Pad (opens at http://localhost:5174/launch.html)
npm run dev:launch
```

---

## Updating the app

After making changes to `src/`:

```bash
npm run build
wrangler pages deploy dist --project-name=acfc-camp-checkin
```

Or connect the project to a GitHub repo in the Cloudflare dashboard
and it will auto-deploy on every push.

---

## Project structure

```
camp-app/
├── src/
│   ├── storage.js          ← storage layer (KV in prod, localStorage in dev)
│   ├── shine/
│   │   ├── main.jsx        ← React entry point
│   │   └── App.jsx         ← Shine Squad app
│   └── launch/
│       ├── main.jsx
│       └── App.jsx         ← Launch Pad app
├── functions/
│   └── api/kv/[key].js     ← Cloudflare Pages Function (KV API)
├── public/
│   ├── shine/manifest.json ← PWA manifest
│   └── launch/manifest.json
├── shine.html              ← Shine Squad HTML entry
├── launch.html             ← Launch Pad HTML entry
├── vite.config.js
├── wrangler.toml           ← Cloudflare config (add your KV ID here)
└── package.json
```

---

## Cloudflare free tier limits

| Resource | Free limit | Your expected usage |
|----------|-----------|---------------------|
| Pages requests | 100K/day | ~1K/day for a camp |
| KV reads | 100K/day | ~5K/day |
| KV writes | 1K/day | ~500/day |
| Bandwidth | Unlimited | — |

You will not hit any limits during normal camp operation.

---

## Admin PIN

The default PIN for the Admin (Database) tab is **1234**.
Change it from inside the app after your first login.
Each app (Shine Squad / Launch Pad) has its own independent PIN and database.
