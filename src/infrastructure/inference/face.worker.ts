/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type * as Ort from 'onnxruntime-web/wasm';
import { MODEL_VERSION, type InferenceResult, type QualityReason } from '../../shared/contracts';
import { softmax } from '../../domain/face/prediction';
import { faceImageQuality } from '../../domain/face/quality';
import { estimateHeadPose, isSupportedHeadPose } from '../../domain/face/pose';
import { FEATURE_NAMES, auxiliaryManifestSchema, type AuxiliaryArtifact } from './auxiliary';
import { toEmotiEffInput, toSignEmoEmotionOrder } from './emotieff-model';
import { warmClassifier } from './warmClassifier';
import {
  ModelInitializationError,
  modelInitializationCode,
} from '../../domain/modelInitialization';
import {
  faceProfileContract,
  loadResearchFaceModel,
  type FaceModelProfile,
} from './face-model-profile';

let detector: FaceLandmarker | null = null;
let ort: typeof import('onnxruntime-web/wasm');
let session: Ort.InferenceSession | null = null;
let auxiliarySession: Ort.InferenceSession | null = null;
let auxiliary: AuxiliaryArtifact['manifest'] | null = null;
const canvas = new OffscreenCanvas(640, 480);
const context = canvas.getContext('2d', { willReadFrequently: true })!;
const faceCanvas = new OffscreenCanvas(224, 224);
const faceContext = faceCanvas.getContext('2d', { willReadFrequently: true })!;
const qualityCanvas = new OffscreenCanvas(64, 64);
const qualityContext = qualityCanvas.getContext('2d', { willReadFrequently: true })!;

let classifierSize = 260;
let rgbInput = new Float32Array(3 * 260 * 260);
const qualityInput = new Float32Array(64 * 64);
const gpuCanvas = new OffscreenCanvas(1, 1);
let modelVersion: string = MODEL_VERSION;
async function init(
  candidate?: AuxiliaryArtifact,
  research = false,
  profile: FaceModelProfile = 'product',
  delegate: 'CPU' | 'GPU' = 'CPU',
) {
  const contract = faceProfileContract(profile);
  if (profile !== 'product' && !research) throw new Error('Profile mặt không hợp lệ');
  if (contract.backend === 'webgpu') {
    try {
      if (!navigator.gpu || !(await navigator.gpu.requestAdapter()))
        throw new ModelInitializationError('gpu');
    } catch {
      throw new ModelInitializationError('gpu');
    }
  }
  ort =
    contract.backend === 'webgpu'
      ? await import('onnxruntime-web/webgpu')
      : await import('onnxruntime-web/wasm');
  classifierSize = contract.size;
  rgbInput = new Float32Array(3 * classifierSize * classifierSize);
  modelVersion = profile === 'product' ? MODEL_VERSION : `${contract.version}-${contract.backend}`;
  faceCanvas.width = faceCanvas.height = classifierSize;
  ort.env.wasm.wasmPaths = `${self.location.origin}${contract.backend === 'webgpu' ? '/research/runtime-ort-gpu/' : '/runtime/ort/'}`;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  const fileset = await FilesetResolver.forVisionTasks('/runtime/mediapipe');
  // MediaPipe's UMD loader falls back to import() in module workers, where a
  // top-level var is not global. The build-time ESM wrapper exposes the factory.
  const moduleUrl = `${self.location.origin}${fileset.wasmLoaderPath.replace(/\.js$/, '.mjs')}`;
  const loader = await import(/* @vite-ignore */ moduleUrl);
  (self as unknown as { ModuleFactory: unknown }).ModuleFactory = loader.default;
  detector = await FaceLandmarker.createFromOptions(
    { ...fileset, wasmLoaderPath: '' },
    {
      baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate },
      ...(delegate === 'GPU' ? { canvas: gpuCanvas } : {}),
      // Full detection each frame avoids VIDEO tracking retaining a single face
      // for a frame when a second person enters. Prefer abstention over speed.
      runningMode: 'IMAGE',
      numFaces: 2,
      // The B2 trial changes only the classifier; do not add blendshape work
      // compared with the realtime B0 control. Legacy feature extraction stays explicit.
      outputFaceBlendshapes: Boolean(candidate) || (research && profile === 'product'),
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.6,
      minFacePresenceConfidence: 0.6,
    },
  );
  const options: Ort.InferenceSession.SessionOptions = {
    executionProviders: [contract.backend],
    graphOptimizationLevel: 'all',
  };
  session =
    profile !== 'product'
      ? await ort.InferenceSession.create(await loadResearchFaceModel(profile), options)
      : await ort.InferenceSession.create('/models/enet_b2_8.onnx', options);
  await warmClassifier(ort, session, classifierSize);
  if (candidate) {
    auxiliary = auxiliaryManifestSchema.parse(candidate.manifest);
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', candidate.bytes)),
      (v) => v.toString(16).padStart(2, '0'),
    ).join('');
    if (hash !== auxiliary.sha256 || candidate.bytes.byteLength !== auxiliary.bytes)
      throw new Error('Checksum model phụ không khớp');
    auxiliarySession = await ort.InferenceSession.create(candidate.bytes, {
      executionProviders: ['wasm'],
    });
  }
  self.postMessage({
    type: 'ready',
    detectorDelegate: delegate,
    classifierBackend: contract.backend,
    modelVersion: auxiliary ? `${modelVersion}+${auxiliary.version}` : modelVersion,
  });
}

