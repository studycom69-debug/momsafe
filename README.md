# MomSafe AI

Pregnancy support application with a Vite frontend workspace and Supabase-backed features.

## Local Setup

1. Install dependencies:
   - `pnpm install`
2. Create your local environment file:
   - copy `artifacts/momsafe-ai/.env.example` to `artifacts/momsafe-ai/.env`
3. Fill your own values in `artifacts/momsafe-ai/.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Run the app:
   - `pnpm run dev`
5. Open:
   - `http://localhost:3000/`

## Security Notes

- Never commit `.env` files or private keys.
- Use only placeholder values in `.env.example`.
- Rotate keys immediately if a secret is ever exposed.
- See `SECURITY.md` for full policy.
