import initSqlJs, { type BindParams, type Database as SqlJsDatabase, type SqlValue } from "sql.js";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { config } from "./config.js";

type StatementParams = BindParams | Record<string, unknown> | SqlValue | undefined;
type SqlRow = Record<string, any>;

const require = createRequire(import.meta.url);

function normalizeParams(params: StatementParams): BindParams {
  if (params === undefined) return null;
  if (Array.isArray(params) || params === null) return params;
  if (params instanceof Uint8Array || typeof params === "string" || typeof params === "number") {
    return [params];
  }
  const normalized: Record<string, string | number | Uint8Array | null> = {};
  for (const [key, value] of Object.entries(params)) {
    const paramKey = key.startsWith("@") || key.startsWith(":") || key.startsWith("$") ? key : `@${key}`;
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      value instanceof Uint8Array
    ) {
      normalized[paramKey] = value;
    } else if (typeof value === "boolean") {
      normalized[paramKey] = value ? 1 : 0;
    } else if (value === undefined) {
      normalized[paramKey] = null;
    } else {
      normalized[paramKey] = JSON.stringify(value);
    }
  }
  return normalized;
}

class PreparedStatement {
  constructor(
    private readonly adapter: AppDatabase,
    private readonly sql: string
  ) {}

  run(params?: StatementParams, ...positional: unknown[]) {
    const bindParams =
      positional.length > 0 ? ([params, ...positional] as BindParams) : normalizeParams(params);
    const statement = this.adapter.inner.prepare(this.sql);
    try {
      statement.run(bindParams);
      this.adapter.persistIfNeeded();
      return {
        changes: this.adapter.inner.getRowsModified()
      };
    } finally {
      statement.free();
    }
  }

  all(params?: StatementParams) {
    const statement = this.adapter.inner.prepare(this.sql);
    const result: SqlRow[] = [];
    try {
      statement.bind(normalizeParams(params));
      while (statement.step()) {
        result.push(statement.getAsObject() as SqlRow);
      }
      return result;
    } finally {
      statement.free();
    }
  }

  get(params?: StatementParams) {
    const statement = this.adapter.inner.prepare(this.sql);
    try {
      statement.bind(normalizeParams(params));
      if (!statement.step()) return undefined;
      return statement.getAsObject() as SqlRow;
    } finally {
      statement.free();
    }
  }
}

class AppDatabase {
  private transactionDepth = 0;

  constructor(
    readonly inner: SqlJsDatabase,
    private readonly databasePath: string
  ) {}

  exec(sql: string) {
    this.inner.exec(sql);
    this.persistIfNeeded();
  }

  prepare(sql: string) {
    return new PreparedStatement(this, sql);
  }

  transaction<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult) {
    return (...args: TArgs) => {
      this.inner.exec("BEGIN");
      this.transactionDepth += 1;
      try {
        const result = fn(...args);
        this.transactionDepth -= 1;
        this.inner.exec("COMMIT");
        this.persist();
        return result;
      } catch (error) {
        this.transactionDepth -= 1;
        this.inner.exec("ROLLBACK");
        throw error;
      }
    };
  }

  persistIfNeeded() {
    if (this.transactionDepth === 0) this.persist();
  }

  persist() {
    const tmpPath = `${this.databasePath}.tmp`;
    writeFileSync(tmpPath, Buffer.from(this.inner.export()));
    renameSync(tmpPath, this.databasePath);
  }
}

export let db: AppDatabase;

export async function openDatabase() {
  mkdirSync(dirname(config.databasePath), { recursive: true });
  const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  });
  const existing = existsSync(config.databasePath) ? readFileSync(config.databasePath) : undefined;
  db = new AppDatabase(new SQL.Database(existing), config.databasePath);
}

