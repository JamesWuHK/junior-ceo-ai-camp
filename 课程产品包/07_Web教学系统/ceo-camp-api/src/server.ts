import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  hashPassword,
  issueStudentToken,
  issueTeacherToken,
  verifyPassword,
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

const uploadBodyLimit = 20 * 1024 * 1024;
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
  const student = row<StudentPrincipal & { account_status: string }>(
    "SELECT id, username, nickname, student_no, account_status FROM students WHERE id = ?",
    principal.id
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
  return Boolean(
    row(
      `SELECT f.id
         FROM future_photo_submissions f
         JOIN students s ON s.id = f.student_id
        WHERE f.result_photo_key = ?
          AND f.status = 'APPROVED'
          AND s.display_status = 'ON_WALL'
        LIMIT 1`,
      objectKey
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
  const camp = row("SELECT * FROM camp_offerings WHERE id = ?", campId());
  const activeTask = row(
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

function emitState(event = "state.changed") {
  broadcast(event, {
    camp: currentCamp(),
    wall: wallData()
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

app.get("/course/modules", async () => ({
  camp_id: campId(),
  modules: courseModules()
}));

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

app.get("/teams", async () => ({
  teams: rows("SELECT * FROM teams WHERE camp_id = ? ORDER BY group_no", campId()).map((team) => ({
    ...team,
    roles: jsonParse(team.roles, {})
  }))
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
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO teams
      (id, camp_id, group_no, name, table_no, roles, project_status, showcase_status, updated_at)
     VALUES
      (@id, @camp_id, @group_no, @name, @table_no, @roles, @project_status, @showcase_status, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
      group_no = excluded.group_no,
      name = excluded.name,
      table_no = excluded.table_no,
      roles = excluded.roles,
      project_status = excluded.project_status,
      showcase_status = excluded.showcase_status,
      updated_at = excluded.updated_at`
  ).run(record);
  audit("teams.upsert", "teams", id, record);
  emitState("teams.changed");
  return { team: { ...record, roles: jsonParse(record.roles, {}) } };
});

app.post("/future-photo/upload-token", async (request, reply) => {
  if (!requireTeacher(request) && !requireStudent(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const body = (request.body ?? {}) as { kind?: string; file_name?: string };
  return createUploadTarget(body.kind ?? "future-photo", body.file_name ?? "upload.bin");
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

app.get("/media/object", async (request, reply) => {
  const query = request.query as { key?: string };
  const objectKey = String(query.key ?? "");
  if (!canReadWallObject(objectKey)) return reply.code(404).send({ error: "NOT_FOUND" });
  try {
    const object = await readCosObject(objectKey);
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
  write("connected", { id, camp: currentCamp(), wall: wallData() });
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
    task_submissions: rows("SELECT * FROM task_submissions WHERE camp_id = ? ORDER BY created_at DESC", campId()).map(
      (submission) => ({
        ...submission,
        payload: jsonParse(submission.payload, {})
      })
    )
  };
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
    publish_status: String(body.publish_status ?? "DRAFT"),
    updated_at: nowSql()
  };
  db.prepare(
    `INSERT INTO showcase_items
      (id, camp_id, team_id, product_name, track, one_liner, access_url, screenshot_key, publish_status, updated_at)
     VALUES
      (@id, @camp_id, @team_id, @product_name, @track, @one_liner, @access_url, @screenshot_key, @publish_status, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
      team_id = excluded.team_id,
      product_name = excluded.product_name,
      track = excluded.track,
      one_liner = excluded.one_liner,
      access_url = excluded.access_url,
      screenshot_key = excluded.screenshot_key,
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
