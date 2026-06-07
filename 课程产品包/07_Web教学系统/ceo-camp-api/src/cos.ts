import { createHash, createHmac, randomUUID } from "node:crypto";
import { config, isCosConfigured } from "./config.js";

function hmacSha1(key: string | Buffer, value: string) {
  return createHmac("sha1", key).update(value).digest("hex");
}

function sha1(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function createUploadTarget(kind: string, fileName = "upload.bin") {
  const safeKind = kind.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40) || "file";
  const safeName = fileName.replace(/[^\w.\-()\u4e00-\u9fa5]/g, "-").slice(0, 80);
  const date = new Date().toISOString().slice(0, 10);
  const objectKey = `${config.cos.prefix}/${date}/${safeKind}/${randomUUID()}-${safeName}`;

  if (!isCosConfigured()) {
    if (config.localUploadEnabled) {
      return {
        provider: "local",
        objectKey,
        uploadUrl: `${config.publicApiBase}/uploads/local?key=${encodeURIComponent(objectKey)}`,
        headers: {},
        expiresAt: new Date(Date.now() + config.cos.expiresSeconds * 1000).toISOString(),
        note: "COS is not configured. Development upload will be saved to local storage."
      };
    }

    return {
      provider: "mock",
      objectKey,
      uploadUrl: "",
      headers: {},
      expiresAt: new Date(Date.now() + config.cos.expiresSeconds * 1000).toISOString(),
      note: "COS is not configured. Store objectKey only for classroom workflow testing."
    };
  }

  const host = `${config.cos.bucket}.cos.${config.cos.region}.myqcloud.com`;
  const pathname = `/${encodePath(objectKey)}`;
  const now = Math.floor(Date.now() / 1000);
  const end = now + config.cos.expiresSeconds;
  const keyTime = `${now};${end}`;
  const httpMethod = "put";
  const headerList = "host";
  const urlParamList = "";
  const httpString = `${httpMethod}\n${pathname}\n\nhost=${host}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`;
  const signKey = hmacSha1(config.cos.secretKey, keyTime);
  const signature = hmacSha1(Buffer.from(signKey, "hex"), stringToSign);
  const authorization = [
    "q-sign-algorithm=sha1",
    `q-ak=${config.cos.secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${headerList}`,
    `q-url-param-list=${urlParamList}`,
    `q-signature=${signature}`
  ].join("&");

  return {
    provider: "cos",
    objectKey,
    uploadUrl: `https://${host}${pathname}`,
    headers: {
      Authorization: authorization
    },
    expiresAt: new Date(end * 1000).toISOString()
  };
}
