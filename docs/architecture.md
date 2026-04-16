# Architecture Overview

## Role in the System

```
User (Telegram)
      │
      │  taps Mini App button
      ▼
Telegram Mini App  ──────────────────────▶  Backend API
  (this service)                              (Django)
  React + PixiJS                               │
      │                                        │  validates initData
      │  POST /auth/telegram/                  │  runs spin RNG
      │  POST /spin/                           │  credits wallet
      │  GET /wallet/                          │  handles payments
      ▼                                        │
  localStorage                     ◀───────────
  (JWT tokens)
```

The Mini App is a **thin display and input layer**. It:
- Authenticates the user once via Telegram's `initData`
- Sends user actions (spin, withdraw) to the backend
- Displays data returned by the backend
- Animates outcomes it is told about (never calculates them)

It does **not** contain any business logic, wallet state, RNG, or financial operations.

---

## Authentication Flow

```
User opens Mini App
  → Telegram SDK populates window.Telegram.WebApp.initData
  → useAuth hook runs on mount
  → Checks localStorage for existing tokens
      → If found: GET /users/me/ to validate
          → Success: user restored, no re-auth needed
          → Failure (expired): fall through to re-auth
      → If not found: POST /auth/telegram/ { init_data }
          → Backend validates HMAC-SHA256 of initData
          → Returns { user, tokens: { access, refresh } }
          → Tokens stored in localStorage via Zustand persist
  → App renders authenticated state
```

Tokens survive app close/reopen. On expiry, `client.ts` auto-refreshes via `POST /auth/token/refresh/` and retries the original request transparently.

---

## Spin Flow

```
User selects stake → taps SPIN
  → POST /spin/ { stake_amount, idempotency_key }
      idempotency_key = "{userId}-{timestamp}" — prevents duplicate spins on retry
  → Backend:
      1. Checks idempotency_key (no double-spin)
      2. Selects RTP tier for stake amount
      3. Validates outcome probabilities sum to 100%
      4. Debits stake from coin wallet (atomic)
      5. Runs secrets.randbelow() RNG
      6. Maps RNG value to outcome via cumulative probability
      7. Credits win to wallet (atomic)
      8. Returns { label, multiplier, coin_won, cash_won }
  → Mini App finds segment index matching returned label
  → spinEngine.spinTo(index) triggers GSAP animation
  → Wheel decelerates and lands on correct segment
  → Result card shown
  → Wallet balance refreshed via GET /wallet/
```

**The backend decides the outcome. The Mini App only animates.**

---

## Rendering Architecture — PixiJS + GSAP

```
SpinPage (React)
  │
  ├── manages: stake, spinState, lastResult (React state)
  ├── calls:   spinEngine.spinTo(index) on API response
  │
  └── SpinWheel (React component)
        │
        └── SpinEngine (plain class, no React)
              │
              ├── pixi.Application    — WebGL canvas, render loop
              ├── Container           — wheel group (rotates as one unit)
              ├── Graphics            — segment slices, borders, cap
              ├── Text                — multiplier labels per segment
              └── gsap.to(container)  — rotation animation with power4.out easing
```

### Why PixiJS is a plain class, not a hook

PixiJS manages its own render loop and WebGL context. Putting it inside React's render cycle would cause the context to be recreated on every re-render. The `SpinEngine` class owns the canvas lifecycle — `SpinWheel.tsx` mounts it once in `useEffect` and only calls methods on it (never recreates it).

### Why GSAP for animation

GSAP runs outside React's state entirely. It mutates the PixiJS container's `rotation` property directly on each animation frame. This avoids triggering React re-renders during the spin animation — the wheel animates at 60fps without React being involved at all.

### Segment-to-outcome mapping

The wheel segments are loaded from `GET /spin/tiers/` on mount. The backend returns `RTPOutcome[]` with labels and colors. When a spin result comes back, the Mini App finds the segment whose `label` matches `result.label` and calls `spinTo(index)`. The wheel lands on that segment.

---

## State Management

| Store | Persistence | Contents |
|---|---|---|
| `authStore` | `localStorage` | `user`, `tokens` (access + refresh) |
| `walletStore` | In-memory | `coinBalance`, `cashBalance` |

Wallet balance is **never** stored persistently — it is always fetched fresh from the backend. This prevents stale balance display.

---

## Design Tokens

All colours, radii, and transitions are CSS custom properties defined in `src/styles/globals.css`:

```css
:root {
  --color-bg-primary: #0a0a1a;
  --color-accent-purple: #6c3de8;
  --color-accent-pink: #e83d8a;
  /* ... */
}
```

When the UI designer delivers the final design system, update these variables. All components reference only the tokens — no raw hex values in component CSS. A full theme swap is a one-file change.

---

## Haptic Feedback

Telegram's `HapticFeedback` API is used at key moments:

| Event | Haptic type |
|---|---|
| Spin button tap | `impactOccurred('medium')` |
| Win result | `notificationOccurred('success')` |
| Try again result | `notificationOccurred('warning')` |
| API error | `notificationOccurred('error')` |

Haptics only fire when the app is opened inside Telegram. In browser, the calls are no-ops.

---

## What the Mini App Must Never Do

- Generate or influence spin outcomes
- Calculate wallet balances locally
- Trust locally stored amounts when submitting financial requests
- Store the backend URL or any secret in environment variables prefixed without `VITE_`
- Make payments directly — all payment initiation goes through the backend
