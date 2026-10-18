import { z } from 'zod';

export const MODEL_VERSION = 'emotiefflib-enet-b2-8-demo-v1';
export const CONSENT_VERSION = 'pilot-v2-2026-10';
export const expressions = [
  'happy',
  'sad',
  'angry',
  'surprised',
  'fear',
  'disgust',
  'neutral',
] as const;
export type Expression = (typeof expressions)[number];
/** Stable score order shared by every face adapter; contempt remains unsupported. */
export const faceScoreLabels: readonly (Expression | null)[] = [
  'neutral',
  'happy',
  'surprised',
  'sad',
  'angry',
  'disgust',
  'fear',
  null,
];
export type InferenceStatus = 'valid' | 'uncertain' | 'no-face' | 'multiple-faces' | 'poor-quality';
export type HapticMode = 'auto' | 'visual' | 'off';
export type CameraMirrorMode = 'auto' | 'mirror' | 'normal';
export type ConversationAsrProfile = 'product' | 'moonshine-streaming-vi-research';
export type QualityReason =
  | 'face-too-small'
  | 'face-outside'
  | 'face-angle'
  | 'too-dark'
  | 'too-bright'
  | 'low-contrast'
  | 'blurred';
export type DecisionReason =
  | 'invalid-input'
  | 'unsupported-class'
  | 'low-score'
  | 'small-margin'
  | 'stabilizing'
  | 'cooldown'
  | 'held-expression'
  | 'neutral'
  | 'stable-change'
  | 'auxiliary-uncertain'
  | 'stale-result';
export interface InferenceResult {
  timestamp: number;
  /** Main-thread time spent capturing this frame, when available. */
  captureMs?: number;
  /** End-to-end capture-to-result time, when measured by a live camera session. */
  latencyMs?: number;
  stages?: { detectionMs: number; cropMs: number; classifierMs: number };
  label: Expression | null;
  score: number;
  status: InferenceStatus;
  modelVersion: string;
  processingMs: number;
  scores: number[];
  qualityReason?: QualityReason;
  /** Mild blur only; severe image/geometry failures remain unusable. */
  qualityWarning?: 'blurred';
  /** A usable measurement is independent of whether its displayed label has stabilized. */
  observationUsable?: boolean;
  pose?: { yaw: number; pitch: number; roll: number };
  rawScores?: number[];
  decisionReason?: DecisionReason;
  margin?: number;
  auxiliary?: { scores: number[]; version: string; threshold: number; margin: number };
  features?: number[]; // Explicit research extraction only; never PilotReport or ordinary logs.
}
export interface HapticEvent {
  expression: Exclude<Expression, 'neutral'>;
  timestamp: number;
  reason: 'stable-change' | 'practice';
  apiAccepted: boolean;
  visual: boolean;
  output: 'vibration' | 'audio' | 'visual';
}
export interface CalibrationProfile {
  thresholds: Partial<Record<Expression, number>>;
  margins: Partial<Record<Expression, number>>;
}
export interface Settings {
  threshold: number;
  dwellMs: number;
  cooldownMs: number;
  haptics: boolean;
  hapticMode?: HapticMode;
  soundFeedback: boolean;
  cameraMirror: CameraMirrorMode;
  asrProfile: ConversationAsrProfile;
  captionColors?: boolean;
  expressionAvatar?: boolean;
  signLanguageCues?: boolean;
  signPhrasePlayback?: boolean;
  saveConversations?: boolean;
}
export const defaultSettings: Settings = {
  threshold: 0.55,
  dwellMs: 200,
  cooldownMs: 3000,
  haptics: true,
  hapticMode: 'auto',
  soundFeedback: false,
  cameraMirror: 'auto',
  asrProfile: 'product',
  captionColors: true,
  expressionAvatar: true,
  signLanguageCues: true,
  signPhrasePlayback: true,
  saveConversations: false,
};
export const settingsSchema = z
  .object({
    threshold: z.number().min(0.5).max(0.95),
    dwellMs: z.number().min(100).max(1500),
    cooldownMs: z.number().min(3000).max(10000),
    haptics: z.boolean(),
    hapticMode: z.enum(['auto', 'visual', 'off']).optional(),
    soundFeedback: z.boolean().default(false),
    cameraMirror: z.enum(['auto', 'mirror', 'normal']).default('auto'),
    asrProfile: z.enum(['product', 'moonshine-streaming-vi-research']).default('product'),
    captionColors: z.boolean().default(true),
    expressionAvatar: z.boolean().default(true),
    signLanguageCues: z.boolean().default(true),
    signPhrasePlayback: z.boolean().default(true),
    saveConversations: z.boolean().default(false),
  })
  .strict();

