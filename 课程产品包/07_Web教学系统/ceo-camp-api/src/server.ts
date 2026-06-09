import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  hashPassword,
  issueStudentPhotoUploadToken,
  issueStudentToken,
  issueTeacherToken,
  verifyPassword,
  verifyStudentPhotoUploadToken,
  verifyStudentToken,
  verifyTeacherToken,
  type StudentPrincipal,
  type TeacherPrincipal
} from "./auth.js";
import { config } from "./config.js";
import { createUploadTarget, readCosObject } from "./cos.js";
import { broadcast, addClient, removeClient, clientCount } from "./events.js";
import { generateFuturePhotoWithQingyun } from "./qingyun.js";
import { db, initializeDatabase, nowSql, openDatabase, row, rows } from "./db.js";
import type { JsonValue } from "./types.js";

await openDatabase();
initializeDatabase();
ensureDefaultTeacher();
ensureStudentAccounts();

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info"
  },
  bodyLimit: 20 * 1024 * 1024
});

const uploadBodyLimit = 80 * 1024 * 1024;
recoverFuturePhotoJobs();
scheduleFuturePhotoWorker();

type FuturePhotoSubmissionRow = Record<string, any>;
type FuturePhotoJobRow = {
  id: string;
  camp_id: string;
  submission_id: string;
  provider: string;
  model?: string | null;
  status: string;
  attempt: number;
  max_attempts: number;
  error_message?: string | null;
};

app.addContentTypeParser(/^image\/.+$/, { parseAs: "buffer", bodyLimit: uploadBodyLimit }, (_request, body, done) => {
  done(null, body);
});

app.addContentTypeParser(/^video\/.+$/, { parseAs: "buffer", bodyLimit: uploadBodyLimit }, (_request, body, done) => {
  done(null, body);
});

app.addContentTypeParser(
  "application/octet-stream",
  { parseAs: "buffer", bodyLimit: uploadBodyLimit },
  (_request, body, done) => {
    done(null, body);
  }
);

await app.register(cors, {
  origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(",").map((s) => s.trim()),
  credentials: true
});

function campId() {
  return "beijing-2026-summer";
}

