# CampusStore API

University e-commerce & merchandise platform backend for CSX4110. Staff and
students authenticate through the university's Azure AD; the backend issues
its own JWT with an RBAC role claim, generates AI-assisted product
descriptions, and both exposes and consumes a peer service-to-service API for
department-based discount verification. Full design in
[`../proposal/CampusStore_Project_Proposal.pdf`](../proposal/CampusStore_Project_Proposal.pdf).

Runs as a second, isolated app alongside the Lab's `backend-crud-api` on the
same Azure VM — new port (4002), new MySQL database (`campus_store`), new PM2
process (`campus-store-api`), new Nginx location (`/campus-store/`) — without
touching the Lab's existing `/content` or `/api` routes.

## Live deployment

**https://campus-store-taian.duckdns.org/campus-store/**

Free DuckDNS subdomain pointed at the VM's public IP, with a Let's Encrypt
certificate issued via `certbot --nginx` (auto-renews). Plain HTTP redirects
to HTTPS. Try `GET /campus-store/health` or `GET /campus-store/api/products`.

## Admin frontend (Product/Category CRUD)

`frontend-admin/` is a small React + Vite app for exercising the RBAC-gated
Category/Product CRUD and the AI description generation visually — everyone
sees the catalog; STAFF/ADMIN see create forms; only ADMIN sees delete
buttons, matching `src/middleware/auth.js` exactly.

```bash
cd frontend-admin
npm install
npm run dev   # http://localhost:5173, talks to the API on :4002
```

Uses the same `AUTH_MODE=mock` dev login as the API. A production build
(`npm run build`) is base-pathed to `/campus-store/` (see `vite.config.js`)
so it can eventually be served by the same Nginx block as the API.

## Stack

Node.js 20 + Express, Prisma + MySQL, JWT + RBAC, Azure AD (MSAL) for login,
Azure Key Vault for secrets, OpenAI for description generation, PM2 behind
Nginx for deployment — mirroring the pattern proven in `../backend-crud-api`.

## Local development

Local dev never touches Azure AD or Key Vault directly — `AUTH_MODE=mock`
swaps in a dev login endpoint, and secrets are read straight from
`.env.local` instead of Key Vault (see `src/config/secrets.js`).

```bash
cp .env.example .env.local   # then fill in values as needed
npm install

# Local MySQL for dev parity (mysql on host port 3307)
docker compose up -d mysql

npx prisma migrate dev --name init
npm run dev
```

Server listens on `http://localhost:4002/campus-store` (and also on `/` for
convenience outside of production).

### Try it

```bash
# Dev login as STAFF (AUTH_MODE=mock only)
curl -X POST http://localhost:4002/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"staff@uni.edu","role":"STAFF","department":"CS"}'

# Use the returned token to create a category + product
curl -X POST http://localhost:4002/api/categories \
  -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' \
  -d '{"name":"Apparel"}'
```

## Roles & RBAC

| Role | Permissions |
|---|---|
| STUDENT | Browse products, create/view own orders |
| STAFF | + CRUD Product/Category, view all orders, trigger AI description |
| ADMIN | + manage users/roles, issue/revoke peer API keys |

Enforced by `requireRole(...roles)` in `src/middleware/auth.js`, reading the
role claim from the verified JWT — the client's own claims are never trusted.

## Peer service-to-service API

- **Expose** (`POST /api/peer/preorders`, `x-api-key` auth): lets a partner
  place a bulk merchandise pre-order. See `src/routes/peer.js`.
- **Consume** (`src/services/peerClient.js`): verifies a student's department
  enrollment with a partner's API before applying a discount at checkout;
  fails closed on any error/timeout. Set `PEER_MOCK=true` to always approve
  locally before a partner team is confirmed.

## Contributing / branch workflow

`main` is protected (proposal §10): no direct pushes, and every change lands
via a PR that must pass the `CI / validate` check (`npx prisma validate` +
a syntax check, see `.github/workflows/ci.yml`).

```bash
git checkout -b feature/short-description
# ...make changes...
git push -u origin feature/short-description
gh pr create --fill
```

Since this is a solo capstone, PRs don't require a second approver — the
protection rule only enforces "no direct commits to main" and "CI must pass"
before merging.

## Deployment

```bash
./deploy.sh
```

Ships `src/`, `package.json`, and `prisma/` to the VM, runs
`prisma migrate deploy`, and restarts the `campus-store-api` PM2 process — see
`deploy.sh` for the exact steps. The corresponding Nginx `location` block is
documented in the proposal (§10.1) and applied directly on the VM.
