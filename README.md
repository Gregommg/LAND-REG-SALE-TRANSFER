# Land Registration, Sale & Transfer Management System

A full-stack implementation of the system proposed in *"Land Registration, Sale & Transfer System Proposal"* (Okello Gregory Mark, DCS-02-0029/2025, Zetech University). It provides a centralized digital platform for registering land ownership, searching land records, and processing land sale and transfer transactions, with identity-verified accounts, RBAC, a payment-confirmation workflow, encrypted private messaging, and a full audit trail.

## Tech Stack

| Layer      | Technology                                         |
|------------|-----------------------------------------------------|
| Frontend   | React 18, React Router 6, Axios, Vite, plain CSS (external stylesheets) |
| Backend    | Node.js, Express 4, Multer (file uploads)            |
| Database   | PostgreSQL                                          |
| Auth       | JSON Web Tokens (JWT), bcrypt password hashing       |
| Security   | Helmet, CORS, rate limiting, AES-256-GCM message encryption, role-based access control (RBAC) |

## Project Structure

```
land-registration-system/
├── backend/
│   ├── config/db.js              PostgreSQL connection pool
│   ├── controllers/              Route handlers (auth, land, transactions, users, audit, messages)
│   ├── middleware/                JWT auth, RBAC, file upload (multer), error handling
│   ├── routes/                    Express route definitions
│   ├── database/schema.sql        Full DDL + seed data
│   ├── database/initDb.js         Script that runs schema.sql
│   ├── uploads/                   Uploaded photos, ID documents, title deeds (gitignored)
│   ├── utils/                     Token generation, audit logger, message encryption
│   ├── server.js                  App entry point
│   ├── .env.example / .env        Environment configuration
│   └── package.json
├── frontend/
│   ├── public/                    manifest.json, service worker, icons (PWA install support)
│   ├── src/
│   │   ├── api/                   Axios instance + service functions
│   │   ├── components/            Navbar, Sidebar, Layout, ProtectedRoute, InstallAppButton, etc.
│   │   ├── context/                AuthContext, ThemeContext (dark/light mode)
│   │   ├── pages/                 Login, Register, Dashboard, LandSearch, LandRegistration, LandApprovals, Transactions, TitleDeed, Profile, Messages, AdminUsers, AuditLogs
│   │   ├── styles/                External CSS files (one per component/page)
│   │   ├── App.jsx                Routes
│   │   └── main.jsx                Entry point + service worker registration
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## Core Modules

1. **One citizen account for everything** — there is no landowner/buyer/seller role to pick at sign-up. Everyone registers as a plain `citizen` and can register land, buy, and sell — ownership, not account role, decides who can do what. `admin`, `registrar`, and `auditor` are internal staff roles created by an admin, never through public sign-up. **Staff accounts can never buy or receive land** — only citizens can end up owning a parcel.
2. **Identity-verified registration** — sign-up requires full name, email, a **unique phone number**, national ID, a passport-size photo, and a PDF of the applicant's National ID or passport. No two accounts may ever share the same email, phone number, or national ID. The account starts at `verification_status = 'pending'` and **cannot log in** until an admin/registrar reviews the documents and approves it from **User Management**. The ID document is never served publicly — only through an authenticated, access-controlled endpoint.
3. **Land Registration (self-service + approval)** — any verified citizen can submit a land registration request for their own name, including geo-location (latitude/longitude) and a **required PDF of the title deed** as proof of ownership. Registrars/admins can register a parcel directly (immediately active, title deed optional), but everyone else's request stays `pending` until a registrar approves or rejects it from **Pending Registrations** (where the uploaded title deed can be reviewed before deciding).
4. **Land Search** — search active records, filter by status, view a parcel's full **transfer history**, jump to its **geo-location on Google Maps**, and generate/print an official-looking **Title Deed** certificate (always reflects the current owner, since it's rendered live from the database rather than a static file).
5. **Listing, buying, and selling (ownership-based, not role-based)** — an owner lists a parcel **for sale** with an asking price, making it publicly purchasable by any other citizen ("Buy Now"); the owner can also **privately sell or transfer** to a specific person, including a no-money **transfer** (e.g. gifting land to a relative — no payment method or amount required). A parcel that's already been sold can only be re-sold by whoever now owns it — the previous owner loses all rights over it, and every transaction it's ever been part of stays visible in its history.
6. **Payment workflow** — a sale must specify **bank transfer** or **cash**. Once initiated, buyer and seller can see each other's contact details (from the transaction's details view) to arrange payment directly — there's no real payment gateway involved. A registrar **cannot finalize a sale** until the seller explicitly confirms they've received the money; a transfer skips this step entirely since no money is involved.
7. **Encrypted private messaging** — any two users can message each other one-to-one (e.g. to negotiate a sale) from the **Messages** page or directly from a transaction's details. Message content is encrypted at rest with AES-256-GCM — see the security note below on what that does and doesn't protect against.
8. **Profile & appearance** — every user can view their account details and update their profile photo at any time from **My Profile**. A sun/moon toggle in the top bar switches between light and dark mode (persisted per-browser). On phones/small screens, the top bar and sidebar switch to a yellowish theme so the app is instantly recognizable as "mobile mode" — pure CSS, no separate build.
9. **Installable as an app** — a "Download App" button appears in the sidebar (on browsers that support it, e.g. Chrome/Edge) using the standard web app install prompt, backed by a manifest and minimal service worker.
10. **Audit Logging** — every sensitive action (login, registration, identity verification decisions, parcel changes, listing/unlisting, transaction and payment decisions, user management, ID/title-deed document views, messages sent) is written to `audit_logs` for traceability. See "Adding your own audit log entries" below if you want to extend this yourself.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 13+ running locally or accessible remotely

## 1. Database Setup

Create the database (the app expects it to already exist; the schema script only creates tables inside it):

```bash
psql -U postgres -c "CREATE DATABASE land_registration_db;"
```

The backend is pre-configured to connect as user `postgres` with password `123456` (see `backend/.env`). Update these values if your local PostgreSQL uses different credentials.

**Important:** every time you pull an updated version of this project, re-run `npm run init-db` (step 2 below) before starting the server. The schema has changed several times as features were added (new enum values, new columns, new tables) — if your live database still has an older shape, queries referencing the new columns/values will fail with a real Postgres error (e.g. `invalid input value for enum parcel_status: "pending"`), which is exactly what causes a generic "Failed to load land records" error in the UI. `npm run init-db` drops and recreates everything from scratch, so it's always safe to re-run in development.

## 2. Backend Setup

```bash
cd backend
npm install
npm run init-db     # creates tables and inserts demo data - see note above
npm run dev          # starts the API on http://localhost:5000 (nodemon)
# or: npm start
```

Health check: `GET http://localhost:5000/api/health`