function responseCorsOrigin(requestOrigin: unknown) {
  if (config.corsOrigin === "*") return "*";
  const allowedOrigins = config.corsOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (typeof requestOrigin === "string" && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  return allowedOrigins[0] ?? "*";
}

function jsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type TaskPayload = Record<string, unknown>;
type TaskArtifact = Record<string, any> & {
  task_type: string;
  payload: TaskPayload;
  created_at?: string;
  updated_at?: string;
};
type ScoreDimension = "user_realness" | "mvp_completion" | "ai_collaboration" | "story_expression" | "team_pitch";
type ScoreSummary = {
  key: string;
  showcase_item_id?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  product_name: string;
  access_url?: string | null;
  score_count: number;
  average_total: number;
  scores: Record<ScoreDimension, number>;
  highlights: string[];
  next_steps: string[];
};
type ProblemVoteSummary = {
  problem_id: string;
  vote_count: number;
  problem_scene: string;
  target_user: string;
  trouble: string;
  current_solution: string;
  team_name?: string | null;
  student_name?: string | null;
};

const scoreDimensions: ScoreDimension[] = [
  "user_realness",
  "mvp_completion",
  "ai_collaboration",
  "story_expression",
  "team_pitch"
];
const classroomMediaAssetTypes = new Set([
  "product-screenshot",
  "product-poster",
  "final-showcase-screenshot",
  "product-recording",
  "final-showcase-recording"
]);

function requireTeacher(request: { headers: Record<string, unknown> }): TeacherPrincipal | null {
  const header = request.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const principal = verifyTeacherToken(header.slice("Bearer ".length));
  if (!principal) return null;
  const teacher = row<TeacherPrincipal & { status: string }>(
    "SELECT id, username, display_name, role, status FROM teachers WHERE id = ?",
    principal.id
  );
  if (!teacher || teacher.status !== "ACTIVE") return null;
  return {
    id: teacher.id,
    username: teacher.username,
    display_name: teacher.display_name,
    role: teacher.role
  };
}

function requireStudent(request: { headers: Record<string, unknown> }): StudentPrincipal | null {
  const header = request.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const principal = verifyStudentToken(header.slice("Bearer ".length));
  if (!principal) return null;
  return activeStudent(principal.id);
}

function requireStudentPhotoUpload(
  request: { headers: Record<string, unknown> },
  expectedStudentId?: string
): StudentPrincipal | null {
  const header = request.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const principal = verifyStudentPhotoUploadToken(header.slice("Bearer ".length));
  if (!principal) return null;
  if (expectedStudentId && principal.id !== expectedStudentId) return null;
  return activeStudent(principal.id);
}

function activeStudent(studentId: string): StudentPrincipal | null {
  const student = row<StudentPrincipal & { account_status: string }>(
    "SELECT id, username, nickname, student_no, account_status FROM students WHERE id = ?",
    studentId
  );
  if (!student || student.account_status !== "ACTIVE") return null;
  return {
    id: student.id,
    username: student.username,
    nickname: student.nickname,
    student_no: student.student_no ?? null
  };
}

function ensureDefaultTeacher() {
  const count = row<{ count: number }>("SELECT COUNT(*) AS count FROM teachers")?.count ?? 0;
  if (count > 0) return;
  const id = randomUUID();
  const username = config.teacherSeed.username.trim().toLowerCase() || "teacher";
  db.prepare(
    `INSERT INTO teachers
      (id, username, display_name, password_hash, role, status, updated_at)
     VALUES
      (@id, @username, @display_name, @password_hash, 'TEACHER', 'ACTIVE', @updated_at)`
  ).run({
    id,
    username,
    display_name: config.teacherSeed.displayName,
    password_hash: hashPassword(config.teacherSeed.password),
    updated_at: nowSql()
  });
}

function normalizeStudentUsername(username: string) {
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

function studentUsernameFromNo(studentNo: unknown, fallbackIndex: number) {
  const digits = String(studentNo ?? "").replace(/\D/g, "");
  return `student${(digits || String(fallbackIndex)).padStart(2, "0")}`;
}

function uniqueStudentUsername(baseUsername: string, used: Set<string>) {
  const base = normalizeStudentUsername(baseUsername) || `student${String(used.size + 1).padStart(2, "0")}`;
  let username = base;
  let suffix = 2;
  while (used.has(username)) {
    username = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(username);
  return username;
}

function ensureStudentAccounts() {
  const students = rows<{ id: string; student_no?: string | null; username?: string | null; password_hash?: string | null }>(
    "SELECT id, student_no, username, password_hash FROM students WHERE camp_id = ? ORDER BY COALESCE(student_no, created_at), created_at",
    campId()
  );
  const used = new Set(
    students
      .map((student) => normalizeStudentUsername(String(student.username ?? "")))
      .filter(Boolean)
  );
  students.forEach((student, index) => {
    if (student.username && student.password_hash) return;
    const username = student.username
      ? normalizeStudentUsername(student.username)
      : uniqueStudentUsername(studentUsernameFromNo(student.student_no, index + 1), used);
    db.prepare(
      `UPDATE students
          SET username = ?,
              password_hash = ?,
              account_status = COALESCE(account_status, 'ACTIVE'),
              updated_at = ?
        WHERE id = ?`
    ).run(username, student.password_hash ?? hashPassword(config.studentDefaultPassword), nowSql(), student.id);
  });
}

function isSafeObjectKey(objectKey: string) {
  return Boolean(objectKey && !objectKey.startsWith("/") && !objectKey.includes("..") && !objectKey.includes("\\"));
}

function canReadWallObject(objectKey: string) {
  if (!isSafeObjectKey(objectKey)) return false;
  const approvedFuturePhoto = row(
      `SELECT f.id
         FROM future_photo_submissions f
         JOIN students s ON s.id = f.student_id
        WHERE f.result_photo_key = ?
          AND f.status = 'APPROVED'
          AND s.display_status = 'ON_WALL'
        LIMIT 1`,
      objectKey
  );
  if (approvedFuturePhoto) return true;
  return Boolean(
    row(
      `SELECT id
         FROM media_assets
        WHERE camp_id = ?
          AND object_key = ?
          AND asset_type IN (
            'product-screenshot',
            'product-poster',
            'final-showcase-screenshot',
            'product-recording',
            'final-showcase-recording'
          )
          AND display_permission IN ('CLASSROOM', 'PUBLIC')
        LIMIT 1`,
      [campId(), objectKey]
    )
  );
}

function localUploadPath(objectKey: string) {
  const root = resolve(config.localUploadDir);
  const target = resolve(root, objectKey);
  if (!target.startsWith(`${root}/`) && target !== root) {
    throw new Error("Invalid upload key");
  }
  return target;
}

function contentTypeForObjectKey(objectKey: string) {
  const extension = extname(objectKey).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".heic") return "image/heic";
  if (extension === ".heif") return "image/heif";
  if (extension === ".mp4" || extension === ".m4v") return "video/mp4";
  if (extension === ".webm") return "video/webm";
  if (extension === ".mov") return "video/quicktime";
  return "application/octet-stream";
}

async function readPrivateUploadObject(objectKey: string) {
  if (!isSafeObjectKey(objectKey)) throw new Error("INVALID_UPLOAD_KEY");
  if (config.localUploadEnabled) {
    const localPath = localUploadPath(objectKey);
    if (existsSync(localPath)) {
      const body = readFileSync(localPath);
      return {
        body,
        contentType: contentTypeForObjectKey(objectKey),
        contentLength: String(body.length)
      };
    }
  }
  return readCosObject(objectKey);
}

function audit(action: string, targetType?: string, targetId?: string, payload: JsonValue = {}, actor = "teacher") {
  db.prepare(
    `INSERT INTO audit_logs (id, camp_id, actor, action, target_type, target_id, payload)
     VALUES (@id, @camp_id, @actor, @action, @target_type, @target_id, @payload)`
  ).run({
    id: randomUUID(),
    camp_id: campId(),
    actor,
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    payload: JSON.stringify(payload)
  });
}

function currentCamp() {
  const camp = row<Record<string, any>>("SELECT * FROM camp_offerings WHERE id = ?", campId());
  const activeTask = row<Record<string, any>>(
    "SELECT * FROM class_activities WHERE camp_id = ? AND status = 'ACTIVE' ORDER BY updated_at DESC LIMIT 1",
    campId()
  );
  return {
    ...camp,
    public_copy: jsonParse((camp as { public_copy?: string } | undefined)?.public_copy, {}),
    active_task: activeTask ? { ...activeTask, payload: jsonParse(activeTask.payload, {}) } : null
  };
}

function courseModules() {
  const modules = rows("SELECT * FROM course_modules WHERE camp_id = ? ORDER BY day, sequence", campId());
  const pages = rows("SELECT * FROM lesson_pages ORDER BY module_id, page_no");
  return modules.map((module) => ({
    ...module,
    pages: pages
      .filter((page) => page.module_id === module.id)
      .map((page) => ({
        ...page,
        activity_buttons: jsonParse(page.activity_buttons, [])
      }))
  }));
}

function serializeStudent(student: Record<string, any>) {
  return {
    id: student.id,
    student_no: student.student_no,
    nickname: student.nickname,
    real_name: student.real_name,
    age: student.age,
    guardian_contact_masked: student.guardian_contact_masked,
    checkin_status: student.checkin_status,
    photo_authorization: student.photo_authorization,
    projection_consent: Boolean(student.projection_consent),
    public_showcase_consent: Boolean(student.public_showcase_consent),
    team_id: student.team_id,
    team_name: student.team_name,
    display_status: student.display_status,
    username: student.username,
    account_status: student.account_status ?? "ACTIVE",
    last_login_at: student.last_login_at
  };
}

function wallData() {
  const students = rows(
    `SELECT s.*, t.name AS team_name
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.camp_id = ?
      ORDER BY COALESCE(s.student_no, s.created_at), s.created_at`,
    campId()
  );
  const submissions = rows(
    `SELECT *
       FROM future_photo_submissions
      WHERE camp_id = ?
      ORDER BY created_at DESC`,
    campId()
  );
  return students.map((student) => {
    const submission = submissions.find((item) => item.student_id === student.id);
    return {
      id: student.id,
      nickname: student.nickname,
      student_no: student.student_no,
      age: student.age,
      team_id: student.team_id,
      team_name: student.team_name,
      display_status: student.display_status,
      projection_consent: Boolean(student.projection_consent),
      public_showcase_consent: Boolean(student.public_showcase_consent),
      photo_authorization: student.photo_authorization,
      future_photo: submission
        ? {
            id: submission.id,
            career_text: submission.career_text,
            status: submission.status,
            result_photo_key:
              submission.status === "APPROVED" && student.display_status === "ON_WALL"
                ? submission.result_photo_key
                : null,
            result_photo_url:
              submission.status === "APPROVED" && student.display_status === "ON_WALL" && submission.result_photo_key
                ? `${config.publicApiBase}/media/object?key=${encodeURIComponent(String(submission.result_photo_key))}`
                : null
          }
        : null
    };
  });
}

function showcaseItems(includeAll = false) {
  const statusClause = includeAll ? "" : "AND s.publish_status = 'PUBLISHED'";
  return rows(
    `SELECT s.*, t.name AS team_name
       FROM showcase_items s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.camp_id = ?
        ${statusClause}
      ORDER BY s.updated_at DESC, s.created_at DESC`,
    campId()
  ).map((item) => ({
    id: item.id,
    team_id: item.team_id,
    team_name: item.team_name,
    product_name: item.product_name,
    track: item.track,
    one_liner: item.one_liner,
    access_url: item.access_url,
    screenshot_key: item.screenshot_key,
    screenshot_url: item.screenshot_key
      ? `${config.publicApiBase}/media/object?key=${encodeURIComponent(String(item.screenshot_key))}`
      : item.screenshot_url ?? null,
    recording_key: item.recording_key,
    recording_url: item.recording_key
      ? `${config.publicApiBase}/media/object?key=${encodeURIComponent(String(item.recording_key))}`
      : item.recording_url ?? null,
    publish_status: item.publish_status,
    created_at: item.created_at,
    updated_at: item.updated_at
  }));
}

function wallTaskArtifacts(): TaskArtifact[] {
  return rows<Record<string, any> & { payload?: string }>(
    `SELECT ts.*, s.nickname AS student_name, t.name AS team_name
       FROM task_submissions ts
       LEFT JOIN students s ON s.id = ts.student_id
       LEFT JOIN teams t ON t.id = ts.team_id
      WHERE ts.camp_id = ?
        AND ts.status = 'ON_WALL'
        AND ts.task_type IN ('problem_card', 'market_scout', 'user_voice', 'ai_validation', 'product_definition', 'prompt_card', 'feature_scope', 'tech_route', 'iteration_plan', 'value_card', 'product_packaging', 'story_pitch', 'final_showcase')
      ORDER BY ts.updated_at DESC, ts.created_at DESC`,
    campId()
  ).map((artifact): TaskArtifact => {
    const base = artifact as Record<string, any>;
    return {
      ...base,
      task_type: String(base.task_type ?? ""),
      payload: jsonParse<TaskPayload>(base.payload, {})
    };
  });
}

function finalShowcaseItems() {
  return wallTaskArtifacts()
    .filter((artifact) => artifact.task_type === "final_showcase")
    .sort((a, b) => {
      const aOrder = Number(a.payload?.display_order ?? 9999);
      const bOrder = Number(b.payload?.display_order ?? 9999);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.updated_at ?? "").localeCompare(String(b.updated_at ?? ""));
    });
}

function growthReflectionItems() {
  return rows<Record<string, any> & { payload?: string }>(
    `SELECT ts.*, s.nickname AS student_name, t.name AS team_name
       FROM task_submissions ts
       LEFT JOIN students s ON s.id = ts.student_id
       LEFT JOIN teams t ON t.id = ts.team_id
      WHERE ts.camp_id = ?
        AND ts.status = 'ON_WALL'
        AND ts.task_type = 'growth_reflection'
      ORDER BY ts.updated_at DESC, ts.created_at DESC`,
    campId()
  ).map((artifact): TaskArtifact => {
    const base = artifact as Record<string, any>;
    return {
      ...base,
      task_type: "growth_reflection",
      payload: jsonParse<TaskPayload>(base.payload, {})
    };
  });
}

function projectJourneyItems() {
  return rows<Record<string, any> & { payload?: string }>(
    `SELECT ts.*, s.nickname AS student_name, t.name AS team_name
       FROM task_submissions ts
       LEFT JOIN students s ON s.id = ts.student_id
       LEFT JOIN teams t ON t.id = ts.team_id
      WHERE ts.camp_id = ?
        AND ts.status = 'ON_WALL'
        AND ts.task_type IN ('problem_card', 'market_scout', 'user_voice', 'ai_validation', 'product_definition', 'prompt_card', 'feature_scope', 'tech_route', 'product_feedback', 'iteration_plan', 'value_card', 'product_packaging', 'story_pitch', 'mentor_comment')
      ORDER BY ts.updated_at ASC, ts.created_at ASC`,
    campId()
  ).map((artifact): TaskArtifact => {
    const base = artifact as Record<string, any>;
    return {
      ...base,
      task_type: String(base.task_type ?? ""),
      payload: jsonParse<TaskPayload>(base.payload, {})
    };
  });
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function problemTitleFor(item: TaskArtifact | null | undefined) {
  if (!item) return "";
  return textValue(item.payload.problem_scene) || textValue(item.payload.trouble) || "一个真实问题";
}

function serializeTeam(team: Record<string, any>) {
  return {
    ...team,
    roles: jsonParse(team.roles, {}),
    selected_problem_votes: Number(team.selected_problem_votes ?? 0)
  };
}

function problemVoteCandidates() {
  return rows<Record<string, any> & { payload?: string }>(
    `SELECT ts.*, s.nickname AS student_name, t.name AS team_name
       FROM task_submissions ts
       LEFT JOIN students s ON s.id = ts.student_id
       LEFT JOIN teams t ON t.id = ts.team_id
      WHERE ts.camp_id = ?
        AND ts.task_type = 'problem_card'
      ORDER BY ts.created_at DESC`,
    campId()
  ).map((artifact): TaskArtifact => {
    const base = artifact as Record<string, any>;
    return {
      ...base,
      task_type: "problem_card",
      payload: jsonParse<TaskPayload>(base.payload, {})
    };
  });
}

function problemVoteCount(problemId: string, activityId = "") {
  return problemVoteSummaries(activityId).find((summary) => summary.problem_id === problemId)?.vote_count ?? 0;
}

function selectedProblemForTeam(teamId?: string | null) {
  if (!teamId) return null;
  const team = row<{ selected_problem_id?: string | null }>(
    "SELECT selected_problem_id FROM teams WHERE id = ? AND camp_id = ?",
    [teamId, campId()]
  );
  const problemId = String(team?.selected_problem_id ?? "");
  if (!problemId) return null;
  return problemVoteCandidates().find((candidate) => candidate.id === problemId) || null;
}

function problemVoteActivityId() {
  const activeTask = currentCamp().active_task as Record<string, any> | null;
  if (!activeTask) return "";
  const payload = activeTask.payload && typeof activeTask.payload === "object"
    ? activeTask.payload as Record<string, unknown>
    : {};
  const payloadType = textValue(payload.task_type);
  return activeTask.activity_type === "problem_vote" || payloadType === "problem_vote"
    ? String(activeTask.id ?? "")
    : "";
}

function problemVoteItems(activityId = "") {
  return rows<Record<string, any> & { payload?: string }>(
    `SELECT ts.*, s.nickname AS student_name, t.name AS team_name
       FROM task_submissions ts
       LEFT JOIN students s ON s.id = ts.student_id
       LEFT JOIN teams t ON t.id = ts.team_id
      WHERE ts.camp_id = ?
        AND ts.task_type = 'problem_vote'
      ORDER BY ts.updated_at DESC, ts.created_at DESC`,
    campId()
  )
    .map((artifact): TaskArtifact => {
      const base = artifact as Record<string, any>;
      return {
        ...base,
        task_type: "problem_vote",
        payload: jsonParse<TaskPayload>(base.payload, {})
      };
    })
    .filter((artifact) => !activityId || textValue(artifact.payload.activity_id) === activityId);
}

function selectedProblemIds(payload: TaskPayload) {
  const raw = payload.selected_problem_ids;
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map((id) => String(id ?? "").trim()).filter(Boolean))).slice(0, 3);
}

