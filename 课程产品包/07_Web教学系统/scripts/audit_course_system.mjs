#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const systemDir = path.resolve(__dirname, "..");
const productDir = path.resolve(systemDir, "..");

const paths = {
  apiDb: path.join(systemDir, "ceo-camp-api/src/db.ts"),
  webApp: path.join(systemDir, "ceo-camp-web/src/app.tsx"),
  deck: path.join(systemDir, "ceo-camp-web/public/courseware/four-case-journey/index.html"),
  dayPlan: path.join(productDir, "01_三天教学过程设计.md"),
  knowledgePlan: path.join(productDir, "02_知识输入课程详细设计.md"),
  day1Story: path.join(productDir, "05_Day1_创业知识输入讲稿_四赛道项目故事.md"),
  caseMap: path.join(productDir, "06_四案例贯穿三天课程映射.md"),
  auditDoc: path.join(productDir, "07_三天教学系统完整性审计.md")
};

const requiredCases = [
  "上学出门检查台",
  "应用题拆题板",
  "四格漫画分镜台",
  "校园活动组队板"
];

const oldCaseTerms = [
  ["宠物", "不对劲"],
  ["仓", "鼠"],
  ["黄", "瓜"],
  ["题目", "翻译机"],
  ["脑内电影", "分镜器"],
  ["失物", "招领"],
  ["错题", "侦探卡"],
  ["漫画第一格", "启动器"],
  ["校园活动", "雷达"],
  ["查", "书包"],
  ["找", "错因"],
  ["开", "漫画头"],
  ["读", "活动通知"]
].map((parts) => parts.join(""));

const childForbiddenTerms = [
  "后台",
  "审核",
  "待审核",
  "管理配置",
  "生成队列",
  "发布状态",
  "接口",
  "API",
  "权限",
  "数据库",
  "同步",
  "日志",
  "运营"
];

const requiredKnowledgeModules = [
  "ai-judgement",
  "workbuddy-webpage",
  "team-formation",
  "ai-lab",
  "product-prototype",
  "tool-demo",
  "user-testing",
  "demo-check",
  "roadshow-rehearsal",
  "value-experiment",
  "product-packaging",
  "brand-story"
];

const failures = [];
const warnings = [];

function read(file) {
  if (!fs.existsSync(file)) {
    failures.push(`缺少文件：${path.relative(productDir, file)}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function pass(condition, message) {
  if (!condition) failures.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function parseModules(source) {
  const block = source.match(/const modules = \[([\s\S]*?)\n  \] as const;/)?.[1] || "";
  return [...block.matchAll(/\["([^"]+)",\s*(\d+),\s*(\d+),\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\]/g)].map((match) => ({
    id: match[1],
    day: Number(match[2]),
    sequence: Number(match[3]),
    title: match[4],
    subtitle: match[5],
    time: match[6],
    status: match[7]
  }));
}

function parsePages(source) {
  const block = source.match(/const pageSeeds = \[([\s\S]*?)\n  \] as const;/)?.[1] || "";
  return [...block.matchAll(/\["([^"]+)",\s*(\d+),\s*"([^"]+)",\s*"([^"]+)",\s*\[([^\]]*)\],\s*"([^"]*)"\]/g)].map((match) => ({
    moduleId: match[1],
    pageNo: Number(match[2]),
    title: match[3],
    type: match[4],
    buttons: [...match[5].matchAll(/"([^"]+)"/g)].map((button) => button[1]),
    summary: match[6]
  }));
}

function parseSlides(html) {
  const slideStarts = [...html.matchAll(/<div class="slide(?: active)?" data-slide="(\d+)">/g)].map((match) => Number(match[1]));
  const notes = [...html.matchAll(/<script type="application\/json" class="slide-notes">\s*([\s\S]*?)\s*<\/script>/g)].map((match) => {
    try {
      return JSON.parse(match[1]);
    } catch (error) {
      failures.push(`speaker notes JSON 解析失败：${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  });
  return { slideStarts, notes };
}

function parseModuleStart(html) {
  const block = html.match(/var moduleStart = \{([\s\S]*?)\n    \};/)?.[1] || "";
  const entries = new Map();
  for (const match of block.matchAll(/"([^"]+)":\s*(\d+)/g)) {
    entries.set(match[1], Number(match[2]));
  }
  return entries;
}

