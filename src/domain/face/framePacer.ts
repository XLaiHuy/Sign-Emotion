/** Media callbacks keep running; only a fresh frame at/after a deadline may be captured. */
export class FramePacer {
  private nextAt = -Infinity;
  private lastMediaTime = -Infinity;
  private lastAt = -Infinity;
  private interval = 200;
  latenessMs = 0;
  missedDeadlines = 0;
  reset() {
    this.nextAt = -Infinity;
    this.lastMediaTime = -Infinity;
    this.lastAt = -Infinity;
    this.latenessMs = 0;
    this.missedDeadlines = 0;
  }
  take(now: number, mediaTime: number, busy: boolean, interval: number) {
    if (!Number.isFinite(now) || !Number.isFinite(mediaTime)) return false;
    if (mediaTime < this.lastMediaTime) this.reset();
    if (interval !== this.interval) {
      this.interval = interval;
      this.nextAt = this.lastAt + interval;
    }
    if (busy || now + 2 < this.nextAt || mediaTime === this.lastMediaTime) return false;
    this.lastMediaTime = mediaTime;
    this.lastAt = now;
    this.latenessMs = Number.isFinite(this.nextAt) ? Math.max(0, now - this.nextAt) : 0;
    this.missedDeadlines = Math.floor(this.latenessMs / interval);
    // Missed deadlines are discarded; never enqueue a catch-up burst.
    this.nextAt = Number.isFinite(this.nextAt)
      ? this.nextAt + Math.max(1, Math.floor((now - this.nextAt) / interval) + 1) * interval
      : now + interval;
    return true;
  }
}

export class RecentFaceTiming {
  private rows: { at: number; ms: number }[] = [];
  add(at: number, ms: number) {
    this.rows.push({ at, ms });
    this.rows = this.rows.filter((row) => at - row.at <= 5000).slice(-128);
  }
  mean(now: number) {
    const recent = this.rows.filter((row) => now - row.at <= 5000);
    return recent.length ? recent.reduce((sum, row) => sum + row.ms, 0) / recent.length : 0;
  }
  clear() {
    this.rows = [];
  }
}