function problemVoteSummaries(activityId = ""): ProblemVoteSummary[] {
  const candidates = problemVoteCandidates();
  const candidateMap = new Map(candidates.map((item) => [item.id, item]));
  const counts = new Map<string, number>();
  for (const vote of problemVoteItems(activityId)) {
    for (const problemId of selectedProblemIds(vote.payload)) {
      if (!candidateMap.has(problemId)) continue;
      counts.set(problemId, (counts.get(problemId) ?? 0) + 1);
    }
  }
  return candidates
    .map((candidate) => ({
      problem_id: candidate.id,
      vote_count: counts.get(candidate.id) ?? 0,
      problem_scene: textValue(candidate.payload.problem_scene) || textValue(candidate.payload.trouble) || "一个真实问题",
      target_user: textValue(candidate.payload.target_user),
      trouble: textValue(candidate.payload.trouble),
      current_solution: textValue(candidate.payload.current_solution),
      team_name: candidate.team_name ?? textValue(candidate.payload.team_name) ?? null,
      student_name: candidate.student_name ?? null
    }))
    .sort((a, b) => {
      if (b.vote_count !== a.vote_count) return b.vote_count - a.vote_count;
      return a.problem_scene.localeCompare(b.problem_scene, "zh-Hans-CN");
    });
}

function mentorCommentItems(includeAll = false) {
  const statusClause = includeAll ? "" : "AND ts.status = 'ON_WALL'";
  return rows<Record<string, any> & { payload?: string }>(
    `SELECT ts.*, s.nickname AS student_name, t.name AS team_name
       FROM task_submissions ts
       LEFT JOIN students s ON s.id = ts.student_id
       LEFT JOIN teams t ON t.id = ts.team_id
      WHERE ts.camp_id = ?
        ${statusClause}
        AND ts.task_type = 'mentor_comment'
      ORDER BY ts.updated_at DESC, ts.created_at DESC`,
    campId()
  ).map((artifact): TaskArtifact => {
    const base = artifact as Record<string, any>;
    return {
      ...base,
      task_type: "mentor_comment",
      payload: jsonParse<TaskPayload>(base.payload, {})
    };
  });
}

function scoreValue(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(5, Math.max(1, Math.round(numeric)));
}

function hasObserverScoreAccess(code: unknown) {
  const expected = config.observerScoreCode.trim();
  return Boolean(expected && String(code ?? "").trim() === expected);
}

function roundedScore(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}

function observerScoreSubmissions(): Array<Record<string, any> & { payload: TaskPayload }> {
  return rows<Record<string, any> & { payload?: string }>(
    `SELECT ts.*, s.nickname AS student_name, t.name AS team_name
       FROM task_submissions ts
       LEFT JOIN students s ON s.id = ts.student_id
       LEFT JOIN teams t ON t.id = ts.team_id
      WHERE ts.camp_id = ?
        AND ts.task_type = 'observer_score'
      ORDER BY ts.created_at DESC`,
    campId()
  ).map((submission) => ({
    ...submission,
    payload: jsonParse<TaskPayload>(submission.payload, {})
  }));
}

function scoreSummaries(): ScoreSummary[] {
  const summaries = new Map<string, ScoreSummary & { scoreTotals: Record<ScoreDimension, number> }>();
  for (const submission of observerScoreSubmissions()) {
    const payload = submission.payload ?? {};
    const showcaseItemId = String(payload.showcase_item_id ?? "");
    const teamId = String(payload.team_id ?? submission.team_id ?? "");
    const productName = String(payload.product_name ?? "").trim() || "未命名作品";
    const key = showcaseItemId || teamId || productName;
    const current =
      summaries.get(key) ??
      {
        key,
        showcase_item_id: showcaseItemId || null,
        team_id: teamId || null,
        team_name: String(payload.team_name ?? submission.team_name ?? "").trim() || null,
        product_name: productName,
        access_url: String(payload.access_url ?? "").trim() || null,
        score_count: 0,
        average_total: 0,
        scores: {
          user_realness: 0,
          mvp_completion: 0,
          ai_collaboration: 0,
          story_expression: 0,
          team_pitch: 0
        },
        scoreTotals: {
          user_realness: 0,
          mvp_completion: 0,
          ai_collaboration: 0,
          story_expression: 0,
          team_pitch: 0
        },
        highlights: [],
        next_steps: []
      };

    current.score_count += 1;
    for (const dimension of scoreDimensions) {
      current.scoreTotals[dimension] += scoreValue(payload[dimension]);
    }
    const highlight = String(payload.highlight ?? "").trim();
    const nextStep = String(payload.next_step ?? "").trim();
    if (highlight && !current.highlights.includes(highlight)) current.highlights.push(highlight);
    if (nextStep && !current.next_steps.includes(nextStep)) current.next_steps.push(nextStep);
    summaries.set(key, current);
  }

  return Array.from(summaries.values())
    .map((summary) => {
      const scores = scoreDimensions.reduce<Record<ScoreDimension, number>>((acc, dimension) => {
        acc[dimension] = roundedScore(summary.scoreTotals[dimension] / summary.score_count);
        return acc;
      }, {} as Record<ScoreDimension, number>);
      const averageTotal =
        scoreDimensions.reduce((total, dimension) => total + scores[dimension], 0) / scoreDimensions.length;
      const { scoreTotals: _scoreTotals, ...publicSummary } = summary;
      return {
        ...publicSummary,
        scores,
        average_total: roundedScore(averageTotal),
        highlights: publicSummary.highlights.slice(0, 5),
        next_steps: publicSummary.next_steps.slice(0, 5)
      };
    })
    .sort((a, b) => {
      if (b.average_total !== a.average_total) return b.average_total - a.average_total;
      return b.score_count - a.score_count;
    });
}

function awardResults(includeAll = false) {
  const statusClause = includeAll ? "" : "AND publish_status = 'PUBLISHED'";
  return rows(
    `SELECT *
       FROM award_results
      WHERE camp_id = ?
        ${statusClause}
      ORDER BY updated_at DESC, created_at DESC`,
    campId()
  );
}

function emitState(event = "state.changed") {
  broadcast(event, {
    camp: currentCamp(),
    wall: wallData(),
    showcase_items: showcaseItems(false),
    wall_artifacts: wallTaskArtifacts(),
    growth_reflections: growthReflectionItems(),
    project_journey: projectJourneyItems(),
    problem_vote_summaries: problemVoteSummaries(problemVoteActivityId()),
    award_results: awardResults(false),
    score_summaries: scoreSummaries()
  });
}

function futurePhotoModels() {
  const models = config.qingyun.imageEditModels.length
    ? config.qingyun.imageEditModels
    : [config.qingyun.imageEditModel];
  return models.map((model) => model.trim()).filter(Boolean);
}

function dailyGenerationCount() {
  const dayStart = `${new Date().toISOString().slice(0, 10)} 00:00:00`;
  return (
    row<{ count: number }>(
      `SELECT COUNT(*) AS count
         FROM future_photo_jobs
        WHERE camp_id = ?
          AND provider = 'qingyuntop'
          AND status <> 'CANCELLED'
          AND created_at >= ?`,
      [campId(), dayStart]
    )?.count ?? 0
  );
}

function latestRunningFuturePhotoJob(submissionId: string) {
  return row<FuturePhotoJobRow>(
    `SELECT *
       FROM future_photo_jobs
      WHERE submission_id = ?
        AND status IN ('QUEUED', 'RUNNING')
      ORDER BY created_at DESC
      LIMIT 1`,
    submissionId
  );
}

function previousFuturePhotoJobCount(submissionId: string) {
  return (
    row<{ count: number }>(
      `SELECT COUNT(*) AS count
         FROM future_photo_jobs
        WHERE submission_id = ?
          AND status <> 'CANCELLED'`,
      submissionId
    )?.count ?? 0
  );
}

function completeFuturePhotoGeneration(
  submission: FuturePhotoSubmissionRow,
  resultPhotoKey: string,
  generationPayload: JsonValue
) {
  db.prepare(
    `UPDATE future_photo_submissions
        SET status = 'AWAITING_REVIEW',
            result_photo_key = ?,
            review_note = ?,
            updated_at = ?
      WHERE id = ?`
  ).run(resultPhotoKey, JSON.stringify(generationPayload), nowSql(), submission.id);
  if (submission.student_id) {
    db.prepare("UPDATE students SET display_status = 'AWAITING_REVIEW', updated_at = ? WHERE id = ?").run(
      nowSql(),
      submission.student_id
    );
  }
}

