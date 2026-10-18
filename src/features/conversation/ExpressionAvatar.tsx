import { useEffect, useRef } from 'react';
import {
  AmbientLight,
  DirectionalLight,
  Mesh,
  OrthographicCamera,
  Scene,
  Texture,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Expression } from '../../shared/contracts';
import { avatarPoses, createAvatarRig } from './avatarRig';

export default function ExpressionAvatar({
  expression,
  active,
  reduced = false,
  replay = 0,
  onUnavailable,
  onReady,
}: {
  expression: Expression | null;
  active: boolean;
  reduced?: boolean;
  replay?: number;
  onUnavailable?: () => void;
  onReady?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const update = useRef<((label: Expression, animate: boolean) => void) | null>(null);
  const latest = useRef({ expression, reduced, onUnavailable, onReady });
  latest.current = { expression, reduced, onUnavailable, onReady };
  useEffect(() => {
    if (!active || document.hidden || !host.current) return;
    let disposed = false,
      frame = 0;
    let renderer: WebGLRenderer | null = null,
      root: Object3D | null = null;
    let rig: ReturnType<typeof createAvatarRig> | null = null;
    const release = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      update.current = null;
      rig?.dispose();
      disposeRoot(root);
      renderer?.domElement.removeEventListener('webglcontextlost', lost);
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
    const fail = () => {
      if (disposed) return;
      release();
      latest.current.onUnavailable?.();
    };
    const lost = (event: Event) => {
      event.preventDefault();
      fail();
    };
    const hide = () => {
      if (document.hidden) release();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', release);
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.setSize(180, 180);
      renderer.domElement.addEventListener('webglcontextlost', lost);
      host.current.appendChild(renderer.domElement);
      const scene = new Scene(),
        camera = new OrthographicCamera(-1.2, 1.2, 1.2, -1.2, 0.1, 10);
      camera.position.z = 4;
      scene.add(new AmbientLight(0xffffff, 2));
      const light = new DirectionalLight(0xffffff, 2);
      light.position.set(-2, 3, 4);
      scene.add(light);
      new GLTFLoader().load(
        '/avatar/signemo.glb',
        (gltf) => {
          if (disposed) {
            disposeRoot(gltf.scene);
            return;
          }
          try {
            root = gltf.scene;
            scene.add(root);
            rig = createAvatarRig(root);
            let current = [...avatarPoses.neutral];
            update.current = (label, animate) => {
              if (disposed) return;
              cancelAnimationFrame(frame);
              const target = avatarPoses[label],
                start = [...current],
                begin = performance.now();
              let last = -Infinity;
              const tick = (now: number) => {
                if (disposed || document.hidden) return;
                const progress = animate ? Math.min(1, (now - begin) / 450) : 1;
                if (now - last >= 1000 / 30 || progress === 1) {
                  last = now;
                  const ease = 1 - Math.pow(1 - progress, 3);
                  current = start.map((value, index) => value + (target[index] - value) * ease);
                  try {
                    rig!.apply(current);
                    renderer!.render(scene, camera);
                  } catch {
                    fail();
                    return;
                  }
                }
                if (progress < 1) frame = requestAnimationFrame(tick);
                else frame = 0;
              };
              tick(begin);
            };
            update.current(latest.current.expression ?? 'neutral', false);
            if (!disposed) latest.current.onReady?.();
          } catch {
            fail();
          }
        },
        undefined,
        fail,
      );
    } catch {
      fail();
    }
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', release);
      release();
    };
  }, [active]);
  useEffect(() => {
    update.current?.(expression ?? 'neutral', !!expression && !reduced);
  }, [expression, reduced, replay]);
  return <div ref={host} className="face-avatar-canvas" aria-hidden="true" />;
}

function disposeRoot(root: Object3D | null) {
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<import('three').Material>(),
    textures = new Set<Texture>();
  root?.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof Texture) textures.add(value);
    }
  });
  textures.forEach((item) => item.dispose());
  materials.forEach((item) => item.dispose());
  geometries.forEach((item) => item.dispose());
}
