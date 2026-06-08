import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Coins,
  ClipboardCheck,
  ExternalLink,
  Hammer,
  Image,
  Lightbulb,
  Loader2,
  LogOut,
  Maximize2,
  Megaphone,
  MessageSquareText,
  Mic,
  Monitor,
  Package,
  Play,
  Rocket,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  StickyNote,
  Target,
  Timer,
  Trash2,
  Trophy,
  WandSparkles,
  X,
  UsersRound
} from "lucide-react";
import {
  API_BASE,
  api,
  clearStudentToken,
  clearTeacherToken,
  connectEvents,
  getStudentAccount,
  getStudentToken,
  getTeacherAccount,
  hasStudentToken,
  hasTeacherToken,
  setStudentToken,
  setTeacherToken
} from "./api";
import type {
  AwardResult,
  Camp,
  CourseModule,
  FuturePhotoSubmission,
  ObserverScoreBrief,
  ProblemVoteSummary,
  ScoreDimension,
  ScoreSummary,
  ShowcaseItem,
  Student,
  StudentAccount,
  TaskSubmission,
  Team,
  TeacherAccount,
  WallArtifact
} from "./types";
import "./styles.css";

const careerChoices = [
  "动物医生",
  "游戏设计师",
  "太空建筑师",
  "机器人设计师",
  "演员/歌手",
  "厨师",
  "科学家",
  "运动员"
];

const studentPhotoMaxEdge = 1600;
const studentPhotoMaxBytes = 1_800_000;
const studentPhotoQuality = 0.86;

type StudentMessage = {
  tone: "hint" | "success" | "error";
  text: string;
};

const scoreScale = [1, 2, 3, 4, 5];
const scoreDimensionLabels: Array<{ key: ScoreDimension; label: string; hint: string }> = [
  { key: "user_realness", label: "用户真实", hint: "听见了真实人的问题" },
  { key: "mvp_completion", label: "原型能用", hint: "别人能完成一个动作" },
  { key: "ai_collaboration", label: "AI 协作", hint: "AI 帮上了关键忙" },
  { key: "story_expression", label: "故事清楚", hint: "知道谁遇到什么问题" },
  { key: "team_pitch", label: "展示有力", hint: "看见结果，也知道下一步" }
];

const growthAbilityTags = ["共情力", "提问力", "创造力", "判断力", "领导力"] as const;

const growthAbilityHints: Record<(typeof growthAbilityTags)[number], string> = {
  共情力: "听见真实的人和需要",
  提问力: "把问题问得更清楚",
  创造力: "把想法变成新方案",
  判断力: "用证据修改 AI 的答案",
  领导力: "带着团队把作品推出去"
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  0?: SpeechRecognitionAlternative;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition() {
  const win = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition;
}

function isWechatBrowser() {
  return /micromessenger/i.test(window.navigator.userAgent);
}

function studentPhotoUploadUrl(studentId: string, token: string) {
  const url = new URL("/student", window.location.origin);
  url.searchParams.set("photo-upload", "1");
  url.searchParams.set("sid", studentId);
  url.searchParams.set("token", token);
  return url.toString();
}

function isStudentPhoto(file: File) {
  return file.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name);
}

function withPhotoExtension(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "").slice(0, 60) || "future-photo";
  return `${baseName}.jpg`;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("IMAGE_LOAD_FAILED"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("IMAGE_COMPRESS_FAILED"));
    }, type, quality);
  });
}

async function prepareStudentPhoto(file: File) {
  if (!isStudentPhoto(file)) {
    throw new Error("请选择一张照片。");
  }

  if (file.size <= studentPhotoMaxBytes && !/\.(heic|heif)$/i.test(file.name)) {
    return file;
  }

  try {
    const image = await loadImage(file);
    const scale = Math.min(1, studentPhotoMaxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("IMAGE_COMPRESS_FAILED");
    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, "image/jpeg", studentPhotoQuality);
    if (blob.size >= file.size && file.size <= studentPhotoMaxBytes) {
      return file;
    }
    return new File([blob], withPhotoExtension(file.name), { type: "image/jpeg" });
  } catch {
    if (file.size <= studentPhotoMaxBytes * 2) return file;
    throw new Error("这张照片太大了，请换一张近一点、清楚一点的照片。");
  }
}

const openingImages = {
  cover: "/courseware/opening/future-studio-cover.webp",
  vet: "/courseware/opening/future-pair-vet.webp",
  robot: "/courseware/opening/future-pair-robot.webp",
  space: "/courseware/opening/future-pair-space.webp"
};

type FuturePhotoSample = {
  code: string;
  career: string;
  cue: string;
  image: string;
  alt: string;
};

const futurePhotoSamples: FuturePhotoSample[] = [
  {
    code: "样片 01",
    career: "动物医生",
    cue: "手里的工具透露了什么？",
    image: openingImages.vet,
    alt: "孩子与未来动物医生职业照对比"
  },
  {
    code: "样片 02",
    career: "机器人设计师",
    cue: "身边的机器在做什么？",
    image: openingImages.robot,
    alt: "孩子与未来机器人设计师职业照对比"
  },
  {
    code: "样片 03",
    career: "太空建筑师",
    cue: "工作地点藏在哪里？",
    image: openingImages.space,
    alt: "孩子与未来太空建筑师职业照对比"
  }
];

type LessonPage = CourseModule["pages"][number];
type LessonAccent = "mint" | "blue" | "sun" | "coral" | "green" | "ink";
type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

type LessonCard = {
  title: string;
  text: string;
};

type LessonArtifactKind =
  | "team-roles"
  | "problem-wall"
  | "evidence-check"
  | "market-scout"
  | "competitor-grid"
  | "interview-card"
  | "direction-map"
  | "product-sentence"
  | "prompt-card"
  | "ai-revise"
  | "prototype-board"
  | "route-map"
  | "product-browser"
  | "testing-board"
  | "demo-strip"
  | "pricing-ticket"
  | "launch-checklist"
  | "story-spine"
  | "showcase-run"
  | "observer-cards"
  | "five-forces";

type LessonPageSeed = {
  page_no: number;
  title: string;
  page_type: string;
  content_summary: string;
  activity_buttons?: string[];
};

type DesignedLessonPage = LessonPage & {
  kicker?: string;
  chips?: string[];
  visual?: "cards" | "steps" | "flow" | "showcase" | "roadmap" | "demo";
  accent?: LessonAccent;
  cards?: LessonCard[];
  steps?: string[];
  flow?: LessonCard[];
};

const moduleDesigns: Record<
  string,
  {
    icon: IconComponent;
    accent: LessonAccent;
    chips: string[];
    steps: string[];
    cards: LessonCard[];
    flow?: LessonCard[];
  }
> = {
  "team-formation": {
    icon: UsersRound,
    accent: "blue",
    chips: ["找队友", "定责任", "亮相"],
    steps: ["找到桌号", "给团队命名", "把四个责任放上桌"],
    cards: [
      { title: "采访", text: "去听真实故事" },
      { title: "产品", text: "把想法收成一句话" },
      { title: "AI", text: "把提示词和结果管清楚" },
      { title: "展示", text: "让别人看懂作品" }
    ]
  },
  "problem-wall": {
    icon: StickyNote,
    accent: "coral",
    chips: ["找麻烦", "改成问题", "投线索"],
    steps: ["写下生活里的小麻烦", "改成“帮谁解决什么”", "把最想继续调查的线索贴上墙"],
    cards: [
      { title: "书包总乱", text: "谁每天会花时间找东西？" },
      { title: "排队太久", text: "等待时最烦的是哪一步？" },
      { title: "宠物照顾", text: "什么时候最担心它不舒服？" }
    ]
  },
  "ai-judgement": {
    icon: Search,
    accent: "ink",
    chips: ["找可疑句", "查证据", "改结论"],
    steps: ["圈出最可疑的一句", "找第二个来源", "把证据写进结论"],
    cards: [
      { title: "AI 答案", text: "听起来很完整，也可能有错" },
      { title: "证据", text: "来自另一个来源或真实观察" },
      { title: "判断", text: "我找到证据了，所以我这样改" }
    ],
    flow: [
      { title: "先看", text: "AI 给出的答案" },
      { title: "再查", text: "第二个来源或现场证据" },
      { title: "最后改", text: "把结论说得更可靠" }
    ]
  },
  "ai-superpowers": {
    icon: Brain,
    accent: "blue",
    chips: ["写", "改", "解释", "限制", "纠错", "验证"],
    steps: ["选一个候选问题", "让 AI 改写三种版本", "挑出最适合继续采访的一版"],
    cards: [
      { title: "写", text: "先生成一个草稿" },
      { title: "改", text: "换语气、换结构、换对象" },
      { title: "查", text: "把结果拿回真实世界确认" }
    ]
  },
  "user-interview": {
    icon: MessageSquareText,
    accent: "green",
    chips: ["听故事", "问三句", "判断灯号"],
    steps: ["问：你遇到过吗？", "问：多久发生一次？", "问：现在怎么解决？"],
    cards: [
      { title: "绿灯", text: "很多人遇到，愿意试一试" },
      { title: "黄灯", text: "有人遇到，但还要缩小问题" },
      { title: "红灯", text: "证据不够，换一条线索" }
    ]
  },
  "project-launch": {
    icon: Target,
    accent: "sun",
    chips: ["用户", "问题", "产品一句话"],
    steps: ["写清楚帮谁", "写清楚遇到什么麻烦", "写清楚我们怎么帮他"],
    cards: [
      { title: "谁", text: "真正会使用这个产品的人" },
      { title: "什么麻烦", text: "采访里反复出现的卡点" },
      { title: "怎么帮", text: "今天能做出第一版的方案" }
    ]
  },
  "day1-reflection": {
    icon: Star,
    accent: "mint",
    chips: ["回看", "收束", "带走方法"],
    steps: ["选一条最有证据的线索", "写一条 AI 使用守则", "准备明天开做"],
    cards: [
      { title: "真问题", text: "来自真实采访和观察" },
      { title: "好方法", text: "先怀疑，再验证" },
      { title: "明天目标", text: "做出能演示的一版" }
    ]
  },
  "day2-kickoff": {
    icon: Rocket,
    accent: "blue",
    chips: ["读目标", "圈核心", "开做"],
    steps: ["读出产品一句话", "圈出一个核心动作", "确认今天要交付什么"],
    cards: [
      { title: "昨天", text: "找到真问题" },
      { title: "今天", text: "做出产品原型" },
      { title: "晚上", text: "能打开、能试玩、能演示" }
    ]
  },
  "ai-lab": {
    icon: WandSparkles,
    accent: "ink",
    chips: ["目标", "用户", "材料", "限制", "格式"],
    steps: ["写一句模糊提示词", "补成五句提示词", "让 AI 出一版草稿后再改"],
    cards: [
      { title: "目标", text: "你要 AI 帮你完成什么" },
      { title: "用户", text: "作品是给谁用的" },
      { title: "格式", text: "希望它用什么样子交付" }
    ],
    flow: [
      { title: "模糊", text: "帮我做一个产品" },
      { title: "清楚", text: "给小学生做 3 步可用的背单词工具" },
      { title: "再改", text: "加上限制和输出格式" }
    ]
  },
  "product-prototype": {
    icon: Hammer,
    accent: "coral",
    chips: ["列功能", "砍范围", "做原型"],
    steps: ["列 5-8 个功能", "只留下最关键的一步", "先做能跑通的一版"],
    cards: [
      { title: "产品", text: "别人真的会使用的东西" },
      { title: "原型", text: "已经能演示核心功能的第一版" },
      { title: "MVP", text: "最小但能验证想法的一版产品" }
    ]
  },
  "tech-route": {
    icon: Route,
    accent: "green",
    chips: ["选路线", "画流程", "检查"],
    steps: ["选今天能完成的路线", "画出 3-5 步使用流程", "让别人 30 秒看懂"],
    cards: [
      { title: "标准", text: "用课堂推荐工具完成" },
      { title: "轻量", text: "做成可点击网页或表单" },
      { title: "兜底", text: "用截图和流程演示核心动作" }
    ]
  },
  "tool-demo": {
    icon: Sparkles,
    accent: "blue",
    chips: ["看输入", "看结果", "看修改"],
    steps: ["老师输入一句清楚提示", "AI 生成第一版", "全班找一个可以继续改的地方"],
    cards: [
      { title: "输入", text: "产品目标和用户" },
      { title: "结果", text: "可打开的第一版" },
      { title: "修改", text: "把不清楚的地方补上" }
    ]
  },
  "build-sprint": {
    icon: Timer,
    accent: "sun",
    chips: ["制作", "记录卡点", "跑通"],
    steps: ["先让核心动作动起来", "卡住时写清楚卡在哪里", "保留一张能展示的截图"],
    cards: [
      { title: "能打开", text: "链接或文件可以顺利展示" },
      { title: "能试", text: "别人可以完成一个动作" },
      { title: "能讲", text: "团队能说清它帮谁" }
    ]
  },
  "user-testing": {
    icon: ClipboardCheck,
    accent: "mint",
    chips: ["试玩", "观察", "迭代"],
    steps: ["先看别人怎么用", "记录停顿和提问", "把反馈分成三类"],
    cards: [
      { title: "必须改", text: "影响别人使用的地方" },
      { title: "建议改", text: "能让作品更清楚" },
      { title: "以后改", text: "现在先记录下来" }
    ]
  },
  "demo-check": {
    icon: Monitor,
    accent: "ink",
    chips: ["打开作品", "演示 2 分钟", "准备发布"],
    steps: ["只演示核心动作", "让大家看到用户怎么用", "记下明天还要补什么"],
    cards: [
      { title: "产品链接", text: "能顺利打开" },
      { title: "演示顺序", text: "先用户，再动作，再结果" },
      { title: "备用截图", text: "现场也能讲清楚" }
    ]
  },
  "roadshow-rehearsal": {
    icon: ClipboardCheck,
    accent: "blue",
    chips: ["检查", "修关键处", "排顺序"],
    steps: ["打开作品", "检查演示顺序", "先修最影响展示的一处"],
    cards: [
      { title: "链接", text: "能打开" },
      { title: "截图", text: "能看懂" },
      { title: "演示", text: "能走通" }
    ]
  },
  "value-experiment": {
    icon: Coins,
    accent: "sun",
    chips: ["星星币", "时间", "推荐"],
    steps: ["说清帮别人少烦了什么", "选择一种交换方式", "听听别人愿不愿意交换"],
    cards: [
      { title: "少花时间", text: "这个产品帮我快一点" },
      { title: "少出错", text: "这个产品帮我更稳" },
      { title: "更开心", text: "这个产品让我愿意继续用" }
    ]
  },
  "product-packaging": {
    icon: Package,
    accent: "coral",
    chips: ["名字", "标语", "海报"],
    steps: ["给产品一个名字", "写一句让人懂的标语", "放上截图和三条亮点"],
    cards: [
      { title: "帮谁", text: "目标用户第一眼能看见" },
      { title: "怎么帮", text: "核心动作一眼清楚" },
      { title: "结果", text: "用截图或数字展示变化" }
    ]
  },
  "brand-story": {
    icon: Megaphone,
    accent: "green",
    chips: ["人物", "麻烦", "办法", "证据", "邀请"],
    steps: ["先讲一个真实用户", "演示产品怎么帮他", "用测试结果做证据"],
    cards: [
      { title: "人物", text: "谁遇到了这个麻烦" },
      { title: "办法", text: "我们的产品怎么帮他" },
      { title: "邀请", text: "下一步希望大家怎么试" }
    ]
  },
  "rehearsal": {
    icon: Timer,
    accent: "blue",
    chips: ["彩排", "删字", "调顺序"],
    steps: ["按顺序完整走一遍", "删掉一句多余的话", "把演示和故事对齐"],
    cards: [
      { title: "开头", text: "一句话说清用户" },
      { title: "中间", text: "让作品自己说话" },
      { title: "结尾", text: "给出下一步邀请" }
    ]
  },
  "final-showcase": {
    icon: Trophy,
    accent: "ink",
    chips: ["作品秀", "看亮点", "给建议"],
    steps: ["每组展示作品", "观察员记录亮点", "给出下一步建议"],
    cards: [
      { title: "真实用户", text: "讲清谁真的需要" },
      { title: "产品原型", text: "现场能看见核心功能" },
      { title: "AI 协作", text: "说清 AI 帮了哪一步" }
    ]
  },
  "awards-reflection": {
    icon: Star,
    accent: "sun",
    chips: ["看贡献", "收证书", "写反思"],
    steps: ["说出团队里一个真实贡献", "记录下一次想练的能力", "带走自己的作品故事"],
    cards: [
      { title: "发现问题", text: "听见真实需求" },
      { title: "做出作品", text: "把想法变成可演示版本" },
      { title: "指挥 AI", text: "会提要求，也会做判断" }
    ]
  }
};

const fallbackLessonPages: Record<string, LessonPageSeed[]> = {
  "problem-wall": [
    { page_no: 1, title: "今天我们当便利贴侦探", page_type: "story", content_summary: "从生活里的小麻烦开始找线索" },
    { page_no: 2, title: "把烦恼改成帮谁解决什么", page_type: "activity", content_summary: "把一句抱怨改写成可以继续调查的问题" },
    { page_no: 3, title: "班级线索墙", page_type: "showcase", content_summary: "让线索来自更多真实声音" }
  ],
  "user-interview": [
    { page_no: 1, title: "像侦探一样听", page_type: "story", content_summary: "先听见对方真实经历" },
    { page_no: 2, title: "三个好问题", page_type: "activity", content_summary: "问发生过吗、多久一次、现在怎么解决" },
    { page_no: 3, title: "绿灯黄灯红灯", page_type: "showcase", content_summary: "根据采访结果决定保留、缩小或换题" }
  ],
  "product-prototype": [
    { page_no: 1, title: "功能先发散", page_type: "activity", content_summary: "把想做的功能都放出来" },
    { page_no: 2, title: "只留下一个核心动作", page_type: "experiment", content_summary: "选择 30 秒能看懂、能试用的一步" },
    { page_no: 3, title: "最小可行产品", page_type: "story", content_summary: "先做最小但能验证想法的一版产品" }
  ],
  "ai-lab": [
    { page_no: 1, title: "同一句话，AI 反应差十倍", page_type: "story", content_summary: "看模糊提示词和清楚提示词的差别" },
    { page_no: 2, title: "五句提示词卡", page_type: "activity", content_summary: "目标、用户、材料、限制、格式" },
    { page_no: 3, title: "改一版再试", page_type: "experiment", content_summary: "让 AI 先出草稿，再继续修正" }
  ],
  "brand-story": [
    { page_no: 1, title: "把作品讲成一个小故事", page_type: "story", content_summary: "人物、麻烦、办法、证据、邀请" },
    { page_no: 2, title: "故事发布五步卡", page_type: "activity", content_summary: "把作品演示放进故事里" },
    { page_no: 3, title: "问答预演", page_type: "experiment", content_summary: "先听懂问题，再用证据回答" }
  ],
  "roadshow-rehearsal": [
    { page_no: 1, title: "每组作品能打开吗", page_type: "activity", content_summary: "确认链接、截图和演示顺序" },
    { page_no: 2, title: "先修最影响展示的一处", page_type: "activity", content_summary: "把最容易卡住的地方先处理" }
  ],
  "final-showcase": [
    { page_no: 1, title: "作品秀开场", page_type: "story", content_summary: "这是互相借好方法的作品秀" },
    { page_no: 2, title: "每组上场", page_type: "showcase", content_summary: "让大家看到用户怎么用、结果是什么" },
    { page_no: 3, title: "观察员投票", page_type: "showcase", content_summary: "看见亮点，给出下一步建议" }
  ],
  "awards-reflection": [
    { page_no: 1, title: "五力证书", page_type: "showcase", content_summary: "共情力、提问力、创造力、判断力、领导力都有证据" },
    { page_no: 2, title: "给贡献一个名字", page_type: "showcase", content_summary: "看见每个人在团队里的真实贡献" },
    { page_no: 3, title: "下一次我怎么指挥 AI", page_type: "activity", content_summary: "写下下一次想继续练习的方法" }
  ]
};

const statusText: Record<Student["display_status"], string> = {
  WAITING: "等待提交",
  GENERATING: "生成中",
  AWAITING_REVIEW: "等待审核",
  ON_WALL: "已上墙",
  SAVED_ONLY: "已保存"
};

const photoWallStatusText: Record<Student["display_status"], string> = {
  WAITING: "等你来拍",
  GENERATING: "照片在路上",
  AWAITING_REVIEW: "即将亮相",
  ON_WALL: "已亮相",
  SAVED_ONLY: "稍后再看"
};

function fallbackPagesFor(module: CourseModule): LessonPage[] {
  const seeds =
    fallbackLessonPages[module.id] ??
    [
      {
        page_no: 1,
        title: module.title,
        page_type: "story",
        content_summary: module.subtitle || "进入当前教学环节"
      },
      {
        page_no: 2,
        title: "动手完成当前任务",
        page_type: "activity",
        content_summary: "先做出一个小版本，再看哪里可以改得更好"
      },
      {
        page_no: 3,
        title: "看见结果",
        page_type: "showcase",
        content_summary: "展示代表作品，带走一个好方法"
      }
    ];

  return seeds.map((seed) => ({
    id: `${module.id}-fallback-${seed.page_no}`,
    module_id: module.id,
    page_no: seed.page_no,
    title: seed.title,
    page_type: seed.page_type,
    activity_buttons: seed.activity_buttons ?? [],
    content_summary: seed.content_summary
  }));
}

function visualForPage(page: LessonPage): DesignedLessonPage["visual"] {
  if (page.title === "作品可以有很多样子") return "demo";
  if (page.page_type === "showcase") return "showcase";
  if (page.page_type === "activity") return "steps";
  if (page.page_type === "experiment") return "flow";
  if (page.page_type === "demo" || page.page_type === "ai-demo") return "demo";
  if (page.page_type === "cover") return "roadmap";
  return "cards";
}

function decorateLessonPage(module: CourseModule, page: LessonPage): DesignedLessonPage {
  const design = moduleDesigns[module.id];
  const chipsByType: Record<string, string[]> = {
    story: ["看画面", "猜一猜", "说线索"],
    activity: ["打开任务", "动手完成", "准备展示"],
    experiment: ["看输入", "看结果", "改一版"],
    demo: ["看演示", "找变化", "问一句"],
    "ai-demo": ["看演示", "找变化", "问一句"],
    showcase: ["看作品", "说亮点", "借方法"],
    cover: ["进入故事", "准备行动", "期待结果"]
  };
  return {
    ...page,
    kicker: `${module.time_range || `D${module.day}`} · ${module.subtitle || module.title}`,
    chips: design?.chips ?? chipsByType[page.page_type] ?? ["看", "试", "展示"],
    visual: visualForPage(page),
    accent: design?.accent ?? "mint",
    cards: design?.cards,
    steps: design?.steps,
    flow: design?.flow
  };
}

function coursewarePages(module: CourseModule | null | undefined): DesignedLessonPage[] {
  if (!module) return [];
  const modulePages = module.pages.length ? module.pages : fallbackPagesFor(module);
  if (module.id !== "future-photo-studio") {
    return modulePages.map((page) => decorateLessonPage(module, page));
  }
  const base = module.pages[0] ?? {
    id: "future-photo-studio-page",
    module_id: module.id,
    page_no: 1,
    title: "",
    page_type: "story",
    activity_buttons: []
  };
  return [
    {
      ...base,
      id: "future-photo-story",
      page_no: 1,
      title: "照相馆开门",
      page_type: "story",
      activity_buttons: ["全屏演示", "投屏展示"],
      content_summary: "讲一个好像能拍到长大后样子的照相馆故事"
    },
    {
      ...base,
      id: "future-photo-examples",
      page_no: 2,
      title: "未来照片寄到",
      page_type: "image",
      activity_buttons: ["发起互动", "投屏展示"],
      content_summary: "看几组现在照片和未来职业照，先猜职业"
    },
    {
      ...base,
      id: "future-photo-your-turn",
      page_no: 3,
      title: "下一张写着你",
      page_type: "activity",
      activity_buttons: ["发布任务", "启动计时"],
      content_summary: "扫码，拍今天的你，说出理想职业"
    },
    {
      ...base,
      id: "future-photo-wall",
      page_no: 4,
      title: "照片墙亮起来",
      page_type: "showcase",
      activity_buttons: ["投屏展示", "打开看板"],
      content_summary: "全班的未来照片一张张点亮"
    },
    {
      ...base,
      id: "future-photo-ai-secret",
      page_no: 5,
      title: "秘密揭晓",
      page_type: "experiment",
      activity_buttons: ["全屏演示"],
      content_summary: "AI 根据照片和职业关键词画出未来想象照"
    }
  ] as DesignedLessonPage[];
}

function lessonPageTitle(module: CourseModule | null | undefined, page: DesignedLessonPage) {
  if (module?.id !== "future-photo-studio") return page.title;
  const titles: Record<number, string> = {
    1: "照相馆开门",
    2: "未来照片寄到",
    3: "下一张写着你",
    4: "照片墙亮起来",
    5: "秘密揭晓"
  };
  return titles[page.page_no] ?? page.title;
}

function teacherMoveForPage(page: DesignedLessonPage) {
  const moves: Record<string, string> = {
    cover: "把故事打开",
    story: "先给画面，再抛问题",
    image: "让孩子先猜，再说线索",
    activity: "发布任务，孩子动手",
    experiment: "看一次变化，再改一版",
    demo: "看输入、结果和修改点",
    "ai-demo": "看输入、结果和修改点",
    showcase: "展示结果，借走好方法"
  };
  return moves[page.page_type] ?? "推进当前课堂动作";
}

function expectedOutputForPage(page: DesignedLessonPage) {
  const outputs: Record<string, string> = {
    "下一张写着你": "学生端提交一张照片和一个理想职业",
    "AI 市场侦察卡": "每组带回 3 条可验证线索",
    "竞品观察三格": "说出一个已有方案和一个不同角度",
    "选一条赛道，找到一个真实用户": "每组选定赛道和真实用户",
    "把线索变成产品一句话": "每组写出产品一句话",
    "五句提示词卡": "每组写出一张可复用提示词卡",
    "对 AI 说：不对，再改": "每组留下一个改前改后对比",
    "真产品检查": "作品能打开，别人能完成一个动作",
    "定价三问": "每组说清谁会用、付出什么、为什么值得",
    "作品页上线清单": "作品名、链接、截图、用户故事准备好",
    "家长观察员提问": "每组准备回答一个真实追问",
    "五力证书": "每个孩子有一条可被看见的贡献证据",
    "下一次我怎么指挥 AI": "每个孩子写下一张成长卡"
  };
  if (outputs[page.title]) return outputs[page.title];
  if (page.page_type === "activity") return "孩子完成一个可展示的小结果";
  if (page.page_type === "showcase") return "全班看见作品或方法亮点";
  if (page.page_type === "experiment") return "保留一次变化和判断理由";
  if (page.page_type === "demo" || page.page_type === "ai-demo") return "找到一个可以继续修改的地方";
  return page.content_summary || "进入当前教学环节";
}

function timerMinutesForPage(page: DesignedLessonPage) {
  if (page.title.includes("制作") || page.title.includes("彩排")) return 15;
  if (page.title.includes("采访")) return 12;
  if (page.title.includes("作品秀") || page.title.includes("故事发布")) return 5;
  if (page.page_type === "activity") return 8;
  if (page.page_type === "experiment") return 6;
  if (page.page_type === "showcase") return 3;
  return 4;
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function taskTypeForAction(action: string, page: DesignedLessonPage) {
  if (page.title.includes("下一次我怎么指挥 AI")) return "growth_reflection";
  if (/AI 给答案，先看证据|真假侦探实验|证据比声音更有力/.test(page.title)) return "ai_validation";
  if (/把候选问题改清楚|AI 市场侦察卡|竞品观察三格/.test(page.title)) return "market_scout";
  if (/五句提示词卡|改一版再试|对 AI 说：不对，再改/.test(page.title)) return "prompt_card";
  if (action === "进入评分") return "score";
  if (action === "发起互动") return "interaction";
  if (action === "打开看板") return "board";
  if (page.page_type === "showcase") return "showcase";
  return page.page_type || "lesson";
}

function activeTaskTitle(camp: Camp | null) {
  return camp?.active_task?.title || "";
}

function isProductLinkTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  return (
    !isBlockerTask(camp) &&
    (/作品链接|产品链接|真产品检查|作品页上线清单|产品原型|每组作品能打开|2 分钟 Demo|产品摊位预览/.test(title) ||
    ["build-sprint", "demo-check", "product-packaging"].includes(moduleId)
    )
  );
}

function isBlockerTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  return activityType === "blocker_note" || (moduleId === "build-sprint" && /卡在哪里|卡点|需要帮/.test(title));
}

function isProblemVoteTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "problem_vote" ||
    payloadType === "problem_vote" ||
    /烦人墙投票|问题投票|最想继续调查|选出.*问题/.test(title)
  );
}

function isProblemDiscoveryTask(camp: Camp | null) {
  if (isProblemVoteTask(camp)) return false;
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  return moduleId === "problem-wall" || /真实问题|生活中的问题|便利贴|小麻烦|烦恼|线索墙/.test(title);
}

function isUserVoiceTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  return moduleId === "user-interview" || /采访|用户声音|真实反馈|三个好问题|绿灯黄灯红灯/.test(title);
}

function isAiValidationTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "ai_validation" ||
    payloadType === "ai_validation" ||
    moduleId === "ai-judgement" ||
    /AI 判断|AI 验证|验证卡|可疑句|查证据|改结论|真假侦探/.test(title)
  );
}

function isMarketScoutTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "market_scout" ||
    payloadType === "market_scout" ||
    (moduleId === "ai-superpowers" && /问题改写|候选问题|市场侦察|已有方案|竞品观察|继续验证|把候选问题改清楚/.test(title)) ||
    /问题改写|候选问题|市场侦察|已有方案|竞品观察|继续验证/.test(title)
  );
}

function isPromptCardTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "prompt_card" ||
    payloadType === "prompt_card" ||
    (moduleId === "ai-lab" && /五句提示词|提示词卡|改一版|再改|AI 初稿/.test(title)) ||
    /五句提示词|提示词卡|改一版|再改|AI 初稿/.test(title)
  );
}

function isProductDefinitionTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  return moduleId === "project-launch" || /产品一句话|产品定义|把线索变成产品一句话|产品卡片/.test(title);
}

function isFinalShowcaseTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  return (moduleId === "final-showcase" || /路演|作品展|最终展示|故事发布|每组上场/.test(title)) && !isObserverScoreTask(camp);
}

function isGrowthReflectionTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "growth_reflection" ||
    payloadType === "growth_reflection" ||
    moduleId === "awards-reflection" ||
    /下一次我怎么指挥 AI|结营反思|五力证书|给贡献一个名字|写反思/.test(title)
  );
}

function isPeerFeedbackTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  return /试玩|试用|互测|反馈进作品|改出 V2/.test(title) || moduleId === "user-testing";
}

function isObserverScoreTask(camp: Camp | null) {
  if (isProblemVoteTask(camp)) return false;
  const title = activeTaskTitle(camp);
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return payloadType === "observer_score" || /评分|观察员投票|投票|给出下一步建议/.test(title);
}

function futurePhotoHint(item: FuturePhotoSubmission) {
  if (!item.review_note) return "";
  try {
    const note = JSON.parse(item.review_note) as { status?: string; message?: string };
    if (note.status === "queued") return "正在排队生成";
    if (note.status === "failed") return "生成服务暂时失败，可稍后重试";
  } catch {
    if (item.review_note.includes("FUTURE_PHOTO_DAILY_LIMIT_REACHED")) return "今日自动出图已达上限";
  }
  return "";
}

function futurePhotoStatusLabel(status: FuturePhotoSubmission["status"]) {
  const labels: Record<FuturePhotoSubmission["status"], string> = {
    SUBMITTED: "已提交",
    GENERATING: "生成中",
    AWAITING_REVIEW: "待确认",
    APPROVED: "已上墙",
    REJECTED: "未上墙",
    SAVED_ONLY: "只保存"
  };
  return labels[status] ?? status;
}

function useInitialData(active: "student" | "wall") {
  const [camp, setCamp] = useState<Camp | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [wallArtifacts, setWallArtifacts] = useState<WallArtifact[]>([]);
  const [growthReflections, setGrowthReflections] = useState<WallArtifact[]>([]);
  const [problemVoteSummaries, setProblemVoteSummaries] = useState<ProblemVoteSummary[]>([]);
  const [awardResults, setAwardResults] = useState<AwardResult[]>([]);
  const [scoreSummaries, setScoreSummaries] = useState<ScoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    const [campResult, moduleResult, wallResult, showcaseResult, artifactResult, publicResult] = await Promise.all([
      api.currentCamp(),
      Promise.resolve({ modules: [] }),
      active === "student" ? Promise.resolve({ students: [] }) : api.wall(),
      active === "student"
        ? Promise.resolve({ showcase_items: [] })
        : api.showcase().catch(() => ({ showcase_items: [] as ShowcaseItem[] })),
      active === "student"
        ? Promise.resolve({ artifacts: [] as WallArtifact[], problem_vote_summaries: [] as ProblemVoteSummary[] })
        : api.wallArtifacts().catch(() => ({
          artifacts: [] as WallArtifact[],
          problem_vote_summaries: [] as ProblemVoteSummary[]
        })),
      active === "student"
        ? Promise.resolve({
            award_results: [] as AwardResult[],
            growth_reflections: [] as WallArtifact[],
            problem_vote_summaries: [] as ProblemVoteSummary[],
            score_summaries: [] as ScoreSummary[]
          })
        : api.publicFinalShowcase().catch(() => ({
          award_results: [] as AwardResult[],
          growth_reflections: [] as WallArtifact[],
          problem_vote_summaries: [] as ProblemVoteSummary[],
          score_summaries: [] as ScoreSummary[]
        }))
    ]);
    setCamp(campResult);
    setModules(moduleResult.modules);
    setStudents(wallResult.students);
    setShowcaseItems(showcaseResult.showcase_items);
    setWallArtifacts(artifactResult.artifacts);
    setProblemVoteSummaries(artifactResult.problem_vote_summaries ?? publicResult.problem_vote_summaries ?? []);
    setGrowthReflections(publicResult.growth_reflections ?? []);
    setAwardResults(publicResult.award_results ?? []);
    setScoreSummaries(publicResult.score_summaries ?? []);
  };

  useEffect(() => {
    refresh()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    if (active === "student") return undefined;
    return connectEvents((payload) => {
      setCamp(payload.camp);
      setStudents(payload.wall);
      setShowcaseItems(payload.showcase_items ?? []);
      setWallArtifacts(payload.wall_artifacts ?? []);
      setProblemVoteSummaries(payload.problem_vote_summaries ?? []);
      setGrowthReflections(payload.growth_reflections ?? []);
      setAwardResults(payload.award_results ?? []);
      setScoreSummaries(payload.score_summaries ?? []);
    });
  }, [active]);

  return { camp, modules, students, showcaseItems, wallArtifacts, growthReflections, problemVoteSummaries, awardResults, scoreSummaries, loading, error, refresh };
}

function useTeacherData(enabled: boolean) {
  const [camp, setCamp] = useState<Camp | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const refresh = async () => {
    const [campResult, moduleResult, wallResult] = await Promise.all([
      api.currentCamp(),
      api.courseModules(),
      api.wall()
    ]);
    setCamp(campResult);
    setModules(moduleResult.modules);
    setStudents(wallResult.students);
  };

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError("");
      setModules([]);
      setStudents([]);
      return undefined;
    }
    setLoading(true);
    setError("");
    refresh()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    return connectEvents((payload) => {
      setCamp(payload.camp);
      setStudents(payload.wall);
    });
  }, [enabled]);

  return { camp, modules, students, loading, error, refresh };
}

function App() {
  const route = window.location.pathname || "/teacher";
  const active = route.startsWith("/student")
    ? "student"
    : route.startsWith("/wall")
      ? "wall"
      : route.startsWith("/showcase") || route.startsWith("/parents")
        ? "public-showcase"
        : "teacher";
  if (active === "teacher") return <TeacherRoute />;
  if (active === "public-showcase") return <PublicShowcaseRoute />;

  const data = useInitialData(active);

  if (data.loading) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" />
        <span>正在连接课堂系统</span>
      </main>
    );
  }

  if (data.error) {
    return (
      <main className="loading-screen">
        <strong>连接失败</strong>
        <span>{data.error}</span>
      </main>
    );
  }

  return (
    <>
      {active === "student" && <StudentApp camp={data.camp} refresh={data.refresh} />}
      {active === "wall" && (
        <WallApp
          camp={data.camp}
          students={data.students}
          showcaseItems={data.showcaseItems}
          artifacts={data.wallArtifacts}
          growthReflections={data.growthReflections}
          problemVoteSummaries={data.problemVoteSummaries}
          awardResults={data.awardResults}
          scoreSummaries={data.scoreSummaries}
        />
      )}
    </>
  );
}

function TeacherRoute() {
  const [authStatus, setAuthStatus] = useState<"checking" | "guest" | "authed">(
    hasTeacherToken() ? "checking" : "guest"
  );
  const [teacher, setTeacher] = useState<TeacherAccount | null>(getTeacherAccount());
  const data = useTeacherData(authStatus === "authed");

  useEffect(() => {
    let alive = true;
    if (!hasTeacherToken()) {
      clearTeacherToken();
      setTeacher(null);
      setAuthStatus("guest");
      return () => {
        alive = false;
      };
    }

    setAuthStatus("checking");
    api.me()
      .then((result) => {
        if (!alive) return;
        setTeacher(result.teacher);
        setAuthStatus("authed");
      })
      .catch(() => {
        if (!alive) return;
        clearTeacherToken();
        setTeacher(null);
        setAuthStatus("guest");
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (authStatus === "authed" && (data.error === "UNAUTHORIZED" || data.error === "登录已过期，请重新进入。")) {
      clearTeacherToken();
      setTeacher(null);
      setAuthStatus("guest");
    }
  }, [authStatus, data.error]);

  if (authStatus === "checking") {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" />
        <span>正在验证教师身份</span>
      </main>
    );
  }

  if (authStatus === "guest") {
    return (
      <TeacherLogin
        camp={data.camp}
        onLoggedIn={(account) => {
          setTeacher(account);
          setAuthStatus("authed");
        }}
      />
    );
  }

  if (data.loading) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" />
        <span>正在加载教师端</span>
      </main>
    );
  }

  if (data.error) {
    return (
      <main className="loading-screen">
        <strong>连接失败</strong>
        <span>{data.error}</span>
      </main>
    );
  }

  return (
    <TeacherApp
      camp={data.camp}
      modules={data.modules}
      students={data.students}
      refresh={data.refresh}
      teacher={teacher}
      onLoggedOut={() => {
        clearTeacherToken();
        setTeacher(null);
        setAuthStatus("guest");
      }}
    />
  );
}

