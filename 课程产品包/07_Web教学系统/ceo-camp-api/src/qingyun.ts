import { randomUUID } from "node:crypto";
import { config, isQingyunConfigured } from "./config.js";
import { putCosObject, readCosObject } from "./cos.js";

interface FuturePhotoInput {
  submissionId: string;
  studentName: string;
  careerText: string;
  sourcePhotoKey: string;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function buildFuturePhotoPrompt(studentName: string, careerText: string) {
  return [
    "请基于上传的人像照片，生成一张“未来职业照”。",
    `人物设定：${studentName || "这位同学"}长大后成为${careerText}。`,
    "请保留原照片中的主要身份特征、亲和气质和自然表情，但呈现为25到30岁左右的成年人。",
    "画面要像专业职业形象照或电影感职业海报，真实、温暖、有未来感。",
    "服装、道具和背景需要清楚体现职业线索，但不要夸张，不要出现文字、logo、水印或夸张滤镜。",
    "整体适合儿童课堂大屏展示，积极、可信、明亮。"
  ].join("\n");
}

async function downloadGeneratedImage(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(config.qingyun.timeoutMs)
  });
  if (!response.ok) {
    throw new Error(`QINGYUN_IMAGE_DOWNLOAD_FAILED_${response.status}`);
  }
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "image/png"
  };
}

export async function generateFuturePhotoWithQingyun(input: FuturePhotoInput) {
  if (!isQingyunConfigured()) {
    throw new Error("QINGYUN_NOT_CONFIGURED");
  }
  if (!input.sourcePhotoKey) {
    throw new Error("SOURCE_PHOTO_REQUIRED");
  }

  const source = await readCosObject(input.sourcePhotoKey);
  const form = new FormData();
  form.append("model", config.qingyun.imageEditModel);
  form.append("prompt", buildFuturePhotoPrompt(input.studentName, input.careerText));
  form.append("n", "1");
  form.append("image", new Blob([source.body], { type: source.contentType }), "source-photo.png");

  const response = await fetch(`${normalizeBaseUrl(config.qingyun.baseUrl)}/images/edits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.qingyun.apiKey}`
    },
    body: form,
    signal: AbortSignal.timeout(config.qingyun.timeoutMs)
  });
  const responseText = await response.text();
  let payload: any = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = { raw: responseText };
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || responseText || `HTTP ${response.status}`;
    throw new Error(`QINGYUN_GENERATION_FAILED: ${message}`);
  }

  const firstImage = payload?.data?.[0];
  let generated: { body: Buffer; contentType: string };
  if (firstImage?.b64_json) {
    generated = {
      body: Buffer.from(String(firstImage.b64_json), "base64"),
      contentType: "image/png"
    };
  } else if (firstImage?.url) {
    generated = await downloadGeneratedImage(String(firstImage.url));
  } else {
    throw new Error("QINGYUN_EMPTY_IMAGE_RESULT");
  }

  const date = new Date().toISOString().slice(0, 10);
  const resultKey = `${config.cos.prefix}/${date}/future-photo-result/${input.submissionId}-${randomUUID()}.png`;
  await putCosObject(resultKey, generated.body, generated.contentType);

  return {
    resultPhotoKey: resultKey,
    provider: "qingyuntop",
    model: config.qingyun.imageEditModel
  };
}
