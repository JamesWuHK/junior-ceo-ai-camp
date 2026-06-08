import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
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
  getTeacherAccount,
  hasStudentToken,
  hasTeacherToken,
  setStudentToken,
  setTeacherToken
} from "./api";
import type {
  Camp,
  CourseModule,
  FuturePhotoSubmission,
  ShowcaseItem,
  Student,
  StudentAccount,
  TeacherAccount
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
  WAITING: "等待进入",
  GENERATING: "正在生成",
  AWAITING_REVIEW: "即将亮相",
  ON_WALL: "已亮相",
  SAVED_ONLY: "已保存"
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
    "五力证书": "每个孩子有一条可被看见的贡献证据"
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
  if (action === "进入评分") return "score";
  if (action === "发起互动") return "interaction";
  if (action === "打开看板") return "board";
  if (page.page_type === "showcase") return "showcase";
  return page.page_type || "lesson";
}

function futurePhotoHint(item: FuturePhotoSubmission) {
  if (!item.review_note) return "";
  try {
    const note = JSON.parse(item.review_note) as { status?: string; message?: string };
    if (note.status === "queued") return "已加入生成队列";
    if (note.status === "failed") return "上游生成失败，可稍后重试";
  } catch {
    if (item.review_note.includes("FUTURE_PHOTO_DAILY_LIMIT_REACHED")) return "今日自动出图已达上限";
  }
  return "";
}

function useInitialData(active: "student" | "wall") {
  const [camp, setCamp] = useState<Camp | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    const [campResult, moduleResult, wallResult, showcaseResult] = await Promise.all([
      api.currentCamp(),
      Promise.resolve({ modules: [] }),
      active === "student" ? Promise.resolve({ students: [] }) : api.wall(),
      active === "student"
        ? Promise.resolve({ showcase_items: [] })
        : api.showcase().catch(() => ({ showcase_items: [] as ShowcaseItem[] }))
    ]);
    setCamp(campResult);
    setModules(moduleResult.modules);
    setStudents(wallResult.students);
    setShowcaseItems(showcaseResult.showcase_items);
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
    });
  }, [active]);

  return { camp, modules, students, showcaseItems, loading, error, refresh };
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
  const active = route.startsWith("/student") ? "student" : route.startsWith("/wall") ? "wall" : "teacher";
  if (active === "teacher") return <TeacherRoute />;

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
      {active === "wall" && <WallApp camp={data.camp} students={data.students} showcaseItems={data.showcaseItems} />}
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
    if (authStatus === "authed" && data.error === "UNAUTHORIZED") {
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
      setActionMessage("已发布当前环节。");
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
      setActionMessage(`已发布本页任务：${lessonPageTitle(selectedModule, selectedPage)}。`);
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
    setActionMessage(`已启动 ${minutes} 分钟课堂计时。`);
  };

  const openWall = () => {
    window.open("/wall", "_blank", "noopener,noreferrer");
    setActionMessage("已打开大屏页面。");
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
          <small>{camp?.location || "北京顺义站"} · 教学总控</small>
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
              <span className="eyebrow">当前课件</span>
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
                发布当前环节
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
        <section className="teacher-grid">
          <TeacherStudents students={students} refresh={refresh} />
          <FuturePhotoReview refresh={refresh} />
        </section>
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
        <small>本页动作</small>
        <strong>{teacherMoveForPage(page)}</strong>
        <span>{module.time_range || `D${module.day}`} · 第 {page.page_no} 页</span>
      </article>
      <article className="operator-card">
        <small>看见的产出</small>
        <strong>{expectedOutputForPage(page)}</strong>
        <span>{page.content_summary || module.subtitle}</span>
      </article>
      <article className={timerSeconds ? "operator-card operator-timer running" : "operator-card operator-timer"}>
        <small>建议计时</small>
        <strong>{timerLabel}</strong>
        <span>{timerSeconds ? "正在计时" : "按本页课堂动作估算"}</span>
      </article>
      <div className="operator-actions">
        <button className="primary" onClick={onPublishPage}>
          <Play size={16} />
          发布本页任务
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
        <p>进入三天教学总控、课件演示、活动发起、大屏控制和后台管理。</p>
        <p className="login-api-hint">当前 API：{API_BASE}</p>
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
            填入本地教师账号
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
      setMessage(created?.username ? `已加入大屏占位。学生账号：${created.username}` : "已加入大屏占位。");
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
        {!visibleStudents.length && <p className="empty">先录入学员，大屏会显示名字占位。</p>}
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
              <p>{item.one_liner || "点开看看这个产品怎么帮助用户。"}</p>
            </div>
            <footer>
              <small>{item.publish_status === "PUBLISHED" ? "已展示" : "准备中"}</small>
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
          <span>产品部署好以后，卡片可以跳转到作品链接。</span>
        </article>
      )}
    </div>
  );
}