function enqueueFuturePhotoJob(submission: FuturePhotoSubmissionRow) {
  const existing = latestRunningFuturePhotoJob(String(submission.id));
  if (existing) return { job: existing, queued: false };

  if (!submission.source_photo_key) {
    throw new Error("SOURCE_PHOTO_REQUIRED");
  }

  const dailyLimit = Math.max(0, config.futurePhoto.dailyAutoLimit);
  if (dailyLimit === 0 || dailyGenerationCount() >= dailyLimit) {
    throw new Error(`FUTURE_PHOTO_DAILY_LIMIT_REACHED: 今日自动出图上限为 ${dailyLimit} 次`);
  }

  const models = futurePhotoModels();
  if (models.length === 0) throw new Error("QINGYUN_MODEL_NOT_CONFIGURED");

  const previousCount = previousFuturePhotoJobCount(String(submission.id));
  const model = models[Math.min(previousCount, models.length - 1)];
  const maxAttempts = Math.max(1, Math.min(config.futurePhoto.maxAutoAttempts, models.length));
  const id = randomUUID();
  const record = {
    id,
    camp_id: campId(),
    submission_id: String(submission.id),
    provider: "qingyuntop",
    model,
    status: "QUEUED",
    attempt: 0,
    max_attempts: maxAttempts,
    error_message: null,
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO future_photo_jobs
      (id, camp_id, submission_id, provider, model, status, attempt, max_attempts, error_message, updated_at)
     VALUES
      (@id, @camp_id, @submission_id, @provider, @model, @status, @attempt, @max_attempts, @error_message, @updated_at)`
  ).run(record);
  db.prepare(
    `UPDATE future_photo_submissions
        SET status = 'GENERATING',
            review_note = ?,
            updated_at = ?
      WHERE id = ?`
  ).run(
    JSON.stringify({
      mode: "qingyuntop",
      status: "queued",
      model,
      daily_limit: dailyLimit,
      auto_attempts: maxAttempts
    }),
    nowSql(),
    submission.id
  );
  if (submission.student_id) {
    db.prepare("UPDATE students SET display_status = 'GENERATING', updated_at = ? WHERE id = ?").run(
      nowSql(),
      submission.student_id
    );
  }
  audit("future_photo.job.queued", "future_photo_jobs", id, record);
  emitState("future_photo.queued");
  scheduleFuturePhotoWorker();
  return { job: row<FuturePhotoJobRow>("SELECT * FROM future_photo_jobs WHERE id = ?", id), queued: true };
}

let futurePhotoWorkerRunning = false;

function scheduleFuturePhotoWorker() {
  setTimeout(() => {
    void processFuturePhotoQueue();
  }, 0);
}

async function processFuturePhotoQueue() {
  if (futurePhotoWorkerRunning) return;
  futurePhotoWorkerRunning = true;
  try {
    for (;;) {
      const job = row<FuturePhotoJobRow>(
        `SELECT *
           FROM future_photo_jobs
          WHERE camp_id = ?
            AND status = 'QUEUED'
          ORDER BY created_at ASC
          LIMIT 1`,
        campId()
      );
      if (!job) break;
      await processFuturePhotoJob(job);
    }
  } finally {
    futurePhotoWorkerRunning = false;
  }
}

async function processFuturePhotoJob(job: FuturePhotoJobRow) {
  const submission = row<FuturePhotoSubmissionRow>(
    "SELECT * FROM future_photo_submissions WHERE id = ?",
    job.submission_id
  );
  if (!submission) {
    db.prepare(
      `UPDATE future_photo_jobs
          SET status = 'CANCELLED',
              error_message = 'SUBMISSION_NOT_FOUND',
              finished_at = ?,
              updated_at = ?
        WHERE id = ?`
    ).run(nowSql(), nowSql(), job.id);
    return;
  }

  const models = futurePhotoModels();
  const maxAttempts = Math.max(1, Number(job.max_attempts || 1));
  let attempt = Number(job.attempt || 0);
  let latestError = "";

  while (attempt < maxAttempts) {
    const model = attempt === 0 && job.model ? job.model : models[Math.min(attempt, models.length - 1)];
    attempt += 1;
    db.prepare(
      `UPDATE future_photo_jobs
          SET status = 'RUNNING',
              model = ?,
              attempt = ?,
              error_message = NULL,
              started_at = COALESCE(started_at, ?),
              updated_at = ?
        WHERE id = ?`
    ).run(model, attempt, nowSql(), nowSql(), job.id);
    audit("future_photo.job.running", "future_photo_jobs", job.id, { attempt, model });
    emitState("future_photo.generating");

    try {
      const result = await generateFuturePhotoWithQingyun({
        submissionId: String(submission.id),
        studentName: String(submission.student_name ?? ""),
        careerText: String(submission.career_text ?? ""),
        sourcePhotoKey: String(submission.source_photo_key ?? ""),
        model
      });
      completeFuturePhotoGeneration(submission, result.resultPhotoKey, {
        ...result,
        mode: "qingyuntop",
        job_id: job.id,
        attempt
      });
      db.prepare(
        `UPDATE future_photo_jobs
            SET status = 'SUCCEEDED',
                model = ?,
                finished_at = ?,
                updated_at = ?
          WHERE id = ?`
      ).run(result.model, nowSql(), nowSql(), job.id);
      audit("future_photo.job.succeeded", "future_photo_jobs", job.id, result);
      emitState("future_photo.generated");
      return;
    } catch (error) {
      latestError = error instanceof Error ? error.message : "QINGYUN_GENERATION_FAILED";
      app.log.warn({ job_id: job.id, model, attempt, error: latestError }, "future photo generation failed");
      audit("future_photo.job.attempt_failed", "future_photo_jobs", job.id, {
        attempt,
        model,
        message: latestError
      });
    }
  }

  const failedPayload = {
    mode: "qingyuntop",
    status: "failed",
    job_id: job.id,
    model: job.model ?? null,
    attempts: attempt,
    retryable: true,
    message: latestError
  };
  db.prepare(
    `UPDATE future_photo_jobs
        SET status = 'FAILED',
            error_message = ?,
            finished_at = ?,
            updated_at = ?
      WHERE id = ?`
  ).run(latestError, nowSql(), nowSql(), job.id);
  db.prepare(
    `UPDATE future_photo_submissions
        SET review_note = ?,
            updated_at = ?
      WHERE id = ?`
  ).run(JSON.stringify(failedPayload), nowSql(), submission.id);
  audit("future_photo.job.failed", "future_photo_jobs", job.id, failedPayload);
  emitState("future_photo.generate.failed");
}

function recoverFuturePhotoJobs() {
  db.prepare(
    `UPDATE future_photo_jobs
        SET status = 'QUEUED',
            error_message = 'RECOVERED_AFTER_RESTART',
            updated_at = ?
      WHERE camp_id = ?
        AND status = 'RUNNING'`
  ).run(nowSql(), campId());
}

app.get("/health", async () => {
  return {
    ok: true,
    service: "ceo-camp-api",
    version: "0.1.0",
    time: new Date().toISOString(),
    sse_clients: clientCount()
  };
});

app.post("/auth/teacher/login", async (request, reply) => {
  const body = (request.body ?? {}) as { username?: string; password?: string };
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!username || !password) return reply.code(400).send({ error: "USERNAME_PASSWORD_REQUIRED" });

  const teacher = row<TeacherPrincipal & { password_hash: string; status: string }>(
    "SELECT id, username, display_name, password_hash, role, status FROM teachers WHERE lower(username) = lower(?)",
    username
  );
  if (!teacher || teacher.status !== "ACTIVE" || !verifyPassword(password, teacher.password_hash)) {
    return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
  }
  db.prepare("UPDATE teachers SET last_login_at = ?, updated_at = ? WHERE id = ?").run(nowSql(), nowSql(), teacher.id);
  audit("teacher.login", "teachers", teacher.id, { username: teacher.username });
  return issueTeacherToken({
    id: teacher.id,
    username: teacher.username,
    display_name: teacher.display_name,
    role: teacher.role
  });
});

app.get("/auth/teacher/me", async (request, reply) => {
  const teacher = requireTeacher(request);
  if (!teacher) return reply.code(401).send({ error: "UNAUTHORIZED" });
  return { teacher };
});

app.post("/auth/student/login", async (request, reply) => {
  const body = (request.body ?? {}) as { username?: string; password?: string };
  const username = normalizeStudentUsername(String(body.username ?? ""));
  const password = String(body.password ?? "");
  if (!username || !password) return reply.code(400).send({ error: "USERNAME_PASSWORD_REQUIRED" });

  const student = row<
    StudentPrincipal & {
      password_hash: string;
      account_status: string;
      team_id?: string | null;
      team_name?: string | null;
      display_status: string;
    }
  >(
    `SELECT s.id, s.username, s.nickname, s.student_no, s.password_hash, s.account_status,
            s.team_id, t.name AS team_name, s.display_status
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE lower(s.username) = lower(?)
        AND s.camp_id = ?`,
    [username, campId()]
  );
  if (!student || student.account_status !== "ACTIVE" || !verifyPassword(password, student.password_hash)) {
    return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
  }
  db.prepare("UPDATE students SET last_login_at = ?, updated_at = ? WHERE id = ?").run(nowSql(), nowSql(), student.id);
  audit("student.login", "students", student.id, { username: student.username }, `student:${student.id}`);
  return issueStudentToken({
    id: student.id,
    username: student.username,
    nickname: student.nickname,
    student_no: student.student_no ?? null
  });
});

app.get("/auth/student/me", async (request, reply) => {
  const principal = requireStudent(request);
  if (!principal) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const student = row(
    `SELECT s.*, t.name AS team_name
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.id = ?`,
    principal.id
  );
  if (!student) return reply.code(401).send({ error: "UNAUTHORIZED" });
  return { student: serializeStudent(student) };
});

app.get("/camp/current", async () => currentCamp());

app.get("/course/modules", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  return {
    camp_id: campId(),
    modules: courseModules()
  };
});

app.get("/students", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  return {
    students: rows(
    `SELECT s.*, t.name AS team_name
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.camp_id = ?
      ORDER BY COALESCE(s.student_no, s.created_at), s.created_at`,
    campId()
    ).map(serializeStudent)
  };
});

app.post("/students", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const body = request.body as Record<string, unknown> | Record<string, unknown>[];
  const items = Array.isArray(body) ? body : [body];
  const insert = db.prepare(
    `INSERT INTO students
      (id, camp_id, student_no, nickname, real_name, age, guardian_contact_masked,
       checkin_status, photo_authorization, projection_consent, public_showcase_consent,
       team_id, display_status, username, password_hash, account_status, updated_at)
     VALUES
      (@id, @camp_id, @student_no, @nickname, @real_name, @age, @guardian_contact_masked,
       @checkin_status, @photo_authorization, @projection_consent, @public_showcase_consent,
       @team_id, @display_status, @username, @password_hash, @account_status, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       student_no = excluded.student_no,
       nickname = excluded.nickname,
       real_name = excluded.real_name,
       age = excluded.age,
       guardian_contact_masked = excluded.guardian_contact_masked,
       checkin_status = excluded.checkin_status,
       photo_authorization = excluded.photo_authorization,
       projection_consent = excluded.projection_consent,
       public_showcase_consent = excluded.public_showcase_consent,
       team_id = excluded.team_id,
       display_status = excluded.display_status,
       username = excluded.username,
       password_hash = excluded.password_hash,
       account_status = excluded.account_status,
       updated_at = excluded.updated_at`
  );
  const existingUsernames = new Set(
    rows<{ username?: string | null }>("SELECT username FROM students WHERE username IS NOT NULL")
      .map((student) => normalizeStudentUsername(String(student.username ?? "")))
      .filter(Boolean)
  );
  const saved = db.transaction((records: Record<string, unknown>[]) =>
    records.map((item, index) => {
      const id = String(item.id ?? randomUUID());
      const existing = row<{ username?: string | null; password_hash?: string | null }>(
        "SELECT username, password_hash FROM students WHERE id = ?",
        id
      );
      if (existing?.username) existingUsernames.delete(normalizeStudentUsername(existing.username));
      const studentNo = item.student_no ? String(item.student_no) : null;
      const username = uniqueStudentUsername(
        String(item.username ?? existing?.username ?? studentUsernameFromNo(studentNo, index + 1)),
        existingUsernames
      );
      const passwordHash =
        item.password || !existing?.password_hash
          ? hashPassword(String(item.password ?? config.studentDefaultPassword))
          : existing.password_hash;
      const record = {
        id,
        camp_id: campId(),
        student_no: studentNo,
        nickname: String(item.nickname ?? item.name ?? "未命名学员"),
        real_name: item.real_name ? String(item.real_name) : null,
        age: item.age === undefined ? null : Number(item.age),
        guardian_contact_masked: item.guardian_contact_masked
          ? String(item.guardian_contact_masked)
          : null,
        checkin_status: String(item.checkin_status ?? "PENDING"),
        photo_authorization: String(item.photo_authorization ?? "SELF_PHOTO"),
        projection_consent: item.projection_consent === false ? 0 : 1,
        public_showcase_consent: item.public_showcase_consent === true ? 1 : 0,
        team_id: item.team_id ? String(item.team_id) : null,
        display_status: String(item.display_status ?? "WAITING"),
        username,
        password_hash: passwordHash,
        account_status: String(item.account_status ?? "ACTIVE"),
        updated_at: nowSql()
      };
      insert.run(record);
      return serializeStudent(record);
    })
  )(items);
  audit("students.upsert", "students", undefined, { count: saved.length });
  emitState("students.changed");
  return { students: saved };
});

app.delete("/students/:id", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const { id } = request.params as { id: string };
  const student = row(
    `SELECT s.*, t.name AS team_name
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.id = ?
        AND s.camp_id = ?`,
    [id, campId()]
  );
  if (!student) return reply.code(404).send({ error: "NOT_FOUND" });

  const submissionIds = rows<{ id: string }>(
    "SELECT id FROM future_photo_submissions WHERE camp_id = ? AND student_id = ?",
    [campId(), id]
  ).map((submission) => submission.id);

  db.transaction(() => {
    for (const submissionId of submissionIds) {
      db.prepare("DELETE FROM future_photo_jobs WHERE submission_id = ?").run(submissionId);
    }
    db.prepare("DELETE FROM future_photo_submissions WHERE camp_id = ? AND student_id = ?").run([campId(), id]);
    db.prepare("DELETE FROM task_submissions WHERE camp_id = ? AND student_id = ?").run([campId(), id]);
    db.prepare("DELETE FROM students WHERE camp_id = ? AND id = ?").run([campId(), id]);
  })();

  audit("students.delete", "students", id, {
    nickname: student.nickname,
    future_photo_submissions: submissionIds.length
  });
  emitState("students.changed");
  return {
    ok: true,
    student: serializeStudent(student)
  };
});

app.post("/students/:id/team", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as { team_id?: string | null };
  const teamId = body.team_id ? String(body.team_id) : null;
  const student = row("SELECT id, nickname FROM students WHERE id = ? AND camp_id = ?", [id, campId()]);
  if (!student) return reply.code(404).send({ error: "NOT_FOUND" });
  if (teamId) {
    const team = row("SELECT id FROM teams WHERE id = ? AND camp_id = ?", [teamId, campId()]);
    if (!team) return reply.code(404).send({ error: "TEAM_NOT_FOUND" });
  }
  db.prepare("UPDATE students SET team_id = ?, updated_at = ? WHERE id = ? AND camp_id = ?").run(
    teamId,
    nowSql(),
    id,
    campId()
  );
  audit("students.team.assign", "students", id, { team_id: teamId });
  emitState("students.changed");
  const updated = row(
    `SELECT s.*, t.name AS team_name
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.id = ?
        AND s.camp_id = ?`,
    [id, campId()]
  );
  return { student: serializeStudent(updated ?? student) };
});

app.get("/teams", async () => ({
  teams: rows("SELECT * FROM teams WHERE camp_id = ? ORDER BY group_no", campId()).map(serializeTeam)
}));

app.post("/teams", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const body = request.body as Record<string, unknown>;
  const id = String(body.id ?? randomUUID());
  const record = {
    id,
    camp_id: campId(),
    group_no: Number(body.group_no ?? 1),
    name: String(body.name ?? "未命名小组"),
    table_no: body.table_no ? String(body.table_no) : null,
    roles: JSON.stringify(body.roles ?? {}),
    project_status: String(body.project_status ?? "NOT_STARTED"),
    showcase_status: String(body.showcase_status ?? "DRAFT"),
    selected_problem_id: body.selected_problem_id ? String(body.selected_problem_id) : null,
    selected_problem_title: body.selected_problem_title ? String(body.selected_problem_title) : null,
    selected_problem_votes: Number(body.selected_problem_votes ?? 0) || 0,
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO teams
      (id, camp_id, group_no, name, table_no, roles, project_status, showcase_status,
       selected_problem_id, selected_problem_title, selected_problem_votes, updated_at)
     VALUES
      (@id, @camp_id, @group_no, @name, @table_no, @roles, @project_status, @showcase_status,
       @selected_problem_id, @selected_problem_title, @selected_problem_votes, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
      group_no = excluded.group_no,
      name = excluded.name,
      table_no = excluded.table_no,
      roles = excluded.roles,
      project_status = excluded.project_status,
      showcase_status = excluded.showcase_status,
      selected_problem_id = excluded.selected_problem_id,
      selected_problem_title = excluded.selected_problem_title,
      selected_problem_votes = excluded.selected_problem_votes,
      updated_at = excluded.updated_at`
  ).run(record);
  audit("teams.upsert", "teams", id, record);
  emitState("teams.changed");
  return { team: serializeTeam(record) };
});

