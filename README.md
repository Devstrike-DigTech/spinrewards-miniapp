# Spin Rewards — Mini App

The Telegram Mini App for the Spin Rewards platform. Built with React, PixiJS, and GSAP.

---

## What This Service Does

The Mini App is the **primary game interface**. It runs inside Telegram's WebView and handles:

- Authenticating the user via Telegram's `initData` (HMAC-validated by the backend)
- The spin game — PixiJS-rendered wheel with GSAP-animated spins
- Wallet display (coin balance + withdrawable cash)
- Withdrawal requests (KYC-gated)
- Referral link sharing
- Deep link referral code capture on first open

The Mini App does **not** calculate spin outcomes, modify balances, or store any financial state. All of that lives in the backend.

---

## Stack

| Component | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| Framework | React 18 |
| Bundler | Vite 5 |
| Rendering engine | PixiJS v8 (WebGL) |
| Animation | GSAP 3 |
| State | Zustand |
| Routing | React Router v6 |
| HTTP client | Axios |
| Telegram SDK | @twa-dev/sdk |
| Styling | CSS Modules + CSS variables |

---

## Quick Start

### Requirements

- Node.js 20+
- The backend API running (locally or deployed)
- A Telegram bot with a Mini App configured (see [Getting Started](docs/getting-started.md))

### 1. Install

```bash
cd spinrewards-miniapp
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Set `VITE_API_BASE_URL` to your backend URL.

### 3. Run

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

> The Telegram WebApp SDK is loaded from Telegram's CDN. Outside of Telegram, `initData` will be empty and auth will fail. Use a local tunnel (ngrok) and open via Telegram to develop with real auth.

---

## Project Structure

```
spinrewards-miniapp/
├── src/
│   ├── main.tsx                    # React root, BrowserRouter
│   ├── App.tsx                     # Auth gate + route shell
│   ├── App.module.css
│   ├── api/
│   │   ├── client.ts               # Axios instances, JWT auto-refresh
│   │   └── endpoints.ts            # Typed functions for every API call
│   ├── store/
│   │   ├── authStore.ts            # User + tokens (persisted to localStorage)
│   │   └── walletStore.ts          # Coin + cash balance (in-memory)
│   ├── hooks/
│   │   ├── useTelegram.ts          # WebApp SDK wrapper (expand, haptic, initData)
│   │   └── useAuth.ts              # Auth flow: token restore → re-auth on mount
│   ├── components/
│   │   ├── SpinWheel/
│   │   │   ├── spinEngine.ts       # PixiJS Application + GSAP spin logic (no React)
│   │   │   ├── SpinWheel.tsx       # React wrapper — mounts canvas, owns lifecycle
│   │   │   └── SpinWheel.module.css
│   │   └── BottomNav/              # Tab bar (Spin / Wallet / Invite)
│   ├── pages/
│   │   ├── LoadingScreen           # Shown while auth resolves
│   │   ├── SpinPage                # Main game: stake selector, wheel, result
│   │   ├── WalletPage              # Balances, KYC status, withdrawal history
│   │   └── InvitePage              # Referral link + copy/share actions
│   ├── types/
│   │   └── index.ts                # All API response/request types
│   └── styles/
│       └── globals.css             # Design tokens (CSS variables), resets
├── docs/                           # Developer documentation
├── Dockerfile                      # Multi-stage: build → nginx
├── nginx.conf                      # SPA fallback config
├── .env.example
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Pages

| Route | Component | Description |
|---|---|---|
| `/` | `SpinPage` | Spin wheel, stake selector, result display |
| `/wallet` | `WalletPage` | Coin + cash balances, withdrawal history, KYC gate |
| `/invite` | `InvitePage` | Referral stats, copy link, Telegram share |

---

## Spin Flow

```
User taps SPIN
  → POST /spin/ { stake_amount, idempotency_key }
  → Backend validates, runs RNG, debits stake, credits win
  → Returns { label, multiplier, coin_won, cash_won }
  → Mini App calls spinEngine.spinTo(segmentIndex)
  → GSAP animates wheel (5–8 full rotations) landing on correct segment
  → Result card shown, balance refreshed
```

The backend owns the outcome. The Mini App only animates to the result it is told.

---

## Notifications

The Mini App does not receive push notifications directly. The Telegram Bot handles all push messaging. The Mini App can refresh its own data on focus via `WebApp.onEvent('activated', ...)` if needed.

---

## Environment Variables

See [`docs/environment-variables.md`](docs/environment-variables.md).

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/getting-started.md`](docs/getting-started.md) | BotFather Mini App setup, local tunnel, dev workflow |
| [`docs/environment-variables.md`](docs/environment-variables.md) | All env variables |
| [`docs/architecture.md`](docs/architecture.md) | Auth flow, PixiJS/GSAP design, state management, design tokens |
| [`docs/deployment.md`](docs/deployment.md) | Vercel deployment, custom domain, BotFather URL update |

---

## Scripts

```bash
npm run dev        # Start dev server on port 5173
npm run build      # Type-check + compile to dist/
npm run preview    # Preview production build locally
npm run typecheck  # Type-check without building
```
