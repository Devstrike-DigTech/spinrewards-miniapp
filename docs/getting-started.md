# Getting Started — Spin Rewards Mini App

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | Use [nvm](https://github.com/nvm-sh/nvm) |
| npm | 9+ | Comes with Node |
| Telegram account | Any | To test the Mini App |
| A Telegram Bot | — | With Mini App configured via BotFather |
| ngrok (optional) | Any | For testing real Telegram auth locally |

---

## Step 1 — Configure the Mini App in BotFather

If you haven't done this yet:

1. Open Telegram → [@BotFather](https://t.me/BotFather)
2. Send `/newapp`
3. Select your bot
4. Enter a title (e.g., `Spin Rewards`)
5. Send a description (e.g., `Spin to win real cash prizes`)
6. Upload a 640×360 photo (placeholder is fine for now)
7. Set the Web App URL — use your deployed URL or a local tunnel URL (see Step 4)

BotFather gives you a short link like `https://t.me/SpinRewardsBot/app`. Tapping this opens the Mini App inside Telegram.

---

## Step 2 — Clone and install

```bash
git clone <your-repo-url>
cd spinrewards-miniapp
npm install
```

---

## Step 3 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and set:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

For a deployed backend:
```env
VITE_API_BASE_URL=https://api.spinrewards.com/api/v1
```

---

## Step 4 — Start the dev server

```bash
npm run dev
```

The app starts at `http://localhost:5173`.

---

## Step 5 — Test inside Telegram (with ngrok)

Telegram only allows Mini Apps to load from HTTPS URLs. For local development you need a tunnel.

### Install ngrok

```bash
brew install ngrok     # macOS
# or download from https://ngrok.com
```

### Start the tunnel

```bash
ngrok http 5173
```

ngrok gives you a URL like `https://abc123.ngrok-free.app`.

### Update BotFather

1. Send `/myapps` to BotFather
2. Select your app
3. Choose **Edit Web App URL**
4. Paste the ngrok URL

Now open your bot in Telegram and tap the Mini App button. You'll see your local dev server running inside Telegram with real `initData` for auth.

> Re-paste the ngrok URL into BotFather every time you restart ngrok (the URL changes on each restart unless you have a paid plan with a fixed domain).

---

## Development Workflow

### Hot reload

Vite's dev server supports hot module replacement. File saves reflect instantly in the browser — no manual refresh needed.

### Type checking

```bash
npm run typecheck
```

Run before committing to catch type errors without a full build.

### Building

```bash
npm run build
```

Compiles TypeScript and bundles to `dist/`. Preview the production build:

```bash
npm run preview
```

---

## Developing outside Telegram

The Telegram WebApp SDK (`window.Telegram.WebApp`) is only populated when the app is opened inside Telegram. Running directly in the browser means `initData` is empty, so authentication will fail.

Workarounds during development:

1. **Always use ngrok + Telegram** — most accurate, tests real auth.
2. **Mock auth** — temporarily bypass auth in `useAuth.ts` and hard-code a test user (never commit this).
3. **Point to a deployed backend with a test token** — manually set `tokens` in `localStorage` under the key `spinrewards-auth`.

---

## Connecting to the backend

The Mini App fetches all data from the backend via `src/api/endpoints.ts`. On first open:

1. `useAuth` reads `initData` from the Telegram SDK
2. Posts to `POST /auth/telegram/` with the raw `initData` string
3. Backend validates the HMAC signature and returns JWT tokens
4. Tokens are stored in `localStorage` via Zustand's `persist` middleware
5. Subsequent opens restore the token from storage and skip re-auth (until expiry)

If the token is expired, the Axios interceptor in `src/api/client.ts` auto-refreshes it using the stored refresh token.

---

## Next Steps

- [Environment Variables](./environment-variables.md)
- [Architecture](./architecture.md)
- [Deployment](./deployment.md)
