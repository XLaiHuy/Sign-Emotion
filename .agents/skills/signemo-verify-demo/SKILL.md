---
name: signemo-verify-demo
description: Verify completed SignEmo changes and demo readiness across PWA, camera, haptics, offline, backend and data boundaries. Use after implementation, not as evidence that physical devices or pilots were tested.
---

Read `doc/MVP_SPEC.md`, `doc/DEPLOYMENT.md` and the current `doc/VERIFICATION.md`. Run `npm run check`, then affected browser scenarios on a production preview for service-worker/offline behavior. Use the installed Playwright skill workflow for browser inspection.

For conversation changes verify actual local ASR/VAD/text/voice workers, permissions, bounded audio queue, initialization cancellation, finish flush and stale-result rejection. Verify optional emotion failure preserves captions. Check encrypted history, password failure, background lock, expiry and report-consent preservation. Distinguish file evaluation, synthetic capture and physical microphone. Docker production smoke and dev HMR are separate checks. No Android is available for the current PC milestone.

Cover consent, camera denial/unavailability, zero/multiple/poor-quality faces, rapid changes, repeated expression, worker/model failure and background teardown. Check report queue/retry, invalid payload, wrong withdrawal token, replay after withdrawal and non-admin access. Inspect network/storage for media uploads or persistence; synthetic fixtures cannot prove in-the-wild accuracy.

Verify mobile layout without horizontal overflow and keyboard focus/labels. Test offline by preparing assets, closing/reopening a page offline and initializing the actual model worker. Record browser/OS/model/settings and screenshot/log paths. Real Android motor/battery/thermal checks and consenting human pilot remain separate gates. Update verification with observed results and unresolved limitations, never inferred success.