export function initializeDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS camp_offerings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      location TEXT,
      starts_on TEXT,
      ends_on TEXT,
      capacity INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'PLANNING',
      current_day INTEGER NOT NULL DEFAULT 1,
      current_module_id TEXT,
      public_copy TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'TEACHER',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      student_no TEXT,
      nickname TEXT NOT NULL,
      real_name TEXT,
      age INTEGER,
      guardian_contact_masked TEXT,
      checkin_status TEXT NOT NULL DEFAULT 'PENDING',
      photo_authorization TEXT NOT NULL DEFAULT 'SELF_PHOTO',
      projection_consent INTEGER NOT NULL DEFAULT 1,
      public_showcase_consent INTEGER NOT NULL DEFAULT 0,
      team_id TEXT,
      display_status TEXT NOT NULL DEFAULT 'WAITING',
      username TEXT,
      password_hash TEXT,
      account_status TEXT NOT NULL DEFAULT 'ACTIVE',
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camp_id) REFERENCES camp_offerings(id)
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      group_no INTEGER NOT NULL,
      name TEXT NOT NULL,
      table_no TEXT,
      roles TEXT NOT NULL DEFAULT '{}',
      project_status TEXT NOT NULL DEFAULT 'NOT_STARTED',
      showcase_status TEXT NOT NULL DEFAULT 'DRAFT',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camp_id) REFERENCES camp_offerings(id)
    );

    CREATE TABLE IF NOT EXISTS course_modules (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      day INTEGER NOT NULL,
      sequence INTEGER NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      time_range TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camp_id) REFERENCES camp_offerings(id)
    );

    CREATE TABLE IF NOT EXISTS lesson_pages (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      page_no INTEGER NOT NULL,
      title TEXT NOT NULL,
      page_type TEXT NOT NULL,
      activity_buttons TEXT NOT NULL DEFAULT '[]',
      content_summary TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (module_id) REFERENCES course_modules(id)
    );

    CREATE TABLE IF NOT EXISTS class_activities (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      module_id TEXT,
      title TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camp_id) REFERENCES camp_offerings(id)
    );

    CREATE TABLE IF NOT EXISTS future_photo_submissions (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      student_id TEXT,
      student_name TEXT NOT NULL,
      career_text TEXT NOT NULL,
      career_source TEXT NOT NULL DEFAULT 'choice',
      source_photo_key TEXT,
      voice_key TEXT,
      result_photo_key TEXT,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      review_note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camp_id) REFERENCES camp_offerings(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS future_photo_jobs (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      submission_id TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'qingyuntop',
      model TEXT,
      status TEXT NOT NULL DEFAULT 'QUEUED',
      attempt INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 1,
      error_message TEXT,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camp_id) REFERENCES camp_offerings(id),
      FOREIGN KEY (submission_id) REFERENCES future_photo_submissions(id)
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      owner_type TEXT,
      owner_id TEXT,
      asset_type TEXT NOT NULL,
      object_key TEXT NOT NULL,
      title TEXT,
      day INTEGER,
      audit_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
      display_permission TEXT NOT NULL DEFAULT 'INTERNAL_ONLY',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camp_id) REFERENCES camp_offerings(id)
    );

    CREATE TABLE IF NOT EXISTS task_submissions (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      student_id TEXT,
      team_id TEXT,
      task_type TEXT NOT NULL,
      title TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camp_id) REFERENCES camp_offerings(id)
    );

    CREATE TABLE IF NOT EXISTS showcase_items (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      team_id TEXT,
      product_name TEXT NOT NULL,
      track TEXT,
      one_liner TEXT,
      access_url TEXT,
      screenshot_key TEXT,
      publish_status TEXT NOT NULL DEFAULT 'DRAFT',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camp_id) REFERENCES camp_offerings(id)
    );

    CREATE TABLE IF NOT EXISTS award_results (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      award_type TEXT NOT NULL,
      winner_type TEXT NOT NULL,
      winner_id TEXT,
      winner_name TEXT NOT NULL,
      reason TEXT,
      publish_status TEXT NOT NULL DEFAULT 'DRAFT',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camp_id) REFERENCES camp_offerings(id)
    );

    CREATE TABLE IF NOT EXISTS publish_records (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_section TEXT NOT NULL,
      publish_status TEXT NOT NULL DEFAULT 'DRAFT',
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camp_id) REFERENCES camp_offerings(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      camp_id TEXT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  migrateStudentAccounts();
  migrateFuturePhotoJobs();
  seedDefaultCamp();
}

function migrateStudentAccounts() {
  const columns = db.prepare("PRAGMA table_info(students)").all() as { name: string }[];
  const hasColumn = (name: string) => columns.some((column) => column.name === name);
  if (!hasColumn("username")) db.exec("ALTER TABLE students ADD COLUMN username TEXT");
  if (!hasColumn("password_hash")) db.exec("ALTER TABLE students ADD COLUMN password_hash TEXT");
  if (!hasColumn("account_status")) {
    db.exec("ALTER TABLE students ADD COLUMN account_status TEXT NOT NULL DEFAULT 'ACTIVE'");
  }
  if (!hasColumn("last_login_at")) db.exec("ALTER TABLE students ADD COLUMN last_login_at TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_students_username ON students(username) WHERE username IS NOT NULL");
}