export const metricsSchema = z
  .object({
    durationMs: z.number().finite().min(0).max(86_400_000),
    processedFrames: z.number().int().min(0).max(1_000_000),
    invalidFrames: z.number().int().min(0).max(1_000_000),
    uncertainFrames: z.number().int().min(0).max(1_000_000),
    hapticCount: z.number().int().min(0).max(30_000),
    p50Ms: z.number().finite().min(0).max(60_000),
    p95Ms: z.number().finite().min(0).max(60_000),
  })
  .strict()
  .refine(
    (m) => m.invalidFrames + m.uncertainFrames <= m.processedFrames && m.p50Ms <= m.p95Ms,
    'Thống kê không hợp lệ',
  );
export type SessionMetrics = z.infer<typeof metricsSchema>;
export const reportSchema = z
  .object({
    id: z.uuid(),
    consentVersion: z.literal(CONSENT_VERSION),
    modelVersion: z.string().min(1).max(80),
    createdAt: z.iso.datetime(),
    feedback: z
      .object({
        usefulness: z.number().int().min(1).max(5),
        distraction: z.number().int().min(1).max(5),
        comment: z.string().trim().max(1000),
      })
      .strict(),
    metrics: metricsSchema,
  })
  .strict();
export type PilotReport = z.infer<typeof reportSchema>;
export const submissionSchema = z
  .object({ report: reportSchema, deletionToken: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const withdrawalSchema = z
  .object({ reportId: z.uuid(), deletionToken: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export interface ModelManifest {
  version: string;
  assets: { url: string; bytes: number; sha256: string; source: string; license: string }[];
  input: { shape: number[]; type: string; preprocessing: string };
  labels: string[];
}

export const expressionUI: Record<
  Expression,
  {
    name: string;
    icon: string;
    short: string;
    pattern: number[];
    description: string;
    color: string;
  }
> = {
  happy: {
    color: '#7A5700',
    name: 'Vui',
    icon: '😊',
    short: 'Một nhịp dài',
    pattern: [240],
    description: 'Biểu cảm giống vui',
  },
  sad: {
    color: '#245C8B',
    name: 'Buồn',
    icon: '😔',
    short: 'Hai nhịp chậm',
    pattern: [160, 220, 160],
    description: 'Biểu cảm giống buồn',
  },
  angry: {
    color: '#9C3428',
    name: 'Giận',
    icon: '😠',
    short: 'Ba nhịp nhanh',
    pattern: [70, 70, 70, 70, 70],
    description: 'Biểu cảm giống giận',
  },
  surprised: {
    color: '#9B3E73',
    name: 'Ngạc nhiên',
    icon: '😮',
    short: 'Một nhịp ngắn',
    pattern: [80],
    description: 'Biểu cảm giống ngạc nhiên',
  },
  fear: {
    color: '#684293',
    name: 'Sợ hãi',
    icon: '😨',
    short: 'Hai ngắn, một dài',
    pattern: [70, 100, 70, 180, 240],
    description: 'Biểu cảm giống sợ hãi',
  },
  disgust: {
    color: '#4F651F',
    name: 'Khó chịu / ghê sợ',
    icon: '😖',
    short: 'Một dài, một ngắn',
    pattern: [240, 180, 80],
    description: 'Biểu cảm giống ghê sợ',
  },
  neutral: {
    color: '#24322C',
    name: 'Trung tính',
    icon: '😐',
    short: 'Không rung',
    pattern: [],
    description: 'Biểu cảm trung tính',
  },
};
