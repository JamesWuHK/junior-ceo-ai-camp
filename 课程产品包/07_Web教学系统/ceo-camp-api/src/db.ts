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
    ["future-photo-studio", 1, 1, "未来照相馆", "先看照片，猜猜他们长大后在做什么", "09:00-09:40", "READY"],
    ["ai-judgement", 1, 2, "AI 基本原理与对话", "知道 AI 会读字、看图、生成，也要人来修改", "09:40-10:20", "READY"],
    ["workbuddy-webpage", 1, 3, "WorkBuddy 变网页", "看一句话怎样变成能点开的页面", "10:35-11:10", "READY"],
    ["team-formation", 1, 4, "从一个小麻烦开始", "先看见谁卡住，再想怎么帮他一下", "11:10-11:50", "READY"],
    ["track-cases", 1, 5, "四条赛道的产品故事", "看清谁卡住、怎么帮、为什么还想用", "13:30-14:20", "READY"],
    ["project-launch", 1, 6, "组队，定下自己的项目", "起队名，选赛道，说清想帮谁", "14:20-15:10", "READY"],
    ["user-interview", 1, 7, "问真人，听原话", "把想法拿去问一问，看看有没有人真的遇到", "15:25-16:10", "READY"],
    ["day1-reflection", 1, 8, "分好工，点亮方向墙", "每个人有事做，明天知道先做哪一步", "16:10-17:00", "READY"],
    ["problem-wall", 0, 90, "便利贴侦探", "从身边小麻烦找到真实问题", "隐藏", "ARCHIVED"],
    ["ai-superpowers", 0, 91, "豆包问题改写与市场侦察", "把烦恼改成问题，再看已有方案", "隐藏", "ARCHIVED"],
    ["day2-kickoff", 2, 1, "产品目标回看", "确认今天要做出的核心版本", "09:00-09:15", "READY"],
    ["ai-lab", 2, 2, "大模型和五句提示词", "豆包出版本，DeepSeek 帮检查", "09:15-09:45", "READY"],
    ["product-prototype", 2, 3, "最小可演示产品", "只先做一个能跑通的核心动作", "09:45-11:10", "READY"],
    ["tech-route", 2, 4, "技术路线与流程图", "选路线，画出 3-5 步使用流程", "10:50-12:00", "READY"],
    ["tool-demo", 2, 5, "扣子智能体与秒哒原型", "智能体、工作流和可打开应用", "14:00-14:20", "READY"],
    ["build-sprint", 2, 6, "核心功能制作", "把核心动作做出来", "14:20-15:45", "READY"],
    ["user-testing", 2, 7, "试玩互测与迭代", "先看别人怎么用，再改一版", "15:45-17:00", "READY"],
    ["demo-check", 2, 8, "2 分钟 Demo", "让作品跑通给大家看", "17:00-17:30", "READY"],
    ["roadshow-rehearsal", 3, 1, "WorkBuddy 发布材料包", "把材料整理成作品链接和发布 PPT", "09:00-09:20", "READY"],
    ["value-experiment", 3, 2, "星星币价值实验", "用交换游戏看见产品价值", "09:20-09:50", "READY"],
    ["product-packaging", 3, 3, "产品包装", "产品名、标语、海报和亮点", "09:50-10:30", "READY"],
    ["brand-story", 3, 4, "作品发布问答预演", "用证据回答观察员追问", "10:40-12:00", "READY"],
    ["rehearsal", 3, 5, "彩排与最后修改", "按顺序演示、删字、调节奏", "14:00-15:00", "READY"],
    ["final-showcase", 3, 6, "终极作品秀", "面向家长观察员展示作品", "15:00-16:50", "READY"],
    ["awards-reflection", 3, 7, "颁奖与结营反思", "看见贡献，也写下下一次指挥 AI 的方法", "16:50-17:30", "READY"]
  ] as const;

  for (const [id, day, sequence, title, subtitle, time_range, status] of modules) {
    upsertModule({ id, day, sequence, title, subtitle, time_range, status });
  }

  const pageSeeds = [
    ["future-photo-studio", 1, "照相馆开门", "story", ["全屏演示", "投屏展示"], "讲一个好像能拍到长大后样子的照相馆故事"],
    ["future-photo-studio", 2, "先猜猜职业", "image", ["发起互动", "投屏展示"], "看几组现在照片和未来职业照，先猜职业"],
    ["future-photo-studio", 3, "下一张轮到你", "activity", ["发布任务", "启动计时"], "扫码，拍今天的你，说出理想职业"],
    ["future-photo-studio", 4, "照片墙亮起来", "showcase", ["投屏展示"], "全班的未来照片一张张点亮"],
    ["future-photo-studio", 5, "照片怎么画出来", "experiment", ["全屏演示"], "AI 看照片，也读职业和任务，再画出新的未来想象照"],
    ["ai-judgement", 1, "什么是 AI？", "story", ["全屏演示"], "它像电脑里的聪明大脑：先读懂线索，再回答、画图或帮你做作品。"],
    ["ai-judgement", 2, "AI 能读字，也能看图", "story", ["全屏演示"], "文字和图片都能成为线索，AI 会根据线索继续生成。"],
    ["ai-judgement", 3, "未来照相馆是这样画出来的", "demo", ["全屏演示"], "照片给样子，职业给方向，任务要求告诉它画成什么。"],
    ["ai-judgement", 4, "先说清楚：你想画什么？", "experiment", ["发布任务"], "说清画里有谁、在哪里、正在做什么，再加一个细节。"],
    ["ai-judgement", 5, "打开 WorkBuddy，画一张自己的图", "experiment", ["发布任务"], "生成第一张图，再说清一处想修改或增加的细节。"],
    ["workbuddy-webpage", 1, "一句话让小游戏跑起来", "story", ["全屏演示"], "输入一句话，浏览器里出现一个能玩的俄罗斯方块页面。"],
    ["workbuddy-webpage", 2, "它不只会做游戏", "demo", ["全屏演示"], "同样的能力也能做帮助别人的小页面。"],
    ["workbuddy-webpage", 3, "出门检查台跑一遍", "demo", ["全屏演示"], "给早上怕漏带的同学做一个页面：粘贴课表和通知，得到出门清单。"],
    ["workbuddy-webpage", 4, "给网页一句清楚任务", "experiment", ["发布任务"], "说清给谁用、做什么、最后看到什么结果。"],
    ["workbuddy-webpage", 5, "第一版页面长什么样", "showcase", ["投屏展示"], "看见输入区、按钮和结果区怎样组成一个可试玩页面。"],
    ["team-formation", 1, "两个小摊位", "story", ["全屏演示"], "一个只喊厉害，另一个说清帮谁少掉什么麻烦。"],
    ["team-formation", 2, "故事：上学出门检查台", "story", ["全屏演示"], "乐乐早上想不全，后来用清单把东西带齐，出门不慌。"],
    ["team-formation", 3, "老师演示：上学出门检查台", "demo", ["全屏演示"], "把用户、需求、产品、第一步和少掉的麻烦拆开看。"],
    ["team-formation", 4, "别人为什么愿意换", "demo", ["全屏演示"], "从试玩、推荐、星星币，看懂价值交换和价格。"],
    ["team-formation", 5, "轮到你：写帮忙卡", "experiment", ["发布任务", "启动计时"], "写下想帮谁、卡在哪、先帮哪一步、少掉什么麻烦。"],
    ["track-cases", 1, "四条赛道地图", "story", ["全屏演示"], "生活帮手、学习工具、创意工坊、校园社区都从真实麻烦开始。"],
    ["track-cases", 2, "生活帮手：上学出门检查台", "story", ["全屏演示"], "明天要上学，最怕早上漏带东西。它把课表和通知变成出门清单，出门前自己勾一遍。"],
    ["track-cases", 3, "学习工具：应用题拆题板", "story", ["全屏演示"], "长应用题一大段，先不知道看哪句。它把题目拆成几块，先找到第一步。"],
    ["track-cases", 4, "创意工坊：四格漫画分镜台", "story", ["全屏演示"], "脑子里有故事，可四格怎么排很卡。它先给分镜和对白草稿，孩子再改。"],
    ["track-cases", 5, "校园社区：校园活动组队板", "story", ["全屏演示"], "想参加活动，却不知道谁也想来。它把活动卡发出来，让同伴更快找到你。"],
    ["track-cases", 6, "选一条路，做自己的题", "experiment", ["发布任务"], "选主赛道，再写出自己团队想帮的人。"],
    ["project-launch", 1, "找到今天的队友", "teamwork", ["启动计时"], "老师指定成员和桌号，团队名和方向由孩子自己决定。"],
    ["project-launch", 2, "给团队起一个名字", "teamwork", ["启动计时"], "名字短、好记，团队自己决定。"],
    ["project-launch", 3, "选一条路，定下要帮谁", "teamwork", ["启动计时"], "选主赛道，写清想帮谁和卡在哪一步。"],
    ["project-launch", 4, "一句话说清你们想帮谁", "teamwork", ["发布任务"], "我们做一个产品，帮谁在什么场景里少掉一个麻烦。"],
    ["project-launch", 5, "把团队方向放上来", "teamwork", ["发布任务"], "放上团队名、主赛道、想帮谁、卡点和产品一句话。"],
    ["ai-superpowers", 1, "便利贴侦探：两张纸的差别", "story", ["全屏演示"], "同一个烦恼，写清谁、在哪、卡在哪，就能继续调查"],
    ["ai-superpowers", 2, "老师演示：豆包把烦恼改成问题", "demo", ["全屏演示"], "把一句抱怨改成 3 个可以采访的问题"],
    ["ai-superpowers", 3, "问题改写卡", "experiment", ["发布任务"], "每组把一个原始烦恼改成可采访问题"],
    ["ai-superpowers", 4, "市场侦察打开一条街", "story", ["全屏演示"], "看看别人已经怎么解决，再找出我们可以不一样的地方"],
    ["ai-superpowers", 5, "老师演示：DeepSeek 找已有方案", "demo", ["全屏演示"], "列出已有办法、适合谁、哪里还不够好"],
    ["ai-superpowers", 6, "AI 市场侦察卡", "experiment", ["发布任务"], "写下 3 个已有办法、一个不足和还要问真人的问题"],
    ["user-interview", 1, "谁去问，谁来记", "teamwork", ["启动计时"], "分好采访、记录、追问和整理责任。"],
    ["user-interview", 2, "带着三问去找人聊", "teamwork", ["发布任务"], "问真实用户遇到过吗、现在怎么解决、愿不愿意试。"],
    ["user-interview", 3, "记下一句原话", "teamwork", ["发布任务"], "保留对方真实说法，写下现在办法。"],
    ["user-interview", 4, "绿灯继续，黄灯缩小，红灯换线索", "showcase", ["投屏展示"], "根据采访结果决定保留、缩小或换题。"],
    ["day1-reflection", 1, "明天谁负责哪一步", "teamwork", ["启动计时"], "分好用户观察、产品整理、AI 指挥和展示记录。"],
    ["day1-reflection", 2, "明天先做哪一步", "teamwork", ["发布任务"], "写清明天先做哪一个页面或动作。"],
    ["day1-reflection", 3, "方向墙亮起来", "showcase", ["投屏展示"], "看见每组团队名、赛道、想帮谁和明天先做什么。"],
    ["day1-reflection", 4, "每组 30 秒说明天先做什么", "showcase", ["投屏展示"], "每组带着一个清楚方向进入第二天制作。"],
    ["day2-kickoff", 1, "昨天我们决定帮谁", "showcase", ["投屏展示"], "回看方向墙和每组的产品一句话"],
    ["day2-kickoff", 2, "今天必须做出来", "teamwork", ["发布任务", "启动计时"], "圈出今天要跑通的核心动作"],
    ["day2-kickoff", 3, "晚上检查三件事", "teamwork", ["启动计时"], "能打开、能试玩、能演示"],
    ["ai-lab", 1, "四个项目都收到空话", "story", ["全屏演示"], "四条赛道各派一个项目来问 AI，结果都卡在同一个地方：任务单没说清楚"],
    ["ai-lab", 2, "老师演示：同一个项目，说清楚再问", "demo", ["全屏演示"], "同一个项目，把问法说清楚，AI 就能交出能继续做的材料"],
    ["ai-lab", 3, "AI 第一版，先挑能用的", "demo", ["全屏演示"], "四个项目都拿到 AI 第一版，孩子留下能用的，划掉没证据的"],
    ["ai-lab", 4, "DeepSeek 当检查员", "demo", ["全屏演示"], "让 DeepSeek 帮四个项目找出太大、没证据、今天做不到的句子"],
    ["ai-lab", 5, "轮到你：写一张 AI 任务单", "experiment", ["发布任务"], "把自己小组的项目写成五句话，让 AI 交出一段马上能用的材料"],
    ["product-prototype", 1, "12 个按钮挤在第一屏", "story", ["全屏演示"], "四个项目都想做很多功能，可用户其实只想先完成一个动作"],
    ["product-prototype", 2, "老师演示：先救一个动作", "demo", ["全屏演示"], "四条赛道都先救一个动作：列出门清单、拆应用题、排四格分镜、生成组队卡"],
    ["product-prototype", 3, "这就是 MVP：先试最小一版", "demo", ["全屏演示"], "四个项目的 MVP 都很小，但每一个都能让别人试到结果"],
    ["product-prototype", 4, "轮到你：把功能倒在桌面上", "teamwork", ["启动计时"], "先把想做的功能都摊开，再找最先能动的那一块"],
    ["product-prototype", 5, "圈出第一个能被试玩的动作", "experiment", ["发布任务"], "圈出 30 秒能看懂、能操作、能看到结果的第一个动作"],
    ["tech-route", 1, "今天选一条能完成的路", "teamwork", ["发布任务"], "团队选择标准、轻量、进阶或兜底路线"],
    ["tech-route", 2, "用户打开后第一步做什么？", "teamwork", ["启动计时"], "从打开作品到看到结果，画出第一步"],
    ["tech-route", 3, "3-5 步走到结果", "teamwork", ["启动计时"], "把使用流程画成 3-5 步"],
    ["tech-route", 4, "路线卡提交", "teamwork", ["发布任务"], "提交路线选择和 3-5 步使用流程"],
    ["tool-demo", 1, "用户进门，只问了一句话", "story", ["全屏演示"], "作品不能只贴说明书，要能接住用户的第一个真实问题"],
    ["tool-demo", 2, "老师演示：给产品装一个接待员", "demo", ["全屏演示"], "用扣子写清名字、帮谁、能做什么、不能做什么和开场问题"],
    ["tool-demo", 3, "接待员跑偏了怎么办？", "demo", ["全屏演示"], "用一条真实问题测试，再改边界和回答方式"],
    ["tool-demo", 4, "老师演示：把步骤排成小轨道", "demo", ["全屏演示"], "先收集信息，再判断，最后只输出 3 步结果"],
    ["tool-demo", 5, "老师演示：把一句话变成可打开页面", "demo", ["全屏演示"], "用秒哒写清用户、场景、核心动作和页面要求"],
    ["tool-demo", 6, "轮到你：让 V1 打开一次", "experiment", ["发布任务"], "把产品一句话变成浏览器能打开的第一版"],
    ["build-sprint", 1, "制作开始", "teamwork", ["启动计时"], "团队进入制作冲刺"],
    ["build-sprint", 2, "先让核心动作动起来", "teamwork", ["启动计时"], "先让别人能完成一个最关键动作"],
    ["build-sprint", 3, "卡在哪里，写清楚", "coaching", ["发布任务", "打开看板"], "把当前卡点写成别人能帮忙的一句话"],
    ["build-sprint", 4, "V1 保留下来", "teamwork", ["发布任务"], "提交作品链接、截图或录屏，留下第一版证据"],
    ["user-testing", 1, "第一批用户来了", "story", ["全屏演示"], "作品自己觉得清楚，别人一用才知道哪里卡住"],
    ["user-testing", 2, "先看别人怎么用", "teamwork", ["启动计时"], "观察动作、停顿和提问"],
    ["user-testing", 3, "老师演示：把一句反馈变成改动", "demo", ["全屏演示"], "把“看不懂按钮”变成“按钮改名 + 放到第一屏”"],
    ["user-testing", 4, "给别组一条反馈", "experiment", ["发布任务"], "给别组一条能帮助下一版的反馈"],
    ["user-testing", 5, "改出 V2", "experiment", ["发布任务"], "把反馈分成必须改、建议改、以后改"],
    ["demo-check", 1, "2 分钟 Demo", "story", ["全屏演示"], "四个项目都只跑一条主线：用户、作品、结果和下一步"],
    ["demo-check", 2, "用户、作品、结果连起来", "demo", ["全屏演示", "启动计时"], "老师示范按用户、作品、结果的顺序讲清楚"],
    ["demo-check", 3, "AI 跑偏怎么改回来", "experiment", ["发布任务"], "写下一次让 AI 改得更清楚的方法"],
    ["demo-check", 4, "明天发布会要带什么", "teamwork", ["发布任务"], "准备链接、截图、故事线索和分工"],
    ["roadshow-rehearsal", 1, "发布盒子里乱成一团", "story", ["全屏演示"], "作品链接、截图、采访原话和分工纸条都在桌上，先排出上台顺序"],
    ["roadshow-rehearsal", 2, "老师演示：WorkBuddy 整理发布盒子", "demo", ["全屏演示"], "把材料交给 WorkBuddy 分堆，再由团队删掉不真实、太长、没用的句子"],
    ["roadshow-rehearsal", 3, "一页只讲一件事", "demo", ["全屏演示"], "发布 PPT 不塞满，一页只帮观察员看懂一件事"],
    ["roadshow-rehearsal", 4, "轮到你：交出发布盒子", "experiment", ["发布任务"], "把作品链接、发布 PPT、证据和上台分工一起装进发布盒子"],
    ["value-experiment", 1, "星星币市场开张", "story", ["全屏演示"], "四个项目摆上作品街，孩子先试玩，再决定星星币交给谁"],
    ["value-experiment", 2, "他为什么愿意换？", "story", ["全屏演示"], "四个项目都要说清楚：它到底帮别人少掉了哪一种麻烦"],
    ["value-experiment", 3, "老师演示：一张价值小票", "demo", ["全屏演示"], "写清谁会用、少烦什么、愿意交换什么"],
    ["value-experiment", 4, "轮到你：写价值小票", "experiment", ["发布任务"], "把产品带来的真实变化写成一张能被别人读懂的小票"],
    ["value-experiment", 5, "价值交换榜", "showcase", ["投屏展示"], "看大家愿意用什么交换"],
    ["product-packaging", 1, "作品摊位开张了", "story", ["全屏演示"], "四个项目都要摆成摊位卡，让同学 3 秒看懂帮谁、怎么帮"],
    ["product-packaging", 2, "老师演示：换一张让人看懂的卡", "demo", ["全屏演示"], "四个项目都把大口号换成产品名、真实动作和一张能看懂的截图"],
    ["product-packaging", 3, "标语不是夸自己", "demo", ["全屏演示"], "好标语不喊厉害，它直接告诉用户打开后能完成什么"],
    ["product-packaging", 4, "轮到你：摆好自己的作品摊位", "experiment", ["发布任务"], "摆出名字、截图、一句话和 3 个亮点，让别人愿意点开试一次"],
    ["product-packaging", 5, "产品摊位预览", "showcase", ["投屏展示"], "把每组产品海报排成作品街"],
    ["brand-story", 1, "观察员举手了", "story", ["全屏演示"], "观察员开始追问四个项目：你怎么知道真的有人需要？证据在哪里？"],
    ["brand-story", 2, "老师演示：DeepSeek 扮演观察员", "demo", ["全屏演示"], "让 DeepSeek 先追问四个项目，团队再准备自己的真实回答"],
    ["brand-story", 3, "好回答像三明治", "demo", ["全屏演示"], "四个项目都用同一招：先答结论，中间夹证据，最后说下一步"],
    ["brand-story", 4, "轮到你：抽出 2 张追问卡", "teamwork", ["启动计时"], "选出最可能被问到的两个问题，准备 30 秒证据回答"],
    ["brand-story", 5, "用证据回答", "experiment", ["发布任务"], "用采访原话、试玩反馈或现场演示，让回答听起来有根"],
    ["rehearsal", 1, "彩排开始", "teamwork", ["启动计时"], "团队按发布顺序完整走一遍"],
    ["rehearsal", 2, "删掉一句多余的话", "teamwork", ["打开看板"], "把时间留给作品、用户和结果"],
    ["rehearsal", 3, "谁负责哪一步", "teamwork", ["启动计时"], "每个人确认自己负责的展示段落"],
    ["rehearsal", 4, "最终提交", "teamwork", ["发布任务"], "提交作品链接、发布 PPT 和备用截图"],
    ["final-showcase", 1, "作品秀开场", "showcase", ["全屏演示"], "今天看用户、作品、结果和下一步"],
    ["final-showcase", 2, "每组 5 分钟发布", "showcase", ["进入评分"], "展示作品卡和可打开链接"],
    ["final-showcase", 3, "观察员提问", "showcase", ["发起互动", "进入评分"], "用证据回答观察员追问"],
    ["final-showcase", 4, "看见亮点，给出下一步建议", "showcase", ["进入评分"], "看见亮点，也给团队一个下一步建议"],
    ["awards-reflection", 1, "五力证书", "showcase", ["投屏展示"], "共情力、提问力、创造力、判断力、领导力都有证据"],
    ["awards-reflection", 2, "每个人的贡献被看见", "showcase", ["发布任务", "投屏展示"], "队友互相点名真实贡献"],
    ["awards-reflection", 3, "下一次我怎么指挥 AI", "activity", ["发布任务"], "写下下一次想继续练习的方法"],
    ["awards-reflection", 4, "带走自己的作品故事", "showcase", ["投屏展示"], "带走自己的作品、贡献和下一次 AI 协作计划"]
  ] as const;

  for (const [module_id, page_no, title, page_type, activity_buttons, content_summary] of pageSeeds) {
    upsertPage({ module_id, page_no, title, page_type, activity_buttons: [...activity_buttons], content_summary });
  }

  const d1CourseModulesToPrune = new Set([
    "future-photo-studio",
    "ai-judgement",
    "workbuddy-webpage",
    "team-formation",
    "track-cases",
    "project-launch",
    "user-interview",
    "day1-reflection"
  ]);
  const d1PageNumbersByModule = new Map<string, number[]>();
  for (const [module_id, page_no] of pageSeeds) {
    if (!d1CourseModulesToPrune.has(module_id)) continue;
    const pageNumbers = d1PageNumbersByModule.get(module_id) ?? [];
    pageNumbers.push(page_no);
    d1PageNumbersByModule.set(module_id, pageNumbers);
  }
  for (const [module_id, pageNumbers] of d1PageNumbersByModule) {
    const placeholders = pageNumbers.map(() => "?").join(", ");
    db.prepare(`DELETE FROM lesson_pages WHERE module_id = ? AND page_no NOT IN (${placeholders})`)
      .run([module_id, ...pageNumbers]);
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