function TeacherShowcase() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [productName, setProductName] = useState("");
  const [track, setTrack] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [accessUrl, setAccessUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const result = await api.manageShowcase();
      setItems(result.showcase_items);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!productName.trim()) {
      setMessage("先写作品名。");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await api.publishShowcase({
        product_name: productName.trim(),
        track: track.trim() || undefined,
        one_liner: oneLiner.trim() || undefined,
        access_url: normalizeShowcaseUrl(accessUrl),
        publish_status: "PUBLISHED"
      });
      setProductName("");
      setTrack("");
      setOneLiner("");
      setAccessUrl("");
      setMessage("作品卡已加入展示区。");
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
        <input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="作品名" />
        <input value={track} onChange={(event) => setTrack(event.target.value)} placeholder="赛道或小组" />
        <input value={oneLiner} onChange={(event) => setOneLiner(event.target.value)} placeholder="一句话介绍" />
        <input value={accessUrl} onChange={(event) => setAccessUrl(event.target.value)} placeholder="作品链接" />
        <button disabled={saving} onClick={save}>
          {saving ? "保存中" : "加入展示"}
        </button>
      </div>
      {message && <p className="hint">{message}</p>}
      <ShowcaseGallery items={items} />
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
        setMessage("已加入生成队列，生成完成后会进入审核。");
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
              <small>{item.status}</small>
              {futurePhotoHint(item) && <small>{futurePhotoHint(item)}</small>}
            </div>
            <div className="review-actions">
              {(item.status === "GENERATING" || item.status === "SUBMITTED") && (
                <button disabled={loading} onClick={() => act(item, "generate")}>
                  {loading ? "处理中" : "加入生成队列"}
                </button>
              )}
              {item.status === "AWAITING_REVIEW" && (
                <>
                  <button disabled={loading} onClick={() => act(item, "approve")}>上墙</button>
                  <button disabled={loading} onClick={() => act(item, "save-only")}>只保存</button>
                </>
              )}
            </div>
          </article>
        ))}
        {!items.length && <p className="empty">学生提交后会出现在这里。</p>}
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
      { title: "多种形态", text: "工具、游戏、问答、生成器都可以" },
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
      { title: "星星币", text: "我愿意为它付出一点资源" },
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
          <strong>哪里还不像给真实用户用？</strong>
        </article>
        <span>再改</span>
        <article>
          <small>第二版</small>
          <strong>更清楚，更贴近证据</strong>
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
        <header>价值票据</header>
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
          名单准备好后，这里会显示每位同学的位置。
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
  const [loggedIn, setLoggedIn] = useState(hasStudentToken());
  const [student, setStudent] = useState<StudentAccount | null>(getStudentAccount());
  const [checking, setChecking] = useState(hasStudentToken());
  const [career, setCareer] = useState("");
  const [photoKey, setPhotoKey] = useState("");
  const [preview, setPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");
  const taskTitle = camp?.active_task?.title || "未来照相馆";

  useEffect(() => {
    if (!hasStudentToken()) {
      setChecking(false);
      return;
    }
    api.studentMe()
      .then((payload) => {
        setStudent(payload.student);
        setStudentToken(window.localStorage.getItem("ceo_camp_student_token") || "", payload.student);
        setLoggedIn(true);
      })
      .catch(() => {
        clearStudentToken();
        setStudent(null);
        setLoggedIn(false);
      })
      .finally(() => setChecking(false));
  }, []);

  const onFile = async (file?: File) => {
    if (!file) return;
    setResult("");
    setPreview(URL.createObjectURL(file));
    const target = await api.uploadToken("source-photo", file.name);
    if ((target.provider === "cos" || target.provider === "local") && target.uploadUrl) {
      const uploadResponse = await fetch(target.uploadUrl, {
        method: "PUT",
        headers: target.headers,
        body: file
      });
      if (!uploadResponse.ok) throw new Error("照片保存失败，请重试");
    }
    setPhotoKey(target.objectKey);
  };

  const submit = async () => {
    if (!career.trim()) {
      setResult("先告诉未来照相馆：你理想的未来职业是？");
      return;
    }
    if (!photoKey) {
      setResult("先上传一张照片，再提交。");
      return;
    }
    setSubmitting(true);
    try {
      await api.submitFuturePhoto({
        career_text: career.trim(),
        career_source: "choice",
        source_photo_key: photoKey
      });
      setResult("已提交。照片生成后，老师看过就会点亮照片墙。");
      await refresh();
      const me = await api.studentMe();
      setStudent(me.student);
      setStudentToken(window.localStorage.getItem("ceo_camp_student_token") || "", me.student);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "提交失败，请找老师帮忙。");
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
        <span>正在进入学生端</span>
      </main>
    );
  }

  if (!loggedIn || !student) {
    return <StudentLogin camp={camp} onLoggedIn={(account) => {
      setStudent(account);
      setLoggedIn(true);
    }} />;
  }

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>{taskTitle}</h1>
        <p>上传照片，告诉未来照相馆：你理想的未来职业是？</p>
        <div className="student-card">
          <div className="student-current">
            <div>
              <span>当前同学</span>
              <strong>{student.nickname}</strong>
              <small>{student.student_no ? `学号 ${student.student_no}` : student.username}</small>
            </div>
            <button className="text-button" onClick={logout}>退出</button>
          </div>
          <label className="photo-uploader">
            <input type="file" accept="image/*" onChange={(event) => onFile(event.target.files?.[0])} />
            {preview ? <img src={preview} alt="预览" /> : <span><Image size={28} /> 上传照片</span>}
          </label>
          <label>
            你理想的未来职业是：
            <input value={career} onChange={(event) => setCareer(event.target.value)} placeholder="例如：动物医生" />
          </label>
          <div className="career-grid">
            {careerChoices.map((choice) => (
              <button key={choice} onClick={() => setCareer(choice)}>
                {choice}
              </button>
            ))}
          </div>
          <button className="voice-button" onClick={() => setCareer("我长大想成为动物医生")}>
            <Mic size={18} />
            按住说出你的理想职业
          </button>
          <p className="hint">例如：我长大想成为动物医生</p>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            提交
          </button>
          <p className="hint">提交后先生成照片，老师看过后会点亮照片墙。</p>
          {result && <p className="success">{result}</p>}
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
        <h1>学生端</h1>
        <p>登录后进入当前课堂任务。</p>
        <form className="student-card student-login-card" onSubmit={login}>
          <label>
            学生账号
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="例如：student01"
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
          <button className="submit-button" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            进入学生端
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </section>
    </main>
  );
}

function WallApp({
  camp,
  students,
  showcaseItems
}: {
  camp: Camp | null;
  students: Student[];
  showcaseItems: ShowcaseItem[];
}) {
  const [selectedPhoto, setSelectedPhoto] = useState<Student | null>(null);

  return (
    <main className="wall-page">
      <header className="wall-header">
        <div>
          <span className="eyebrow">{camp?.location || "北京顺义站"}</span>
          <h1>未来照相馆照片墙</h1>
        </div>
        <div className="wall-clock">
          <Clock3 size={20} />
          实时更新
        </div>
      </header>
      <CoursePhotoWall students={students} variant="wall" onOpenPhoto={setSelectedPhoto} />
      <section className="wall-showcase">
        <div className="wall-section-title">
          <span className="eyebrow">作品发布会</span>
          <h2>可以点开的产品卡</h2>
        </div>
        <ShowcaseGallery items={showcaseItems} variant="wall" />
      </section>
      {selectedPhoto && <PhotoLightbox student={selectedPhoto} onClose={() => setSelectedPhoto(null)} />}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
