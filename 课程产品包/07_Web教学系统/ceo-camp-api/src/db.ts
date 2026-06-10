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
      selected_problem_id TEXT,
      selected_problem_title TEXT,
      selected_problem_votes INTEGER NOT NULL DEFAULT 0,
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
      screenshot_url TEXT,
      recording_key TEXT,
      recording_url TEXT,
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
  migrateTeams();
  migrateShowcaseItems();
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

function migrateTeams() {
  const columns = db.prepare("PRAGMA table_info(teams)").all() as { name: string }[];
  const hasColumn = (name: string) => columns.some((column) => column.name === name);
  if (!hasColumn("selected_problem_id")) db.exec("ALTER TABLE teams ADD COLUMN selected_problem_id TEXT");
  if (!hasColumn("selected_problem_title")) db.exec("ALTER TABLE teams ADD COLUMN selected_problem_title TEXT");
  if (!hasColumn("selected_problem_votes")) {
    db.exec("ALTER TABLE teams ADD COLUMN selected_problem_votes INTEGER NOT NULL DEFAULT 0");
  }
}

function migrateShowcaseItems() {
  const columns = db.prepare("PRAGMA table_info(showcase_items)").all() as { name: string }[];
  const hasColumn = (name: string) => columns.some((column) => column.name === name);
  if (!hasColumn("screenshot_url")) db.exec("ALTER TABLE showcase_items ADD COLUMN screenshot_url TEXT");
  if (!hasColumn("recording_key")) db.exec("ALTER TABLE showcase_items ADD COLUMN recording_key TEXT");
  if (!hasColumn("recording_url")) db.exec("ALTER TABLE showcase_items ADD COLUMN recording_url TEXT");
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

  const upsertModule = (module: {
    id: string;
    day: number;
    sequence: number;
    title: string;
    subtitle: string;
    time_range: string;
    status: string;
  }) => {
    const existing = db.prepare("SELECT id FROM course_modules WHERE id = ?").get(module.id);
    if (existing) {
      db.prepare(
        `UPDATE course_modules
            SET day = @day,
                sequence = @sequence,
                title = @title,
                subtitle = @subtitle,
                time_range = @time_range,
                status = @status,
                updated_at = @updated_at
          WHERE id = @id`
      ).run({ ...module, updated_at: nowSql() });
      return;
    }
    db.prepare(
      `INSERT INTO course_modules
        (id, camp_id, day, sequence, title, subtitle, time_range, status)
       VALUES
        (@id, @camp_id, @day, @sequence, @title, @subtitle, @time_range, @status)`
    ).run({ ...module, camp_id: "beijing-2026-summer" });
  };

  const upsertPage = (page: {
    module_id: string;
    page_no: number;
    title: string;
    page_type: string;
    activity_buttons: string[];
    content_summary: string;
  }) => {
    const id = `${page.module_id}-${page.page_no}`;
    const existing = db.prepare("SELECT id FROM lesson_pages WHERE id = ?").get(id);
    const payload = {
      id,
      ...page,
      activity_buttons: JSON.stringify(page.activity_buttons),
      updated_at: nowSql()
    };
    if (existing) {
      db.prepare(
        `UPDATE lesson_pages
            SET module_id = @module_id,
                page_no = @page_no,
                title = @title,
                page_type = @page_type,
                activity_buttons = @activity_buttons,
                content_summary = @content_summary,
                updated_at = @updated_at
          WHERE id = @id`
      ).run(payload);
      return;
    }
    db.prepare(
      `INSERT INTO lesson_pages
        (id, module_id, page_no, title, page_type, activity_buttons, content_summary)
       VALUES
        (@id, @module_id, @page_no, @title, @page_type, @activity_buttons, @content_summary)`
    ).run(payload);
  };

  const modules = [
    ["future-photo-studio", 1, 1, "未来照相馆破冰", "用未来照片打开课堂", "09:00-10:00", "READY"],
    ["ai-judgement", 1, 2, "AI 基本原理与对话", "看懂 AI 怎么工作，学会问 DeepSeek", "10:00-11:10", "READY"],
    ["team-formation", 1, 3, "组队找方向", "组队，认识创业方向怎么找", "11:20-12:00", "READY"],
    ["project-launch", 1, 4, "团队讨论定方向", "确定团队方向和需求收集计划", "14:00-16:30", "READY"],
    ["day1-reflection", 1, 5, "方向发布与行动计划", "把方向和下一步行动放到大屏", "16:30-17:30", "READY"],
    ["problem-wall", 0, 90, "便利贴侦探", "从身边小麻烦找到真实问题", "隐藏", "ARCHIVED"],
    ["ai-superpowers", 0, 91, "豆包问题改写与市场侦察", "把烦恼改成问题，再看已有方案", "隐藏", "ARCHIVED"],
    ["user-interview", 0, 92, "秘密采访行动", "把想法问清楚", "隐藏", "ARCHIVED"],
    ["day2-kickoff", 2, 1, "产品目标回看", "确认今天要做出的核心版本", "09:00-09:15", "READY"],
    ["ai-lab", 2, 2, "大模型和五句提示词", "豆包出版本，DeepSeek 帮检查", "09:15-09:45", "READY"],
    ["product-prototype", 2, 3, "最小可演示产品", "只先做一个能跑通的核心动作", "09:45-11:10", "READY"],
    ["tech-route", 2, 4, "技术路线与流程图", "选路线，画出 3-5 步使用流程", "10:50-12:00", "READY"],
    ["tool-demo", 2, 5, "扣子智能体与秒哒原型", "智能体、工作流和可打开应用", "14:00-14:20", "READY"],
    ["build-sprint", 2, 6, "核心功能制作", "把核心动作做出来", "14:20-15:45", "READY"],
    ["user-testing", 2, 7, "试玩互测与迭代", "先看别人怎么用，再改一版", "15:45-17:00", "READY"],
    ["demo-check", 2, 8, "2 分钟 Demo", "让作品跑通给大家看", "17:00-17:30", "READY"],
    ["roadshow-rehearsal", 3, 1, "WorkBuddy 路演材料包", "把材料整理成作品链接和路演 PPT", "09:00-09:20", "READY"],
    ["value-experiment", 3, 2, "星星币价值实验", "用交换游戏看见产品价值", "09:20-09:50", "READY"],
    ["product-packaging", 3, 3, "产品包装", "产品名、标语、海报和亮点", "09:50-10:30", "READY"],
    ["brand-story", 3, 4, "融资路演问答预演", "用证据回答观察员追问", "10:40-12:00", "READY"],
    ["rehearsal", 3, 5, "彩排与最后修改", "按顺序演示、删字、调节奏", "14:00-15:00", "READY"],
    ["final-showcase", 3, 6, "终极作品秀", "面向家长观察员展示作品", "15:00-16:50", "READY"],
    ["awards-reflection", 3, 7, "颁奖与结营反思", "看见贡献，也写下下一次指挥 AI 的方法", "16:50-17:30", "READY"]
  ] as const;

  for (const [id, day, sequence, title, subtitle, time_range, status] of modules) {
    upsertModule({ id, day, sequence, title, subtitle, time_range, status });
  }

  const pageSeeds = [
    ["future-photo-studio", 1, "照相馆开门", "story", ["全屏演示", "投屏展示"], "讲一个好像能拍到长大后样子的照相馆故事"],
    ["future-photo-studio", 2, "未来照片寄到", "image", ["发起互动", "投屏展示"], "看几组现在照片和未来职业照，先猜职业"],
    ["future-photo-studio", 3, "下一张写着你", "activity", ["发布任务", "启动计时"], "扫码，拍今天的你，说出理想职业"],
    ["future-photo-studio", 4, "照片墙亮起来", "showcase", ["投屏展示"], "全班的未来照片一张张点亮"],
    ["future-photo-studio", 5, "AI 工作原理拆解", "experiment", ["全屏演示"], "AI 同时读照片、职业词和提示词，再生成一张新的未来想象照"],
    ["team-formation", 1, "创业方向不是凭空想出来", "story", ["全屏演示"], "一个小摊位先找到谁需要，再决定卖什么"],
    ["team-formation", 2, "老师演示：四格找方向", "demo", ["全屏演示"], "从人群、场景、麻烦和可做动作里找创业方向"],
    ["team-formation", 3, "找到队友和桌号", "teamwork", ["启动计时"], "老师指定成员和桌号，孩子找到今天一起做项目的人"],
    ["team-formation", 4, "团队名和方向卡", "experiment", ["发布任务"], "成员名单不用改，团队自己讨论团队名和第一个产品方向"],
    ["team-formation", 5, "团队方向亮相", "showcase", ["投屏展示"], "每组用一句话介绍团队名称和产品方向"],
    ["problem-wall", 1, "团队讨论：生活小麻烦", "teamwork", ["启动计时"], "每个人先写一个真实遇到过的小麻烦"],
    ["problem-wall", 2, "抓一张最想追的线索", "teamwork", ["发布任务"], "团队把小麻烦写成谁、在哪、卡在哪"],
    ["problem-wall", 3, "老师巡场：需求有没有人", "coaching", ["打开看板"], "老师观察问题是否有真实用户和具体场景"],
    ["problem-wall", 4, "需求线索墙", "showcase", ["投屏展示"], "全班看见哪些需求线索最值得继续调查"],
    ["ai-judgement", 1, "什么是 AI？", "story", ["全屏演示"], "它像电脑里的聪明大脑，会读字、会聊天，也能帮人生成内容。"],
    ["ai-judgement", 2, "AI 先会读字和聊天", "story", ["全屏演示"], "你打字问它，它读懂你的话，再用文字回答你。"],
    ["ai-judgement", 3, "老师演示：问得清楚，回答才有用", "demo", ["全屏演示"], "同样问 DeepSeek，说清帮谁、卡哪一步，答案马上变具体。"],
    ["ai-judgement", 4, "AI 还能看图：照片也是线索", "demo", ["全屏演示"], "除了文字，AI 也能看懂图片里的脸、动作和地方。"],
    ["ai-judgement", 5, "未来照相馆是这样画出来的", "demo", ["全屏演示"], "照片给样子，职业给方向，要求告诉它画成什么。"],
    ["ai-judgement", 6, "轮到你：问 DeepSeek 一句清楚问题", "experiment", ["发布任务"], "把团队方向填进去，挑出一句今天能继续讨论的线索。"],
    ["ai-superpowers", 1, "便利贴侦探：两张纸的差别", "story", ["全屏演示"], "同一个烦恼，写清谁、在哪、卡在哪，就能继续调查"],
    ["ai-superpowers", 2, "老师演示：豆包把烦恼改成问题", "demo", ["全屏演示"], "把一句抱怨改成 3 个可以采访的问题"],
    ["ai-superpowers", 3, "问题改写卡", "experiment", ["发布任务"], "每组把一个原始烦恼改成可采访问题"],
    ["ai-superpowers", 4, "市场侦察打开一条街", "story", ["全屏演示"], "看看别人已经怎么解决，再找出我们可以不一样的地方"],
    ["ai-superpowers", 5, "老师演示：DeepSeek 找已有方案", "demo", ["全屏演示"], "列出已有办法、适合谁、哪里还不够好"],
    ["ai-superpowers", 6, "AI 市场侦察卡", "experiment", ["发布任务"], "写下 3 个已有办法、一个不足和还要问真人的问题"],
    ["user-interview", 1, "团队分工：谁采访，谁记录", "teamwork", ["启动计时"], "团队分好采访、记录、追问和整理责任"],
    ["user-interview", 2, "带着三问去采访", "teamwork", ["发布任务"], "问真实用户发生过吗、多久一次、现在怎么解决"],
    ["user-interview", 3, "老师巡场：原话够不够真", "coaching", ["打开看板"], "老师看采访原话、频率和现在办法，帮助团队追问"],
    ["user-interview", 4, "绿灯黄灯红灯", "showcase", ["投屏展示"], "根据采访结果决定保留、缩小或换题"],
    ["project-launch", 1, "团队讨论：我们想帮谁", "teamwork", ["启动计时"], "团队从方向里选出最想服务的一类人"],
    ["project-launch", 2, "需求收集计划：问谁、问什么、看什么", "teamwork", ["发布任务"], "写清接下来要找谁收集需求，要问什么，要观察什么"],
    ["project-launch", 3, "老师巡场：方向太大就缩小", "coaching", ["打开看板"], "老师帮助团队把方向缩小到一个人群、一个场景、一个动作"],
    ["project-launch", 4, "方向和行动计划卡", "teamwork", ["发布任务"], "提交团队确定的方向、需求收集计划和 Day 2 先做动作"],
    ["project-launch", 5, "方向墙亮起来", "showcase", ["投屏展示"], "每组的方向和下一步行动在大屏上亮相"],
    ["day1-reflection", 1, "全班方向墙", "showcase", ["投屏展示"], "回看每组确定的方向、想帮的人和下一步行动"],
    ["day1-reflection", 2, "老师演示：明天开工前要带回什么", "demo", ["全屏演示"], "需求声音、场景照片、参考作品和核心动作会帮助明天开做"],
    ["day1-reflection", 3, "补齐行动计划", "experiment", ["发布任务"], "每组把要问的人、要收集的需求和 Day 2 先做动作补齐"],
    ["day1-reflection", 4, "明天先做哪一步", "showcase", ["投屏展示"], "每组带着一个清楚方向进入第二天制作"],
    ["day2-kickoff", 1, "团队晨会：今天先做哪一步", "teamwork", ["启动计时"], "每组读出产品一句话，决定今天必须先跑通的一步"],
    ["day2-kickoff", 2, "先让一个动作动起来", "teamwork", ["启动计时"], "把功能清单里最关键的一步圈出来"],
    ["day2-kickoff", 3, "老师巡场：核心动作够小吗", "coaching", ["打开看板"], "老师观察第一版范围是否能在今天完成"],
    ["ai-lab", 1, "大模型需要清楚任务", "story", ["全屏演示"], "豆包和 DeepSeek 都能生成内容，但要先听清任务"],
    ["ai-lab", 2, "老师演示：豆包先出三版", "demo", ["全屏演示"], "输入目标、用户、材料、限制和格式，让豆包给出多个版本"],
    ["ai-lab", 3, "老师演示：DeepSeek 帮忙检查", "demo", ["全屏演示"], "把豆包第一版交给 DeepSeek，看哪里太夸张、哪里缺证据"],
    ["ai-lab", 4, "五句提示词卡", "experiment", ["发布任务"], "给自己的产品写一张可复用提示词卡"],
    ["ai-lab", 5, "对 AI 说：不对，再改", "experiment", ["发起互动"], "把 AI 初稿改到更符合用户和证据"],
    ["product-prototype", 1, "团队讨论：功能全倒出来", "teamwork", ["启动计时"], "团队把想做的功能先全部放到桌面上"],
    ["product-prototype", 2, "选择核心动作", "teamwork", ["发布任务"], "团队留下别人 30 秒能看懂、能试用的一步"],
    ["product-prototype", 3, "老师巡场：第一版能被试用吗", "coaching", ["打开看板"], "老师观察第一版是否小到能做、清楚到能试"],
    ["tech-route", 1, "团队选择制作路线", "teamwork", ["发布任务"], "团队选择标准、轻量、进阶或兜底路线"],
    ["tech-route", 2, "画出用户使用流程", "teamwork", ["启动计时"], "从打开作品到看到结果，画出 3-5 步"],
    ["tech-route", 3, "老师巡场：路线今天能完成吗", "coaching", ["打开看板"], "老师帮助团队判断路线是否适合今天完成"],
    ["tool-demo", 1, "产品需要一个会接待用户的脑袋", "story", ["全屏演示"], "用户不想读长说明，只想问一句真实问题"],
    ["tool-demo", 2, "老师演示：扣子最小智能体", "demo", ["全屏演示"], "写清智能体名字、服务对象、任务边界和开场问题"],
    ["tool-demo", 3, "工作流：把步骤排清楚", "demo", ["全屏演示"], "把收集信息、判断、输出结果排成固定步骤"],
    ["tool-demo", 4, "老师演示：秒哒生成应用原型", "demo", ["全屏演示"], "用自然语言写清用户、场景、核心动作和页面要求"],
    ["tool-demo", 5, "生成可打开的 V1", "experiment", ["发布任务"], "把产品一句话变成一个浏览器能打开的第一版"],
    ["build-sprint", 1, "团队制作冲刺", "teamwork", ["启动计时"], "团队进入制作冲刺，先让核心动作动起来"],
    ["build-sprint", 2, "老师巡场：卡点写清楚", "coaching", ["打开看板"], "老师看卡点、答疑解惑、记录每组需要的支援"],
    ["build-sprint", 3, "做出产品原型 V1", "teamwork", ["启动计时"], "让作品先能打开、能试、能讲清楚"],
    ["build-sprint", 4, "真产品检查", "showcase", ["投屏展示"], "浏览器能打开，别人能完成一个动作，团队能分享给家长看"],
    ["user-testing", 1, "团队互测：先看别人怎么用", "teamwork", ["发布任务"], "别组同学变成第一批用户，先观察动作和停顿"],
    ["user-testing", 2, "团队讨论：反馈怎么进作品", "teamwork", ["打开看板"], "把收到的建议分成必须改、建议改、以后改"],
    ["user-testing", 3, "老师巡场：V2 先改哪一处", "coaching", ["打开看板"], "老师帮助团队决定下一版先改哪一个关键点"],
    ["user-testing", 4, "改出 V2", "showcase", ["投屏展示"], "展示改动前后哪里更清楚"],
    ["demo-check", 1, "团队准备 2 分钟 Demo", "teamwork", ["启动计时"], "只展示产品怎么帮用户完成一件事"],
    ["demo-check", 2, "老师巡场：用户、作品、结果能连上吗", "coaching", ["打开看板"], "老师观察产品链接、截图、故事线索和分工是否接得上"],
    ["demo-check", 3, "把 AI 跑偏改回来", "experiment", ["发布任务"], "写下一次让 AI 改得更清楚的方法"],
    ["roadshow-rehearsal", 1, "发布会前，材料铺满桌面", "story", ["全屏演示"], "作品链接、截图、采访证据和分工都在桌上，需要排成路演顺序"],
    ["roadshow-rehearsal", 2, "老师演示：WorkBuddy 整理材料包", "demo", ["全屏演示"], "把已有材料整理成 5 分钟路演顺序、成员分工和 PPT 大纲"],
    ["roadshow-rehearsal", 3, "作品链接和路演 PPT", "experiment", ["发布任务"], "每组只提交作品链接和路演 PPT，让材料保持轻巧"],
    ["value-experiment", 1, "星星币市场开张", "story", ["全屏演示"], "产品有没有价值，要看别人愿不愿意交换"],
    ["value-experiment", 2, "老师演示：一张价值小票", "demo", ["全屏演示"], "谁会用，愿意付出什么，为什么值得"],
    ["value-experiment", 3, "帮别人少烦了什么", "experiment", ["发布任务"], "说清产品带来的变化，再做一次价值交换"],
    ["value-experiment", 4, "价值交换榜", "showcase", ["投屏展示"], "看大家愿意用什么交换"],
    ["product-packaging", 1, "作品要站上摊位了", "story", ["全屏演示"], "别人第一眼要看懂产品帮谁、怎么帮"],
    ["product-packaging", 2, "老师演示：海报不是装饰", "demo", ["全屏演示"], "名字、标语、截图和三条亮点都服务理解"],
    ["product-packaging", 3, "给产品一个名字", "experiment", ["发布任务"], "完成名字、标语、截图和三条亮点"],
    ["product-packaging", 4, "产品摊位预览", "showcase", ["投屏展示"], "把每组产品海报排成作品街"],
    ["brand-story", 1, "观察员会追问", "story", ["全屏演示"], "好路演要经得起提问：你怎么知道真的有人需要"],
    ["brand-story", 2, "老师演示：DeepSeek 模拟追问", "demo", ["全屏演示"], "让 DeepSeek 扮演观察员，围绕用户、作品、证据和下一步提问"],
    ["brand-story", 3, "结论、证据、下一步", "experiment", ["发布任务"], "每组选 2 个最可能被问到的问题，用证据回答"],
    ["rehearsal", 1, "融资路演彩排开始", "teamwork", ["启动计时"], "团队按发布顺序完整走一遍"],
    ["rehearsal", 2, "团队删掉一句多余的话", "teamwork", ["打开看板"], "把时间留给作品、用户和结果"],
    ["rehearsal", 3, "老师观察记录：谁负责哪一步", "coaching", ["打开看板"], "老师记录每个孩子在路演里的真实贡献"],
    ["final-showcase", 1, "融资路演发布会开场", "showcase", ["全屏演示"], "每组把作品、用户和下一步讲给观察员"],
    ["final-showcase", 2, "每组 5 分钟融资路演", "showcase", ["进入评分"], "让大家看到用户怎么用、结果是什么"],
    ["final-showcase", 3, "观察员提问和投票", "showcase", ["发起互动", "进入评分"], "观察员提问、投票，也给出下一步建议"],
    ["awards-reflection", 1, "证据星星落到每个人手上", "showcase", ["投屏展示"], "共情力、提问力、创造力、判断力、领导力都有证据"],
    ["awards-reflection", 2, "每个人的贡献被看见", "showcase", ["投屏展示"], "看见每个人在团队里的真实贡献"],
    ["awards-reflection", 3, "下一次我怎么指挥 AI", "activity", ["发布任务"], "写下下一次想继续练习的方法"]
  ] as const;

  for (const [module_id, page_no, title, page_type, activity_buttons, content_summary] of pageSeeds) {
    upsertPage({ module_id, page_no, title, page_type, activity_buttons: [...activity_buttons], content_summary });
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