function countTerm(source, term) {
  return source.split(term).length - 1;
}

function expectedTaskKind(page) {
  const title = page.title;
  const moduleId = page.moduleId;
  if (moduleId === "future-photo-studio") return "future_photo";
  if (moduleId === "team-formation") return "team_card";
  if (moduleId === "workbuddy-webpage" || moduleId === "track-cases") return "product_definition";
  if (moduleId === "problem-wall") return "problem_card";
  if (moduleId === "user-interview") return "user_voice";
  if (moduleId === "ai-superpowers") return "market_scout";
  if (moduleId === "ai-judgement") return "learning_reflection";
  if (moduleId === "project-launch" || moduleId === "day1-reflection") return "product_definition";
  if (moduleId === "day2-kickoff" || moduleId === "product-prototype") return "feature_scope";
  if (moduleId === "ai-lab") return "prompt_card";
  if (moduleId === "tech-route") return "tech_route";
  if (moduleId === "tool-demo") return "product_link";
  if (moduleId === "build-sprint" && /卡在哪里|卡点/.test(title)) return "blocker_note";
  if (moduleId === "build-sprint") return "product_link";
  if (moduleId === "user-testing" && /给别组一条反馈/.test(title)) return "product_feedback";
  if (moduleId === "user-testing") return "iteration_plan";
  if (moduleId === "demo-check" && /AI 跑偏|改回来/.test(title)) return "learning_reflection";
  if (moduleId === "demo-check") return "product_link";
  if (moduleId === "roadshow-rehearsal") return "product_link";
  if (moduleId === "value-experiment") return "value_card";
  if (moduleId === "product-packaging") return "product_packaging";
  if (moduleId === "brand-story") return "story_pitch";
  if (moduleId === "rehearsal") return "final_showcase";
  if (moduleId === "awards-reflection" && /贡献/.test(title)) return "contribution_card";
  if (moduleId === "awards-reflection") return "growth_reflection";
  return null;
}