Uploaded files are written to `backend/uploads/{photos,documents,title-deeds}` (created automatically on boot). Profile photos are served publicly at `/uploads/photos/...`; ID documents and title deed PDFs are **never** served statically — they only leave the server via their authenticated controller routes.

### Demo accounts (seeded by `npm run init-db`)

All demo accounts use the password **`Password123!`**

| Email                              | Role      | Verification |
|-------------------------------------|-----------|--------------|
| admin@landregistry.go.ke            | admin     | approved     |
| registrar@landregistry.go.ke        | registrar | approved     |
| auditor@landregistry.go.ke          | auditor   | approved     |
| peter.mwangi@example.com            | citizen   | approved (owns a registered parcel + one listed for sale) |
| susan.achieng@example.com           | citizen   | approved     |
| james.otieno@example.com            | citizen   | **pending** — so the verification queue isn't empty on first login |

Peter and Susan also have a demo chat conversation pre-loaded, and the Kiambu parcel is already listed for sale so you can try the "Buy Now" flow immediately.

## 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev     # starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` and `/uploads/*` requests to `http://localhost:5000`, so no CORS configuration or extra setup is needed in development.

To build for production:

```bash
npm run build      # outputs static files to frontend/dist
npm run preview    # preview the production build locally
```

## API Overview