function alignedCrop(
  points: NormalizedLandmark[],
  pose: ReturnType<typeof estimateHeadPose>,
  source: ImageBitmap,
): QualityReason | null {
  const xs = points.map((p) => p.x * canvas.width);
  const ys = points.map((p) => p.y * canvas.height);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  if (maxX - minX < 90 || maxY - minY < 90) return 'face-too-small';
  if (minX < 0 || minY < 0 || maxX > canvas.width || maxY > canvas.height) return 'face-outside';
  if (!pose || !isSupportedHeadPose(pose)) return 'face-angle';
  const angle = (pose.roll * Math.PI) / 180;
  // Detection remains bounded; crop from the source preserves available detail.
  const sourceMinX = (minX * source.width) / canvas.width;
  const sourceMaxX = (maxX * source.width) / canvas.width;
  const sourceMinY = (minY * source.height) / canvas.height;
  const sourceMaxY = (maxY * source.height) / canvas.height;
  const side = Math.max(sourceMaxX - sourceMinX, sourceMaxY - sourceMinY) * 1.08;
  for (const [cropContext, size] of [
    [faceContext, classifierSize],
    [qualityContext, 64],
  ] as const) {
    cropContext.save();
    cropContext.fillStyle = '#808080';
    cropContext.fillRect(0, 0, size, size);
    cropContext.translate(size / 2, size / 2);
    cropContext.scale(size / side, size / side);
    cropContext.rotate(-angle);
    cropContext.drawImage(source, -(sourceMinX + sourceMaxX) / 2, -(sourceMinY + sourceMaxY) / 2);
    cropContext.restore();
  }
  return null;
}

