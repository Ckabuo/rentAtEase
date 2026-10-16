# Rent@Ease

Monorepo for the Rent@Ease portal, marketing site and API. Product pages are not built yet.

## Layout

```
apps/web          Next.js portal (owners, caretakers, applicants) at portal.[domain]
apps/marketing    Next.js static site (landing, pricing, legal) at the apex domain
apps/api          NestJS REST API, Prisma, and BullMQ workers
packages/schemas  Zod schemas shared by the portal and the API
packages/domain   Ledger, allocation, scoring and reminder rules
packages/api-client  Typed API client (OpenAPI generation comes later)
packages/ui       Design tokens and Tailwind theme
packages/config   ESLint, TypeScript and Prettier settings
```

Reminders, sends, receipts and retention run inside the API process. The portal is a normal web app until it is usable enough to add install and offline support. The Expo app is intentionally not in this scaffold.

## Commands

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run dev` starts the portal on port 3000, the marketing site on port 3001 and the API on port 4000, watches shared packages under `packages/`, and restarts the apps when dependencies or the root `.env` change. The API starts its reminder workers when `REDIS_URL` is set.

The health check is http://localhost:4000/api/health. API docs are at http://localhost:4000/docs.

Money is whole kobo. Calendar dates are `YYYY-MM-DD` in Africa/Lagos. Ledger, scoring, allocation and reminder engines live in `packages/domain` and throw until those rules are implemented. Plan limits and Naira formatting are already in place.
