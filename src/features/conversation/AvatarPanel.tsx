import { Component, lazy, Suspense, type ReactNode } from 'react';
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

// Module-level lazy import caches the loaded chunk promise across renders
const ExpressionAvatarLazy = lazy(() => import('./ExpressionAvatar'));

/** A rejected optional import must never replace the caption/session screen. */
export function AvatarPanel({
  expression,
  active,
  audioVolume,
  lowPower,
  fallback,
  reduced,
  replay,
  onUnavailable,
  onReady,
}: {
  expression: Expression | null;
  active: boolean;
  audioVolume?: number;
  lowPower?: boolean;
  fallback: ReactNode;
  reduced: boolean;
  replay: number;
  onUnavailable: () => void;
  onReady: () => void;
}) {
  return (
    <AvatarBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <ExpressionAvatarLazy
          expression={expression}
          active={active}
          audioVolume={audioVolume}
          lowPower={lowPower}
          reduced={reduced}
          replay={replay}
          onUnavailable={onUnavailable}
          onReady={onReady}
        />
      </Suspense>
    </AvatarBoundary>
  );
}
