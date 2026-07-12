# ACFC Camp Check-In · Cloudflare Direct Upload

Two steps. No CLI, no build process.

─────────────────────────────────────────────────────────
STEP 1 — Upload static files to Cloudflare Pages
─────────────────────────────────────────────────────────

1. Go to dash.cloudflare.com
2. Left sidebar → Workers & Pages → Create application
3. Click the Pages tab → Upload assets
4. Name your project (e.g. acfc-camp-checkin)
5. Upload THIS zip file
6. Click Deploy site

Your hub page is live immediately at:
  https://acfc-camp-checkin.pages.dev/

The apps work right now using each device's local storage.
If you only use ONE device per camp, you're done.

─────────────────────────────────────────────────────────
STEP 2 — Add shared database (for multiple devices)
─────────────────────────────────────────────────────────

This syncs data between all staff phones and tablets.

── 2a. Create a KV namespace ──

1. Cloudflare dashboard → Workers & Pages → KV
2. Create namespace → name it camp-kv → Add

── 2b. Create the Worker ──

1. Left sidebar → Workers & Pages → Create application
2. Click the Workers tab → Create Worker
3. Name it camp-api → Deploy
4. Click "Edit code"
5. Delete all the default code
6. Open camp-worker.js from this zip → copy the entire file
7. Paste it into the editor → click Save and deploy
8. Note your worker URL: https://camp-api.YOUR-NAME.workers.dev

── 2c. Bind KV to the Worker ──

1. In the camp-api Worker → Settings → Bindings
2. Add binding → KV Namespace
   Variable name:  CAMP_KV
   KV namespace:   camp-kv
3. Save and deploy again

── 2d. Connect the apps to the Worker ──

Open shine.html from this zip in any text editor.
Find this line (near the bottom of <head>):

  window.CAMP_API = '';

Change it to your worker URL:

  window.CAMP_API = 'https://camp-api.YOUR-NAME.workers.dev';

Do the same for launch.html.

── 2e. Re-upload the two updated HTML files ──

1. Your Pages project → Deployments → Create new deployment
2. Upload JUST the two updated files:  shine.html  launch.html
3. Deploy

All devices now share the same live database.

─────────────────────────────────────────────────────────
YOUR URLS
─────────────────────────────────────────────────────────

  yourproject.pages.dev/         Hub — staff choose camp
  yourproject.pages.dev/shine    Shine Squad Check-In
  yourproject.pages.dev/launch   Launch Pad Check-In

─────────────────────────────────────────────────────────
ADD TO HOMESCREEN (PWA)
─────────────────────────────────────────────────────────

iPhone/iPad:  Safari → Share → Add to Home Screen
Android:      Chrome → Menu (⋮) → Add to Home screen

Opens full-screen, no browser bar, like a native app.

─────────────────────────────────────────────────────────
ADMIN PIN
─────────────────────────────────────────────────────────

Default PIN: 1234
Change it inside either app after first login.
Shine Squad and Launch Pad have independent PINs and data.

─────────────────────────────────────────────────────────
CUSTOM DOMAIN (optional)
─────────────────────────────────────────────────────────

Pages project → Custom domains → Add camp.acatalyst4changetx.org
Cloudflare sets up SSL automatically. Free.
