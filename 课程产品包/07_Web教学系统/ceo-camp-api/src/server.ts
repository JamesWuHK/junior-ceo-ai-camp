import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { hashPassword, issueTeacherToken, verifyPassword, verifyTeacherToken, type TeacherPrincipal } from "./auth.js";
import { config } from "./config.js";
import { createUploadTarget, readCosObject } from "./cos.js";
import { broadcast, addClient, removeClient, clientCount } from "./events.js";
import { db, initializeDatabase, nowSql, openDatabase, row, rows } from "./db.js";
import type { JsonValue } from "./types.js";

await openDatabase();
initializeDatabase();
ensureDefaultTeacher();

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info"
  },
  bodyLimit: 20 * 1024 * 1024
});

const uploadBodyLimit = 20 * 1024 * 1024;

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

function audit(action: string, targetType?: string, targetId?: string, payload: JsonValue = {}) {
  db.prepare(
    `INSERT INTO audit_logs (id, camp_id, actor, action, target_type, target_id, payload)
     VALUES (@id, @camp_id, @actor, @action, @target_type, @target_id, @payload)`
  ).run({
    id: randomUUID(),
    camp_id: campId(),
    actor: "teacher",
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

app.get("/camp/current", async () => currentCamp());

app.get("/course/modules", async () => ({
  camp_id: campId(),
  modules: courseModules()
}));

app.get("/students", async () => ({
  students: rows(
    `SELECT s.*, t.name AS team_name
       FROM students s
       LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.camp_id = ?
      ORDER BY COALESCE(s.student_no, s.created_at), s.created_at`,
    campId()
  ).map((student) => ({
    ...student,
    projection_consent: Boolean(student.projection_consent),
    public_showcase_consent: Boolean(student.public_showcase_consent)
  }))
}));

app.post("/students", async (request, reply) => {
  if (!requireTeacher(request)) return reply.code(401).send({ error: "UNAUTHORIZED" });
  const body = request.body as Record<string, unknown> | Record<string, unknown>[];
  const items = Array.isArray(body) ? body : [body];
  const insert = db.prepare(
    `INSERT INTO students
      (id, camp_id, student_no, nickname, real_name, age, guardian_contact_masked,
       checkin_status, photo_authorization, projection_consent, public_showcase_consent,
       team_id, display_status, updated_at)
     VALUES
      (@id, @camp_id, @student_no, @nickname, @real_name, @age, @guardian_contact_masked,
       @checkin_status, @photo_authorization, @projection_consent, @public_showcase_consent,
       @team_id, @display_status, @updated_at)
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
       updated_at = excluded.updated_at`
  );
  const saved = db.transaction((records: Record<string, unknown>[]) =>
    records.map((item) => {
      const id = String(item.id ?? randomUUID());
      const record = {
        id,
        camp_id: campId(),
        student_no: item.student_no ? String(item.student_no) : null,
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
        updated_at: nowSql()
      };
      insert.run(record);
      return record;
    })
  )(items);
  audit("students.upsert", "students", undefined, { count: saved.length });
  emitState("students.changed");
  return { students: saved };
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

app.post("/future-photo/upload-token", async (request) => {
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

app.post("/future-photo/submissions", async (request) => {
  const body = request.body as Record<string, unknown>;
  const id = randomUUID();
  const studentId = body.student_id ? String(body.student_id) : null;
  const studentName = String(body.student_name ?? body.nickname ?? "未命名学员");
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
  audit("future_photo.submit", "future_photo_submissions", id, { student_id: studentId });
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
  const resultPhotoKey =
    body.result_photo_key ??
    `generated/future-photo/${id}.jpg`;
  db.prepare(
    `UPDATE future_photo_submissions
        SET status = 'AWAITING_REVIEW',
            result_photo_key = ?,
            updated_at = ?
      WHERE id = ?`
  ).run(resultPhotoKey, nowSql(), id);
  if (item.student_id) {
    db.prepare("UPDATE students SET display_status = 'AWAITING_REVIEW', updated_at = ? WHERE id = ?").run(
      nowSql(),
      item.student_id
    );
  }
  audit("future_photo.generate", "future_photo_submissions", id);
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

app.get("/submissions", async () => ({
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
}));

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
