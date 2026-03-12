# Kandidatexamensarbete Signup Sheet

Pink/cute booking website with:
- Public **Booking** page (name + email + time selection)
- Password-only **Admin** page (`admin`)
- Slot capacity support
- CouchDB on OSAAS as database
- GitHub Pages deployment from GitHub Actions

## Current CouchDB target

This app is configured to use your existing OSAAS instance by default:
- URL: `https://ebba-pageturnercouch.apache-couchdb.auto.prod.osaas.io`
- Database: `kandidatebooking`

No Supabase is used anymore.

## 1. Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Optional environment overrides in `.env`:
- `VITE_COUCHDB_URL`
- `VITE_COUCHDB_DB`

## 2. OSAAS CouchDB setup

Already configured by me on your instance:
- Database `kandidatebooking` created
- DB security opened for browser access
- CORS enabled for GitHub Pages/browser requests

If you ever need to recreate this, update [couchdb.js](/Users/ebbalanyuan/kandidatexamensarbete-booking/src/lib/couchdb.js) defaults or set env vars.

## 3. Admin login

- Admin page uses one local password: `admin`
- This is intentionally simple and suitable for project/demo use

## 4. GitHub deploy

1. Push to `main`
2. GitHub Action deploys automatically to Pages

Site URL:
- `https://twomillionyuan.github.io/kandidatexamensarbete-booking/`
