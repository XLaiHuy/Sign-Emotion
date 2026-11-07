import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ExpressionMotion } from '../src/features/conversation/ExpressionMotion';
import ExpressionAvatar from '../src/features/conversation/ExpressionAvatar';
import { FaceIllustration } from '../src/features/conversation/FaceIllustration';
import { expressions } from '../src/shared/contracts';

// Shared spies for Three.js WebGLRenderer testing
const setSizeSpy = vi.fn();
const disposeSpy = vi.fn();
const forceContextLossSpy = vi.fn();
const mockCanvas = document.createElement('canvas');

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor(parameters?: import('three').WebGLRendererParameters) {
      this.domElement = mockCanvas;
      MockWebGLRenderer.lastParams = parameters;
    }
    static lastParams: import('three').WebGLRendererParameters | undefined;
    setPixelRatio = vi.fn();
    setSize = setSizeSpy;
    render = vi.fn();
    dispose = disposeSpy;
    forceContextLoss = forceContextLossSpy;
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

describe('R2 Empirical Aspect Ratio & Layout Stability Verification', () => {
  afterEach(() => {
    cleanup();
    setSizeSpy.mockClear();
    disposeSpy.mockClear();
    forceContextLossSpy.mockClear();
  });

  describe('1. 2D Face Illustration SVG Invariants (ExpressionMotion.tsx)', () => {
    it('enforces viewBox="0 0 100 100" and preserveAspectRatio="xMidYMid meet" across all 7 emotions', () => {
      for (const emotion of expressions) {
        const { container, unmount } = render(
          <ExpressionMotion label={emotion} active cue={null} reduced={false} />,
        );
        const svg = container.querySelector('svg');
        expect(svg, `SVG missing for emotion ${emotion}`).not.toBeNull();
        expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100');
        expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
        expect(svg?.classList.contains('expression-motion-face')).toBe(true);

        // Verify head geometry is perfectly circular (radius 43 in both x and y)
        const circle = svg?.querySelector('circle');
        expect(circle).not.toBeNull();
        expect(circle?.getAttribute('cx')).toBe('50');
        expect(circle?.getAttribute('cy')).toBe('50');
        expect(circle?.getAttribute('r')).toBe('43');

        unmount();
      }
    });

    it('enforces 1:1 aspect ratio invariants under neutral state and inactive state', () => {
      const { container, rerender } = render(
        <ExpressionMotion label={null} active={false} cue={null} reduced={false} />,
      );
      let svg = container.querySelector('svg');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100');
      expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');

      rerender(<ExpressionMotion label="neutral" active cue={null} reduced={false} />);
      svg = container.querySelector('svg');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100');
      expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    });

    it('maintains preserveAspectRatio="xMidYMid meet" when rendered inside asymmetric parent containers', () => {
      // Stress test: mount inside simulated tall/narrow and wide/short flex containers
      const containers = [
        { width: '80px', height: '400px', label: 'tall-narrow' },
        { width: '600px', height: '100px', label: 'wide-short' },
        { width: '100%', height: 'auto', label: 'responsive-auto' },
      ];

      for (const spec of containers) {
        const { container, unmount } = render(
          <div
            data-testid={`container-${spec.label}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: spec.width,
              height: spec.height,
            }}
          >
            <ExpressionMotion label="surprised" active cue={null} reduced={false} />
          </div>,
        );

        const svg = container.querySelector('svg');
        expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
        expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100');
        unmount();
      }
    });
  });

  describe('2. 3D Avatar WebGL Canvas Sizing & Invariants (ExpressionAvatar.tsx)', () => {
    it('configures WebGLRenderer with setSize(180, 180, false) and inline 1:1 containment styles', () => {
      const { container } = render(
        <ExpressionAvatar expression="happy" active onReady={vi.fn()} onUnavailable={vi.fn()} />,
      );

      // Verify setSize was called with (180, 180, false) - critical: false avoids Three.js inline style overrides
      expect(setSizeSpy).toHaveBeenCalledWith(180, 180, false);

      // Verify inline styles explicitly applied to renderer.domElement
      expect(mockCanvas.style.width).toBe('100%');
      expect(mockCanvas.style.height).toBe('100%');
      expect(mockCanvas.style.aspectRatio).toBe('1 / 1');
      expect(mockCanvas.style.objectFit).toBe('contain');
      expect(mockCanvas.style.display).toBe('block');

      // Verify container div (.face-avatar-canvas) has inline style aspectRatio: 1 / 1
      const hostDiv = container.querySelector('.face-avatar-canvas') as HTMLDivElement;
      expect(hostDiv).not.toBeNull();
      expect(hostDiv.style.aspectRatio).toBe('1 / 1');
    });

    it('cleans up WebGL context and event listeners on unmount without leaking', () => {
      const { unmount } = render(
        <ExpressionAvatar expression="neutral" active onReady={vi.fn()} onUnavailable={vi.fn()} />,
      );

      unmount();

      expect(disposeSpy).toHaveBeenCalled();
      expect(forceContextLossSpy).toHaveBeenCalled();
    });
  });

  describe('3. CSS Aspect Ratio Rules & Layout Invariants (Static Analysis)', () => {
    const stylesPath = path.resolve(__dirname, '../src/styles.css');
    const sessionCssPath = path.resolve(__dirname, '../src/shared/ui/conversation-session.css');
    const stylesCss = fs.readFileSync(stylesPath, 'utf-8');
    const sessionCss = fs.readFileSync(sessionCssPath, 'utf-8');

    it('enforces aspect-ratio: 1 / 1 and object-fit: contain on 3D canvas and container in styles.css', () => {
      // .face-avatar-canvas
      expect(stylesCss).toMatch(/\.face-avatar-canvas\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);
      expect(stylesCss).toMatch(/\.face-avatar-canvas\s*\{[^}]*height:\s*auto/);
      expect(stylesCss).toMatch(/\.face-avatar-canvas\s*\{[^}]*flex-shrink:\s*0/);

      // .face-avatar-canvas canvas
      expect(stylesCss).toMatch(/\.face-avatar-canvas canvas\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);
      expect(stylesCss).toMatch(/\.face-avatar-canvas canvas\s*\{[^}]*object-fit:\s*contain/);
      expect(stylesCss).toMatch(/\.face-avatar-canvas canvas\s*\{[^}]*width:\s*100%\s*!important/);
      expect(stylesCss).toMatch(/\.face-avatar-canvas canvas\s*\{[^}]*height:\s*100%\s*!important/);
    });

    it('enforces aspect-ratio: 1 / 1 and height: auto on .expression-motion-face in styles.css', () => {
      expect(stylesCss).toMatch(/\.expression-motion-face\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);
      expect(stylesCss).toMatch(/\.expression-motion-face\s*\{[^}]*height:\s*auto/);
      expect(stylesCss).toMatch(/\.expression-motion-face\s*\{[^}]*flex-shrink:\s*0/);
    });

    it('enforces align-items: center on .face-illustration-stage to prevent cross-axis flex stretching in conversation-session.css', () => {
      // Default / desktop stage
      expect(sessionCss).toMatch(/\.face-feedback \.face-illustration-stage\s*\{[^}]*align-items:\s*center/);
    });

    it('enforces square 120x120 aspect ratio protection on .face-illustration-3d in conversation-session.css', () => {
      expect(sessionCss).toMatch(/\.face-feedback \.face-illustration-3d\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);
      expect(sessionCss).toMatch(/\.face-feedback \.face-illustration-3d\s*\{[^}]*width:\s*120px/);
      expect(sessionCss).toMatch(/\.face-feedback \.face-illustration-3d\s*\{[^}]*height:\s*120px/);
      expect(sessionCss).toMatch(/\.face-feedback \.face-illustration-3d\s*\{[^}]*flex:\s*0 0 120px/);

      // Canvas inside .face-feedback .face-illustration-3d
      expect(sessionCss).toMatch(/\.face-feedback \.face-illustration-3d canvas\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);
      expect(sessionCss).toMatch(/\.face-feedback \.face-illustration-3d canvas\s*\{[^}]*object-fit:\s*contain/);
    });

    it('enforces synchronized 100x100 aspect ratio protection under mobile/landscape media query in conversation-session.css', () => {
      // Find media query block for max-width: 767px
      const mediaQueryMatch = sessionCss.match(/@media\s*\(max-width:\s*767px\)[^{]*\{([\s\S]*?)\n\}/);
      expect(mediaQueryMatch).not.toBeNull();
      const mediaContent = mediaQueryMatch![0];

      // Media query stage has align-items: center
      expect(mediaContent).toMatch(/\.face-feedback \.face-illustration-stage\s*\{[^}]*align-items:\s*center/);

      // Media query 3D avatar has width: 100px !important, height: 100px !important, aspect-ratio: 1 / 1
      expect(mediaContent).toMatch(/\.face-illustration-3d\s*\{[^}]*width:\s*100px\s*!important/);
      expect(mediaContent).toMatch(/\.face-illustration-3d\s*\{[^}]*height:\s*100px\s*!important/);
      expect(mediaContent).toMatch(/\.face-illustration-3d\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);

      // Media query canvas inside 3D avatar has aspect-ratio: 1 / 1 and object-fit: contain
      expect(mediaContent).toMatch(/\.face-illustration-3d canvas\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);
      expect(mediaContent).toMatch(/\.face-illustration-3d canvas\s*\{[^}]*object-fit:\s*contain/);

      // Media query 2D expression-motion-face has aspect-ratio: 1 / 1 and flex-shrink: 0
      expect(mediaContent).toMatch(/\.expression-motion-face\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/);
      expect(mediaContent).toMatch(/\.expression-motion-face\s*\{[^}]*height:\s*auto/);
      expect(mediaContent).toMatch(/\.expression-motion-face\s*\{[^}]*flex-shrink:\s*0/);
    });
  });

  describe('4. Full Component Integration & Fallback Stability (FaceIllustration.tsx)', () => {
    it('seamlessly falls back to 2D SVG with preserveAspectRatio when 3D is disabled or fails', () => {
      const { container, rerender } = render(
        <FaceIllustration
          label="happy"
          active
          cue={null}
          use3D={false}
          allowed3D={true}
          colors={false}
        />,
      );

      // In 2D mode, SVG must be present with aspect ratio protection
      let svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100');

      // Now switch to 3D mode but not allowed (e.g. low power / GPU overload)
      rerender(
        <FaceIllustration
          label="happy"
          active
          cue={null}
          use3D={true}
          allowed3D={false}
          colors={false}
        />,
      );

      // Must fall back to 2D SVG gracefully
      svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100');
      expect(screen.getByText('Đang dùng hình 2D để giữ phụ đề hoạt động.')).toBeInTheDocument();
    });
  });
});