function PublicShowcaseRoute() {
  const searchParams = new URLSearchParams(window.location.search);
  const parentScoreMode = window.location.pathname.startsWith("/parents") && searchParams.get("score");
  const observerCode = searchParams.get("code") || "";

  if (parentScoreMode) {
    return <ParentObserverScoreRoute initialCode={observerCode} />;
  }

  const [camp, setCamp] = useState<{ name: string; location: string; starts_on?: string; ends_on?: string } | null>(null);
  const [finalItems, setFinalItems] = useState<WallArtifact[]>([]);
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [growthReflections, setGrowthReflections] = useState<WallArtifact[]>([]);
  const [projectJourney, setProjectJourney] = useState<WallArtifact[]>([]);
  const [scoreSummaries, setScoreSummaries] = useState<ScoreSummary[]>([]);
  const [awardResults, setAwardResults] = useState<AwardResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedProjectId = searchParams.get("project") || "";

  useEffect(() => {
    api.publicFinalShowcase()
      .then((result) => {
        setCamp(result.camp);
        setFinalItems(sortByDisplayOrder(result.final_showcase));
        setShowcaseItems(result.showcase_items);
        setGrowthReflections(result.growth_reflections ?? []);
        setProjectJourney(result.project_journey ?? []);
        setScoreSummaries(result.score_summaries ?? []);
        setAwardResults(result.award_results ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "页面暂时没有打开"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" />
        <span>正在打开作品展</span>
      </main>
    );
  }

  if (error) {
    return (
      <main className="loading-screen">
        <strong>作品展暂时没有打开</strong>
        <span>{error}</span>
      </main>
    );
  }

  if (selectedProjectId) {
    return (
      <PublicProjectDetail
        projectId={selectedProjectId}
        camp={camp}
        finalItems={finalItems}
        showcaseItems={showcaseItems}
        growthReflections={growthReflections}
        projectJourney={projectJourney}
        scoreSummaries={scoreSummaries}
        awardResults={awardResults}
      />
    );
  }

  return (
    <main className="public-showcase-page">
      <header className="public-showcase-hero">
        <span>{camp?.location || "少年CEO AI 创业营"}</span>
        <h1>三天课程成果</h1>
        <p>孩子们从真实问题出发，采访用户，做出产品原型，并在结营路演中展示自己的作品。</p>
      </header>
      <section className="public-section">
        <div className="public-section-title">
          <span>结营路演</span>
          <h2>小组最终展示卡</h2>
        </div>
        <div className="public-final-grid">
          {finalItems.map((item, index) => {
            const href = asText(item.payload.access_url);
            const screenshot = asText(item.payload.screenshot_url);
            const projectHref = publicProjectUrl(item.id);
            return (
              <article className="public-final-card" key={item.id}>
                <div className="public-final-shot">
                  {screenshot ? (
                    <img src={normalizeShowcaseUrl(screenshot)} alt={asText(item.payload.product_name) || "作品展示图"} />
                  ) : (
                    <Trophy size={42} />
                  )}
                </div>
                <div>
                  <span>第 {displayOrderFor(item) === 9999 ? index + 1 : displayOrderFor(item)} 组 · {item.team_name || "项目团队"}</span>
                  <strong>{asText(item.payload.product_name) || "未命名作品"}</strong>
                  <p>{asText(item.payload.value_line) || "这组作品正在整理介绍。"}</p>
                </div>
                <dl>
                  <div>
                    <dt>团队成员</dt>
                    <dd>{asText(item.payload.team_members) || "团队成员"}</dd>
                  </div>
                  <div>
                    <dt>目标用户</dt>
                    <dd>{asText(item.payload.target_user) || "目标用户"}</dd>
                  </div>
                  <div>
                    <dt>解决的问题</dt>
                    <dd>{asText(item.payload.core_problem) || "真实问题"}</dd>
                  </div>
                </dl>
                <div className="public-final-actions">
                  <a href={projectHref}>
                    <Package size={16} />
                    查看作品页
                  </a>
                  {href && (
                    <a href={normalizeShowcaseUrl(href)} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} />
                      打开作品
                    </a>
                  )}
                </div>
              </article>
            );
          })}
          {!finalItems.length && (
            <article className="public-empty">
              <Package size={34} />
              <strong>最终展示卡会出现在这里</strong>
              <span>结营路演准备好后，家长可以在这里看到作品成果。</span>
            </article>
          )}
        </div>
      </section>
      <section className="public-section">
        <div className="public-section-title">
          <span>作品入口</span>
          <h2>可以体验的产品</h2>
        </div>
        <ShowcaseGallery items={showcaseItems} />
      </section>
      <section className="public-section">
        <div className="public-section-title">
          <span>观察员看见了什么</span>
          <h2>亮点和下一步</h2>
        </div>
        <ScoreSummaryGallery summaries={scoreSummaries} />
      </section>
      <section className="public-section">
        <div className="public-section-title">
          <span>成长卡</span>
          <h2>下一次我怎么指挥 AI</h2>
        </div>
        <GrowthReflectionGallery reflections={growthReflections} />
      </section>
      <section className="public-section">
        <div className="public-section-title">
          <span>结营证书</span>
          <h2>奖项与能力标签</h2>
        </div>
        <AwardGallery awards={awardResults} />
      </section>
    </main>
  );
}

function emptyScoreValues() {
  return scoreDimensionLabels.reduce<Record<ScoreDimension, number>>((acc, dimension) => {
    acc[dimension.key] = 0;
    return acc;
  }, {} as Record<ScoreDimension, number>);
}

function ParentObserverScoreRoute({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [brief, setBrief] = useState<ObserverScoreBrief | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [observerName, setObserverName] = useState("");
  const [scores, setScores] = useState<Record<ScoreDimension, number>>(emptyScoreValues);
  const [highlight, setHighlight] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const items = brief?.showcase_items ?? [];
  const selectedItem = items.find((item) => item.id === selectedId) || null;

  const showMessage = (tone: StudentMessage["tone"], text: string) => setMessage({ tone, text });

  const loadBrief = async (nextCode = code) => {
    const trimmed = nextCode.trim();
    if (!trimmed) {
      showMessage("error", "请输入现场给你的观察码。");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await api.observerScoreBrief(trimmed);
      setBrief(result);
      setCode(trimmed);
      setSelectedId((current) => current || result.showcase_items[0]?.id || "");
    } catch (err) {
      setBrief(null);
      showMessage("error", err instanceof Error ? err.message : "这条评分入口暂时不能使用，请找现场老师换一个链接。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) void loadBrief(initialCode);
  }, [initialCode]);

  const updateScore = (key: ScoreDimension, value: number) => {
    setScores((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    if (!selectedItem) {
      showMessage("error", "先选一个你刚看过的作品。");
      return;
    }
    if (scoreDimensionLabels.some((dimension) => !scores[dimension.key])) {
      showMessage("error", "五组星星都点一下。");
      return;
    }
    if (!highlight.trim()) {
      showMessage("error", "写一句你看见的亮点。");
      return;
    }
    if (!nextStep.trim()) {
      showMessage("error", "再写一句下一步建议。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitObserverScore({
        code,
        observer_name: observerName.trim(),
        showcase_item_id: selectedItem.id,
        highlight: highlight.trim(),
        next_step: nextStep.trim(),
        ...scores
      });
      showMessage("success", "收到啦。你的星星和建议会放进作品秀汇总。");
      setScores(emptyScoreValues());
      setHighlight("");
      setNextStep("");
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请找现场老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="observer-score-page">
      <header className="observer-score-hero">
        <span>{brief?.camp.location || "少年CEO AI 创业营"}</span>
        <h1>看完作品，留下星星和建议</h1>
        <p>选一个作品，点亮五组星星，再写下你看见的亮点和下一步建议。</p>
      </header>
      <section className="observer-score-card">
        <div className="observer-code-form">
          <label>
            观察码
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="现场老师给你的观察码"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <button disabled={loading} onClick={() => void loadBrief()}>
            {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
            打开评分
          </button>
        </div>
        {loading ? (
          <div className="feedback-loading">
            <Loader2 className="spin" size={24} />
            <span>正在打开作品卡</span>
          </div>
        ) : items.length ? (
          <>
            <label>
              你的名字
              <input
                value={observerName}
                onChange={(event) => setObserverName(event.target.value)}
                placeholder="可不填"
                inputMode="text"
              />
            </label>
            <div className="feedback-product-grid observer-product-grid">
              {items.map((item) => {
                const active = item.id === selectedId;
                const href = item.access_url ? normalizeShowcaseUrl(item.access_url) : "";
                return (
                  <article className={active ? "feedback-product active" : "feedback-product"} key={item.id}>
                    <button onClick={() => setSelectedId(item.id)}>
                      <span>{item.team_name || item.track || "作品"}</span>
                      <strong>{item.product_name}</strong>
                      <small>{item.one_liner || "看看它帮用户完成了什么。"}</small>
                    </button>
                    {href && (
                      <a href={href} target="_blank" rel="noreferrer">
                        <ExternalLink size={15} />
                        打开作品
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="score-dimension-list">
              {scoreDimensionLabels.map((dimension) => (
                <div className="score-dimension" key={dimension.key}>
                  <div>
                    <strong>{dimension.label}</strong>
                    <span>{dimension.hint}</span>
                  </div>
                  <ScoreRating value={scores[dimension.key]} onChange={(value) => updateScore(dimension.key, value)} />
                </div>
              ))}
            </div>
            <label>
              我看见的亮点
              <input
                value={highlight}
                onChange={(event) => setHighlight(event.target.value)}
                placeholder="例如：用户一打开就知道怎么选"
                inputMode="text"
              />
            </label>
            <label>
              我给下一版的建议
              <input
                value={nextStep}
                onChange={(event) => setNextStep(event.target.value)}
                placeholder="例如：可以加一个更明显的开始按钮"
                inputMode="text"
                enterKeyHint="done"
              />
            </label>
            <button className="submit-button observer-submit" disabled={submitting} onClick={submit}>
              {submitting ? <Loader2 className="spin" size={18} /> : <Star size={18} />}
              提交评分
            </button>
          </>
        ) : (
          <article className="public-empty observer-empty">
            <Package size={34} />
            <strong>作品卡出现后，这里会开放评分</strong>
            <span>可以先等现场作品秀开始。</span>
          </article>
        )}
        {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
      </section>
    </main>
  );
}

function publicProjectUrl(projectId: string) {
  const route = window.location.pathname.startsWith("/parents") ? "/parents" : "/showcase";
  return `${route}?project=${encodeURIComponent(projectId)}`;
}

function splitList(value: unknown) {
  return asText(value)
    .split(/[\n,，、;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function contributionCards(finalItem: WallArtifact | null, awards: AwardResult[]) {
  const contributionLines = splitList(finalItem?.payload.personal_contributions);
  if (contributionLines.length) {
    return contributionLines.map((line) => {
      const [name, ...rest] = line.split(/[：:]/);
      return {
        name: (rest.length ? name : line).trim(),
        contribution: rest.join("：").trim() || "为团队作品贡献了自己的力量",
        tag: awards[0]?.award_type || "能力标签"
      };
    });
  }
  const members = splitList(finalItem?.payload.team_members);
  return members.map((member, index) => ({
    name: member,
    contribution: index === 0 ? "把团队想法带到台前" : "和团队一起完成作品展示",
    tag: awards[index % Math.max(awards.length, 1)]?.award_type || "团队贡献"
  }));
}

function matchesProject(
  projectId: string,
  finalItem: WallArtifact | null,
  productName: string,
  teamId?: string | null,
  teamName?: string | null
) {
  return (item: { showcase_item_id?: string | null; team_id?: string | null; team_name?: string | null; product_name?: string }) => {
    const finalShowcaseId = finalItem ? `final-${finalItem.id}` : "";
    return (
      item.showcase_item_id === projectId ||
      item.showcase_item_id === finalShowcaseId ||
      (!!teamId && item.team_id === teamId) ||
      (!!productName && item.product_name === productName) ||
      (!!teamName && item.team_name === teamName)
    );
  };
}

function awardMatchesProject(award: AwardResult, projectId: string, finalItem: WallArtifact | null, productName: string, teamId?: string | null) {
  const finalShowcaseId = finalItem ? `final-${finalItem.id}` : "";
  return (
    award.winner_id === projectId ||
    award.winner_id === finalShowcaseId ||
    (!!teamId && award.winner_id === teamId) ||
    (!!productName && award.winner_name.includes(productName))
  );
}

function journeyItemRank(item: WallArtifact) {
  const ranks: Record<string, number> = {
    problem_card: 1,
    ai_validation: 2,
    market_scout: 3,
    user_voice: 4,
    product_definition: 5,
    prompt_card: 6,
    product_feedback: 7,
    mentor_comment: 8
  };
  return ranks[item.task_type] ?? 9;
}

function journeyItemMatchesProject(item: WallArtifact, productName: string, teamId?: string | null, teamName?: string | null) {
  const itemTeamId = item.task_type === "product_feedback"
    ? asText(item.payload.team_id)
    : item.team_id || asText(item.payload.team_id);
  const itemTeamName = item.task_type === "product_feedback"
    ? asText(item.payload.team_name) || item.team_name
    : item.team_name || asText(item.payload.team_name);
  const itemProductName = asText(item.payload.product_name);
  return (
    (!!teamId && itemTeamId === teamId) ||
    (!!teamName && itemTeamName === teamName) ||
    (!!productName && itemProductName === productName)
  );
}

function sortProjectJourney(items: WallArtifact[]) {
  return [...items].sort((a, b) => {
    const byRank = journeyItemRank(a) - journeyItemRank(b);
    if (byRank !== 0) return byRank;
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
}

function PublicProjectDetail({
  projectId,
  camp,
  finalItems,
  showcaseItems,
  growthReflections,
  projectJourney,
  scoreSummaries,
  awardResults
}: {
  projectId: string;
  camp: { name: string; location: string; starts_on?: string; ends_on?: string } | null;
  finalItems: WallArtifact[];
  showcaseItems: ShowcaseItem[];
  growthReflections: WallArtifact[];
  projectJourney: WallArtifact[];
  scoreSummaries: ScoreSummary[];
  awardResults: AwardResult[];
}) {
  const finalItem =
    finalItems.find((item) => item.id === projectId || `final-${item.id}` === projectId) ||
    finalItems.find((item) => showcaseItems.some((showcase) => showcase.id === projectId && showcase.team_id && showcase.team_id === item.team_id)) ||
    null;
  const showcaseItem =
    showcaseItems.find((item) => item.id === projectId || (finalItem && item.id === `final-${finalItem.id}`)) ||
    showcaseItems.find((item) => finalItem && item.team_id === finalItem.team_id && item.product_name === asText(finalItem.payload.product_name)) ||
    null;
  const productName = asText(finalItem?.payload.product_name) || showcaseItem?.product_name || "未命名作品";
  const teamName = finalItem?.team_name || showcaseItem?.team_name || showcaseItem?.track || "项目团队";
  const teamId = finalItem?.team_id || showcaseItem?.team_id || null;
  const accessUrl = asText(finalItem?.payload.access_url) || showcaseItem?.access_url || "";
  const screenshot = asText(finalItem?.payload.screenshot_url) || showcaseItem?.screenshot_url || "";
  const scoreSummary = scoreSummaries.find(matchesProject(projectId, finalItem, productName, teamId, teamName)) || null;
  const projectAwards = awardResults.filter((award) => awardMatchesProject(award, projectId, finalItem, productName, teamId));
  const allProjectJourneyItems = sortProjectJourney(
    projectJourney.filter((item) => journeyItemMatchesProject(item, productName, teamId, teamName))
  );
  const mentorComments = allProjectJourneyItems.filter((item) => item.task_type === "mentor_comment");
  const projectJourneyItems = allProjectJourneyItems.filter((item) => item.task_type !== "mentor_comment");
  const projectGrowthReflections = growthReflections.filter((reflection) => {
    const reflectionTeamId = reflection.team_id || asText(reflection.payload.team_id);
    const reflectionTeamName = reflection.team_name || asText(reflection.payload.team_name);
    return (
      (!!teamId && reflectionTeamId === teamId) ||
      (!!teamName && reflectionTeamName === teamName) ||
      (!!finalItem?.team_id && reflectionTeamId === finalItem.team_id)
    );
  });
  const certificates = contributionCards(finalItem, projectAwards);

  if (!finalItem && !showcaseItem) {
    return (
      <main className="public-showcase-page">
        <section className="project-not-found">
          <Package size={36} />
          <h1>这个作品页还没有准备好</h1>
          <p>可以先回到作品展，看看已经整理好的团队成果。</p>
          <a href={window.location.pathname.startsWith("/parents") ? "/parents" : "/showcase"}>回到作品展</a>
        </section>
      </main>
    );
  }

  return (
    <main className="public-project-page">
      <header className="project-hero">
        <a href={window.location.pathname.startsWith("/parents") ? "/parents" : "/showcase"}>返回作品展</a>
        <span>{camp?.location || "少年CEO AI 创业营"} · {teamName}</span>
        <h1>{productName}</h1>
        <p>{asText(finalItem?.payload.value_line) || showcaseItem?.one_liner || "这是一组正在被真实用户检验的 AI 产品原型。"}</p>
        {accessUrl && (
          <a className="project-open-link" href={normalizeShowcaseUrl(accessUrl)} target="_blank" rel="noreferrer">
            <ExternalLink size={18} />
            打开作品
          </a>
        )}
      </header>

      <section className="project-story-grid">
        <div className="project-shot">
          {screenshot ? <img src={normalizeShowcaseUrl(screenshot)} alt={`${productName} 展示图`} /> : <Rocket size={54} />}
        </div>
        <article className="project-story-card">
          <span>项目故事</span>
          <dl>
            <div>
              <dt>目标用户</dt>
              <dd>{asText(finalItem?.payload.target_user) || "真实用户"}</dd>
            </div>
            <div>
              <dt>解决的问题</dt>
              <dd>{asText(finalItem?.payload.core_problem) || "一个值得继续研究的问题"}</dd>
            </div>
            <div>
              <dt>团队成员</dt>
              <dd>{asText(finalItem?.payload.team_members) || teamName}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="project-section">
        <div className="public-section-title">
          <span>项目成长线</span>
          <h2>从问题到作品</h2>
        </div>
        <ProjectJourneyTimeline items={projectJourneyItems} />
      </section>

      <section className="project-section">
        <div className="public-section-title">
          <span>观察员记录</span>
          <h2>亮点和下一步</h2>
        </div>
        {scoreSummary ? <ScoreSummaryGallery summaries={[scoreSummary]} /> : (
          <article className="public-empty">
            <Star size={34} />
            <strong>观察员记录会出现在这里</strong>
            <span>作品秀开始后，亮点和下一步建议会慢慢长出来。</span>
          </article>
        )}
      </section>

      <section className="project-section">
        <div className="public-section-title">
          <span>导师点评</span>
          <h2>被看见的作品亮点</h2>
        </div>
        <MentorCommentGallery comments={mentorComments} />
      </section>

      <section className="project-section">
        <div className="public-section-title">
          <span>证书卡</span>
          <h2>每个人的贡献</h2>
        </div>
        <div className="certificate-grid">
          {certificates.map((certificate) => (
            <article className="certificate-card" key={`${certificate.name}-${certificate.contribution}`}>
              <span>{certificate.tag}</span>
              <strong>{certificate.name}</strong>
              <p>{certificate.contribution}</p>
            </article>
          ))}
          {!certificates.length && (
            <article className="public-empty">
              <UsersRound size={34} />
              <strong>贡献卡会出现在这里</strong>
              <span>团队补充每个人的贡献后，这里会生成证书卡。</span>
            </article>
          )}
        </div>
      </section>

      <section className="project-section">
        <div className="public-section-title">
          <span>成长卡</span>
          <h2>下一次我怎么指挥 AI</h2>
        </div>
        <GrowthReflectionGallery reflections={projectGrowthReflections} />
      </section>

      <section className="project-section">
        <div className="public-section-title">
          <span>奖项</span>
          <h2>被看见的能力标签</h2>
        </div>
        <AwardGallery awards={projectAwards} />
      </section>
    </main>
  );
}

function MentorCommentGallery({ comments }: { comments: WallArtifact[] }) {
  if (!comments.length) {
    return (
      <article className="public-empty mentor-empty">
        <MessageSquareText size={34} />
        <strong>导师点评会出现在这里</strong>
        <span>老师写下作品亮点和下一版建议后，这里会慢慢点亮。</span>
      </article>
    );
  }

  return (
    <div className="mentor-comment-grid">
      {comments.map((comment) => (
        <article className="mentor-comment-card" key={comment.id}>
          <span>{asText(comment.payload.mentor_name) || "主讲老师"}</span>
          <strong>{asText(comment.payload.comment) || "这组作品有清楚的用户线索。"}</strong>
          {asText(comment.payload.next_step) && (
            <p><b>下一版建议</b>{asText(comment.payload.next_step)}</p>
          )}
        </article>
      ))}
    </div>
  );
}

function GrowthReflectionGallery({ reflections }: { reflections: WallArtifact[] }) {
  if (!reflections.length) {
    return (
      <article className="public-empty growth-empty">
        <Brain size={34} />
        <strong>成长卡会出现在这里</strong>
        <span>孩子写下下一次怎样指挥 AI 后，这里会慢慢点亮。</span>
      </article>
    );
  }

  return (
    <div className="growth-reflection-grid">
      {reflections.map((reflection) => {
        const ability = asText(reflection.payload.ability_tag) || "能力标签";
        return (
          <article className="growth-reflection-card" key={reflection.id}>
            <header>
              <span>{ability}</span>
              <strong>{reflection.student_name || "一位少年 CEO"}</strong>
              <small>{reflection.team_name || asText(reflection.payload.team_name) || "项目团队"}</small>
            </header>
            <dl>
              <div>
                <dt>AI 帮我的一步</dt>
                <dd>{asText(reflection.payload.ai_job) || "还在整理"}</dd>
              </div>
              <div>
                <dt>我做的判断</dt>
                <dd>{asText(reflection.payload.human_decision) || "还在整理"}</dd>
              </div>
              <div>
                <dt>下一次想练</dt>
                <dd>{asText(reflection.payload.next_practice) || growthAbilityHints[ability as keyof typeof growthAbilityHints] || "继续练习指挥 AI"}</dd>
              </div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

function journeyTitle(item: WallArtifact) {
  if (item.task_type === "problem_card") return asText(item.payload.problem_scene) || "发现一个真实问题";
  if (item.task_type === "market_scout") return asText(item.payload.ai_rewrite) || asText(item.payload.original_problem) || "完成一次市场侦察";
  if (item.task_type === "user_voice") return asText(item.payload.interviewee) || "听见一位用户";
  if (item.task_type === "ai_validation") return asText(item.payload.doubt) || "用证据检查 AI";
  if (item.task_type === "product_definition") return asText(item.payload.product_name) || "写出产品一句话";
  if (item.task_type === "prompt_card") return asText(item.payload.goal) || "写出五句提示词";
  if (item.task_type === "product_feedback") return asText(item.payload.product_name) || "收到试用反馈";
  if (item.task_type === "mentor_comment") return asText(item.payload.product_name) || "导师点评";
  return item.title || "项目记录";
}

function journeyLabel(item: WallArtifact) {
  const labels: Record<string, string> = {
    problem_card: "发现问题",
    market_scout: "市场侦察",
    user_voice: "听见用户",
    ai_validation: "检查 AI",
    product_definition: "产品一句话",
    prompt_card: "提示词卡",
    product_feedback: "收到反馈",
    mentor_comment: "导师点评"
  };
  return labels[item.task_type] || "项目记录";
}

function journeyCopy(item: WallArtifact) {
  if (item.task_type === "problem_card") {
    return [
      ["用户", asText(item.payload.target_user)],
      ["麻烦", asText(item.payload.trouble)],
      ["现在办法", asText(item.payload.current_solution)]
    ];
  }
  if (item.task_type === "user_voice") {
    return [
      ["听到", asText(item.payload.quote)],
      ["多久一次", asText(item.payload.frequency)],
      ["现在办法", asText(item.payload.current_solution)],
      ["愿意试用吗", asText(item.payload.willingness)],
      ["判断", asText(item.payload.signal)],
      ["发现", asText(item.payload.finding)]
    ];
  }
  if (item.task_type === "market_scout") {
    return [
      ["原问题", asText(item.payload.original_problem)],
      ["AI 改写", asText(item.payload.ai_rewrite)],
      ["用户声音", asText(item.payload.user_clue)],
      ["已有方案", asText(item.payload.existing_solution)],
      ["不同角度", asText(item.payload.different_angle)],
      ["继续验证", asText(item.payload.next_question)]
    ];
  }
  if (item.task_type === "ai_validation") {
    return [
      ["AI 说", asText(item.payload.ai_answer)],
      ["可疑句", asText(item.payload.doubt)],
      ["证据", asText(item.payload.evidence)],
      ["改后结论", asText(item.payload.revised_conclusion)]
    ];
  }
  if (item.task_type === "product_definition") {
    return [
      ["帮谁", asText(item.payload.target_user)],
      ["问题", asText(item.payload.core_problem)],
      ["办法", asText(item.payload.solution)],
      ["一句话", asText(item.payload.one_liner)]
    ];
  }
  if (item.task_type === "prompt_card") {
    return [
      ["目标", asText(item.payload.goal)],
      ["用户", asText(item.payload.target_user)],
      ["材料", asText(item.payload.materials)],
      ["限制", asText(item.payload.constraints)],
      ["格式", asText(item.payload.output_format)],
      ["再改一句", asText(item.payload.revision_request)]
    ];
  }
  if (item.task_type === "product_feedback") {
    return [
      ["有用的地方", asText(item.payload.most_useful)],
      ["下一版建议", asText(item.payload.suggestion)]
    ];
  }
  if (item.task_type === "mentor_comment") {
    return [
      ["看见的亮点", asText(item.payload.comment)],
      ["下一版建议", asText(item.payload.next_step)],
      ["点评人", asText(item.payload.mentor_name)]
    ];
  }
  return [["记录", item.title]];
}

function ProjectJourneyTimeline({ items }: { items: WallArtifact[] }) {
  if (!items.length) {
    return (
      <article className="public-empty journey-empty">
        <Route size={34} />
        <strong>项目成长线会出现在这里</strong>
        <span>老师选择问题卡、侦察卡、用户声音和反馈后，这里会看到作品一路长出来的过程。</span>
      </article>
    );
  }

  return (
    <div className="project-journey-timeline">
      {items.map((item, index) => {
        const sourceName = item.task_type === "product_feedback"
          ? asText(item.payload.team_name) || item.team_name || "作品团队"
          : item.team_name || item.student_name || "项目记录";
        return (
          <article className="project-journey-card" key={item.id}>
            <div className="journey-step-index">{index + 1}</div>
            <div>
              <span>{journeyLabel(item)}</span>
              <strong>{journeyTitle(item)}</strong>
              <dl>
                {journeyCopy(item)
                  .filter(([, value]) => Boolean(value))
                  .slice(0, 4)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
              <small>{sourceName}</small>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ScoreStars({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <span className="score-stars" aria-label={`${value || 0} 星`}>
      {scoreScale.map((score) => (
        <Star key={score} size={15} fill={score <= rounded ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

function ScoreSummaryGallery({ summaries }: { summaries: ScoreSummary[] }) {
  if (!summaries.length) {
    return (
      <article className="public-empty score-empty">
        <Star size={34} />
        <strong>观察员记录会出现在这里</strong>
        <span>作品秀开始后，亮点和下一步建议会慢慢长出来。</span>
      </article>
    );
  }

  return (
    <div className="score-summary-grid">
      {summaries.map((summary) => (
        <article className="score-summary-card" key={summary.key}>
          <header>
            <div>
              <span>{summary.team_name || "项目团队"}</span>
              <strong>{summary.product_name}</strong>
            </div>
            <div className="score-total">
              <ScoreStars value={summary.average_total} />
              <b>{summary.average_total || "-"}</b>
            </div>
          </header>
          <div className="score-bars">
            {scoreDimensionLabels.map((dimension) => (
              <div className="score-bar" key={dimension.key}>
                <span>{dimension.label}</span>
                <div><i style={{ width: `${Math.max(0, Math.min(100, (summary.scores[dimension.key] / 5) * 100))}%` }} /></div>
                <b>{summary.scores[dimension.key] || "-"}</b>
              </div>
            ))}
          </div>
          <dl className="score-notes">
            <div>
              <dt>亮点</dt>
              <dd>{summary.highlights[0] || "等待观察员写下亮点"}</dd>
            </div>
            <div>
              <dt>下一步</dt>
              <dd>{summary.next_steps[0] || "等待观察员给出建议"}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function AwardGallery({ awards }: { awards: AwardResult[] }) {
  if (!awards.length) {
    return (
      <article className="public-empty award-empty">
        <Trophy size={34} />
        <strong>奖项会在结营时点亮</strong>
        <span>每一个奖项都会对应一条真实贡献。</span>
      </article>
    );
  }

  return (
    <div className="award-grid">
      {awards.map((award) => (
        <article className="award-card" key={award.id}>
          <span>{award.award_type}</span>
          <strong>{award.winner_name}</strong>
          <p>{award.reason || "这份贡献被大家看见了。"}</p>
        </article>
      ))}
    </div>
  );
}

function TeacherApp({
  camp,
  modules,
  students,
  refresh,
  teacher,
  onLoggedOut
}: {
  camp: Camp | null;
  modules: CourseModule[];
  students: Student[];
  refresh: () => Promise<void>;
  teacher: TeacherAccount | null;
  onLoggedOut: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedModuleId, setSelectedModuleId] = useState("future-photo-studio");
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Student | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const selectedModule = modules.find((module) => module.id === selectedModuleId) || modules[0];
  const lessonPages = useMemo(() => coursewarePages(selectedModule), [selectedModule]);
  const selectedPage = lessonPages[selectedPageIndex] || lessonPages[0];
  const byDay = useMemo(
    () => [1, 2, 3].map((day) => ({ day, modules: modules.filter((module) => module.day === day) })),
    [modules]
  );

  useEffect(() => {
    setSelectedPageIndex(0);
  }, [selectedModuleId]);

  useEffect(() => {
    setTimerSeconds(0);
  }, [selectedPage?.id]);

  useEffect(() => {
    if (!timerSeconds) return undefined;
    const interval = window.setInterval(() => {
      setTimerSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerSeconds]);

  const publishCurrentModule = async () => {
    if (!selectedModule) return;
    setActionMessage("");
    try {
      await api.setCurrentTask({
        module_id: selectedModule.id,
        title: selectedModule.title,
        activity_type: "lesson"
      });
      setActionMessage("当前环节已发到学生端。");
      await refresh();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "发布失败");
    }
  };

  const publishCurrentPage = async (action = "发布任务") => {
    if (!selectedModule || !selectedPage) return;
    setActionMessage("");
    try {
      await api.setCurrentTask({
        module_id: selectedModule.id,
        title: lessonPageTitle(selectedModule, selectedPage),
        activity_type: taskTypeForAction(action, selectedPage),
        payload: {
          page_no: selectedPage.page_no,
          page_type: selectedPage.page_type,
          module_title: selectedModule.title,
          summary: selectedPage.content_summary || selectedModule.subtitle || ""
        }
      });
      setActionMessage(`本页任务已发出：${lessonPageTitle(selectedModule, selectedPage)}。`);
      await refresh();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "发布失败");
    }
  };

  const openPresentation = async () => {
    setPresenting(true);
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // The overlay still fills the viewport when browser-level fullscreen is unavailable.
    }
  };

  const closePresentation = async () => {
    setPresenting(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // Ignore fullscreen exit errors from browser gesture restrictions.
    }
  };

  const startPageTimer = () => {
    if (!selectedPage) return;
    const minutes = timerMinutesForPage(selectedPage);
    setTimerSeconds(minutes * 60);
    setActionMessage(`${minutes} 分钟计时开始了。`);
  };

  const openWall = () => {
    window.open("/wall", "_blank", "noopener,noreferrer");
    setActionMessage("大屏页面已打开。");
  };

  const handlePageAction = async (action: string) => {
    if (action === "全屏演示" || action === "投屏展示") {
      await openPresentation();
      return;
    }
    if (action === "启动计时") {
      startPageTimer();
      return;
    }
    if (action === "打开看板") {
      openWall();
      return;
    }
    if (action === "发布任务" || action === "发起互动" || action === "进入评分") {
      await publishCurrentPage(action);
      return;
    }
    setActionMessage(`已准备：${action}。`);
  };

  return (
    <main className="teacher-layout">
      <aside className="sidebar">
        <div className="brand">
          <span>{camp?.name || "少年CEO AI 创业营"}</span>
          <small>{camp?.location || "北京顺义站"} · 三天课程台</small>
        </div>
        <div className="day-switcher">
          {[1, 2, 3].map((day) => (
            <button
              key={day}
              className={selectedDay === day ? "active" : ""}
              onClick={() => {
                setSelectedDay(day);
                const firstModule = modules.find((module) => module.day === day);
                if (firstModule) setSelectedModuleId(firstModule.id);
              }}
            >
              D{day}
            </button>
          ))}
        </div>
        <div className="module-list">
          {byDay
            .find((item) => item.day === selectedDay)
            ?.modules.map((module) => (
              <button
                key={module.id}
                className={module.id === selectedModuleId ? "module active" : "module"}
                onClick={() => setSelectedModuleId(module.id)}
              >
                <span>{module.time_range}</span>
                <strong>{module.title}</strong>
                <small>{module.subtitle}</small>
              </button>
            ))}
        </div>
      </aside>
      <section className="teacher-main">
        <TeacherHeader
          camp={camp}
          students={students}
          teacher={teacher}
          onLogout={() => {
            onLoggedOut();
          }}
        />
        <section className="lesson-panel">
          <div className="lesson-title">
            <div>
              <span className="eyebrow">正在讲的课件</span>
              <h1>{selectedModule?.title || "未来照相馆"}</h1>
              <p>{selectedModule?.subtitle}</p>
            </div>
            <div className="lesson-actions">
              <button className="secondary" onClick={openPresentation}>
                <Maximize2 size={18} />
                全屏演示
              </button>
              <button className="primary" onClick={publishCurrentModule}>
                <Play size={18} />
                发到学生端
              </button>
            </div>
          </div>
          {actionMessage && <p className="hint">{actionMessage}</p>}
          <div className="lesson-page-nav">
            {lessonPages.map((page, index) => (
              <button
                key={page.id}
                className={index === selectedPageIndex ? "active" : ""}
                onClick={() => setSelectedPageIndex(index)}
              >
                <span>{page.page_no}</span>
                {lessonPageTitle(selectedModule, page)}
              </button>
            ))}
          </div>
          {selectedModule && selectedPage && (
            <TeacherLessonControls
              module={selectedModule}
              page={selectedPage}
              timerSeconds={timerSeconds}
              onPublishPage={() => publishCurrentPage("发布任务")}
              onAction={handlePageAction}
            />
          )}
          {selectedModule && selectedPage && (
            <LessonPageCanvas
              module={selectedModule}
              page={selectedPage}
              students={students}
              onOpenPhoto={setSelectedPhoto}
            />
          )}
        </section>
        <TeacherTeamWorkspace students={students} refresh={refresh} />
        <TeacherProgressBoard students={students} />
        <section className="teacher-grid">
          <TeacherStudents students={students} refresh={refresh} />
          <FuturePhotoReview refresh={refresh} />
        </section>
        <TeacherD1Artifacts />
        <TeacherProductDefinitions />
        <TeacherPromptCards />
        <TeacherProjectSubmissions />
        <TeacherPeerFeedback />
        <TeacherFinalShowcase />
        <TeacherScoringCenter />
        <TeacherMentorComments />
        <TeacherGrowthReflections />
        <TeacherShowcase />
      </section>
      {presenting && selectedModule && (
        <PresentationOverlay
          module={selectedModule}
          pages={lessonPages}
          students={students}
          initialPageIndex={selectedPageIndex}
          onClose={closePresentation}
          onOpenPhoto={setSelectedPhoto}
        />
      )}
      {selectedPhoto && <PhotoLightbox student={selectedPhoto} onClose={() => setSelectedPhoto(null)} />}
    </main>
  );
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function selectedProblemIds(payload: Record<string, unknown>) {
  const raw = payload.selected_problem_ids;
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map((id) => String(id ?? "").trim()).filter(Boolean))).slice(0, 3);
}

function displayOrderFor(item: TaskSubmission | WallArtifact) {
  const order = asNumber(item.payload.display_order);
  return order > 0 ? order : 9999;
}

function sortByDisplayOrder<T extends TaskSubmission | WallArtifact>(items: T[]) {
  return [...items].sort((a, b) => {
    const byOrder = displayOrderFor(a) - displayOrderFor(b);
    if (byOrder !== 0) return byOrder;
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
}

const progressMilestones = [
  { key: "problem_card", label: "问题卡", target: 1, unit: "张" },
  { key: "market_scout", label: "侦察卡", target: 1, unit: "张" },
  { key: "user_voice", label: "用户声音", target: 3, unit: "条" },
  { key: "product_definition", label: "产品一句话", target: 1, unit: "条" },
  { key: "prompt_card", label: "提示词卡", target: 1, unit: "张" },
  { key: "product_link", label: "作品入口", target: 1, unit: "个" },
  { key: "product_feedback", label: "互测反馈", target: 2, unit: "条" },
  { key: "final_showcase", label: "展示卡", target: 1, unit: "张" }
] as const;

const teamRoleLabels = ["采访", "产品", "AI", "展示"] as const;

const projectStatusOptions = [
  { value: "NOT_STARTED", label: "未开始" },
  { value: "DISCOVERY", label: "找问题" },
  { value: "PROTOTYPING", label: "做原型" },
  { value: "TESTING", label: "互测" },
  { value: "READY", label: "准备展示" }
];

const showcaseStatusOptions = [
  { value: "DRAFT", label: "草稿" },
  { value: "READY", label: "可上场" },
  { value: "PUBLISHED", label: "已展示" }
];

function TeacherTeamWorkspace({ students, refresh }: { students: Student[]; refresh: () => Promise<void> }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [managedStudents, setManagedStudents] = useState<Student[]>(students);
  const [message, setMessage] = useState("");
  const [savingTeamId, setSavingTeamId] = useState("");
  const [assigningStudentId, setAssigningStudentId] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      const [teamResult, studentResult] = await Promise.all([api.teams(), api.students()]);
      setTeams(teamResult.teams);
      setManagedStudents(studentResult.students);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "小组编排加载失败");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setManagedStudents(students);
  }, [students]);

  const updateTeam = (teamId: string, patch: Partial<Team>) => {
    setTeams((items) => items.map((team) => (team.id === teamId ? { ...team, ...patch } : team)));
  };

  const updateTeamRole = (team: Team, role: string, value: string) => {
    updateTeam(team.id, { roles: { ...(team.roles || {}), [role]: value } });
  };

  const saveTeam = async (team: Team) => {
    setSavingTeamId(team.id);
    setMessage("");
    try {
      const result = await api.saveTeam(team);
      setTeams((items) => items.map((item) => (item.id === team.id ? result.team : item)));
      setMessage(`${result.team.name} 已保存。`);
      await Promise.all([refresh(), load()]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingTeamId("");
    }
  };

  const addTeam = async () => {
    const nextGroupNo = Math.max(0, ...teams.map((team) => Number(team.group_no) || 0)) + 1;
    const draft: Team = {
      id: `team-${nextGroupNo}`,
      group_no: nextGroupNo,
      name: `第 ${nextGroupNo} 组`,
      table_no: String(nextGroupNo),
      roles: {},
      project_status: "NOT_STARTED",
      showcase_status: "DRAFT"
    };
    setAdding(true);
    setMessage("");
    try {
      const result = await api.saveTeam(draft);
      setTeams((items) => [...items, result.team].sort((a, b) => a.group_no - b.group_no));
      setMessage(`${result.team.name} 已加入。`);
      await Promise.all([refresh(), load()]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "新增失败");
    } finally {
      setAdding(false);
    }
  };

  const assignStudentTeam = async (student: Student, teamId: string) => {
    setAssigningStudentId(student.id);
    setMessage("");
    try {
      const result = await api.assignStudentTeam(student.id, teamId || null);
      setManagedStudents((items) => items.map((item) => (item.id === student.id ? result.student : item)));
      setMessage(`${student.nickname} 的小组已更新。`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "分组失败");
    } finally {
      setAssigningStudentId("");
    }
  };

  const assignedCount = managedStudents.filter((student) => student.team_id).length;

  return (
    <section className="panel team-workspace-panel">
      <div className="panel-title">
        <UsersRound size={20} />
        <h2>小组编排</h2>
      </div>
      <div className="artifact-stats">
        <span>{teams.length} 个小组</span>
        <span>{assignedCount} 名已分组</span>
        <span>{Math.max(0, managedStudents.length - assignedCount)} 名待分组</span>
      </div>
      <div className="team-actions">
        <button className="secondary" disabled={adding} onClick={addTeam}>
          {adding ? "添加中" : "新增小组"}
        </button>
        <button className="secondary" onClick={() => void load()}>
          刷新
        </button>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="team-workspace-grid">
        <div className="team-edit-list">
          {teams.map((team) => {
            const members = managedStudents.filter((student) => student.team_id === team.id);
            return (
              <article className="team-edit-card" key={team.id}>
                <header className="team-edit-header">
                  <label>
                    <span>组序</span>
                    <input
                      type="number"
                      min={1}
                      value={team.group_no}
                      onChange={(event) => updateTeam(team.id, { group_no: Number(event.target.value) || 1 })}
                    />
                  </label>
                  <label>
                    <span>组名</span>
                    <input value={team.name} onChange={(event) => updateTeam(team.id, { name: event.target.value })} />
                  </label>
                  <label>
                    <span>桌号</span>
                    <input value={team.table_no || ""} onChange={(event) => updateTeam(team.id, { table_no: event.target.value })} />
                  </label>
                </header>
                <div className="team-role-grid">
                  {teamRoleLabels.map((role) => (
                    <label key={role}>
                      <span>{role}</span>
                      <input
                        value={team.roles?.[role] || ""}
                        onChange={(event) => updateTeamRole(team, role, event.target.value)}
                        placeholder="姓名"
                      />
                    </label>
                  ))}
                </div>
                <div className="team-status-selects">
                  <label>
                    <span>项目进度</span>
                    <select
                      value={team.project_status || "NOT_STARTED"}
                      onChange={(event) => updateTeam(team.id, { project_status: event.target.value })}
                    >
                      {projectStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>展示准备</span>
                    <select
                      value={team.showcase_status || "DRAFT"}
                      onChange={(event) => updateTeam(team.id, { showcase_status: event.target.value })}
                    >
                      {showcaseStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <footer>
                  <small>{members.length ? members.map((student) => student.nickname).join("、") : "还没有成员"}</small>
                  <button disabled={savingTeamId === team.id} onClick={() => void saveTeam(team)}>
                    {savingTeamId === team.id ? "保存中" : "保存小组"}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
        <div className="member-assignment-list">
          {managedStudents.map((student) => (
            <div className="member-assignment-row" key={student.id}>
              <div>
                <span>{student.student_no || "--"}</span>
                <strong>{student.nickname}</strong>
                <small>{student.team_name || "未分组"}</small>
              </div>
              <select
                value={student.team_id || ""}
                disabled={assigningStudentId === student.id}
                onChange={(event) => void assignStudentTeam(student, event.target.value)}
                aria-label={`设置 ${student.nickname} 的小组`}
              >
                <option value="">未分组</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    第 {team.group_no} 组 · {team.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {!managedStudents.length && <p className="empty">先添加学生名单，再进行分组。</p>}
        </div>
      </div>
    </section>
  );
}

function submissionTeamId(item: TaskSubmission) {
  return item.team_id || asText(item.payload.team_id);
}

function submissionTeamName(item: TaskSubmission) {
  return item.team_name || asText(item.payload.team_name);
}

function submissionMatchesTeam(item: TaskSubmission, team: Team) {
  const itemTeamId = item.task_type === "product_feedback"
    ? asText(item.payload.team_id) || item.team_id || ""
    : submissionTeamId(item);
  const itemTeamName = item.task_type === "product_feedback"
    ? asText(item.payload.team_name) || item.team_name || ""
    : submissionTeamName(item);
  return itemTeamId === team.id || (!!itemTeamName && itemTeamName === team.name);
}

function taskUpdatedAt(item: TaskSubmission) {
  return item.updated_at || item.created_at || "";
}

function latestTask(items: TaskSubmission[]) {
  return [...items].sort((a, b) => taskUpdatedAt(b).localeCompare(taskUpdatedAt(a)))[0];
}

type ProgressMilestone = (typeof progressMilestones)[number];

function milestoneCount(teamSubmissions: TaskSubmission[], milestone: ProgressMilestone) {
  if (milestone.key === "product_link") {
    return teamSubmissions.filter((item) =>
      ["product_link", "final_showcase"].includes(item.task_type) && Boolean(asText(item.payload.access_url))
    ).length;
  }
  return teamSubmissions.filter((item) => item.task_type === milestone.key).length;
}

function showcaseStatusLabel(status?: string) {
  return showcaseStatusOptions.find((option) => option.value === status)?.label || "草稿";
}

function projectStatusLabel(status?: string) {
  return projectStatusOptions.find((option) => option.value === status)?.label || "未开始";
}

function nextSupportAction(
  milestoneStates: Array<ProgressMilestone & { count: number; done: boolean }>,
  activeBlockers: TaskSubmission[],
  team: Team
) {
  if (activeBlockers.length) {
    const blocker = activeBlockers[0];
    return `先去 ${team.table_no || team.group_no} 号桌看卡点：${asText(blocker.payload.where_stuck) || "请他们说清卡在哪里"}`;
  }
  const firstMissing = milestoneStates.find((milestone) => !milestone.done);
  if (!firstMissing) return "可以安排彩排或进入作品秀顺序。";
  if (firstMissing.key === "market_scout") return "先补一张侦察卡：AI 改写、用户声音、已有方案、继续验证。";
  if (firstMissing.key === "user_voice") return `还差 ${Math.max(0, firstMissing.target - firstMissing.count)} 条用户声音，先补真实采访。`;
  if (firstMissing.key === "product_feedback") return `还差 ${Math.max(0, firstMissing.target - firstMissing.count)} 条互测反馈，安排别组打开作品试用。`;
  if (firstMissing.key === "product_link") return "先确认作品链接能打开，再准备上台展示。";
  if (firstMissing.key === "final_showcase") return "请小组把最终展示卡补齐。";
  if (firstMissing.key === "product_definition") return "先把产品一句话写清楚：帮谁、解决什么、怎么解决。";
  if (firstMissing.key === "prompt_card") return "请小组补一张五句提示词卡：目标、用户、材料、限制、格式。";
  return "先补一张真实问题卡。";
}

function TeacherProgressBoard({ students }: { students: Student[] }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    try {
      const [teamResult, submissionResult] = await Promise.all([api.teams(), api.submissions()]);
      setTeams(teamResult.teams);
      setSubmissions(submissionResult.task_submissions);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "进度看板加载失败");
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const teamSummaries = useMemo(() => {
    return teams.map((team) => {
      const teamMembers = students.filter((student) => student.team_id === team.id || student.team_name === team.name);
      const teamSubmissions = submissions.filter((item) => submissionMatchesTeam(item, team));
      const milestoneStates = progressMilestones.map((milestone) => {
        const count = milestoneCount(teamSubmissions, milestone);
        return {
          ...milestone,
          count,
          done: count >= milestone.target,
          partial: count > 0 && count < milestone.target
        };
      });
      const done = milestoneStates.filter((milestone) => milestone.done);
      const blockers = teamSubmissions
        .filter((item) => item.task_type === "blocker_note")
        .sort((a, b) => taskUpdatedAt(b).localeCompare(taskUpdatedAt(a)));
      const activeBlockers = blockers.filter((item) => item.status !== "ON_WALL");
      const latest = latestTask(teamSubmissions.filter((item) => item.task_type !== "blocker_note"));
      const userVoiceCount = milestoneStates.find((item) => item.key === "user_voice")?.count ?? 0;
      const feedbackCount = milestoneStates.find((item) => item.key === "product_feedback")?.count ?? 0;
      const readyForDemo = done.some((item) => item.key === "product_link") || done.some((item) => item.key === "final_showcase");
      const allDone = milestoneStates.every((item) => item.done);
      const needsSupport = Boolean(activeBlockers.length || milestoneStates.some((item) => !item.done));
      return {
        team,
        members: teamMembers,
        submissions: teamSubmissions,
        milestoneStates,
        done,
        blockers,
        activeBlockers,
        latest,
        userVoiceCount,
        feedbackCount,
        readyForDemo,
        allDone,
        needsSupport,
        nextAction: nextSupportAction(milestoneStates, activeBlockers, team)
      };
    });
  }, [students, submissions, teams]);

  const totals = useMemo(() => {
    const activeBlockers = teamSummaries.reduce((total, item) => total + item.activeBlockers.length, 0);
    const readyTeams = teamSummaries.filter((item) => item.readyForDemo).length;
    const withScout = teamSummaries.filter((item) => item.done.some((milestone) => milestone.key === "market_scout")).length;
    const withProduct = teamSummaries.filter((item) => item.done.some((milestone) => milestone.key === "product_definition")).length;
    const withPrompt = teamSummaries.filter((item) => item.done.some((milestone) => milestone.key === "prompt_card")).length;
    const interviewReady = teamSummaries.filter((item) => item.userVoiceCount >= 3).length;
    const feedbackReady = teamSummaries.filter((item) => item.feedbackCount >= 2).length;
    const needsSupport = teamSummaries.filter((item) => item.needsSupport).length;
    return { activeBlockers, readyTeams, withScout, withProduct, withPrompt, interviewReady, feedbackReady, needsSupport };
  }, [teamSummaries]);

  const toggleBlocker = async (item: TaskSubmission) => {
    setWorkingId(item.id);
    setMessage("");
    try {
      await api.setTaskSubmissionStatus(item.id, item.status === "ON_WALL" ? "SUBMITTED" : "ON_WALL");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <section className="panel progress-board-panel">
      <div className="panel-title">
        <ClipboardCheck size={20} />
        <h2>团队进度看板</h2>
      </div>
      <div className="artifact-stats">
        <span>{teamSummaries.length} 个团队</span>
        <span>{totals.withScout} 组已有侦察卡</span>
        <span>{totals.interviewReady}/{teamSummaries.length} 组采访达标</span>
        <span>{totals.withProduct} 组已有产品一句话</span>
        <span>{totals.withPrompt} 组已有提示词卡</span>
        <span>{totals.readyTeams} 组已有作品入口</span>
        <span>{totals.feedbackReady} 组收到互测反馈</span>
        <span>{totals.needsSupport} 组需要跟进</span>
        <span>{totals.activeBlockers} 个卡点待支援</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="progress-board-grid">
        {teamSummaries.map((summary) => {
          const completion = `${summary.done.length}/${progressMilestones.length}`;
          const latestBlocker = summary.activeBlockers[0] || summary.blockers[0];
          const cardClass = summary.activeBlockers.length
            ? "progress-team-card needs-help"
            : summary.allDone
              ? "progress-team-card ready"
              : "progress-team-card watching";
          return (
            <article
              className={cardClass}
              key={summary.team.id}
            >
              <header>
                <div>
                  <span>{summary.team.table_no ? `${summary.team.table_no} 号桌` : `第 ${summary.team.group_no} 组`}</span>
                  <strong>{summary.team.name}</strong>
                  <small>{summary.members.length} 名学生 · 完成 {completion}</small>
                </div>
                <em>{summary.activeBlockers.length ? "需要支援" : summary.allDone ? "可彩排" : summary.readyForDemo ? "可演示" : "进行中"}</em>
              </header>
              <div className="progress-signal-grid">
                <span>
                  <b>{summary.userVoiceCount}/3</b>
                  用户声音
                </span>
                <span>
                  <b>{summary.feedbackCount}/2</b>
                  互测反馈
                </span>
                <span>
                  <b>{summary.readyForDemo ? "有" : "缺"}</b>
                  作品入口
                </span>
                <span>
                  <b>{showcaseStatusLabel(summary.team.showcase_status)}</b>
                  展示准备
                </span>
              </div>
              <div className="progress-milestones">
                {summary.milestoneStates.map((milestone) => {
                  return (
                    <span key={milestone.key} className={milestone.done ? "done" : milestone.partial ? "partial" : ""}>
                      {milestone.done && <CheckCircle2 size={13} />}
                      {milestone.label}
                      <small>{milestone.count}/{milestone.target}{milestone.unit}</small>
                    </span>
                  );
                })}
              </div>
              <div className="progress-card-foot">
                <p>
                  <b>现场阶段</b>
                  {projectStatusLabel(summary.team.project_status)} · {showcaseStatusLabel(summary.team.showcase_status)}
                </p>
                <p>
                  <b>最近进展</b>
                  {summary.latest ? `${summary.latest.student_name || "学生"}提交了${summary.latest.title}` : "还没有提交记录"}
                </p>
                <p className="next-support-action">
                  <b>下一步支援</b>
                  {summary.nextAction}
                </p>
                {latestBlocker ? (
                  <div className={latestBlocker.status === "ON_WALL" ? "blocker-note resolved" : "blocker-note"}>
                    <div>
                      <b>{latestBlocker.status === "ON_WALL" ? "已处理卡点" : "当前卡点"}</b>
                      <span>{asText(latestBlocker.payload.where_stuck) || "还没写清楚"}</span>
                      <small>{asText(latestBlocker.payload.help_needed) || "需要现场看一下"}</small>
                    </div>
                    <button disabled={workingId === latestBlocker.id} onClick={() => toggleBlocker(latestBlocker)}>
                      {latestBlocker.status === "ON_WALL" ? "重新打开" : "标为已处理"}
                    </button>
                  </div>
                ) : (
                  <p>
                    <b>当前卡点</b>
                    暂时没有记录
                  </p>
                )}
              </div>
            </article>
          );
        })}
        {!teamSummaries.length && <p className="empty">创建小组后，这里会出现团队进度。</p>}
      </div>
    </section>
  );
}

function TeacherD1Artifacts() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [voteSummaries, setVoteSummaries] = useState<ProblemVoteSummary[]>([]);
  const [voteCount, setVoteCount] = useState(0);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [startingVote, setStartingVote] = useState(false);

  const load = async () => {
    try {
      const [result, voteResult] = await Promise.all([api.submissions(), api.problemVotesManage()]);
      setItems(result.task_submissions.filter((item) => ["problem_card", "market_scout", "user_voice", "ai_validation"].includes(item.task_type)));
      setVoteSummaries(voteResult.summaries);
      setVoteCount(voteResult.votes.length);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载失败");
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const problemCount = items.filter((item) => item.task_type === "problem_card").length;
    const scoutCount = items.filter((item) => item.task_type === "market_scout").length;
    const voiceItems = items.filter((item) => item.task_type === "user_voice");
    const voiceCount = voiceItems.length;
    const validationCount = items.filter((item) => item.task_type === "ai_validation").length;
    const teamCount = new Set(items.map((item) => item.team_id || item.student_id || item.id)).size;
    const voiceByTeam = new Map<string, number>();
    voiceItems.forEach((item) => {
      const key = item.team_id || item.team_name || item.student_id || item.id;
      voiceByTeam.set(key, (voiceByTeam.get(key) || 0) + 1);
    });
    const interviewReadyCount = Array.from(voiceByTeam.values()).filter((count) => count >= 3).length;
    return { problemCount, scoutCount, voiceCount, validationCount, teamCount, interviewReadyCount };
  }, [items]);

  const toggleWall = async (item: TaskSubmission) => {
    setUpdatingId(item.id);
    setMessage("");
    try {
      await api.setTaskSubmissionStatus(item.id, item.status === "ON_WALL" ? "SUBMITTED" : "ON_WALL");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setUpdatingId("");
    }
  };

  const startProblemVote = async () => {
    setStartingVote(true);
    setMessage("");
    try {
      await api.setCurrentTask({
        module_id: "problem-wall",
        title: "烦人墙投票",
        activity_type: "problem_vote",
        payload: {
          task_type: "problem_vote",
          max_choices: 3,
          summary: "选出最想继续调查的问题"
        }
      });
      setMessage("投票已发到学生端。");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "投票发起失败");
    } finally {
      setStartingVote(false);
    }
  };

  return (
    <section className="panel d1-artifacts-panel">
      <div className="panel-title">
        <StickyNote size={20} />
        <h2>D1 问题、侦察、用户声音和 AI 验证</h2>
      </div>
      <div className="artifact-stats">
        <span>{stats.problemCount} 张问题卡</span>
        <span>{stats.scoutCount} 张侦察卡</span>
        <span>{stats.voiceCount} 条用户声音</span>
        <span>{stats.interviewReadyCount} 组采访达标</span>
        <span>{stats.validationCount} 张验证卡</span>
        <span>{stats.teamCount} 个来源</span>
        <span>{voteCount} 张投票</span>
      </div>
      <div className="d1-vote-toolbar">
        <button disabled={startingVote || !stats.problemCount} onClick={startProblemVote}>
          <CheckCircle2 size={16} />
          发起烦人墙投票
        </button>
        <span>学生最多选 3 张问题卡，系统按票数排序。</span>
      </div>
      <ProblemVoteLeaderboard summaries={voteSummaries} compact />
      {message && <p className="hint">{message}</p>}
      <div className="d1-artifact-list">
        {items.map((item) => {
          const isProblem = item.task_type === "problem_card";
          const isScout = item.task_type === "market_scout";
          const isValidation = item.task_type === "ai_validation";
          const title = isProblem
            ? asText(item.payload.problem_scene) || asText(item.payload.trouble) || "未命名问题"
            : isScout
            ? asText(item.payload.ai_rewrite) || asText(item.payload.original_problem) || "AI 市场侦察卡"
            : isValidation
            ? asText(item.payload.doubt) || asText(item.payload.revised_conclusion) || "AI 验证卡"
            : asText(item.payload.interviewee) || "用户声音";
          return (
            <article
              className={[
                "d1-artifact-card",
                isScout ? "scout" : "",
                isValidation ? "validation" : "",
                !isProblem && !isScout && !isValidation ? "voice" : "",
                item.status === "ON_WALL" ? "on-wall" : ""
              ].filter(Boolean).join(" ")}
              key={item.id}
            >
              <header>
                <div>
                  <span>{isProblem ? "问题卡" : isScout ? "侦察卡" : isValidation ? "验证卡" : "用户声音"}</span>
                  <strong>{title}</strong>
                  <small>{item.team_name || item.student_name || "学生提交"}</small>
                </div>
                <button disabled={updatingId === item.id} onClick={() => toggleWall(item)}>
                  {item.status === "ON_WALL" ? "从大屏移开" : "放到大屏"}
                </button>
              </header>
              {isProblem ? (
                <div className="artifact-lines">
                  <p><strong>用户：</strong>{asText(item.payload.target_user) || "还没写"}</p>
                  <p><strong>麻烦：</strong>{asText(item.payload.trouble) || "还没写"}</p>
                  <p><strong>现在办法：</strong>{asText(item.payload.current_solution) || "还没写"}</p>
                </div>
              ) : isScout ? (
                <div className="artifact-lines">
                  <p><strong>原问题：</strong>{asText(item.payload.original_problem) || "还没写"}</p>
                  <p><strong>AI 改写：</strong>{asText(item.payload.ai_rewrite) || "还没写"}</p>
                  <p><strong>用户声音：</strong>{asText(item.payload.user_clue) || "还没写"}</p>
                  <p><strong>已有方案：</strong>{asText(item.payload.existing_solution) || "还没写"}</p>
                  <p><strong>不同角度：</strong>{asText(item.payload.different_angle) || "还没写"}</p>
                  <p><strong>继续验证：</strong>{asText(item.payload.next_question) || "还没写"}</p>
                </div>
              ) : isValidation ? (
                <div className="artifact-lines">
                  <p><strong>AI 说：</strong>{asText(item.payload.ai_answer) || "还没写"}</p>
                  <p><strong>可疑句：</strong>{asText(item.payload.doubt) || "还没写"}</p>
                  <p><strong>证据：</strong>{asText(item.payload.evidence) || "还没写"}</p>
                  <p><strong>改后结论：</strong>{asText(item.payload.revised_conclusion) || "还没写"}</p>
                </div>
              ) : (
                <div className="artifact-lines">
                  <p><strong>遇到过吗：</strong>{asText(item.payload.has_problem) || "还没写"}</p>
                  <p><strong>多久一次：</strong>{asText(item.payload.frequency) || "还没写"}</p>
                  <p><strong>现在办法：</strong>{asText(item.payload.current_solution) || "还没写"}</p>
                  <p><strong>听到：</strong>{asText(item.payload.quote) || "还没写"}</p>
                  <p><strong>愿意试用吗：</strong>{asText(item.payload.willingness) || "还没写"}</p>
                  <p><strong>判断：</strong>{asText(item.payload.signal) || "还没写"}</p>
                  <p><strong>发现：</strong>{asText(item.payload.finding) || "还没写"}</p>
                </div>
              )}
            </article>
          );
        })}
        {!items.length && <p className="empty">学生提交问题卡、侦察卡、用户声音或验证卡后，会出现在这里。</p>}
      </div>
    </section>
  );
}

function ProblemVoteLeaderboard({
  summaries,
  compact = false
}: {
  summaries: ProblemVoteSummary[];
  compact?: boolean;
}) {
  const visible = summaries
    .filter((summary) => compact || summary.vote_count > 0)
    .slice(0, compact ? 5 : 6);
  if (!visible.length) return null;
  const maxVotes = Math.max(...visible.map((summary) => summary.vote_count), 1);
  return (
    <div className={compact ? "problem-vote-leaderboard compact" : "problem-vote-leaderboard"}>
      {visible.map((summary, index) => (
        <article className="problem-vote-rank" key={summary.problem_id}>
          <b>{index + 1}</b>
          <div>
            <span>{summary.team_name || summary.student_name || "问题卡"}</span>
            <strong>{summary.problem_scene}</strong>
            <small>{summary.target_user || "真实用户"} · {summary.trouble || "值得继续调查"}</small>
            <i style={{ width: `${Math.max(8, (summary.vote_count / maxVotes) * 100)}%` }} />
          </div>
          <em>{summary.vote_count} 票</em>
        </article>
      ))}
    </div>
  );
}

function TeacherProductDefinitions() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    try {
      const result = await api.submissions();
      setItems(result.task_submissions.filter((item) => item.task_type === "product_definition"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载失败");
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const groupedCount = useMemo(
    () => new Set(items.map((item) => item.team_id || item.student_id || item.id)).size,
    [items]
  );

  const toggleWall = async (item: TaskSubmission) => {
    setWorkingId(item.id);
    setMessage("");
    try {
      await api.setTaskSubmissionStatus(item.id, item.status === "ON_WALL" ? "SUBMITTED" : "ON_WALL");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setWorkingId("");
    }
  };

  const publishCard = async (item: TaskSubmission) => {
    const productName = asText(item.payload.product_name).trim();
    const oneLiner = asText(item.payload.one_liner).trim();
    const targetUser = asText(item.payload.target_user).trim();
    const coreProblem = asText(item.payload.core_problem).trim();
    if (!productName) {
      setMessage("这条提交缺少产品名。");
      return;
    }
    setWorkingId(item.id);
    setMessage("");
    try {
      await api.publishShowcase({
        id: `definition-${item.id}`,
        team_id: item.team_id || undefined,
        product_name: productName,
        track: item.team_name || item.student_name || targetUser || undefined,
        one_liner: oneLiner || (targetUser && coreProblem ? `${targetUser}：${coreProblem}` : undefined),
        publish_status: "PUBLISHED"
      });
      setMessage("已生成产品卡，并放进展示区。");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <section className="panel product-definition-panel">
      <div className="panel-title">
        <Target size={20} />
        <h2>D2 产品一句话</h2>
      </div>
      <div className="artifact-stats">
        <span>{items.length} 条产品定义</span>
        <span>{groupedCount} 个来源</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="d1-artifact-list">
        {items.map((item) => {
          const productName = asText(item.payload.product_name) || "未命名产品";
          const oneLiner = asText(item.payload.one_liner);
          return (
            <article className={item.status === "ON_WALL" ? "d1-artifact-card on-wall" : "d1-artifact-card"} key={item.id}>
              <header>
                <div>
                  <span>产品卡片</span>
                  <strong>{productName}</strong>
                  <small>{item.team_name || item.student_name || "学生提交"}</small>
                </div>
                <div className="artifact-actions">
                  <button disabled={workingId === item.id} onClick={() => toggleWall(item)}>
                    {item.status === "ON_WALL" ? "从大屏移开" : "放到大屏"}
                  </button>
                  <button disabled={workingId === item.id} onClick={() => publishCard(item)}>
                    生成产品卡
                  </button>
                </div>
              </header>
              <div className="artifact-lines">
                <p><strong>帮谁：</strong>{asText(item.payload.target_user) || "还没写"}</p>
                <p><strong>问题：</strong>{asText(item.payload.core_problem) || "还没写"}</p>
                <p><strong>办法：</strong>{asText(item.payload.solution) || "还没写"}</p>
                <p><strong>一句话：</strong>{oneLiner || "还没生成"}</p>
              </div>
            </article>
          );
        })}
        {!items.length && <p className="empty">学生提交产品一句话后，会出现在这里。</p>}
      </div>
    </section>
  );
}

function TeacherPromptCards() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    try {
      const result = await api.submissions();
      setItems(result.task_submissions.filter((item) => item.task_type === "prompt_card"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载失败");
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const groupedCount = useMemo(
    () => new Set(items.map((item) => item.team_id || item.student_id || item.id)).size,
    [items]
  );

  const toggleWall = async (item: TaskSubmission) => {
    setWorkingId(item.id);
    setMessage("");
    try {
      await api.setTaskSubmissionStatus(item.id, item.status === "ON_WALL" ? "SUBMITTED" : "ON_WALL");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <section className="panel prompt-card-panel">
      <div className="panel-title">
        <WandSparkles size={20} />
        <h2>D2 五句提示词卡</h2>
      </div>
      <div className="artifact-stats">
        <span>{items.length} 张提示词卡</span>
        <span>{groupedCount} 个来源</span>
        <span>{items.filter((item) => item.status === "ON_WALL").length} 张已上屏</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="d1-artifact-list">
        {items.map((item) => {
          const goal = asText(item.payload.goal) || "还没写目标";
          return (
            <article
              className={[
                "d1-artifact-card",
                "prompt",
                item.status === "ON_WALL" ? "on-wall" : ""
              ].filter(Boolean).join(" ")}
              key={item.id}
            >
              <header>
                <div>
                  <span>提示词卡</span>
                  <strong>{goal}</strong>
                  <small>{item.team_name || item.student_name || "学生提交"}</small>
                </div>
                <button disabled={workingId === item.id} onClick={() => toggleWall(item)}>
                  {item.status === "ON_WALL" ? "从大屏移开" : "放到大屏"}
                </button>
              </header>
              <div className="artifact-lines">
                <p><strong>用户：</strong>{asText(item.payload.target_user) || "还没写"}</p>
                <p><strong>材料：</strong>{asText(item.payload.materials) || "还没写"}</p>
                <p><strong>限制：</strong>{asText(item.payload.constraints) || "还没写"}</p>
                <p><strong>格式：</strong>{asText(item.payload.output_format) || "还没写"}</p>
                <p><strong>再改一句：</strong>{asText(item.payload.revision_request) || "还没写"}</p>
              </div>
            </article>
          );
        })}
        {!items.length && <p className="empty">学生提交五句提示词卡后，会出现在这里。</p>}
      </div>
    </section>
  );
}

function TeacherProjectSubmissions() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const result = await api.submissions();
      setItems(result.task_submissions.filter((item) => item.task_type === "product_link"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载失败");
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const publish = async (item: TaskSubmission) => {
    const productName = asText(item.payload.product_name).trim();
    const oneLiner = asText(item.payload.one_liner).trim();
    const accessUrl = asText(item.payload.access_url).trim();
    if (!productName || !accessUrl) {
      setMessage("这条提交缺少作品名或链接。");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await api.publishShowcase({
        id: `submission-${item.id}`,
        team_id: item.team_id || undefined,
        product_name: productName,
        track: item.team_name || item.student_name || undefined,
        one_liner: oneLiner || undefined,
        access_url: normalizeShowcaseUrl(accessUrl),
        publish_status: "PUBLISHED"
      });
      setMessage("已放进展示区。");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel project-submissions-panel">
      <div className="panel-title">
        <ExternalLink size={20} />
        <h2>学生提交的作品链接</h2>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="project-submission-list">
        {items.map((item) => {
          const productName = asText(item.payload.product_name);
          const oneLiner = asText(item.payload.one_liner);
          const accessUrl = asText(item.payload.access_url);
          return (
            <article className="project-submission-row" key={item.id}>
              <div>
                <span>{item.team_name || item.student_name || "未分组"}</span>
                <strong>{productName || "未命名作品"}</strong>
                <p>{oneLiner || "还没有一句话介绍。"}</p>
                {accessUrl && (
                  <a href={normalizeShowcaseUrl(accessUrl)} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    打开作品
                  </a>
                )}
              </div>
              <button disabled={loading || !accessUrl} onClick={() => publish(item)}>
                放进展示区
              </button>
            </article>
          );
        })}
        {!items.length && <p className="empty">学生提交作品链接后，会出现在这里。</p>}
      </div>
    </section>
  );
}

function TeacherPeerFeedback() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    try {
      const result = await api.submissions();
      setItems(result.task_submissions.filter((item) => item.task_type === "product_feedback"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载失败");
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, TaskSubmission[]>();
    for (const item of items) {
      const key = asText(item.payload.showcase_item_id) || asText(item.payload.product_name) || item.id;
      map.set(key, [...(map.get(key) || []), item]);
    }
    return Array.from(map.values());
  }, [items]);

  const toggleJourney = async (item: TaskSubmission) => {
    setWorkingId(item.id);
    setMessage("");
    try {
      await api.setTaskSubmissionStatus(item.id, item.status === "ON_WALL" ? "SUBMITTED" : "ON_WALL");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <section className="panel feedback-summary-panel">
      <div className="panel-title">
        <MessageSquareText size={20} />
        <h2>同伴试用反馈</h2>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="feedback-summary-list">
        {groups.map((group) => {
          const first = group[0];
          const productName = asText(first.payload.product_name) || "未命名作品";
          const teamName = asText(first.payload.team_name) || "作品";
          const accessUrl = asText(first.payload.access_url);
          return (
            <article className="feedback-summary-card" key={asText(first.payload.showcase_item_id) || first.id}>
              <header>
                <div>
                  <span>{teamName}</span>
                  <strong>{productName}</strong>
                  <small>{group.length} 条反馈</small>
                </div>
                {accessUrl && (
                  <a href={normalizeShowcaseUrl(accessUrl)} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    打开作品
                  </a>
                )}
              </header>
              <div className="feedback-summary-notes">
                {group.map((item) => (
                  <div key={item.id} className={item.status === "ON_WALL" ? "feedback-note on-wall" : "feedback-note"}>
                    <div>
                      <span>{item.student_name || "学生"}</span>
                      <p><strong>有用：</strong>{asText(item.payload.most_useful) || "未填写"}</p>
                      <p><strong>建议：</strong>{asText(item.payload.suggestion) || "未填写"}</p>
                    </div>
                    <button disabled={workingId === item.id} onClick={() => toggleJourney(item)}>
                      {item.status === "ON_WALL" ? "从项目页移开" : "放到项目页"}
                    </button>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
        {!groups.length && <p className="empty">学生试玩后提交的反馈会出现在这里。</p>}
      </div>
    </section>
  );
}

function TeacherFinalShowcase() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const result = await api.submissions();
      const nextItems = sortByDisplayOrder(result.task_submissions.filter((item) => item.task_type === "final_showcase"));
      setItems(nextItems);
      setOrderDrafts((current) => {
        const next = { ...current };
        nextItems.forEach((item, index) => {
          if (!next[item.id]) next[item.id] = String(displayOrderFor(item) === 9999 ? index + 1 : displayOrderFor(item));
        });
        return next;
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载失败");
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const saveDisplay = async (item: TaskSubmission, status: "SUBMITTED" | "ON_WALL") => {
    const order = Math.max(1, Math.round(Number(orderDrafts[item.id]) || displayOrderFor(item) || items.length));
    setWorkingId(item.id);
    setMessage("");
    try {
      await api.setTaskSubmissionStatus(item.id, status, order);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setWorkingId("");
    }
  };

  const publishCard = async (item: TaskSubmission) => {
    const productName = asText(item.payload.product_name).trim();
    const valueLine = asText(item.payload.value_line).trim();
    const accessUrl = asText(item.payload.access_url).trim();
    if (!productName || !accessUrl) {
      setMessage("这张展示卡缺少产品名称或作品链接。");
      return;
    }
    setWorkingId(item.id);
    setMessage("");
    try {
      await api.publishShowcase({
        id: `final-${item.id}`,
        team_id: item.team_id || undefined,
        product_name: productName,
        track: item.team_name || item.student_name || undefined,
        one_liner: valueLine || undefined,
        access_url: normalizeShowcaseUrl(accessUrl),
        publish_status: "PUBLISHED"
      });
      setMessage("已生成公开作品卡。");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <section className="panel final-showcase-panel">
      <div className="panel-title">
        <Trophy size={20} />
        <h2>D3 路演与作品展</h2>
      </div>
      <div className="artifact-stats">
        <span>{items.length} 张展示卡</span>
        <span>{items.filter((item) => item.status === "ON_WALL").length} 张上屏</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="d1-artifact-list">
        {items.map((item, index) => {
          const productName = asText(item.payload.product_name) || "未命名作品";
          const accessUrl = asText(item.payload.access_url);
          return (
            <article className={item.status === "ON_WALL" ? "d1-artifact-card on-wall" : "d1-artifact-card"} key={item.id}>
              <header>
                <div>
                  <span>最终展示卡</span>
                  <strong>{productName}</strong>
                  <small>{item.team_name || item.student_name || "学生提交"}</small>
                </div>
                <div className="artifact-actions final-showcase-actions">
                  <label>
                    顺序
                    <input
                      value={orderDrafts[item.id] ?? String(index + 1)}
                      onChange={(event) => setOrderDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                      inputMode="numeric"
                    />
                  </label>
                  <button disabled={workingId === item.id} onClick={() => saveDisplay(item, "ON_WALL")}>
                    保存并上屏
                  </button>
                  <button disabled={workingId === item.id} onClick={() => saveDisplay(item, "SUBMITTED")}>
                    从大屏移开
                  </button>
                  <button disabled={workingId === item.id || !accessUrl} onClick={() => publishCard(item)}>
                    生成公开作品卡
                  </button>
                </div>
              </header>
              <div className="artifact-lines">
                <p><strong>成员：</strong>{asText(item.payload.team_members) || "还没写"}</p>
                <p><strong>贡献：</strong>{asText(item.payload.personal_contributions) || "还没写"}</p>
                <p><strong>用户：</strong>{asText(item.payload.target_user) || "还没写"}</p>
                <p><strong>问题：</strong>{asText(item.payload.core_problem) || "还没写"}</p>
                <p><strong>价值：</strong>{asText(item.payload.value_line) || "还没写"}</p>
                {accessUrl && (
                  <p>
                    <strong>链接：</strong>
                    <a href={normalizeShowcaseUrl(accessUrl)} target="_blank" rel="noreferrer">打开作品</a>
                  </p>
                )}
              </div>
            </article>
          );
        })}
        {!items.length && <p className="empty">学生提交最终展示卡后，会出现在这里。</p>}
      </div>
    </section>
  );
}

function TeacherGrowthReflections() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    try {
      const result = await api.submissions();
      setItems(result.task_submissions.filter((item) => item.task_type === "growth_reflection"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载失败");
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const toggleDisplay = async (item: TaskSubmission) => {
    setWorkingId(item.id);
    setMessage("");
    try {
      await api.setTaskSubmissionStatus(item.id, item.status === "ON_WALL" ? "SUBMITTED" : "ON_WALL");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <section className="panel growth-manage-panel">
      <div className="panel-title">
        <Brain size={20} />
        <h2>个人成长卡</h2>
      </div>
      <div className="artifact-stats">
        <span>{items.length} 张已提交</span>
        <span>{items.filter((item) => item.status === "ON_WALL").length} 张在成果页</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="d1-artifact-list growth-manage-list">
        {items.map((item) => {
          const ability = asText(item.payload.ability_tag) || "能力标签";
          return (
            <article className={item.status === "ON_WALL" ? "d1-artifact-card on-wall" : "d1-artifact-card"} key={item.id}>
              <header>
                <div>
                  <span>{ability}</span>
                  <strong>{item.student_name || "学生"}</strong>
                  <small>{item.team_name || asText(item.payload.team_name) || "项目团队"}</small>
                </div>
                <div className="artifact-actions">
                  <button disabled={workingId === item.id} onClick={() => toggleDisplay(item)}>
                    {item.status === "ON_WALL" ? "从成果页移开" : "放到成果页"}
                  </button>
                </div>
              </header>
              <div className="artifact-lines">
                <p><strong>AI 帮的一步：</strong>{asText(item.payload.ai_job) || "还没写"}</p>
                <p><strong>孩子的判断：</strong>{asText(item.payload.human_decision) || "还没写"}</p>
                <p><strong>证据：</strong>{asText(item.payload.evidence) || "还没写"}</p>
                <p><strong>下一次想练：</strong>{asText(item.payload.next_practice) || "还没写"}</p>
              </div>
            </article>
          );
        })}
        {!items.length && <p className="empty">学生写下成长卡后，会出现在这里。</p>}
      </div>
    </section>
  );
}

const awardTemplates: Array<{
  id: string;
  awardType: string;
  label: string;
  dimension?: ScoreDimension;
  reason: (summary: ScoreSummary) => string;
}> = [
  {
    id: "user-realness",
    awardType: "最懂用户奖",
    label: "共情力",
    dimension: "user_realness",
    reason: (summary) => `能力标签：共情力。观察员看见了：${summary.highlights[0] || "他们能从真实用户的问题出发。"}`
  },
  {
    id: "mvp-completion",
    awardType: "原型完成奖",
    label: "创造力",
    dimension: "mvp_completion",
    reason: (summary) => `能力标签：创造力。作品已经能让别人完成一个真实动作，平均 ${summary.scores.mvp_completion || "-"} 星。`
  },
  {
    id: "ai-collaboration",
    awardType: "AI 协作奖",
    label: "判断力",
    dimension: "ai_collaboration",
    reason: (summary) => `能力标签：判断力。团队把 AI 用在关键步骤上，也能继续判断结果。`
  },
  {
    id: "story-expression",
    awardType: "故事表达奖",
    label: "表达力",
    dimension: "story_expression",
    reason: (summary) => `能力标签：表达力。大家能听懂用户是谁、遇到什么问题、作品怎么帮忙。`
  },
  {
    id: "next-version",
    awardType: "下一版最期待奖",
    label: "领导力",
    reason: (summary) => `能力标签：领导力。下一步建议：${summary.next_steps[0] || "继续邀请用户试用，再改出下一版。"}`
  }
];

function topScoreSummary(summaries: ScoreSummary[], dimension?: ScoreDimension) {
  return [...summaries].sort((a, b) => {
    const aScore = dimension ? a.scores[dimension] : a.average_total;
    const bScore = dimension ? b.scores[dimension] : b.average_total;
    if (bScore !== aScore) return bScore - aScore;
    return b.score_count - a.score_count;
  })[0];
}

function TeacherScoringCenter() {
  const [summaries, setSummaries] = useState<ScoreSummary[]>([]);
  const [awards, setAwards] = useState<AwardResult[]>([]);
  const [observerAccess, setObserverAccess] = useState<{ code: string; path: string } | null>(null);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const load = async () => {
    try {
      const [scoreResult, awardResult, observerResult] = await Promise.all([
        api.scoreSummary(),
        api.manageAwards(),
        api.observerScoreAccess()
      ]);
      setSummaries(scoreResult.score_summaries);
      setSubmissionCount(scoreResult.score_submissions.length);
      setAwards(awardResult.award_results);
      setObserverAccess(observerResult);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载失败");
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const saveAward = async (template: (typeof awardTemplates)[number], summary: ScoreSummary, publishStatus = "PUBLISHED") => {
    await api.saveAward({
      id: `award-${template.id}`,
      award_type: template.awardType,
      winner_type: "team",
      winner_id: summary.team_id || summary.showcase_item_id || summary.key,
      winner_name: summary.team_name ? `${summary.team_name} · ${summary.product_name}` : summary.product_name,
      reason: template.reason(summary),
      publish_status: publishStatus
    });
  };

  const generateAwards = async () => {
    if (!summaries.length) {
      setMessage("还没有观察员评分。");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      for (const template of awardTemplates) {
        const summary = topScoreSummary(summaries, template.dimension);
        if (summary) await saveAward(template, summary);
      }
      setMessage("奖项建议已生成，并放到成果页。");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "生成奖项失败");
    } finally {
      setWorking(false);
    }
  };

  const toggleAward = async (award: AwardResult) => {
    setWorking(true);
    setMessage("");
    try {
      await api.saveAward({
        ...award,
        publish_status: award.publish_status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"
      });
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="panel scoring-panel">
      <div className="panel-title">
        <Star size={20} />
        <h2>评分中心与奖项</h2>
      </div>
      <div className="artifact-stats">
        <span>{submissionCount} 张观察员评分卡</span>
        <span>{summaries.length} 个作品有评分</span>
        <span>{awards.filter((award) => award.publish_status === "PUBLISHED").length} 个奖项已发布</span>
      </div>
      <div className="scoring-actions">
        <button disabled={working || !summaries.length} onClick={generateAwards}>
          <Trophy size={16} />
          生成奖项建议
        </button>
      </div>
      {observerAccess && (
        <div className="observer-link-box">
          <div>
            <span>家长评分链接</span>
            <strong>观察码：{observerAccess.code}</strong>
          </div>
          <input
            readOnly
            value={`${window.location.origin}${observerAccess.path}`}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="家长评分链接"
          />
          <a href={observerAccess.path} target="_blank" rel="noreferrer">打开评分页</a>
        </div>
      )}
      {message && <p className="hint">{message}</p>}
      <div className="score-summary-list">
        {summaries.map((summary) => (
          <article className="score-summary-row" key={summary.key}>
            <header>
              <div>
                <span>{summary.team_name || "项目团队"}</span>
                <strong>{summary.product_name}</strong>
                <small>{summary.score_count} 张评分卡 · 平均 {summary.average_total || "-"} 星</small>
              </div>
              <ScoreStars value={summary.average_total} />
            </header>
            <div className="score-pills">
              {scoreDimensionLabels.map((dimension) => (
                <span key={dimension.key}>{dimension.label} {summary.scores[dimension.key] || "-"}</span>
              ))}
            </div>
            <div className="artifact-lines">
              <p><strong>亮点：</strong>{summary.highlights[0] || "还没有亮点记录"}</p>
              <p><strong>下一步：</strong>{summary.next_steps[0] || "还没有下一步建议"}</p>
            </div>
          </article>
        ))}
        {!summaries.length && <p className="empty">观察员提交评分卡后，会出现在这里。</p>}
      </div>
      <div className="award-manage-list">
        {awards.map((award) => (
          <article className="award-manage-row" key={award.id}>
            <div>
              <span className={award.publish_status === "PUBLISHED" ? "showcase-status live" : "showcase-status draft"}>
                {award.publish_status === "PUBLISHED" ? "成果页展示" : "草稿"}
              </span>
              <strong>{award.award_type} · {award.winner_name}</strong>
              <small>{award.reason || "还没有写获奖理由。"}</small>
            </div>
            <button disabled={working} onClick={() => toggleAward(award)}>
              {award.publish_status === "PUBLISHED" ? "撤回草稿" : "放到成果页"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

type MentorDraft = {
  mentor_name: string;
  comment: string;
  next_step: string;
  status: "SUBMITTED" | "ON_WALL";
};

function mentorCommentForShowcase(comments: TaskSubmission[], item: ShowcaseItem) {
  const itemTeamName = item.team_name || item.track || "";
  return (
    comments.find((comment) => {
      const payloadShowcaseId = asText(comment.payload.showcase_item_id);
      const payloadTeamId = asText(comment.payload.team_id);
      const payloadTeamName = asText(comment.payload.team_name);
      const payloadProductName = asText(comment.payload.product_name);
      return (
        payloadShowcaseId === item.id ||
        comment.id === `mentor-${item.id}` ||
        (!!item.team_id && (comment.team_id === item.team_id || payloadTeamId === item.team_id)) ||
        (!!itemTeamName && (comment.team_name === itemTeamName || payloadTeamName === itemTeamName)) ||
        (!!item.product_name && payloadProductName === item.product_name)
      );
    }) || null
  );
}

function draftFromMentorComment(comment?: TaskSubmission | null): MentorDraft {
  return {
    mentor_name: asText(comment?.payload?.mentor_name) || "主讲老师",
    comment: asText(comment?.payload?.comment),
    next_step: asText(comment?.payload?.next_step),
    status: comment?.status === "ON_WALL" ? "ON_WALL" : "SUBMITTED"
  };
}

function TeacherMentorComments() {
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [comments, setComments] = useState<TaskSubmission[]>([]);
  const [drafts, setDrafts] = useState<Record<string, MentorDraft>>({});
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    try {
      const [showcaseResult, commentResult] = await Promise.all([api.manageShowcase(), api.mentorComments()]);
      const nextShowcaseItems = [...showcaseResult.showcase_items].sort((a, b) =>
        String(a.product_name || "").localeCompare(String(b.product_name || ""), "zh-Hans-CN")
      );
      setShowcaseItems(nextShowcaseItems);
      setComments(commentResult.mentor_comments);
      setDrafts((current) => {
        const next = { ...current };
        nextShowcaseItems.forEach((item) => {
          const currentDraft = next[item.id];
          if (currentDraft?.comment || currentDraft?.next_step) return;
          next[item.id] = draftFromMentorComment(mentorCommentForShowcase(commentResult.mentor_comments, item));
        });
        return next;
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载失败");
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 6000);
    return () => window.clearInterval(timer);
  }, []);

  const updateDraft = (itemId: string, patch: Partial<MentorDraft>) => {
    const fallbackDraft: MentorDraft = {
      mentor_name: "主讲老师",
      comment: "",
      next_step: "",
      status: "SUBMITTED"
    };
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] || fallbackDraft),
        ...patch
      }
    }));
  };

  const saveComment = async (item: ShowcaseItem) => {
    const existing = mentorCommentForShowcase(comments, item);
    const draft = drafts[item.id] || draftFromMentorComment(existing);
    const comment = draft.comment.trim();
    if (!comment) {
      setMessage("先写一段导师点评。");
      return;
    }
    setWorkingId(item.id);
    setMessage("");
    try {
      await api.saveMentorComment({
        id: existing?.id || `mentor-${item.id}`,
        showcase_item_id: item.id,
        product_name: item.product_name,
        team_id: item.team_id || null,
        team_name: item.team_name || item.track || null,
        access_url: item.access_url || null,
        mentor_name: draft.mentor_name.trim() || "主讲老师",
        comment,
        next_step: draft.next_step.trim(),
        status: draft.status
      });
      setMessage(draft.status === "ON_WALL" ? "点评已放到成果页。" : "点评已保存为草稿。");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <section className="panel mentor-comments-panel">
      <div className="panel-title">
        <MessageSquareText size={20} />
        <h2>导师点评</h2>
      </div>
      <div className="artifact-stats">
        <span>{showcaseItems.length} 张作品卡</span>
        <span>{comments.filter((comment) => comment.status === "ON_WALL").length} 条在成果页</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="mentor-comment-manage-list">
        {showcaseItems.map((item) => {
          const existing = mentorCommentForShowcase(comments, item);
          const draft = drafts[item.id] || draftFromMentorComment(existing);
          const teamName = item.team_name || item.track || "项目团队";
          return (
            <article className="mentor-comment-manage-row" key={item.id}>
              <header>
                <div>
                  <span className={draft.status === "ON_WALL" ? "showcase-status live" : "showcase-status draft"}>
                    {draft.status === "ON_WALL" ? "成果页展示" : "草稿"}
                  </span>
                  <strong>{item.product_name}</strong>
                  <small>{teamName}</small>
                </div>
                {item.access_url && (
                  <a href={normalizeShowcaseUrl(item.access_url)} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    打开作品
                  </a>
                )}
              </header>
              <div className="mentor-comment-form">
                <label>
                  点评人
                  <input
                    value={draft.mentor_name}
                    onChange={(event) => updateDraft(item.id, { mentor_name: event.target.value })}
                  />
                </label>
                <label>
                  显示状态
                  <select
                    value={draft.status}
                    onChange={(event) => updateDraft(item.id, { status: event.target.value === "ON_WALL" ? "ON_WALL" : "SUBMITTED" })}
                  >
                    <option value="SUBMITTED">先保存草稿</option>
                    <option value="ON_WALL">放到成果页</option>
                  </select>
                </label>
                <label className="mentor-comment-wide">
                  作品亮点
                  <textarea
                    value={draft.comment}
                    onChange={(event) => updateDraft(item.id, { comment: event.target.value })}
                    placeholder="例如：你们把用户问题讲清楚了，作品也能让别人完成一个真实动作。"
                    rows={3}
                  />
                </label>
                <label className="mentor-comment-wide">
                  下一版建议
                  <textarea
                    value={draft.next_step}
                    onChange={(event) => updateDraft(item.id, { next_step: event.target.value })}
                    placeholder="例如：下一版可以补一张用户试用截图，让别人更快看懂效果。"
                    rows={2}
                  />
                </label>
              </div>
              <div className="mentor-comment-actions">
                <button disabled={workingId === item.id} onClick={() => saveComment(item)}>
                  保存点评
                </button>
              </div>
            </article>
          );
        })}
        {!showcaseItems.length && <p className="empty">作品卡生成后，就可以在这里写导师点评。</p>}
      </div>
    </section>
  );
}

function LessonActionIcon({ action }: { action: string }) {
  if (action.includes("计时")) return <Clock3 size={16} />;
  if (action.includes("投屏") || action.includes("看板")) return <Monitor size={16} />;
  if (action.includes("评分")) return <Trophy size={16} />;
  if (action.includes("互动")) return <Sparkles size={16} />;
  if (action.includes("演示")) return <Maximize2 size={16} />;
  return <Play size={16} />;
}

function TeacherLessonControls({
  module,
  page,
  timerSeconds,
  onPublishPage,
  onAction
}: {
  module: CourseModule;
  page: DesignedLessonPage;
  timerSeconds: number;
  onPublishPage: () => void;
  onAction: (action: string) => void | Promise<void>;
}) {
  const quickActions = Array.from(new Set(page.activity_buttons.filter((action) => action !== "发布任务")));
  const timerLabel = timerSeconds ? formatTimer(timerSeconds) : `${timerMinutesForPage(page)} 分钟`;

  return (
    <section className="lesson-operator" aria-label="教师授课操作">
      <article className="operator-card">
        <small>这一页做什么</small>
        <strong>{teacherMoveForPage(page)}</strong>
        <span>{module.time_range || `D${module.day}`} · 第 {page.page_no} 页</span>
      </article>
      <article className="operator-card">
        <small>下课前看到什么</small>
        <strong>{expectedOutputForPage(page)}</strong>
        <span>{page.content_summary || module.subtitle}</span>
      </article>
      <article className={timerSeconds ? "operator-card operator-timer running" : "operator-card operator-timer"}>
        <small>建议计时</small>
        <strong>{timerLabel}</strong>
        <span>{timerSeconds ? "正在计时" : "按这一页估算"}</span>
      </article>
      <div className="operator-actions">
        <button className="primary" onClick={onPublishPage}>
          <Play size={16} />
          发本页任务
        </button>
        {quickActions.map((action) => (
          <button key={action} className="operator-action" onClick={() => onAction(action)}>
            <LessonActionIcon action={action} />
            {action}
          </button>
        ))}
      </div>
    </section>
  );
}

function TeacherLogin({
  camp,
  onLoggedIn
}: {
  camp: Camp | null;
  onLoggedIn: (teacher: TeacherAccount) => void;
}) {
  const [username, setUsername] = useState("teacher");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const showLocalLoginHelper = import.meta.env.DEV && API_BASE === "/api";

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.login(username.trim(), password.trim());
      setTeacherToken(result.token, result.teacher);
      onLoggedIn(result.teacher);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="teacher-login-page">
      <form className="teacher-login-card" onSubmit={login}>
        <span className="eyebrow">{camp?.location || "北京顺义站"}</span>
        <h1>教师端</h1>
        <label>
          教师账号
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="请输入教师账号"
            autoComplete="username"
          />
        </label>
        <label>
          密码
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入密码"
            type="password"
            autoComplete="current-password"
          />
        </label>
        {showLocalLoginHelper && (
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setUsername("teacher");
              setPassword("change-me-before-class");
              setError("");
            }}
          >
            填入本地测试账号
          </button>
        )}
        <button className="primary" disabled={loading} type="submit">
          {loading ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}
          进入教师端
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}

function TeacherHeader({
  camp,
  students,
  teacher,
  onLogout
}: {
  camp: Camp | null;
  students: Student[];
  teacher: TeacherAccount | null;
  onLogout: () => void;
}) {
  const counts = {
    total: students.length,
    waiting: students.filter((student) => student.display_status === "WAITING").length,
    review: students.filter((student) => student.display_status === "AWAITING_REVIEW").length,
    wall: students.filter((student) => student.display_status === "ON_WALL").length
  };
  return (
    <header className="teacher-header">
      <div>
        <span className="eyebrow">当前营期</span>
        <h2>{camp?.location || "北京顺义站"}</h2>
      </div>
      <div className="header-side">
        <div className="metrics">
          <Metric label="已录入" value={counts.total} />
          <Metric label="等待提交" value={counts.waiting} />
          <Metric label="待审核" value={counts.review} />
          <Metric label="已上墙" value={counts.wall} />
        </div>
        <div className="header-actions">
          <span className="teacher-badge">{teacher?.display_name || teacher?.username || "教师"}</span>
          <a className="icon-link" href="/wall" target="_blank" rel="noreferrer">
            <Monitor size={18} />
            大屏
          </a>
          <button className="icon-link" onClick={onLogout}>
            <LogOut size={18} />
            退出
          </button>
        </div>
      </div>
    </header>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function TeacherStudents({ students, refresh }: { students: Student[]; refresh: () => Promise<void> }) {
  const [managedStudents, setManagedStudents] = useState<Student[]>([]);
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const visibleStudents = managedStudents.length ? managedStudents : students;

  const loadStudents = async () => {
    try {
      const result = await api.students();
      setManagedStudents(result.students);
    } catch {
      setManagedStudents([]);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const addStudent = async () => {
    if (!nickname.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await api.saveStudents({
        id: `student-${Date.now()}`,
        student_no: String(visibleStudents.length + 1).padStart(2, "0"),
        nickname: nickname.trim(),
        age: age ? Number(age) : undefined,
        photo_authorization: "SELF_PHOTO",
        projection_consent: true,
        public_showcase_consent: false
      });
      const created = result.students[0];
      setNickname("");
      setAge("");
      setMessage(
        created?.username
          ? `名单已加入，照片墙会先显示名字。学生账号：${created.username}`
          : "名单已加入，照片墙会先显示名字。"
      );
      await Promise.all([loadStudents(), refresh()]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "添加失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = async (student: Student) => {
    const confirmed = window.confirm(`确定从本次营期名单中删除「${student.nickname}」吗？`);
    if (!confirmed) return;
    setDeletingId(student.id);
    setMessage("");
    try {
      await api.deleteStudent(student.id);
      setMessage(`已删除 ${student.nickname}。`);
      await Promise.all([loadStudents(), refresh()]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <UsersRound size={20} />
        <h2>学生名单</h2>
      </div>
      <div className="student-form">
        <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="昵称" />
        <input value={age} onChange={(event) => setAge(event.target.value)} placeholder="年龄" inputMode="numeric" />
        <button disabled={saving} onClick={addStudent}>{saving ? "保存中" : "添加"}</button>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="student-table">
        {visibleStudents.map((student) => (
          <div key={student.id} className="student-row">
            <span>{student.student_no || "--"}</span>
            <strong>
              {student.nickname}
              {student.username && <small>账号 {student.username}</small>}
            </strong>
            <small>{statusText[student.display_status]}</small>
            <button
              className="danger-icon"
              disabled={deletingId === student.id}
              onClick={() => deleteStudent(student)}
              aria-label={`删除${student.nickname}`}
            >
              {deletingId === student.id ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
            </button>
          </div>
        ))}
        {!visibleStudents.length && <p className="empty">先加学员，照片墙会先出现他们的名字。</p>}
      </div>
    </section>
  );
}

function normalizeShowcaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `https://${trimmed}`;
}

function ShowcaseGallery({ items, variant = "panel" }: { items: ShowcaseItem[]; variant?: "panel" | "wall" }) {
  const visibleItems = items.filter((item) => item.publish_status === "PUBLISHED" || variant === "panel");
  const isWall = variant === "wall";
  return (
    <div className={`showcase-gallery ${variant}`}>
      {visibleItems.map((item) => {
        const href = item.access_url ? normalizeShowcaseUrl(item.access_url) : "";
        const card = (
          <article className="showcase-card">
            <div className="showcase-shot">
              {item.screenshot_url ? (
                <img src={item.screenshot_url} alt={item.product_name} />
              ) : (
                <Package size={34} />
              )}
            </div>
            <div>
              <span>{item.track || item.team_name || "作品卡"}</span>
              <strong>{item.product_name}</strong>
              <p>{item.one_liner || "点开看看它怎么帮到用户。"}</p>
            </div>
            <footer>
              <small>{isWall ? item.team_name || item.track || "作品入口" : item.publish_status === "PUBLISHED" ? "展示中" : "草稿"}</small>
              {href && (
                <span>
                  <ExternalLink size={16} />
                  打开作品
                </span>
              )}
            </footer>
          </article>
        );
        return href ? (
          <a key={item.id} className="showcase-link" href={href} target="_blank" rel="noreferrer">
            {card}
          </a>
        ) : (
          <div key={item.id} className="showcase-link">
            {card}
          </div>
        );
      })}
      {!visibleItems.length && (
        <article className="showcase-empty">
          <Package size={34} />
          <strong>作品卡会出现在这里</strong>
          <span>作品准备好后，会变成可以点开的卡片。</span>
        </article>
      )}
    </div>
  );
}

function TeacherShowcase() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [editingId, setEditingId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [productName, setProductName] = useState("");
  const [track, setTrack] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [accessUrl, setAccessUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [showcaseResult, teamResult] = await Promise.all([api.manageShowcase(), api.teams()]);
      setItems(showcaseResult.showcase_items);
      setTeams(teamResult.teams);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId("");
    setTeamId("");
    setProductName("");
    setTrack("");
    setOneLiner("");
    setAccessUrl("");
  };

  const editItem = (item: ShowcaseItem) => {
    setEditingId(item.id);
    setTeamId(item.team_id || "");
    setProductName(item.product_name || "");
    setTrack(item.track || "");
    setOneLiner(item.one_liner || "");
    setAccessUrl(item.access_url || "");
    setMessage("正在编辑这张作品卡。");
  };

  const save = async (publishStatus: "DRAFT" | "PUBLISHED") => {
    if (!productName.trim()) {
      setMessage("先写作品名。");
      return;
    }
    if (publishStatus === "PUBLISHED" && !accessUrl.trim()) {
      setMessage("要放进展示区，先填一个能打开的作品链接。");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await api.publishShowcase({
        id: editingId || undefined,
        team_id: teamId || undefined,
        product_name: productName.trim(),
        track: track.trim() || undefined,
        one_liner: oneLiner.trim() || undefined,
        access_url: normalizeShowcaseUrl(accessUrl),
        publish_status: publishStatus
      });
      resetForm();
      setMessage(publishStatus === "PUBLISHED" ? "作品卡已放进展示区。" : "作品卡已保存为草稿。");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const setItemStatus = async (item: ShowcaseItem, publishStatus: "DRAFT" | "PUBLISHED") => {
    setSaving(true);
    setMessage("");
    try {
      await api.publishShowcase({
        id: item.id,
        team_id: item.team_id || undefined,
        product_name: item.product_name,
        track: item.track || undefined,
        one_liner: item.one_liner || undefined,
        access_url: item.access_url ? normalizeShowcaseUrl(item.access_url) : undefined,
        screenshot_key: item.screenshot_key || undefined,
        publish_status: publishStatus
      });
      setMessage(publishStatus === "PUBLISHED" ? "作品卡已放进展示区。" : "作品卡已撤回草稿。");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel showcase-panel">
      <div className="panel-title">
        <Package size={20} />
        <h2>作品展示区</h2>
      </div>
      <div className="showcase-form">
        <select value={teamId} onChange={(event) => setTeamId(event.target.value)} aria-label="选择小组">
          <option value="">选择小组</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="作品名" />
        <input value={track} onChange={(event) => setTrack(event.target.value)} placeholder="赛道或标签" />
        <input value={oneLiner} onChange={(event) => setOneLiner(event.target.value)} placeholder="一句话介绍" />
        <input value={accessUrl} onChange={(event) => setAccessUrl(event.target.value)} placeholder="作品链接" />
        <div className="showcase-actions">
          <button className="secondary" disabled={saving} onClick={() => save("DRAFT")}>
            <ClipboardCheck size={16} />
            {saving ? "保存中" : "保存草稿"}
          </button>
          <button disabled={saving} onClick={() => save("PUBLISHED")}>
            <CheckCircle2 size={16} />
            {saving ? "保存中" : "放进展示区"}
          </button>
          {editingId && (
            <button className="ghost" disabled={saving} onClick={resetForm}>
              取消编辑
            </button>
          )}
        </div>
      </div>
      {message && <p className="hint">{message}</p>}
      <ShowcaseGallery items={items} />
      <div className="showcase-manage-list">
        {items.map((item) => {
          const isPublished = item.publish_status === "PUBLISHED";
          return (
            <div className="showcase-manage-row" key={item.id}>
              <div>
                <span className={isPublished ? "showcase-status live" : "showcase-status draft"}>
                  {isPublished ? "展示中" : "草稿"}
                </span>
                <strong>{item.product_name}</strong>
                <small>{item.team_name || item.track || "未选择小组"}</small>
              </div>
              <div className="row-actions">
                {item.access_url && (
                  <a href={normalizeShowcaseUrl(item.access_url)} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    打开
                  </a>
                )}
                <button className="secondary" disabled={saving} onClick={() => editItem(item)}>
                  编辑
                </button>
                <button
                  disabled={saving || (!isPublished && !item.access_url)}
                  onClick={() => setItemStatus(item, isPublished ? "DRAFT" : "PUBLISHED")}
                >
                  {isPublished ? "撤回草稿" : "放进展示区"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FuturePhotoReview({ refresh }: { refresh: () => Promise<void> }) {
  const [items, setItems] = useState<FuturePhotoSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const result = await api.submissions();
      setItems(result.future_photo_submissions);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载失败");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (item: FuturePhotoSubmission, action: "generate" | "approve" | "save-only" | "reject") => {
    setLoading(true);
    setMessage("");
    try {
      if (action === "generate") {
        await api.markGenerated(item.id);
        setMessage("已开始生成，完成后会等老师确认。");
      } else {
        await api.reviewFuturePhoto(item.id, action);
      }
      await Promise.all([load(), refresh()]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <ShieldCheck size={20} />
        <h2>未来职业照审核</h2>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="review-list">
        {items.map((item) => (
          <article key={item.id} className="review-item">
            <div>
              <strong>{item.student_name}</strong>
              <span>{item.career_text}</span>
              <small>{futurePhotoStatusLabel(item.status)}</small>
              {futurePhotoHint(item) && <small>{futurePhotoHint(item)}</small>}
            </div>
            <div className="review-actions">
              {(item.status === "GENERATING" || item.status === "SUBMITTED") && (
                <button disabled={loading} onClick={() => act(item, "generate")}>
                  {loading ? "处理中" : "开始生成"}
                </button>
              )}
              {item.status === "AWAITING_REVIEW" && (
                <>
                  <button disabled={loading} onClick={() => act(item, "approve")}>点亮照片墙</button>
                  <button disabled={loading} onClick={() => act(item, "save-only")}>只保存</button>
                </>
              )}
            </div>
          </article>
        ))}
        {!items.length && <p className="empty">学生提交后，这里会出现待处理照片。</p>}
      </div>
    </section>
  );
}

function pageTypeLabel(pageType: string) {
  const labels: Record<string, string> = {
    cover: "故事入口",
    story: "故事页",
    image: "样片页",
    activity: "动手页",
    experiment: "实验页",
    demo: "演示页",
    "ai-demo": "演示页",
    showcase: "展示页"
  };
  return labels[pageType] ?? "课件页";
}

function artifactKindForPage(page: DesignedLessonPage): LessonArtifactKind | null {
  const artifacts: Record<string, LessonArtifactKind> = {
    "四个责任放上桌": "team-roles",
    "今天我们当便利贴侦探": "problem-wall",
    "把烦恼改成帮谁解决什么": "product-sentence",
    "班级线索墙": "problem-wall",
    "AI 给答案，先看证据": "evidence-check",
    "真假侦探实验": "evidence-check",
    "证据比声音更有力": "evidence-check",
    "AI 市场侦察卡": "market-scout",
    "竞品观察三格": "competitor-grid",
    "像侦探一样听": "interview-card",
    "三个好问题": "interview-card",
    "绿灯黄灯红灯": "interview-card",
    "12 个真实创业方向": "direction-map",
    "把线索变成产品一句话": "product-sentence",
    "产品摊位开张": "prototype-board",
    "明天要做出的第一版": "prototype-board",
    "五句提示词卡": "prompt-card",
    "对 AI 说：不对，再改": "ai-revise",
    "功能先发散": "prototype-board",
    "只留下一个核心动作": "prototype-board",
    "最小可行产品": "prototype-board",
    "选择今天能完成的路线": "route-map",
    "用户打开后第一步做什么": "route-map",
    "流程图检查": "route-map",
    "作品可以有很多样子": "product-browser",
    "从一句话到第一版": "product-browser",
    "真产品检查": "product-browser",
    "先看别人怎么用": "testing-board",
    "反馈进作品": "testing-board",
    "改出 V2": "testing-board",
    "2 分钟 Demo": "demo-strip",
    "每组作品能打开吗": "product-browser",
    "定价三问": "pricing-ticket",
    "别人愿意交换，是因为真的有用": "pricing-ticket",
    "价值交换榜": "pricing-ticket",
    "作品页上线清单": "launch-checklist",
    "把作品讲成一个小故事": "story-spine",
    "故事发布五步卡": "story-spine",
    "问答预演": "story-spine",
    "彩排开始": "demo-strip",
    "每组 5 分钟故事发布": "showcase-run",
    "家长观察员提问": "observer-cards",
    "观察员投票": "observer-cards",
    "五力证书": "five-forces",
    "给贡献一个名字": "five-forces"
  };
  return artifacts[page.title] ?? null;
}

function specialChipsForPage(page: DesignedLessonPage) {
  const chips: Record<string, string[]> = {
    "每个人都是自己 AI 的 CEO": ["指挥 AI", "判断 AI", "对作品负责"],
    "AI 市场侦察卡": ["用户声音", "已有方案", "继续验证"],
    "竞品观察三格": ["谁在用", "怎么解决", "哪里不同"],
    "12 个真实创业方向": ["生活帮手", "学习工具", "创意工坊", "校园社区"],
    "作品可以有很多样子": ["浏览器打开", "作品卡片", "点击体验"],
    "真产品检查": ["能打开", "能完成动作", "能分享"],
    "定价三问": ["谁会用", "付出什么", "为什么值得"],
    "作品页上线清单": ["产品名", "链接", "截图", "用户故事"],
    "家长观察员提问": ["提问", "投票", "建议"],
    "五力证书": ["共情力", "提问力", "创造力", "判断力", "领导力"]
  };
  return chips[page.title];
}

function specialCardsForPage(page: DesignedLessonPage): LessonCard[] | null {
  const cards: Record<string, LessonCard[]> = {
    "每个人都是自己 AI 的 CEO": [
      { title: "指挥 AI", text: "把目标说清楚" },
      { title: "判断 AI", text: "用证据看哪里要改" },
      { title: "负责作品", text: "最后决定由我来做" }
    ],
    "竞品观察三格": [
      { title: "谁在用", text: "它现在服务哪类用户" },
      { title: "怎么解决", text: "它让用户完成什么动作" },
      { title: "哪里不同", text: "我们可以做出一个新角度" }
    ],
    "12 个真实创业方向": [
      { title: "生活帮手", text: "让生活里一件麻烦事变简单" },
      { title: "学习工具", text: "让学习里一个卡点更容易练" },
      { title: "创意工坊", text: "让故事、图像、视频更好创作" },
      { title: "校园社区", text: "让同学之间的连接更顺手" }
    ],
    "产品摊位开张": [
      { title: "真实用户", text: "谁会用这个产品" },
      { title: "真实问题", text: "他遇到的麻烦是什么" },
      { title: "产品一句话", text: "我们用什么帮他" },
      { title: "证据", text: "采访里哪句话支持它" }
    ],
    "明天要做出的第一版": [
      { title: "核心动作", text: "别人打开后能完成的一步" },
      { title: "先做小", text: "只做最能验证的一版" },
      { title: "明天试用", text: "让别组真实试一次" }
    ],
    "对 AI 说：不对，再改": [
      { title: "看用户", text: "哪里还不适合真实用户" },
      { title: "看证据", text: "哪里还缺少采访线索" },
      { title: "再提要求", text: "把修改要求说得更清楚" }
    ],
    "作品可以有很多样子": [
      { title: "不只一种样子", text: "工具、游戏、问答、生成器都可以" },
      { title: "浏览器能打开", text: "别人点开链接就能体验" },
      { title: "放进作品卡", text: "卡片展示名字、截图和入口" }
    ],
    "真产品检查": [
      { title: "能打开", text: "浏览器里能看到作品" },
      { title: "能完成动作", text: "别人可以走完一步" },
      { title: "能看见结果", text: "试用后有清楚变化" },
      { title: "能分享", text: "家长能看到作品链接或画面" }
    ],
    "定价三问": [
      { title: "谁会用", text: "最需要它的人是谁" },
      { title: "付出什么", text: "星星币、时间或推荐" },
      { title: "为什么值得", text: "它帮别人少烦了什么" }
    ],
    "别人愿意交换，是因为真的有用": [
      { title: "星星币", text: "我愿意为它花一点星星币" },
      { title: "时间", text: "我愿意花时间继续使用" },
      { title: "推荐", text: "我愿意告诉别人来试试" }
    ],
    "价值交换榜": [
      { title: "最多星星币", text: "大家觉得它很值得" },
      { title: "最多试用", text: "大家愿意继续打开" },
      { title: "最多推荐", text: "大家愿意把它讲给别人" }
    ],
    "家长观察员提问": [
      { title: "提问", text: "听懂真实用户和产品选择" },
      { title: "投票", text: "选出最打动自己的作品" },
      { title: "建议", text: "给团队一个下一步方向" }
    ],
    "每组 5 分钟故事发布": [
      { title: "用户故事", text: "谁遇到了这个麻烦" },
      { title: "现场试用", text: "打开作品完成核心动作" },
      { title: "测试证据", text: "别人试过后怎么说" },
      { title: "下一步", text: "如果继续做，先改哪里" }
    ],
    "观察员投票": [
      { title: "最想继续用", text: "我会把它打开再试" },
      { title: "最会解决问题", text: "它真的帮到一个用户" },
      { title: "最会指挥 AI", text: "团队会提要求，也会判断结果" }
    ],
    "五力证书": [
      { title: "共情力", text: "听见真实用户" },
      { title: "提问力", text: "问出关键线索" },
      { title: "创造力", text: "做出新的方案" },
      { title: "判断力", text: "看见 AI 哪里要改" },
      { title: "领导力", text: "把想法带到展示台" }
    ]
  };
  return cards[page.title] ?? null;
}

function specialStepsForPage(page: DesignedLessonPage) {
  const steps: Record<string, string[]> = {
    "AI 市场侦察卡": ["找一条用户声音", "找一个已有方案", "写下还要验证的问题"],
    "选一条赛道，找到一个真实用户": ["选定一条赛道", "写出一个真实用户", "准备问他三个问题"],
    "把线索变成产品一句话": ["谁遇到麻烦", "麻烦发生在哪里", "我们用什么帮他"],
    "作品页上线清单": ["产品名和一句话", "可打开链接", "截图或演示画面", "用户故事和下一步"],
    "下一次我怎么指挥 AI": ["先说清目标", "用证据检查结果", "继续改到更适合用户"]
  };
  return steps[page.title];
}

function cardsForPage(module: CourseModule, page: DesignedLessonPage) {
  const design = moduleDesigns[module.id];
  const specialCards = specialCardsForPage(page);
  if (specialCards) return specialCards;
  if (page.visual === "roadmap") {
    return [
      { title: "D1", text: "找真问题" },
      { title: "D2", text: "做出产品原型" },
      { title: "D3", text: "讲清作品故事" }
    ];
  }
  if (page.visual === "demo" || page.visual === "flow") {
    return (
      page.flow ??
      design?.flow ?? [
        { title: "输入", text: "任务、用户和线索" },
        { title: "结果", text: "AI 给出第一版" },
        { title: "修改", text: "孩子继续判断和调整" }
      ]
    );
  }
  return (
    page.cards ??
    design?.cards ?? [
      { title: "看见画面", text: page.content_summary || module.subtitle || module.title },
      { title: "马上行动", text: "完成当前课堂动作" },
      { title: "期待结果", text: "准备展示一个可看见的小成果" }
    ]
  );
}

function stepsForPage(page: DesignedLessonPage) {
  return specialStepsForPage(page) ?? page.steps ?? ["看清当前任务", "动手完成一个小版本", "准备展示一个亮点"];
}

function cardLimitForPage(page: DesignedLessonPage, cards: LessonCard[]) {
  if (page.title === "五力证书") return Math.min(cards.length, 5);
  if (page.title === "12 个真实创业方向") return Math.min(cards.length, 4);
  if (page.visual === "roadmap" || page.visual === "demo" || page.visual === "flow") return Math.min(cards.length, 3);
  return Math.min(cards.length, 4);
}

function LessonArtifact({
  kind,
  page,
  cards,
  steps
}: {
  kind: LessonArtifactKind;
  page: DesignedLessonPage;
  cards: LessonCard[];
  steps: string[];
}) {
  if (kind === "team-roles") {
    return (
      <div className="timeline-artifact artifact-roles">
        {["采访", "产品", "AI", "展示"].map((role) => (
          <article key={role}>
            <small>{role}</small>
            <strong>谁来负责</strong>
            <span>名字写上来</span>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "problem-wall") {
    const notes = ["我发现", "谁会烦", "在哪里发生", "还想问"];
    return (
      <div className="timeline-artifact artifact-notes">
        {notes.map((note, index) => (
          <article key={note} style={{ transform: `rotate(${index % 2 ? 2 : -2}deg)` }}>
            <strong>{note}</strong>
            <span>{index === 0 ? "一个生活里的小麻烦" : "写成一句真实线索"}</span>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "evidence-check") {
    return (
      <div className="timeline-artifact artifact-evidence">
        <div>
          <small>AI 说</small>
          <strong>听起来很完整</strong>
        </div>
        <span>?</span>
        <div>
          <small>我查到</small>
          <strong>证据在哪里</strong>
        </div>
        <div className="artifact-wide">
          <CheckCircle2 size={22} />
          <strong>我这样改结论</strong>
        </div>
      </div>
    );
  }

  if (kind === "market-scout") {
    const fields = ["用户声音", "已有方案", "继续验证"];
    return (
      <div className="timeline-artifact artifact-sheet">
        <header>AI 市场侦察卡</header>
        {fields.map((field) => (
          <article key={field}>
            <strong>{field}</strong>
            <span>写下一条可继续追问的线索</span>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "competitor-grid") {
    return (
      <div className="timeline-artifact artifact-table">
        {["谁在用", "怎么解决", "哪里不够", "我们不同"].map((head) => (
          <strong key={head}>{head}</strong>
        ))}
        {["用户", "动作", "卡点", "新角度"].map((cell) => (
          <span key={cell}>{cell}</span>
        ))}
      </div>
    );
  }

  if (kind === "interview-card") {
    return (
      <div className="timeline-artifact artifact-interview">
        {["遇到过吗？", "多久一次？", "现在怎么解决？"].map((question, index) => (
          <article key={question}>
            <b>{index + 1}</b>
            <strong>{question}</strong>
            <span>听完再记关键词</span>
          </article>
        ))}
        <footer>把真实声音带回团队桌面</footer>
      </div>
    );
  }

  if (kind === "direction-map") {
    return (
      <div className="timeline-artifact artifact-directions">
        {cards.slice(0, 4).map((card, index) => (
          <article key={card.title}>
            <small>{String.fromCharCode(65 + index)}</small>
            <strong>{card.title}</strong>
            <span>{card.text}</span>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "product-sentence") {
    return (
      <div className="timeline-artifact artifact-sentence">
        <span>为</span>
        <strong>真实用户</strong>
        <span>解决</span>
        <strong>具体麻烦</strong>
        <span>用</span>
        <strong>核心动作</strong>
        <span>带来</span>
        <strong>看得见的结果</strong>
      </div>
    );
  }

  if (kind === "prompt-card") {
    return (
      <div className="timeline-artifact artifact-prompt">
        {["目标", "用户", "材料", "限制", "格式"].map((word) => (
          <article key={word}>
            <strong>{word}</strong>
            <span>写清楚</span>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "ai-revise") {
    return (
      <div className="timeline-artifact artifact-revise">
        <article>
          <small>第一版</small>
          <strong>哪里还不够好用？</strong>
        </article>
        <span>再改</span>
        <article>
          <small>第二版</small>
          <strong>更清楚，更贴近真实反馈</strong>
        </article>
      </div>
    );
  }

  if (kind === "prototype-board") {
    return (
      <div className="timeline-artifact artifact-board">
        {["用户", "麻烦", "核心动作", "第一版"].map((item, index) => (
          <article key={item}>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <strong>{item}</strong>
            <span>{index === 3 ? "今天能演示" : "写清楚"}</span>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "route-map") {
    return (
      <div className="timeline-artifact artifact-route">
        {["打开", "输入", "得到结果", "继续修改"].map((step, index) => (
          <React.Fragment key={step}>
            <article>
              <b>{index + 1}</b>
              <strong>{step}</strong>
            </article>
            {index < 3 && <span>→</span>}
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (kind === "product-browser") {
    return (
      <div className="timeline-artifact artifact-browser">
        <header>
          <span />
          <span />
          <span />
          <strong>作品可以打开</strong>
        </header>
        <main>
          {cards.slice(0, 3).map((card) => (
            <article key={card.title}>
              <strong>{card.title}</strong>
              <span>{card.text}</span>
            </article>
          ))}
        </main>
      </div>
    );
  }

  if (kind === "testing-board") {
    return (
      <div className="timeline-artifact artifact-testing">
        {["看见动作", "听见问题", "改进一处"].map((item, index) => (
          <article key={item}>
            <b>{index + 1}</b>
            <strong>{item}</strong>
            <span>{index === 0 ? "先看别人怎么用" : "写进下一版"}</span>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "demo-strip") {
    return (
      <div className="timeline-artifact artifact-demo">
        {["用户", "作品", "结果", "下一步"].map((item) => (
          <article key={item}>
            <strong>{item}</strong>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "pricing-ticket") {
    return (
      <div className="timeline-artifact artifact-ticket">
        <header>价值小票</header>
        {["谁会用", "付出什么", "为什么值得"].map((item) => (
          <article key={item}>
            <strong>{item}</strong>
            <span>用真实试用来回答</span>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "launch-checklist") {
    const items = ["产品名", "作品链接", "截图", "用户故事", "下一步"];
    return (
      <div className="timeline-artifact artifact-checklist">
        {items.map((item) => (
          <article key={item}>
            <CheckCircle2 size={20} />
            <strong>{item}</strong>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "story-spine") {
    return (
      <div className="timeline-artifact artifact-story">
        {["人物", "麻烦", "办法", "证据", "邀请"].map((item) => (
          <article key={item}>
            <strong>{item}</strong>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "showcase-run") {
    return (
      <div className="timeline-artifact artifact-showcase-run">
        {["用户故事", "现场试用", "结果证据", "下一步"].map((item, index) => (
          <article key={item}>
            <small>{index + 1}</small>
            <strong>{item}</strong>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "observer-cards") {
    return (
      <div className="timeline-artifact artifact-observer">
        {["我看见的亮点", "我想追问", "我建议下一步"].map((item) => (
          <article key={item}>
            <Star size={20} />
            <strong>{item}</strong>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "five-forces") {
    return (
      <div className="timeline-artifact artifact-five-forces">
        {cards.slice(0, 5).map((card) => (
          <article key={card.title}>
            <Star size={22} />
            <strong>{card.title}</strong>
            <span>{card.text}</span>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="timeline-artifact artifact-board">
      {steps.slice(0, 4).map((step, index) => (
        <article key={step}>
          <small>{String(index + 1).padStart(2, "0")}</small>
          <strong>{step}</strong>
        </article>
      ))}
    </div>
  );
}

function DesignedLessonSlide({ module, page }: { module: CourseModule; page: DesignedLessonPage }) {
  const design = moduleDesigns[module.id];
  const Icon = design?.icon ?? Lightbulb;
  const cards = cardsForPage(module, page);
  const steps = stepsForPage(page);
  const artifactKind = artifactKindForPage(page);
  const visibleCards = cards.slice(0, cardLimitForPage(page, cards));
  const gridClass = [
    page.visual === "showcase" ? "timeline-showcase" : "timeline-card-grid",
    visibleCards.length >= 5 ? "dense" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={`lesson-canvas timeline-slide accent-${page.accent || "mint"} visual-${page.visual || "cards"}`}>
      <div className="timeline-copy">
        <small>{page.kicker || `${module.time_range || `D${module.day}`} · ${pageTypeLabel(page.page_type)}`}</small>
        <h2>{page.title}</h2>
        <p>{page.content_summary || module.subtitle}</p>
        <div className="timeline-chip-row">
          {(specialChipsForPage(page) || page.chips || []).slice(0, 6).map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </div>
      <div className="timeline-visual" aria-label={`${module.title}课件视觉区`}>
        <div className="timeline-visual-head">
          <span>
            <Icon size={24} />
            {pageTypeLabel(page.page_type)}
          </span>
          <strong>{String(page.page_no).padStart(2, "0")}</strong>
        </div>
        {artifactKind ? (
          <LessonArtifact kind={artifactKind} page={page} cards={visibleCards} steps={steps} />
        ) : page.visual === "steps" ? (
          <div className="timeline-steps">
            {steps.slice(0, 4).map((step, index) => (
              <div key={step} className="timeline-step">
                <b>{index + 1}</b>
                <span>{step}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={gridClass}>
            {visibleCards.map((card, index) => (
              <article key={`${card.title}-${index}`} className="timeline-card">
                <strong>{card.title}</strong>
                <span>{card.text}</span>
              </article>
            ))}
          </div>
        )}
        <div className="timeline-result">
          <Sparkles size={18} />
          <span>{module.title}</span>
        </div>
      </div>
    </article>
  );
}

function LessonPageCanvas({
  module,
  page,
  students,
  onOpenPhoto
}: {
  module: CourseModule;
  page: DesignedLessonPage;
  students: Student[];
  onOpenPhoto: (student: Student) => void;
}) {
  if (module.id === "future-photo-studio") {
    return (
      <FuturePhotoStudioSlide
        module={module}
        page={page}
        students={students}
        onOpenPhoto={onOpenPhoto}
      />
    );
  }

  return <DesignedLessonSlide module={module} page={page} />;
}

function FuturePhotoStudioSlide({
  module,
  page,
  students,
  onOpenPhoto
}: {
  module: CourseModule;
  page: DesignedLessonPage;
  students: Student[];
  onOpenPhoto: (student: Student) => void;
}) {
  const [sampleIndex, setSampleIndex] = useState<number | null>(null);

  const sampleLightbox = sampleIndex === null ? null : (
    <SampleLightbox
      samples={futurePhotoSamples}
      index={sampleIndex}
      onChange={setSampleIndex}
      onClose={() => setSampleIndex(null)}
    />
  );

  const renderWithSamples = (content: React.ReactElement) => (
    <>
      {content}
      {sampleLightbox}
    </>
  );

  if (page.page_no === 1) {
    return renderWithSamples(
      <article className="lesson-canvas studio-slide studio-cover studio-cover-image">
        <img src={openingImages.cover} alt="未来照相馆封面" />
        <div className="studio-cover-shade" />
        <div className="studio-copy">
          <span className="studio-kicker">门口的牌子写着</span>
          <h2>未来照相馆</h2>
          <p>今天拍下的你，会收到一张未来寄来的照片。</p>
          <div className="studio-badges">
            <span>今天的你</span>
            <span>想做的事</span>
            <span>未来照片</span>
          </div>
        </div>
        <aside className="studio-door-sign" aria-hidden="true">
          <strong>营业中</strong>
          <span>只拍未来</span>
        </aside>
      </article>
    );
  }

  if (page.page_no === 2) {
    return renderWithSamples(
      <article className="lesson-canvas studio-slide studio-story">
        <div className="studio-copy">
          <span className="studio-kicker">第一批照片寄到了</span>
          <h2>他们去了哪个未来？</h2>
          <p>点开样片，看衣服、工具、房间和动作，先猜职业。</p>
        </div>
        <div className="opening-pairs">
          {futurePhotoSamples.map((sample, index) => (
            <button
              type="button"
              className="sample-card"
              key={sample.code}
              onClick={() => setSampleIndex(index)}
              aria-label={`放大查看${sample.code}`}
            >
              <img src={sample.image} alt={sample.alt} />
              <span className="sample-code">{sample.code}</span>
              <span className="sample-zoom"><Maximize2 size={16} /> 放大看</span>
              <span className="sample-caption">
                <strong>{sample.career}</strong>
                <small>{sample.cue}</small>
              </span>
            </button>
          ))}
        </div>
      </article>
    );
  }

  if (page.page_no === 3) {
    return renderWithSamples(
      <article className="lesson-canvas studio-slide studio-task">
        <div className="studio-copy">
          <span className="studio-kicker">柜台上还有一只空相框</span>
          <h2>下一张，写着你的名字</h2>
          <p>扫码，拍今天的你，说出长大想做的职业。</p>
        </div>
        <div className="task-stage">
          <div className="qr-card">
            <div className="qr-grid" aria-hidden="true">
              {Array.from({ length: 49 }).map((_, index) => (
                <span key={index} className={index % 3 === 0 || index % 8 === 0 ? "filled" : ""} />
              ))}
            </div>
            <strong>扫码进入</strong>
            <small>未来照相馆</small>
          </div>
          <div className="task-steps">
            <span>1. 拍今天的你</span>
            <span>2. 说出职业</span>
            <span>3. 等照片送回来</span>
          </div>
          <div className="empty-future-frame">
            <Sparkles size={36} />
            <strong>下一张：你</strong>
            <small>照片生成后会先回到你的屏幕</small>
          </div>
        </div>
      </article>
    );
  }

  return renderWithSamples(
    page.page_no === 4 ? (
      <article className="lesson-canvas studio-slide studio-wall">
        <div className="studio-copy compact">
          <span className="studio-kicker">照片送回来了</span>
          <h2>谁的未来先亮起来？</h2>
          <p>点开一张，看看 TA 正在做什么。</p>
        </div>
        <CoursePhotoWall students={students} variant="lesson" onOpenPhoto={onOpenPhoto} />
      </article>
    ) : (
      <article className="lesson-canvas studio-slide studio-secret">
        <div className="studio-copy compact">
          <span className="studio-kicker">照相馆的秘密</span>
          <h2>原来是 AI 画出来的</h2>
          <p>AI 看照片，也看职业词，再画出一张新的未来照片。</p>
        </div>
        <div className="ai-secret-flow">
          <div>
            <Image size={36} />
            <strong>照片</strong>
          </div>
          <span>+</span>
          <div>
            <Mic size={36} />
            <strong>职业词</strong>
          </div>
          <span>=</span>
          <div className="highlight">
            <Sparkles size={40} />
            <strong>新画面</strong>
          </div>
        </div>
        <div className="ai-secret-words">
          <span><strong>大模型</strong>读过很多图和字</span>
          <span><strong>提示词</strong>告诉 AI 画什么</span>
          <span><strong>图像生成</strong>把新画面画出来</span>
        </div>
      </article>
    )
  );
}

function SampleLightbox({
  samples,
  index,
  onChange,
  onClose
}: {
  samples: FuturePhotoSample[];
  index: number;
  onChange: (nextIndex: number) => void;
  onClose: () => void;
}) {
  const sample = samples[index];
  const goTo = (direction: -1 | 1) => {
    onChange((index + direction + samples.length) % samples.length);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goTo(-1);
      if (event.key === "ArrowRight") goTo(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <section className="sample-lightbox" role="dialog" aria-modal="true" aria-label="查看未来照相馆样片">
      <button className="sample-lightbox-close" type="button" onClick={onClose} aria-label="关闭样片">
        <X size={24} />
      </button>
      <button className="sample-lightbox-nav previous" type="button" onClick={() => goTo(-1)} aria-label="上一张样片">
        <ChevronLeft size={36} />
      </button>
      <figure>
        <img src={sample.image} alt={sample.alt} />
        <figcaption>
          <span>{sample.code}</span>
          <strong>{sample.career}</strong>
          <small>{sample.cue}</small>
        </figcaption>
      </figure>
      <button className="sample-lightbox-nav next" type="button" onClick={() => goTo(1)} aria-label="下一张样片">
        <ChevronRight size={36} />
      </button>
    </section>
  );
}

function CoursePhotoWall({
  students,
  variant,
  onOpenPhoto
}: {
  students: Student[];
  variant: "lesson" | "presentation" | "wall";
  onOpenPhoto: (student: Student) => void;
}) {
  return (
    <section className={`photo-wall ${variant}`}>
      {students.map((student) => {
        const canOpen = student.display_status === "ON_WALL" && Boolean(student.future_photo?.result_photo_url);
        return (
          <button
            type="button"
            className={`photo-wall-tile ${student.display_status.toLowerCase()}`}
            disabled={!canOpen}
            key={student.id}
            onClick={() => onOpenPhoto(student)}
          >
            {student.display_status === "ON_WALL" ? (
              <div className="generated-photo">
                {student.future_photo?.result_photo_url ? (
                  <img src={student.future_photo.result_photo_url} alt={`${student.nickname}的未来职业照`} />
                ) : (
                  <Sparkles size={38} />
                )}
                <strong>{student.future_photo?.career_text || "未来职业"}</strong>
              </div>
            ) : (
              <div className="placeholder">
                {student.display_status === "GENERATING" ? <Loader2 className="spin" /> : <UsersRound />}
              </div>
            )}
            <footer>
              <strong>{student.nickname}</strong>
              <span>{photoWallStatusText[student.display_status]}</span>
            </footer>
          </button>
        );
      })}
      {!students.length && (
        <article className="wall-empty">
          <CheckCircle2 size={42} />
          同学名单准备好后，这里会先亮起名字。
        </article>
      )}
    </section>
  );
}

function PhotoLightbox({ student, onClose }: { student: Student; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const photoUrl = student.future_photo?.result_photo_url;
  return (
    <section className="photo-lightbox" role="dialog" aria-modal="true">
      <button className="close-presentation" onClick={onClose} aria-label="关闭照片">
        <X size={24} />
      </button>
      {photoUrl ? (
        <img src={photoUrl} alt={`${student.nickname}的未来职业照`} />
      ) : (
        <div className="placeholder">
          <Sparkles size={64} />
        </div>
      )}
      <footer>
        <strong>{student.nickname}</strong>
        <span>{student.future_photo?.career_text || "未来职业"}</span>
      </footer>
    </section>
  );
}

function PresentationOverlay({
  module,
  pages,
  students,
  initialPageIndex,
  onClose,
  onOpenPhoto
}: {
  module: CourseModule;
  pages: DesignedLessonPage[];
  students: Student[];
  initialPageIndex: number;
  onClose: () => void;
  onOpenPhoto: (student: Student) => void;
}) {
  const [pageIndex, setPageIndex] = useState(initialPageIndex);
  const page = pages[pageIndex];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setPageIndex((index) => Math.min(index + 1, pages.length - 1));
      if (event.key === "ArrowLeft") setPageIndex((index) => Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length, onClose]);

  return (
    <section className="presentation-overlay">
      <button className="close-presentation" onClick={onClose} aria-label="关闭演示">
        <X size={24} />
      </button>
      {page && (
        <section className="presentation-slide">
          <LessonPageCanvas
            module={module}
            page={page}
            students={students}
            onOpenPhoto={onOpenPhoto}
          />
        </section>
      )}
      <footer className="presentation-footer">
        <button disabled={pageIndex === 0} onClick={() => setPageIndex((index) => Math.max(index - 1, 0))}>
          上一页
        </button>
        <span>{pageIndex + 1} / {pages.length}</span>
        <button
          disabled={pageIndex === pages.length - 1}
          onClick={() => setPageIndex((index) => Math.min(index + 1, pages.length - 1))}
        >
          下一页
        </button>
      </footer>
    </section>
  );
}

function StudentApp({
  camp,
  refresh
}: {
  camp: Camp | null;
  refresh: () => Promise<void>;
}) {
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get("photo-upload") === "1") {
    return <StudentPhotoUploadApp camp={camp} />;
  }

  const [loggedIn, setLoggedIn] = useState(hasStudentToken());
  const [student, setStudent] = useState<StudentAccount | null>(getStudentAccount());
  const [checking, setChecking] = useState(hasStudentToken());
  const [career, setCareer] = useState("");
  const [photoKey, setPhotoKey] = useState("");
  const [preview, setPreview] = useState("");
  const [checkingPhoto, setCheckingPhoto] = useState(false);
  const [listening, setListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const [mobileUploadUrl, setMobileUploadUrl] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const careerInputRef = useRef<HTMLInputElement | null>(null);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const loadedSourcePhotoRef = useRef("");
  const taskTitle = camp?.active_task?.title || "未来照相馆";
  const problemVoteTask = isProblemVoteTask(camp);
  const problemTask = isProblemDiscoveryTask(camp);
  const userVoiceTask = isUserVoiceTask(camp);
  const aiValidationTask = isAiValidationTask(camp);
  const marketScoutTask = isMarketScoutTask(camp);
  const promptCardTask = isPromptCardTask(camp);
  const productDefinitionTask = isProductDefinitionTask(camp);
  const blockerTask = isBlockerTask(camp);
  const observerScoreTask = isObserverScoreTask(camp);
  const growthReflectionTask = isGrowthReflectionTask(camp);
  const finalShowcaseTask = isFinalShowcaseTask(camp);
  const productLinkTask = isProductLinkTask(camp);
  const peerFeedbackTask = isPeerFeedbackTask(camp);
  const textTask =
    problemVoteTask ||
    problemTask ||
    userVoiceTask ||
    aiValidationTask ||
    marketScoutTask ||
    promptCardTask ||
    productDefinitionTask ||
    blockerTask ||
    observerScoreTask ||
    growthReflectionTask ||
    finalShowcaseTask ||
    productLinkTask ||
    peerFeedbackTask;

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  useEffect(() => {
    if (!hasStudentToken()) {
      setChecking(false);
      return;
    }
    api.studentMe()
      .then((payload) => {
        setStudent(payload.student);
        setStudentToken(getStudentToken(), payload.student);
        setLoggedIn(true);
      })
      .catch(() => {
        clearStudentToken();
        setStudent(null);
        setLoggedIn(false);
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      speechRef.current?.abort?.();
    };
  }, [preview]);

  const createMobileUploadLink = async () => {
    if (!loggedIn || !student) return;
    setQrLoading(true);
    try {
      const ticket = await api.mobileUploadLink();
      const url = studentPhotoUploadUrl(ticket.student_id || ticket.student.id, ticket.token);
      const qr = await QRCode.toDataURL(url, {
        width: 224,
        margin: 1,
        color: {
          dark: "#172018",
          light: "#ffffff"
        }
      });
      setMobileUploadUrl(url);
      setQrCodeUrl(qr);
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "二维码没出来，请再试一次。");
    } finally {
      setQrLoading(false);
    }
  };

  const loadSourcePhoto = async (showLoadedMessage = false) => {
    if (!loggedIn || !student || checkingPhoto) return;
    setCheckingPhoto(true);
    try {
      const payload = await api.sourcePhoto();
      const objectKey = payload.source_photo?.object_key;
      if (!objectKey || objectKey === loadedSourcePhotoRef.current) return;
      const blob = await api.sourcePhotoBlob(objectKey);
      const nextPreview = URL.createObjectURL(blob);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextPreview;
      });
      loadedSourcePhotoRef.current = objectKey;
      setPhotoKey(objectKey);
      if (showLoadedMessage) showMessage("success", "照片已经回到电脑上了。");
    } catch {
      if (showLoadedMessage) showMessage("hint", "还没看到照片，可以等一下再刷新。");
    } finally {
      setCheckingPhoto(false);
    }
  };

  useEffect(() => {
    if (!loggedIn || !student || textTask) return;
    void createMobileUploadLink();
    void loadSourcePhoto(false);
  }, [loggedIn, student?.id, textTask]);

  useEffect(() => {
    if (!loggedIn || !student || photoKey || textTask) return undefined;
    const timer = window.setInterval(() => {
      void loadSourcePhoto(true);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [loggedIn, student?.id, photoKey, textTask]);

  const startVoiceInput = () => {
    setMessage(null);
    const Recognition = getSpeechRecognition();
    if (!Recognition || isWechatBrowser()) {
      careerInputRef.current?.focus();
      showMessage("hint", "可以用手机键盘语音输入，也可以直接点选一个职业。");
      return;
    }

    speechRef.current?.abort?.();
    const recognition = new Recognition();
    speechRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setCareer(transcript);
        showMessage("hint", "听到了。你也可以再改一改。");
      }
    };
    recognition.onerror = () => {
      careerInputRef.current?.focus();
      showMessage("hint", "这次没听清，可以用手机键盘语音输入。");
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      careerInputRef.current?.focus();
      showMessage("hint", "可以用手机键盘语音输入，也可以直接点选一个职业。");
    }
  };

  const submit = async () => {
    if (!career.trim()) {
      showMessage("error", "先告诉未来照相馆：你理想的未来职业是？");
      return;
    }
    if (!photoKey) {
      showMessage("error", checkingPhoto ? "照片还在路上，等一下再提交。" : "先用手机扫码拍一张照片。");
      return;
    }
    setSubmitting(true);
    try {
      await api.submitFuturePhoto({
        career_text: career.trim(),
        career_source: "choice",
        source_photo_key: photoKey
      });
      showMessage("success", "收到啦。未来照片正在路上，老师看过后会点亮照片墙。");
      await refresh();
      const me = await api.studentMe();
      setStudent(me.student);
      setStudentToken(getStudentToken(), me.student);
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    clearStudentToken();
    setStudent(null);
    setLoggedIn(false);
  };

  if (checking) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" />
        <span>正在进入课堂任务</span>
      </main>
    );
  }

  if (!loggedIn || !student) {
    return <StudentLogin camp={camp} onLoggedIn={(account) => {
      setStudent(account);
      setLoggedIn(true);
    }} />;
  }

  if (problemTask) {
    return (
      <StudentProblemCardTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (problemVoteTask) {
    return (
      <StudentProblemVoteTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (userVoiceTask) {
    return (
      <StudentUserVoiceTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (aiValidationTask) {
    return (
      <StudentAiValidationTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (marketScoutTask) {
    return (
      <StudentMarketScoutTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (promptCardTask) {
    return (
      <StudentPromptCardTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (productDefinitionTask) {
    return (
      <StudentProductDefinitionTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (blockerTask) {
    return (
      <StudentBlockerTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (observerScoreTask) {
    return (
      <StudentObserverScoreTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (growthReflectionTask) {
    return (
      <StudentGrowthReflectionTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (finalShowcaseTask) {
    return (
      <StudentFinalShowcaseTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (productLinkTask) {
    return (
      <StudentProductLinkTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (peerFeedbackTask) {
    return (
      <StudentPeerFeedbackTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle}</h1>
        <p>先上传照片，再告诉未来照相馆：你理想的未来职业是？</p>
        <div className="student-card">
          <div className="student-current">
            <div>
              <span>今天的你</span>
              <strong>{student.nickname}</strong>
              <small>{student.student_no ? `学号 ${student.student_no}` : student.username}</small>
            </div>
            <button className="text-button" onClick={logout}>退出</button>
          </div>
          <div className="photo-qr-panel">
            {preview ? (
              <div className="pc-photo-preview">
                <img src={preview} alt="今天的照片预览" />
                <div>
                  <strong>照片已经回到电脑上了</strong>
                  <span>可以继续填写理想职业。</span>
                  <button className="text-button" onClick={() => {
                    setPreview((current) => {
                      if (current) URL.revokeObjectURL(current);
                      return "";
                    });
                    setPhotoKey("");
                    loadedSourcePhotoRef.current = "";
                    void createMobileUploadLink();
                  }}>
                    重新扫码拍照
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="qr-box">
                  {qrLoading ? (
                    <Loader2 className="spin" size={28} />
                  ) : qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="手机拍照二维码" />
                  ) : (
                    <button className="submit-button" onClick={createMobileUploadLink}>生成拍照二维码</button>
                  )}
                </div>
                <div className="qr-copy">
                  <strong>用手机扫码拍照</strong>
                  <span>手机拍好上传后，这里会自动出现照片。</span>
                  <div className="qr-actions">
                    <button className="text-button" onClick={() => void loadSourcePhoto(true)} disabled={checkingPhoto}>
                      {checkingPhoto ? "正在看照片" : "刷新照片"}
                    </button>
                    <button className="text-button" onClick={createMobileUploadLink} disabled={qrLoading}>
                      换一个二维码
                    </button>
                  </div>
                  {mobileUploadUrl && <small>手机扫码打不开时，可以把这个页面发到手机再打开。</small>}
                </div>
              </>
            )}
          </div>
          <label>
            你理想的未来职业是：
            <input
              ref={careerInputRef}
              value={career}
              onChange={(event) => setCareer(event.target.value)}
              placeholder="例如：动物医生"
              inputMode="text"
              enterKeyHint="done"
            />
          </label>
          <div className="career-grid">
            {careerChoices.map((choice) => (
              <button key={choice} onClick={() => setCareer(choice)}>
                {choice}
              </button>
            ))}
          </div>
          <button className="voice-button" onClick={startVoiceInput} disabled={listening}>
            {listening ? <Loader2 className="spin" size={18} /> : <Mic size={18} />}
            {listening ? "正在听你说" : "说出你理想中的未来职业"}
          </button>
          <p className="hint">例如：我长大想成为动物医生</p>
          <button className="submit-button" disabled={submitting || checkingPhoto} onClick={submit}>
            {submitting || checkingPhoto ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            {checkingPhoto ? "正在看照片" : "提交"}
          </button>
          <p className="hint">提交后，未来照片会先被画出来；老师看过后，照片墙就会亮。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentProblemVoteTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [candidates, setCandidates] = useState<WallArtifact[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.problemVoteBrief();
      setCandidates(result.candidates);
      setSelectedIds(selectedProblemIds(result.my_vote?.payload ?? {}));
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "问题卡暂时没出来，请稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggle = (id: string) => {
    setMessage(null);
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) {
        showMessage("hint", "最多选 3 张问题卡。");
        return current;
      }
      return [...current, id];
    });
  };

  const submit = async () => {
    if (!selectedIds.length) {
      showMessage("error", "先选 1 到 3 张问题卡。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitProblemVote({ problem_ids: selectedIds });
      showMessage("success", "收到啦。大家的选择会帮全班看见最想继续调查的问题。");
      await refresh();
      await load();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "投票没成功，请再试一次。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "烦人墙投票"}</h1>
        <p>选出你最想继续调查的问题，最多选 3 张。</p>
        <div className="student-card problem-vote-card">
          <div className="student-current">
            <div>
              <span>投票人</span>
              <strong>{student.nickname}</strong>
              <small>{student.team_name || student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          {loading ? (
            <div className="feedback-loading">
              <Loader2 className="spin" size={24} />
              <span>正在找问题卡</span>
            </div>
          ) : candidates.length ? (
            <>
              <div className="problem-vote-grid">
                {candidates.map((item) => {
                  const active = selectedIds.includes(item.id);
                  const title = asText(item.payload.problem_scene) || asText(item.payload.trouble) || "一个真实问题";
                  return (
                    <button className={active ? "problem-vote-option active" : "problem-vote-option"} key={item.id} onClick={() => toggle(item.id)}>
                      <span>{item.team_name || item.student_name || "问题卡"}</span>
                      <strong>{title}</strong>
                      <small>{asText(item.payload.target_user) || "真实用户"}</small>
                      <p>{asText(item.payload.trouble) || "等大家一起看一看"}</p>
                    </button>
                  );
                })}
              </div>
              <button className="submit-button" disabled={submitting} onClick={submit}>
                {submitting ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
                提交
              </button>
              <p className="hint">选中的问题不一定马上变成项目，但会帮大家看见最有调查价值的线索。</p>
            </>
          ) : (
            <div className="feedback-empty">
              <StickyNote size={28} />
              <strong>问题卡还在路上</strong>
              <span>等同学提交问题卡后，再回来投票。</span>
              <button className="text-button" onClick={load}>刷新</button>
            </div>
          )}
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentProblemCardTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [problemScene, setProblemScene] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [trouble, setTrouble] = useState("");
  const [currentSolution, setCurrentSolution] = useState("");
  const [teamChoice, setTeamChoice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!problemScene.trim()) {
      showMessage("error", "先写一个生活里的小麻烦。");
      return;
    }
    if (!targetUser.trim()) {
      showMessage("error", "再写清楚这个问题发生在谁身上。");
      return;
    }
    if (!trouble.trim()) {
      showMessage("error", "把最卡住的地方写出来。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "problem_card",
        title: taskTitle,
        payload: {
          problem_scene: problemScene.trim(),
          target_user: targetUser.trim(),
          trouble: trouble.trim(),
          current_solution: currentSolution.trim(),
          team_choice: teamChoice,
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。这张问题卡可以带回小组继续研究。");
      setProblemScene("");
      setTargetUser("");
      setTrouble("");
      setCurrentSolution("");
      setTeamChoice(false);
      await refresh();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "发现一个真实问题"}</h1>
        <p>把生活里的一个小麻烦，写成可以继续研究的问题。</p>
        <div className="student-card d1-task-card">
          <div className="student-current">
            <div>
              <span>记录人</span>
              <strong>{student.team_name || student.nickname}</strong>
              <small>{student.student_no ? `${student.nickname} · 学号 ${student.student_no}` : student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            我看到的小麻烦
            <input
              value={problemScene}
              onChange={(event) => setProblemScene(event.target.value)}
              placeholder="例如：午饭不知道选什么"
              inputMode="text"
            />
          </label>
          <label>
            这个问题发生在谁身上
            <input
              value={targetUser}
              onChange={(event) => setTargetUser(event.target.value)}
              placeholder="例如：每天在食堂排队的同学"
              inputMode="text"
            />
          </label>
          <label>
            最卡住的地方
            <textarea
              value={trouble}
              onChange={(event) => setTrouble(event.target.value)}
              placeholder="例如：选择太多，后面的人又在等"
              rows={3}
            />
          </label>
          <label>
            现在大家通常怎么解决
            <input
              value={currentSolution}
              onChange={(event) => setCurrentSolution(event.target.value)}
              placeholder="例如：随便选一个，或者问朋友"
              inputMode="text"
            />
          </label>
          <label className="student-check">
            <input
              type="checkbox"
              checked={teamChoice}
              onChange={(event) => setTeamChoice(event.target.checked)}
            />
            我想把这个问题带回小组继续研究
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <StickyNote size={18} />}
            提交
          </button>
          <p className="hint">好问题通常来自真实场景，而不是脑袋里硬想出来。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentUserVoiceTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [interviewee, setInterviewee] = useState("");
  const [hasProblem, setHasProblem] = useState("遇到过");
  const [frequency, setFrequency] = useState("");
  const [currentSolution, setCurrentSolution] = useState("");
  const [willingness, setWillingness] = useState("愿意试用");
  const [signal, setSignal] = useState("绿灯：继续调查");
  const [quote, setQuote] = useState("");
  const [finding, setFinding] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const hasProblemChoices = ["遇到过", "偶尔遇到", "还没遇到"];
  const willingnessChoices = ["愿意试用", "看情况", "暂时不想"];
  const signalChoices = ["绿灯：继续调查", "黄灯：缩小问题", "红灯：换个角度"];

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!interviewee.trim()) {
      showMessage("error", "先写你采访了谁。");
      return;
    }
    if (!quote.trim()) {
      showMessage("error", "记下一句对方的原话。");
      return;
    }
    if (!frequency.trim()) {
      showMessage("error", "问一问这个麻烦多久出现一次。");
      return;
    }
    if (!currentSolution.trim()) {
      showMessage("error", "再记下对方现在怎么解决。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "user_voice",
        title: taskTitle,
        payload: {
          interviewee: interviewee.trim(),
          has_problem: hasProblem,
          frequency: frequency.trim(),
          current_solution: currentSolution.trim(),
          willingness,
          signal,
          quote: quote.trim(),
          finding: finding.trim(),
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。这条用户声音会帮你们判断问题是不是真的。");
      setInterviewee("");
      setHasProblem("遇到过");
      setFrequency("");
      setCurrentSolution("");
      setWillingness("愿意试用");
      setSignal("绿灯：继续调查");
      setQuote("");
      setFinding("");
      await refresh();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "记录一个真实声音"}</h1>
        <p>问一个真实的人，带回一句原话、一个频率和一个现在办法。</p>
        <div className="student-card d1-task-card interview-card">
          <div className="student-current">
            <div>
              <span>采访员</span>
              <strong>{student.nickname}</strong>
              <small>{student.team_name || student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            我采访了
            <input
              value={interviewee}
              onChange={(event) => setInterviewee(event.target.value)}
              placeholder="例如：同桌、家长、老师"
              inputMode="text"
            />
          </label>
          <div className="student-choice-block">
            <span>TA 遇到过这个麻烦吗</span>
            <div className="student-option-row">
              {hasProblemChoices.map((choice) => (
                <button
                  className={hasProblem === choice ? "student-option active" : "student-option"}
                  key={choice}
                  type="button"
                  onClick={() => setHasProblem(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
          <label>
            这个麻烦多久出现一次
            <input
              value={frequency}
              onChange={(event) => setFrequency(event.target.value)}
              placeholder="例如：每天一次、每周两三次、考试前最明显"
              inputMode="text"
            />
          </label>
          <label>
            TA 现在怎么解决
            <textarea
              value={currentSolution}
              onChange={(event) => setCurrentSolution(event.target.value)}
              placeholder="例如：先问同学，或者用纸记下来"
              rows={2}
            />
          </label>
          <label>
            对方的一句原话
            <textarea
              value={quote}
              onChange={(event) => setQuote(event.target.value)}
              placeholder="例如：我最烦的是每次都要重新想一遍"
              rows={3}
            />
          </label>
          <div className="student-choice-block">
            <span>如果有一个小工具，TA 愿意试用吗</span>
            <div className="student-option-row">
              {willingnessChoices.map((choice) => (
                <button
                  className={willingness === choice ? "student-option active" : "student-option"}
                  key={choice}
                  type="button"
                  onClick={() => setWillingness(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
          <div className="student-choice-block">
            <span>这条线索现在是什么灯</span>
            <div className="student-option-row signal">
              {signalChoices.map((choice) => (
                <button
                  className={signal === choice ? "student-option active" : "student-option"}
                  key={choice}
                  type="button"
                  onClick={() => setSignal(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
          <label>
            我发现
            <textarea
              value={finding}
              onChange={(event) => setFinding(event.target.value)}
              placeholder="例如：这个问题值得继续做，因为发生频率高，对方也愿意试用"
              rows={3}
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <MessageSquareText size={18} />}
            提交
          </button>
          <p className="hint">真实声音会告诉我们：这个问题值不值得继续做。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentAiValidationTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [aiAnswer, setAiAnswer] = useState("");
  const [doubt, setDoubt] = useState("");
  const [evidenceSource, setEvidenceSource] = useState("");
  const [evidence, setEvidence] = useState("");
  const [revisedConclusion, setRevisedConclusion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!aiAnswer.trim()) {
      showMessage("error", "先贴上或写下 AI 给出的说法。");
      return;
    }
    if (!doubt.trim()) {
      showMessage("error", "圈出一句你最想查一查的话。");
      return;
    }
    if (!evidence.trim()) {
      showMessage("error", "写下你找到的证据。");
      return;
    }
    if (!revisedConclusion.trim()) {
      showMessage("error", "最后写出你现在的结论。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "ai_validation",
        title: taskTitle,
        payload: {
          ai_answer: aiAnswer.trim(),
          doubt: doubt.trim(),
          evidence_source: evidenceSource.trim(),
          evidence: evidence.trim(),
          revised_conclusion: revisedConclusion.trim(),
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。这张验证卡会帮大家看见：AI 的答案要用证据检查。");
      setAiAnswer("");
      setDoubt("");
      setEvidenceSource("");
      setEvidence("");
      setRevisedConclusion("");
      await refresh();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "AI 验证卡"}</h1>
        <p>选一句 AI 的说法，找证据，再把结论改得更可靠。</p>
        <div className="student-card d1-task-card ai-validation-card">
          <div className="student-current">
            <div>
              <span>验证人</span>
              <strong>{student.nickname}</strong>
              <small>{student.team_name || student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            AI 说了什么
            <textarea
              value={aiAnswer}
              onChange={(event) => setAiAnswer(event.target.value)}
              placeholder="例如：小学生每天应该先完成最难的作业"
              rows={3}
            />
          </label>
          <label>
            我想查一查这句话
            <textarea
              value={doubt}
              onChange={(event) => setDoubt(event.target.value)}
              placeholder="例如：是不是所有人都适合先做最难的作业？"
              rows={3}
            />
          </label>
          <label>
            我从哪里找到线索
            <input
              value={evidenceSource}
              onChange={(event) => setEvidenceSource(event.target.value)}
              placeholder="例如：采访同学、问老师、查一篇资料"
              inputMode="text"
            />
          </label>
          <label>
            我找到的证据
            <textarea
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              placeholder="例如：同桌说他先做简单题更容易进入状态"
              rows={3}
            />
          </label>
          <label>
            我现在的结论
            <textarea
              value={revisedConclusion}
              onChange={(event) => setRevisedConclusion(event.target.value)}
              placeholder="例如：先做哪一题要看每个人的状态，可以先用 10 分钟启动"
              rows={3}
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
            提交
          </button>
          <p className="hint">会用 AI 的人，不只会提问，也会用证据改答案。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentMarketScoutTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [originalProblem, setOriginalProblem] = useState("");
  const [aiRewrite, setAiRewrite] = useState("");
  const [userClue, setUserClue] = useState("");
  const [existingSolution, setExistingSolution] = useState("");
  const [differentAngle, setDifferentAngle] = useState("");
  const [nextQuestion, setNextQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!originalProblem.trim()) {
      showMessage("error", "先写下你们想继续调查的问题。");
      return;
    }
    if (!aiRewrite.trim()) {
      showMessage("error", "写下一版被 AI 改清楚的问题。");
      return;
    }
    if (!userClue.trim()) {
      showMessage("error", "带回一条用户声音或真实线索。");
      return;
    }
    if (!existingSolution.trim()) {
      showMessage("error", "找一个别人现在怎么解决的办法。");
      return;
    }
    if (!nextQuestion.trim()) {
      showMessage("error", "最后写下还要继续验证的问题。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "market_scout",
        title: taskTitle,
        payload: {
          original_problem: originalProblem.trim(),
          ai_rewrite: aiRewrite.trim(),
          user_clue: userClue.trim(),
          existing_solution: existingSolution.trim(),
          different_angle: differentAngle.trim(),
          next_question: nextQuestion.trim(),
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。这张侦察卡会帮小组把问题查得更清楚。");
      setOriginalProblem("");
      setAiRewrite("");
      setUserClue("");
      setExistingSolution("");
      setDifferentAngle("");
      setNextQuestion("");
      await refresh();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "AI 市场侦察卡"}</h1>
        <p>让 AI 帮你改清楚问题，再带回用户声音、已有方案和下一步问题。</p>
        <div className="student-card d1-task-card market-scout-card">
          <div className="student-current">
            <div>
              <span>侦察小组</span>
              <strong>{student.team_name || student.nickname}</strong>
              <small>{student.student_no ? `${student.nickname} · 学号 ${student.student_no}` : student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            我们想继续调查的问题
            <textarea
              value={originalProblem}
              onChange={(event) => setOriginalProblem(event.target.value)}
              placeholder="例如：同学每天中午不知道吃什么"
              rows={2}
            />
          </label>
          <label>
            AI 帮我们改成
            <textarea
              value={aiRewrite}
              onChange={(event) => setAiRewrite(event.target.value)}
              placeholder="例如：每天在食堂排队的同学，怎样更快选到适合自己的午餐？"
              rows={3}
            />
          </label>
          <label>
            我们找到的用户声音
            <textarea
              value={userClue}
              onChange={(event) => setUserClue(event.target.value)}
              placeholder="例如：同学说最烦的是后面有人等，自己还没想好"
              rows={3}
            />
          </label>
          <label>
            别人现在怎么解决
            <textarea
              value={existingSolution}
              onChange={(event) => setExistingSolution(event.target.value)}
              placeholder="例如：问朋友、看窗口排队人数、随便选一个"
              rows={2}
            />
          </label>
          <label>
            我们可以不同的角度
            <textarea
              value={differentAngle}
              onChange={(event) => setDifferentAngle(event.target.value)}
              placeholder="例如：先问口味和时间，再推荐 2 个选择"
              rows={2}
            />
          </label>
          <label>
            下一步还要验证
            <textarea
              value={nextQuestion}
              onChange={(event) => setNextQuestion(event.target.value)}
              placeholder="例如：同学愿不愿意在午饭前花 10 秒回答两个问题？"
              rows={3}
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <WandSparkles size={18} />}
            提交
          </button>
          <p className="hint">好侦察卡不是答案更多，而是让下一次采访更准。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentPromptCardTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [goal, setGoal] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [materials, setMaterials] = useState("");
  const [constraints, setConstraints] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [firstResult, setFirstResult] = useState("");
  const [revisionRequest, setRevisionRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const promptText = useMemo(() => {
    const lines = [
      goal.trim() ? `目标：${goal.trim()}` : "",
      targetUser.trim() ? `用户：${targetUser.trim()}` : "",
      materials.trim() ? `材料：${materials.trim()}` : "",
      constraints.trim() ? `限制：${constraints.trim()}` : "",
      outputFormat.trim() ? `格式：${outputFormat.trim()}` : ""
    ].filter(Boolean);
    return lines.join("\n");
  }, [goal, targetUser, materials, constraints, outputFormat]);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!goal.trim()) {
      showMessage("error", "先写清楚你要 AI 帮你完成什么。");
      return;
    }
    if (!targetUser.trim()) {
      showMessage("error", "再写清楚这次结果给谁用。");
      return;
    }
    if (!materials.trim()) {
      showMessage("error", "把你已经有的材料写进去。");
      return;
    }
    if (!constraints.trim()) {
      showMessage("error", "写一个必须注意的限制。");
      return;
    }
    if (!outputFormat.trim()) {
      showMessage("error", "最后写清楚你想要什么样的结果。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "prompt_card",
        title: taskTitle,
        payload: {
          goal: goal.trim(),
          target_user: targetUser.trim(),
          materials: materials.trim(),
          constraints: constraints.trim(),
          output_format: outputFormat.trim(),
          prompt_text: promptText,
          first_result: firstResult.trim(),
          revision_request: revisionRequest.trim(),
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。这张提示词卡可以带到产品制作里继续试。");
      setGoal("");
      setTargetUser("");
      setMaterials("");
      setConstraints("");
      setOutputFormat("");
      setFirstResult("");
      setRevisionRequest("");
      await refresh();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "五句提示词卡"}</h1>
        <p>把目标、用户、材料、限制和格式写清楚，让 AI 更容易给出可用的一版。</p>
        <div className="student-card d1-task-card prompt-card-form">
          <div className="student-current">
            <div>
              <span>提示词小组</span>
              <strong>{student.team_name || student.nickname}</strong>
              <small>{student.student_no ? `${student.nickname} · 学号 ${student.student_no}` : student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            目标
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="例如：帮我们生成午餐选择器的首页文案"
              rows={2}
            />
          </label>
          <label>
            用户
            <input
              value={targetUser}
              onChange={(event) => setTargetUser(event.target.value)}
              placeholder="例如：每天在食堂纠结的同学"
              inputMode="text"
            />
          </label>
          <label>
            材料
            <textarea
              value={materials}
              onChange={(event) => setMaterials(event.target.value)}
              placeholder="例如：用户说最烦的是后面有人等，自己还没想好"
              rows={3}
            />
          </label>
          <label>
            限制
            <textarea
              value={constraints}
              onChange={(event) => setConstraints(event.target.value)}
              placeholder="例如：文字要短，8-16 岁同学能看懂"
              rows={2}
            />
          </label>
          <label>
            格式
            <input
              value={outputFormat}
              onChange={(event) => setOutputFormat(event.target.value)}
              placeholder="例如：标题 1 句，按钮 2 个，说明 3 条"
              inputMode="text"
            />
          </label>
          {promptText && (
            <article className="prompt-preview">
              <span>可以拿去试的一版</span>
              <pre>{promptText}</pre>
            </article>
          )}
          <label>
            AI 第一版哪里还要改
            <textarea
              value={firstResult}
              onChange={(event) => setFirstResult(event.target.value)}
              placeholder="例如：它写得太像广告，还不够像给同学看的页面"
              rows={2}
            />
          </label>
          <label>
            我让 AI 再改一句
            <textarea
              value={revisionRequest}
              onChange={(event) => setRevisionRequest(event.target.value)}
              placeholder="例如：把文案改短一点，先说能帮同学快点做选择"
              rows={2}
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <WandSparkles size={18} />}
            提交
          </button>
          <p className="hint">好的提示词会把“我要什么”和“为什么这样做”一起说清楚。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentProductDefinitionTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [productName, setProductName] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [coreProblem, setCoreProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const oneLiner = useMemo(() => {
    if (!targetUser.trim() || !coreProblem.trim() || !solution.trim()) return "";
    return `我们为${targetUser.trim()}，用${solution.trim()}，解决${coreProblem.trim()}。`;
  }, [targetUser, coreProblem, solution]);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!productName.trim()) {
      showMessage("error", "先给产品起一个名字。");
      return;
    }
    if (!targetUser.trim()) {
      showMessage("error", "写清楚这个产品帮谁。");
      return;
    }
    if (!coreProblem.trim()) {
      showMessage("error", "写清楚它解决什么问题。");
      return;
    }
    if (!solution.trim()) {
      showMessage("error", "写清楚你们准备用什么方式解决。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "product_definition",
        title: taskTitle,
        payload: {
          product_name: productName.trim(),
          target_user: targetUser.trim(),
          core_problem: coreProblem.trim(),
          solution: solution.trim(),
          one_liner: oneLiner,
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。这句话可以变成你们的第一张产品卡。");
      setProductName("");
      setTargetUser("");
      setCoreProblem("");
      setSolution("");
      await refresh();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "写出产品一句话"}</h1>
        <p>把小组想做的产品，说成别人一眼能懂的一句话。</p>
        <div className="student-card d1-task-card">
          <div className="student-current">
            <div>
              <span>产品小组</span>
              <strong>{student.team_name || student.nickname}</strong>
              <small>{student.student_no ? `${student.nickname} · 学号 ${student.student_no}` : student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            产品名
            <input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              placeholder="例如：午餐选择器"
              inputMode="text"
            />
          </label>
          <label>
            这个产品帮谁
            <input
              value={targetUser}
              onChange={(event) => setTargetUser(event.target.value)}
              placeholder="例如：每天在食堂纠结的同学"
              inputMode="text"
            />
          </label>
          <label>
            解决什么问题
            <textarea
              value={coreProblem}
              onChange={(event) => setCoreProblem(event.target.value)}
              placeholder="例如：选择太多，不知道今天吃什么"
              rows={3}
            />
          </label>
          <label>
            用什么方式解决
            <textarea
              value={solution}
              onChange={(event) => setSolution(event.target.value)}
              placeholder="例如：根据心情、排队时间和忌口推荐一个选择"
              rows={3}
            />
          </label>
          <div className="product-sentence-preview">
            <span>产品一句话</span>
            <strong>{oneLiner || "填完上面三格，这里会出现一句完整介绍。"}</strong>
          </div>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Target size={18} />}
            提交
          </button>
          <p className="hint">先说清楚帮谁，再说怎么帮，产品就会更像真的。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentBlockerTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [whereStuck, setWhereStuck] = useState("");
  const [tried, setTried] = useState("");
  const [helpNeeded, setHelpNeeded] = useState("看一下产品链接");
  const [nextTry, setNextTry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const helpChoices = ["看一下产品链接", "一起改提示词", "帮我理流程", "听我演示一次"];

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!whereStuck.trim()) {
      showMessage("error", "先写清楚现在卡在哪一步。");
      return;
    }
    if (!tried.trim()) {
      showMessage("error", "写一写你们已经试过什么。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "blocker_note",
        title: taskTitle,
        payload: {
          where_stuck: whereStuck.trim(),
          tried: tried.trim(),
          help_needed: helpNeeded,
          next_try: nextTry.trim(),
          team_id: student.team_id || "",
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。老师会更快知道该从哪里帮你们。");
      setWhereStuck("");
      setTried("");
      setNextTry("");
      await refresh();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "卡在哪里，写清楚"}</h1>
        <p>把现在最影响作品前进的一步写出来，让帮助更快到位。</p>
        <div className="student-card blocker-card">
          <div className="student-current">
            <div>
              <span>制作小组</span>
              <strong>{student.team_name || student.nickname}</strong>
              <small>{student.student_no ? `${student.nickname} · 学号 ${student.student_no}` : student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            现在卡在哪一步
            <textarea
              value={whereStuck}
              onChange={(event) => setWhereStuck(event.target.value)}
              placeholder="例如：作品能打开，但按钮点了没有反应"
              rows={3}
            />
          </label>
          <label>
            我们已经试过
            <textarea
              value={tried}
              onChange={(event) => setTried(event.target.value)}
              placeholder="例如：换了提示词，也检查了链接"
              rows={3}
            />
          </label>
          <div className="help-choice-grid" role="group" aria-label="选择想要的帮助">
            {helpChoices.map((choice) => (
              <button
                key={choice}
                type="button"
                className={helpNeeded === choice ? "active" : ""}
                onClick={() => setHelpNeeded(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
          <label>
            下一步想先试试（可选）
            <input
              value={nextTry}
              onChange={(event) => setNextTry(event.target.value)}
              placeholder="例如：先做一个只保留核心按钮的版本"
              inputMode="text"
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Hammer size={18} />}
            提交
          </button>
          <p className="hint">把卡住的地方说清楚，本身就是把作品往前推了一步。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentGrowthReflectionTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [abilityTag, setAbilityTag] = useState<(typeof growthAbilityTags)[number]>("判断力");
  const [aiJob, setAiJob] = useState("");
  const [humanDecision, setHumanDecision] = useState("");
  const [evidence, setEvidence] = useState("");
  const [nextPractice, setNextPractice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!aiJob.trim()) {
      showMessage("error", "先写 AI 帮你做的一步。");
      return;
    }
    if (!humanDecision.trim()) {
      showMessage("error", "再写你做了什么判断或修改。");
      return;
    }
    if (!nextPractice.trim()) {
      showMessage("error", "写下下一次想练的方法。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "growth_reflection",
        title: taskTitle,
        payload: {
          ability_tag: abilityTag,
          ability_hint: growthAbilityHints[abilityTag],
          ai_job: aiJob.trim(),
          human_decision: humanDecision.trim(),
          evidence: evidence.trim(),
          next_practice: nextPractice.trim(),
          team_id: student.team_id || "",
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。这张成长卡可以放进你的结营作品集。");
      setAiJob("");
      setHumanDecision("");
      setEvidence("");
      setNextPractice("");
      await refresh();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "下一次我怎么指挥 AI"}</h1>
        <p>回想这三天：AI 帮了哪一步？你又做了什么判断？</p>
        <div className="student-card growth-reflection-form">
          <div className="student-current">
            <div>
              <span>成长卡</span>
              <strong>{student.nickname}</strong>
              <small>{student.team_name || student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <div className="ability-picker" role="group" aria-label="选择能力标签">
            {growthAbilityTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={abilityTag === tag ? "active" : ""}
                onClick={() => setAbilityTag(tag)}
              >
                <strong>{tag}</strong>
                <span>{growthAbilityHints[tag]}</span>
              </button>
            ))}
          </div>
          <label>
            AI 帮我的一步
            <input
              value={aiJob}
              onChange={(event) => setAiJob(event.target.value)}
              placeholder="例如：帮我把采访记录整理成三个重点"
              inputMode="text"
            />
          </label>
          <label>
            我做的判断或修改
            <textarea
              value={humanDecision}
              onChange={(event) => setHumanDecision(event.target.value)}
              placeholder="例如：我发现第二条不符合采访结果，所以改成了用户真正说过的话"
              rows={3}
            />
          </label>
          <label>
            我看到的证据（可选）
            <input
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              placeholder="例如：三个同学都提到了同一个卡点"
              inputMode="text"
            />
          </label>
          <label>
            下一次我想这样练
            <textarea
              value={nextPractice}
              onChange={(event) => setNextPractice(event.target.value)}
              placeholder="例如：先写清目标用户，再让 AI 给三个版本，最后用证据选一个"
              rows={3}
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Brain size={18} />}
            提交
          </button>
          <p className="hint">这张卡写的是你和 AI 一起完成作品时，真正做出的判断。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentFinalShowcaseTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [productName, setProductName] = useState("");
  const [teamMembers, setTeamMembers] = useState("");
  const [personalContributions, setPersonalContributions] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [coreProblem, setCoreProblem] = useState("");
  const [accessUrl, setAccessUrl] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [valueLine, setValueLine] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!productName.trim()) {
      showMessage("error", "先写产品名称。");
      return;
    }
    if (!teamMembers.trim()) {
      showMessage("error", "写上团队成员。");
      return;
    }
    if (!targetUser.trim()) {
      showMessage("error", "写清楚这个产品帮谁。");
      return;
    }
    if (!coreProblem.trim()) {
      showMessage("error", "写清楚它解决什么问题。");
      return;
    }
    if (!accessUrl.trim()) {
      showMessage("error", "贴上能打开的作品链接。");
      return;
    }
    if (!valueLine.trim()) {
      showMessage("error", "写一句话价值。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "final_showcase",
        title: taskTitle,
        payload: {
          product_name: productName.trim(),
          team_members: teamMembers.trim(),
          personal_contributions: personalContributions.trim(),
          target_user: targetUser.trim(),
          core_problem: coreProblem.trim(),
          access_url: normalizeShowcaseUrl(accessUrl),
          screenshot_url: screenshotUrl.trim() ? normalizeShowcaseUrl(screenshotUrl) : "",
          value_line: valueLine.trim(),
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。这张展示卡可以上台使用。");
      setProductName("");
      setTeamMembers("");
      setPersonalContributions("");
      setTargetUser("");
      setCoreProblem("");
      setAccessUrl("");
      setScreenshotUrl("");
      setValueLine("");
      await refresh();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "提交最终展示卡"}</h1>
        <p>把你们准备上台展示的作品，整理成一张清楚的卡片。</p>
        <div className="student-card final-showcase-card">
          <div className="student-current">
            <div>
              <span>路演小组</span>
              <strong>{student.team_name || student.nickname}</strong>
              <small>{student.student_no ? `${student.nickname} · 学号 ${student.student_no}` : student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            产品名称
            <input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              placeholder="例如：午餐选择器"
              inputMode="text"
            />
          </label>
          <label>
            团队成员
            <input
              value={teamMembers}
              onChange={(event) => setTeamMembers(event.target.value)}
              placeholder="例如：小宇、小安、小林"
              inputMode="text"
            />
          </label>
          <label>
            每个人的贡献
            <textarea
              value={personalContributions}
              onChange={(event) => setPersonalContributions(event.target.value)}
              placeholder={"例如：\\n小宇：采访同学，整理问题\\n小安：做产品页面和按钮\\n小林：准备故事发布"}
              rows={4}
            />
          </label>
          <label>
            目标用户
            <input
              value={targetUser}
              onChange={(event) => setTargetUser(event.target.value)}
              placeholder="例如：每天在食堂纠结的同学"
              inputMode="text"
            />
          </label>
          <label>
            解决的问题
            <textarea
              value={coreProblem}
              onChange={(event) => setCoreProblem(event.target.value)}
              placeholder="例如：选择太多，不知道今天吃什么"
              rows={3}
            />
          </label>
          <label>
            作品链接
            <input
              value={accessUrl}
              onChange={(event) => setAccessUrl(event.target.value)}
              placeholder="https://..."
              inputMode="url"
            />
          </label>
          <label>
            展示图链接（可选）
            <input
              value={screenshotUrl}
              onChange={(event) => setScreenshotUrl(event.target.value)}
              placeholder="https://..."
              inputMode="url"
            />
          </label>
          <label>
            一句话价值
            <textarea
              value={valueLine}
              onChange={(event) => setValueLine(event.target.value)}
              placeholder="例如：它能让同学 10 秒选出今天最适合的午餐"
              rows={3}
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Trophy size={18} />}
            提交
          </button>
          <p className="hint">展示卡会帮助观众快速看懂：你们做了什么，它为什么有用。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentProductLinkTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [productName, setProductName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [accessUrl, setAccessUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!productName.trim()) {
      showMessage("error", "先写作品名。");
      return;
    }
    if (!accessUrl.trim()) {
      showMessage("error", "先贴上能打开的作品链接。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "product_link",
        title: taskTitle,
        payload: {
          product_name: productName.trim(),
          one_liner: oneLiner.trim(),
          access_url: normalizeShowcaseUrl(accessUrl),
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。老师会看到这张作品卡。");
      await refresh();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "提交作品链接"}</h1>
        <p>把你们做好的作品入口交上来，让别人可以点开体验。</p>
        <div className="student-card product-link-card">
          <div className="student-current">
            <div>
              <span>提交人</span>
              <strong>{student.team_name || student.nickname}</strong>
              <small>{student.student_no ? `${student.nickname} · 学号 ${student.student_no}` : student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            作品名
            <input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              placeholder="例如：午餐选择器"
              inputMode="text"
            />
          </label>
          <label>
            一句话介绍
            <input
              value={oneLiner}
              onChange={(event) => setOneLiner(event.target.value)}
              placeholder="它帮谁解决什么问题？"
              inputMode="text"
            />
          </label>
          <label>
            作品链接
            <input
              value={accessUrl}
              onChange={(event) => setAccessUrl(event.target.value)}
              placeholder="https://..."
              inputMode="url"
              enterKeyHint="done"
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <ExternalLink size={18} />}
            提交
          </button>
          <p className="hint">提交后，作品会准备成一张可以点开的卡片。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentPeerFeedbackTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [mostUseful, setMostUseful] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const visibleItems = useMemo(
    () => items.filter((item) => !student.team_id || item.team_id !== student.team_id),
    [items, student.team_id]
  );
  const selectedItem = visibleItems.find((item) => item.id === selectedId) || null;

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.showcase()
      .then((result) => {
        if (!alive) return;
        const published = result.showcase_items.filter((item) => item.publish_status === "PUBLISHED");
        setItems(published);
        const nextVisible = published.filter((item) => !student.team_id || item.team_id !== student.team_id);
        setSelectedId((current) => current || nextVisible[0]?.id || "");
      })
      .catch(() => showMessage("hint", "作品卡还没出来，可以等一下再刷新。"))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [student.team_id]);

  const submit = async () => {
    if (!selectedItem) {
      showMessage("error", "先选一个你试用过的作品。");
      return;
    }
    if (!mostUseful.trim()) {
      showMessage("error", "先写一句最有用的地方。");
      return;
    }
    if (!suggestion.trim()) {
      showMessage("error", "再写一句建议改进的地方。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "product_feedback",
        title: taskTitle,
        payload: {
          showcase_item_id: selectedItem.id,
          product_name: selectedItem.product_name,
          team_id: selectedItem.team_id || "",
          team_name: selectedItem.team_name || selectedItem.track || "",
          access_url: selectedItem.access_url || "",
          most_useful: mostUseful.trim(),
          suggestion: suggestion.trim()
        }
      });
      showMessage("success", "收到啦。这条反馈可以帮作品改出下一版。");
      setMostUseful("");
      setSuggestion("");
      await refresh();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "试玩别人的作品"}</h1>
        <p>先点开一个作品试用，再写下你看到的亮点和建议。</p>
        <div className="student-card feedback-card">
          <div className="student-current">
            <div>
              <span>观察员</span>
              <strong>{student.nickname}</strong>
              <small>{student.team_name || student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          {loading ? (
            <div className="feedback-loading">
              <Loader2 className="spin" size={24} />
              <span>正在找作品卡</span>
            </div>
          ) : visibleItems.length ? (
            <>
              <div className="feedback-product-grid">
                {visibleItems.map((item) => {
                  const active = item.id === selectedId;
                  const href = item.access_url ? normalizeShowcaseUrl(item.access_url) : "";
                  return (
                    <article className={active ? "feedback-product active" : "feedback-product"} key={item.id}>
                      <button onClick={() => setSelectedId(item.id)}>
                        <span>{item.team_name || item.track || "作品"}</span>
                        <strong>{item.product_name}</strong>
                        <small>{item.one_liner || "点开看看它怎么帮到用户。"}</small>
                      </button>
                      {href && (
                        <a href={href} target="_blank" rel="noreferrer">
                          <ExternalLink size={15} />
                          打开作品
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
              <label>
                我试用的是
                <input value={selectedItem?.product_name || ""} readOnly />
              </label>
              <label>
                我觉得最有用的地方
                <input
                  value={mostUseful}
                  onChange={(event) => setMostUseful(event.target.value)}
                  placeholder="例如：我很快就知道下一步点哪里"
                  inputMode="text"
                />
              </label>
              <label>
                我建议改进的地方
                <input
                  value={suggestion}
                  onChange={(event) => setSuggestion(event.target.value)}
                  placeholder="例如：按钮名字可以再清楚一点"
                  inputMode="text"
                  enterKeyHint="done"
                />
              </label>
              <button className="submit-button" disabled={submitting} onClick={submit}>
                {submitting ? <Loader2 className="spin" size={18} /> : <MessageSquareText size={18} />}
                提交
              </button>
              <p className="hint">好的反馈会让作品更容易被别人用起来。</p>
            </>
          ) : (
            <div className="feedback-empty">
              <Package size={28} />
              <strong>还没有可以试用的其他组作品</strong>
              <span>等作品卡出现后，再回来写反馈。</span>
              <button className="text-button" onClick={() => window.location.reload()}>刷新</button>
            </div>
          )}
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function ScoreRating({
  value,
  onChange
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="score-rating">
      {scoreScale.map((score) => (
        <button
          key={score}
          type="button"
          className={score <= value ? "active" : ""}
          onClick={() => onChange(score)}
          aria-label={`${score} 星`}
        >
          <Star size={17} fill={score <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

function StudentObserverScoreTask({
  camp,
  student,
  taskTitle,
  refresh,
  onLogout
}: {
  camp: Camp | null;
  student: StudentAccount;
  taskTitle: string;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const emptyScores = scoreDimensionLabels.reduce<Record<ScoreDimension, number>>((acc, dimension) => {
    acc[dimension.key] = 0;
    return acc;
  }, {} as Record<ScoreDimension, number>);
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [scores, setScores] = useState<Record<ScoreDimension, number>>(emptyScores);
  const [highlight, setHighlight] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const visibleItems = useMemo(
    () => items.filter((item) => !student.team_id || item.team_id !== student.team_id),
    [items, student.team_id]
  );
  const selectedItem = visibleItems.find((item) => item.id === selectedId) || null;

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.showcase()
      .then((result) => {
        if (!alive) return;
        const published = result.showcase_items.filter((item) => item.publish_status === "PUBLISHED");
        setItems(published);
        const nextVisible = published.filter((item) => !student.team_id || item.team_id !== student.team_id);
        setSelectedId((current) => current || nextVisible[0]?.id || "");
      })
      .catch(() => showMessage("hint", "作品卡还没出来，可以等一下再刷新。"))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [student.team_id]);

  const updateScore = (key: ScoreDimension, value: number) => {
    setScores((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    if (!selectedItem) {
      showMessage("error", "先选一个你刚看过的作品。");
      return;
    }
    if (scoreDimensionLabels.some((dimension) => !scores[dimension.key])) {
      showMessage("error", "五个星星都点一下。");
      return;
    }
    if (!highlight.trim()) {
      showMessage("error", "写一句你看见的亮点。");
      return;
    }
    if (!nextStep.trim()) {
      showMessage("error", "再写一句下一步建议。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "observer_score",
        title: taskTitle,
        payload: {
          showcase_item_id: selectedItem.id,
          product_name: selectedItem.product_name,
          team_id: selectedItem.team_id || "",
          team_name: selectedItem.team_name || selectedItem.track || "",
          access_url: selectedItem.access_url || "",
          ...scores,
          highlight: highlight.trim(),
          next_step: nextStep.trim()
        }
      });
      showMessage("success", "收到啦。你的星星和建议会帮这组作品继续升级。");
      setScores(emptyScores);
      setHighlight("");
      setNextStep("");
      await refresh();
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "提交没成功，请举手找老师帮忙。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle || "观察员投票"}</h1>
        <p>选一个作品，点亮五组星星，再写下你看见的亮点和下一步建议。</p>
        <div className="student-card observer-score-card">
          <div className="student-current">
            <div>
              <span>观察员</span>
              <strong>{student.nickname}</strong>
              <small>{student.team_name || student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          {loading ? (
            <div className="feedback-loading">
              <Loader2 className="spin" size={24} />
              <span>正在找作品卡</span>
            </div>
          ) : visibleItems.length ? (
            <>
              <div className="feedback-product-grid">
                {visibleItems.map((item) => {
                  const active = item.id === selectedId;
                  const href = item.access_url ? normalizeShowcaseUrl(item.access_url) : "";
                  return (
                    <article className={active ? "feedback-product active" : "feedback-product"} key={item.id}>
                      <button onClick={() => setSelectedId(item.id)}>
                        <span>{item.team_name || item.track || "作品"}</span>
                        <strong>{item.product_name}</strong>
                        <small>{item.one_liner || "看看它帮用户完成了什么。"}</small>
                      </button>
                      {href && (
                        <a href={href} target="_blank" rel="noreferrer">
                          <ExternalLink size={15} />
                          打开作品
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className="score-dimension-list">
                {scoreDimensionLabels.map((dimension) => (
                  <div className="score-dimension" key={dimension.key}>
                    <div>
                      <strong>{dimension.label}</strong>
                      <span>{dimension.hint}</span>
                    </div>
                    <ScoreRating value={scores[dimension.key]} onChange={(value) => updateScore(dimension.key, value)} />
                  </div>
                ))}
              </div>
              <label>
                我看见的亮点
                <input
                  value={highlight}
                  onChange={(event) => setHighlight(event.target.value)}
                  placeholder="例如：用户一打开就知道怎么选"
                  inputMode="text"
                />
              </label>
              <label>
                我给下一版的建议
                <input
                  value={nextStep}
                  onChange={(event) => setNextStep(event.target.value)}
                  placeholder="例如：可以加一个更明显的开始按钮"
                  inputMode="text"
                  enterKeyHint="done"
                />
              </label>
              <button className="submit-button" disabled={submitting} onClick={submit}>
                {submitting ? <Loader2 className="spin" size={18} /> : <Star size={18} />}
                提交
              </button>
              <p className="hint">好的观察会让作品更接近真实用户。</p>
            </>
          ) : (
            <div className="feedback-empty">
              <Package size={28} />
              <strong>还没有可以投票的作品</strong>
              <span>等作品卡出现后，再回来点亮星星。</span>
              <button className="text-button" onClick={() => window.location.reload()}>刷新</button>
            </div>
          )}
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentPhotoUploadApp({ camp }: { camp: Camp | null }) {
  const searchParams = new URLSearchParams(window.location.search);
  const studentId = searchParams.get("sid") || "";
  const token = searchParams.get("token") || "";
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(
    token && studentId ? null : { tone: "error", text: "二维码时间到了，请回电脑换一个二维码。" }
  );

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const uploadMobilePhoto = async (file?: File) => {
    if (!file || !token || !studentId) return;
    setUploading(true);
    setMessage(null);
    try {
      const uploadFile = await prepareStudentPhoto(file);
      const nextPreview = URL.createObjectURL(uploadFile);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextPreview;
      });
      const target = await api.uploadToken("source-photo", uploadFile.name, token, studentId);
      if ((target.provider === "cos" || target.provider === "local") && target.uploadUrl) {
        const uploadResponse = await fetch(target.uploadUrl, {
          method: "PUT",
          headers: {
            ...target.headers,
            ...(uploadFile.type ? { "Content-Type": uploadFile.type } : {})
          },
          body: uploadFile
        });
        if (!uploadResponse.ok) throw new Error("照片没传好，请再试一次。");
      }
      await api.registerSourcePhoto(target.objectKey, token, studentId);
      showMessage("success", "照片传好了，可以回到电脑继续。");
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "照片没传好，请再试一次。");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="student-page phone-upload-page">
      <section className="student-shell phone-upload-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>拍一张今天的你</h1>
        <p>拍好后，照片会回到电脑上的未来照相馆。</p>
        <div className="student-card phone-upload-card">
          <div className="mobile-photo-preview">
            {preview ? <img src={preview} alt="照片预览" /> : <span><Image size={32} /> 等你拍照</span>}
            {uploading && (
              <span className="photo-uploading">
                <Loader2 className="spin" size={18} />
                照片上传中
              </span>
            )}
          </div>
          <div className="mobile-photo-actions">
            <label className="mobile-photo-button primary">
              打开相机
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                capture="user"
                disabled={!token || !studentId || uploading}
                onChange={(event) => {
                  void uploadMobilePhoto(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <label className="mobile-photo-button">
              从相册选择
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                disabled={!token || !studentId || uploading}
                onChange={(event) => {
                  void uploadMobilePhoto(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          <p className="hint">选一张清楚的正脸照片就好。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentLogin({ camp, onLoggedIn }: { camp: Camp | null; onLoggedIn: (student: StudentAccount) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.studentLogin(username.trim(), password);
      setStudentToken(result.token, result.student);
      onLoggedIn(result.student);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell student-login-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>进入课堂任务</h1>
        <p>输入老师给你的账号，就能打开今天的任务。</p>
        <form className="student-card student-login-card" onSubmit={login} noValidate>
          <label>
            学生账号
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="例如：student01"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="next"
            />
          </label>
          <label>
            密码
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              type="password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
            />
          </label>
          <button className="submit-button" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            进入课堂任务
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </section>
    </main>
  );
}

function FinalShowcaseRun({ artifacts }: { artifacts: WallArtifact[] }) {
  const ordered = useMemo(() => sortByDisplayOrder(artifacts), [artifacts]);
  const [activeIndex, setActiveIndex] = useState(0);
  const active = ordered[activeIndex] || null;

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(ordered.length - 1, 0)));
  }, [ordered.length]);

  if (!active) return null;
  const href = asText(active.payload.access_url);
  const screenshot = asText(active.payload.screenshot_url);
  return (
    <section className="final-showcase-wall">
      <div className="wall-section-title">
        <span className="eyebrow">结营路演</span>
        <h2>逐组展示</h2>
      </div>
      <article className="final-stage-card">
        <div className="final-stage-media">
          {screenshot ? (
            <img src={normalizeShowcaseUrl(screenshot)} alt={asText(active.payload.product_name) || "作品展示图"} />
          ) : (
            <Trophy size={68} />
          )}
        </div>
        <div className="final-stage-copy">
          <span>第 {displayOrderFor(active) === 9999 ? activeIndex + 1 : displayOrderFor(active)} 组</span>
          <h3>{asText(active.payload.product_name) || "未命名作品"}</h3>
          <p>{asText(active.payload.value_line) || "让大家看到用户怎么用、结果是什么。"}</p>
          <dl>
            <div>
              <dt>团队成员</dt>
              <dd>{asText(active.payload.team_members) || active.team_name || "团队成员"}</dd>
            </div>
            <div>
              <dt>目标用户</dt>
              <dd>{asText(active.payload.target_user) || "还在介绍"}</dd>
            </div>
            <div>
              <dt>解决的问题</dt>
              <dd>{asText(active.payload.core_problem) || "还在介绍"}</dd>
            </div>
          </dl>
          {href && (
            <a href={normalizeShowcaseUrl(href)} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              打开作品
            </a>
          )}
        </div>
      </article>
      {ordered.length > 1 && (
        <div className="final-stage-controls">
          <button onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} disabled={activeIndex === 0}>
            上一组
          </button>
          <span>{activeIndex + 1} / {ordered.length}</span>
          <button onClick={() => setActiveIndex((index) => Math.min(ordered.length - 1, index + 1))} disabled={activeIndex === ordered.length - 1}>
            下一组
          </button>
        </div>
      )}
    </section>
  );
}

function ProblemVoteWall({ summaries }: { summaries: ProblemVoteSummary[] }) {
  const visible = summaries.filter((summary) => summary.vote_count > 0);
  if (!visible.length) return null;
  return (
    <section className="wall-problem-votes">
      <div className="wall-section-title">
        <span className="eyebrow">班级选择</span>
        <h2>最想继续调查的问题</h2>
      </div>
      <ProblemVoteLeaderboard summaries={visible} />
    </section>
  );
}

function ClassroomArtifactsWall({ artifacts }: { artifacts: WallArtifact[] }) {
  if (!artifacts.length) return null;
  const hasProduct = artifacts.some((item) => item.task_type === "product_definition");
  const hasPrompt = artifacts.some((item) => item.task_type === "prompt_card");
  const hasValidation = artifacts.some((item) => item.task_type === "ai_validation");
  const hasScout = artifacts.some((item) => item.task_type === "market_scout");
  return (
    <section className="wall-artifacts">
      <div className="wall-section-title">
        <span className="eyebrow">{hasProduct ? "产品卡片" : hasPrompt ? "提示词卡" : hasValidation ? "AI 验证" : hasScout ? "市场侦察" : "真实线索"}</span>
        <h2>{hasProduct ? "从问题到产品" : hasPrompt ? "让 AI 更听得懂" : hasValidation ? "用证据改答案" : hasScout ? "把问题查得更清楚" : "问题和用户声音"}</h2>
      </div>
      <div className="wall-artifact-grid">
        {artifacts.map((item) => {
          const isProblem = item.task_type === "problem_card";
          const isScout = item.task_type === "market_scout";
          const isValidation = item.task_type === "ai_validation";
          const isProduct = item.task_type === "product_definition";
          const isPrompt = item.task_type === "prompt_card";
          return (
            <article
              className={
                isProduct
                  ? "wall-artifact-card product"
                  : isPrompt
                  ? "wall-artifact-card prompt"
                  : isScout
                  ? "wall-artifact-card scout"
                  : isValidation
                  ? "wall-artifact-card validation"
                  : isProblem
                  ? "wall-artifact-card problem"
                  : "wall-artifact-card voice"
              }
              key={item.id}
            >
              <span>{isProduct ? "产品卡" : isPrompt ? "提示词卡" : isScout ? "侦察卡" : isValidation ? "验证卡" : isProblem ? "问题卡" : "用户声音"}</span>
              <strong>
                {isProduct
                  ? asText(item.payload.product_name) || "一个产品想法"
                  : isPrompt
                  ? asText(item.payload.goal) || "一张五句提示词卡"
                  : isScout
                  ? asText(item.payload.ai_rewrite) || asText(item.payload.original_problem) || "一次市场侦察"
                  : isValidation
                  ? asText(item.payload.doubt) || asText(item.payload.revised_conclusion) || "用证据检查 AI"
                  : isProblem
                  ? asText(item.payload.problem_scene) || asText(item.payload.trouble) || "一个真实问题"
                  : asText(item.payload.interviewee) || "一次真实采访"}
              </strong>
              {isProduct ? (
                <>
                  <p><b>帮谁</b>{asText(item.payload.target_user) || "还没写"}</p>
                  <p><b>问题</b>{asText(item.payload.core_problem) || "还没写"}</p>
                  <p><b>办法</b>{asText(item.payload.solution) || "还没写"}</p>
                  <p><b>一句话</b>{asText(item.payload.one_liner) || "还在打磨"}</p>
                </>
              ) : isPrompt ? (
                <>
                  <p><b>用户</b>{asText(item.payload.target_user) || "还没写"}</p>
                  <p><b>材料</b>{asText(item.payload.materials) || "还没写"}</p>
                  <p><b>限制</b>{asText(item.payload.constraints) || "还没写"}</p>
                  <p><b>格式</b>{asText(item.payload.output_format) || "还没写"}</p>
                  <p><b>再改一句</b>{asText(item.payload.revision_request) || "还在整理"}</p>
                </>
              ) : isScout ? (
                <>
                  <p><b>原问题</b>{asText(item.payload.original_problem) || "还没写"}</p>
                  <p><b>用户声音</b>{asText(item.payload.user_clue) || "还没写"}</p>
                  <p><b>已有方案</b>{asText(item.payload.existing_solution) || "还没写"}</p>
                  <p><b>继续验证</b>{asText(item.payload.next_question) || "还在整理"}</p>
                </>
              ) : isValidation ? (
                <>
                  <p><b>AI 说</b>{asText(item.payload.ai_answer) || "还没写"}</p>
                  <p><b>证据</b>{asText(item.payload.evidence) || "还没写"}</p>
                  <p><b>改后结论</b>{asText(item.payload.revised_conclusion) || "还在整理"}</p>
                </>
              ) : isProblem ? (
                <>
                  <p><b>用户</b>{asText(item.payload.target_user) || "还没写"}</p>
                  <p><b>麻烦</b>{asText(item.payload.trouble) || "还没写"}</p>
                  <p><b>现在办法</b>{asText(item.payload.current_solution) || "还没写"}</p>
                </>
              ) : (
                <>
                  <p><b>多久一次</b>{asText(item.payload.frequency) || "还没写"}</p>
                  <p><b>现在办法</b>{asText(item.payload.current_solution) || "还没写"}</p>
                  <p><b>听到</b>{asText(item.payload.quote) || "还没写"}</p>
                  <p><b>愿意试用吗</b>{asText(item.payload.willingness) || "还没写"}</p>
                  <p><b>判断</b>{asText(item.payload.signal) || "还在整理"}</p>
                  <p><b>发现</b>{asText(item.payload.finding) || "还在整理"}</p>
                </>
              )}
              <footer>{item.team_name || item.student_name || "课堂线索"}</footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WallAwards({ awards, summaries }: { awards: AwardResult[]; summaries: ScoreSummary[] }) {
  if (!awards.length && !summaries.length) return null;
  return (
    <section className="wall-awards">
      <div className="wall-section-title">
        <span className="eyebrow">结营证书</span>
        <h2>贡献被看见了</h2>
      </div>
      {awards.length ? (
        <div className="wall-award-grid">
          {awards.map((award) => (
            <article className="wall-award-card" key={award.id}>
              <span>{award.award_type}</span>
              <strong>{award.winner_name}</strong>
              <p>{award.reason || "这份贡献被大家看见了。"}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="wall-score-grid">
          {summaries.slice(0, 4).map((summary) => (
            <article className="wall-score-card" key={summary.key}>
              <span>{summary.team_name || "项目团队"}</span>
              <strong>{summary.product_name}</strong>
              <p>{summary.highlights[0] || "观察员正在写下亮点。"}</p>
              <ScoreStars value={summary.average_total} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function WallGrowthReflections({ reflections }: { reflections: WallArtifact[] }) {
  if (!reflections.length) return null;
  return (
    <section className="wall-growth">
      <div className="wall-section-title">
        <span className="eyebrow">成长卡</span>
        <h2>下一次我怎么指挥 AI</h2>
      </div>
      <div className="wall-growth-grid">
        {reflections.slice(0, 8).map((reflection) => (
          <article className="wall-growth-card" key={reflection.id}>
            <span>{asText(reflection.payload.ability_tag) || "能力标签"}</span>
            <strong>{reflection.student_name || "少年 CEO"}</strong>
            <p>{asText(reflection.payload.next_practice) || asText(reflection.payload.human_decision) || "继续练习指挥 AI。"}</p>
            <small>{reflection.team_name || asText(reflection.payload.team_name) || "项目团队"}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function WallApp({
  camp,
  students,
  showcaseItems,
  artifacts,
  growthReflections,
  problemVoteSummaries,
  awardResults,
  scoreSummaries
}: {
  camp: Camp | null;
  students: Student[];
  showcaseItems: ShowcaseItem[];
  artifacts: WallArtifact[];
  growthReflections: WallArtifact[];
  problemVoteSummaries: ProblemVoteSummary[];
  awardResults: AwardResult[];
  scoreSummaries: ScoreSummary[];
}) {
  const [selectedPhoto, setSelectedPhoto] = useState<Student | null>(null);
  const finalShowcaseArtifacts = useMemo(
    () => sortByDisplayOrder(artifacts.filter((item) => item.task_type === "final_showcase")),
    [artifacts]
  );
  const classroomArtifacts = useMemo(
    () => artifacts.filter((item) => item.task_type !== "final_showcase"),
    [artifacts]
  );

  return (
    <main className="wall-page">
      <header className="wall-header">
        <div>
          <span className="eyebrow">{camp?.location || "北京顺义站"}</span>
          <h1>未来照相馆照片墙</h1>
        </div>
        <div className="wall-clock">
          <Clock3 size={20} />
          正在亮起
        </div>
      </header>
      <CoursePhotoWall students={students} variant="wall" onOpenPhoto={setSelectedPhoto} />
      <FinalShowcaseRun artifacts={finalShowcaseArtifacts} />
      <ProblemVoteWall summaries={problemVoteSummaries} />
      <WallAwards awards={awardResults} summaries={scoreSummaries} />
      <WallGrowthReflections reflections={growthReflections} />
      <ClassroomArtifactsWall artifacts={classroomArtifacts} />
      <section className="wall-showcase">
        <div className="wall-section-title">
          <span className="eyebrow">作品发布会</span>
          <h2>点开就能体验的产品卡</h2>
        </div>
        <ShowcaseGallery items={showcaseItems} variant="wall" />
      </section>
      {selectedPhoto && <PhotoLightbox student={selectedPhoto} onClose={() => setSelectedPhoto(null)} />}
    </main>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const rootStore = window as Window & typeof globalThis & { __ceoCampRoot?: ReturnType<typeof createRoot> };
rootStore.__ceoCampRoot ??= createRoot(rootElement);
rootStore.__ceoCampRoot.render(<App />);
