import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import type { Expression } from '../../shared/contracts';
import { emitAudit } from '../../infrastructure/audit/log';

export class AvatarBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    emitAudit('avatar-unavailable', {
      reason: navigator.onLine ? 'unknown' : 'offline',
    });
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** A rejected optional import must never replace the caption/session screen. */
export function AvatarPanel({
  expression,
  active,
  fallback,
  reduced,
  replay,
  onUnavailable,
  onReady,
}: {
  expression: Expression | null;
  active: boolean;
  fallback: ReactNode;
  reduced: boolean;
  replay: number;
  onUnavailable: () => void;
  onReady: () => void;
}) {
  // A fresh mount (toggle off/on) can retry the chunk after connectivity returns.
  const [Avatar] = useState(() => lazy(() => import('./ExpressionAvatar')));
  return (
    <AvatarBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Avatar
          expression={expression}
          active={active}
          reduced={reduced}
          replay={replay}
          onUnavailable={onUnavailable}
          onReady={onReady}
        />
      </Suspense>
    </AvatarBoundary>
  );
}
