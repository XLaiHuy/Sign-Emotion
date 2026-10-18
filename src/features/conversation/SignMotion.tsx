import { useEffect, useRef } from 'react';
import {
  AmbientLight,
  AnimationMixer,
  Box3,
  DirectionalLight,
  LoopOnce,
  Mesh,
  SkinnedMesh,
  OrthographicCamera,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function disposeModel(root: Object3D) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (object instanceof SkinnedMesh) object.skeleton.dispose();
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      Object.values(material).forEach((value) => {
        if (value instanceof Texture) value.dispose();
      });
      material.dispose();
    }
  });
}

export default function SignMotion({
  bytes,
  clipName,
  playing,
  replay,
  onEnd,
  onError,
}: {
  bytes: ArrayBuffer;
  clipName?: string;
  playing: boolean;
  replay: number;
  onEnd: () => void;
  onError: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const control = useRef<{ play(value: boolean): void; replay(): void } | null>(null);
  const latest = useRef({ onEnd, onError, playing });
  latest.current = { onEnd, onError, playing };
  useEffect(() => {
    if (!host.current) return;
    let disposed = false,
      frame = 0,
      renderer: WebGLRenderer | undefined,
      root: Object3D | undefined;
    let mixer: AnimationMixer | undefined;
    let observer: ResizeObserver | undefined;
    const release = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      mixer?.stopAllAction();
      if (root) mixer?.uncacheRoot(root);
      if (root) disposeModel(root);
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
      control.current = null;
    };
    const fail = () => {
      if (disposed) return;
      release();
      latest.current.onError();
    };
    try {
      renderer = new WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.setClearColor('#172820');
      renderer.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        if (!disposed) fail();
      });
      host.current.appendChild(renderer.domElement);
      const scene = new Scene();
      const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
      scene.add(new AmbientLight(0xffffff, 2));
      const light = new DirectionalLight(0xffffff, 2);
      light.position.set(2, 3, 4);
      scene.add(light);
      new GLTFLoader().parse(
        bytes,
        '',
        (gltf) => {
          root = gltf.scene;
          if (disposed) {
            disposeModel(root);
            return;
          }
          try {
            scene.add(root);
            const clip = clipName
              ? gltf.animations.find((c) => c.name === clipName)
              : gltf.animations.length === 1
                ? gltf.animations[0]
                : undefined;
            if (!clip || !Number.isFinite(clip.duration) || clip.duration <= 0)
              throw new Error('Missing clip');
            mixer = new AnimationMixer(root);
            const action = mixer.clipAction(clip);
            action.setLoop(LoopOnce, 1);
            action.clampWhenFinished = true;
            action.play();
            const bounds = new Box3();
            // Include motion extents, not just the rest pose, so hands remain in frame.
            for (let i = 0; i <= 30; i++) {
              mixer.setTime((clip.duration * i) / 30);
              root.updateMatrixWorld(true);
              bounds.union(new Box3().setFromObject(root, true));
            }
            mixer.setTime(0);
            action.reset().play();
            const size = bounds.getSize(new Vector3()),
              centre = bounds.getCenter(new Vector3());
            if (bounds.isEmpty()) throw new Error('Empty model');
            camera.far = Math.max(size.length() * 10, 10);
            camera.position.set(centre.x, centre.y, centre.z + Math.max(size.length(), 1) * 2);
            camera.lookAt(centre);
            const draw = () => {
              if (!disposed) renderer!.render(scene, camera);
            };
            const resize = () => {
              if (!host.current || disposed) return;
              const w = Math.max(1, host.current.clientWidth),
                h = Math.max(1, host.current.clientHeight),
                aspect = w / h;
              const half = Math.max(size.y / 2, size.x / (2 * aspect), 0.1) * 1.15;
              camera.left = -half * aspect;
              camera.right = half * aspect;
              camera.top = half;
              camera.bottom = -half;
              camera.updateProjectionMatrix();
              renderer!.setSize(w, h);
              draw();
            };
            observer = new ResizeObserver(resize);
            observer.observe(host.current!);
            resize();
            let last = 0,
              running = false;
            const tick = (now: number) => {
              if (disposed || !running) return;
              if (now - last >= 1000 / 30) {
                mixer!.update((now - last) / 1000);
                last = now;
                draw();
              }
              if (action.time >= clip.duration) {
                running = false;
                latest.current.onEnd();
                return;
              }
              frame = requestAnimationFrame(tick);
            };
            control.current = {
              play(value) {
                cancelAnimationFrame(frame);
                running = value;
                if (value) {
                  last = performance.now();
                  frame = requestAnimationFrame(tick);
                }
              },
              replay() {
                action.reset().play();
                mixer!.setTime(0);
                draw();
                this.play(true);
              },
            };
            control.current.play(latest.current.playing);
          } catch {
            fail();
          }
        },
        fail,
      );
    } catch {
      fail();
    }
    return release;
  }, [bytes, clipName]);
  useEffect(() => control.current?.play(playing), [playing]);
  useEffect(() => {
    if (replay) control.current?.replay();
  }, [replay]);
  return (
    <div className="sign-motion-host" ref={host} role="img" aria-label="Minh họa ký hiệu câu nói" />
  );
}
