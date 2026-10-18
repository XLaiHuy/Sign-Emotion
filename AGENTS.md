# SignEmo

Read `doc/MVP_SPEC.md` before product/API/AI changes and `doc/PROJECT_STATUS.md` for unresolved assumptions. Original competition documents are historical proposals, not verified benchmarks. Keep Vietnamese product copy precise: observable expression suggestions, never certainty about internal feelings or intent.

## Commands

- Setup: `npm ci`, `npm run assets:prepare`, `npm run assets:conversation`.
- Local app: `npm run dev`; production/offline: `npm run build`, `npm run preview`.
- Gates: `npm run check`. Tests use Vitest, fake IndexedDB and embedded PostgreSQL/PGlite.
- Never claim Android motor, battery, thermal, real pilot, hosted Auth/functions or deployment verified without doing the corresponding check.

## Boundaries

Keep camera, microphone and inference local. Mic/Vietnamese captions and experimental text/voice/face fusion are authorized. Do not add media/landmarks/transcripts/identity to reports or logs. Opt-in transcripts belong only in the encrypted local vault. Stop tracks/workers on lifecycle boundaries. No payments, smartwatch, minors or micro-expression features without a scope decision. Keys with service privileges stay server-side. Research data belongs on encrypted offline storage, never Git or cloud sync. API, migrations and model preprocessing changes need meaningful regression tests. Keep model source/checksum/license and exact package lock versions.

Maintain dependency direction: domain is pure, infrastructure implements adapters, features own UI/session state, app composes them. Use bounded queues, cancellation/generation guards, explicit model contracts and no cross-feature hidden state. Run `npm run lint` for boundaries. Avoid provider details in product UI. Docker production requires rebuild; Docker dev uses HMR. All project/business/theory documents live under `doc/` (historical originals under `doc/archive/`); README and AGENTS stay at root as entry points.

Repo skills under `.agents/skills`: product-analysis, plan-goals, fullstack-change, edge-ai, verify-demo, speech-on-device, multimodal-evaluation, accessible-ui, codegraph-change, startup-pitch-bmc, 3d-avatar-performance, pwa-offline-resilience with `signemo-` prefix, plus frontend design skills `impeccable` and `taste-skill`. Load only relevant skills. Preserve user authorization; create tool goals only when explicitly requested. No automatic outbound messages or spending.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
