import "dotenv/config";
import { randomBytes } from "node:crypto";

const defaultAuthSecret = randomBytes(32).toString("hex");
const imageEditModels = (
  process.env.QINGYUN_IMAGE_EDIT_MODELS ??
  process.env.QINGYUN_IMAGE_EDIT_MODEL ??
  "grok-imagine-image"
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 7001),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  authSecret: process.env.AUTH_SECRET ?? process.env.TEACHER_TOKEN ?? defaultAuthSecret,
  authTokenExpiresSeconds: Number(process.env.AUTH_TOKEN_EXPIRES_SECONDS ?? 60 * 60 * 12),
  teacherSeed: {
    username: process.env.TEACHER_SEED_USERNAME ?? process.env.TEACHER_USERNAME ?? "teacher",
    password: process.env.TEACHER_SEED_PASSWORD ?? process.env.TEACHER_PASSWORD ?? "change-me-before-class",
    displayName: process.env.TEACHER_SEED_DISPLAY_NAME ?? "主讲老师"
  },
  studentDefaultPassword: process.env.STUDENT_DEFAULT_PASSWORD ?? "camp2026",
  databasePath: process.env.DATABASE_PATH ?? "./data/camp.db",
  publicApiBase: process.env.PUBLIC_API_BASE ?? "http://localhost:7001",
  localUploadEnabled:
    process.env.LOCAL_UPLOAD_ENABLED === undefined
      ? (process.env.NODE_ENV ?? "development") !== "production"
      : process.env.LOCAL_UPLOAD_ENABLED === "true",
  localUploadDir: process.env.LOCAL_UPLOAD_DIR ?? "./uploads",
  cos: {
    secretId: process.env.COS_SECRET_ID ?? "",
    secretKey: process.env.COS_SECRET_KEY ?? "",
    bucket: process.env.COS_BUCKET ?? "",
    region: process.env.COS_REGION ?? "ap-beijing",
    prefix: process.env.COS_UPLOAD_PREFIX ?? "ceo-camp",
    expiresSeconds: Number(process.env.COS_UPLOAD_EXPIRES_SECONDS ?? 900)
  },
  qingyun: {
    apiKey: process.env.QINGYUN_API_KEY ?? "",
    baseUrl: process.env.QINGYUN_BASE_URL ?? "https://api.qingyuntop.top/v1",
    imageEditModel: imageEditModels[0] ?? "grok-imagine-image",
    imageEditModels,
    timeoutMs: Number(process.env.QINGYUN_TIMEOUT_MS ?? 180_000)
  },
  futurePhoto: {
    dailyAutoLimit: Number(process.env.FUTURE_PHOTO_DAILY_LIMIT ?? 5),
    maxAutoAttempts: Number(process.env.FUTURE_PHOTO_MAX_AUTO_ATTEMPTS ?? 1)
  }
};

export function isCosConfigured() {
  return Boolean(
    config.cos.secretId &&
      config.cos.secretKey &&
      config.cos.bucket &&
      config.cos.region
  );
}

export function isQingyunConfigured() {
  return Boolean(config.qingyun.apiKey && config.qingyun.baseUrl && config.qingyun.imageEditModel);
}