| Method | Endpoint                        | Access                         | Description                          |
|--------|----------------------------------|---------------------------------|---------------------------------------|
| POST   | `/api/auth/register`             | Public (multipart/form-data)    | Register as a citizen; requires `photo` + `idDocument` files, unique email/phone/national ID. No token returned - pending verification. |
| POST   | `/api/auth/login`                | Public                          | Login (blocked until verified & active) |
| GET    | `/api/auth/me`                   | Authenticated                   | Current user profile                  |
| PUT    | `/api/auth/me/photo`             | Authenticated (multipart)       | Update your own profile photo          |
| GET    | `/api/land`                      | Authenticated                   | Search/list land parcels              |
| GET    | `/api/land/:id`                  | Authenticated                   | Get a single parcel                   |
| GET    | `/api/land/:id/history`          | Authenticated                   | Full sale/transfer history for a parcel |
| GET    | `/api/land/:id/title-deed-document` | Owner or staff               | Stream the uploaded title deed PDF     |
| POST   | `/api/land`                      | Authenticated (multipart)       | Register a parcel (registrar/admin: immediate) or submit a registration request with title deed PDF (everyone else: pending approval) |
| PUT    | `/api/land/:id`                  | registrar, admin                | Update a parcel                       |
| PUT    | `/api/land/:id/approve`          | registrar, admin                | Approve a pending registration request |
| PUT    | `/api/land/:id/reject`           | registrar, admin                | Reject a pending registration request  |
| PUT    | `/api/land/:id/list`             | Owner (or staff)                | List a registered parcel for sale with an asking price |
| PUT    | `/api/land/:id/unlist`           | Owner (or staff)                | Withdraw a parcel from public sale (any time)     |
| DELETE | `/api/land/:id`                  | admin                           | Delete a parcel                       |
| GET    | `/api/transactions`              | Authenticated                   | List transactions (own, or all for staff) |
| POST   | `/api/transactions`               | Authenticated (citizens only as buyer) | Initiate a sale/transfer as the owner (names a buyer), or buy a `for_sale` parcel as any other citizen. Staff can never end up as the buyer. |
| PUT    | `/api/transactions/:id/confirm-payment` | Seller only                | Confirm you've received payment (bank transfer or cash) |
| PUT    | `/api/transactions/:id/approve`  | registrar, admin                | Approve and complete a transaction (sale requires payment already confirmed) |
| PUT    | `/api/transactions/:id/reject`   | registrar, admin                | Reject a transaction                   |
| GET    | `/api/users`                     | admin, registrar                | List all user accounts                |
| POST   | `/api/users`                      | admin                           | Create a staff account (auto-verified) |
| PUT    | `/api/users/:id/role`            | admin                           | Change a user's role                   |
| PUT    | `/api/users/:id/status`          | admin                           | Suspend/reactivate an already-verified account |
| PUT    | `/api/users/:id/verify`          | admin, registrar                | Approve or reject a citizen's pending identity verification |
| GET    | `/api/users/:id/id-document`     | admin, registrar, or the account owner | Stream the applicant's ID/passport PDF |
| GET    | `/api/audit-logs`                 | admin, auditor                  | View the audit trail                   |
| GET    | `/api/messages`                   | Authenticated                   | List your conversations (decrypted previews) |
| GET    | `/api/messages/:userId`           | Authenticated                   | Full decrypted conversation with a specific user |
| POST   | `/api/messages`                   | Authenticated                   | Send an encrypted message               |

## Adding your own audit log entries

The audit trail is deliberately simple so you can extend it from any controller:

```js
const { logAction } = require("../utils/auditLogger");

// userId (or null for system actions), a short action code, a human-readable
// detail string, and the request's IP address
await logAction(req.user.id, "MY_NEW_ACTION", "Did something worth remembering", req.ip);
```

That's it — `logAction` writes one row to the `audit_logs` table (see `backend/utils/auditLogger.js`; it swallows its own errors so a logging failure never breaks the actual request). To make new entries show up nicely in the **Audit Logs** page:

1. Pick a short, SCREAMING_SNAKE_CASE action code (e.g. `PARCEL_LIST_FOR_SALE`) - this is what gets stored and filtered on.
2. Call `logAction(...)` at the point in your controller where the action actually happens (after the database write succeeds, so the log matches reality).
3. Optionally add `<option value="MY_NEW_ACTION">My New Action</option>` to the filter dropdown in `frontend/src/pages/AuditLogs.jsx` so admins/auditors can filter by it specifically - if you skip this step the log entry still appears, it's just only visible under "All actions" rather than filterable on its own.

The page itself needs no other changes - `GET /api/audit-logs` already returns every row (optionally filtered by `userId`/`action` query params), newest first, joined with the acting user's name and email.

## Deploying to Render (for genuinely free, indefinitely)

This repo includes a `render.yaml` at the root that deploys the backend API and the static frontend together as a **Render Blueprint**.

