# Kandidatexamensarbete Signup Sheet

Pink/cute booking website with:
- Public **Booking** page (name + email + time selection)
- Password-protected **Admin** page (email/password login)
- Slot capacity support (you choose how many people can book each slot)
- Supabase database (Postgres + Auth)
- GitHub Pages deployment from GitHub Actions

## 1. Local setup

```bash
npm install
cp .env.example .env
```

Fill `.env` with your Supabase project values:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Start locally:

```bash
npm run dev
```

## 2. Supabase database setup

1. Create a new Supabase project.
2. Open SQL Editor and run [`supabase/schema.sql`](/Users/ebbalanyuan/kandidatexamensarbete-booking/supabase/schema.sql).
3. In Supabase Auth, create two users (you and Vanessa) with email + password.
4. Add those users as admins:

```sql
insert into public.admin_users (user_id)
values
  ('YOUR_USER_UUID_1'),
  ('YOUR_USER_UUID_2');
```

How to get user UUIDs:
- Supabase Dashboard -> Authentication -> Users -> copy each user `id`

## 3. GitHub deployment (Pages)

1. Create a new GitHub repository.
2. Push this project to `main`.
3. In GitHub repo settings, add Actions secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. In **Settings -> Pages**, set source to **GitHub Actions**.
5. Push to `main` and wait for workflow `Deploy to GitHub Pages` to finish.

Your site URL will be:
- `https://<your-github-username>.github.io/<repo-name>/`

## Notes

- Booking users only submit name + email; they do not need accounts.
- Admin login is only for users added in `admin_users`.
- Capacity is enforced in the database, so overbooking is blocked.