function migrateFuturePhotoJobs() {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_future_photo_jobs_status
      ON future_photo_jobs(camp_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_future_photo_jobs_submission
      ON future_photo_jobs(submission_id, created_at);
  `);
}

function seedDefaultCamp() {
  const camp = db
    .prepare("SELECT id FROM camp_offerings WHERE id = ?")
    .get("beijing-2026-summer");

  if (!camp) {
    db.prepare(
      `INSERT INTO camp_offerings
        (id, name, city, location, starts_on, ends_on, capacity, status, current_day, current_module_id, public_copy)
       VALUES
        (@id, @name, @city, @location, @starts_on, @ends_on, @capacity, @status, @current_day, @current_module_id, @public_copy)`
    ).run({
      id: "beijing-2026-summer",
      name: "少年CEO AI 创业营",
      city: "北京",
      location: "北京顺义站",
      starts_on: "2026-07-01",
      ends_on: "2026-07-03",
      capacity: 30,
      status: "PLANNING",
      current_day: 1,
      current_module_id: "future-photo-studio",
      public_copy: JSON.stringify({ slogan: "3天，从0到1模拟一次AI创业" })
    });
  }

  const moduleCount = db.prepare("SELECT COUNT(*) AS count FROM course_modules").get() as {
    count: number;
  };

  if (moduleCount.count === 0) {
    const insertModule = db.prepare(
      `INSERT INTO course_modules
        (id, camp_id, day, sequence, title, subtitle, time_range, status)
       VALUES
        (@id, @camp_id, @day, @sequence, @title, @subtitle, @time_range, @status)`
    );
    const insertPage = db.prepare(
      `INSERT INTO lesson_pages
        (id, module_id, page_no, title, page_type, activity_buttons, content_summary)
       VALUES
        (@id, @module_id, @page_no, @title, @page_type, @activity_buttons, @content_summary)`
    );

    const modules = [
      ["future-photo-studio", 1, 1, "未来照相馆", "开场AI体验与照片墙", "D1 上午", "READY"],
      ["problem-wall", 1, 2, "烦人墙", "从身边小麻烦找到真实问题", "D1 上午", "DRAFT"],
      ["user-interview", 1, 3, "用户采访", "把想法问清楚", "D1 下午", "DRAFT"],
      ["product-prototype", 2, 1, "产品原型", "用AI做出第一版可演示产品", "D2 上午", "DRAFT"],
      ["ai-lab", 2, 2, "AI实验室", "Prompt、模型能力与安全边界", "D2 下午", "DRAFT"],
      ["brand-story", 2, 3, "品牌与故事", "让别人听懂你的产品", "D2 下午", "DRAFT"],
      ["roadshow-rehearsal", 3, 1, "作品打磨", "测试、修改和准备展示", "D3 上午", "DRAFT"],
      ["final-showcase", 3, 2, "终极作品秀", "面向家长观察员展示", "D3 下午", "DRAFT"]
    ] as const;

    for (const [id, day, sequence, title, subtitle, time_range, status] of modules) {
      insertModule.run({
        id,
        camp_id: "beijing-2026-summer",
        day,
        sequence,
        title,
        subtitle,
        time_range,
        status
      });
    }

    const pageSeeds = [
      ["future-photo-studio", 1, "少年CEO AI 创业营", "cover", ["投屏展示"], "开营封面"],
      ["future-photo-studio", 2, "未来照相馆", "story", ["投屏展示"], "展示孩子与未来职业照对比，开启神奇照相馆故事"],
      ["future-photo-studio", 3, "扫码进入照相馆", "ai-demo", ["发布任务", "投屏展示"], "学生提交照片和理想职业"],
      ["future-photo-studio", 4, "未来职业照照片墙", "showcase", ["打开看板", "投屏展示"], "生成、审核和大屏展示"]
    ] as const;

    for (const [moduleId, pageNo, title, pageType, buttons, summary] of pageSeeds) {
      insertPage.run({
        id: `${moduleId}-${pageNo}`,
        module_id: moduleId,
        page_no: pageNo,
        title,
        page_type: pageType,
        activity_buttons: JSON.stringify(buttons),
        content_summary: summary
      });
    }
  }

  const teamCount = db.prepare("SELECT COUNT(*) AS count FROM teams").get() as {
    count: number;
  };

  if (teamCount.count === 0) {
    const insertTeam = db.prepare(
      `INSERT INTO teams (id, camp_id, group_no, name, table_no, roles)
       VALUES (@id, @camp_id, @group_no, @name, @table_no, @roles)`
    );
    for (let i = 1; i <= 6; i += 1) {
      insertTeam.run({
        id: `team-${i}`,
        camp_id: "beijing-2026-summer",
        group_no: i,
        name: `第 ${i} 组`,
        table_no: `${i}`,
        roles: JSON.stringify({})
      });
    }
  }
}

export function rows<T = Record<string, any>>(sql: string, params?: unknown) {
  return params === undefined
    ? (db.prepare(sql).all() as T[])
    : (db.prepare(sql).all(params as StatementParams) as T[]);
}

export function row<T = Record<string, any>>(sql: string, params?: unknown) {
  return params === undefined
    ? (db.prepare(sql).get() as T | undefined)
    : (db.prepare(sql).get(params as StatementParams) as T | undefined);
}

export function nowSql() {
  return new Date().toISOString();
}
