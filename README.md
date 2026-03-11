# Kandidatexamensarbete Signup Sheet

Pink/cute booking website with:
- Public **Booking** page (name + email + time selection)
- Password-only **Admin** page
- Slot capacity support (you choose how many people can book each slot)
- Supabase database (Postgres + Auth)
- GitHub Pages deployment from GitHub Actions

## 1. Local setup

```bash
npm install
cp .env.example .env
```

Fill `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Optional: `VITE_ADMIN_EMAIL` (default is `admin@kandidatexamensarbete.local`)

Run locally:

```bash
npm run dev
```

## 2. Supabase setup

1. Create a Supabase project.
2. In SQL Editor, run [`supabase/schema.sql`](/Users/ebbalanyuan/kandidatexamensarbete-booking/supabase/schema.sql).
3. In Auth -> Users, create **one admin user**:
   - Email: `admin@kandidatexamensarbete.local` (or your `VITE_ADMIN_EMAIL` value)
   - Password: `admin`

After this, the Admin page login requires only the password field (`admin`).

## 3. GitHub Pages deploy

1. Push repo to GitHub `main`.
2. Add repo secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Optional `VITE_ADMIN_EMAIL`
3. In Settings -> Pages, source = **GitHub Actions**.
4. Trigger deploy workflow.

Site URL:
- `https://<your-github-username>.github.io/<repo-name>/`

## Notes

- Booking users do not need accounts.
- Capacity is enforced in the database so overbooking is blocked.
- `admin` is intentionally weak and only suitable for demos; change it for real use.
