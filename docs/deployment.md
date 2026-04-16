# Deployment Guide — Spin Rewards Mini App

The Mini App is a static site (HTML + JS + CSS after `npm run build`). It requires no server — only a CDN or static host. **Vercel** is the recommended deployment target.

---

## Vercel (Recommended)

### Step 1 — Push to GitHub

```bash
cd spinrewards-miniapp
git init
git add .
git commit -m "chore: initial mini app setup"
git remote add origin <your-github-repo-url>
git push -u origin main
```

---

### Step 2 — Import to Vercel

1. Go to [vercel.com](https://vercel.com) and log in
2. Click **Add New → Project**
3. Import your GitHub repository
4. Vercel auto-detects Vite — no framework config needed
5. Under **Environment Variables**, add:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://api.spinrewards.com/api/v1` |

6. Click **Deploy**

Vercel builds with `npm run build` and serves the `dist/` folder. Every push to `main` triggers a new deployment automatically.

---

### Step 3 — Set a custom domain (optional)

1. In Vercel → your project → **Settings → Domains**
2. Add your domain, e.g. `app.spinrewards.com`
3. Vercel gives you DNS records to add in Cloudflare (or your registrar)

In Cloudflare:
- Add a `CNAME` record: `app` → `cname.vercel-dns.com`
- Set proxy status to **DNS only** (grey cloud) — Vercel handles TLS

---

### Step 4 — Register the URL with BotFather

Once you have a live URL (Vercel domain or custom domain):

1. Open Telegram → [@BotFather](https://t.me/BotFather)
2. Send `/myapps`
3. Select your app
4. Choose **Edit Web App URL**
5. Paste your Vercel URL: `https://app.spinrewards.com`

Users who tap the Mini App button in your Telegram bot will now load the production build.

---

### Step 5 — Verify

Open Telegram → find your bot → tap the Mini App button. The app should load, authenticate via `initData`, and display the spin wheel.

Check the browser console (via Telegram's debug mode or Eruda) if anything fails.

---

## Preview Deployments

Vercel creates a unique preview URL for every pull request. To test a feature branch inside Telegram:

1. Push your branch to GitHub — Vercel auto-deploys it
2. Copy the preview URL (e.g., `https://spinrewards-miniapp-git-feature-xyz.vercel.app`)
3. Temporarily update BotFather's Web App URL to the preview URL
4. Test in Telegram
5. Restore the production URL in BotFather when done

---

## Docker / Self-hosted

If you prefer self-hosting, the included `Dockerfile` builds a multi-stage image (Node.js build → Nginx serve):

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://api.spinrewards.com/api/v1 \
  -t spinrewards-miniapp .

docker run -d \
  --name spinrewards-miniapp \
  --restart unless-stopped \
  -p 80:80 \
  spinrewards-miniapp
```

Put Nginx or Caddy in front for HTTPS (Telegram requires it):

```bash
# Caddy — automatic TLS
caddy reverse-proxy --from app.spinrewards.com --to localhost:80
```

---

## Environment Checklist (Pre-deploy)

- [ ] `VITE_API_BASE_URL` points to the production backend
- [ ] Backend CORS allows the Mini App's domain
- [ ] BotFather Web App URL is updated to the production URL
- [ ] Opening the bot in Telegram loads the app correctly
- [ ] Auth flow completes (spin wheel is visible after load)
- [ ] Spin button reaches the backend and animates correctly

---

## CORS Note

The Django backend must allow requests from the Mini App's domain. In `spinrewards-backend/config/settings/production.py`:

```python
CORS_ALLOWED_ORIGINS = [
    "https://app.spinrewards.com",
]
```

Without this, all API calls from the Mini App will be blocked by the browser.