app.post("/teams/:id/problem", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const team = row<Record<string, any>>("SELECT * FROM teams WHERE id = ? AND camp_id = ?", [id, campId()]);
  if (!team) return reply.code(404).send({ error: "TEAM_NOT_FOUND" });
  const problemId = String(body.problem_id ?? "").trim();
  let problem: TaskArtifact | null = null;
  if (problemId) {
    problem = problemVoteCandidates().find((candidate) => candidate.id === problemId) || null;
    if (!problem) return reply.code(404).send({ error: "PROBLEM_CARD_NOT_FOUND" });
  }
  const title = problemTitleFor(problem);
  const votes = problem ? problemVoteCount(problem.id, problemVoteActivityId()) : 0;
  db.prepare(
    `UPDATE teams
        SET selected_problem_id = ?,
            selected_problem_title = ?,
            selected_problem_votes = ?,
            project_status = CASE WHEN project_status = 'NOT_STARTED' AND ? IS NOT NULL THEN 'DISCOVERY' ELSE project_status END,
            updated_at = ?
      WHERE id = ?
        AND camp_id = ?`
  ).run(problem?.id ?? null, title || null, votes, problem?.id ?? null, nowSql(), id, campId());
  const updated = row<Record<string, any>>("SELECT * FROM teams WHERE id = ? AND camp_id = ?", [id, campId()]);
  audit("teams.problem.select", "teams", id, {
    selected_problem_id: problem?.id ?? null,
    selected_problem_title: title || null,
    selected_problem_votes: votes
  });
  emitState("teams.changed");
  return { team: updated ? serializeTeam(updated) : null };
});

app.post("/future-photo/upload-token", async (request, reply) => {
  const body = (request.body ?? {}) as { kind?: string; file_name?: string; student_id?: string };
  const expectedStudentId = body.student_id ? String(body.student_id) : undefined;
  if (
    !requireTeacher(request) &&
    !requireStudent(request) &&
    !requireStudentPhotoUpload(request, expectedStudentId)
  ) {
    return reply.code(401).send({ error: "UNAUTHORIZED" });
  }
  return createUploadTarget(body.kind ?? "future-photo", body.file_name ?? "upload.bin");
});

app.post("/future-photo/mobile-upload-link", async (request, reply) => {
  const student = requireStudent(request);
  if (!student) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const ticket = issueStudentPhotoUploadToken(student);
  audit("future_photo.mobile_upload_link", "students", student.id, {}, `student:${student.id}`);
  return {
    token: ticket.token,
    expires_in: ticket.expires_in,
    student_id: student.id,
    student: ticket.student
  };
});

app.get("/future-photo/source-photo", async (request, reply) => {
  const student = requireStudent(request);
  if (!student) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const asset = row<{ object_key: string; updated_at: string }>(
    `SELECT object_key, updated_at
       FROM media_assets
      WHERE camp_id = ?
        AND owner_type = 'student'
        AND owner_id = ?
        AND asset_type = 'future-photo-source'
      ORDER BY created_at DESC
      LIMIT 1`,
    [campId(), student.id]
  );
  return {
    source_photo: asset
      ? {
          object_key: asset.object_key,
          updated_at: asset.updated_at
        }
      : null
  };
});

