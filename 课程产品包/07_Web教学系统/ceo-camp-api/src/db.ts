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
      screenshot_url TEXT,
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

function migrateShowcaseItems() {
  const columns = db.prepare("PRAGMA table_info(showcase_items)").all() as { name: string }[];
  const hasColumn = (name: string) => columns.some((column) => column.name === name);
  if (!hasColumn("screenshot_url")) db.exec("ALTER TABLE showcase_items ADD COLUMN screenshot_url TEXT");
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
    ["future-photo-studio", 1, 1, "未来照相馆", "开场 AI 体验与照片墙", "09:00-10:10", "READY"],
    ["team-formation", 1, 2, "团队组建", "把每个人放进一个真实团队", "10:10-10:30", "READY"],
    ["problem-wall", 1, 3, "便利贴侦探", "从身边小麻烦找到真实问题", "10:30-11:10", "READY"],
    ["ai-judgement", 1, 4, "AI 判断力", "带着证据使用 AI", "11:20-12:00", "READY"],
    ["ai-superpowers", 1, 5, "AI 超能力实验室", "写、改、解释、限制、纠错、验证", "14:00-14:35", "READY"],
    ["user-interview", 1, 6, "秘密采访行动", "把想法问清楚", "14:35-15:55", "READY"],
    ["project-launch", 1, 7, "项目立项", "把真问题写成产品一句话", "15:55-17:20", "READY"],
    ["day1-reflection", 1, 8, "Day 1 收束", "把今天的发现收进明天的制作", "17:20-17:30", "READY"],
    ["day2-kickoff", 2, 1, "产品目标回看", "确认今天要做出的核心版本", "09:00-09:15", "READY"],
    ["ai-lab", 2, 2, "Prompt 基础", "五句提示词让 AI 更听得懂", "09:15-09:45", "READY"],
    ["product-prototype", 2, 3, "最小可演示产品", "只先做一个能跑通的核心动作", "09:45-11:10", "READY"],
    ["tech-route", 2, 4, "技术路线与流程图", "选路线，画出 3-5 步使用流程", "10:50-12:00", "READY"],
    ["tool-demo", 2, 5, "工具演示", "从一句话到可打开的第一版", "14:00-14:20", "READY"],
    ["build-sprint", 2, 6, "核心功能制作", "把核心动作做出来", "14:20-15:45", "READY"],
    ["user-testing", 2, 7, "试玩互测与迭代", "先看别人怎么用，再改一版", "15:45-17:00", "READY"],
    ["demo-check", 2, 8, "2 分钟 Demo", "让作品跑通给大家看", "17:00-17:30", "READY"],
    ["roadshow-rehearsal", 3, 1, "产品状态检查", "确认每组作品能顺利演示", "09:00-09:20", "READY"],
    ["value-experiment", 3, 2, "星星币价值实验", "用交换游戏看见产品价值", "09:20-09:50", "READY"],
    ["product-packaging", 3, 3, "产品包装", "产品名、标语、海报和亮点", "09:50-10:30", "READY"],
    ["brand-story", 3, 4, "故事发布结构", "把作品讲成别人听得懂的小故事", "10:40-12:00", "READY"],
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
    ["future-photo-studio", 5, "秘密揭晓", "experiment", ["全屏演示"], "AI 根据照片和职业关键词画出未来想象照"],
    ["team-formation", 1, "找到你的桌号", "activity", ["启动计时"], "找到队友，给团队起一个能被记住的名字"],
    ["team-formation", 2, "四个责任放上桌", "activity", ["发布任务"], "把采访、产品、AI、展示四件事分给不同成员"],
    ["team-formation", 3, "团队名片亮相", "showcase", ["投屏展示"], "用一句话介绍团队要一起完成什么"],
    ["team-formation", 4, "每个人都是自己 AI 的 CEO", "story", ["全屏演示"], "指挥 AI、判断 AI、对自己的作品负责"],
    ["problem-wall", 1, "今天我们当便利贴侦探", "story", ["发起互动"], "从生活里的小麻烦开始找线索"],
    ["problem-wall", 2, "把烦恼改成帮谁解决什么", "activity", ["发布任务"], "把一句抱怨改写成可以继续调查的问题"],
    ["problem-wall", 3, "班级线索墙", "showcase", ["投屏展示"], "让线索来自更多真实声音"],
    ["ai-judgement", 1, "AI 给答案，先看证据", "story", ["发起互动"], "找到 AI 答案里最可疑的一句"],
    ["ai-judgement", 2, "真假侦探实验", "experiment", ["发布任务"], "用第二个来源查一查"],
    ["ai-judgement", 3, "证据比声音更有力", "showcase", ["投屏展示"], "把我觉得改成我找到证据了"],
    ["ai-superpowers", 1, "AI 工具箱打开", "demo", ["全屏演示"], "快速试一试 AI 的六种常用能力"],
    ["ai-superpowers", 2, "同一个问题换三种说法", "experiment", ["发起互动"], "看 AI 回答如何变化"],
    ["ai-superpowers", 3, "把候选问题改清楚", "activity", ["发布任务"], "让 AI 帮忙改写，但用证据做判断"],
    ["ai-superpowers", 4, "AI 市场侦察卡", "activity", ["发布任务"], "用 AI 找用户声音、已有方案和可继续调查的问题"],
    ["ai-superpowers", 5, "竞品观察三格", "experiment", ["投屏展示"], "看别人怎么解决，再找出我们可以不一样的地方"],
    ["user-interview", 1, "像侦探一样听", "story", ["全屏演示"], "先听见对方真实经历"],
    ["user-interview", 2, "三个好问题", "activity", ["发布任务"], "问发生过吗、多久一次、现在怎么解决"],
    ["user-interview", 3, "绿灯黄灯红灯", "showcase", ["投屏展示"], "根据采访结果决定保留、缩小或换题"],
    ["project-launch", 1, "12 个真实创业方向", "story", ["全屏演示"], "生活帮手、学习工具、创意工坊、校园社区四条赛道"],
    ["project-launch", 2, "选一条赛道，找到一个真实用户", "activity", ["发布任务"], "从 12 个方向里选一个最想继续调查的问题"],
    ["project-launch", 3, "把线索变成产品一句话", "activity", ["发布任务"], "谁遇到什么麻烦，我们用什么帮他"],
    ["project-launch", 4, "产品摊位开张", "showcase", ["投屏展示"], "每组用一分钟说清用户、问题和想做的产品"],
    ["project-launch", 5, "明天要做出的第一版", "story", ["全屏演示"], "把想法收束成明天能演示的核心版本"],
    ["day1-reflection", 1, "今天找到的真问题", "showcase", ["投屏展示"], "回看每组最有证据的一条线索"],
    ["day1-reflection", 2, "带走一个 AI 使用守则", "activity", ["发布任务"], "写下今天最有用的一条判断方法"],
    ["day2-kickoff", 1, "今天必须做出来", "story", ["全屏演示"], "每组读出产品一句话和今天目标"],
    ["day2-kickoff", 2, "先让一个动作动起来", "activity", ["启动计时"], "把功能清单里最关键的一步圈出来"],
    ["ai-lab", 1, "同一句话，AI 反应差十倍", "story", ["全屏演示"], "看模糊提示词和清楚提示词的差别"],
    ["ai-lab", 2, "五句提示词卡", "activity", ["发布任务"], "目标、用户、材料、限制、格式"],
    ["ai-lab", 3, "改一版再试", "experiment", ["投屏展示"], "让 AI 先出草稿，再继续修正"],
    ["ai-lab", 4, "对 AI 说：不对，再改", "experiment", ["发起互动"], "把 AI 初稿改到更符合用户和证据"],
    ["product-prototype", 1, "功能先发散", "activity", ["发布任务"], "把想做的功能都放出来"],
    ["product-prototype", 2, "只留下一个核心动作", "experiment", ["发起互动"], "选择 30 秒能看懂、能试用的一步"],
    ["product-prototype", 3, "最小可行产品", "story", ["全屏演示"], "先做最小但能验证想法的一版产品"],
    ["tech-route", 1, "选择今天能完成的路线", "activity", ["发布任务"], "标准、轻量、进阶、兜底四条路线"],
    ["tech-route", 2, "用户打开后第一步做什么", "activity", ["启动计时"], "画出 3-5 步使用流程"],
    ["tech-route", 3, "流程图检查", "showcase", ["投屏展示"], "让别人 30 秒看懂怎么用"],
    ["tool-demo", 1, "作品可以有很多样子", "story", ["全屏演示"], "共同标准是浏览器能打开，别人能试用，作品卡能跳转"],
    ["tool-demo", 2, "从一句话到第一版", "demo", ["全屏演示"], "看一遍从提示词到可打开作品"],
    ["tool-demo", 3, "看输入、结果、修改", "experiment", ["发起互动"], "找到一次值得继续修改的地方"],
    ["build-sprint", 1, "制作开始", "activity", ["启动计时"], "把核心动作做出来"],
    ["build-sprint", 2, "卡在哪里，写清楚", "activity", ["打开看板"], "把卡点写成别人能看懂的一句话"],
    ["build-sprint", 3, "产品原型 V1", "showcase", ["投屏展示"], "让作品先能打开、能试、能讲清楚"],
    ["build-sprint", 4, "真产品检查", "showcase", ["投屏展示"], "浏览器能打开，别人能完成一个动作，团队能分享给家长看"],
    ["user-testing", 1, "先看别人怎么用", "activity", ["发布任务"], "试玩时观察动作和停顿"],
    ["user-testing", 2, "反馈进作品", "activity", ["打开看板"], "把建议分成必须改、建议改、以后改"],
    ["user-testing", 3, "改出 V2", "showcase", ["投屏展示"], "展示改动前后哪里更清楚"],
    ["demo-check", 1, "2 分钟 Demo", "showcase", ["启动计时"], "只展示产品怎么帮用户完成一件事"],
    ["demo-check", 2, "明天发布会要带什么", "activity", ["发布任务"], "产品链接、截图、故事线索和分工"],
    ["roadshow-rehearsal", 1, "每组作品能打开吗", "activity", ["打开看板"], "确认链接、截图和演示顺序"],
    ["roadshow-rehearsal", 2, "先修最影响展示的一处", "activity", ["启动计时"], "把最容易卡住的地方先处理"],
    ["value-experiment", 1, "定价三问", "story", ["全屏演示"], "谁会用，愿意付出什么，为什么值得"],
    ["value-experiment", 2, "别人愿意交换，是因为真的有用", "story", ["全屏演示"], "用星星币、时间、推荐做价值实验"],
    ["value-experiment", 3, "帮别人少烦了什么", "activity", ["发布任务"], "说清产品带来的变化"],
    ["value-experiment", 4, "价值交换榜", "showcase", ["投屏展示"], "看大家愿意用什么交换"],
    ["product-packaging", 1, "给产品一个名字", "activity", ["发布任务"], "名字、标语、截图、三条亮点"],
    ["product-packaging", 2, "海报不是装饰", "story", ["全屏演示"], "让别人一眼知道产品帮谁、怎么帮"],
    ["product-packaging", 3, "产品摊位预览", "showcase", ["投屏展示"], "把每组产品海报排成作品街"],
    ["product-packaging", 4, "作品页上线清单", "activity", ["打开看板"], "产品名、链接、截图、用户故事和下一步计划都要准备好"],
    ["brand-story", 1, "把作品讲成一个小故事", "story", ["全屏演示"], "人物、麻烦、办法、证据、邀请"],
    ["brand-story", 2, "故事发布五步卡", "activity", ["发布任务"], "把作品演示放进故事里"],
    ["brand-story", 3, "问答预演", "experiment", ["发起互动"], "先听懂问题，再用证据回答"],
    ["rehearsal", 1, "彩排开始", "activity", ["启动计时"], "按发布顺序走一遍"],
    ["rehearsal", 2, "删掉一句多余的话", "activity", ["打开看板"], "让作品、用户和结果更清楚"],
    ["final-showcase", 1, "作品秀开场", "story", ["全屏演示"], "这是互相借好方法的作品秀"],
    ["final-showcase", 2, "每组 5 分钟故事发布", "showcase", ["进入评分"], "让大家看到用户怎么用、结果是什么"],
    ["final-showcase", 3, "家长观察员提问", "experiment", ["发起互动"], "家长会提问、投票，也会给出下一步建议"],
    ["final-showcase", 4, "观察员投票", "showcase", ["进入评分"], "看见亮点，给出下一步建议"],
    ["awards-reflection", 1, "五力证书", "showcase", ["投屏展示"], "共情力、提问力、创造力、判断力、领导力都有证据"],
    ["awards-reflection", 2, "给贡献一个名字", "showcase", ["投屏展示"], "看见每个人在团队里的真实贡献"],
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