function stripHtml(value) {
  return value.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const apiDb = read(paths.apiDb);
const webApp = read(paths.webApp);
const deckHtml = read(paths.deck);
const modules = parseModules(apiDb);
const pages = parsePages(apiDb);
const moduleById = new Map(modules.map((module) => [module.id, module]));
const readyModules = modules.filter((module) => module.status === "READY");
const readyPages = pages.filter((page) => moduleById.get(page.moduleId)?.status === "READY");
const moduleStart = parseModuleStart(deckHtml);
const { slideStarts, notes } = parseSlides(deckHtml);

for (const day of [1, 2, 3]) {
  const dayModules = readyModules.filter((module) => module.day === day);
  pass(dayModules.length > 0, `Day ${day} 没有 READY 模块`);
}

for (const [moduleId, slide] of moduleStart) {
  pass(moduleById.has(moduleId), `HTML 课件 moduleStart 指向不存在的模块：${moduleId}`);
  pass(moduleById.get(moduleId)?.status === "READY", `HTML 课件 moduleStart 指向非 READY 模块：${moduleId}`);
  pass(slideStarts.includes(slide), `moduleStart ${moduleId} 指向不存在的 slide ${slide}`);
}

pass(/<div class="deck" id="deck">/.test(deckHtml), "HTML 课件缺少 deck#deck");
pass(/<meta name="generator" content="html-slides v[0-9.]+">/.test(deckHtml), "HTML 课件缺少 html-slides generator meta");
pass(/function goTo\(index\)/.test(deckHtml), "HTML 课件缺少 goTo()");
pass(/function next\(\)/.test(deckHtml), "HTML 课件缺少 next()");
pass(/function prev\(\)/.test(deckHtml), "HTML 课件缺少 prev()");
pass(slideStarts.length === 24, `HTML 课件应为 24 页，当前是 ${slideStarts.length} 页`);
pass(notes.length === slideStarts.length, `speaker notes 数量应等于页数：${notes.length}/${slideStarts.length}`);
pass(deckHtml.match(/class="slide active"/g)?.length === 1, "HTML 课件必须只有一个 active slide");
pass(/class="slide active" data-slide="0"/.test(deckHtml), "HTML 课件第 0 页必须是 active");
slideStarts.forEach((slide, index) => pass(slide === index, `HTML 课件 data-slide 不连续：位置 ${index} 是 ${slide}`));
pass(!/https?:\/\//.test(deckHtml), "HTML 课件不应依赖外部 URL，保证国内课堂离线/弱网可打开");

for (const moduleId of requiredKnowledgeModules) {
  const modulePages = readyPages.filter((page) => page.moduleId === moduleId);
  const types = new Set(modulePages.map((page) => page.type));
  pass(types.has("story"), `${moduleId} 缺少故事页`);
  pass(types.has("demo") || types.has("ai-demo"), `${moduleId} 缺少老师演示页`);
  pass(types.has("experiment") || types.has("activity"), `${moduleId} 缺少轮到你实验页`);
  pass(modulePages.some((page) => page.buttons.includes("发布任务")), `${moduleId} 缺少可保存的学生/团队任务`);
}

const readyPublishPages = readyPages.filter((page) => page.buttons.includes("发布任务"));
const allPublishPages = pages.filter((page) => page.buttons.includes("发布任务"));
for (const page of readyPublishPages) {
  pass(Boolean(expectedTaskKind(page)), `READY 发布任务没有学生端落点：${page.moduleId} / ${page.title}`);
}

const sourceFilesForCases = [
  paths.apiDb,
  paths.webApp,
  paths.deck,
  paths.dayPlan,
  paths.knowledgePlan,
  paths.day1Story,
  paths.caseMap,
  paths.auditDoc
];
for (const file of sourceFilesForCases) {
  const source = read(file);
  for (const item of requiredCases) {
    pass(source.includes(item), `${path.relative(productDir, file)} 缺少正式案例：${item}`);
  }
  for (const item of oldCaseTerms) {
    pass(!source.includes(item), `${path.relative(productDir, file)} 仍有旧案例词：${item}`);
  }
}

const slideBlocks = [...deckHtml.matchAll(/<div class="slide(?: active)?" data-slide="(\d+)">([\s\S]*?)<script type="application\/json" class="slide-notes">/g)].map((match) => ({
  n: Number(match[1]),
  text: stripHtml(match[2])
}));
for (const item of requiredCases) {
  const matchingSlides = slideBlocks.filter((slide) => slide.text.includes(item));
  pass(matchingSlides.length > 0, `HTML 课件没有展示正式案例：${item}`);
  pass(
    matchingSlides.some((slide) => /需求|真实麻烦/.test(slide.text) && /产品|V1|第一版/.test(slide.text) && /AI/.test(slide.text) && /价值|少烦|愿意/.test(slide.text)),
    `HTML 课件中 ${item} 没有完整展示需求、产品、AI、价值`
  );
}

const childFacingSources = [
  paths.deck,
  paths.day1Story
];
for (const file of childFacingSources) {
  const source = read(file);
  for (const item of childForbiddenTerms) {
    pass(!source.includes(item), `${path.relative(productDir, file)} 的孩子可见内容疑似混入内部词：${item}`);
  }
}

const inputTypes = new Set(["story", "demo", "ai-demo", "image"]);
for (const day of [1, 2, 3]) {
  const dayPages = readyPages.filter((page) => moduleById.get(page.moduleId)?.day === day);
  const inputCount = dayPages.filter((page) => inputTypes.has(page.type)).length;
  const ratio = dayPages.length ? inputCount / dayPages.length : 0;
  warn(ratio <= 0.55, `Day ${day} 故事/演示页占比 ${(ratio * 100).toFixed(1)}%，需要人工确认实际分钟数不超过 40%`);
}

const summary = {
  readyModules: readyModules.length,
  readyPages: readyPages.length,
  htmlSlides: slideStarts.length,
  htmlModuleEntries: moduleStart.size,
  allPublishTasks: allPublishPages.length,
  readyPublishTasks: readyPublishPages.length,
  knowledgeModulesChecked: requiredKnowledgeModules.length
};

console.log("课程系统审计摘要");
for (const [key, value] of Object.entries(summary)) {
  console.log(`- ${key}: ${value}`);
}

if (warnings.length) {
  console.log("\n警告");
  for (const item of warnings) console.log(`- ${item}`);
}

if (failures.length) {
  console.error("\n失败");
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log("\n通过：3 天主线、四案例、HTML 课件、知识输入结构和学生任务落点已通过静态审计。");