app.post("/future-photo/source-photo", async (request, reply) => {
  const body = (request.body ?? {}) as { source_photo_key?: string; student_id?: string };
  const expectedStudentId = body.student_id ? String(body.student_id) : undefined;
  const student = requireStudent(request) ?? requireStudentPhotoUpload(request, expectedStudentId);
  if (!student) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const objectKey = String(body.source_photo_key ?? "");
  if (!isSafeObjectKey(objectKey)) return reply.code(400).send({ error: "INVALID_UPLOAD_KEY" });
  const id = randomUUID();
  const record = {
    id,
    camp_id: campId(),
    owner_type: "student",
    owner_id: student.id,
    asset_type: "future-photo-source",
    object_key: objectKey,
    title: `${student.nickname}的照片`,
    day: null,
    audit_status: "PRIVATE",
    display_permission: "PRIVATE",
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO media_assets
      (id, camp_id, owner_type, owner_id, asset_type, object_key, title, day,
       audit_status, display_permission, updated_at)
     VALUES
      (@id, @camp_id, @owner_type, @owner_id, @asset_type, @object_key, @title, @day,
       @audit_status, @display_permission, @updated_at)`
  ).run(record);
  audit("future_photo.source_photo", "media_assets", id, { student_id: student.id }, `student:${student.id}`);
  emitState("future_photo.source_photo");
  return {
    source_photo: {
      object_key: record.object_key,
      updated_at: record.updated_at
    }
  };
});

app.get("/future-photo/source-photo/object", async (request, reply) => {
  const student = requireStudent(request);
  if (!student) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const query = request.query as { key?: string };
  const objectKey = String(query.key ?? "");
  if (!isSafeObjectKey(objectKey)) return reply.code(404).send({ error: "NOT_FOUND" });
  const asset = row<{ id: string }>(
    `SELECT id
       FROM media_assets
      WHERE camp_id = ?
        AND owner_type = 'student'
        AND owner_id = ?
        AND asset_type = 'future-photo-source'
        AND object_key = ?
      LIMIT 1`,
    [campId(), student.id, objectKey]
  );
  if (!asset) return reply.code(404).send({ error: "NOT_FOUND" });
  try {
    const object = await readPrivateUploadObject(objectKey);
    reply.header("Content-Type", object.contentType);
    reply.header("Cache-Control", "private, max-age=60");
    if (object.contentLength) reply.header("Content-Length", object.contentLength);
    return reply.send(object.body);
  } catch {
    return reply.code(502).send({ error: "MEDIA_READ_FAILED" });
  }
});

app.put("/uploads/local", async (request, reply) => {
  if (!config.localUploadEnabled) return reply.code(404).send({ error: "LOCAL_UPLOAD_DISABLED" });
  const query = request.query as { key?: string };
  const objectKey = String(query.key ?? "");
  if (!isSafeObjectKey(objectKey)) return reply.code(400).send({ error: "INVALID_UPLOAD_KEY" });
  const body = request.body;
  if (!(body instanceof Buffer)) return reply.code(400).send({ error: "INVALID_UPLOAD_BODY" });
  const target = localUploadPath(objectKey);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body);
  return {
    ok: true,
    objectKey,
    bytes: body.length
  };
});

app.post("/media/assets", async (request, reply) => {
  const teacher = requireTeacher(request);
  const studentPrincipal = requireStudent(request);
  if (!teacher && !studentPrincipal) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const body = (request.body ?? {}) as Record<string, unknown>;
  const objectKey = String(body.object_key ?? "");
  const assetType = String(body.asset_type ?? "product-screenshot");
  if (!isSafeObjectKey(objectKey)) return reply.code(400).send({ error: "INVALID_UPLOAD_KEY" });
  if (!classroomMediaAssetTypes.has(assetType)) return reply.code(400).send({ error: "INVALID_ASSET_TYPE" });
  const student = studentPrincipal
    ? row<{ id: string; nickname: string; team_id?: string | null; team_name?: string | null }>(
        `SELECT s.id, s.nickname, s.team_id, t.name AS team_name
           FROM students s
           LEFT JOIN teams t ON t.id = s.team_id
          WHERE s.id = ?
            AND s.camp_id = ?`,
        [studentPrincipal.id, campId()]
      )
    : null;
  if (studentPrincipal && !student) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const id = randomUUID();
  const ownerType = student?.team_id ? "team" : student ? "student" : "teacher";
  const ownerId = student?.team_id || student?.id || teacher?.id || null;
  const title = String(body.title ?? "").trim().slice(0, 120) || "作品展示图";
  const record = {
    id,
    camp_id: campId(),
    owner_type: ownerType,
    owner_id: ownerId,
    asset_type: assetType,
    object_key: objectKey,
    title,
    day: body.day ? Number(body.day) : null,
    audit_status: "SUBMITTED",
    display_permission: "CLASSROOM",
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO media_assets
      (id, camp_id, owner_type, owner_id, asset_type, object_key, title, day,
       audit_status, display_permission, updated_at)
     VALUES
      (@id, @camp_id, @owner_type, @owner_id, @asset_type, @object_key, @title, @day,
       @audit_status, @display_permission, @updated_at)`
  ).run(record);
  audit("media.asset.register", "media_assets", id, {
    owner_type: ownerType,
    owner_id: ownerId,
    asset_type: assetType
  }, student ? `student:${student.id}` : `teacher:${teacher?.id}`);
  return {
    asset: {
      ...record,
      url: `${config.publicApiBase}/media/object?key=${encodeURIComponent(objectKey)}`
    }
  };
});

app.post("/future-photo/submissions", async (request, reply) => {
  const student = requireStudent(request);
  if (!student) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const body = request.body as Record<string, unknown>;
  const id = randomUUID();
  const studentId = student.id;
  const studentName = student.nickname;
  const careerText = String(body.career_text ?? body.career ?? "");
  const status = "GENERATING";
  db.prepare(
    `INSERT INTO future_photo_submissions
      (id, camp_id, student_id, student_name, career_text, career_source,
       source_photo_key, voice_key, status, updated_at)
     VALUES
      (@id, @camp_id, @student_id, @student_name, @career_text, @career_source,
       @source_photo_key, @voice_key, @status, @updated_at)`
  ).run({
    id,
    camp_id: campId(),
    student_id: studentId,
    student_name: studentName,
    career_text: careerText,
    career_source: String(body.career_source ?? "choice"),
    source_photo_key: body.source_photo_key ? String(body.source_photo_key) : null,
    voice_key: body.voice_key ? String(body.voice_key) : null,
    status,
    updated_at: nowSql()
  });
  if (studentId) {
    db.prepare("UPDATE students SET display_status = 'GENERATING', updated_at = ? WHERE id = ?").run(
      nowSql(),
      studentId
    );
  }
  audit("future_photo.submit", "future_photo_submissions", id, { student_id: studentId }, `student:${studentId}`);
  emitState("future_photo.submitted");
  return {
    submission: row("SELECT * FROM future_photo_submissions WHERE id = ?", id)
  };
});

app.post("/task-submissions", async (request, reply) => {
  const principal = requireStudent(request);
  if (!principal) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const body = request.body as Record<string, unknown>;
  const student = row<{ id: string; nickname: string; team_id?: string | null; team_name?: string | null }>(
    `SELECT s.id, s.nickname, s.team_id, t.name AS team_name
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.id = ?
        AND s.camp_id = ?`,
    [principal.id, campId()]
  );
  if (!student) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const activeTask = currentCamp().active_task as { title?: string; activity_type?: string } | null;
  const id = randomUUID();
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const record = {
    id,
    camp_id: campId(),
    student_id: student.id,
    team_id: student.team_id ?? null,
    task_type: String(body.task_type ?? activeTask?.activity_type ?? "task"),
    title: String(body.title ?? activeTask?.title ?? "课堂任务"),
    payload: JSON.stringify(payload),
    status: "SUBMITTED",
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO task_submissions
      (id, camp_id, student_id, team_id, task_type, title, payload, status, updated_at)
     VALUES
      (@id, @camp_id, @student_id, @team_id, @task_type, @title, @payload, @status, @updated_at)`
  ).run(record);
  audit("task.submit", "task_submissions", id, { student_id: student.id, team_id: student.team_id ?? null }, `student:${student.id}`);
  emitState("task.submitted");
  return {
    submission: {
      ...record,
      student_name: student.nickname,
      team_name: student.team_name ?? null,
      payload
    }
  };
});

app.get("/problem-votes/brief", async (request, reply) => {
  const principal = requireStudent(request);
  if (!principal) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const student = row<{ id: string; team_id?: string | null; team_name?: string | null }>(
    `SELECT s.id, s.team_id, t.name AS team_name
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.id = ?
        AND s.camp_id = ?`,
    [principal.id, campId()]
  );
  if (!student) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const activityId = problemVoteActivityId();
  const votes = problemVoteItems(activityId);
  const myVote = votes.find((vote) => vote.student_id === student.id) || null;
  return {
    candidates: problemVoteCandidates(),
    summaries: problemVoteSummaries(activityId),
    my_vote: myVote,
    team_problem: selectedProblemForTeam(student.team_id)
  };
});

app.post("/problem-votes", async (request, reply) => {
  const principal = requireStudent(request);
  if (!principal) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const body = request.body as Record<string, unknown>;
  const selectedIds = Array.isArray(body.problem_ids)
    ? Array.from(new Set(body.problem_ids.map((id) => String(id ?? "").trim()).filter(Boolean))).slice(0, 3)
    : [];
  if (!selectedIds.length || selectedIds.length > 3) return reply.code(400).send({ error: "PROBLEM_VOTE_REQUIRED" });
  const candidates = problemVoteCandidates();
  const candidateMap = new Map(candidates.map((item) => [item.id, item]));
  if (selectedIds.some((id) => !candidateMap.has(id))) return reply.code(400).send({ error: "PROBLEM_VOTE_INVALID" });
  const student = row<{ id: string; nickname: string; team_id?: string | null; team_name?: string | null }>(
    `SELECT s.id, s.nickname, s.team_id, t.name AS team_name
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.id = ?
        AND s.camp_id = ?`,
    [principal.id, campId()]
  );
  if (!student) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const activeTask = currentCamp().active_task as Record<string, any> | null;
  const activityId = problemVoteActivityId() || String(activeTask?.id ?? "current");
  const selectedProblems = selectedIds.map((id) => candidateMap.get(id)).filter(Boolean) as TaskArtifact[];
  const payload: TaskPayload = {
    activity_id: activityId,
    selected_problem_ids: selectedIds,
    selected_problem_titles: selectedProblems.map((item) =>
      textValue(item.payload.problem_scene) || textValue(item.payload.trouble) || "一个真实问题"
    ),
    team_name: student.team_name ?? ""
  };
  const record = {
    id: `problem-vote-${activityId}-${student.id}`,
    camp_id: campId(),
    student_id: student.id,
    team_id: student.team_id ?? null,
    task_type: "problem_vote",
    title: String(activeTask?.title ?? "烦人墙投票"),
    payload: JSON.stringify(payload),
    status: "SUBMITTED",
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO task_submissions
      (id, camp_id, student_id, team_id, task_type, title, payload, status, updated_at)
     VALUES
      (@id, @camp_id, @student_id, @team_id, @task_type, @title, @payload, @status, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
      team_id = excluded.team_id,
      title = excluded.title,
      payload = excluded.payload,
      status = excluded.status,
      updated_at = excluded.updated_at`
  ).run(record);
  audit("problem_vote.submit", "task_submissions", record.id, { selected_problem_ids: selectedIds }, `student:${student.id}`);
  emitState("problem_vote.submitted");
  return {
    submission: {
      ...record,
      student_name: student.nickname,
      team_name: student.team_name ?? null,
      payload
    },
    summaries: problemVoteSummaries(activityId)
  };
});

