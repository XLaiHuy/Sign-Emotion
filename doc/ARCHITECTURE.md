# SignEmo architecture

```text
src/
  app/                  Composition and navigation
  features/
    conversation/       Unified camera, captions, fusion and session lifecycle
    history/            Unlock, view, export and delete encrypted history
    lab/                Local video and speech evaluation
    practice/           Shared rhythm player and practice
    feedback/           Consent and report queue
    settings/           Local preferences and activity log
    admin/, overview/   Administration and introduction
  domain/               Pure audio, fusion, evaluation and filtering
  infrastructure/
    media/              Camera, microphone and AudioWorklet
    inference/          Workers and model adapters
    storage/            IndexedDB and encrypted vault
    offline/            Asset checksums, preparation and cache
    backend/            Consented feedback only
  shared/               Contracts and shared UI
  sw.ts                 Service worker
supabase/               Separate API/database
scripts/                Asset preparation, quality gates, evaluation
  doc/                  Specifications; archive/ retains original proposals
```

Dependency direction: app -> features -> domain/infrastructure/shared. Domain has no React, worker or storage dependencies; infrastructure never imports UI. `npm run lint` checks boundaries and runtime import cycles. Worker messages carry task IDs; session generation/abort guards reject stale results. Queues are bounded rather than accumulating media indefinitely.

Replace models at inference adapters and pinned manifests, without changing feedback contracts or presentation. Keep feature-specific code together; promote only genuinely shared logic. Supabase is a report adapter independent of inference. A changed report destination requires renewed consent.

Camera/audio and landmarks never enter databases or report APIs. Opt-in text and decisions are encrypted in a local vault, with keys held only in memory. Reports contain neither transcripts nor per-segment evidence. Research data remains separately encrypted offline, outside Git/cloud. Feedback does not automatically train models.

Production: `docker compose up -d --build`, localhost:8080. Source changes require an image rebuild. Development: `npm run dev` or `npm run docker:dev`; Vite HMR updates source. Dependency/build configuration changes require rebuilding. See [DOCKER.md](DOCKER.md).

Speech assets exceed Cloudflare Pages single-file limits. Docker serves the pinned local profile (tiny/VAD and text emotion); future hosting needs a large-asset delivery strategy, checksums and an explicit privacy boundary. Face and transcript data remain on-device and never enter feedback reports or audit logs.
