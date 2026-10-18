---
name: signemo-fullstack-change
description: Implement scoped SignEmo React PWA, Supabase API or database changes while preserving offline and privacy boundaries. Excludes model research and unrelated repositories.
---

Read `doc/MVP_SPEC.md`, `doc/ARCHITECTURE.md` and affected implementation before edits. Shared contracts are in `src/shared/contracts.ts`; Edge Functions import them. Keep strict validation aligned across client/server. Media/landmarks/transcripts never enter reports or logs. Only opt-in text/decisions may enter the encrypted local vault; keys remain in memory. Preserve IndexedDB consent across additive upgrades.

Use React/TypeScript/Vite/Tailwind/Dexie. Follow app/features/domain/infrastructure/shared boundaries; pure domain never imports UI or adapters. Preserve bounded queues, cancellation/generation checks, one inference in flight, consent before media, teardown on background/navigation/error. Captioning survives optional emotion failure. Service worker caches assets only, never Auth/API. Reports remain idempotent and withdrawal-safe. Test production in Docker; use dev HMR only for iteration.

Database changes use additive migrations with RLS tests. Public functions require bounded bodies, origin allowlist and rate limits; service role is server-only. Admin reads/deletes require the owner allowlist, not just a valid login. No user signup UI.

Run affected tests then `npm run check` for delivery. Follow `doc/DEPLOYMENT.md` for hosted work. Report missing credentials or hardware verification precisely. Keep dependency lock, manifest, API docs and verification evidence synchronized when changing their contracts.