app.get("/team-feedback/brief", async (request, reply) => {
  const principal = requireStudent(request);
  if (!principal) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const student = row<{ id: string; team_id?: string | null; team_name?: string | null }>(
    `SELECT s.id, s.team_id, t.name AS team_name
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.id = ?
        AND s.camp_id = ?`,
    [principal.id, campId()]
  );
  if (!student) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const feedbackItems = rows<Record<string, any> & { payload?: string }>(
    `SELECT ts.*, s.nickname AS student_name, t.name AS team_name
       FROM task_submissions ts
       LEFT JOIN students s ON s.id = ts.student_id
       LEFT JOIN teams t ON t.id = ts.team_id
      WHERE ts.camp_id = ?
        AND ts.task_type = 'product_feedback'
      ORDER BY ts.updated_at DESC, ts.created_at DESC`,
    campId()
  )
    .map((item): TaskArtifact => {
      const base = item as Record<string, any>;
      return {
        ...base,
        task_type: "product_feedback",
        payload: jsonParse<TaskPayload>(base.payload, {})
      };
    })
    .filter((item) => {
      const targetTeamId = textValue(item.payload.team_id);
      const targetTeamName = textValue(item.payload.team_name);
      return (
        (!!student.team_id && targetTeamId === student.team_id) ||
        (!!student.team_name && targetTeamName === student.team_name)
      );
    });
  return { feedback_items: feedbackItems };
});

app.post("/task-submissions/:id/status", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown>;
  const nextStatus = String(body.status ?? "SUBMITTED");
  if (!["SUBMITTED", "ON_WALL"].includes(nextStatus)) {
    return reply.code(400).send({ error: "INVALID_STATUS" });
  }
  const item = row("SELECT * FROM task_submissions WHERE id = ? AND camp_id = ?", [id, campId()]);
  if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
  const payload = jsonParse<TaskPayload>(item.payload, {});
  const displayOrder = Number(body.display_order);
  const appliedDisplayOrder = Number.isFinite(displayOrder) && displayOrder > 0 ? Math.round(displayOrder) : null;
  const nextPayload: TaskPayload = appliedDisplayOrder
    ? { ...payload, display_order: appliedDisplayOrder }
    : payload;
  db.prepare("UPDATE task_submissions SET status = ?, payload = ?, updated_at = ? WHERE id = ? AND camp_id = ?").run(
    nextStatus,
    JSON.stringify(nextPayload),
    nowSql(),
    id,
    campId()
  );
  audit("task.status", "task_submissions", id, { status: nextStatus, display_order: appliedDisplayOrder });
  emitState("task.display.changed");
  const updated = row(
    `SELECT ts.*, s.nickname AS student_name, t.name AS team_name
       FROM task_submissions ts
       LEFT JOIN students s ON s.id = ts.student_id
       LEFT JOIN teams t ON t.id = ts.team_id
      WHERE ts.id = ?
        AND ts.camp_id = ?`,
    [id, campId()]
  );
  return {
    submission: updated
      ? {
          ...updated,
          payload: jsonParse(updated.payload, {})
        }
      : null
  };
});

app.post("/future-photo/:id/generate", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as { result_photo_key?: string };
  const item = row("SELECT * FROM future_photo_submissions WHERE id = ?", id);
  if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
  let resultPhotoKey = body.result_photo_key;
  let generationPayload: JsonValue = { mode: resultPhotoKey ? "manual" : "qingyuntop" };

  if (!resultPhotoKey) {
    try {
      const { job, queued } = enqueueFuturePhotoJob(item);
      return reply.code(202).send({
        submission: row("SELECT * FROM future_photo_submissions WHERE id = ?", id),
        job,
        queued
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "FUTURE_PHOTO_QUEUE_FAILED";
      db.prepare(
        `UPDATE future_photo_submissions
            SET review_note = ?,
                updated_at = ?
          WHERE id = ?`
      ).run(message, nowSql(), id);
      audit("future_photo.generate.failed", "future_photo_submissions", id, {
        message
      });
      const code = message.startsWith("FUTURE_PHOTO_DAILY_LIMIT_REACHED") ? 429 : 502;
      return reply.code(code).send({
        error: "FUTURE_PHOTO_QUEUE_FAILED",
        message
      });
    }
  }

  db.prepare(
    `UPDATE future_photo_jobs
        SET status = 'CANCELLED',
            error_message = 'MANUAL_RESULT_ATTACHED',
            finished_at = ?,
            updated_at = ?
      WHERE submission_id = ?
        AND status = 'QUEUED'`
  ).run(nowSql(), nowSql(), id);
  completeFuturePhotoGeneration(item, resultPhotoKey, generationPayload);
  audit("future_photo.generate", "future_photo_submissions", id, generationPayload);
  emitState("future_photo.generated");
  return {
    submission: row("SELECT * FROM future_photo_submissions WHERE id = ?", id)
  };
});

app.post("/future-photo/:id/review", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const { id } = request.params as { id: string };
  const body = (request.body ?? {}) as { action?: string; note?: string };
  const item = row("SELECT * FROM future_photo_submissions WHERE id = ?", id);
  if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
  const action = body.action ?? "approve";
  const next =
    action === "approve"
      ? { submission: "APPROVED", student: "ON_WALL" }
      : action === "save-only"
        ? { submission: "SAVED_ONLY", student: "SAVED_ONLY" }
        : { submission: "REJECTED", student: "WAITING" };
  db.prepare(
    `UPDATE future_photo_submissions
        SET status = ?, review_note = ?, updated_at = ?
      WHERE id = ?`
  ).run(next.submission, body.note ?? null, nowSql(), id);
  if (item.student_id) {
    db.prepare("UPDATE students SET display_status = ?, updated_at = ? WHERE id = ?").run(
      next.student,
      nowSql(),
      item.student_id
    );
  }
  audit("future_photo.review", "future_photo_submissions", id, {
    action,
    status: next.submission
  });
  emitState("future_photo.reviewed");
  return {
    submission: row("SELECT * FROM future_photo_submissions WHERE id = ?", id)
  };
});

app.get("/wall/future-photo", async () => ({
  students: wallData()
}));

app.get("/wall/artifacts", async () => ({
  artifacts: wallTaskArtifacts(),
  problem_vote_summaries: problemVoteSummaries(problemVoteActivityId())
}));

app.get("/showcase", async () => ({
  showcase_items: showcaseItems(false)
}));

app.get("/public/final-showcase", async () => {
  const camp = currentCamp() as Record<string, any>;
  return {
    camp: {
      id: camp.id,
      name: camp.name,
      city: camp.city,
      location: camp.location,
      starts_on: camp.starts_on,
      ends_on: camp.ends_on
    },
    final_showcase: finalShowcaseItems(),
    showcase_items: showcaseItems(false),
    growth_reflections: growthReflectionItems(),
    project_journey: projectJourneyItems(),
    problem_vote_summaries: problemVoteSummaries(),
    score_summaries: scoreSummaries(),
    award_results: awardResults(false)
  };
});

app.get("/observer-score/access", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  return {
    code: config.observerScoreCode,
    path: `/parents?score=1&code=${encodeURIComponent(config.observerScoreCode)}`
  };
});

app.get("/observer-score/brief", async (request, reply) => {
  const query = request.query as { code?: string };
  if (!hasObserverScoreAccess(query.code)) return reply.code(401).send({ error: "OBSERVER_CODE_REQUIRED" });
  const camp = currentCamp() as Record<string, any>;
  return {
    camp: {
      id: camp.id,
      name: camp.name,
      city: camp.city,
      location: camp.location,
      starts_on: camp.starts_on,
      ends_on: camp.ends_on
    },
    showcase_items: showcaseItems(false)
  };
});