**Read this part before you deploy — it saves you from a real trap.** Render's *own* free PostgreSQL database is auto-deleted 30 days after creation (14-day grace period to upgrade before your data is actually gone). For a land registry with real registrations, transactions, and uploaded documents, that's not a "maybe" — it's a guarantee you'll lose everything in a month unless you're paying attention. So `render.yaml` is set up to use an **external Postgres provider instead**, which is where the actual free-forever part comes from:

- **[Neon](https://neon.tech)** — recommended. Free tier never expires, no credit card required, 0.5 GB storage. It auto-suspends when idle and wakes up in under a second on the next query, which is a non-issue for this kind of app.

### One-time setup

1. **Create a free Neon project** at neon.tech. From its dashboard, grab the connection details: host, port (usually 5432), database name, username, and password (Neon also shows a full connection string — the pieces you need are all in there).
2. Push this repo to GitHub (Render deploys from a Git repo, not a local folder).
3. In the Render dashboard: **New → Blueprint**, connect the repo. Render reads `render.yaml` and will prompt you to fill in the values marked `sync: false`:
   - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — paste in the Neon values from step 1
   - `MESSAGE_ENCRYPTION_KEY` — generate one first with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
4. Once both services have deployed, Render will have assigned real `*.onrender.com` URLs. Go back into each service's **Environment** tab and replace the placeholder URLs with the real ones:
   - Backend service → `CLIENT_URL` → the frontend's actual URL
   - Frontend service → `VITE_API_BASE_URL` and `VITE_UPLOADS_BASE_URL` → the backend's actual URL + `/api` or `/uploads`
   - Redeploy both after updating (frontend needs a rebuild since `VITE_*` vars are baked in at build time, not read at runtime).
5. Initialize the database schema. In the backend service's **Shell** tab (or a one-off job), run:
   ```bash
   npm run init-db
   ```
   **This drops and recreates every table** - only ever run it once, right after the first deploy, before real users sign up. Re-running it later wipes all data (fine in development, destructive in production).

After that: visit the frontend URL, log in with a demo account (see below), and it should work exactly like it does locally — and unlike an all-Render setup, it'll still be there in two months.

**In a hurry / just doing a short class demo?** `render.yaml` has a commented-out block at the bottom for using Render's own free Postgres instead, which is one step simpler to set up — the trade-off is your data disappearing after 30 days if you forget about it. Instructions for switching are in the comments right there in the file.

### About Render's free web service tier specifically (separate from the database)

A few limits worth knowing, since they apply regardless of which database you use:
- **Cold starts**: free web services spin down after 15 minutes of no traffic, and take 30–60 seconds to wake back up on the next request. Your first visitor after a quiet period will see a slow load.
- **750 free instance-hours/month** per Render workspace, shared across all your free services. For one low-traffic app this is rarely an issue in practice, since spun-down time doesn't count against it.
- **No credit card required** to use any of this.

### About uploaded files (photos, ID documents, title deeds)

Separately from the database question: Render's free web service plan has **no persistent disk**, so uploaded files are **lost whenever the backend redeploys or restarts** — regardless of which database you're using. To fix that, either:
- **Add a persistent disk** — upgrade the backend service to the "Starter" plan or above, then uncomment the `disk:` block already sitting (commented out) in `render.yaml`, pointing at `backend/uploads`.
- **Move uploads to object storage** (S3, Cloudflare R2, Backblaze B2, etc.) — a bigger but more scalable change. Not implemented here, but the multer config in `backend/middleware/uploadMiddleware.js` is the only place that would need to change.

### Everything else (env vars, security notes, etc.)

See the sections below for the full environment variable reference and general production hardening notes (these apply regardless of which platform you deploy to).

## General Deployment Notes

- **Backend**: deploy as a standard Node.js service (e.g. Render, Railway, an EC2/VM with PM2, or a Docker container). Set real environment variables in production — especially `JWT_SECRET`, `DB_PASSWORD`, `MESSAGE_ENCRYPTION_KEY`, and `CLIENT_URL` (your deployed frontend origin). Make sure `backend/uploads/` is on persistent storage (or swap in S3/Cloud Storage) if you deploy somewhere with an ephemeral filesystem.
- **Frontend**: run `npm run build` and serve the `dist/` folder as static files. If the frontend and backend are on different domains (the normal case in production), set `VITE_API_BASE_URL` and `VITE_UPLOADS_BASE_URL` (see `frontend/.env.example`) to the backend's full URL before building - these are baked in at build time, not read at runtime, so the frontend needs a rebuild after changing them.
- **Database**: any managed PostgreSQL instance (Neon, Supabase, RDS, Railway Postgres, etc.) works — point the `DB_*` variables in `backend/.env` at it (set `DB_SSL=true` for basically any external provider - they require SSL, your own local Postgres doesn't), then run `npm run init-db` once.
- Change `JWT_SECRET`, `MESSAGE_ENCRYPTION_KEY`, and all demo account passwords before using this in anything beyond a class/demo environment.

## Security Notes

- Passwords hashed with bcrypt (10 salt rounds), never stored in plaintext.
- JWT-based stateless authentication; no token is issued at registration, closing the gap where an unverified account could otherwise use the API before being approved.
- Two-stage account gating: one-time identity **verification** (photo + ID document review) plus ongoing **suspend/reactivate** control, kept as separate concerns.
- Role-Based Access Control enforced at the route level for every sensitive endpoint; ownership (not role) is checked inside controllers for buy/sell/list actions, and staff accounts are explicitly blocked from ever becoming a buyer.
- National ID/passport PDFs and title deed PDFs are never served statically — only through authenticated, access-controlled routes restricted to staff or the document's owner.
- **Messaging encryption — please read this carefully.** Messages are encrypted at rest with AES-256-GCM using a single symmetric key the *server* holds (`MESSAGE_ENCRYPTION_KEY`). This means: if your database were ever leaked or inspected directly, message content is unreadable without that key. It does **not** mean the messages are end-to-end encrypted — the server itself can still decrypt every message, because it holds the only key. True end-to-end encryption (where not even the server could read messages) would require each user to hold their own private key generated and stored client-side, plus a key-exchange mechanism - a significantly bigger undertaking than what's implemented here. If you need genuine E2E, that's a good follow-up project.
- File upload validation (mime-type allow-list, 5MB size limit) via Multer.
- Parameterized SQL queries throughout (no string-concatenated SQL), preventing SQL injection.
- Helmet HTTP security headers, CORS restricted to the configured client origin, and API rate limiting.
- Database-level transactions (`BEGIN`/`COMMIT`/`ROLLBACK` with row locking) around ownership transfer to prevent race conditions on concurrent transaction approvals.

## Design Decisions Worth Knowing About

A few judgment calls made while building this, so nothing feels like a mystery later:

1. **Account verification vs. suspension are separate switches.** `verification_status` (pending/approved/rejected) is the one-time identity check gating first login; `is_active` is a separate, reusable on/off switch for an already-verified account (e.g. temporarily suspending someone). Reusing a single flag for both would have made "why can't this person log in" harder to answer at a glance.
2. **A rejected sale reopens the listing if it was public.** If a purchase on a publicly `for_sale` parcel gets rejected, the parcel goes back to `for_sale` (not silently `registered`), since the owner never asked for it to be delisted. A rejected *private* sale/transfer (never publicly listed) just returns to plain `registered`.
3. **Staff can facilitate a transfer, but never receive one.** A registrar/admin can initiate a sale/transfer *on behalf of* an owner (e.g. processing manual paperwork someone brought into the office), but the named buyer is always checked and rejected if they're a staff/system account — staff can help move land between citizens, but can never end up owning it themselves.
4. **Payment confirmation is seller-driven, for both payment methods.** There's no real payment gateway here, so there's no way to automatically verify a bank transfer any better than cash. Rather than pretend otherwise, both methods work the same way: buyer and seller get each other's contact details to arrange payment directly, and the registrar can't finalize the sale until the seller - the person actually receiving the money - confirms they got it.
5. **A transfer has no payment method at all**, rather than defaulting to "cash" or forcing an amount - gifting land to a relative isn't a sale, so the data model reflects that (the `amount` column allows 0, and `payment_method` is nullable specifically for this case).
6. **The printable Title Deed is always live, not a stored document.** It's rendered from the current database record every time it's opened, so it automatically reflects the current owner after a sale - there's no separate "reissue a new deed number" step to keep in sync, which avoided a second source of truth for the same fact.

## Author

Okello Gregory Mark — DCS-02-0029/2025 — Department of ICT and Engineering, Zetech University
