# Environment Variables Reference

All variables are loaded from `.env` in the project root.
Copy `.env.example` to `.env` — never commit the real `.env`.

Vite only exposes variables prefixed with `VITE_` to the browser bundle. Do not put secrets here.

---

## API

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Backend API base URL including `/api/v1`. e.g., `https://api.spinrewards.com/api/v1` |

---

## Example `.env` for Local Development

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Example `.env` for Production

```env
VITE_API_BASE_URL=https://api.spinrewards.com/api/v1
```

---

## Notes

- There is intentionally only one variable. The Mini App is a pure frontend — it has no secrets, no server-side logic, and no private keys.
- The Telegram Bot Token, payment keys, and all secrets live in the backend and bot services only.
- If you add feature flags or analytics in future, prefix them with `VITE_` and document them here.

---

## Vercel deployment

When deploying to Vercel, set environment variables in **Project Settings → Environment Variables**. Vercel injects them at build time — they do not need to be in `.env` on the server.

| Variable | Environment | Value |
|---|---|---|
| `VITE_API_BASE_URL` | Production | `https://api.spinrewards.com/api/v1` |
| `VITE_API_BASE_URL` | Preview | `https://api-staging.spinrewards.com/api/v1` (if you have one) |