app.post("/observer-score/submissions", async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>;
  if (!hasObserverScoreAccess(body.code)) return reply.code(401).send({ error: "OBSERVER_CODE_REQUIRED" });
  const showcaseItemId = String(body.showcase_item_id ?? "").trim();
  const item = row(
    `SELECT s.*, t.name AS team_name
       FROM showcase_items s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.id = ?
        AND s.camp_id = ?
        AND s.publish_status = 'PUBLISHED'`,
    [showcaseItemId, campId()]
  );
  if (!item) return reply.code(404).send({ error: "SHOWCASE_ITEM_NOT_FOUND" });
  for (const dimension of scoreDimensions) {
    const rawScore = Number(body[dimension]);
    if (!Number.isFinite(rawScore) || rawScore < 1) return reply.code(400).send({ error: "SCORE_REQUIRED" });
  }
  const highlight = String(body.highlight ?? "").trim();
  const nextStep = String(body.next_step ?? "").trim();
  if (!highlight || !nextStep) return reply.code(400).send({ error: "SCORE_NOTE_REQUIRED" });
  const observerName = String(body.observer_name ?? "").trim().slice(0, 40) || "家长观察员";
  const id = randomUUID();
  const payload: TaskPayload = {
    showcase_item_id: item.id,
    product_name: item.product_name,
    team_id: item.team_id ?? "",
    team_name: item.team_name || item.track || "",
    access_url: item.access_url || "",
    observer_name: observerName,
    observer_role: "parent_observer",
    highlight,
    next_step: nextStep
  };
  for (const dimension of scoreDimensions) {
    payload[dimension] = scoreValue(Number(body[dimension]));
  }
  const record = {
    id,
    camp_id: campId(),
    student_id: null,
    team_id: item.team_id ?? null,
    task_type: "observer_score",
    title: "家长观察员评分",
    payload: JSON.stringify(payload),
    status: "SUBMITTED",
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO task_submissions
      (id, camp_id, student_id, team_id, task_type, title, payload, status, updated_at)
     VALUES
      (@id, @camp_id, @student_id, @team_id, @task_type, @title, @payload, @status, @updated_at)`
  ).run(record);
  audit("observer.score.submit", "task_submissions", id, {
    showcase_item_id: item.id,
    observer_name: observerName
  }, "observer");
  emitState("score.submitted");
  return {
    submission: {
      ...record,
      student_name: observerName,
      team_name: item.team_name ?? null,
      payload
    }
  };
});

app.get("/showcase/manage", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  return {
    showcase_items: showcaseItems(true)
  };
});

app.get("/mentor-comments/manage", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  return {
    mentor_comments: mentorCommentItems(true)
  };
});

app.post("/mentor-comments", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const body = request.body as Record<string, unknown>;
  const showcaseItemId = String(body.showcase_item_id ?? "").trim();
  const comment = String(body.comment ?? "").trim();
  const nextStep = String(body.next_step ?? "").trim();
  if (!comment) return reply.code(400).send({ error: "MENTOR_COMMENT_REQUIRED" });
  const showcaseItem = showcaseItemId
    ? row<Record<string, any>>(
        `SELECT s.*, t.name AS team_name
           FROM showcase_items s
           LEFT JOIN teams t ON t.id = s.team_id
          WHERE s.id = ?
            AND s.camp_id = ?`,
        [showcaseItemId, campId()]
      )
    : null;
  if (showcaseItemId && !showcaseItem) return reply.code(404).send({ error: "SHOWCASE_ITEM_NOT_FOUND" });
  const productName = String(body.product_name ?? showcaseItem?.product_name ?? "未命名作品").trim();
  const teamId = body.team_id ? String(body.team_id) : showcaseItem?.team_id ?? null;
  const teamName = String(body.team_name ?? showcaseItem?.team_name ?? showcaseItem?.track ?? "").trim();
  const accessUrl = String(body.access_url ?? showcaseItem?.access_url ?? "").trim();
  const mentorName = String(body.mentor_name ?? "主讲老师").trim().slice(0, 40) || "主讲老师";
  const id = String(body.id ?? (showcaseItemId ? `mentor-${showcaseItemId}` : randomUUID()));
  const nextStatus = String(body.status ?? "ON_WALL");
  const status = nextStatus === "ON_WALL" ? "ON_WALL" : "SUBMITTED";
  const payload: TaskPayload = {
    showcase_item_id: showcaseItemId,
    product_name: productName,
    team_id: teamId ?? "",
    team_name: teamName,
    access_url: accessUrl,
    mentor_name: mentorName,
    comment,
    next_step: nextStep
  };
  const record = {
    id,
    camp_id: campId(),
    student_id: null,
    team_id: teamId,
    task_type: "mentor_comment",
    title: "导师点评",
    payload: JSON.stringify(payload),
    status,
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO task_submissions
      (id, camp_id, student_id, team_id, task_type, title, payload, status, updated_at)
     VALUES
      (@id, @camp_id, @student_id, @team_id, @task_type, @title, @payload, @status, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
      team_id = excluded.team_id,
      title = excluded.title,
      payload = excluded.payload,
      status = excluded.status,
      updated_at = excluded.updated_at`
  ).run(record);
  audit("mentor_comment.save", "task_submissions", id, {
    showcase_item_id: showcaseItemId,
    product_name: productName,
    status
  });
  emitState("mentor_comment.changed");
  return {
    mentor_comment: {
      ...record,
      team_name: teamName || null,
      payload
    }
  };
});

app.get("/media/object", async (request, reply) => {
  const query = request.query as { key?: string };
  const objectKey = String(query.key ?? "");
  if (!canReadWallObject(objectKey)) return reply.code(404).send({ error: "NOT_FOUND" });
  try {
    const object = await readPrivateUploadObject(objectKey);
    reply.header("Content-Type", object.contentType);
    reply.header("Cache-Control", "private, max-age=120");
    if (object.contentLength) reply.header("Content-Length", object.contentLength);
    return reply.send(object.body);
  } catch {
    return reply.code(502).send({ error: "MEDIA_READ_FAILED" });
  }
});

app.get("/events", async (request, reply) => {
  const id = randomUUID();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": responseCorsOrigin(request.headers.origin),
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin"
  });
  const write = (event: string, data: JsonValue) => {
    reply.raw.write(`event: ${event}\n`);
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  addClient({
    id,
    write,
    close: () => reply.raw.end()
  });
  write("connected", {
    id,
    camp: currentCamp(),
    wall: wallData(),
    showcase_items: showcaseItems(false),
    wall_artifacts: wallTaskArtifacts(),
    growth_reflections: growthReflectionItems(),
    project_journey: projectJourneyItems(),
    problem_vote_summaries: problemVoteSummaries(problemVoteActivityId()),
    award_results: awardResults(false),
    score_summaries: scoreSummaries()
  });
  const keepAlive = setInterval(() => write("ping", { time: new Date().toISOString() }), 25000);
  request.raw.on("close", () => {
    clearInterval(keepAlive);
    removeClient(id);
  });
});

app.post("/tasks/current", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const body = request.body as Record<string, unknown>;
  db.prepare("UPDATE class_activities SET status = 'ENDED', updated_at = ? WHERE camp_id = ? AND status = 'ACTIVE'").run(
    nowSql(),
    campId()
  );
  const id = randomUUID();
  const record = {
    id,
    camp_id: campId(),
    module_id: body.module_id ? String(body.module_id) : null,
    title: String(body.title ?? "当前课堂任务"),
    activity_type: String(body.activity_type ?? "task"),
    status: "ACTIVE",
    payload: JSON.stringify(body.payload ?? {}),
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO class_activities
      (id, camp_id, module_id, title, activity_type, status, payload, updated_at)
     VALUES
      (@id, @camp_id, @module_id, @title, @activity_type, @status, @payload, @updated_at)`
  ).run(record);
  audit("tasks.current", "class_activities", id, record);
  emitState("task.changed");
  return { task: { ...record, payload: jsonParse(record.payload, {}) } };
});

app.get("/submissions", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  return {
    future_photo_submissions: rows(
      "SELECT * FROM future_photo_submissions WHERE camp_id = ? ORDER BY created_at DESC",
      campId()
    ),
    task_submissions: rows(
      `SELECT ts.*, s.nickname AS student_name, t.name AS team_name
         FROM task_submissions ts
         LEFT JOIN students s ON s.id = ts.student_id
         LEFT JOIN teams t ON t.id = ts.team_id
        WHERE ts.camp_id = ?
        ORDER BY ts.created_at DESC`,
      campId()
    ).map((submission) => ({
        ...submission,
        payload: jsonParse(submission.payload, {})
      }))
  };
});

app.get("/problem-votes/manage", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const activityId = problemVoteActivityId();
  return {
    candidates: problemVoteCandidates(),
    votes: problemVoteItems(activityId),
    summaries: problemVoteSummaries(activityId)
  };
});

app.get("/scores/summary", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  return {
    score_summaries: scoreSummaries(),
    score_submissions: observerScoreSubmissions()
  };
});

app.get("/awards/manage", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  return {
    award_results: awardResults(true)
  };
});

app.post("/awards", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const body = request.body as Record<string, unknown>;
  const winnerName = String(body.winner_name ?? "").trim();
  const awardType = String(body.award_type ?? "").trim();
  if (!winnerName || !awardType) {
    return reply.code(400).send({ error: "AWARD_REQUIRED" });
  }
  const id = String(body.id ?? randomUUID());
  const record = {
    id,
    camp_id: campId(),
    award_type: awardType,
    winner_type: String(body.winner_type ?? "team"),
    winner_id: body.winner_id ? String(body.winner_id) : null,
    winner_name: winnerName,
    reason: body.reason ? String(body.reason) : null,
    publish_status: String(body.publish_status ?? "DRAFT"),
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO award_results
      (id, camp_id, award_type, winner_type, winner_id, winner_name, reason, publish_status, updated_at)
     VALUES
      (@id, @camp_id, @award_type, @winner_type, @winner_id, @winner_name, @reason, @publish_status, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
      award_type = excluded.award_type,
      winner_type = excluded.winner_type,
      winner_id = excluded.winner_id,
      winner_name = excluded.winner_name,
      reason = excluded.reason,
      publish_status = excluded.publish_status,
      updated_at = excluded.updated_at`
  ).run(record);
  audit("award.save", "award_results", id, record);
  emitState("award.changed");
  return { award_result: record };
});

app.post("/publish/showcase", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const body = request.body as Record<string, unknown>;
  const id = String(body.id ?? randomUUID());
  const record = {
    id,
    camp_id: campId(),
    team_id: body.team_id ? String(body.team_id) : null,
    product_name: String(body.product_name ?? "未命名作品"),
    track: body.track ? String(body.track) : null,
    one_liner: body.one_liner ? String(body.one_liner) : null,
    access_url: body.access_url ? String(body.access_url) : null,
    screenshot_key: body.screenshot_key ? String(body.screenshot_key) : null,
    screenshot_url: body.screenshot_url ? String(body.screenshot_url) : null,
    recording_key: body.recording_key ? String(body.recording_key) : null,
    recording_url: body.recording_url ? String(body.recording_url) : null,
    publish_status: String(body.publish_status ?? "DRAFT"),
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO showcase_items
      (id, camp_id, team_id, product_name, track, one_liner, access_url,
       screenshot_key, screenshot_url, recording_key, recording_url, publish_status, updated_at)
     VALUES
      (@id, @camp_id, @team_id, @product_name, @track, @one_liner, @access_url,
       @screenshot_key, @screenshot_url, @recording_key, @recording_url, @publish_status, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
      team_id = excluded.team_id,
      product_name = excluded.product_name,
      track = excluded.track,
      one_liner = excluded.one_liner,
      access_url = excluded.access_url,
      screenshot_key = excluded.screenshot_key,
      screenshot_url = excluded.screenshot_url,
      recording_key = excluded.recording_key,
      recording_url = excluded.recording_url,
      publish_status = excluded.publish_status,
      updated_at = excluded.updated_at`
  ).run(record);
  db.prepare(
    `INSERT INTO publish_records
      (id, camp_id, source_type, source_id, target_section, publish_status, published_at)
     VALUES
      (@id, @camp_id, 'showcase_item', @source_id, 'official_showcase', @publish_status, @published_at)`
  ).run({
    id: randomUUID(),
    camp_id: campId(),
    source_id: id,
    publish_status: record.publish_status,
    published_at: record.publish_status === "PUBLISHED" ? nowSql() : null
  });
  audit("publish.showcase", "showcase_items", id, record);
  emitState("publish.changed");
  return { showcase_item: record };
});

app.setNotFoundHandler(async (_request, reply) => {
  return reply.code(404).send({ error: "NOT_FOUND" });
});

app.setErrorHandler(async (error, _request, reply) => {
  app.log.error(error);
  const message = error instanceof Error ? error.message : "Unknown server error";
  return reply.code(500).send({ error: "INTERNAL_ERROR", message });
});

app.listen({ host: config.host, port: config.port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