async function inferAuxiliary(features: number[]) {
  if (!auxiliarySession || !auxiliary) throw new Error('Chưa nạp model phụ');
  if (features.length !== 52 || features.some((v) => !Number.isFinite(v) || v < 0 || v > 1))
    throw new Error('Đặc trưng không hợp lệ');
  const tensor = new ort.Tensor('float32', Float32Array.from(features), [1, 52]);
  let outputs: Ort.InferenceSession.ReturnType | undefined;
  try {
    outputs = await auxiliarySession.run({ [auxiliarySession.inputNames[0]]: tensor });
    return Array.from(outputs[auxiliarySession.outputNames[0]].data as Float32Array);
  } finally {
    tensor.dispose();
    if (outputs) Object.values(outputs).forEach((t) => t.dispose());
  }
}
async function infer(
  bitmap: ImageBitmap,
  timestamp: number,
  requestId?: number,
  captureFeatures = false,
  captureMs?: number,
) {
  const started = performance.now();
  const result: InferenceResult = {
    timestamp,
    label: null,
    score: 0,
    status: 'no-face',
    modelVersion: auxiliary ? `${modelVersion}+${auxiliary.version}` : modelVersion,
    processingMs: 0,
    scores: [],
    ...(Number.isFinite(captureMs) ? { captureMs } : {}),
    stages: { detectionMs: 0, cropMs: 0, classifierMs: 0 },
  };
  try {
    if (!detector || !session) throw new Error('Model chưa sẵn sàng');
    const scale = Math.min(1, 640 / bitmap.width, 480 / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const detectionStarted = performance.now();
    const detected = detector.detect(canvas);
    result.stages!.detectionMs = performance.now() - detectionStarted;
    const faces = detected.faceLandmarks;
    if (faces.length > 1) result.status = 'multiple-faces';
    else if (faces.length === 1) {
      result.status = 'poor-quality';
      const cropStarted = performance.now();
      const pose = estimateHeadPose(detected.facialTransformationMatrixes?.[0]);
      if (pose) result.pose = pose;
      result.qualityReason = alignedCrop(faces[0], pose, bitmap) ?? undefined;
      if (!result.qualityReason) {
        const rgba = qualityContext.getImageData(0, 0, 64, 64).data;
        const input = qualityInput;
        let mean = 0,
          squared = 0;
        for (let i = 0; i < input.length; i++) {
          const v = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
          input[i] = v;
          mean += v;
          squared += v * v;
        }
        mean /= input.length;
        const std = Math.sqrt(Math.max(0, squared / input.length - mean * mean));
        let laplacian = 0;
        let laplacianSquared = 0;
        let laplacianCount = 0;
        for (let y = 1; y < 63; y++) {
          for (let x = 1; x < 63; x++) {
            const i = y * 64 + x;
            const value =
              4 * input[i] - input[i - 1] - input[i + 1] - input[i - 64] - input[i + 64];
            laplacian += value;
            laplacianSquared += value * value;
            laplacianCount++;
          }
        }
        const laplacianVariance =
          laplacianSquared / laplacianCount - (laplacian / laplacianCount) ** 2;
        const quality = faceImageQuality(mean, std, laplacianVariance);
        result.qualityReason = quality.rejected;
        result.qualityWarning = quality.warning;
        if (!result.qualityReason) {
          result.stages!.cropMs = performance.now() - cropStarted;
          const classifierStarted = performance.now();
          const modelRgba = faceContext.getImageData(0, 0, classifierSize, classifierSize).data;
          const tensor = new ort.Tensor(
            'float32',
            toEmotiEffInput(modelRgba, classifierSize, classifierSize, rgbInput),
            [1, 3, classifierSize, classifierSize],
          );
          let outputs: Ort.InferenceSession.ReturnType | undefined;
          try {
            outputs = await session.run({ [session.inputNames[0]]: tensor });
            result.stages!.classifierMs = performance.now() - classifierStarted;
            result.scores = softmax(
              toSignEmoEmotionOrder(outputs[session.outputNames[0]].data as Float32Array),
            );
            result.status = 'valid';
            result.observationUsable = true;
            const categories = detected.faceBlendshapes?.[0]?.categories;
            if (categories && (captureFeatures || auxiliarySession)) {
              const map = new Map(categories.map((c) => [c.categoryName, c.score]));
              const features = FEATURE_NAMES.map((name) => map.get(name) ?? NaN);
              if (features.some((v) => !Number.isFinite(v)))
                throw new Error('MediaPipe thiếu đặc trưng blendshape');
              if (captureFeatures) result.features = features;
              if (auxiliarySession && auxiliary) {
                const scores = await inferAuxiliary(features);
                result.auxiliary = {
                  scores,
                  version: auxiliary.version,
                  threshold: auxiliary.threshold,
                  margin: auxiliary.margin,
                };
                result.modelVersion = `${modelVersion}+${auxiliary.version}`;
              }
            }
          } finally {
            tensor.dispose();
            if (outputs) Object.values(outputs).forEach((t) => t.dispose());
          }
        }
      }
    }
    result.processingMs = performance.now() - started;
    self.postMessage({ type: 'result', result, requestId });
  } finally {
    bitmap.close();
  }
}

self.onmessage = async (event: MessageEvent) => {
  const message = event.data;
  try {
    if (message.type === 'init')
      await init(
        message.candidate,
        message.research,
        message.faceProfile,
        message.research === true && message.detectorDelegate === 'GPU' ? 'GPU' : 'CPU',
      );
    if (message.type === 'frame')
      await infer(
        message.bitmap,
        message.timestamp,
        message.requestId,
        message.captureFeatures,
        message.captureMs,
      );
    if (message.type === 'parity')
      self.postMessage({
        type: 'parity',
        scores: await inferAuxiliary(message.features),
        requestId: message.requestId,
      });
    if (message.type === 'dispose') {
      detector?.close();
      await session?.release();
      await auxiliarySession?.release();
      self.close();
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      code: modelInitializationCode(error),
      requestId: message.requestId,
      message: error instanceof Error ? error.message : 'Không thể xử lý hình ảnh',
    });
  }
};
