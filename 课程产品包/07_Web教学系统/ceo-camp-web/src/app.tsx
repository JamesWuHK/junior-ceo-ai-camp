import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Coins,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Hammer,
  Image,
  Link2,
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
  Share2,
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
  StudentWorkspace,
  TaskSubmission,
  TeacherProgressSnapshot,
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

const productTrackOptions = [
  {
    value: "life-helper",
    label: "生活帮手",
    hint: "家里、生活、照护、饮食、整理里的小麻烦",
    directions: ["宠物/家庭照护", "饮食/烹饪", "失物/寻物"]
  },
  {
    value: "learning-tool",
    label: "学习工具",
    hint: "作业、复习、背诵、错题、口语里的卡点",
    directions: ["错题/作业辅导", "口语/语言练习", "考试/复习规划"]
  },
  {
    value: "creative-studio",
    label: "创意工坊",
    hint: "写故事、画漫画、做歌、做视频的灵感和修改",
    directions: ["故事/阅读", "漫画创作", "歌词/音乐创作"]
  },
  {
    value: "campus-community",
    label: "校园社区",
    hint: "班级信息、活动、趣事、表扬和互助",
    directions: ["校园夸夸墙", "趣事/排行", "校园新闻/资讯"]
  }
] as const;

const techRouteOptions = [
  { value: "standard", label: "标准路线", hint: "用课堂推荐工具做出来" },
  { value: "light", label: "轻量路线", hint: "先做成可点击页面或表单" },
  { value: "advanced", label: "进阶路线", hint: "加一点更难但有用的能力" },
  { value: "fallback", label: "兜底路线", hint: "用截图和流程也能演示" }
] as const;

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

function useStudentVoiceInput(showMessage: (tone: StudentMessage["tone"], text: string) => void) {
  const [listeningKey, setListeningKey] = useState("");
  const speechRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    return () => speechRef.current?.abort?.();
  }, []);

  const startVoiceInput = (key: string, onText: (text: string) => void) => {
    const Recognition = getSpeechRecognition();
    if (!Recognition || isWechatBrowser()) {
      showMessage("hint", "可以用手机键盘语音输入，也可以直接打几个关键词。");
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
        onText(transcript);
        showMessage("hint", "听到了。你也可以再改一改。");
      }
    };
    recognition.onerror = () => {
      showMessage("hint", "这次没听清，可以用手机键盘语音输入。");
    };
    recognition.onend = () => setListeningKey("");
    setListeningKey(key);
    try {
      recognition.start();
    } catch {
      setListeningKey("");
      showMessage("hint", "可以用手机键盘语音输入，也可以直接打几个关键词。");
    }
  };

  return { listeningKey, startVoiceInput };
}

function FieldVoiceButton({
  fieldKey,
  label,
  listeningKey,
  onStart
}: {
  fieldKey: string;
  label: string;
  listeningKey: string;
  onStart: () => void;
}) {
  const listening = listeningKey === fieldKey;
  return (
    <button className="voice-mini-button" type="button" onClick={onStart} disabled={Boolean(listeningKey)}>
      {listening ? <Loader2 className="spin" size={16} /> : <Mic size={16} />}
      {listening ? "正在听" : label}
    </button>
  );
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
    cue: "他手里拿着什么工具？",
    image: openingImages.vet,
    alt: "孩子与一张未来职业照对比，画面里有动物、工具和工作场景"
  },
  {
    code: "样片 02",
    career: "机器人设计师",
    cue: "旁边的机器在做什么？",
    image: openingImages.robot,
    alt: "孩子与一张未来职业照对比，画面里有机器和工作台"
  },
  {
    code: "样片 03",
    career: "太空建筑师",
    cue: "他可能在哪里工作？",
    image: openingImages.space,
    alt: "孩子与一张未来职业照对比，画面里有太空装备和建筑场景"
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
  | "ai-workbench"
  | "ai-pipeline"
  | "ai-check-lights"
  | "evidence-check"
  | "market-scout"
  | "competitor-grid"
  | "interview-card"
  | "direction-map"
  | "product-sentence"
  | "prompt-card"
  | "ai-revise"
  | "agent-card"
  | "workflow-map"
  | "app-prototype"
  | "prototype-board"
  | "route-map"
  | "product-browser"
  | "testing-board"
  | "demo-strip"
  | "pricing-ticket"
  | "roadshow-pack"
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
  slide_image?: {
    src: string;
    alt: string;
  };
};

const aiCoursewareImages = {
  studio: "/courseware/opening/future-studio-cover.webp",
  space: "/courseware/opening/future-pair-space.webp",
  vet: "/courseware/opening/future-pair-vet.webp",
  robot: "/courseware/opening/future-pair-robot.webp"
};

const aiSketchnoteBasePath =
  "/courseware/baoyu-ai-knowledge-sketchnote/slide-deck/day1-ai-basics-sketchnote";

const aiJudgementSketchnoteSlides: Array<{
  page_no: number;
  title: string;
  content_summary: string;
  page_type: LessonPage["page_type"];
  image: string;
  alt: string;
}> = [
  {
    page_no: 1,
    title: "AI 是一个会学习的大脑",
    content_summary: "AI 能读文字、看图片、听声音，像电脑里的聪明大脑。",
    page_type: "story",
    image: "01-slide-ai-brain.png",
    alt: "手绘课件：机器人脑袋里有会学习的大脑，旁边标出能读文字、能看图片、能听声音"
  },
  {
    page_no: 2,
    title: "你给它任务，它开始工作",
    content_summary: "孩子写下任务纸条，AI 收到线索后开始生成结果。",
    page_type: "story",
    image: "02-slide-task-starts.png",
    alt: "手绘课件：孩子把任务纸条送进 AI 大脑，AI 开始工作"
  },
  {
    page_no: 3,
    title: "照片也是线索",
    content_summary: "照片里的人物、表情、姿势，也能成为 AI 看懂的线索。",
    page_type: "demo",
    image: "03-slide-photo-clue.png",
    alt: "手绘课件：AI 用放大镜看照片里的人物、表情和姿势"
  },
  {
    page_no: 4,
    title: "它以前看过很多例子",
    content_summary: "AI 学过很多照片、职业照、工具和场景，所以能按线索画新图。",
    page_type: "demo",
    image: "04-slide-many-examples.png",
    alt: "手绘课件：AI 大脑周围围着很多职业和场景例子"
  },
  {
    page_no: 5,
    title: "三张线索卡，画出新画面",
    content_summary: "照片、职业、任务三张线索卡一起进入 AI，得到新的未来画面。",
    page_type: "demo",
    image: "05-slide-three-clues.png",
    alt: "手绘课件：照片、职业、任务三张线索卡进入 AI，生成一张新的未来职业图"
  },
  {
    page_no: 6,
    title: "说清楚，AI 才好帮你",
    content_summary: "太短的问题容易跑偏，把职业、地点和动作说清楚，结果会更好。",
    page_type: "demo",
    image: "06-slide-clear-task.png",
    alt: "手绘课件：对比太短的任务和说清楚的任务，右侧画面更具体"
  },
  {
    page_no: 7,
    title: "AI 画完，人来做导演",
    content_summary: "AI 给出结果后，孩子继续看线索、选一张、再修改。",
    page_type: "demo",
    image: "07-slide-human-director.png",
    alt: "手绘课件：孩子像导演一样看 AI 生成的几张图，圈出线索并准备修改"
  },
  {
    page_no: 8,
    title: "先说清楚，让 AI 画一张",
    content_summary: "把想画谁、在哪里、正在做什么说清楚，再让 AI 画第一张。",
    page_type: "experiment",
    image: "08-slide-first-image-task.png",
    alt: "手绘课件：用未来的我、动物医院、给小狗检查三个信息组成清楚任务"
  },
  {
    page_no: 9,
    title: "找茬儿：这张图哪里怪？",
    content_summary: "孩子找出图里的小问题，再告诉 AI 改哪里、看新版。",
    page_type: "experiment",
    image: "09-slide-find-odd-details.png",
    alt: "手绘课件：孩子在 AI 第一张图里找出问题，并写便签让 AI 修改"
  }
];

const aiJudgementPageMeta: Record<
  number,
  {
    title: string;
    content_summary: string;
    kicker: string;
    chips: string[];
    page_type: LessonPage["page_type"];
  }
> = {
  1: {
    title: "什么是 AI？",
    content_summary: "它像电脑里的聪明大脑：先读懂线索，再回答、画图或帮你做作品。",
    kicker: "10:00-11:10 · 故事开场",
    chips: ["读线索", "想答案", "做作品"],
    page_type: "story"
  },
  2: {
    title: "AI 先会读字和聊天",
    content_summary: "你打字问它，它读懂你的话，再用文字回答你。",
    kicker: "10:00-11:10 · 故事开场",
    chips: ["你提问", "它读懂", "它回答"],
    page_type: "story"
  },
  3: {
    title: "老师演示：问得清楚，回答才有用",
    content_summary: "同样问 DeepSeek，说清帮谁、卡哪一步，答案马上变具体。",
    kicker: "10:00-11:10 · 老师演示",
    chips: ["模糊问题", "清楚问题", "答案变具体"],
    page_type: "demo"
  },
  4: {
    title: "AI 还能看图：照片也是线索",
    content_summary: "除了文字，AI 也能看懂图片里的脸、动作和地方。",
    kicker: "10:00-11:10 · 老师演示",
    chips: ["看图片", "读文字", "合起来理解"],
    page_type: "demo"
  },
  5: {
    title: "未来照相馆是这样画出来的",
    content_summary: "照片给样子，职业给方向，要求告诉它画成什么。",
    kicker: "10:00-11:10 · 老师演示",
    chips: ["照片", "职业", "要求"],
    page_type: "demo"
  },
  6: {
    title: "轮到你：问 DeepSeek 一句清楚问题",
    content_summary: "把团队方向填进去，挑出一句今天能继续讨论的线索。",
    kicker: "10:00-11:10 · 轮到你实验",
    chips: ["填方向", "问清楚", "挑一句"],
    page_type: "experiment"
  }
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
    chips: ["创业方向", "团队命名", "四格判断"],
    steps: ["先看谁需要", "再看什么场景", "最后决定方向"],
    cards: [
      { title: "人群", text: "谁会真的需要帮助" },
      { title: "场景", text: "这件事发生在哪里" },
      { title: "麻烦", text: "最卡住的一步是什么" },
      { title: "动作", text: "我们可以先帮他做哪一步" }
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
    icon: MessageSquareText,
    accent: "blue",
    chips: ["AI 大脑", "文字对话", "图像生成"],
    steps: ["认识 AI 是什么", "看 DeepSeek 怎么聊天", "再解密未来照相馆"],
    cards: [
      { title: "读文字", text: "看懂你打出来的问题" },
      { title: "会对话", text: "用文字继续回答你" },
      { title: "看图片", text: "读到照片里的线索" },
      { title: "生成内容", text: "写一段话，或画一张图" }
    ],
    flow: [
      { title: "我是谁", text: "请你当产品顾问" },
      { title: "要做什么", text: "帮我们看这个方向可能帮谁" },
      { title: "怎么回答", text: "用三句话，给一个例子" }
    ]
  },
  "ai-superpowers": {
    icon: Brain,
    accent: "blue",
    chips: ["豆包改写", "DeepSeek 侦察", "问真人"],
    steps: ["把烦恼改成可采访问题", "找已有解决办法", "带着新问题问真人"],
    cards: [
      { title: "原始烦恼", text: "作业好烦" },
      { title: "可采访问题", text: "谁、在哪、卡在哪" },
      { title: "已有方案", text: "别人已经怎么解决" },
      { title: "真人问题", text: "还要继续问什么" }
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
    chips: ["定方向", "收需求", "明天先做"],
    steps: ["确定想帮谁", "计划收集哪些需求", "圈出 Day 2 先做动作"],
    cards: [
      { title: "方向", text: "团队今天定下来的主题" },
      { title: "需求", text: "接下来要问谁、看什么" },
      { title: "内容", text: "明天准备先做哪一个动作" },
      { title: "上墙", text: "让全班看到每组方向" }
    ]
  },
  "day1-reflection": {
    icon: Star,
    accent: "mint",
    chips: ["方向墙", "行动计划", "明天开工"],
    steps: ["看见每组方向", "补齐需求收集计划", "带着一个动作进 Day 2"],
    cards: [
      { title: "团队方向", text: "想帮谁，做什么方向" },
      { title: "需求计划", text: "问谁、问什么、看什么" },
      { title: "Day 2 动作", text: "明天先让哪一步跑起来" }
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
    chips: ["大模型", "豆包三版", "DeepSeek 检查"],
    steps: ["写一句模糊任务", "补成五句提示词", "让 AI 出三版后再检查"],
    cards: [
      { title: "大模型", text: "根据输入继续生成内容" },
      { title: "提示词", text: "给 AI 的任务说明" },
      { title: "检查", text: "看哪里夸张、哪里缺证据" }
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
    chips: ["智能体", "工作流", "应用原型"],
    steps: ["先让产品会回答一个真实问题", "把固定步骤排清楚", "生成一个可打开的第一版"],
    cards: [
      { title: "扣子", text: "做一个有任务和边界的智能体" },
      { title: "工作流", text: "收集信息、判断、输出结果" },
      { title: "秒哒", text: "把产品一句话变成可打开原型" }
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
    chips: ["作品链接", "路演 PPT", "上台顺序"],
    steps: ["把已有材料放到一起", "整理 5 分钟路演顺序", "只提交作品链接和路演 PPT"],
    cards: [
      { title: "WorkBuddy", text: "把散乱材料整理成交付物" },
      { title: "路演顺序", text: "用户、作品、证据、下一步" },
      { title: "轻提交", text: "作品链接和路演 PPT 就够了" }
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
    chips: ["观察员追问", "证据回答", "下一步"],
    steps: ["听懂观察员的问题", "用采访和试玩做证据", "说出下一步先改哪里"],
    cards: [
      { title: "结论", text: "先直接回答问题" },
      { title: "证据", text: "再拿出采访或试玩反馈" },
      { title: "下一步", text: "最后说准备先改哪里" }
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
    { page_no: 1, title: "团队讨论：生活小麻烦", page_type: "teamwork", content_summary: "每个人先写一个真实遇到过的小麻烦" },
    { page_no: 2, title: "抓一张最想追的线索", page_type: "teamwork", content_summary: "团队把小麻烦写成谁、在哪、卡在哪" },
    { page_no: 3, title: "老师巡场：需求有没有人", page_type: "coaching", content_summary: "老师观察问题是否有真实用户和具体场景" }
  ],
  "user-interview": [
    { page_no: 1, title: "团队分工：谁采访，谁记录", page_type: "teamwork", content_summary: "团队分好采访、记录、追问和整理责任" },
    { page_no: 2, title: "带着三问去采访", page_type: "teamwork", content_summary: "问真实用户发生过吗、多久一次、现在怎么解决" },
    { page_no: 3, title: "老师巡场：原话够不够真", page_type: "coaching", content_summary: "老师看采访原话、频率和现在办法，帮助团队追问" }
  ],
  "product-prototype": [
    { page_no: 1, title: "团队讨论：功能全倒出来", page_type: "teamwork", content_summary: "团队把想做的功能先全部放到桌面上" },
    { page_no: 2, title: "选择核心动作", page_type: "teamwork", content_summary: "团队留下别人 30 秒能看懂、能试用的一步" },
    { page_no: 3, title: "老师巡场：第一版能被试用吗", page_type: "coaching", content_summary: "老师观察第一版是否小到能做、清楚到能试" }
  ],
  "ai-lab": [
    { page_no: 1, title: "大模型需要清楚任务", page_type: "story", content_summary: "豆包和 DeepSeek 都能生成内容，但要先听清任务" },
    { page_no: 2, title: "老师演示：豆包先出三版", page_type: "demo", content_summary: "输入目标、用户、材料、限制和格式，让豆包给出多个版本" },
    { page_no: 3, title: "老师演示：DeepSeek 帮忙检查", page_type: "demo", content_summary: "把豆包第一版交给 DeepSeek，看哪里太夸张、哪里缺证据" },
    { page_no: 4, title: "五句提示词卡", page_type: "experiment", content_summary: "给自己的产品写一张可复用提示词卡" }
  ],
  "brand-story": [
    { page_no: 1, title: "观察员会追问", page_type: "story", content_summary: "好路演要经得起提问：你怎么知道真的有人需要" },
    { page_no: 2, title: "老师演示：DeepSeek 模拟追问", page_type: "demo", content_summary: "让 DeepSeek 扮演观察员，围绕用户、作品、证据和下一步提问" },
    { page_no: 3, title: "结论、证据、下一步", page_type: "experiment", content_summary: "每组选 2 个最可能被问到的问题，用证据回答" }
  ],
  "roadshow-rehearsal": [
    { page_no: 1, title: "发布会前，材料铺满桌面", page_type: "story", content_summary: "作品链接、截图、采访证据和分工都在桌上，需要排成路演顺序" },
    { page_no: 2, title: "老师演示：WorkBuddy 整理材料包", page_type: "demo", content_summary: "把已有材料整理成 5 分钟路演顺序、成员分工和 PPT 大纲" },
    { page_no: 3, title: "作品链接和路演 PPT", page_type: "experiment", content_summary: "每组只提交作品链接和路演 PPT，让材料保持轻巧" }
  ],
  "final-showcase": [
    { page_no: 1, title: "融资路演发布会开场", page_type: "showcase", content_summary: "每组把作品、用户和下一步讲给观察员" },
    { page_no: 2, title: "每组 5 分钟融资路演", page_type: "showcase", content_summary: "让大家看到用户怎么用、结果是什么" },
    { page_no: 3, title: "观察员提问和投票", page_type: "showcase", content_summary: "观察员提问、投票，也给出下一步建议" }
  ],
  "awards-reflection": [
    { page_no: 1, title: "证据星星落到每个人手上", page_type: "showcase", content_summary: "共情力、提问力、创造力、判断力、领导力都有证据" },
    { page_no: 2, title: "每个人的贡献被看见", page_type: "showcase", content_summary: "看见每个人在团队里的真实贡献" },
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
    (knowledgeInputModules.has(module.id)
      ? [
          {
            page_no: 1,
            title: `${module.title}的故事开场`,
            page_type: "story",
            content_summary: module.subtitle || "先进入一个真实场景"
          },
          {
            page_no: 2,
            title: "老师先演示一遍",
            page_type: "demo",
            content_summary: "看见输入、动作和结果怎样连起来"
          },
          {
            page_no: 3,
            title: "轮到你做一次实验",
            page_type: "experiment",
            content_summary: "做出一个小结果，再看哪里可以改得更好"
          }
        ]
      : [
          {
            page_no: 1,
            title: `${module.title}团队讨论`,
            page_type: "teamwork",
            content_summary: module.subtitle || "团队先讨论要做出的决定"
          },
          {
            page_no: 2,
            title: `${module.title}小组产出`,
            page_type: "teamwork",
            content_summary: "孩子分工协作，完成一个能展示的产出"
          },
          {
            page_no: 3,
            title: `${module.title}老师巡场`,
            page_type: "coaching",
            content_summary: "老师答疑解惑，观察记录团队过程"
          }
        ]);

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
    story: ["讲故事", "看冲突", "猜下一步"],
    activity: ["做实验", "留下证据", "准备展示"],
    experiment: ["做实验", "看变化", "改一版"],
    demo: ["看演示", "找变化", "借方法"],
    "ai-demo": ["看演示", "找变化", "借方法"],
    showcase: ["看结果", "说亮点", "借方法"],
    cover: ["进入故事", "准备行动", "期待结果"]
  };
  if (module.id === "ai-judgement") {
    const meta = aiJudgementPageMeta[page.page_no];
    if (meta) {
      return {
        ...page,
        title: meta.title,
        page_type: meta.page_type,
        content_summary: meta.content_summary,
        kicker: meta.kicker,
        chips: meta.chips,
        visual: visualForPage({ ...page, page_type: meta.page_type }),
        accent: design?.accent ?? "ink",
        cards: design?.cards,
        steps: design?.steps,
        flow: design?.flow
      };
    }
  }
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
  if (module.id === "ai-judgement") {
    const base = module.pages[0] ?? {
      id: "ai-judgement-page",
      module_id: module.id,
      page_no: 1,
      title: "",
      page_type: "story",
      activity_buttons: []
    };
    return aiJudgementSketchnoteSlides.map((slide) => ({
      ...base,
      id: `ai-judgement-sketchnote-${slide.page_no}`,
      module_id: module.id,
      page_no: slide.page_no,
      title: slide.title,
      page_type: slide.page_type,
      activity_buttons: slide.page_type === "experiment" ? ["全屏演示", "发布任务"] : ["全屏演示"],
      content_summary: slide.content_summary,
      kicker: slide.page_no <= 2 ? "10:00-11:10 · 故事开场" : slide.page_no <= 7 ? "10:00-11:10 · 老师演示" : "10:00-11:10 · 轮到你实验",
      chips: slide.page_no <= 2 ? ["认识 AI", "看见线索", "准备提问"] : slide.page_no <= 7 ? ["看演示", "找变化", "借方法"] : ["做实验", "找问题", "改一版"],
      visual: "demo",
      accent: moduleDesigns[module.id]?.accent ?? "blue",
      cards: moduleDesigns[module.id]?.cards,
      steps: moduleDesigns[module.id]?.steps,
      flow: moduleDesigns[module.id]?.flow,
      slide_image: {
        src: `${aiSketchnoteBasePath}/${slide.image}`,
        alt: slide.alt
      }
    }));
  }
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
      title: "先猜猜职业",
      page_type: "image",
      activity_buttons: ["发起互动", "投屏展示"],
      content_summary: "看几组现在照片和未来职业照，先猜职业"
    },
    {
      ...base,
      id: "future-photo-your-turn",
      page_no: 3,
      title: "下一张轮到你",
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
      title: "照片怎么画出来",
      page_type: "experiment",
      activity_buttons: ["全屏演示"],
      content_summary: "AI 看照片，也读职业和任务，再画出新的未来想象照"
    }
  ] as DesignedLessonPage[];
}

function lessonPageTitle(module: CourseModule | null | undefined, page: DesignedLessonPage) {
  if (module?.id !== "future-photo-studio") return page.title;
  const titles: Record<number, string> = {
    1: "照相馆开门",
    2: "先猜猜职业",
    3: "下一张轮到你",
    4: "照片墙亮起来",
    5: "照片怎么画出来"
  };
  return titles[page.page_no] ?? page.title;
}

function lessonModuleTitle(module: CourseModule | null | undefined) {
  if (!module) return "未来照相馆";
  if (module.id === "future-photo-studio") return "未来照相馆";
  return module.title;
}

function lessonModuleSubtitle(module: CourseModule | null | undefined) {
  if (!module) return "";
  if (module.id === "future-photo-studio") return "先看照片，猜猜他们长大后在做什么";
  return module.subtitle;
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
    teamwork: "团队讨论，做出小组产出",
    coaching: "巡场答疑，观察记录过程",
    showcase: "展示结果，借走好方法"
  };
  return moves[page.page_type] ?? "推进当前课堂动作";
}

function expectedOutputForPage(page: DesignedLessonPage) {
  const outputs: Record<string, string> = {
    "下一张轮到你": "学生端提交一张照片和一个理想职业",
    "问题改写卡": "每组把一个烦恼改成可采访问题",
    "AI 市场侦察卡": "每组带回 3 条可验证线索",
    "老师演示：DeepSeek 找已有方案": "每组知道已有方案、一个不足和还要问真人的问题",
    "竞品观察三格": "说出一个已有方案和一个不同角度",
    "选一条赛道，找到一个真实用户": "每组选定赛道和真实用户",
    "把线索变成产品一句话": "每组写出产品一句话",
    "五句提示词卡": "每组写出一张可复用提示词卡",
    "对 AI 说：不对，再改": "每组留下一个改前改后对比",
    "老师演示：扣子最小智能体": "每组知道智能体要写清任务和边界",
    "工作流：把步骤排清楚": "每组写出 3 到 4 步工作流",
    "老师演示：秒哒生成应用原型": "每组知道怎样描述可打开原型",
    "生成可打开的 V1": "每组得到一个作品链接或截图",
    "真产品检查": "作品能打开，别人能完成一个动作",
    "定价三问": "每组说清谁会用、付出什么、为什么值得",
    "作品页上线清单": "作品名、链接、截图、用户故事准备好",
    "家长观察员提问": "每组准备回答一个真实追问",
    "五力证书": "每个孩子有一条可被看见的贡献证据",
    "团队讨论：选择创业方向": "每组从证据里选出一个创业方向",
    "需求三问：用户、场景、动作": "每组把方向缩小到一个具体需求",
    "产品方案一句话": "每组写出产品一句话",
    "团队选择制作路线": "每组选定今天能完成的制作路线",
    "画出用户使用流程": "每组画出 3 到 5 步使用流程",
    "发布会前，材料铺满桌面": "每组看清已有材料还差什么",
    "老师演示：WorkBuddy 整理材料包": "每组知道怎样整理路演材料",
    "作品链接和路演 PPT": "每组只提交作品链接和路演 PPT",
    "结论、证据、下一步": "每组准备 2 个追问回答",
    "每个人的贡献被看见": "每个孩子有一条可被看见的贡献证据",
    "下一次我怎么指挥 AI": "每个孩子写下一张成长卡"
  };
  if (outputs[page.title]) return outputs[page.title];
  if (page.page_type === "activity") return "孩子完成一个可展示的小结果";
  if (page.page_type === "teamwork") return "团队完成一个阶段产出";
  if (page.page_type === "coaching") return "老师记录卡点、贡献和下一步支援";
  if (page.page_type === "showcase") return "全班看见作品或方法亮点";
  if (page.page_type === "experiment") return "保留一次变化和判断理由";
  if (page.page_type === "demo" || page.page_type === "ai-demo") return "找到一个可以继续修改的地方";
  return page.content_summary || "进入当前教学环节";
}

function timerMinutesForPage(page: DesignedLessonPage) {
  if (page.title.includes("制作") || page.title.includes("彩排")) return 15;
  if (page.title.includes("采访")) return 12;
  if (page.title.includes("路演")) return 10;
  if (page.title.includes("作品秀") || page.title.includes("故事发布")) return 5;
  if (page.page_type === "teamwork") return 8;
  if (page.page_type === "coaching") return 5;
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
  if (/带走一个 AI 判断方法|AI 判断方法|AI 跑偏|改回来|问出第一条好问题|留下能用的一句|给 DeepSeek 一张任务单|AI 的回答怎么用/.test(page.title)) return "learning_reflection";
  if (/给贡献一个名字|五力证书|个人贡献|贡献卡|贡献被看见/.test(page.title)) return "contribution_card";
  if (/团队名片|团队名称和方向|团队名和方向卡|给团队起名|找到你的桌号|找到队友|名字和方向|团队方向亮相/.test(page.title)) return "team_card";
  if (/AI 给答案，先看证据|AI 留下一句可疑答案|证据追踪|真假侦探实验|证据比声音更有力/.test(page.title)) return "ai_validation";
  if (/问题改写卡|把候选问题改清楚|AI 市场侦察卡|竞品观察三格/.test(page.title)) return "market_scout";
  if (/五句提示词卡|改一版再试|对 AI 说：不对，再改/.test(page.title)) return "prompt_card";
  if (/团队讨论：功能全倒出来|功能先发散|只留下一个核心动作|选择核心动作|核心动作够小|最小可行产品|明天要做出的第一版|先让一个动作动起来/.test(page.title)) return "feature_scope";
  if (/团队选择制作路线|画出用户使用流程|选择今天能完成的路线|画出今天能完成的路线|用户走 3 步|用户打开后第一步做什么|流程图检查|工作流|智能体/.test(page.title)) return "tech_route";
  if (/生成可打开的 V1|秒哒生成应用原型|作品链接和路演 PPT/.test(page.title)) return "product_link";
  if (/反馈进作品|改出 V2|试玩互测|团队互测|反馈怎么进作品|V2 先改/.test(page.title)) return "iteration_plan";
  if (/帮别人少烦了什么|价值交换榜|定价三问|别人愿意交换/.test(page.title)) return "value_card";
  if (/产品包装|产品海报|海报不是装饰|产品摊位预览|给产品一个名字|标语|卖点/.test(page.title)) return "product_packaging";
  if (/把作品讲成一个小故事|故事发布五步卡|故事发布五步|问答预演|结论、证据、下一步/.test(page.title)) return "story_pitch";
  if (/产品方案一句话|需求三问|选择创业方向|产品摊位开张|需求收集计划|方向和行动计划卡|补齐行动计划|团队讨论：我们想帮谁/.test(page.title)) return "product_definition";
  if (/融资路演|路演材料|最终展示/.test(page.title)) return "final_showcase";
  if (action === "进入评分") return "score";
  if (action === "发起互动") return "interaction";
  if (action === "打开看板") return "board";
  if (page.page_type === "showcase") return "showcase";
  return page.page_type || "lesson";
}

function activeTaskTitle(camp: Camp | null) {
  return camp?.active_task?.title || "";
}

function isTeamCardTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "team_card" ||
    payloadType === "team_card" ||
    moduleId === "team-formation" ||
    /团队名片|团队名称和方向|团队名和方向卡|给团队起名|找到你的桌号|找到队友|名字和方向/.test(title)
  );
}

function isContributionCardTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "contribution_card" ||
    payloadType === "contribution_card" ||
    (moduleId === "awards-reflection" && /给贡献一个名字|五力证书|个人贡献|贡献卡|贡献被看见/.test(title)) ||
    /给贡献一个名字|五力证书|个人贡献|贡献卡|贡献被看见/.test(title)
  );
}

function isProductLinkTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  return (
    !isBlockerTask(camp) &&
    !isLearningReflectionTask(camp) &&
    (/作品链接|产品链接|真产品检查|作品页上线清单|产品原型|每组作品能打开|2 分钟 Demo|路演材料|融资路演|生成可打开的 V1|秒哒生成应用原型|路演 PPT/.test(title) ||
    ["build-sprint", "demo-check", "roadshow-rehearsal", "rehearsal"].includes(moduleId)
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
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "ai_validation" ||
    payloadType === "ai_validation" ||
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

function isFeatureScopeTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "feature_scope" ||
    payloadType === "feature_scope" ||
    moduleId === "product-prototype" ||
    /团队讨论：功能全倒出来|功能先发散|功能清单|核心动作|选择核心动作|最小可行产品|明天要做出的第一版|先让一个动作动起来/.test(title)
  );
}

function isTechRouteTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "tech_route" ||
    payloadType === "tech_route" ||
    moduleId === "tech-route" ||
    /技术路线|路线卡|用户流程|流程图|工作流|智能体|今天能完成的路线|用户打开后第一步|团队选择制作路线|画出用户使用流程/.test(title)
  );
}

function isIterationPlanTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "iteration_plan" ||
    payloadType === "iteration_plan" ||
    /反馈进作品|改出 V2|迭代清单|团队互测|反馈怎么进作品|V2 先改/.test(title)
  );
}

function isValueCardTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "value_card" ||
    payloadType === "value_card" ||
    (moduleId === "value-experiment" && /帮别人少烦了什么|价值交换|定价三问|别人愿意交换|星星币/.test(title)) ||
    /价值卡|价值交换|星星币|愿意交换|帮别人少烦了什么/.test(title)
  );
}

function isProductPackagingTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "product_packaging" ||
    payloadType === "product_packaging" ||
    (moduleId === "product-packaging" && /产品包装|产品海报|海报不是装饰|产品摊位预览|给产品一个名字|标语|卖点/.test(title)) ||
    /产品海报卡|产品包装|产品海报|海报不是装饰|产品摊位预览|给产品一个名字/.test(title)
  );
}

function isStoryPitchTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "story_pitch" ||
    payloadType === "story_pitch" ||
    (moduleId === "brand-story" && /故事发布五步卡|故事发布五步|把作品讲成一个小故事|问答预演|故事结构/.test(title)) ||
    /故事发布五步卡|故事发布五步|故事结构|故事稿|把作品讲成一个小故事|结论、证据、下一步|观察员会追问|模拟追问/.test(title)
  );
}

function isProductDefinitionTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "product_definition" ||
    payloadType === "product_definition" ||
    moduleId === "project-launch" ||
    /产品一句话|产品定义|把线索变成产品一句话|产品卡片|选一条赛道|真实用户|赛道地图|选择创业方向|需求三问|产品方案一句话|需求收集计划|方向和行动计划|补齐行动计划|明天先做哪一步/.test(title)
  );
}

function isFinalShowcaseTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  return (moduleId === "final-showcase" || /路演|作品展|最终展示|每组上场/.test(title)) && !isObserverScoreTask(camp) && !isStoryPitchTask(camp);
}

function isGrowthReflectionTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "growth_reflection" ||
    payloadType === "growth_reflection" ||
    (moduleId === "awards-reflection" && /下一次我怎么指挥 AI|结营反思|写反思/.test(title)) ||
    /下一次我怎么指挥 AI|结营反思|写反思/.test(title)
  );
}

function isLearningReflectionTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "learning_reflection" ||
    payloadType === "learning_reflection" ||
    (moduleId === "ai-judgement" && /DeepSeek|任务单|有用的一句|问真人|问同学|回答怎么用|太大太远|先放下/.test(title)) ||
    (moduleId === "day1-reflection" && /带走一个 AI 判断方法|判断方法|收束/.test(title)) ||
    (moduleId === "demo-check" && /AI 跑偏|改回来|修正|反思/.test(title)) ||
    /带走一个 AI 判断方法|AI 判断方法|AI 跑偏|改回来|修正方法|给 DeepSeek 一张任务单|AI 的回答怎么用/.test(title)
  );
}

function isPeerFeedbackTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  return !isIterationPlanTask(camp) && (/先看别人怎么用|试玩|试用|互测/.test(title) || moduleId === "user-testing");
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

function LiveDataRoute({ active }: { active: "student" | "wall" }) {
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

export function StudentRoute() {
  return <LiveDataRoute active="student" />;
}

export function WallRoute() {
  return <LiveDataRoute active="wall" />;
}

export type TeacherView = "lesson" | "workspace" | "progress" | "students" | "submissions" | "showcase";

const teacherViewMeta: Record<TeacherView, { label: string; title: string; description: string; href: string }> = {
  lesson: {
    label: "授课首页",
    title: "三天课程授课台",
    description: "按教学时间线切课件、发任务、投屏和计时。",
    href: "/teacher.html"
  },
  workspace: {
    label: "团队空间",
    title: "团队空间",
    description: "看分组、角色、项目状态和团队当前材料。",
    href: "/teacher-workspace.html"
  },
  progress: {
    label: "进度看板",
    title: "团队进度看板",
    description: "快速看到每组提交、卡点和需要现场支援的地方。",
    href: "/teacher-progress.html"
  },
  students: {
    label: "学员与照片",
    title: "学员与照片",
    description: "维护学生账号，处理未来照相馆作品上墙。",
    href: "/teacher-students.html"
  },
  submissions: {
    label: "课堂提交",
    title: "课堂提交汇总",
    description: "查看问题、提示词、路线、作品入口、反馈和迭代记录。",
    href: "/teacher-submissions.html"
  },
  showcase: {
    label: "作品与评分",
    title: "作品与评分",
    description: "整理最终展示卡、观察员评分、分享链接和公开作品区。",
    href: "/teacher-showcase-admin.html"
  }
};

const teacherViewLinks: Array<{ key: TeacherView; icon: React.ReactNode }> = [
  { key: "lesson", icon: <Play size={18} /> },
  { key: "workspace", icon: <UsersRound size={18} /> },
  { key: "progress", icon: <ClipboardCheck size={18} /> },
  { key: "students", icon: <ShieldCheck size={18} /> },
  { key: "submissions", icon: <StickyNote size={18} /> },
  { key: "showcase", icon: <Trophy size={18} /> }
];

function teacherViewFromLocation(): TeacherView {
  const searchView = new URLSearchParams(window.location.search).get("view");
  if (searchView && searchView in teacherViewMeta) return searchView as TeacherView;
  const path = window.location.pathname;
  if (path.includes("teacher-workspace")) return "workspace";
  if (path.includes("teacher-progress")) return "progress";
  if (path.includes("teacher-students")) return "students";
  if (path.includes("teacher-submissions")) return "submissions";
  if (path.includes("teacher-showcase-admin")) return "showcase";
  return "lesson";
}

export function TeacherRoute({ initialView }: { initialView?: TeacherView } = {}) {
  const [authStatus, setAuthStatus] = useState<"checking" | "guest" | "authed">(
    hasTeacherToken() ? "checking" : "guest"
  );
  const [teacher, setTeacher] = useState<TeacherAccount | null>(getTeacherAccount());
  const data = useTeacherData(authStatus === "authed");
  const view = initialView || teacherViewFromLocation();

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
      view={view}
      onLoggedOut={() => {
        clearTeacherToken();
        setTeacher(null);
        setAuthStatus("guest");
      }}
    />
  );
}

export function PublicShowcaseRoute() {
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
  const [shareMessage, setShareMessage] = useState("");
  const selectedProjectId = searchParams.get("project") || "";
  const publicRoute = window.location.pathname.startsWith("/parents") ? "/parents" : "/showcase";
  const showcaseShareUrl = absoluteUrl(publicRoute);

  const copyShareLink = async (url: string, label = "链接") => {
    try {
      await copyToClipboard(url);
      setShareMessage(`${label}已复制。`);
      window.setTimeout(() => setShareMessage(""), 2200);
    } catch {
      setShareMessage("复制失败，可以手动选中链接。");
    }
  };

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
        <div className="public-share-bar">
          <input readOnly value={showcaseShareUrl} aria-label="作品展链接" onFocus={(event) => event.currentTarget.select()} />
          <button type="button" onClick={() => copyShareLink(showcaseShareUrl, "作品展链接")}>
            <Copy size={16} />
            复制作品展链接
          </button>
        </div>
        {shareMessage && <small className="public-share-message">{shareMessage}</small>}
      </header>
      <section className="public-section">
        <div className="public-section-title">
          <span>结营路演</span>
          <h2>小组最终展示卡</h2>
        </div>
        <div className="public-final-grid">
          {finalItems.map((item, index) => {
            const href = asText(item.payload.access_url);
            const pitchDeckUrl = asText(item.payload.pitch_deck_url);
            const productName = asText(item.payload.product_name);
            const packagingItem = projectJourney.find((journeyItem) =>
              journeyItem.task_type === "product_packaging" &&
              journeyItemMatchesProject(journeyItem, productName, item.team_id, item.team_name)
            );
            const storyItem = projectJourney.find((journeyItem) =>
              journeyItem.task_type === "story_pitch" &&
              journeyItemMatchesProject(journeyItem, productName, item.team_id, item.team_name)
            );
            const screenshot = asText(item.payload.screenshot_url) || asText(packagingItem?.payload.poster_url);
            const recording = asText(item.payload.recording_url);
            const cardLine = asText(item.payload.value_line) || asText(packagingItem?.payload.slogan) || asText(storyItem?.payload.story_hook) || "这组作品正在整理介绍。";
            const projectHref = publicProjectUrl(item.id);
            const projectShareUrl = absoluteUrl(publicProjectUrl(item.id, publicRoute));
            return (
              <article className="public-final-card" key={item.id}>
                <div className="public-final-shot">
                  {screenshot ? (
                    <img src={normalizeShowcaseUrl(screenshot)} alt={productName || "作品展示图"} />
                  ) : recording ? (
                    <video src={normalizeShowcaseUrl(recording)} controls preload="metadata" playsInline />
                  ) : (
                    <Trophy size={42} />
                  )}
                </div>
                <div>
                  <span>第 {displayOrderFor(item) === 9999 ? index + 1 : displayOrderFor(item)} 组 · {item.team_name || "项目团队"}</span>
                  <strong>{productName || "未命名作品"}</strong>
                  <p>{cardLine}</p>
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
                  <button type="button" onClick={() => copyShareLink(projectShareUrl, "作品页链接")}>
                    <Copy size={16} />
                    复制作品页
                  </button>
                  {href && (
                    <a href={normalizeShowcaseUrl(href)} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} />
                      打开作品
                    </a>
                  )}
                  {pitchDeckUrl && (
                    <a href={normalizeShowcaseUrl(pitchDeckUrl)} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} />
                      路演 PPT
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

function publicProjectUrl(projectId: string, route = window.location.pathname.startsWith("/parents") ? "/parents" : "/showcase") {
  return `${route}?project=${encodeURIComponent(projectId)}`;
}

function absoluteUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${window.location.origin}${normalized}`;
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function splitList(value: unknown) {
  return asText(value)
    .split(/[\n,，、;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

type PersonalContributionCard = {
  name: string;
  contribution: string;
  tag: string;
  nextPractice?: string;
};

const contributionAbilityTags = ["共情力", "提问力", "创造力", "判断力", "领导力", "团队贡献"];

function contributionTagAt(index: number) {
  return contributionAbilityTags[index % contributionAbilityTags.length];
}

function normalizeContributionCards(value: unknown): PersonalContributionCard[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const name = asText(source.name).trim();
      const contribution = asText(source.contribution).trim();
      const tag = asText(source.tag).trim() || asText(source.ability_tag).trim() || contributionTagAt(index);
      const nextPractice = asText(source.nextPractice).trim() || asText(source.next_practice).trim();
      return { name, contribution, tag, nextPractice };
    })
    .filter((item) => item.name || item.contribution);
}

function contributionCardsFromPayload(payload: Record<string, unknown> | undefined, awards: AwardResult[] = []) {
  const structuredCards = normalizeContributionCards(payload?.personal_contribution_cards);
  if (structuredCards.length) return structuredCards;
  const contributionLines = splitList(payload?.personal_contributions);
  if (contributionLines.length) {
    return contributionLines.map((line, index) => {
      const [name, ...rest] = line.split(/[：:]/);
      return {
        name: (rest.length ? name : line).trim(),
        contribution: rest.join("：").trim() || "为团队作品贡献了自己的力量",
        tag: awards[index % Math.max(awards.length, 1)]?.award_type || contributionTagAt(index),
        nextPractice: ""
      };
    });
  }
  return splitList(payload?.team_members).map((member, index) => ({
    name: member,
    contribution: index === 0 ? "把团队想法带到台前" : "和团队一起完成作品展示",
    tag: awards[index % Math.max(awards.length, 1)]?.award_type || "团队贡献",
    nextPractice: ""
  }));
}

function contributionCards(finalItem: WallArtifact | null, awards: AwardResult[], reflections: WallArtifact[] = []) {
  const reflectionCards = reflections.map((reflection) => {
    const ability = asText(reflection.payload.ability_tag) || awards[0]?.award_type || "能力标签";
    if (reflection.task_type === "contribution_card") {
      return {
        name: asText(reflection.payload.name) || reflection.student_name || "一位少年 CEO",
        contribution: asText(reflection.payload.contribution) || asText(reflection.payload.evidence) || "写下了一项真实贡献",
        tag: ability,
        nextPractice: asText(reflection.payload.next_practice)
      };
    }
    const evidence = asText(reflection.payload.evidence).trim();
    const humanDecision = asText(reflection.payload.human_decision).trim();
    const aiJob = asText(reflection.payload.ai_job).trim();
    const nextPractice = asText(reflection.payload.next_practice).trim();
    return {
      name: reflection.student_name || "一位少年 CEO",
      contribution: evidence || humanDecision || aiJob || "写下了自己的 AI 协作证据",
      tag: ability,
      nextPractice
    };
  });
  const fallbackCards = contributionCardsFromPayload(finalItem?.payload, awards);
  const reflectedNames = new Set(reflectionCards.map((card) => card.name));
  return [...reflectionCards, ...fallbackCards.filter((card) => !reflectedNames.has(card.name))];
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
    feature_scope: 7,
    tech_route: 8,
    product_feedback: 9,
    iteration_plan: 10,
    value_card: 11,
    product_packaging: 12,
    story_pitch: 13,
    mentor_comment: 14
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
  const baseAccessUrl = asText(finalItem?.payload.access_url) || showcaseItem?.access_url || "";
  const baseScreenshot = asText(finalItem?.payload.screenshot_url) || showcaseItem?.screenshot_url || "";
  const baseRecording = asText(finalItem?.payload.recording_url) || showcaseItem?.recording_url || "";
  const pitchDeckUrl = asText(finalItem?.payload.pitch_deck_url);
  const scoreSummary = scoreSummaries.find(matchesProject(projectId, finalItem, productName, teamId, teamName)) || null;
  const projectAwards = awardResults.filter((award) => awardMatchesProject(award, projectId, finalItem, productName, teamId));
  const allProjectJourneyItems = sortProjectJourney(
    projectJourney.filter((item) => journeyItemMatchesProject(item, productName, teamId, teamName))
  );
  const definitionItem = allProjectJourneyItems.find((item) => item.task_type === "product_definition") || null;
  const packagingItem = allProjectJourneyItems.find((item) => item.task_type === "product_packaging") || null;
  const storyItem = allProjectJourneyItems.find((item) => item.task_type === "story_pitch") || null;
  const accessUrl = baseAccessUrl || asText(packagingItem?.payload.access_url);
  const screenshot = baseScreenshot || asText(packagingItem?.payload.poster_url);
  const recording = baseRecording;
  const heroLine = asText(finalItem?.payload.value_line) || showcaseItem?.one_liner || asText(packagingItem?.payload.slogan) || "这是一组正在被真实用户检验的 AI 产品原型。";
  const targetUser = asText(finalItem?.payload.target_user) || asText(definitionItem?.payload.target_user) || asText(packagingItem?.payload.target_user) || "真实用户";
  const coreProblem = asText(finalItem?.payload.core_problem) || asText(definitionItem?.payload.core_problem) || asText(storyItem?.payload.user_scene) || "一个值得继续研究的问题";
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
  const certificates = contributionCards(finalItem, projectAwards, projectGrowthReflections);
  const projectRoute = window.location.pathname.startsWith("/parents") ? "/parents" : "/showcase";
  const projectShareUrl = absoluteUrl(publicProjectUrl(projectId, projectRoute));
  const [shareMessage, setShareMessage] = useState("");

  const copyProjectLink = async () => {
    try {
      await copyToClipboard(projectShareUrl);
      setShareMessage("作品页链接已复制。");
      window.setTimeout(() => setShareMessage(""), 2200);
    } catch {
      setShareMessage("复制失败，可以手动选中链接。");
    }
  };

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
        <p>{heroLine}</p>
        {accessUrl && (
          <a className="project-open-link" href={normalizeShowcaseUrl(accessUrl)} target="_blank" rel="noreferrer">
            <ExternalLink size={18} />
            打开作品
          </a>
        )}
        {pitchDeckUrl && (
          <a className="project-open-link" href={normalizeShowcaseUrl(pitchDeckUrl)} target="_blank" rel="noreferrer">
            <ExternalLink size={18} />
            路演 PPT
          </a>
        )}
        <div className="project-share-bar">
          <input readOnly value={projectShareUrl} aria-label="作品页链接" onFocus={(event) => event.currentTarget.select()} />
          <button type="button" onClick={copyProjectLink}>
            <Copy size={16} />
            复制作品页
          </button>
        </div>
        {shareMessage && <small className="public-share-message">{shareMessage}</small>}
      </header>

      <section className="project-story-grid">
        <div className="project-shot">
          {recording ? (
            <video src={normalizeShowcaseUrl(recording)} controls preload="metadata" playsInline />
          ) : screenshot ? (
            <img src={normalizeShowcaseUrl(screenshot)} alt={`${productName} 展示图`} />
          ) : (
            <Rocket size={54} />
          )}
        </div>
        <article className="project-story-card">
          <span>项目故事</span>
          <dl>
            <div>
              <dt>目标用户</dt>
              <dd>{targetUser}</dd>
            </div>
            <div>
              <dt>解决的问题</dt>
              <dd>{coreProblem}</dd>
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
              {certificate.nextPractice && <small>下一次想练：{certificate.nextPractice}</small>}
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
  const growthItems = reflections.filter((reflection) => reflection.task_type === "growth_reflection");
  if (!growthItems.length) {
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
      {growthItems.map((reflection) => {
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
  if (item.task_type === "team_card") return asText(item.payload.team_name) || item.team_name || "团队名片";
  if (item.task_type === "problem_card") return asText(item.payload.problem_scene) || "发现一个真实问题";
  if (item.task_type === "market_scout") return asText(item.payload.ai_rewrite) || asText(item.payload.original_problem) || "完成一次市场侦察";
  if (item.task_type === "user_voice") return asText(item.payload.interviewee) || "听见一位用户";
  if (item.task_type === "ai_validation") return asText(item.payload.doubt) || "用证据检查 AI";
  if (item.task_type === "product_definition") return asText(item.payload.direction) || asText(item.payload.product_name) || "团队方向";
  if (item.task_type === "prompt_card") return asText(item.payload.goal) || "写出五句提示词";
  if (item.task_type === "feature_scope") return asText(item.payload.core_action) || "留下核心动作";
  if (item.task_type === "tech_route") return techRouteLabel(item.payload.route_choice);
  if (item.task_type === "product_feedback") return asText(item.payload.product_name) || "收到试用反馈";
  if (item.task_type === "iteration_plan") return asText(item.payload.v2_plan) || asText(item.payload.product_name) || "写出下一版计划";
  if (item.task_type === "value_card") return asText(item.payload.value_change) || asText(item.payload.product_name) || "写出价值交换卡";
  if (item.task_type === "product_packaging") return asText(item.payload.slogan) || asText(item.payload.product_name) || "做出产品海报卡";
  if (item.task_type === "story_pitch") return asText(item.payload.story_hook) || asText(item.payload.product_name) || "写出故事发布五步卡";
  if (item.task_type === "mentor_comment") return asText(item.payload.product_name) || "导师点评";
  return item.title || "项目记录";
}

function journeyLabel(item: WallArtifact) {
  const labels: Record<string, string> = {
    team_card: "团队名片",
    problem_card: "发现问题",
    market_scout: "市场侦察",
    user_voice: "听见用户",
    ai_validation: "检查 AI",
    product_definition: "方向计划",
    prompt_card: "提示词卡",
    feature_scope: "核心动作",
    tech_route: "路线流程",
    product_feedback: "收到反馈",
    iteration_plan: "迭代清单",
    value_card: "价值卡",
    product_packaging: "产品海报",
    story_pitch: "故事发布",
    mentor_comment: "导师点评"
  };
  return labels[item.task_type] || "项目记录";
}

function journeyCopy(item: WallArtifact) {
  if (item.task_type === "team_card") {
    return [
      ["团队", asText(item.payload.team_name) || item.team_name || ""],
      ["成员", asText(item.payload.team_members)],
      ["方向", asText(item.payload.product_direction) || asText(item.payload.direction)],
      ["亮相", asText(item.payload.launch_line)]
    ];
  }
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
      ["赛道", productTrackText(item.payload)],
      ["帮谁", asText(item.payload.target_user)],
      ["场景", asText(item.payload.use_scene)],
      ["问题", asText(item.payload.core_problem)],
      ["核心动作", asText(item.payload.core_action) || asText(item.payload.solution)],
      ["证据", asText(item.payload.interview_evidence)],
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
  if (item.task_type === "feature_scope") {
    return [
      ["功能清单", featureSummary(item.payload)],
      ["核心动作", asText(item.payload.core_action)],
      ["第一版", asText(item.payload.first_version)],
      ["先不做", asText(item.payload.not_now)],
      ["看到结果", asText(item.payload.success_signal)]
    ];
  }
  if (item.task_type === "tech_route") {
    return [
      ["路线", techRouteLabel(item.payload.route_choice)],
      ["准备用", asText(item.payload.tool_plan)],
      ["用户流程", userFlowSummary(item.payload)],
      ["第一屏", asText(item.payload.first_screen)],
      ["结果", asText(item.payload.result_screen)],
      ["兜底办法", asText(item.payload.fallback_plan)]
    ];
  }
  if (item.task_type === "product_feedback") {
    return [
      ["有用的地方", asText(item.payload.most_useful)],
      ["下一版建议", asText(item.payload.suggestion)]
    ];
  }
  if (item.task_type === "iteration_plan") {
    return [
      ["产品", asText(item.payload.product_name)],
      ["必须改", iterationListSummary(item.payload.must_change_items, item.payload.must_change_summary)],
      ["建议改", iterationListSummary(item.payload.should_change_items, item.payload.should_change_summary)],
      ["暂不改", iterationListSummary(item.payload.later_items, item.payload.later_summary)],
      ["V2 先改", asText(item.payload.v2_plan)],
      ["再试一次", asText(item.payload.test_again)],
      ["来自反馈", asTextList(item.payload.source_feedback_summaries).join(" / ")]
    ];
  }
  if (item.task_type === "value_card") {
    return [
      ["产品", asText(item.payload.product_name)],
      ["帮谁", asText(item.payload.target_user)],
      ["少烦了", asText(item.payload.value_change)],
      ["愿意交换", [valueExchangeLabel(item.payload.exchange_choice), asText(item.payload.exchange_amount)].filter(Boolean).join(" ")],
      ["为什么值得", asText(item.payload.why_worth)],
      ["证据", asText(item.payload.evidence)]
    ];
  }
  if (item.task_type === "product_packaging") {
    return [
      ["产品", asText(item.payload.product_name)],
      ["标语", asText(item.payload.slogan)],
      ["给谁看", asText(item.payload.target_user)],
      ["卖点", asTextList(item.payload.selling_points).join(" / ") || asText(item.payload.selling_point_summary)],
      ["作品入口", asText(item.payload.access_url)],
      ["展示图", asText(item.payload.poster_url)]
    ];
  }
  if (item.task_type === "story_pitch") {
    return [
      ["开头", asText(item.payload.story_hook)],
      ["人物", asText(item.payload.user_scene)],
      ["作品", asText(item.payload.product_demo)],
      ["证据", asText(item.payload.proof_line)],
      ["邀请", asText(item.payload.invite_line)],
      ["问答预演", storyQaSummary(item.payload)]
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
  view,
  onLoggedOut
}: {
  camp: Camp | null;
  modules: CourseModule[];
  students: Student[];
  refresh: () => Promise<void>;
  teacher: TeacherAccount | null;
  view: TeacherView;
  onLoggedOut: () => void;
}) {
  const initialSearchParams = new URLSearchParams(window.location.search);
  const initialDay = Number(initialSearchParams.get("day"));
  const [selectedDay, setSelectedDay] = useState(initialDay >= 1 && initialDay <= 3 ? initialDay : 1);
  const [selectedModuleId, setSelectedModuleId] = useState(
    initialSearchParams.get("module") || "future-photo-studio"
  );
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Student | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [progressBoardPulse, setProgressBoardPulse] = useState(false);
  const progressBoardPulseTimerRef = useRef<number | null>(null);
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

  useEffect(() => {
    return () => {
      if (progressBoardPulseTimerRef.current) {
        window.clearTimeout(progressBoardPulseTimerRef.current);
      }
    };
  }, []);

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
    window.location.href = "/wall";
  };

  const openProgressBoard = () => {
    if (view !== "progress") {
      window.location.href = teacherViewMeta.progress.href;
      return;
    }
    const board = document.getElementById("teacher-progress-board");
    board?.scrollIntoView({ behavior: "smooth", block: "start" });
    setProgressBoardPulse(true);
    if (progressBoardPulseTimerRef.current) {
      window.clearTimeout(progressBoardPulseTimerRef.current);
    }
    progressBoardPulseTimerRef.current = window.setTimeout(() => {
      setProgressBoardPulse(false);
      progressBoardPulseTimerRef.current = null;
    }, 2200);
    setActionMessage("已打开团队进度看板。");
  };

  const handlePageAction = async (action: string) => {
    if (action === "全屏演示") {
      await openPresentation();
      return;
    }
    if (action === "投屏展示") {
      openWall();
      return;
    }
    if (action === "启动计时") {
      startPageTimer();
      return;
    }
    if (action === "打开看板") {
      openProgressBoard();
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
                onClick={() => {
                  if (view === "lesson") {
                    setSelectedModuleId(module.id);
                    return;
                  }
                  window.location.href = `/teacher.html?day=${module.day}&module=${encodeURIComponent(module.id)}`;
                }}
              >
                <span>{module.time_range}</span>
                <strong>{lessonModuleTitle(module)}</strong>
                <small>{lessonModuleSubtitle(module)}</small>
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
        <TeacherFunctionLinks active={view} />
        {view === "lesson" ? (
          <section className="lesson-panel">
            <div className="lesson-title">
              <div>
                <span className="eyebrow">现在这一段</span>
                <h1>{lessonModuleTitle(selectedModule)}</h1>
                <p>{lessonModuleSubtitle(selectedModule)}</p>
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
              <LessonPageCanvas
                module={selectedModule}
                page={selectedPage}
                students={students}
                onOpenPhoto={setSelectedPhoto}
              />
            )}
          </section>
        ) : (
          <TeacherStandalonePage view={view}>
            <TeacherViewPanels
              view={view}
              students={students}
              refresh={refresh}
              selectedModuleId={selectedModule?.id}
              highlighted={progressBoardPulse}
            />
          </TeacherStandalonePage>
        )}
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

function TeacherFunctionLinks({ active }: { active: TeacherView }) {
  return (
    <nav className="teacher-page-nav" aria-label="教师功能页">
      {teacherViewLinks.map((item) => {
        const meta = teacherViewMeta[item.key];
        return (
          <a key={item.key} className={active === item.key ? "active" : ""} href={meta.href}>
            {item.icon}
            <span>{meta.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

function TeacherStandalonePage({ view, children }: { view: Exclude<TeacherView, "lesson">; children: React.ReactNode }) {
  const meta = teacherViewMeta[view];
  return (
    <div className="teacher-feature-page">
      <div className="teacher-feature-heading">
        <div>
          <span className="eyebrow">教师功能页</span>
          <h1>{meta.title}</h1>
          <p>{meta.description}</p>
        </div>
        <a className="secondary" href={teacherViewMeta.lesson.href}>
          <Play size={18} />
          回到授课首页
        </a>
      </div>
      <div className="teacher-feature-content">{children}</div>
    </div>
  );
}

function TeacherViewPanels({
  view,
  students,
  refresh,
  selectedModuleId,
  highlighted
}: {
  view: Exclude<TeacherView, "lesson">;
  students: Student[];
  refresh: () => Promise<void>;
  selectedModuleId?: string;
  highlighted?: boolean;
}) {
  if (view === "workspace") {
    return (
      <>
        <TeacherTeamWorkspace students={students} refresh={refresh} />
        <TeacherProgressBoard selectedModuleId={selectedModuleId} highlighted={highlighted} />
      </>
    );
  }

  if (view === "progress") {
    return <TeacherProgressBoard selectedModuleId={selectedModuleId} highlighted={highlighted} />;
  }

  if (view === "students") {
    return (
      <section className="teacher-grid">
        <TeacherStudents students={students} refresh={refresh} />
        <FuturePhotoReview refresh={refresh} />
      </section>
    );
  }

  if (view === "submissions") {
    return (
      <>
        <TeacherD1Artifacts />
        <TeacherProductDefinitions />
        <TeacherPromptCards />
        <TeacherFeatureScopes />
        <TeacherTechRoutes />
        <TeacherProjectSubmissions />
        <TeacherPeerFeedback />
        <TeacherIterationPlans />
        <TeacherValueCards />
        <TeacherProductPackaging />
        <TeacherStoryPitches />
      </>
    );
  }

  return (
    <>
      <TeacherFinalShowcase />
      <TeacherScoringCenter />
      <TeacherMentorComments />
      <TeacherShareCenter />
      <TeacherGrowthReflections />
      <TeacherShowcase />
    </>
  );
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function productTrackLabel(value: unknown) {
  const text = asText(value);
  return productTrackOptions.find((item) => item.value === text)?.label || text;
}

function productDirectionOptions(track: string) {
  return productTrackOptions.find((item) => item.value === track)?.directions ?? [];
}

function productTrackText(payload: Record<string, unknown>) {
  const label = asText(payload.track_label) || productTrackLabel(payload.track);
  const direction = asText(payload.direction);
  return [label, direction].filter(Boolean).join(" · ");
}

function asTextList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  return asText(value)
    .split(/\n|；|;|、/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isClassGroupPlaceholder(value: unknown) {
  const text = asText(value).trim();
  return !text || text === "未命名小组" || /^第\s*\d+\s*组$/.test(text);
}

function featureSummary(payload: Record<string, unknown>, limit = 4) {
  const ideas = asTextList(payload.feature_ideas);
  return ideas.slice(0, limit).join(" / ") || asText(payload.feature_summary);
}

function techRouteLabel(value: unknown) {
  const route = asText(value);
  return techRouteOptions.find((option) => option.value === route)?.label || route || "还没选路线";
}

const valueExchangeOptions = [
  { value: "stars", label: "星星币", hint: "愿意花一点星星币" },
  { value: "time", label: "时间", hint: "愿意花时间试用" },
  { value: "recommend", label: "推荐", hint: "愿意推荐给同学" },
  { value: "again", label: "再用一次", hint: "愿意下次还打开" }
] as const;

function valueExchangeLabel(value: unknown) {
  const exchange = asText(value);
  return valueExchangeOptions.find((option) => option.value === exchange)?.label || exchange || "还没选择";
}

function userFlowSummary(payload: Record<string, unknown>, limit = 5) {
  const steps = asTextList(payload.user_flow_steps);
  return steps.slice(0, limit).join(" → ") || asText(payload.user_flow_summary);
}

function iterationListSummary(value: unknown, fallback?: unknown, limit = 3) {
  return asTextList(value).slice(0, limit).join(" / ") || asText(fallback);
}

function storyQaPairs(payload: Record<string, unknown>) {
  const rawPairs = payload.rehearsal_qa;
  if (Array.isArray(rawPairs)) {
    return rawPairs
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const source = item as Record<string, unknown>;
        const question = asText(source.question).trim();
        const answer = asText(source.answer).trim();
        return question || answer ? { question, answer } : null;
      })
      .filter((item): item is { question: string; answer: string } => Boolean(item));
  }
  const question = asText(payload.rehearsal_question).trim();
  const answer = asText(payload.rehearsal_answer).trim();
  return question || answer ? [{ question, answer }] : [];
}

function storyQaSummary(payload: Record<string, unknown>, limit = 3) {
  return storyQaPairs(payload)
    .slice(0, limit)
    .map((item) => item.question && item.answer ? `${item.question}：${item.answer}` : item.question || item.answer)
    .filter(Boolean)
    .join(" / ");
}

function completeStoryQaCount(payload: Record<string, unknown>) {
  return storyQaPairs(payload).filter((item) => item.question && item.answer).length;
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
  { key: "team_card", label: "团队名片", target: 1, unit: "张" },
  { key: "problem_card", label: "问题卡", target: 1, unit: "张" },
  { key: "market_scout", label: "侦察卡", target: 1, unit: "张" },
  { key: "user_voice", label: "用户声音", target: 3, unit: "条" },
  { key: "product_definition", label: "方向计划", target: 1, unit: "条" },
  { key: "prompt_card", label: "提示词卡", target: 1, unit: "张" },
  { key: "feature_scope", label: "核心动作", target: 1, unit: "张" },
  { key: "tech_route", label: "路线流程", target: 1, unit: "张" },
  { key: "product_link", label: "作品入口", target: 1, unit: "个" },
  { key: "product_feedback", label: "互测反馈", target: 2, unit: "条" },
  { key: "iteration_plan", label: "迭代清单", target: 1, unit: "张" },
  { key: "value_card", label: "价值卡", target: 1, unit: "张" },
  { key: "product_packaging", label: "海报卡", target: 1, unit: "张" },
  { key: "story_pitch", label: "故事卡", target: 1, unit: "张" },
  { key: "final_showcase", label: "展示卡", target: 1, unit: "张" }
] as const;

type ProgressFocusKey = "current" | "d1" | "d2" | "d3" | "all";

const progressFocusTabs: Array<{ key: ProgressFocusKey; label: string }> = [
  { key: "current", label: "当前环节" },
  { key: "d1", label: "D1 定方向" },
  { key: "d2", label: "D2 做原型" },
  { key: "d3", label: "D3 路演" },
  { key: "all", label: "全部" }
];

const progressFocusMilestones: Record<Exclude<ProgressFocusKey, "current">, Array<(typeof progressMilestones)[number]["key"]>> = {
  d1: ["team_card", "product_definition"],
  d2: ["prompt_card", "feature_scope", "tech_route", "product_link", "product_feedback", "iteration_plan"],
  d3: ["value_card", "product_packaging", "story_pitch", "final_showcase"],
  all: progressMilestones.map((milestone) => milestone.key)
};

const moduleProgressFocus: Record<string, Exclude<ProgressFocusKey, "current" | "all">> = {
  "future-photo-studio": "d1",
  "team-formation": "d1",
  "problem-wall": "d1",
  "ai-judgement": "d1",
  "ai-superpowers": "d1",
  "market-scout": "d1",
  "user-interview": "d1",
  "project-launch": "d1",
  "day1-reflection": "d1",
  "day2-recap": "d2",
  "day2-kickoff": "d2",
  "prompt-basic": "d2",
  "ai-lab": "d2",
  "feature-scope": "d2",
  "product-prototype": "d2",
  "tech-route": "d2",
  "tool-demo": "d2",
  "build-sprint": "d2",
  "user-testing": "d2",
  "demo-check": "d2",
  "day2-reflection": "d2",
  "roadshow-rehearsal": "d3",
  "value-experiment": "d3",
  "product-packaging": "d3",
  "brand-story": "d3",
  rehearsal: "d3",
  "final-showcase": "d3",
  "awards-reflection": "d3"
};

function resolveProgressFocus(focus: ProgressFocusKey, moduleId?: string | null): Exclude<ProgressFocusKey, "current"> {
  if (focus !== "current") return focus;
  return moduleProgressFocus[String(moduleId || "")] || "all";
}

function progressFocusMilestoneKeys(focus: ProgressFocusKey, moduleId?: string | null) {
  return new Set<string>(progressFocusMilestones[resolveProgressFocus(focus, moduleId)]);
}

function progressFocusLabel(focus: ProgressFocusKey, moduleId?: string | null) {
  const resolved = resolveProgressFocus(focus, moduleId);
  if (focus === "current") {
    if (resolved === "d1") return "跟随当前环节：先看团队名片、确定方向和行动计划。";
    if (resolved === "d2") return "跟随当前环节：先看提示词、核心动作、路线、作品入口和互测。";
    if (resolved === "d3") return "跟随当前环节：先看价值卡、海报卡、故事卡和最终展示卡。";
    return "跟随当前环节：当前模块还没有专属阶段，先看全程进度。";
  }
  if (resolved === "d1") return "D1 聚焦：团队名片、确定方向和下一步行动计划。";
  if (resolved === "d2") return "D2 聚焦：把作品做出来、试起来、改一版。";
  if (resolved === "d3") return "D3 聚焦：把作品讲清楚、交上来、准备展示。";
  return "全部里程碑：适合课间复盘或结营前总检查。";
}

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
  { value: "READY", label: "可演示" },
  { value: "NEEDS_FALLBACK", label: "需要兜底" },
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
                  <div className="team-readonly-field">
                    <span>团队名</span>
                    <strong>{team.name}</strong>
                    <small>孩子提交团队名片后更新</small>
                  </div>
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
                <div className={team.selected_problem_title ? "team-selected-problem" : "team-selected-problem empty"}>
                  <span>问题线索</span>
                  <strong>{team.selected_problem_title || "等小组选择要继续调查的问题"}</strong>
                  {Number(team.selected_problem_votes || 0) > 0 && <small>{team.selected_problem_votes} 票线索</small>}
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

function submissionMatchesProjectIdentity(
  item: TaskSubmission,
  productName: string,
  teamId?: string | null,
  teamName?: string | null
) {
  const itemTeamId = item.task_type === "product_feedback"
    ? asText(item.payload.team_id) || item.team_id || ""
    : item.team_id || asText(item.payload.team_id);
  const itemTeamName = item.task_type === "product_feedback"
    ? asText(item.payload.team_name) || item.team_name || ""
    : item.team_name || asText(item.payload.team_name);
  const itemProductName = asText(item.payload.product_name);
  return (
    (!!teamId && itemTeamId === teamId) ||
    (!!teamName && itemTeamName === teamName) ||
    (!!productName && itemProductName === productName)
  );
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

type StudentWorkspaceTab = "task" | "team" | "work" | "feedback";

const studentWorkspaceTabs: Array<{ key: StudentWorkspaceTab; label: string; icon: React.ReactNode }> = [
  { key: "task", label: "当前任务", icon: <ClipboardCheck size={17} /> },
  { key: "team", label: "我的团队", icon: <UsersRound size={17} /> },
  { key: "work", label: "我们的作品", icon: <Package size={17} /> },
  { key: "feedback", label: "给别人反馈", icon: <MessageSquareText size={17} /> }
];

const studentTaskTypeLabels: Record<string, string> = {
  team_card: "团队名片",
  problem_card: "问题卡",
  problem_vote: "问题选择",
  market_scout: "侦察卡",
  user_voice: "用户声音",
  ai_validation: "AI 验证",
  product_definition: "方向计划",
  prompt_card: "提示词卡",
  feature_scope: "核心动作",
  tech_route: "路线流程",
  blocker_note: "卡点",
  product_link: "作品入口",
  product_feedback: "试玩反馈",
  iteration_plan: "迭代清单",
  value_card: "价值卡",
  product_packaging: "产品海报",
  story_pitch: "故事发布",
  final_showcase: "展示卡",
  observer_score: "同伴投票",
  learning_reflection: "反思卡",
  contribution_card: "贡献卡",
  growth_reflection: "成长卡"
};

function studentWorkspaceTabFromUrl(): StudentWorkspaceTab {
  const value = new URLSearchParams(window.location.search).get("view");
  return value === "team" || value === "work" || value === "feedback" ? value : "task";
}

function studentWorkspaceHref(tab: StudentWorkspaceTab) {
  const params = new URLSearchParams(window.location.search);
  params.set("view", tab);
  params.delete("photo-upload");
  return `${window.location.pathname}?${params.toString()}`;
}

function StudentQuickNav({ active }: { active: StudentWorkspaceTab }) {
  return (
    <nav className="student-quick-nav" aria-label="学生入口">
      {studentWorkspaceTabs.map((tab) => (
        <a key={tab.key} className={active === tab.key ? "active" : ""} href={studentWorkspaceHref(tab.key)}>
          {tab.icon}
          <span>{tab.label}</span>
        </a>
      ))}
    </nav>
  );
}

function studentSubmissionLabel(item: TaskSubmission) {
  return studentTaskTypeLabels[item.task_type] || item.title || "课堂记录";
}

function studentSubmissionTitle(item: TaskSubmission) {
  return (
    asText(item.payload.product_name) ||
    asText(item.payload.problem_scene) ||
    asText(item.payload.story_hook) ||
    asText(item.payload.goal) ||
    asText(item.payload.where_stuck) ||
    asText(item.payload.value_change) ||
    item.title ||
    studentSubmissionLabel(item)
  );
}

function studentSubmissionLine(item: TaskSubmission) {
  return (
    asText(item.payload.one_liner) ||
    asText(item.payload.core_problem) ||
    asText(item.payload.trouble) ||
    asText(item.payload.highlight) ||
    asText(item.payload.next_step) ||
    asText(item.payload.finding) ||
    asText(item.payload.v2_plan) ||
    asText(item.payload.story_hook) ||
    "这条记录已经放进你们的项目路上。"
  );
}

function latestTeamSubmission(workspace: StudentWorkspace, taskType: string) {
  return latestTask(workspace.team_submissions.filter((item) => item.task_type === taskType));
}

function studentProgressItems(workspace: StudentWorkspace) {
  return progressMilestones
    .filter((milestone) =>
      ["problem_card", "user_voice", "product_definition", "feature_scope", "tech_route", "product_link", "product_feedback", "story_pitch", "final_showcase"].includes(milestone.key)
    )
    .map((milestone) => ({
      ...milestone,
      count: milestoneCount(workspace.team_submissions, milestone),
      done: milestoneCount(workspace.team_submissions, milestone) >= milestone.target
    }));
}

function StudentWorkspaceView({
  camp,
  active,
  student,
  onLogout
}: {
  camp: Camp | null;
  active: Exclude<StudentWorkspaceTab, "task">;
  student: StudentAccount;
  onLogout: () => void;
}) {
  const [workspace, setWorkspace] = useState<StudentWorkspace | null>(null);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const load = async () => {
    try {
      const result = await api.studentWorkspace();
      setWorkspace(result);
      setMessage(null);
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "暂时打不开，可以先回当前任务。" });
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 6000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <StudentQuickNav active={active} />
      <main className="student-page">
        <section className="student-shell student-workspace-shell">
          <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
          <h1>{active === "team" ? "我的团队" : active === "work" ? "我们的作品" : "给别人反馈"}</h1>
          <p>{active === "team" ? "看看本组现在走到哪一步。" : active === "work" ? "把能打开、能展示、能讲清的东西放在一起。" : "先打开别组作品试试看，再写下一条有用的亮点和建议。"}</p>
          <div className="student-card student-workspace-card">
            <div className="student-current">
              <div>
                <span>{student.team_name || "还在分组"}</span>
                <strong>{student.nickname}</strong>
                <small>{student.student_no ? `学号 ${student.student_no}` : student.username}</small>
              </div>
              <button className="text-button" onClick={onLogout}>退出</button>
            </div>
            {!workspace && !message ? (
              <div className="feedback-loading">
                <Loader2 className="spin" size={24} />
                <span>正在读取</span>
              </div>
            ) : null}
            {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
            {workspace && active === "team" && <StudentTeamPanel workspace={workspace} />}
            {workspace && active === "work" && <StudentWorkPanel workspace={workspace} />}
            {workspace && active === "feedback" && <StudentFeedbackPanel workspace={workspace} />}
          </div>
        </section>
      </main>
    </>
  );
}

function StudentTeamPanel({ workspace }: { workspace: StudentWorkspace }) {
  const team = workspace.team;
  const progress = studentProgressItems(workspace);
  const latestTeamCard = latestTeamSubmission(workspace, "team_card");
  const selectedProblem = team?.selected_problem_title || asText(latestTeamSubmission(workspace, "problem_card")?.payload.problem_scene);
  const teamDirection =
    asText(latestTeamCard?.payload.product_direction) ||
    asText(latestTeamCard?.payload.direction);
  const launchLine = asText(latestTeamCard?.payload.launch_line);
  const memberNames = workspace.team_members.map((member) => member.nickname).filter(Boolean).join("、");
  return (
    <div className="student-workspace-section">
      <div className="student-team-hero">
        <div>
          <span>{team?.table_no ? `${team.table_no} 号桌` : "团队桌"}</span>
          <strong>{team?.name || workspace.student.team_name || "还没分组"}</strong>
          <small>{team ? `${projectStatusLabel(team.project_status)} · ${showcaseStatusLabel(team.showcase_status)}` : "老师分组后，这里会亮起来。"}</small>
        </div>
        <div>
          <span>问题线索</span>
          <strong>{selectedProblem || "还在选择要继续调查的问题"}</strong>
          {Number(team?.selected_problem_votes || 0) > 0 && <small>{team?.selected_problem_votes} 票线索</small>}
        </div>
      </div>
      <div className="student-member-grid">
        {workspace.team_members.map((member) => (
          <article key={member.id}>
            <span>{member.student_no || "成员"}</span>
            <strong>{member.nickname}</strong>
          </article>
        ))}
        {!workspace.team_members.length && <p className="empty">老师分组后，成员会出现在这里。</p>}
      </div>
      {team && (
        <div className="student-role-strip">
          <span>
            <b>成员</b>
            {memberNames || "老师分组后会出现"}
          </span>
          <span>
            <b>方向</b>
            {teamDirection || "还在讨论"}
          </span>
          <span>
            <b>亮相</b>
            {launchLine || "还在准备"}
          </span>
        </div>
      )}
      <div className="student-progress-strip">
        {progress.map((item) => (
          <span className={item.done ? "done" : ""} key={item.key}>
            <CheckCircle2 size={15} />
            {item.label}
            <b>{item.count}/{item.target}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function StudentWorkPanel({ workspace }: { workspace: StudentWorkspace }) {
  const latestFinal = latestTeamSubmission(workspace, "final_showcase");
  const latestProduct = latestTeamSubmission(workspace, "product_definition");
  const latestPoster = latestTeamSubmission(workspace, "product_packaging");
  const latestStory = latestTeamSubmission(workspace, "story_pitch");
  const workItems = [
    latestFinal,
    latestPoster,
    latestProduct,
    latestStory,
    latestTeamSubmission(workspace, "tech_route"),
    latestTeamSubmission(workspace, "iteration_plan")
  ].filter((item): item is TaskSubmission => Boolean(item));
  return (
    <div className="student-workspace-section">
      {workspace.showcase_items.length ? (
        <div className="student-showcase-links">
          {workspace.showcase_items.map((item) => (
            <article key={item.id}>
              <div>
                <span>{item.team_name || item.track || "作品卡"}</span>
                <strong>{item.product_name}</strong>
                <small>{item.one_liner || "可以点开体验的作品。"}</small>
              </div>
              {item.access_url && (
                <a href={normalizeShowcaseUrl(item.access_url)} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  打开
                </a>
              )}
            </article>
          ))}
        </div>
      ) : (
        <article className="student-work-empty">
          <Package size={28} />
          <strong>{asText(latestFinal?.payload.product_name) || asText(latestProduct?.payload.product_name) || "作品正在整理"}</strong>
          <span>{asText(latestFinal?.payload.value_line) || asText(latestProduct?.payload.one_liner) || "等作品卡准备好，这里会出现可以点开的入口。"}</span>
        </article>
      )}
      <div className="student-work-list">
        {workItems.map((item) => (
          <article key={item.id}>
            <span>{studentSubmissionLabel(item)}</span>
            <strong>{studentSubmissionTitle(item)}</strong>
            <small>{studentSubmissionLine(item)}</small>
          </article>
        ))}
        {!workItems.length && <p className="empty">提交产品卡、海报卡和故事卡后，这里会慢慢变满。</p>}
      </div>
    </div>
  );
}

function StudentFeedbackPanel({ workspace }: { workspace: StudentWorkspace }) {
  const [classroomItems, setClassroomItems] = useState<ShowcaseItem[]>([]);

  useEffect(() => {
    api.showcase()
      .then((result) => setClassroomItems(result.showcase_items))
      .catch(() => setClassroomItems([]));
  }, []);

  const otherProducts = classroomItems.filter((item) =>
    item.team_id !== workspace.student.team_id && item.team_name !== workspace.student.team_name
  );
  return (
    <div className="student-workspace-section">
      <article className="student-feedback-action">
        <div>
          <span>现在可以做的事</span>
          <strong>打开当前任务，给别组一条有用反馈</strong>
          <small>先试用，再写亮点和下一步建议。</small>
        </div>
        <a href={studentWorkspaceHref("task")}>
          <ClipboardCheck size={16} />
          去任务
        </a>
      </article>
      {otherProducts.length ? (
        <div className="student-showcase-links compact">
          {otherProducts.slice(0, 6).map((item) => (
            <article key={item.id}>
              <div>
                <span>{item.team_name || item.track || "别组作品"}</span>
                <strong>{item.product_name}</strong>
                <small>{item.one_liner || "先打开看看怎么用。"}</small>
              </div>
              {item.access_url && (
                <a href={normalizeShowcaseUrl(item.access_url)} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  打开
                </a>
              )}
            </article>
          ))}
        </div>
      ) : null}
      <div className="student-work-list">
        <h3>别人写给我们的</h3>
        {workspace.received_feedback.map((item) => (
          <article key={item.id}>
            <span>{item.student_name || "同伴反馈"}</span>
            <strong>{asText(item.payload.highlight) || "一个亮点"}</strong>
            <small>{asText(item.payload.next_step) || "下一步建议还在路上。"}</small>
          </article>
        ))}
        {!workspace.received_feedback.length && <p className="empty">等同学试用你们的作品后，反馈会出现在这里。</p>}
      </div>
    </div>
  );
}

function nextSupportAction(
  milestoneStates: Array<{ key: string; label: string; target: number; unit: string; count: number; done: boolean }>,
  activeBlockers: TaskSubmission[],
  team: Team
) {
  if (activeBlockers.length) {
    const blocker = activeBlockers[0];
    return `先去 ${team.table_no || team.group_no} 号桌看卡点：${asText(blocker.payload.where_stuck) || "请他们说清卡在哪里"}`;
  }
  const firstMissing = milestoneStates.find((milestone) => !milestone.done);
  if (!firstMissing) return "可以安排彩排或进入作品秀顺序。";
  if (firstMissing.key === "team_card") return "请小组先补一张团队名片：团队名、产品方向和一句亮相。";
  if (firstMissing.key === "product_definition") return "请小组补齐方向和行动计划：帮谁、收集什么需求、明天先做哪一步。";
  if (!team.selected_problem_id && ["problem_card", "market_scout", "user_voice"].includes(firstMissing.key)) return "请小组先选出要继续调查的问题。";
  if (firstMissing.key === "market_scout") return "先补一张侦察卡：AI 改写、用户声音、已有方案、继续验证。";
  if (firstMissing.key === "user_voice") return `还差 ${Math.max(0, firstMissing.target - firstMissing.count)} 条用户声音，先补真实采访。`;
  if (firstMissing.key === "product_feedback") return `还差 ${Math.max(0, firstMissing.target - firstMissing.count)} 条互测反馈，安排别组打开作品试用。`;
  if (firstMissing.key === "iteration_plan") return "请小组把反馈分成必须改、建议改、暂不改，再定 V2 先改哪一处。";
  if (firstMissing.key === "value_card") return "请小组补一张价值卡：帮谁少烦了什么，别人愿意用什么交换。";
  if (firstMissing.key === "product_packaging") return "请小组补一张产品海报卡：产品名、标语、三个卖点、展示图。";
  if (firstMissing.key === "story_pitch") return "请小组补一张故事发布五步卡：人物、麻烦、作品、证据、邀请。";
  if (firstMissing.key === "product_link") return "先确认作品链接能打开，再准备上台展示。";
  if (firstMissing.key === "final_showcase") return "请小组把最终展示卡补齐。";
  if (firstMissing.key === "product_definition") return "先把方向和行动计划写清楚：帮谁、收集什么需求、明天先做哪一步。";
  if (firstMissing.key === "prompt_card") return "请小组补一张五句提示词卡：目标、用户、材料、限制、格式。";
  if (firstMissing.key === "feature_scope") return "请小组补一张核心动作卡：功能清单、核心动作、第一版。";
  if (firstMissing.key === "tech_route") return "请小组补一张路线流程卡：路线、工具、3 到 5 步流程。";
  return "先补一张真实问题卡。";
}

const emptyProgressTotals: TeacherProgressSnapshot["totals"] = {
  team_count: 0,
  active_blockers: 0,
  ready_teams: 0,
  with_scout: 0,
  with_product: 0,
  with_prompt: 0,
  with_feature_scope: 0,
  with_tech_route: 0,
  with_iteration: 0,
  with_value_card: 0,
  with_packaging: 0,
  with_story_pitch: 0,
  interview_ready: 0,
  feedback_ready: 0,
  needs_support: 0
};

function TeacherProgressBoard({ selectedModuleId, highlighted }: { selectedModuleId?: string; highlighted?: boolean }) {
  const [snapshot, setSnapshot] = useState<TeacherProgressSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [focusKey, setFocusKey] = useState<ProgressFocusKey>("current");

  const load = async () => {
    try {
      const result = await api.teacherProgress();
      setSnapshot(result);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "进度看板加载失败");
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const teamSummaries = snapshot?.teams ?? [];
  const totals = snapshot?.totals ?? emptyProgressTotals;
  const focusMilestoneKeys = progressFocusMilestoneKeys(focusKey, selectedModuleId);
  const focusDescription = progressFocusLabel(focusKey, selectedModuleId);
  const focusedSummaries = teamSummaries
    .map((summary) => {
      const visibleMilestones = summary.milestone_states.filter((milestone) => focusMilestoneKeys.has(milestone.key));
      const focusDoneCount = visibleMilestones.filter((milestone) => milestone.done).length;
      const focusTotal = visibleMilestones.length || summary.completion_total;
      const focusComplete = visibleMilestones.length > 0 && visibleMilestones.every((milestone) => milestone.done);
      const focusNeedsSupport = Boolean(summary.active_blockers.length || visibleMilestones.some((milestone) => !milestone.done));
      return {
        ...summary,
        visibleMilestones: visibleMilestones.length ? visibleMilestones : summary.milestone_states,
        focusDoneCount,
        focusTotal,
        focusComplete,
        focusNeedsSupport,
        focusedNextAction: visibleMilestones.length ? nextSupportAction(visibleMilestones, summary.active_blockers, summary.team) : summary.next_action
      };
    })
    .sort((a, b) => {
      const rank = (item: typeof a) => {
        if (item.active_blockers.length) return 0;
        if (item.focusNeedsSupport) return 1;
        if (item.ready_for_demo) return 2;
        return 3;
      };
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
      const byDone = a.focusDoneCount - b.focusDoneCount;
      if (byDone !== 0) return byDone;
      return Number(a.team.group_no || 0) - Number(b.team.group_no || 0);
    });
  const focusReadyCount = focusedSummaries.filter((summary) => summary.focusComplete).length;
  const focusNeedsCount = focusedSummaries.filter((summary) => summary.focusNeedsSupport).length;

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
    <section
      id="teacher-progress-board"
      className={highlighted ? "panel progress-board-panel focused" : "panel progress-board-panel"}
    >
      <div className="panel-title">
        <ClipboardCheck size={20} />
        <h2>团队进度看板</h2>
      </div>
      <div className="progress-board-toolbar">
        <div className="progress-focus-tabs" aria-label="看板阶段">
          {progressFocusTabs.map((tab) => (
            <button
              key={tab.key}
              className={focusKey === tab.key ? "active" : ""}
              onClick={() => setFocusKey(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p>{focusDescription}</p>
      </div>
      <div className="artifact-stats">
        <span>{teamSummaries.length} 个团队</span>
        <span>{focusReadyCount}/{teamSummaries.length} 组达到当前聚焦</span>
        <span>{focusNeedsCount} 组需要跟进</span>
        <span>{totals.active_blockers} 个卡点待支援</span>
        <span>{totals.ready_teams} 组已有作品入口</span>
        <span>{totals.interview_ready}/{teamSummaries.length} 组采访达标</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="progress-board-grid">
        {focusedSummaries.map((summary) => {
          const completion = `${summary.done_count}/${summary.completion_total}`;
          const latestBlocker = summary.active_blockers[0] || summary.blockers[0];
          const needsFallback = summary.team.showcase_status === "NEEDS_FALLBACK";
          const cardClass = summary.active_blockers.length || needsFallback
            ? "progress-team-card needs-help"
            : summary.focusComplete
              ? "progress-team-card ready"
              : "progress-team-card watching";
          const statusText = summary.active_blockers.length
            ? "需要支援"
            : needsFallback
              ? "需兜底"
              : summary.team.showcase_status === "READY"
                ? "可演示"
                : summary.focusComplete
                  ? "当前达成"
                  : summary.ready_for_demo
                    ? "有入口"
                    : "进行中";
          return (
            <article
              className={cardClass}
              key={summary.team.id}
            >
              <header>
                <div>
                  <span>{summary.team.table_no ? `${summary.team.table_no} 号桌` : `第 ${summary.team.group_no} 组`}</span>
                  <strong>{summary.team.name}</strong>
                  <small>{summary.members.length} 名学生 · 当前 {summary.focusDoneCount}/{summary.focusTotal} · 全程 {completion}</small>
                </div>
                <em>{statusText}</em>
              </header>
              <div className="progress-signal-grid">
                <span>
                  <b>{summary.user_voice_count}/3</b>
                  用户声音
                </span>
                <span>
                  <b>{summary.feedback_count}/2</b>
                  互测反馈
                </span>
                <span>
                  <b>{summary.ready_for_demo ? "有" : "缺"}</b>
                  作品入口
                </span>
                <span>
                  <b>{showcaseStatusLabel(summary.team.showcase_status)}</b>
                  展示准备
                </span>
              </div>
              <div className="progress-milestones">
                {summary.visibleMilestones.map((milestone) => {
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
                  <b>问题线索</b>
                  {summary.team.selected_problem_title || "等小组选择"}
                </p>
                <p>
                  <b>最近进展</b>
                  {summary.latest_submission ? `${summary.latest_submission.student_name || "学生"}提交了${summary.latest_submission.title}` : "还没有提交记录"}
                </p>
                <p className="next-support-action">
                  <b>下一步支援</b>
                  {summary.focusedNextAction}
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
  const [teamCards, setTeamCards] = useState<TaskSubmission[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const load = async () => {
    try {
      const [result, teamResult] = await Promise.all([api.submissions(), api.teams()]);
      setItems(result.task_submissions.filter((item) => ["product_definition", "problem_card", "market_scout", "user_voice", "ai_validation"].includes(item.task_type)));
      setTeamCards(result.task_submissions.filter((item) => item.task_type === "team_card"));
      setTeams(teamResult.teams);
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
    const directionItems = items.filter((item) => item.task_type === "product_definition");
    const directionCount = directionItems.length;
    const actionPlanCount = directionItems.filter((item) =>
      asText(item.payload.demand_questions).trim() ||
      asText(item.payload.action_plan).trim() ||
      asText(item.payload.day2_first_step).trim()
    ).length;
    const problemCount = items.filter((item) => item.task_type === "problem_card").length;
    const scoutCount = items.filter((item) => item.task_type === "market_scout").length;
    const voiceItems = items.filter((item) => item.task_type === "user_voice");
    const voiceCount = voiceItems.length;
    const validationCount = items.filter((item) => item.task_type === "ai_validation").length;
    const onWallCount = [...teamCards, ...items].filter((item) => item.status === "ON_WALL").length;
    const teamCount = new Set([...teamCards, ...items].map((item) => item.team_id || item.team_name || item.student_id || item.id)).size;
    const voiceByTeam = new Map<string, number>();
    voiceItems.forEach((item) => {
      const key = item.team_id || item.team_name || item.student_id || item.id;
      voiceByTeam.set(key, (voiceByTeam.get(key) || 0) + 1);
    });
    const interviewReadyCount = Array.from(voiceByTeam.values()).filter((count) => count >= 3).length;
    return { directionCount, actionPlanCount, problemCount, scoutCount, voiceCount, validationCount, teamCount, interviewReadyCount, onWallCount };
  }, [items, teamCards]);

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

  const latestTeamCardFor = (team: Team) =>
    [...teamCards]
      .filter((item) => item.team_id === team.id || asText(item.payload.team_id) === team.id)
      .sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))[0] ?? null;

  const latestDirectionFor = (team: Team) =>
    [...items]
      .filter((item) =>
        item.task_type === "product_definition" &&
        (item.team_id === team.id || asText(item.payload.team_id) === team.id || item.team_name === team.name)
      )
      .sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))[0] ?? null;

  return (
    <section className="panel d1-artifacts-panel">
      <div className="panel-title">
        <StickyNote size={20} />
        <h2>D1 团队方向和行动计划</h2>
      </div>
      <div className="artifact-stats">
        <span>{teamCards.length} 张团队名片</span>
        <span>{stats.directionCount} 张方向卡</span>
        <span>{stats.actionPlanCount} 份行动计划</span>
        <span>{stats.onWallCount} 张已放大屏</span>
        <span>{stats.teamCount} 个来源</span>
      </div>
      <div className="team-problem-picker">
        <div className="team-problem-picker-title">
          <strong>团队方向观察</strong>
          <span>成员名单由老师指定；团队名和产品方向由孩子提交团队名片后带入。</span>
        </div>
        <div className="team-problem-grid">
          {teams.map((team) => {
            const latestTeamCard = latestTeamCardFor(team);
            const latestDirectionPlan = latestDirectionFor(team);
            const childTeamName = asText(latestTeamCard?.payload.team_name);
            const productDirection =
              asText(latestDirectionPlan?.payload.direction) ||
              asText(latestTeamCard?.payload.product_direction) ||
              asText(latestTeamCard?.payload.direction);
            const launchLine = asText(latestTeamCard?.payload.launch_line);
            const demandPlan = asText(latestDirectionPlan?.payload.demand_questions);
            const firstStep =
              asText(latestDirectionPlan?.payload.day2_first_step) ||
              asText(latestDirectionPlan?.payload.core_action) ||
              asText(latestDirectionPlan?.payload.solution);
            return (
              <article className="team-problem-card" key={team.id}>
                <div>
                  <span>{team.table_no ? `${team.table_no} 号桌` : `第 ${team.group_no} 组`}</span>
                  <strong>{team.name}</strong>
                  <small>{latestDirectionPlan ? "已提交方向和计划" : childTeamName ? "已提交团队名片" : "等孩子提交团队名片"}</small>
                </div>
                <p><b>孩子定的团队名</b>{childTeamName || "还没提交"}</p>
                <p><b>产品方向</b>{productDirection || "还在讨论"}</p>
                <p><b>接下来要收集</b>{demandPlan || "还在准备"}</p>
                <p><b>明天先做</b>{firstStep || "还在准备"}</p>
                <p><b>亮相一句话</b>{launchLine || "还在准备"}</p>
                {team.selected_problem_title && <p><b>问题线索</b>{team.selected_problem_title}</p>}
              </article>
            );
          })}
          {!teams.length && <p className="empty">创建小组后，这里会显示团队方向。</p>}
        </div>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="d1-artifact-list">
        {items.map((item) => {
          const isProduct = item.task_type === "product_definition";
          const isProblem = item.task_type === "problem_card";
          const isScout = item.task_type === "market_scout";
          const isValidation = item.task_type === "ai_validation";
          const title = isProduct
            ? asText(item.payload.direction) || asText(item.payload.product_name) || "团队方向"
            : isProblem
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
                isProduct ? "product" : "",
                isScout ? "scout" : "",
                isValidation ? "validation" : "",
                !isProduct && !isProblem && !isScout && !isValidation ? "voice" : "",
                item.status === "ON_WALL" ? "on-wall" : ""
              ].filter(Boolean).join(" ")}
              key={item.id}
            >
              <header>
                <div>
                  <span>{isProduct ? "方向和行动计划" : isProblem ? "问题卡" : isScout ? "侦察卡" : isValidation ? "验证卡" : "用户声音"}</span>
                  <strong>{title}</strong>
                  <small>{item.team_name || item.student_name || "学生提交"}</small>
                </div>
                <button disabled={updatingId === item.id} onClick={() => toggleWall(item)}>
                  {item.status === "ON_WALL" ? "从大屏移开" : "放到大屏"}
                </button>
              </header>
              {isProduct ? (
                <div className="artifact-lines">
                  <p><strong>赛道：</strong>{productTrackText(item.payload) || "还没选"}</p>
                  <p><strong>方向：</strong>{asText(item.payload.direction) || "还没写"}</p>
                  <p><strong>帮谁：</strong>{asText(item.payload.target_user) || "还没写"}</p>
                  <p><strong>卡在哪：</strong>{asText(item.payload.core_problem) || "还没写"}</p>
                  <p><strong>接下来要问：</strong>{asText(item.payload.demand_questions) || "还没写"}</p>
                  <p><strong>明天带回：</strong>{asText(item.payload.day2_materials) || "可选"}</p>
                  <p><strong>明天先做：</strong>{asText(item.payload.day2_first_step) || asText(item.payload.core_action) || asText(item.payload.solution) || "还没写"}</p>
                  <p><strong>一句话：</strong>{asText(item.payload.one_liner) || "还在打磨"}</p>
                </div>
              ) : isProblem ? (
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
        {!items.length && <p className="empty">团队名片或方向和行动计划提交后，会出现在这里。</p>}
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
    const trackText = productTrackText(item.payload).trim();
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
        team_name: item.team_name || item.student_name || undefined,
        product_name: productName,
        track: trackText || targetUser || undefined,
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
          const trackText = productTrackText(item.payload);
          const targetUser = asText(item.payload.target_user);
          const action = asText(item.payload.core_action) || asText(item.payload.solution);
          const teacherHints = [
            !targetUser ? "缺真实用户" : /大家|所有人|全部人|所有用户/.test(targetUser) ? "用户还可以更具体" : "",
            !asText(item.payload.interview_evidence) ? "缺采访证据" : "",
            !action ? "缺核心动作" : "",
            /万能|全能|什么都|所有功能|一站式/.test(`${productName}${oneLiner}${asText(item.payload.direction)}`) ? "方向可能过大" : ""
          ].filter(Boolean);
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
                <p><strong>赛道：</strong>{trackText || "还没选"}</p>
                <p><strong>帮谁：</strong>{asText(item.payload.target_user) || "还没写"}</p>
                <p><strong>场景：</strong>{asText(item.payload.use_scene) || "还没写"}</p>
                <p><strong>问题：</strong>{asText(item.payload.core_problem) || "还没写"}</p>
                <p><strong>核心动作：</strong>{action || "还没写"}</p>
                <p><strong>采访证据：</strong>{asText(item.payload.interview_evidence) || "还没写"}</p>
                <p><strong>一句话：</strong>{oneLiner || "还没生成"}</p>
                {teacherHints.length > 0 && (
                  <p><strong>教师提醒：</strong>{teacherHints.join(" / ")}</p>
                )}
                {asText(item.payload.source_problem_title) && (
                  <p><strong>来源线索：</strong>{asText(item.payload.source_problem_title)}{asNumber(item.payload.source_problem_votes) > 0 ? ` · ${asNumber(item.payload.source_problem_votes)} 票` : ""}</p>
                )}
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

function TeacherFeatureScopes() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    try {
      const result = await api.submissions();
      setItems(result.task_submissions.filter((item) => item.task_type === "feature_scope"));
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
    <section className="panel feature-scope-panel">
      <div className="panel-title">
        <Hammer size={20} />
        <h2>D2 功能清单与核心动作</h2>
      </div>
      <div className="artifact-stats">
        <span>{items.length} 张核心动作卡</span>
        <span>{groupedCount} 个来源</span>
        <span>{items.filter((item) => item.status === "ON_WALL").length} 张已上屏</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="d1-artifact-list">
        {items.map((item) => {
          const coreAction = asText(item.payload.core_action) || "还没留下核心动作";
          const ideas = asTextList(item.payload.feature_ideas);
          return (
            <article
              className={[
                "d1-artifact-card",
                "feature-scope",
                item.status === "ON_WALL" ? "on-wall" : ""
              ].filter(Boolean).join(" ")}
              key={item.id}
            >
              <header>
                <div>
                  <span>核心动作卡</span>
                  <strong>{coreAction}</strong>
                  <small>{item.team_name || item.student_name || "学生提交"}</small>
                </div>
                <button disabled={workingId === item.id} onClick={() => toggleWall(item)}>
                  {item.status === "ON_WALL" ? "从大屏移开" : "放到大屏"}
                </button>
              </header>
              <div className="artifact-lines">
                <p><strong>产品：</strong>{asText(item.payload.product_name) || "还没写"}</p>
                <p><strong>功能清单：</strong>{ideas.length ? ideas.join(" / ") : "还没写"}</p>
                <p><strong>第一版：</strong>{asText(item.payload.first_version) || "还没写"}</p>
                <p><strong>先不做：</strong>{asText(item.payload.not_now) || "还没写"}</p>
                <p><strong>看到结果：</strong>{asText(item.payload.success_signal) || "还没写"}</p>
              </div>
            </article>
          );
        })}
        {!items.length && <p className="empty">学生提交核心动作卡后，会出现在这里。</p>}
      </div>
    </section>
  );
}

function TeacherTechRoutes() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    try {
      const result = await api.submissions();
      setItems(result.task_submissions.filter((item) => item.task_type === "tech_route"));
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
    <section className="panel tech-route-panel">
      <div className="panel-title">
        <Route size={20} />
        <h2>D2 技术路线与用户流程</h2>
      </div>
      <div className="artifact-stats">
        <span>{items.length} 张路线流程卡</span>
        <span>{groupedCount} 个来源</span>
        <span>{items.filter((item) => item.status === "ON_WALL").length} 张已上屏</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="d1-artifact-list">
        {items.map((item) => {
          const flow = asTextList(item.payload.user_flow_steps);
          return (
            <article
              className={[
                "d1-artifact-card",
                "tech-route",
                item.status === "ON_WALL" ? "on-wall" : ""
              ].filter(Boolean).join(" ")}
              key={item.id}
            >
              <header>
                <div>
                  <span>路线流程卡</span>
                  <strong>{techRouteLabel(item.payload.route_choice)}</strong>
                  <small>{item.team_name || item.student_name || "学生提交"}</small>
                </div>
                <button disabled={workingId === item.id} onClick={() => toggleWall(item)}>
                  {item.status === "ON_WALL" ? "从大屏移开" : "放到大屏"}
                </button>
              </header>
              <div className="artifact-lines">
                <p><strong>产品：</strong>{asText(item.payload.product_name) || "还没写"}</p>
                <p><strong>准备用：</strong>{asText(item.payload.tool_plan) || "还没写"}</p>
                <p><strong>用户流程：</strong>{flow.length ? flow.join(" → ") : "还没写"}</p>
                <p><strong>第一屏：</strong>{asText(item.payload.first_screen) || "还没写"}</p>
                <p><strong>结果：</strong>{asText(item.payload.result_screen) || "还没写"}</p>
                <p><strong>兜底办法：</strong>{asText(item.payload.fallback_plan) || "还没写"}</p>
              </div>
            </article>
          );
        })}
        {!items.length && <p className="empty">学生提交路线流程卡后，会出现在这里。</p>}
      </div>
    </section>
  );
}

function TeacherProjectSubmissions() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<TaskSubmission[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [result, teamResult] = await Promise.all([api.submissions(), api.teams()]);
      const allItems = result.task_submissions;
      setAllSubmissions(allItems);
      setItems(allItems.filter((item) => item.task_type === "product_link"));
      setTeams(teamResult.teams);
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
    const teamName = item.team_name || asText(item.payload.team_name);
    const relatedItems = allSubmissions.filter((candidate) =>
      candidate.id !== item.id && submissionMatchesProjectIdentity(candidate, productName, item.team_id, teamName)
    );
    const definition = latestTask(relatedItems.filter((candidate) => candidate.task_type === "product_definition"));
    const packaging = latestTask(relatedItems.filter((candidate) => candidate.task_type === "product_packaging"));
    const targetUser = asText(definition?.payload.target_user).trim() || asText(packaging?.payload.target_user).trim();
    const coreProblem = asText(definition?.payload.core_problem).trim();
    const mergedLine =
      oneLiner ||
      asText(definition?.payload.one_liner).trim() ||
      (targetUser && coreProblem ? `${targetUser}：${coreProblem}` : "") ||
      asText(packaging?.payload.slogan).trim();
    const screenshotKey = asText(item.payload.screenshot_key).trim() || asText(packaging?.payload.poster_key).trim();
    const screenshotUrl = asText(item.payload.screenshot_url).trim() || asText(packaging?.payload.poster_url).trim();
    const recordingKey = asText(item.payload.recording_key).trim();
    const recordingUrl = asText(item.payload.recording_url).trim();
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
        track: teamName || item.student_name || targetUser || undefined,
        one_liner: mergedLine || undefined,
        access_url: normalizeShowcaseUrl(accessUrl),
        screenshot_key: screenshotKey || undefined,
        screenshot_url: screenshotUrl ? normalizeShowcaseUrl(screenshotUrl) : undefined,
        recording_key: recordingKey || undefined,
        recording_url: recordingUrl ? normalizeShowcaseUrl(recordingUrl) : undefined,
        publish_status: "PUBLISHED"
      });
      setMessage("已放进展示区，产品问题线索已合并。");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const teamForSubmission = (item: TaskSubmission) => {
    const itemTeamName = item.team_name || asText(item.payload.team_name);
    return teams.find((team) =>
      (!!item.team_id && team.id === item.team_id) ||
      (!!itemTeamName && team.name === itemTeamName)
    );
  };

  const markShowcaseStatus = async (item: TaskSubmission, showcaseStatus: "READY" | "NEEDS_FALLBACK") => {
    const team = teamForSubmission(item);
    if (!team) {
      setMessage("先把这个作品归到一个小组，再做演示检查。");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const nextTeam = {
        ...team,
        project_status: showcaseStatus === "READY" ? "READY" : team.project_status || "PROTOTYPING",
        showcase_status: showcaseStatus
      };
      const result = await api.saveTeam(nextTeam);
      setTeams((current) => current.map((candidate) => (candidate.id === result.team.id ? result.team : candidate)));
      setMessage(showcaseStatus === "READY" ? `${team.name} 已标记为可演示。` : `${team.name} 已标记为需要兜底。`);
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
          const screenshot = asText(item.payload.screenshot_url);
          const recording = asText(item.payload.recording_url);
          const team = teamForSubmission(item);
          const showcaseStatus = team?.showcase_status || "DRAFT";
          return (
            <article className="project-submission-row" key={item.id}>
              {screenshot && (
                <div className="project-submission-shot">
                  <img src={normalizeShowcaseUrl(screenshot)} alt={productName || "作品展示图"} />
                </div>
              )}
              {!screenshot && recording && (
                <div className="project-submission-shot video">
                  <Play size={28} />
                </div>
              )}
              <div>
                <span>{item.team_name || item.student_name || "未分组"}</span>
                <strong>{productName || "未命名作品"}</strong>
                <p>{oneLiner || "还没有一句话介绍。"}</p>
                {recording && <p className="project-submission-media">已准备演示视频</p>}
                <p className={showcaseStatus === "NEEDS_FALLBACK" ? "project-demo-status needs-fallback" : showcaseStatus === "READY" ? "project-demo-status ready" : "project-demo-status"}>
                  {team ? showcaseStatusLabel(showcaseStatus) : "未关联小组"}
                </p>
                {accessUrl && (
                  <a href={normalizeShowcaseUrl(accessUrl)} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    打开作品
                  </a>
                )}
              </div>
              <div className="project-submission-actions">
                <button disabled={loading || !accessUrl} onClick={() => publish(item)}>
                  放进展示区
                </button>
                <button className="secondary" disabled={loading || !team} onClick={() => markShowcaseStatus(item, "READY")}>
                  可演示
                </button>
                <button className="warning" disabled={loading || !team} onClick={() => markShowcaseStatus(item, "NEEDS_FALLBACK")}>
                  需要兜底
                </button>
              </div>
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

function TeacherIterationPlans() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    try {
      const result = await api.submissions();
      setItems(result.task_submissions.filter((item) => item.task_type === "iteration_plan"));
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
    <section className="panel iteration-plan-panel">
      <div className="panel-title">
        <ClipboardCheck size={20} />
        <h2>D2 迭代清单</h2>
      </div>
      <div className="artifact-stats">
        <span>{items.length} 张迭代清单</span>
        <span>{groupedCount} 个来源</span>
        <span>{items.filter((item) => item.status === "ON_WALL").length} 张已上屏</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="d1-artifact-list">
        {items.map((item) => {
          const mustChange = iterationListSummary(item.payload.must_change_items, item.payload.must_change_summary);
          const shouldChange = iterationListSummary(item.payload.should_change_items, item.payload.should_change_summary);
          const later = iterationListSummary(item.payload.later_items, item.payload.later_summary);
          return (
            <article
              className={[
                "d1-artifact-card",
                "iteration-plan",
                item.status === "ON_WALL" ? "on-wall" : ""
              ].filter(Boolean).join(" ")}
              key={item.id}
            >
              <header>
                <div>
                  <span>迭代清单</span>
                  <strong>{asText(item.payload.v2_plan) || asText(item.payload.product_name) || "下一版计划"}</strong>
                  <small>{item.team_name || item.student_name || "学生提交"}</small>
                </div>
                <button disabled={workingId === item.id} onClick={() => toggleWall(item)}>
                  {item.status === "ON_WALL" ? "从大屏移开" : "放到大屏"}
                </button>
              </header>
              <div className="artifact-lines">
                <p><strong>产品：</strong>{asText(item.payload.product_name) || "还没写"}</p>
                <p><strong>必须改：</strong>{mustChange || "还没写"}</p>
                <p><strong>建议改：</strong>{shouldChange || "还没写"}</p>
                <p><strong>暂不改：</strong>{later || "还没写"}</p>
                <p><strong>V2 先改：</strong>{asText(item.payload.v2_plan) || "还没写"}</p>
                <p><strong>再试一次：</strong>{asText(item.payload.test_again) || "还没写"}</p>
                {asTextList(item.payload.source_feedback_summaries).length > 0 && (
                  <p><strong>来自反馈：</strong>{asTextList(item.payload.source_feedback_summaries).join(" / ")}</p>
                )}
              </div>
            </article>
          );
        })}
        {!items.length && <p className="empty">学生提交迭代清单后，会出现在这里。</p>}
      </div>
    </section>
  );
}

function TeacherValueCards() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    try {
      const result = await api.submissions();
      setItems(result.task_submissions.filter((item) => item.task_type === "value_card"));
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
    <section className="panel value-card-panel">
      <div className="panel-title">
        <Coins size={20} />
        <h2>D3 价值交换卡</h2>
      </div>
      <div className="artifact-stats">
        <span>{items.length} 张价值卡</span>
        <span>{groupedCount} 个来源</span>
        <span>{items.filter((item) => item.status === "ON_WALL").length} 张已上屏</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="d1-artifact-list">
        {items.map((item) => {
          const exchangeLine = [valueExchangeLabel(item.payload.exchange_choice), asText(item.payload.exchange_amount)].filter(Boolean).join(" ");
          return (
            <article
              className={[
                "d1-artifact-card",
                "value-card",
                item.status === "ON_WALL" ? "on-wall" : ""
              ].filter(Boolean).join(" ")}
              key={item.id}
            >
              <header>
                <div>
                  <span>价值交换卡</span>
                  <strong>{asText(item.payload.product_name) || "未命名作品"}</strong>
                  <small>{item.team_name || item.student_name || "学生提交"}</small>
                </div>
                <button disabled={workingId === item.id} onClick={() => toggleWall(item)}>
                  {item.status === "ON_WALL" ? "从大屏移开" : "放到大屏"}
                </button>
              </header>
              <div className="artifact-lines">
                <p><strong>帮谁：</strong>{asText(item.payload.target_user) || "还没写"}</p>
                <p><strong>少烦了：</strong>{asText(item.payload.value_change) || "还没写"}</p>
                <p><strong>愿意交换：</strong>{exchangeLine || "还没写"}</p>
                <p><strong>为什么值得：</strong>{asText(item.payload.why_worth) || "还没写"}</p>
                <p><strong>证据：</strong>{asText(item.payload.evidence) || "还没写"}</p>
                <p><strong>下一次验证：</strong>{asText(item.payload.next_proof) || "还没写"}</p>
              </div>
            </article>
          );
        })}
        {!items.length && <p className="empty">学生提交价值卡后，会出现在这里。</p>}
      </div>
    </section>
  );
}

function TeacherProductPackaging() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = async () => {
    try {
      const result = await api.submissions();
      setItems(result.task_submissions.filter((item) => item.task_type === "product_packaging"));
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
    <section className="panel product-packaging-panel">
      <div className="panel-title">
        <Image size={20} />
        <h2>D3 产品海报卡</h2>
      </div>
      <div className="artifact-stats">
        <span>{items.length} 张海报卡</span>
        <span>{groupedCount} 个来源</span>
        <span>{items.filter((item) => item.status === "ON_WALL").length} 张已上屏</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="d1-artifact-list">
        {items.map((item) => {
          const sellingPoints = asTextList(item.payload.selling_points);
          const posterUrl = asText(item.payload.poster_url);
          const accessUrl = asText(item.payload.access_url);
          return (
            <article
              className={[
                "d1-artifact-card",
                "product-packaging",
                item.status === "ON_WALL" ? "on-wall" : ""
              ].filter(Boolean).join(" ")}
              key={item.id}
            >
              <header>
                <div>
                  <span>产品海报卡</span>
                  <strong>{asText(item.payload.slogan) || asText(item.payload.product_name) || "未命名作品"}</strong>
                  <small>{item.team_name || item.student_name || "学生提交"}</small>
                </div>
                <button disabled={workingId === item.id} onClick={() => toggleWall(item)}>
                  {item.status === "ON_WALL" ? "从大屏移开" : "放到大屏"}
                </button>
              </header>
              {posterUrl && (
                <div className="artifact-shot">
                  <img src={normalizeShowcaseUrl(posterUrl)} alt={asText(item.payload.product_name) || "产品海报"} />
                </div>
              )}
              <div className="artifact-lines">
                <p><strong>产品：</strong>{asText(item.payload.product_name) || "还没写"}</p>
                <p><strong>标语：</strong>{asText(item.payload.slogan) || "还没写"}</p>
                <p><strong>给谁看：</strong>{asText(item.payload.target_user) || "还没写"}</p>
                <p><strong>卖点：</strong>{sellingPoints.length ? sellingPoints.join(" / ") : asText(item.payload.selling_point_summary) || "还没写"}</p>
                <p><strong>展示图：</strong>{posterUrl || "还没贴"}</p>
                <p><strong>作品入口：</strong>{accessUrl || "还没贴"}</p>
              </div>
            </article>
          );
        })}
        {!items.length && <p className="empty">学生提交产品海报卡后，会出现在这里。</p>}
      </div>
    </section>
  );
}

function TeacherStoryPitches() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [copiedLibrary, setCopiedLibrary] = useState(false);

  const load = async () => {
    try {
      const [result, teamResult] = await Promise.all([api.submissions(), api.teams()]);
      setItems(result.task_submissions.filter((item) => item.task_type === "story_pitch"));
      setTeams(teamResult.teams);
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
  const latestStoryByTeam = useMemo(() => {
    const map = new Map<string, TaskSubmission>();
    teams.forEach((team) => {
      const teamItems = items.filter((item) => item.team_id === team.id || item.team_name === team.name);
      const latest = latestTask(teamItems);
      if (latest) map.set(team.id, latest);
    });
    return map;
  }, [items, teams]);
  const unassignedStoryItems = useMemo(
    () => items.filter((item) => !teams.some((team) => item.team_id === team.id || item.team_name === team.name)),
    [items, teams]
  );
  const rehearsalRows = useMemo(() => {
    const teamRows = teams.map((team) => {
      const item = latestStoryByTeam.get(team.id) || null;
      const qaPairs = item ? storyQaPairs(item.payload) : [];
      const completeCount = item ? completeStoryQaCount(item.payload) : 0;
      return {
        key: team.id,
        label: team.name,
        hint: team.table_no ? `${team.table_no} 号桌` : `第 ${team.group_no} 组`,
        productName: item ? asText(item.payload.product_name) : "",
        item,
        qaPairs,
        completeCount
      };
    });
    const extraRows = unassignedStoryItems.map((item) => {
      const qaPairs = storyQaPairs(item.payload);
      return {
        key: item.id,
        label: item.team_name || item.student_name || "未分组提交",
        hint: item.student_name || "故事卡",
        productName: asText(item.payload.product_name),
        item,
        qaPairs,
        completeCount: completeStoryQaCount(item.payload)
      };
    });
    return [...teamRows, ...extraRows];
  }, [latestStoryByTeam, teams, unassignedStoryItems]);
  const readyTeamCount = rehearsalRows.filter((row) => row.completeCount >= 3).length;
  const missingTeamCount = rehearsalRows.filter((row) => row.completeCount < 3).length;

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

  const copyRehearsalLibrary = async () => {
    const text = rehearsalRows
      .map((row) => {
        const lines = [
          `${row.label}${row.productName ? `｜${row.productName}` : ""}`,
          row.qaPairs.length
            ? row.qaPairs.slice(0, 3).map((pair, index) => (
              `${index + 1}. ${pair.question || "问题待补"}\n答：${pair.answer || "回答待补"}`
            )).join("\n")
            : "还没有预演问答"
        ];
        return lines.join("\n");
      })
      .join("\n\n");
    try {
      await copyToClipboard(`问答预演题库\n\n${text}`);
      setCopiedLibrary(true);
      setMessage("题库已复制。");
      window.setTimeout(() => setCopiedLibrary(false), 2200);
    } catch {
      setMessage("复制失败，可以手动选中页面内容。");
    }
  };

  return (
    <section className="panel story-pitch-panel">
      <div className="panel-title">
        <Megaphone size={20} />
        <h2>D3 故事发布五步卡</h2>
      </div>
      <div className="artifact-stats">
        <span>{items.length} 张故事卡</span>
        <span>{groupedCount} 个来源</span>
        <span>{items.filter((item) => item.status === "ON_WALL").length} 张已上屏</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="rehearsal-library">
        <div className="rehearsal-library-title">
          <div>
            <span>问答预演题库</span>
            <strong>{readyTeamCount} 组备齐，{missingTeamCount} 组还要补问题</strong>
          </div>
          <button type="button" disabled={!rehearsalRows.length} onClick={copyRehearsalLibrary}>
            {copiedLibrary ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            {copiedLibrary ? "已复制" : "复制题库"}
          </button>
        </div>
        <div className="rehearsal-team-grid">
          {rehearsalRows.map((row) => (
            <article className={row.completeCount >= 3 ? "rehearsal-team-card ready" : "rehearsal-team-card"} key={row.key}>
              <header>
                <div>
                  <span>{row.hint}</span>
                  <strong>{row.label}</strong>
                  <small>{row.productName || "还没写作品名"}</small>
                </div>
                <em>{row.completeCount}/3</em>
              </header>
              <div className="rehearsal-question-list">
                {row.qaPairs.length ? row.qaPairs.slice(0, 3).map((pair, index) => (
                  <p key={`${row.key}-library-${index}`}>
                    <b>{index + 1}</b>
                    <span>{pair.question || "问题待补"}</span>
                    <small>{pair.answer || "回答待补"}</small>
                  </p>
                )) : <p className="empty">还没有预演问答。</p>}
              </div>
            </article>
          ))}
          {!rehearsalRows.length && <p className="empty">小组提交故事发布卡后，预演问题会出现在这里。</p>}
        </div>
      </div>
      <div className="d1-artifact-list">
        {items.map((item) => {
          const qaPairs = storyQaPairs(item.payload);
          return (
            <article
              className={[
                "d1-artifact-card",
                "story-pitch",
                item.status === "ON_WALL" ? "on-wall" : ""
              ].filter(Boolean).join(" ")}
              key={item.id}
            >
              <header>
                <div>
                  <span>故事发布五步卡</span>
                  <strong>{asText(item.payload.product_name) || "未命名作品"}</strong>
                  <small>{item.team_name || item.student_name || "学生提交"}</small>
                </div>
                <button disabled={workingId === item.id} onClick={() => toggleWall(item)}>
                  {item.status === "ON_WALL" ? "从大屏移开" : "放到大屏"}
                </button>
              </header>
              <div className="artifact-lines">
                <p><strong>开头：</strong>{asText(item.payload.story_hook) || "还没写"}</p>
                <p><strong>人物：</strong>{asText(item.payload.user_scene) || "还没写"}</p>
                <p><strong>作品：</strong>{asText(item.payload.product_demo) || "还没写"}</p>
                <p><strong>证据：</strong>{asText(item.payload.proof_line) || "还没写"}</p>
                <p><strong>邀请：</strong>{asText(item.payload.invite_line) || "还没写"}</p>
              </div>
              <div className="story-qa-review">
                <strong>问答预演</strong>
                {qaPairs.length ? qaPairs.map((pair, index) => (
                  <p key={`${item.id}-qa-${index}`}>
                    <b>问 {index + 1}：</b>{pair.question}
                    <span>{pair.answer}</span>
                  </p>
                )) : <p>还没写</p>}
              </div>
            </article>
          );
        })}
        {!items.length && <p className="empty">学生提交故事发布五步卡后，会出现在这里。</p>}
      </div>
    </section>
  );
}

function TeacherFinalShowcase() {
  const [items, setItems] = useState<TaskSubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<TaskSubmission[]>([]);
  const [message, setMessage] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const result = await api.submissions();
      const allItems = result.task_submissions;
      const nextItems = sortByDisplayOrder(allItems.filter((item) => item.task_type === "final_showcase"));
      setAllSubmissions(allItems);
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
    const teamName = item.team_name || asText(item.payload.team_name);
    const relatedItems = allSubmissions.filter((candidate) =>
      candidate.id !== item.id && submissionMatchesProjectIdentity(candidate, productName, item.team_id, teamName)
    );
    const packaging = latestTask(relatedItems.filter((candidate) => candidate.task_type === "product_packaging"));
    const story = latestTask(relatedItems.filter((candidate) => candidate.task_type === "story_pitch"));
    const screenshotKey = asText(item.payload.screenshot_key).trim() || asText(packaging?.payload.poster_key).trim();
    const screenshotUrl = asText(item.payload.screenshot_url).trim() || asText(packaging?.payload.poster_url).trim();
    const recordingKey = asText(item.payload.recording_key).trim();
    const recordingUrl = asText(item.payload.recording_url).trim();
    const oneLiner =
      valueLine ||
      asText(packaging?.payload.slogan).trim() ||
      asText(story?.payload.story_hook).trim();
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
        track: teamName || item.student_name || asText(packaging?.payload.target_user) || undefined,
        one_liner: oneLiner || undefined,
        access_url: normalizeShowcaseUrl(accessUrl),
        screenshot_key: screenshotKey || undefined,
        screenshot_url: screenshotUrl ? normalizeShowcaseUrl(screenshotUrl) : undefined,
        recording_key: recordingKey || undefined,
        recording_url: recordingUrl ? normalizeShowcaseUrl(recordingUrl) : undefined,
        publish_status: "PUBLISHED"
      });
      setMessage("已生成公开作品卡，海报和故事线索已合并。");
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
          const pitchDeckUrl = asText(item.payload.pitch_deck_url);
          const contributionItems = contributionCardsFromPayload(item.payload);
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
                <div className="artifact-contribution-list">
                  <strong>个人贡献</strong>
                  {contributionItems.length ? contributionItems.map((card, cardIndex) => (
                    <article key={`${card.name}-${cardIndex}`}>
                      <span>{card.tag}</span>
                      <b>{card.name || "一位成员"}</b>
                      <p>{card.contribution || "完成了团队任务"}</p>
                    </article>
                  )) : <p>还没写</p>}
                </div>
                <p><strong>用户：</strong>{asText(item.payload.target_user) || "还没写"}</p>
                <p><strong>问题：</strong>{asText(item.payload.core_problem) || "还没写"}</p>
                <p><strong>价值：</strong>{asText(item.payload.value_line) || "还没写"}</p>
                {accessUrl && (
                  <p>
                    <strong>链接：</strong>
                    <a href={normalizeShowcaseUrl(accessUrl)} target="_blank" rel="noreferrer">打开作品</a>
                  </p>
                )}
                {pitchDeckUrl && (
                  <p>
                    <strong>路演 PPT：</strong>
                    <a href={normalizeShowcaseUrl(pitchDeckUrl)} target="_blank" rel="noreferrer">打开 PPT</a>
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
      setItems(result.task_submissions.filter((item) => ["learning_reflection", "growth_reflection", "contribution_card"].includes(item.task_type)));
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
        <h2>个人贡献与反思卡</h2>
      </div>
      <div className="artifact-stats">
        <span>{items.length} 张已提交</span>
        <span>{items.filter((item) => item.task_type !== "learning_reflection" && item.status === "ON_WALL").length} 张在成果页</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="d1-artifact-list growth-manage-list">
        {items.map((item) => {
          const ability = asText(item.payload.ability_tag) || "能力标签";
          const isContribution = item.task_type === "contribution_card";
          const isLearning = item.task_type === "learning_reflection";
          return (
            <article className={item.status === "ON_WALL" ? "d1-artifact-card on-wall" : "d1-artifact-card"} key={item.id}>
              <header>
                <div>
                  <span>{isContribution ? "贡献卡" : isLearning ? "日终反思" : ability}</span>
                  <strong>{item.student_name || "学生"}</strong>
                  <small>{item.team_name || asText(item.payload.team_name) || "项目团队"}</small>
                </div>
                <div className="artifact-actions">
                  {isLearning ? (
                    <span className="showcase-status draft">老师复盘</span>
                  ) : (
                    <button disabled={workingId === item.id} onClick={() => toggleDisplay(item)}>
                      {item.status === "ON_WALL" ? "从成果页移开" : "放到成果页"}
                    </button>
                  )}
                </div>
              </header>
              <div className="artifact-lines">
                {isLearning ? (
                  <>
                    <p><strong>记住的一刻：</strong>{asText(item.payload.moment) || "还没写"}</p>
                    <p><strong>方法：</strong>{asText(item.payload.method) || "还没写"}</p>
                    <p><strong>下一次：</strong>{asText(item.payload.next_use) || "还没写"}</p>
                  </>
                ) : isContribution ? (
                  <>
                    <p><strong>能力标签：</strong>{ability}</p>
                    <p><strong>贡献：</strong>{asText(item.payload.contribution) || "还没写"}</p>
                    <p><strong>证据：</strong>{asText(item.payload.evidence) || "还没写"}</p>
                    <p><strong>下一次想练：</strong>{asText(item.payload.next_practice) || "还没写"}</p>
                  </>
                ) : (
                  <>
                    <p><strong>AI 帮的一步：</strong>{asText(item.payload.ai_job) || "还没写"}</p>
                    <p><strong>孩子的判断：</strong>{asText(item.payload.human_decision) || "还没写"}</p>
                    <p><strong>证据：</strong>{asText(item.payload.evidence) || "还没写"}</p>
                    <p><strong>下一次想练：</strong>{asText(item.payload.next_practice) || "还没写"}</p>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {!items.length && <p className="empty">学生写下贡献卡或反思卡后，会出现在这里。</p>}
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

function scoreSubmissionKey(item: TaskSubmission) {
  return asText(item.payload.showcase_item_id) || asText(item.payload.team_id) || asText(item.payload.product_name) || item.id;
}

function isParentObserverScore(item: TaskSubmission) {
  return asText(item.payload.observer_role) === "parent_observer";
}

function isPeerScoreSubmission(item: TaskSubmission) {
  return item.task_type === "observer_score" && !isParentObserverScore(item);
}

function TeacherScoringCenter() {
  const [summaries, setSummaries] = useState<ScoreSummary[]>([]);
  const [awards, setAwards] = useState<AwardResult[]>([]);
  const [observerAccess, setObserverAccess] = useState<{ code: string; path: string } | null>(null);
  const [scoreSubmissions, setScoreSubmissions] = useState<TaskSubmission[]>([]);
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
      setScoreSubmissions(scoreResult.score_submissions);
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

  const parentObserverCount = useMemo(
    () => scoreSubmissions.filter(isParentObserverScore).length,
    [scoreSubmissions]
  );
  const peerVoteCount = useMemo(
    () => scoreSubmissions.filter(isPeerScoreSubmission).length,
    [scoreSubmissions]
  );
  const peerVotesByKey = useMemo(() => {
    const counts = new Map<string, number>();
    scoreSubmissions.filter(isPeerScoreSubmission).forEach((item) => {
      const key = scoreSubmissionKey(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [scoreSubmissions]);
  const topPeerSummary = useMemo(() => {
    return [...summaries].sort((a, b) => {
      const peerDelta = (peerVotesByKey.get(b.key) ?? 0) - (peerVotesByKey.get(a.key) ?? 0);
      if (peerDelta) return peerDelta;
      if (b.average_total !== a.average_total) return b.average_total - a.average_total;
      return b.score_count - a.score_count;
    })[0];
  }, [peerVotesByKey, summaries]);

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
      setMessage("还没有评分和投票。");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      for (const template of awardTemplates) {
        const summary = topScoreSummary(summaries, template.dimension);
        if (summary) await saveAward(template, summary);
      }
      if (topPeerSummary && (peerVotesByKey.get(topPeerSummary.key) ?? 0) > 0) {
        const peerCount = peerVotesByKey.get(topPeerSummary.key) ?? 0;
        await api.saveAward({
          id: "award-peer-choice",
          award_type: "同伴选择奖",
          winner_type: "team",
          winner_id: topPeerSummary.team_id || topPeerSummary.showcase_item_id || topPeerSummary.key,
          winner_name: topPeerSummary.team_name
            ? `${topPeerSummary.team_name} · ${topPeerSummary.product_name}`
            : topPeerSummary.product_name,
          reason: `能力标签：领导力。${peerCount} 张同伴投票把这个作品选出来，大家想继续试用它。`,
          publish_status: "PUBLISHED"
        });
      }
      setMessage(peerVoteCount ? "奖项建议已生成，同伴选择奖也放到成果页。" : "奖项建议已生成，并放到成果页。");
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
        <span>{parentObserverCount} 张家长观察员评分</span>
        <span>{peerVoteCount} 张同伴投票</span>
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
        {summaries.map((summary) => {
          const peerVotes = peerVotesByKey.get(summary.key) ?? 0;
          return (
            <article className="score-summary-row" key={summary.key}>
              <header>
                <div>
                  <span>{summary.team_name || "项目团队"}</span>
                  <strong>{summary.product_name}</strong>
                  <small>{summary.score_count} 张评分与投票 · 同伴 {peerVotes} 张 · 平均 {summary.average_total || "-"} 星</small>
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
          );
        })}
        {!summaries.length && <p className="empty">评分和投票提交后，会出现在这里。</p>}
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

function TeacherShareCenter() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [observerAccess, setObserverAccess] = useState<{ code: string; path: string } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState("");
  const parentShowcaseUrl = absoluteUrl("/parents");
  const classroomShowcaseUrl = absoluteUrl("/showcase");
  const wallUrl = absoluteUrl("/wall");

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [showcaseResult, observerResult] = await Promise.all([
        api.manageShowcase(),
        api.observerScoreAccess().catch(() => null)
      ]);
      setItems(showcaseResult.showcase_items);
      setObserverAccess(observerResult);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const copyLink = async (key: string, url: string) => {
    try {
      await copyToClipboard(url);
      setCopiedKey(key);
      setMessage("链接已复制。");
      window.setTimeout(() => setCopiedKey(""), 2200);
    } catch {
      setMessage("复制失败，可以手动选中链接。");
    }
  };

  const publishedItems = items
    .filter((item) => item.publish_status === "PUBLISHED")
    .sort((a, b) => String(a.product_name || "").localeCompare(String(b.product_name || ""), "zh-Hans-CN"));

  const shareLinks = [
    { key: "parents", label: "家长作品展", url: parentShowcaseUrl, icon: <Share2 size={16} /> },
    { key: "showcase", label: "课堂作品展", url: classroomShowcaseUrl, icon: <Package size={16} /> },
    { key: "wall", label: "展示大屏", url: wallUrl, icon: <Monitor size={16} /> }
  ];
  if (observerAccess?.path) {
    shareLinks.push({
      key: "score",
      label: `家长评分 · ${observerAccess.code}`,
      url: absoluteUrl(observerAccess.path),
      icon: <Star size={16} />
    });
  }

  return (
    <section className="panel share-center-panel">
      <div className="panel-title">
        <Link2 size={20} />
        <h2>成果分享</h2>
      </div>
      <div className="artifact-stats">
        <span>{publishedItems.length} 张可分享作品卡</span>
        <span>{observerAccess ? "家长评分已准备" : "家长评分稍后准备"}</span>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="share-link-grid">
        {shareLinks.map((link) => (
          <article className="share-link-card" key={link.key}>
            <div>
              <span>{link.label}</span>
              <input readOnly value={link.url} onFocus={(event) => event.currentTarget.select()} aria-label={`${link.label}链接`} />
            </div>
            <button type="button" onClick={() => copyLink(link.key, link.url)}>
              {copiedKey === link.key ? <CheckCircle2 size={16} /> : link.icon}
              {copiedKey === link.key ? "已复制" : "复制"}
            </button>
          </article>
        ))}
      </div>
      <div className="share-project-list">
        {publishedItems.map((item) => {
          const url = absoluteUrl(publicProjectUrl(item.id, "/parents"));
          const key = `project-${item.id}`;
          return (
            <article className="share-project-row" key={item.id}>
              <div>
                <span>{item.team_name || item.track || "项目团队"}</span>
                <strong>{item.product_name}</strong>
                <small>{item.one_liner || "家长可以打开这个作品页查看项目故事。"}</small>
              </div>
              <div className="row-actions">
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} />
                  打开
                </a>
                <button type="button" onClick={() => copyLink(key, url)}>
                  {copiedKey === key ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                  {copiedKey === key ? "已复制" : "复制作品页"}
                </button>
              </div>
            </article>
          );
        })}
        {!publishedItems.length && (
          <p className="empty">{loading ? "正在读取作品卡。" : "作品卡放进展示区后，这里会出现可分享链接。"}</p>
        )}
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

type ClassroomImageAssetType = "product-screenshot" | "product-poster" | "final-showcase-screenshot";
type ClassroomVideoAssetType = "product-recording" | "final-showcase-recording";

function mediaObjectUrl(objectKey: string) {
  return `${API_BASE}/media/object?key=${encodeURIComponent(objectKey)}`;
}

async function uploadClassroomImage(file: File, assetType: ClassroomImageAssetType) {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择一张图片。");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("这张图片有点大，请换一张小于 8MB 的图片。");
  }
  const target = await api.uploadToken(assetType, file.name);
  if (target.provider !== "mock") {
    const response = await fetch(target.uploadUrl, {
      method: "PUT",
      headers: target.headers,
      body: file
    });
    if (!response.ok) throw new Error("图片没有传好，请重新选一次。");
  }
  await api.registerMediaAsset({
    object_key: target.objectKey,
    asset_type: assetType,
    title: file.name
  });
  return {
    objectKey: target.objectKey,
    url: mediaObjectUrl(target.objectKey)
  };
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|m4v|mov|webm)$/i.test(file.name);
}

async function uploadClassroomVideo(file: File, assetType: ClassroomVideoAssetType) {
  if (!isVideoFile(file)) {
    throw new Error("请选择一段视频。");
  }
  if (file.size > 80 * 1024 * 1024) {
    throw new Error("这段视频有点大，请换一段小于 80MB 的视频。");
  }
  const target = await api.uploadToken(assetType, file.name);
  if (target.provider !== "mock") {
    const response = await fetch(target.uploadUrl, {
      method: "PUT",
      headers: target.headers,
      body: file
    });
    if (!response.ok) throw new Error("视频没有传好，请重新选一次。");
  }
  await api.registerMediaAsset({
    object_key: target.objectKey,
    asset_type: assetType,
    title: file.name
  });
  return {
    objectKey: target.objectKey,
    url: mediaObjectUrl(target.objectKey)
  };
}

function StudentImageUploadField({
  label,
  value,
  objectKey,
  assetType,
  onChange,
  onObjectKeyChange
}: {
  label: string;
  value: string;
  objectKey: string;
  assetType: ClassroomImageAssetType;
  onChange: (value: string) => void;
  onObjectKeyChange: (value: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const selectFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const result = await uploadClassroomImage(file, assetType);
      onChange(result.url);
      onObjectKeyChange(result.objectKey);
      setMessage("展示图已准备好。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "图片没有传好，请重新选一次。");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="student-upload-field">
      <label>
        {label}
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(event) => void selectFile(event.currentTarget.files?.[0] ?? null)}
        />
      </label>
      <label>
        或粘贴图片链接
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onObjectKeyChange("");
          }}
          placeholder="https://..."
          inputMode="url"
        />
      </label>
      {value && (
        <div className="student-upload-preview">
          <img src={normalizeShowcaseUrl(value)} alt="展示图预览" />
          <span>{objectKey ? "展示图已准备好" : "已填写图片链接"}</span>
        </div>
      )}
      {message && <p className={message.includes("准备好") ? "student-upload-message success" : "student-upload-message"}>{message}</p>}
    </div>
  );
}

function StudentVideoUploadField({
  label,
  value,
  objectKey,
  assetType,
  onChange,
  onObjectKeyChange
}: {
  label: string;
  value: string;
  objectKey: string;
  assetType: ClassroomVideoAssetType;
  onChange: (value: string) => void;
  onObjectKeyChange: (value: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const selectFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const result = await uploadClassroomVideo(file, assetType);
      onChange(result.url);
      onObjectKeyChange(result.objectKey);
      setMessage("演示视频已准备好。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "视频没有传好，请重新选一次。");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="student-upload-field">
      <label>
        {label}
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          disabled={uploading}
          onChange={(event) => void selectFile(event.currentTarget.files?.[0] ?? null)}
        />
      </label>
      <label>
        或粘贴视频链接
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onObjectKeyChange("");
          }}
          placeholder="https://..."
          inputMode="url"
        />
      </label>
      {value && (
        <div className="student-upload-preview video">
          <video src={normalizeShowcaseUrl(value)} controls preload="metadata" playsInline />
          <span>{objectKey ? "演示视频已准备好" : "已填写视频链接"}</span>
        </div>
      )}
      {message && <p className={message.includes("准备好") ? "student-upload-message success" : "student-upload-message"}>{message}</p>}
    </div>
  );
}

function ShowcaseGallery({ items, variant = "panel" }: { items: ShowcaseItem[]; variant?: "panel" | "wall" }) {
  const visibleItems = items.filter((item) => item.publish_status === "PUBLISHED" || variant === "panel");
  const isWall = variant === "wall";
  return (
    <div className={`showcase-gallery ${variant}`}>
      {visibleItems.map((item) => {
        const href = item.access_url ? normalizeShowcaseUrl(item.access_url) : "";
        const screenshot = item.screenshot_url ? normalizeShowcaseUrl(item.screenshot_url) : "";
        const recording = item.recording_url ? normalizeShowcaseUrl(item.recording_url) : "";
        const card = (
          <article className="showcase-card">
            <div className="showcase-shot">
              {screenshot ? (
                <img src={screenshot} alt={item.product_name} />
              ) : recording ? (
                <video src={recording} muted preload="metadata" playsInline />
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
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [recordingUrl, setRecordingUrl] = useState("");
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
    setScreenshotUrl("");
    setRecordingUrl("");
  };

  const editItem = (item: ShowcaseItem) => {
    setEditingId(item.id);
    setTeamId(item.team_id || "");
    setProductName(item.product_name || "");
    setTrack(item.track || "");
    setOneLiner(item.one_liner || "");
    setAccessUrl(item.access_url || "");
    setScreenshotUrl(item.screenshot_url || "");
    setRecordingUrl(item.recording_url || "");
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
        screenshot_url: screenshotUrl.trim() ? normalizeShowcaseUrl(screenshotUrl) : undefined,
        recording_url: recordingUrl.trim() ? normalizeShowcaseUrl(recordingUrl) : undefined,
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
        screenshot_url: item.screenshot_url ? normalizeShowcaseUrl(item.screenshot_url) : undefined,
        recording_key: item.recording_key || undefined,
        recording_url: item.recording_url ? normalizeShowcaseUrl(item.recording_url) : undefined,
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
        <input value={screenshotUrl} onChange={(event) => setScreenshotUrl(event.target.value)} placeholder="展示图链接" />
        <input value={recordingUrl} onChange={(event) => setRecordingUrl(event.target.value)} placeholder="演示视频链接" />
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
    activity: "实验页",
    experiment: "实验页",
    demo: "演示页",
    "ai-demo": "演示页",
    showcase: "展示页",
    teamwork: "团队工作",
    coaching: "巡场指导"
  };
  return labels[pageType] ?? "课件页";
}

const knowledgeInputModules = new Set([
  "ai-judgement",
  "ai-superpowers",
  "ai-lab",
  "tool-demo",
  "value-experiment",
  "product-packaging",
  "roadshow-rehearsal",
  "brand-story"
]);

function isKnowledgeInputPage(module: CourseModule, page: DesignedLessonPage) {
  return (
    knowledgeInputModules.has(module.id) ||
    ["story", "demo", "ai-demo", "experiment", "activity"].includes(page.page_type) ||
    /AI 跑偏|改回来/.test(page.title)
  );
}

function artifactKindForPage(module: CourseModule, page: DesignedLessonPage): LessonArtifactKind | null {
  if (module.id === "team-formation") return "team-roles";
  if (module.id === "problem-wall") return "problem-wall";
  if (module.id === "ai-judgement") {
    if (/拆开看/.test(page.title)) return "ai-workbench";
    if (/工作线|拼图|任务单一改/.test(page.title)) return "ai-pipeline";
    if (/回答怎么用/.test(page.title)) return "ai-check-lights";
    return "prompt-card";
  }
  if (module.id === "ai-superpowers") {
    if (/便利贴|豆包|问题改写/.test(page.title)) return "problem-wall";
    if (/已有方案|DeepSeek|市场侦察/.test(page.title)) return "market-scout";
    return "competitor-grid";
  }
  if (module.id === "user-interview") return "interview-card";
  if (module.id === "project-launch") return /赛道|方向/.test(page.title) ? "direction-map" : "product-sentence";
  if (module.id === "ai-lab") return page.title.includes("再改") ? "ai-revise" : "prompt-card";
  if (module.id === "product-prototype") return "prototype-board";
  if (module.id === "tech-route") return "route-map";
  if (module.id === "tool-demo") {
    if (/智能体|接待用户/.test(page.title)) return "agent-card";
    if (/工作流|步骤排清楚/.test(page.title)) return "workflow-map";
    if (/秒哒|V1|应用原型/.test(page.title)) return "app-prototype";
    return "product-browser";
  }
  if (module.id === "build-sprint") return "product-browser";
  if (module.id === "roadshow-rehearsal") return "roadshow-pack";
  if (module.id === "user-testing") return "testing-board";
  if (module.id === "demo-check" || module.id === "rehearsal") return "demo-strip";
  if (module.id === "value-experiment") return "pricing-ticket";
  if (module.id === "product-packaging") return page.title.includes("清单") ? "launch-checklist" : "product-browser";
  if (module.id === "brand-story") return null;
  if (module.id === "final-showcase") return page.title.includes("观察员") ? "observer-cards" : "showcase-run";
  if (module.id === "awards-reflection") return "five-forces";
  const artifacts: Record<string, LessonArtifactKind> = {
    "团队名称和方向": "team-roles",
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

function lessonBeatForPage(module: CourseModule, page: DesignedLessonPage) {
  if (!isKnowledgeInputPage(module, page) && module.id !== "future-photo-studio") {
    if (page.page_type === "showcase") return "showcase";
    if (page.page_type === "coaching") return "coaching";
    return "teamwork";
  }
  if (page.page_type === "demo" || page.page_type === "ai-demo") return "demo";
  if (page.page_type === "experiment" || page.page_type === "activity") return "experiment";
  if (page.page_type === "showcase") return "showcase";
  return "story";
}

function pblStepForPage(page: DesignedLessonPage) {
  if (page.page_type === "showcase") return "showcase";
  if (page.page_type === "coaching") return "coaching";
  if (/讨论|分工|晨会|互测/.test(page.title) || page.page_no === 1) return "discussion";
  return "output";
}

function specialChipsForPage(page: DesignedLessonPage) {
  const chips: Record<string, string[]> = {
    "每个人都是自己 AI 的 CEO": ["指挥 AI", "判断 AI", "对作品负责"],
    "照相馆拆开看": ["照片", "职业词", "任务单"],
    "AI 工作线：看见、读到、生成": ["多模态", "提示词", "图像生成"],
    "大模型像补下一块拼图": ["看线索", "找规律", "补下一块"],
    "老师演示：任务单一改，回答就变": ["模糊问题", "清楚任务单", "结果对比"],
    "轮到你实验：给 DeepSeek 一张任务单": ["帮谁", "什么麻烦", "先做什么"],
    "AI 的回答怎么用？": ["能用", "不确定", "太大太远"],
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
    "照相馆拆开看": [
      { title: "照片", text: "AI 看见今天的你" },
      { title: "职业词", text: "你说出的未来方向" },
      { title: "任务单", text: "请生成一张未来职业照" },
      { title: "新画面", text: "AI 把线索组合成结果" }
    ],
    "AI 工作线：看见、读到、生成": [
      { title: "看见", text: "照片里的脸、姿势和背景" },
      { title: "读到", text: "职业词和老师给的任务单" },
      { title: "生成", text: "把线索补成一张新画面" },
      { title: "交回", text: "结果先给人看，再决定用不用" }
    ],
    "大模型像补下一块拼图": [
      { title: "看过很多例子", text: "知道许多文字和画面的搭配" },
      { title: "根据前面线索", text: "从照片、职业词、问题里找规律" },
      { title: "补下一块", text: "继续写一句，或生成一张图" },
      { title: "不是最后决定", text: "能不能用，还要人来判断" }
    ],
    "老师演示：任务单一改，回答就变": [
      { title: "模糊问题", text: "帮我想一个校园产品" },
      { title: "清楚任务单", text: "请当产品顾问，帮我们看谁需要、卡在哪、先做什么" },
      { title: "结果对比", text: "哪一版更能让团队继续讨论" }
    ],
    "轮到你实验：给 DeepSeek 一张任务单": [
      { title: "我是谁", text: "请你当产品顾问" },
      { title: "要做什么", text: "帮我们看这个方向可能帮谁" },
      { title: "怎么回答", text: "用三句话，给一个例子" },
      { title: "带回小组", text: "留下能继续讨论的一句" }
    ],
    "AI 的回答怎么用？": [
      { title: "能用", text: "能帮小组往前走，就留下" },
      { title: "不确定", text: "听起来有可能，就去问同学或用户" },
      { title: "太大太远", text: "今天做不了，就先放下" }
    ],
    "竞品观察三格": [
      { title: "谁在用", text: "它现在服务哪类用户" },
      { title: "怎么解决", text: "它让用户完成什么动作" },
      { title: "哪里不同", text: "我们可以做出一个新角度" }
    ],
    "便利贴侦探：两张纸的差别": [
      { title: "作业好烦", text: "像一声叹气" },
      { title: "谁会卡住", text: "放学后的四年级学生" },
      { title: "卡在哪里", text: "不知道先写哪一科" }
    ],
    "老师演示：豆包把烦恼改成问题": [
      { title: "原句", text: "作业好烦" },
      { title: "豆包改写", text: "谁、在哪、卡在哪" },
      { title: "继续追问", text: "再缩小到今天能采访" }
    ],
    "市场侦察打开一条街": [
      { title: "清单", text: "有人已经这样解决" },
      { title: "计时器", text: "有人用时间帮自己开始" },
      { title: "提醒", text: "有人靠别人催一下" },
      { title: "新角度", text: "我们可以只解决第一步" }
    ],
    "老师演示：DeepSeek 找已有方案": [
      { title: "已有办法", text: "先看别人怎么解决" },
      { title: "哪里不够", text: "找到还没被照顾的地方" },
      { title: "还要问谁", text: "把问题带回真人" }
    ],
    "大模型需要清楚任务": [
      { title: "大模型", text: "根据输入继续生成内容" },
      { title: "任务说明", text: "说清目标、用户和材料" },
      { title: "人的判断", text: "团队决定哪一版能用" }
    ],
    "老师演示：豆包先出三版": [
      { title: "输入", text: "目标、用户、材料、限制、格式" },
      { title: "三版", text: "快速看见不同表达" },
      { title: "选择", text: "挑最清楚的一版" }
    ],
    "老师演示：DeepSeek 帮忙检查": [
      { title: "太夸张", text: "删掉听起来像广告的词" },
      { title: "看不懂", text: "改成用户能明白的话" },
      { title: "缺证据", text: "补采访或试玩线索" }
    ],
    "产品需要一个会接待用户的脑袋": [
      { title: "用户来问", text: "我今天先写什么？" },
      { title: "产品追问", text: "哪一科最难，明天要交什么？" },
      { title: "给出建议", text: "只给 3 步，先开始第一步" }
    ],
    "老师演示：扣子最小智能体": [
      { title: "名字", text: "作业顺序助手" },
      { title: "帮谁", text: "放学后不知道先写哪科的学生" },
      { title: "边界", text: "给建议，不替学生写答案" },
      { title: "测试", text: "用一个真实问题试一下" }
    ],
    "工作流：把步骤排清楚": [
      { title: "收集", text: "今天有哪些作业" },
      { title: "补条件", text: "难度和截止时间" },
      { title: "判断", text: "最难且最急优先" },
      { title: "输出", text: "3 步完成顺序" }
    ],
    "老师演示：秒哒生成应用原型": [
      { title: "用户", text: "给谁用" },
      { title: "核心动作", text: "打开后先做什么" },
      { title: "页面要求", text: "输入区、按钮、结果区" }
    ],
    "生成可打开的 V1": [
      { title: "输入一句话", text: "把用户、场景、动作说清楚" },
      { title: "打开预览", text: "看别人能不能完成动作" },
      { title: "改一处", text: "让核心按钮更明显" }
    ],
    "发布会前，材料铺满桌面": [
      { title: "作品链接", text: "能打开" },
      { title: "截图", text: "能看懂" },
      { title: "证据", text: "采访和试玩反馈" },
      { title: "分工", text: "谁讲哪一步" }
    ],
    "老师演示：WorkBuddy 整理材料包": [
      { title: "材料", text: "只放已经有的成果" },
      { title: "顺序", text: "用户、作品、证据、下一步" },
      { title: "检查", text: "太长就再缩短" }
    ],
    "作品链接和路演 PPT": [
      { title: "作品链接", text: "让别人能打开体验" },
      { title: "路演 PPT", text: "只放展示需要的页面" },
      { title: "上台顺序", text: "每个人负责一段" }
    ],
    "观察员会追问": [
      { title: "真的需要吗", text: "拿出采访证据" },
      { title: "能用起来吗", text: "现场演示核心动作" },
      { title: "下一步呢", text: "说出先改哪里" }
    ],
    "老师演示：DeepSeek 模拟追问": [
      { title: "用户", text: "谁真的需要" },
      { title: "作品", text: "是否完成核心动作" },
      { title: "证据", text: "试玩反馈说明什么" },
      { title: "下一步", text: "先改哪一处" }
    ],
    "结论、证据、下一步": [
      { title: "结论", text: "先直接回答" },
      { title: "证据", text: "再说采访或试玩" },
      { title: "下一步", text: "最后说明先改哪里" }
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
    "照相馆拆开看": ["先找照片线索", "再看职业词", "最后看任务单"],
    "AI 工作线：看见、读到、生成": ["看见图片", "读到文字", "按任务单生成", "把结果交给人"],
    "大模型像补下一块拼图": ["看到前面线索", "找相似规律", "补出下一块"],
    "老师演示：任务单一改，回答就变": ["先问模糊问题", "再写清楚任务单", "对比哪版更能用"],
    "轮到你实验：给 DeepSeek 一张任务单": ["写团队方向", "问 DeepSeek", "留下能用一句"],
    "AI 的回答怎么用？": ["能帮我们往前走，就留下", "还不确定，就问同学或用户", "太大太远，就先放下"],
    "问题改写卡": ["选一个原始烦恼", "让豆包改成 3 个问题", "团队选一个今天继续追"],
    "AI 市场侦察卡": ["找一条用户声音", "找一个已有方案", "写下还要验证的问题"],
    "老师演示：DeepSeek 找已有方案": ["输入产品一句话", "看已有办法", "写下还要问真人的问题"],
    "选一条赛道，找到一个真实用户": ["选定一条赛道", "写出一个真实用户", "准备问他三个问题"],
    "把线索变成产品一句话": ["谁遇到麻烦", "麻烦发生在哪里", "我们用什么帮他"],
    "老师演示：豆包先出三版": ["输入五句提示词", "得到 3 个版本", "挑出最清楚的一版"],
    "老师演示：DeepSeek 帮忙检查": ["粘贴第一版", "找夸张和缺证据的句子", "改成更稳的一版"],
    "老师演示：扣子最小智能体": ["写清服务对象", "写清任务边界", "用真实问题测试"],
    "工作流：把步骤排清楚": ["收集信息", "补充条件", "判断顺序", "输出 3 步"],
    "老师演示：秒哒生成应用原型": ["写清用户和场景", "写清核心动作", "预览第一版"],
    "生成可打开的 V1": ["生成第一版", "打开预览", "写一条修改指令"],
    "团队讨论：选择创业方向": ["看采访证据", "选一个创业方向", "说出为什么继续做"],
    "需求三问：用户、场景、动作": ["谁会遇到", "在哪里发生", "希望哪个动作变简单"],
    "产品方案一句话": ["帮谁", "解决什么", "用什么动作帮他"],
    "发布会前，材料铺满桌面": ["作品链接", "截图", "采访证据", "分工"],
    "老师演示：WorkBuddy 整理材料包": ["粘贴已有材料", "生成路演顺序", "缩短到孩子能讲"],
    "作品链接和路演 PPT": ["填作品链接", "上传路演 PPT", "确认上台分工"],
    "结论、证据、下一步": ["选 2 个追问", "先答结论", "补证据和下一步"],
    "作品页上线清单": ["产品名和一句话", "可打开链接", "截图或演示画面", "用户故事和下一步"],
    "下一次我怎么指挥 AI": ["先说清目标", "用证据检查结果", "继续改到更适合用户"]
  };
  return steps[page.title];
}

function expectedOutputForLesson(module: CourseModule, page: DesignedLessonPage) {
  const outputs: Record<string, string> = {
    "team-formation": "提交一张团队名片：团队名、产品方向和亮相句",
    "problem-wall": "提交一张问题卡：谁、在哪里、遇到什么麻烦",
    "ai-judgement": "提交一张 AI 对话卡：清楚问题、能用一句、还要问同学或用户的一句",
    "ai-superpowers": "提交一张侦察卡：原始烦恼、问题改写、已有方案和继续追问",
    "user-interview": "带回一条用户原话和一个新的发现",
    "project-launch": "写出产品一句话：帮谁、解决什么、怎么解决",
    "day1-reflection": "写下一条下次还能用的 AI 判断方法",
    "day2-kickoff": "圈出今天必须先跑通的一个核心动作",
    "ai-lab": "完成一张五句提示词卡，并用 DeepSeek 检查一次",
    "product-prototype": "提交核心动作卡：功能清单、第一版范围和最小结果",
    "tech-route": "提交路线流程卡：路线选择和 3 到 5 步使用流程",
    "tool-demo": "完成一个最小智能体规则或可打开 V1 原型",
    "build-sprint": "作品能打开，别人能完成一个核心动作",
    "user-testing": "收到一条同伴反馈，并写进下一版改动",
    "demo-check": "留下产品链接、截图和一个 AI 修正方法",
    "roadshow-rehearsal": "提交作品链接和路演 PPT，排好上台顺序",
    "value-experiment": "完成价值卡：产品帮别人少烦了什么，别人愿意交换什么",
    "product-packaging": "完成产品海报卡：名字、标语、截图和三条亮点",
    "brand-story": "准备 2 个观察员追问回答：结论、证据、下一步",
    "rehearsal": "完成一轮融资路演彩排，保留最清楚的展示动作",
    "final-showcase": "完成一次融资路演：用户、作品、结果和下一步",
    "awards-reflection": "写下一条自己的真实贡献和下一次 AI 使用方法"
  };
  if (page.page_type === "showcase") return page.content_summary || outputs[module.id];
  return outputs[module.id] || expectedOutputForPage(page);
}

function cardsForPage(module: CourseModule, page: DesignedLessonPage) {
  const design = moduleDesigns[module.id];
  const specialCards = specialCardsForPage(page);
  if (specialCards) return specialCards;
  const beat = lessonBeatForPage(module, page);
  if (beat === "teamwork") {
    return [
      { title: "团队要决定", text: page.content_summary || module.subtitle || "先把小组决定说清楚" },
      { title: "小组产出", text: expectedOutputForLesson(module, page) },
      { title: "老师会看", text: "分工、证据、卡点和下一步是否清楚" }
    ];
  }
  if (beat === "coaching") {
    return [
      { title: "卡点摊开", text: page.content_summary || "把卡在哪里说成别人能帮忙的一句话" },
      { title: "老师答疑", text: "现场看问题、给建议、帮团队缩小范围" },
      { title: "观察记录", text: "记录每个人在团队里的真实贡献" }
    ];
  }
  if (beat === "story") {
    return [
      { title: "故事现场", text: page.content_summary || module.subtitle || "先进入今天的情境" },
      { title: "先看见", text: design?.steps?.[0] || "看到一个真实场景" },
      { title: "然后呢", text: design?.steps?.[1] || "准备动手试一次" }
    ];
  }
  if (beat === "demo") {
    const flow = page.flow ?? design?.flow ?? design?.cards;
    return [
      { title: "老师先演示", text: page.content_summary || "看一次完整做法" },
      { title: "看变化", text: flow?.[1]?.text || design?.steps?.[1] || "看输入和结果哪里变了" },
      { title: "借方法", text: flow?.[2]?.text || design?.steps?.[2] || "把方法带回自己的作品" }
    ];
  }
  if (beat === "experiment") {
    return [
      { title: "你的实验", text: page.content_summary || "自己动手试一次" },
      { title: "动手动作", text: design?.steps?.[1] || design?.cards?.[1]?.text || "完成一个小结果" },
      { title: "留下证据", text: expectedOutputForLesson(module, page) }
    ];
  }
  if (beat === "showcase") {
    return [
      { title: "看作品", text: page.content_summary || "看见同学的真实结果" },
      { title: "说亮点", text: design?.cards?.[0]?.text || "找到一个值得借走的方法" },
      { title: "下一步", text: design?.steps?.[2] || "准备继续改一版" }
    ];
  }
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
    const teamCards = [
      ["成员", "老师分好的小组", "看见今天一起出发的人"],
      ["名称", "给团队起名", "起一个能被记住的名字"],
      ["方向", "选一个真实问题", "先定想继续做哪件事"],
      ["亮相", "一句话出场", "让大家记住你们"]
    ];
    return (
      <div className="timeline-artifact artifact-roles">
        {teamCards.map(([label, title, text]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{title}</strong>
            <span>{text}</span>
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

  if (kind === "ai-workbench") {
    return (
      <div className="timeline-artifact artifact-ai-workbench">
        <header>
          <Sparkles size={22} />
          <strong>AI 工作台</strong>
        </header>
        {cards.slice(0, 4).map((card, index) => (
          <article key={card.title}>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <strong>{card.title}</strong>
            <span>{card.text}</span>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "ai-pipeline") {
    const pipeline = steps.length ? steps.slice(0, 4) : ["看见图片", "读到文字", "按任务单生成", "把结果交给人"];
    return (
      <div className="timeline-artifact artifact-ai-pipeline">
        {pipeline.map((step, index) => (
          <React.Fragment key={step}>
            <article>
              <b>{index + 1}</b>
              <strong>{step}</strong>
              <span>{cards[index]?.text || "把线索继续往前推进"}</span>
            </article>
            {index < pipeline.length - 1 && <em>→</em>}
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (kind === "ai-check-lights") {
    const lights = [
      ["能用", "帮小组往前走，留下", "#2f9e44"],
      ["不确定", "问同学或用户", "#f2b705"],
      ["太大太远", "今天做不了，先放下", "#e15648"]
    ];
    return (
      <div className="timeline-artifact artifact-ai-lights">
        {lights.map(([label, text, color]) => (
          <article key={label} style={{ "--light-color": color } as React.CSSProperties}>
            <span />
            <strong>{label}</strong>
            <small>{text}</small>
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
        {productTrackOptions.map((track, index) => (
          <article key={track.value}>
            <small>{String.fromCharCode(65 + index)}</small>
            <strong>{track.label}</strong>
            <span>{track.hint}</span>
            <div className="direction-chip-list">
              {track.directions.map((direction) => (
                <b key={direction}>{direction}</b>
              ))}
            </div>
            <em>选好方向后，写出一个真实用户。</em>
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

  if (kind === "agent-card") {
    const agentFields = [
      ["名字", "作业顺序助手"],
      ["帮谁", "放学后不知道先写哪科的学生"],
      ["能做", "给出 3 步建议"],
      ["不能做", "不替学生写答案"],
      ["测试", "我今天先写什么？"]
    ];
    return (
      <div className="timeline-artifact artifact-agent">
        <header>
          <MessageSquareText size={22} />
          <strong>最小智能体</strong>
        </header>
        {agentFields.map(([label, text]) => (
          <article key={label}>
            <small>{label}</small>
            <span>{text}</span>
          </article>
        ))}
      </div>
    );
  }

  if (kind === "workflow-map") {
    const flowSteps = ["收集信息", "补充条件", "判断顺序", "输出结果"];
    return (
      <div className="timeline-artifact artifact-workflow">
        {flowSteps.map((step, index) => (
          <React.Fragment key={step}>
            <article>
              <b>{index + 1}</b>
              <strong>{step}</strong>
              <span>{["问有哪些作业", "难度和截止时间", "最难且最急优先", "只给 3 步"][index]}</span>
            </article>
            {index < flowSteps.length - 1 && <em>→</em>}
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (kind === "app-prototype") {
    return (
      <div className="timeline-artifact artifact-app-prototype">
        <header>
          <span />
          <span />
          <span />
          <strong>浏览器能打开</strong>
        </header>
        <main>
          <article>
            <small>输入区</small>
            <strong>今天有哪些作业？</strong>
          </article>
          <button type="button">生成顺序</button>
          <article>
            <small>结果区</small>
            <strong>1. 先做数学</strong>
            <strong>2. 背英语</strong>
            <strong>3. 读语文</strong>
          </article>
        </main>
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

  if (kind === "roadshow-pack") {
    const packItems = [
      ["作品链接", "能打开体验"],
      ["路演 PPT", "只放需要展示的页"],
      ["证据", "采访和试玩反馈"],
      ["分工", "每个人一段"]
    ];
    return (
      <div className="timeline-artifact artifact-roadshow-pack">
        <header>
          <ClipboardCheck size={22} />
          <strong>路演材料包</strong>
        </header>
        {packItems.map(([label, text]) => (
          <article key={label}>
            <CheckCircle2 size={18} />
            <strong>{label}</strong>
            <span>{text}</span>
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

function aiPrincipleTakeaway(page: DesignedLessonPage) {
  const takeaways: Record<number, string> = {
    1: "一句话：AI 像电脑里的聪明大脑",
    2: "一句话：它先会读字和聊天",
    3: "一句话：问清楚，回答才有用",
    4: "一句话：图片也能成为线索",
    5: "一句话：未来照由三条线索生成",
    6: "现在做：问一句清楚问题"
  };
  return takeaways[page.page_no] ?? "这一页：把 AI 用清楚";
}

function AiPrincipleVisual({ page }: { page: DesignedLessonPage }) {
  if (page.page_no === 1) {
    return (
      <div className="ai-principle-visual ai-brain-intro ai-ppt-sample">
        <section className="ai-story-panel" aria-label="未来照相馆引出 AI">
          <div className="ai-story-question">
            <Sparkles size={24} />
            <strong>刚才的未来照片，为什么会出现？</strong>
          </div>
          <div className="ai-clue-cards" aria-label="给 AI 的三条线索">
            <article>
              <Image size={24} />
              <strong>照片</strong>
              <span>今天的你</span>
            </article>
            <article>
              <Mic size={24} />
              <strong>职业</strong>
              <span>想做什么</span>
            </article>
            <article>
              <MessageSquareText size={24} />
              <strong>要求</strong>
              <span>画成什么样</span>
            </article>
          </div>
          <div className="ai-kid-prompt">
            <span>给 AI 线索，它才知道要帮你做什么。</span>
          </div>
        </section>
        <section className="ai-brain-workshop" aria-label="AI 怎么工作">
          <div className="ai-smart-brain" aria-label="电脑里的聪明大脑">
            <Brain size={64} />
            <strong>AI 大脑</strong>
            <span>读懂线索</span>
          </div>
          <div className="ai-output-cards" aria-label="AI 生成的结果">
            <article>
              <MessageSquareText size={24} />
              <strong>回答你</strong>
              <span>像聊天一样</span>
            </article>
            <article>
              <Image size={24} />
              <strong>画新图</strong>
              <span>像未来照片</span>
            </article>
            <article>
              <Lightbulb size={24} />
              <strong>给方法</strong>
              <span>帮项目往前走</span>
            </article>
          </div>
        </section>
      </div>
    );
  }

  if (page.page_no === 2) {
    return (
      <div className="ai-principle-visual ai-chat-scene">
        <div className="ai-workbuddy-window">
          <header>
            <span></span>
            <span></span>
            <span></span>
            <strong>和 AI 聊天</strong>
          </header>
          <main className="ai-chat-thread">
            <article className="ai-chat-bubble from-kid">
              <small>你说</small>
              <b>我想做一个校园产品，可以怎么开始？</b>
            </article>
            <div className="ai-demo-arrow" aria-label="AI 读懂问题再回答">
              <MessageSquareText size={18} />
              <span>读懂</span>
            </div>
            <article className="ai-chat-bubble from-ai">
              <small>AI 回答</small>
              <b>先找一个同学真的遇到的小麻烦。</b>
            </article>
          </main>
          <div className="ai-chat-steps">
            <span>你提问</span>
            <span>AI 读字</span>
            <span>AI 回答</span>
          </div>
        </div>
      </div>
    );
  }

  if (page.page_no === 3) {
    return (
      <div className="ai-principle-visual ai-demo-screen">
        <div className="ai-workbuddy-window">
          <header>
            <span></span>
            <span></span>
            <span></span>
            <strong>WorkBuddy · DeepSeek</strong>
          </header>
          <div className="ai-visual-sentence">同一个 AI，你问法一变，答案就变</div>
          <main>
            <article className="weak-prompt">
              <small>这样问太散</small>
              <b>帮我想想</b>
              <span>它不知道先帮你想哪一步</span>
            </article>
            <div className="ai-demo-arrow" aria-label="老师把问题说清楚">
              <Sparkles size={18} />
              <span>说清楚</span>
            </div>
            <article className="clear-prompt">
              <small>这样问能用</small>
              <b>帮谁？卡哪？先做哪步？</b>
              <span>它会给你下一步线索</span>
            </article>
          </main>
        </div>
      </div>
    );
  }

  if (page.page_no === 4) {
    return (
      <div className="ai-principle-visual ai-multimodal-scene">
        <figure className="ai-photo-stage ai-scan-photo">
          <img src={aiCoursewareImages.vet} alt="未来照相馆样片：兽医职业想象照" />
          <span className="ai-photo-tag tag-left">看见画面</span>
          <span className="ai-photo-tag tag-right">读懂要求</span>
          <figcaption>照片也会变成 AI 能读的线索</figcaption>
        </figure>
        <div className="ai-sense-stack">
          <div className="ai-visual-sentence">字是线索，图片也是线索</div>
          <article>
            <MessageSquareText size={24} />
            <strong>读文字</strong>
            <span>职业、要求、问题</span>
          </article>
          <article>
            <Image size={24} />
            <strong>看图片</strong>
            <span>人、动作、地方</span>
          </article>
          <article className="ai-dark-card">
            <Sparkles size={24} />
            <strong>合起来</strong>
            <span>理解更多线索</span>
          </article>
        </div>
      </div>
    );
  }

  if (page.page_no === 5) {
    return (
      <div className="ai-principle-visual ai-story-case">
        <figure className="ai-photo-stage ai-labeled-photo">
          <img src={aiCoursewareImages.space} alt="未来照相馆样片：火星建筑师职业想象照" />
          <span className="ai-photo-tag tag-left">你的照片</span>
          <span className="ai-photo-tag tag-right">AI 生成</span>
          <figcaption>现在可以解密：它按线索生成新画面</figcaption>
        </figure>
        <div className="ai-case-board">
          <div className="ai-visual-sentence">照片 + 职业 + 要求 = 未来想象照</div>
          <div className="ai-equation-strip">
            <span>我的照片</span>
            <b>+</b>
            <span>想当什么</span>
            <b>+</b>
            <span>请画成未来照</span>
            <b>=</b>
            <strong>新照片</strong>
          </div>
          <div className="ai-camera-core" aria-label="AI 收到三条线索">
            <Sparkles size={28} />
            <strong>AI 生成图片</strong>
            <span>按你给的线索生成</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-principle-visual ai-lab-experiment">
      <div className="ai-task-ticket">
        <header>
          <MessageSquareText size={24} />
          <strong>发给 DeepSeek</strong>
        </header>
        <div className="ai-visual-sentence">只填中间这一格</div>
        <p>请你当 <b>产品顾问</b></p>
        <p>我们想做 <b>________</b><span className="ai-cursor" aria-hidden="true">|</span></p>
        <p>请用三句话告诉我们：</p>
        <footer>
          <span>帮谁？</span>
          <span>卡在哪？</span>
          <span>先做哪步？</span>
        </footer>
      </div>
      <div className="ai-sort-board">
        <header>
          <Search size={24} />
          <strong>挑一句带回小组</strong>
        </header>
        <div className="ai-example-answer">“课间不知道玩什么的同学，可能需要活动推荐。”</div>
        <div className="ai-answer-actions">
          <article className="answer-keep">
            <strong>能继续讨论</strong>
            <span>留下</span>
          </article>
          <article className="answer-ask">
            <strong>拿不准</strong>
            <span>去问同学</span>
          </article>
          <article className="answer-drop">
            <strong>今天太大</strong>
            <span>放一边</span>
          </article>
        </div>
      </div>
    </div>
  );
}

function DesignedLessonSlide({ module, page }: { module: CourseModule; page: DesignedLessonPage }) {
  const design = moduleDesigns[module.id];
  const Icon = design?.icon ?? Lightbulb;
  const cards = cardsForPage(module, page);
  const steps = stepsForPage(page);
  const artifactKind = artifactKindForPage(module, page);
  const isAiPrincipleModule = module.id === "ai-judgement";
  const beat = lessonBeatForPage(module, page);
  const isKnowledgePage = isKnowledgeInputPage(module, page) || module.id === "future-photo-studio";
  const pblStep = pblStepForPage(page);
  const visibleCards = cards.slice(0, cardLimitForPage(page, cards));
  const gridClass = [
    page.visual === "showcase" ? "timeline-showcase" : "timeline-card-grid",
    visibleCards.length >= 5 ? "dense" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={`lesson-canvas timeline-slide accent-${page.accent || "mint"} visual-${page.visual || "cards"} module-${module.id}`}>
      <div className="timeline-copy">
        <small>{page.kicker || `${module.time_range || `D${module.day}`} · ${pageTypeLabel(page.page_type)}`}</small>
        <h2>{page.title}</h2>
        <p>{page.content_summary || module.subtitle}</p>
        <div className="timeline-chip-row">
          {(specialChipsForPage(page) || page.chips || []).slice(0, 6).map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
        <div className="lesson-beat-strip" aria-label="教学节奏">
          {isKnowledgePage ? (
            <>
              <span className={beat === "story" ? "active" : ""}>故事开场</span>
              <span className={beat === "demo" ? "active" : ""}>老师演示</span>
              <span className={beat === "experiment" ? "active" : ""}>轮到你实验</span>
              {beat === "showcase" && <span className="active">看结果</span>}
            </>
          ) : (
            <>
              <span className={pblStep === "discussion" ? "active" : ""}>团队讨论</span>
              <span className={pblStep === "output" ? "active" : ""}>小组产出</span>
              <span className={pblStep === "coaching" ? "active" : ""}>老师巡场</span>
              {pblStep === "showcase" && <span className="active">展示结果</span>}
            </>
          )}
        </div>
      </div>
      <div className={isAiPrincipleModule ? "timeline-visual ai-principle-visual-shell" : "timeline-visual"} aria-label={`${module.title}课件视觉区`}>
        <div className="timeline-visual-head">
          <span>
            <Icon size={24} />
            {pageTypeLabel(page.page_type)}
          </span>
          <strong>{String(page.page_no).padStart(2, "0")}</strong>
        </div>
        {isAiPrincipleModule ? (
          <AiPrincipleVisual page={page} />
        ) : artifactKind ? (
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
          <span>{isAiPrincipleModule ? aiPrincipleTakeaway(page) : module.title}</span>
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
  if (module.id === "ai-judgement" && page.slide_image) {
    return <AiSketchnoteSlide page={page} />;
  }

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

function AiSketchnoteSlide({ page }: { page: DesignedLessonPage }) {
  if (!page.slide_image) return null;
  return (
    <article className="lesson-canvas ai-sketchnote-slide">
      <img src={page.slide_image.src} alt={page.slide_image.alt} />
    </article>
  );
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
  const [revealedSamples, setRevealedSamples] = useState<Set<string>>(() => new Set());

  const toggleSampleAnswer = (code: string) => {
    setRevealedSamples((current) => {
      const next = new Set(current);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const sampleLightbox = sampleIndex === null ? null : (
    <SampleLightbox
      samples={futurePhotoSamples}
      index={sampleIndex}
      revealedSamples={revealedSamples}
      onChange={setSampleIndex}
      onClose={() => setSampleIndex(null)}
      onToggleAnswer={toggleSampleAnswer}
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
          <h2>猜猜他们长大后在做什么</h2>
          <p>先看衣服、工具、房间和动作，猜一猜职业。</p>
        </div>
        <div className="opening-pairs">
          {futurePhotoSamples.map((sample, index) => {
            const revealed = revealedSamples.has(sample.code);
            return (
              <article className={revealed ? "sample-card revealed" : "sample-card"} key={sample.code}>
                <button
                  type="button"
                  className="sample-flip"
                  onClick={() => toggleSampleAnswer(sample.code)}
                  aria-pressed={revealed}
                  aria-label={revealed ? `${sample.code}答案是${sample.career}，再点一次藏起答案` : `${sample.code}，先猜职业，点一下翻开答案`}
                >
                  <span className="sample-card-inner">
                    <span className="sample-face sample-front" aria-hidden={revealed}>
                      <img src={sample.image} alt={sample.alt} />
                      <span className="sample-code">{sample.code}</span>
                      <span className="sample-caption">
                        <strong>猜猜职业</strong>
                        <small>{sample.cue}</small>
                      </span>
                    </span>
                    <span className="sample-face sample-back" aria-hidden={!revealed}>
                      {revealed && (
                        <>
                          <img src={sample.image} alt="" />
                          <span className="sample-code">答案</span>
                          <span className="sample-caption">
                            <strong>{sample.career}</strong>
                            <small>{sample.cue}</small>
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="sample-zoom"
                  onClick={() => setSampleIndex(index)}
                  aria-label={`放大查看${sample.code}`}
                >
                  <Maximize2 size={16} /> 放大看
                </button>
              </article>
            );
          })}
        </div>
      </article>
    );
  }

  if (page.page_no === 3) {
    return renderWithSamples(
      <article className="lesson-canvas studio-slide studio-task">
        <div className="studio-copy">
          <span className="studio-kicker">柜台上还有一只空相框</span>
          <h2>下一张轮到你</h2>
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
          <h2>照片墙亮起来了</h2>
          <p>点开一张，看看同学正在做什么。</p>
        </div>
        <CoursePhotoWall students={students} variant="lesson" onOpenPhoto={onOpenPhoto} />
      </article>
    ) : (
      <article className="lesson-canvas studio-slide studio-secret">
        <div className="studio-copy compact">
          <span className="studio-kicker">照相馆的秘密</span>
          <h2>AI 看了照片，也读了文字</h2>
          <p>它看照片，也读你说的职业，再按任务画出新图。</p>
        </div>
        <div className="ai-secret-flow">
          <div>
            <Image size={36} />
            <strong>照片</strong>
            <small>人物线索</small>
          </div>
          <span>+</span>
          <div>
            <Mic size={36} />
            <strong>职业</strong>
            <small>你想做什么</small>
          </div>
          <span>+</span>
          <div>
            <MessageSquareText size={36} />
            <strong>提示词</strong>
            <small>画面要求</small>
          </div>
          <span>=</span>
          <div className="highlight">
            <Sparkles size={40} />
            <strong>新画面</strong>
            <small>未来想象照</small>
          </div>
        </div>
        <div className="ai-secret-words">
          <span><strong>多模态</strong>照片和文字都能成为线索</span>
          <span><strong>大模型</strong>按线索画出新画面</span>
          <span><strong>人来判断</strong>像不像、清不清楚、还想改哪里</span>
        </div>
      </article>
    )
  );
}

function SampleLightbox({
  samples,
  index,
  revealedSamples,
  onChange,
  onClose,
  onToggleAnswer
}: {
  samples: FuturePhotoSample[];
  index: number;
  revealedSamples: Set<string>;
  onChange: (nextIndex: number) => void;
  onClose: () => void;
  onToggleAnswer: (code: string) => void;
}) {
  const sample = samples[index];
  const revealed = revealedSamples.has(sample.code);
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
          <strong>{revealed ? sample.career : "先猜职业"}</strong>
          <small>{sample.cue}</small>
          <button type="button" className="sample-answer-toggle" onClick={() => onToggleAnswer(sample.code)}>
            {revealed ? "藏起答案" : "翻开答案"}
          </button>
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
  const teamCardTask = isTeamCardTask(camp);
  const problemVoteTask = isProblemVoteTask(camp);
  const problemTask = isProblemDiscoveryTask(camp);
  const userVoiceTask = isUserVoiceTask(camp);
  const aiValidationTask = isAiValidationTask(camp);
  const marketScoutTask = isMarketScoutTask(camp);
  const promptCardTask = isPromptCardTask(camp);
  const featureScopeTask = isFeatureScopeTask(camp);
  const techRouteTask = isTechRouteTask(camp);
  const iterationPlanTask = isIterationPlanTask(camp);
  const valueCardTask = isValueCardTask(camp);
  const productPackagingTask = isProductPackagingTask(camp);
  const storyPitchTask = isStoryPitchTask(camp);
  const productDefinitionTask = isProductDefinitionTask(camp);
  const blockerTask = isBlockerTask(camp);
  const observerScoreTask = isObserverScoreTask(camp);
  const learningReflectionTask = isLearningReflectionTask(camp);
  const contributionCardTask = isContributionCardTask(camp);
  const growthReflectionTask = isGrowthReflectionTask(camp);
  const finalShowcaseTask = isFinalShowcaseTask(camp);
  const productLinkTask = isProductLinkTask(camp);
  const peerFeedbackTask = isPeerFeedbackTask(camp);
  const textTask =
    teamCardTask ||
    problemVoteTask ||
    problemTask ||
    userVoiceTask ||
    aiValidationTask ||
    marketScoutTask ||
    promptCardTask ||
    featureScopeTask ||
    techRouteTask ||
    iterationPlanTask ||
    valueCardTask ||
    productPackagingTask ||
    storyPitchTask ||
    productDefinitionTask ||
    blockerTask ||
    observerScoreTask ||
    learningReflectionTask ||
    contributionCardTask ||
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
  const activeStudentView = studentWorkspaceTabFromUrl();
  const withStudentNav = (content: React.ReactNode) => (
    <>
      <StudentQuickNav active="task" />
      {content}
    </>
  );

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

  if (activeStudentView !== "task") {
    return (
      <StudentWorkspaceView
        camp={camp}
        active={activeStudentView}
        student={student}
        onLogout={logout}
      />
    );
  }

  if (teamCardTask) {
    return withStudentNav(
      <StudentTeamCardTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (problemTask) {
    return withStudentNav(
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
    return withStudentNav(
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
    return withStudentNav(
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
    return withStudentNav(
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
    return withStudentNav(
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
    return withStudentNav(
      <StudentPromptCardTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (featureScopeTask) {
    return withStudentNav(
      <StudentFeatureScopeTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (techRouteTask) {
    return withStudentNav(
      <StudentTechRouteTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (iterationPlanTask) {
    return withStudentNav(
      <StudentIterationPlanTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (valueCardTask) {
    return withStudentNav(
      <StudentValueCardTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (productPackagingTask) {
    return withStudentNav(
      <StudentProductPackagingTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (storyPitchTask) {
    return withStudentNav(
      <StudentStoryPitchTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (productDefinitionTask) {
    return withStudentNav(
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
    return withStudentNav(
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
    return withStudentNav(
      <StudentObserverScoreTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (learningReflectionTask) {
    return withStudentNav(
      <StudentLearningReflectionTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (contributionCardTask) {
    return withStudentNav(
      <StudentContributionCardTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  if (growthReflectionTask) {
    return withStudentNav(
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
    return withStudentNav(
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
    return withStudentNav(
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
    return withStudentNav(
      <StudentPeerFeedbackTask
        camp={camp}
        student={student}
        taskTitle={taskTitle}
        refresh={refresh}
        onLogout={logout}
      />
    );
  }

  return withStudentNav(
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

function StudentTeamCardTask({
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
  const [teamName, setTeamName] = useState(() => (isClassGroupPlaceholder(student.team_name) ? "" : student.team_name || ""));
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [productDirection, setProductDirection] = useState("");
  const [launchLine, setLaunchLine] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };
  const { listeningKey, startVoiceInput } = useStudentVoiceInput(showMessage);

  useEffect(() => {
    let alive = true;
    api.studentWorkspace()
      .then((workspace) => {
        if (!alive) return;
        const latestTeamCard = latestTeamSubmission(workspace, "team_card");
        const members = workspace.team_members.map((member) => member.nickname).filter(Boolean);
        const savedTeamName = asText(latestTeamCard?.payload.team_name).trim();
        const assignedTeamName = workspace.team?.name || student.team_name || "";
        const reusableAssignedTeamName = isClassGroupPlaceholder(assignedTeamName) ? "" : assignedTeamName;
        setTeamMembers(members);
        setTeamName((current) =>
          current.trim() ||
          savedTeamName ||
          reusableAssignedTeamName
        );
        setProductDirection((current) =>
          current.trim() ||
          asText(latestTeamCard?.payload.product_direction).trim() ||
          asText(latestTeamCard?.payload.direction).trim()
        );
        setLaunchLine((current) => current.trim() || asText(latestTeamCard?.payload.launch_line).trim());
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [student.team_name]);

  const submit = async () => {
    if (!teamName.trim()) {
      showMessage("error", "先给团队起一个能被记住的名字。");
      return;
    }
    if (!productDirection.trim()) {
      showMessage("error", "写一个你们想继续做的方向。");
      return;
    }
    if (!launchLine.trim()) {
      showMessage("error", "写一句团队亮相。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "team_card",
        title: taskTitle,
        payload: {
          team_name: teamName.trim(),
          team_members: teamMembers.join("、") || student.nickname,
          product_direction: productDirection.trim(),
          launch_line: launchLine.trim(),
          team_id: student.team_id || "",
          class_team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。团队名片已经放进今天的项目起点。");
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
        <h1>{taskTitle || "团队名片"}</h1>
        <p>老师已经分好成员。你们来决定团队名称和第一个产品方向。</p>
        <div className="student-card d1-task-card team-card-form">
          <div className="student-current">
            <div>
              <span>{teamName ? "团队名" : "分组"}</span>
              <strong>{teamName || student.team_name || "还在分组"}</strong>
              <small>{teamMembers.length ? teamMembers.join("、") : student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            <span className="field-helper-row">
              <span>团队名</span>
              <FieldVoiceButton
                fieldKey="team-name"
                label="说团队名"
                listeningKey={listeningKey}
                onStart={() => startVoiceInput("team-name", setTeamName)}
              />
            </span>
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="例如：闪电产品队"
              inputMode="text"
            />
          </label>
          {teamMembers.length > 0 && (
            <div className="team-member-chips" aria-label="团队成员">
              {teamMembers.map((member) => (
                <span key={member}>{member}</span>
              ))}
            </div>
          )}
          <label>
            <span className="field-helper-row">
              <span>产品方向</span>
              <FieldVoiceButton
                fieldKey="product-direction"
                label="说方向"
                listeningKey={listeningKey}
                onStart={() => startVoiceInput("product-direction", setProductDirection)}
              />
            </span>
            <textarea
              value={productDirection}
              onChange={(event) => setProductDirection(event.target.value)}
              placeholder="例如：让同学更快找到适合自己的课间活动"
              rows={3}
            />
          </label>
          <label>
            <span className="field-helper-row">
              <span>一句话亮相</span>
              <FieldVoiceButton
                fieldKey="launch-line"
                label="说一句"
                listeningKey={listeningKey}
                onStart={() => startVoiceInput("launch-line", setLaunchLine)}
              />
            </span>
            <textarea
              value={launchLine}
              onChange={(event) => setLaunchLine(event.target.value)}
              placeholder="例如：我们想把一个真实小麻烦，变成大家能试玩的作品。"
              rows={3}
            />
          </label>
          <div className="team-card-preview" aria-label="团队名片预览">
            <span>团队名片</span>
            <strong>{teamName.trim() || "还没起名"}</strong>
            <div>
              <p><b>成员</b>{teamMembers.join("、") || student.nickname}</p>
              <p><b>方向</b>{productDirection.trim() || "写一个想继续做的方向"}</p>
            </div>
            <small>{launchLine.trim() || "写一句团队亮相"}</small>
          </div>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <UsersRound size={18} />}
            提交
          </button>
          <p className="hint">成员名单不用改，团队名和产品方向由你们讨论后填写。</p>
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

function StudentFeatureScopeTask({
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
  const [featureIdeas, setFeatureIdeas] = useState("");
  const [coreAction, setCoreAction] = useState("");
  const [firstVersion, setFirstVersion] = useState("");
  const [notNow, setNotNow] = useState("");
  const [successSignal, setSuccessSignal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const ideas = useMemo(() => asTextList(featureIdeas), [featureIdeas]);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!productName.trim()) {
      showMessage("error", "先写下你们的产品名。");
      return;
    }
    if (ideas.length < 5) {
      showMessage("error", "先列出至少 5 个可能的功能。");
      return;
    }
    if (ideas.length > 8) {
      showMessage("hint", "功能已经很多了，先留下 5 到 8 个最重要的。");
      return;
    }
    if (!coreAction.trim()) {
      showMessage("error", "从清单里圈出今天最先跑通的一步。");
      return;
    }
    if (!firstVersion.trim()) {
      showMessage("error", "写清楚第一版要做成什么样子。");
      return;
    }
    if (!successSignal.trim()) {
      showMessage("error", "写下别人用完后能看到什么结果。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "feature_scope",
        title: taskTitle,
        payload: {
          product_name: productName.trim(),
          feature_ideas: ideas,
          feature_summary: ideas.join(" / "),
          core_action: coreAction.trim(),
          first_version: firstVersion.trim(),
          not_now: notNow.trim(),
          success_signal: successSignal.trim(),
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。现在小组有了可以先做出来的一步。");
      setProductName("");
      setFeatureIdeas("");
      setCoreAction("");
      setFirstVersion("");
      setNotNow("");
      setSuccessSignal("");
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
        <h1>{taskTitle || "核心动作卡"}</h1>
        <p>先把功能想法放出来，再留下今天最值得跑通的一步。</p>
        <div className="student-card d1-task-card feature-scope-form">
          <div className="student-current">
            <div>
              <span>原型小组</span>
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
            可能的功能
            <textarea
              value={featureIdeas}
              onChange={(event) => setFeatureIdeas(event.target.value)}
              placeholder={"例如：\n按口味推荐\n显示排队时间\n避开不爱吃的菜\n给两个备选\n保存今天选择"}
              rows={6}
            />
          </label>
          <div className={ideas.length > 8 ? "feature-count too-many" : ideas.length >= 5 ? "feature-count ready" : "feature-count"}>
            <span>{ideas.length}/8 个功能</span>
            <strong>{ideas.length > 8 ? "先砍掉一些" : ideas.length >= 5 ? "可以开始收束" : "继续多想几个"}</strong>
          </div>
          <label>
            今天先跑通的核心动作
            <textarea
              value={coreAction}
              onChange={(event) => setCoreAction(event.target.value)}
              placeholder="例如：同学回答 2 个问题后，马上得到 2 个午餐选择"
              rows={3}
            />
          </label>
          <label>
            第一版做成什么样
            <textarea
              value={firstVersion}
              onChange={(event) => setFirstVersion(event.target.value)}
              placeholder="例如：一个浏览器页面，有两个选择按钮和一个推荐结果"
              rows={3}
            />
          </label>
          <label>
            这一版先不做
            <textarea
              value={notNow}
              onChange={(event) => setNotNow(event.target.value)}
              placeholder="例如：先不做登录、历史记录和复杂动画"
              rows={2}
            />
          </label>
          <label>
            别人用完后能看到
            <textarea
              value={successSignal}
              onChange={(event) => setSuccessSignal(event.target.value)}
              placeholder="例如：他能在 10 秒内选出今天吃什么"
              rows={2}
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Hammer size={18} />}
            提交
          </button>
          <p className="hint">好的原型不是功能最多，而是先让一个真实动作跑起来。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentTechRouteTask({
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
  const [routeChoice, setRouteChoice] = useState<(typeof techRouteOptions)[number]["value"]>("standard");
  const [toolPlan, setToolPlan] = useState("");
  const [userFlow, setUserFlow] = useState("");
  const [firstScreen, setFirstScreen] = useState("");
  const [resultScreen, setResultScreen] = useState("");
  const [fallbackPlan, setFallbackPlan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const flowSteps = useMemo(() => asTextList(userFlow), [userFlow]);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!productName.trim()) {
      showMessage("error", "先写下你们的产品名。");
      return;
    }
    if (!toolPlan.trim()) {
      showMessage("error", "写下准备用什么工具或页面做出来。");
      return;
    }
    if (flowSteps.length < 3) {
      showMessage("error", "把用户流程写成 3 到 5 步。");
      return;
    }
    if (flowSteps.length > 5) {
      showMessage("hint", "流程有点长，先收成 3 到 5 步。");
      return;
    }
    if (!firstScreen.trim()) {
      showMessage("error", "写下用户打开后第一眼看到什么。");
      return;
    }
    if (!resultScreen.trim()) {
      showMessage("error", "写下用户用完后看到什么结果。");
      return;
    }
    if (!fallbackPlan.trim()) {
      showMessage("error", "写下工具卡住时，照样能展示的办法。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "tech_route",
        title: taskTitle,
        payload: {
          product_name: productName.trim(),
          route_choice: routeChoice,
          route_label: techRouteLabel(routeChoice),
          tool_plan: toolPlan.trim(),
          user_flow_steps: flowSteps,
          user_flow_summary: flowSteps.join(" → "),
          first_screen: firstScreen.trim(),
          result_screen: resultScreen.trim(),
          fallback_plan: fallbackPlan.trim(),
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。现在别人可以顺着这条流程看懂你们的作品。");
      setProductName("");
      setRouteChoice("standard");
      setToolPlan("");
      setUserFlow("");
      setFirstScreen("");
      setResultScreen("");
      setFallbackPlan("");
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
        <h1>{taskTitle || "路线与流程卡"}</h1>
        <p>选今天能完成的路线，再把用户使用流程写成 3 到 5 步。</p>
        <div className="student-card d1-task-card tech-route-form">
          <div className="student-current">
            <div>
              <span>路线小组</span>
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
          <div className="route-choice-grid">
            {techRouteOptions.map((option) => (
              <button
                className={routeChoice === option.value ? "active" : ""}
                key={option.value}
                onClick={() => setRouteChoice(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </button>
            ))}
          </div>
          <label>
            准备用什么做出来
            <textarea
              value={toolPlan}
              onChange={(event) => setToolPlan(event.target.value)}
              placeholder="例如：用浏览器页面做选择按钮，再让 AI 帮我们写推荐文案"
              rows={3}
            />
          </label>
          <label>
            用户使用流程
            <textarea
              value={userFlow}
              onChange={(event) => setUserFlow(event.target.value)}
              placeholder={"例如：\n打开页面\n选择口味\n选择排队时间\n看到两个推荐\n点一个今天要吃的"}
              rows={5}
            />
          </label>
          <div className={flowSteps.length > 5 ? "feature-count too-many" : flowSteps.length >= 3 ? "feature-count ready" : "feature-count"}>
            <span>{flowSteps.length}/5 步流程</span>
            <strong>{flowSteps.length > 5 ? "先收短一点" : flowSteps.length >= 3 ? "流程能看懂" : "继续补步骤"}</strong>
          </div>
          <label>
            用户打开后第一眼看到
            <textarea
              value={firstScreen}
              onChange={(event) => setFirstScreen(event.target.value)}
              placeholder="例如：两个问题和一个开始按钮"
              rows={2}
            />
          </label>
          <label>
            用户用完后看到
            <textarea
              value={resultScreen}
              onChange={(event) => setResultScreen(event.target.value)}
              placeholder="例如：两个午餐推荐和一句为什么适合他"
              rows={2}
            />
          </label>
          <label>
            如果工具卡住，照样能展示
            <textarea
              value={fallbackPlan}
              onChange={(event) => setFallbackPlan(event.target.value)}
              placeholder="例如：用 3 张截图演示打开、选择、看到结果"
              rows={2}
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Route size={18} />}
            提交
          </button>
          <p className="hint">好的流程会让别人 30 秒内看懂：打开、做什么、看到什么。</p>
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
  const [track, setTrack] = useState("");
  const [direction, setDirection] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [useScene, setUseScene] = useState("");
  const [coreProblem, setCoreProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [interviewEvidence, setInterviewEvidence] = useState("");
  const [demandQuestions, setDemandQuestions] = useState("");
  const [day2Materials, setDay2Materials] = useState("");
  const [problemOptions, setProblemOptions] = useState<WallArtifact[]>([]);
  const [problemVotes, setProblemVotes] = useState<Record<string, number>>({});
  const [teamProblemId, setTeamProblemId] = useState("");
  const [selectedProblemId, setSelectedProblemId] = useState("");
  const [selectedProblemTitle, setSelectedProblemTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const activeTaskTitle = taskTitle || camp?.active_task?.title || "";
  const isDirectionPlan =
    /需求收集|方向和行动计划|补齐行动计划|团队讨论|明天先做|团队方向|选择创业方向/.test(activeTaskTitle) ||
    camp?.active_task?.module_id === "project-launch" ||
    camp?.active_task?.module_id === "day1-reflection";
  const directionOptions = useMemo(() => productDirectionOptions(track), [track]);
  const oneLiner = useMemo(() => {
    if (!targetUser.trim() || !coreProblem.trim() || !solution.trim()) return "";
    if (isDirectionPlan) {
      const sceneText = useScene.trim() ? `，在${useScene.trim()}的时候` : "";
      return `我们想帮${targetUser.trim()}${sceneText}解决${coreProblem.trim()}，明天先做${solution.trim()}。`;
    }
    if (!useScene.trim()) return "";
    return `我们想帮${targetUser.trim()}，在${useScene.trim()}的时候解决${coreProblem.trim()}，先做一个可以${solution.trim()}的产品。`;
  }, [targetUser, useScene, coreProblem, solution, isDirectionPlan]);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };
  const { listeningKey, startVoiceInput } = useStudentVoiceInput(showMessage);

  useEffect(() => {
    let alive = true;
    api.problemVoteBrief()
      .then((result) => {
        if (!alive) return;
        const voteMap = new Map(result.summaries.map((summary) => [summary.problem_id, summary.vote_count]));
        const byId = new Map(result.candidates.map((item) => [item.id, item]));
        const teamProblem = result.team_problem ? [result.team_problem] : [];
        const sameTeam = result.candidates.filter((item) =>
          (!!student.team_id && item.team_id === student.team_id) ||
          (!!student.team_name && (item.team_name === student.team_name || asText(item.payload.team_name) === student.team_name))
        );
        const voted = result.summaries
          .filter((summary) => summary.vote_count > 0)
          .map((summary) => byId.get(summary.problem_id))
          .filter(Boolean) as WallArtifact[];
        const fallback = result.candidates.slice(0, 5);
        const merged = [...teamProblem, ...sameTeam, ...voted, ...fallback].filter((item, index, list) =>
          list.findIndex((candidate) => candidate.id === item.id) === index
        );
        setProblemOptions(merged.slice(0, 5));
        setProblemVotes(Object.fromEntries(voteMap.entries()));
        setTeamProblemId(result.team_problem?.id || "");
      })
      .catch(() => {
        if (alive) setProblemOptions([]);
      });
    return () => {
      alive = false;
    };
  }, [student.team_id, student.team_name]);

  useEffect(() => {
    let alive = true;
    api.studentWorkspace()
      .then((workspace) => {
        if (!alive) return;
        const latestTeamCard = latestTeamSubmission(workspace, "team_card");
        const latestDefinition = latestTeamSubmission(workspace, "product_definition");
        const teamDirection =
          asText(latestDefinition?.payload.direction).trim() ||
          asText(latestTeamCard?.payload.product_direction).trim() ||
          asText(latestTeamCard?.payload.direction).trim();
        if (teamDirection) setDirection((current) => current.trim() || teamDirection);
        setProductName((current) => current.trim() || asText(latestDefinition?.payload.product_name).trim());
        setTrack((current) => current.trim() || asText(latestDefinition?.payload.track).trim());
        setTargetUser((current) => current.trim() || asText(latestDefinition?.payload.target_user).trim());
        setUseScene((current) => current.trim() || asText(latestDefinition?.payload.use_scene).trim());
        setCoreProblem((current) => current.trim() || asText(latestDefinition?.payload.core_problem).trim());
        setSolution((current) =>
          current.trim() ||
          asText(latestDefinition?.payload.day2_first_step).trim() ||
          asText(latestDefinition?.payload.core_action).trim() ||
          asText(latestDefinition?.payload.solution).trim()
        );
        setInterviewEvidence((current) => current.trim() || asText(latestDefinition?.payload.interview_evidence).trim());
        setDemandQuestions((current) => current.trim() || asText(latestDefinition?.payload.demand_questions).trim());
        setDay2Materials((current) => current.trim() || asText(latestDefinition?.payload.day2_materials).trim());
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [student.team_id]);

  const useProblemOption = (item: WallArtifact) => {
    const problemTitle = asText(item.payload.problem_scene) || asText(item.payload.trouble) || "一个真实问题";
    const problemUser = asText(item.payload.target_user);
    const problemTrouble = asText(item.payload.trouble) || problemTitle;
    const problemScene = asText(item.payload.problem_scene);
    const problemEvidence = asText(item.payload.evidence) || asText(item.payload.user_quote) || asText(item.payload.answer);
    if (problemUser) setTargetUser(problemUser);
    if (problemTrouble) setCoreProblem(problemTrouble);
    if (problemScene) setUseScene(problemScene);
    if (problemEvidence) setInterviewEvidence(problemEvidence);
    setSelectedProblemId(item.id);
    setSelectedProblemTitle(problemTitle);
  };

  const submit = async () => {
    if (!isDirectionPlan && !productName.trim()) {
      showMessage("error", "先给产品起一个名字。");
      return;
    }
    if (!track.trim()) {
      showMessage("error", "先选一条主赛道。");
      return;
    }
    if (!direction.trim()) {
      showMessage("error", "写一个具体方向。");
      return;
    }
    if (!targetUser.trim()) {
      showMessage("error", "写清楚这个产品帮谁。");
      return;
    }
    if (!isDirectionPlan && !useScene.trim()) {
      showMessage("error", "写清楚这个人在哪个场景里会用。");
      return;
    }
    if (!coreProblem.trim()) {
      showMessage("error", "写清楚它解决什么问题。");
      return;
    }
    if (!solution.trim()) {
      showMessage("error", "写清楚明天先做的核心动作。");
      return;
    }
    if (isDirectionPlan && !demandQuestions.trim()) {
      showMessage("error", "写下接下来要问谁、问什么。");
      return;
    }
    const finalProductName = productName.trim() || `${direction.trim()}方向`;
    const finalOneLiner =
      oneLiner ||
      `我们想帮${targetUser.trim()}解决${coreProblem.trim()}，明天先做${solution.trim()}。`;
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "product_definition",
        title: taskTitle,
        payload: {
          definition_stage: isDirectionPlan ? "day1_direction_plan" : "product_definition",
          product_name: finalProductName,
          track: track.trim(),
          track_label: productTrackLabel(track),
          direction: direction.trim(),
          target_user: targetUser.trim(),
          use_scene: useScene.trim(),
          core_problem: coreProblem.trim(),
          core_action: solution.trim(),
          solution: solution.trim(),
          demand_target: targetUser.trim(),
          demand_questions: demandQuestions.trim(),
          day2_materials: day2Materials.trim(),
          day2_first_step: solution.trim(),
          action_plan: [
            demandQuestions.trim() ? `需求：${demandQuestions.trim()}` : "",
            day2Materials.trim() ? `材料：${day2Materials.trim()}` : "",
            solution.trim() ? `先做：${solution.trim()}` : ""
          ].filter(Boolean).join("；"),
          interview_evidence: interviewEvidence.trim(),
          one_liner: finalOneLiner,
          source_problem_id: selectedProblemId,
          source_problem_title: selectedProblemTitle,
          source_problem_votes: selectedProblemId ? problemVotes[selectedProblemId] ?? 0 : 0,
          team_name: student.team_name || ""
        }
      });
      showMessage("success", isDirectionPlan ? "收到啦。你们的方向和行动计划可以放到方向墙。" : "收到啦。这句话可以变成你们的第一张产品卡。");
      if (!isDirectionPlan) {
        setProductName("");
        setTrack("");
        setDirection("");
        setTargetUser("");
        setUseScene("");
        setCoreProblem("");
        setSolution("");
        setInterviewEvidence("");
        setDemandQuestions("");
        setDay2Materials("");
        setSelectedProblemId("");
        setSelectedProblemTitle("");
      }
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
        <h1>{taskTitle || (isDirectionPlan ? "方向和行动计划卡" : "写出产品一句话")}</h1>
        <p>{isDirectionPlan ? "先确定团队方向，再写清接下来要问谁、问什么、明天先做哪一步。" : "把小组想做的产品，说成别人一眼能懂的一句话。"}</p>
        <div className="student-card d1-task-card">
          <div className="student-current">
            <div>
              <span>产品小组</span>
              <strong>{student.team_name || student.nickname}</strong>
              <small>{student.student_no ? `${student.nickname} · 学号 ${student.student_no}` : student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          {!isDirectionPlan && problemOptions.length > 0 && (
            <div className="product-source-panel">
              <span>可以从前面的问题线索带入</span>
              <div className="product-source-options">
                {problemOptions.map((item) => {
                  const title = asText(item.payload.problem_scene) || asText(item.payload.trouble) || "一个真实问题";
                  const votes = problemVotes[item.id] ?? 0;
                  const sameTeam =
                    (!!student.team_id && item.team_id === student.team_id) ||
                    (!!student.team_name && (item.team_name === student.team_name || asText(item.payload.team_name) === student.team_name));
                  return (
                    <button
                      className={selectedProblemId === item.id ? "product-source-option active" : "product-source-option"}
                      key={item.id}
                      onClick={() => useProblemOption(item)}
                    >
                      <small>{item.id === teamProblemId ? "本组线索" : sameTeam ? "我们的问题卡" : votes > 0 ? `${votes} 票线索` : "问题线索"}</small>
                      <strong>{title}</strong>
                      <em>{asText(item.payload.target_user) || "真实用户"}</em>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="product-source-panel">
            <span>主赛道</span>
            <div className="route-choice-grid product-track-grid">
              {productTrackOptions.map((option) => (
                <button
                  className={track === option.value ? "active" : ""}
                  key={option.value}
                  onClick={() => {
                    setTrack(option.value);
                    if (!option.directions.some((item) => item === direction)) setDirection("");
                  }}
                  type="button"
                >
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <label>
            <span className="field-helper-row">
              <span>{isDirectionPlan ? "团队方向" : "具体方向"}</span>
              <FieldVoiceButton
                fieldKey="definition-direction"
                label="说方向"
                listeningKey={listeningKey}
                onStart={() => startVoiceInput("definition-direction", setDirection)}
              />
            </span>
            <input
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
              placeholder={track ? "从方向里选，也可以自己写" : "先选主赛道，再写方向"}
              inputMode="text"
              list="product-direction-options"
            />
            <datalist id="product-direction-options">
              {directionOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
          {!isDirectionPlan && (
            <label>
              产品名
              <input
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                placeholder="例如：午餐选择器"
                inputMode="text"
              />
            </label>
          )}
          <label>
            <span className="field-helper-row">
              <span>想帮谁</span>
              <FieldVoiceButton
                fieldKey="target-user"
                label="说用户"
                listeningKey={listeningKey}
                onStart={() => startVoiceInput("target-user", setTargetUser)}
              />
            </span>
            <input
              value={targetUser}
              onChange={(event) => setTargetUser(event.target.value)}
              placeholder="例如：每天在食堂纠结的同学"
              inputMode="text"
            />
          </label>
          <label>
            <span className="field-helper-row">
              <span>{isDirectionPlan ? "发生场景（可选）" : "发生场景"}</span>
              <FieldVoiceButton
                fieldKey="use-scene"
                label="说场景"
                listeningKey={listeningKey}
                onStart={() => startVoiceInput("use-scene", setUseScene)}
              />
            </span>
            <input
              value={useScene}
              onChange={(event) => setUseScene(event.target.value)}
              placeholder="例如：午饭前站在菜单前"
              inputMode="text"
            />
          </label>
          <label>
            <span className="field-helper-row">
              <span>现在卡在哪</span>
              <FieldVoiceButton
                fieldKey="core-problem"
                label="说麻烦"
                listeningKey={listeningKey}
                onStart={() => startVoiceInput("core-problem", setCoreProblem)}
              />
            </span>
            <textarea
              value={coreProblem}
              onChange={(event) => setCoreProblem(event.target.value)}
              placeholder="例如：选择太多，不知道今天吃什么"
              rows={3}
            />
          </label>
          {isDirectionPlan ? (
            <>
              <label>
                <span className="field-helper-row">
                  <span>接下来要问/收集什么</span>
                  <FieldVoiceButton
                    fieldKey="demand-questions"
                    label="说计划"
                    listeningKey={listeningKey}
                    onStart={() => startVoiceInput("demand-questions", setDemandQuestions)}
                  />
                </span>
                <textarea
                  value={demandQuestions}
                  onChange={(event) => setDemandQuestions(event.target.value)}
                  placeholder="例如：问 5 个同学午饭前怎么选、最纠结什么、愿不愿意试用"
                  rows={3}
                />
              </label>
              <label>
                <span className="field-helper-row">
                  <span>明天带回什么（可选）</span>
                  <FieldVoiceButton
                    fieldKey="day2-materials"
                    label="说材料"
                    listeningKey={listeningKey}
                    onStart={() => startVoiceInput("day2-materials", setDay2Materials)}
                  />
                </span>
                <textarea
                  value={day2Materials}
                  onChange={(event) => setDay2Materials(event.target.value)}
                  placeholder="例如：3 句话、2 张截图、1 个真实例子"
                  rows={2}
                />
              </label>
            </>
          ) : (
            <label>
              采访证据
              <textarea
                value={interviewEvidence}
                onChange={(event) => setInterviewEvidence(event.target.value)}
                placeholder="例如：有同学说，每次排队前都想先知道哪一队更快"
                rows={2}
              />
            </label>
          )}
          <label>
            <span className="field-helper-row">
              <span>{isDirectionPlan ? "明天先做哪一步" : "明天先做的核心动作"}</span>
              <FieldVoiceButton
                fieldKey="solution"
                label="说一步"
                listeningKey={listeningKey}
                onStart={() => startVoiceInput("solution", setSolution)}
              />
            </span>
            <textarea
              value={solution}
              onChange={(event) => setSolution(event.target.value)}
              placeholder="例如：根据心情、排队时间和忌口推荐一个选择"
              rows={3}
            />
          </label>
          <div className="product-sentence-preview">
            <span>{isDirectionPlan ? "方向和行动计划" : "产品一句话"}</span>
            <strong>{oneLiner || (isDirectionPlan ? "填完用户、麻烦和明天先做哪一步，这里会出现行动计划。" : "填完用户、场景、麻烦和核心动作，这里会出现一句完整介绍。")}</strong>
            {[productTrackLabel(track), direction].filter(Boolean).length > 0 && (
              <small>{[productTrackLabel(track), direction].filter(Boolean).join(" · ")}</small>
            )}
            {isDirectionPlan && demandQuestions.trim() && <small>接下来要问：{demandQuestions.trim()}</small>}
            {isDirectionPlan && day2Materials.trim() && <small>明天带回：{day2Materials.trim()}</small>}
            {selectedProblemTitle && <small>来自线索：{selectedProblemTitle}</small>}
          </div>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Target size={18} />}
            提交
          </button>
          <p className="hint">{isDirectionPlan ? "能说短句就不用写长段。先把方向说清楚，明天就能开工。" : "先写一个真正会用的人，再让一个动作先跑起来。"}</p>
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

function StudentLearningReflectionTask({
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
  const title = taskTitle || "带走一个 AI 判断方法";
  const isAiFix = /AI 跑偏|改回来|修正/.test(title) || camp?.active_task?.module_id === "demo-check";
  const isAiDialog = camp?.active_task?.module_id === "ai-judgement" || /DeepSeek|任务单|问真人|问同学|回答怎么用/.test(title);
  const [moment, setMoment] = useState("");
  const [method, setMethod] = useState("");
  const [nextUse, setNextUse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!method.trim()) {
      showMessage("error", isAiDialog ? "写下 AI 回答里能帮小组继续讨论的一句。" : isAiFix ? "写下一个让 AI 改回来的方法。" : "写下一条今天最有用的判断方法。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "learning_reflection",
        title,
        payload: {
          reflection_kind: isAiDialog ? "day1_ai_dialog" : isAiFix ? "day2_ai_fix" : "day1_ai_rule",
          moment: moment.trim(),
          method: method.trim(),
          next_use: nextUse.trim(),
          team_id: student.team_id || "",
          team_name: student.team_name || ""
        }
      });
      showMessage("success", isAiDialog ? "收到啦。这条线索可以带进团队讨论。" : "收到啦。这个方法会留在你的项目路上。");
      setMoment("");
      setMethod("");
      setNextUse("");
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
        <h1>{title}</h1>
        <p>{isAiDialog ? "把 DeepSeek 帮你想到的线索，变成下一步能讨论的材料。" : isAiFix ? "回想今天制作时，AI 哪次没听懂？你怎样让它改回来？" : "把今天最有用的一条 AI 判断方法带走。"}</p>
        <div className="student-card growth-reflection-form">
          <div className="student-current">
            <div>
              <span>{isAiDialog ? "AI 对话实验" : isAiFix ? "修正方法" : "判断方法"}</span>
              <strong>{student.nickname}</strong>
              <small>{student.team_name || student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            {isAiDialog ? "我们问 AI 的任务单（可选）" : isAiFix ? "AI 跑偏的一刻（可选）" : "今天记住的一刻（可选）"}
            <input
              value={moment}
              onChange={(event) => setMoment(event.target.value)}
              placeholder={isAiDialog ? "例如：请你当产品顾问，帮我们看课间活动产品可能帮谁" : isAiFix ? "例如：AI 做了很多功能，却没突出核心按钮" : "例如：我发现 AI 的答案听起来很像真的"}
              inputMode="text"
            />
          </label>
          <label>
            {isAiDialog ? "AI 回答里能帮小组的一句" : isAiFix ? "我让它改回来的方法" : "我会继续使用的判断方法"}
            <textarea
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              placeholder={isAiDialog ? "例如：课间活动最需要帮的是不知道和谁一起玩的同学" : isAiFix ? "例如：先指出哪里不符合用户，再给一个更清楚的例子" : "例如：先找证据，再相信答案"}
              rows={3}
            />
          </label>
          <label>
            {isAiDialog ? "还不确定，要问同学或用户的一句（可选）" : isAiFix ? "下一次我会怎么说得更清楚（可选）" : "明天我想把它用在哪里（可选）"}
            <textarea
              value={nextUse}
              onChange={(event) => setNextUse(event.target.value)}
              placeholder={isAiDialog ? "例如：你课间最想有人帮你安排哪一件事？" : isAiFix ? "例如：先告诉 AI 只做一个核心动作" : "例如：采访后让 AI 帮我整理，但我要检查证据"}
              rows={2}
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Brain size={18} />}
            提交
          </button>
          <p className="hint">{isAiDialog ? "AI 可以先给线索，真正的方向还要回到真实用户。" : "好的方法要能下一次继续用。"}</p>
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

function StudentContributionCardTask({
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
  const [abilityTag, setAbilityTag] = useState(contributionAbilityTags[0]);
  const [contribution, setContribution] = useState("");
  const [evidence, setEvidence] = useState("");
  const [nextPractice, setNextPractice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!contribution.trim()) {
      showMessage("error", "先写下一项真实贡献。");
      return;
    }
    if (!evidence.trim()) {
      showMessage("error", "再写一个大家能看见的证据。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "contribution_card",
        title: taskTitle,
        payload: {
          name: student.nickname,
          ability_tag: abilityTag,
          contribution: contribution.trim(),
          evidence: evidence.trim(),
          next_practice: nextPractice.trim(),
          team_id: student.team_id || "",
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。你的贡献卡可以放进结营证书。");
      setContribution("");
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
        <h1>{taskTitle || "给贡献一个名字"}</h1>
        <p>写下一项真实贡献，让你的证书有清楚的证据。</p>
        <div className="student-card contribution-card-form">
          <div className="student-current">
            <div>
              <span>贡献卡</span>
              <strong>{student.nickname}</strong>
              <small>{student.team_name || student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <div className="ability-picker" role="group" aria-label="选择能力标签">
            {contributionAbilityTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={abilityTag === tag ? "active" : ""}
                onClick={() => setAbilityTag(tag)}
              >
                <strong>{tag}</strong>
                <span>{tag === "团队贡献" ? "把事情接住" : growthAbilityHints[tag as keyof typeof growthAbilityHints] || "让作品更进一步"}</span>
              </button>
            ))}
          </div>
          <label>
            我做的一项贡献
            <textarea
              value={contribution}
              onChange={(event) => setContribution(event.target.value)}
              placeholder="例如：我把采访里的三个卡点整理成了产品的一句话"
              rows={3}
            />
          </label>
          <label>
            大家能看见的证据
            <input
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              placeholder="例如：我们最后的故事发布里用了这三条卡点"
              inputMode="text"
            />
          </label>
          <label>
            下一次我想继续练（可选）
            <textarea
              value={nextPractice}
              onChange={(event) => setNextPractice(event.target.value)}
              placeholder="例如：更早把用户的话记清楚"
              rows={2}
            />
          </label>
          <div className="contribution-preview" aria-label="贡献卡预览">
            <span>{abilityTag}</span>
            <strong>{student.nickname}</strong>
            <p>{contribution.trim() || "写下一项真实贡献"}</p>
            <small>{evidence.trim() || "再写一个大家能看见的证据"}</small>
          </div>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Star size={18} />}
            提交
          </button>
          <p className="hint">好的贡献卡不是夸大，而是把真实做过的一步说清楚。</p>
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
  const [targetUser, setTargetUser] = useState("");
  const [coreProblem, setCoreProblem] = useState("");
  const [accessUrl, setAccessUrl] = useState("");
  const [pitchDeckUrl, setPitchDeckUrl] = useState("");
  const [valueLine, setValueLine] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  useEffect(() => {
    let alive = true;
    api.studentWorkspace()
      .then((workspace) => {
        if (!alive) return;
        const latestFinal = latestTeamSubmission(workspace, "final_showcase");
        const latestProduct = latestTeamSubmission(workspace, "product_definition");
        const latestLink = latestTeamSubmission(workspace, "product_link");
        const latestPackaging = latestTeamSubmission(workspace, "product_packaging");
        const latestStory = latestTeamSubmission(workspace, "story_pitch");
        const latestProblem = latestTeamSubmission(workspace, "problem_card");
        const memberNames = workspace.team_members.map((member) => member.nickname).filter(Boolean);
        const memberText = memberNames.join("、") || asText(latestFinal?.payload.team_members).trim();

        setTeamMembers((current) => current.trim() || memberText);
        setProductName((current) =>
          current.trim() ||
          asText(latestFinal?.payload.product_name).trim() ||
          asText(latestProduct?.payload.product_name).trim() ||
          asText(latestLink?.payload.product_name).trim() ||
          asText(latestPackaging?.payload.product_name).trim()
        );
        setTargetUser((current) =>
          current.trim() ||
          asText(latestFinal?.payload.target_user).trim() ||
          asText(latestProduct?.payload.target_user).trim() ||
          asText(latestPackaging?.payload.target_user).trim()
        );
        setCoreProblem((current) =>
          current.trim() ||
          asText(latestFinal?.payload.core_problem).trim() ||
          asText(latestProduct?.payload.core_problem).trim() ||
          asText(latestProblem?.payload.problem_scene).trim() ||
          asText(latestStory?.payload.user_scene).trim()
        );
        setAccessUrl((current) =>
          current.trim() ||
          asText(latestFinal?.payload.access_url).trim() ||
          asText(latestLink?.payload.access_url).trim() ||
          asText(latestPackaging?.payload.access_url).trim()
        );
        setPitchDeckUrl((current) =>
          current.trim() ||
          asText(latestFinal?.payload.pitch_deck_url).trim() ||
          asText(latestStory?.payload.pitch_deck_url).trim()
        );
        setValueLine((current) =>
          current.trim() ||
          asText(latestFinal?.payload.value_line).trim() ||
          asText(latestProduct?.payload.one_liner).trim() ||
          asText(latestLink?.payload.one_liner).trim() ||
          asText(latestPackaging?.payload.slogan).trim() ||
          asText(latestStory?.payload.story_hook).trim()
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const submit = async () => {
    if (!accessUrl.trim()) {
      showMessage("error", "贴上能打开的作品链接。");
      return;
    }
    if (!pitchDeckUrl.trim()) {
      showMessage("error", "贴上路演 PPT 链接。");
      return;
    }
    const fallbackProductName = productName.trim() || student.team_name || `${student.nickname}的团队作品`;
    const fallbackTeamMembers = teamMembers.trim() || student.nickname;
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "final_showcase",
        title: taskTitle,
        payload: {
          product_name: fallbackProductName,
          team_members: fallbackTeamMembers,
          target_user: targetUser.trim(),
          core_problem: coreProblem.trim(),
          access_url: normalizeShowcaseUrl(accessUrl),
          pitch_deck_url: normalizeShowcaseUrl(pitchDeckUrl),
          value_line: valueLine.trim(),
          team_id: student.team_id || "",
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。这张展示卡可以上台使用。");
      setProductName("");
      setTeamMembers("");
      setTargetUser("");
      setCoreProblem("");
      setAccessUrl("");
      setPitchDeckUrl("");
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
        <p>把能打开的作品和路演 PPT 交上来，就可以准备上台。</p>
        <div className="student-card final-showcase-card">
          <div className="student-current">
            <div>
              <span>路演小组</span>
              <strong>{student.team_name || student.nickname}</strong>
              <small>{student.student_no ? `${student.nickname} · 学号 ${student.student_no}` : student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <div className="final-showcase-autofill">
            <span>会自动带上</span>
            <strong>{productName || student.team_name || "团队作品"}</strong>
            <small>{teamMembers || "团队成员会从分组里带出"}</small>
          </div>
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
            路演 PPT
            <input
              value={pitchDeckUrl}
              onChange={(event) => setPitchDeckUrl(event.target.value)}
              placeholder="https://..."
              inputMode="url"
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Trophy size={18} />}
            提交
          </button>
          <p className="hint">其他内容会从你们前面完成的卡片里带出。</p>
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
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [screenshotKey, setScreenshotKey] = useState("");
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingKey, setRecordingKey] = useState("");
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
          screenshot_key: screenshotKey,
          screenshot_url: screenshotUrl.trim() ? normalizeShowcaseUrl(screenshotUrl) : "",
          recording_key: recordingKey,
          recording_url: recordingUrl.trim() ? normalizeShowcaseUrl(recordingUrl) : "",
          team_id: student.team_id || "",
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。老师会看到这张作品卡。");
      setScreenshotUrl("");
      setScreenshotKey("");
      setRecordingUrl("");
      setRecordingKey("");
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
          <StudentImageUploadField
            label="上传展示图（可选）"
            value={screenshotUrl}
            objectKey={screenshotKey}
            assetType="product-screenshot"
            onChange={setScreenshotUrl}
            onObjectKeyChange={setScreenshotKey}
          />
          <StudentVideoUploadField
            label="上传演示视频（可选）"
            value={recordingUrl}
            objectKey={recordingKey}
            assetType="product-recording"
            onChange={setRecordingUrl}
            onObjectKeyChange={setRecordingKey}
          />
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

function StudentIterationPlanTask({
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
  const [mustChange, setMustChange] = useState("");
  const [shouldChange, setShouldChange] = useState("");
  const [later, setLater] = useState("");
  const [v2Plan, setV2Plan] = useState("");
  const [testAgain, setTestAgain] = useState("");
  const [feedbackItems, setFeedbackItems] = useState<TaskSubmission[]>([]);
  const [selectedFeedbackIds, setSelectedFeedbackIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const mustChangeItems = useMemo(() => asTextList(mustChange), [mustChange]);
  const shouldChangeItems = useMemo(() => asTextList(shouldChange), [shouldChange]);
  const laterItems = useMemo(() => asTextList(later), [later]);
  const selectedFeedbackSummaries = useMemo(
    () => feedbackItems
      .filter((item) => selectedFeedbackIds.includes(item.id))
      .map((item) => asText(item.payload.suggestion) || asText(item.payload.most_useful))
      .filter(Boolean),
    [feedbackItems, selectedFeedbackIds]
  );

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  useEffect(() => {
    let alive = true;
    api.teamFeedbackBrief()
      .then((result) => {
        if (!alive) return;
        setFeedbackItems(result.feedback_items);
        const firstProduct = result.feedback_items.find((item) => asText(item.payload.product_name));
        if (firstProduct) setProductName((current) => current || asText(firstProduct.payload.product_name));
      })
      .catch(() => {
        if (alive) setFeedbackItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const appendLine = (current: string, nextLine: string) => {
    const line = nextLine.trim();
    if (!line) return current;
    const lines = asTextList(current);
    if (lines.includes(line)) return current;
    return [...lines, line].join("\n");
  };

  const useFeedback = (item: TaskSubmission, bucket: "must" | "should") => {
    const suggestion = asText(item.payload.suggestion);
    const useful = asText(item.payload.most_useful);
    const line = suggestion || useful;
    if (!line) return;
    if (!productName.trim()) setProductName(asText(item.payload.product_name));
    if (bucket === "must") setMustChange((current) => appendLine(current, line));
    if (bucket === "should") setShouldChange((current) => appendLine(current, line));
    setSelectedFeedbackIds((current) => current.includes(item.id) ? current : [...current, item.id]);
    if (!v2Plan.trim()) setV2Plan(line);
    if (!testAgain.trim()) {
      const source = item.student_name || item.team_name || "";
      setTestAgain(source ? `请${source}再打开一次` : "请刚才试用过的同学再打开一次");
    }
  };

  const submit = async () => {
    if (!productName.trim()) {
      showMessage("error", "先写作品名。");
      return;
    }
    if (!mustChangeItems.length) {
      showMessage("error", "先写至少一条必须改的地方。");
      return;
    }
    if (!shouldChangeItems.length) {
      showMessage("error", "再写至少一条建议改的地方。");
      return;
    }
    if (!laterItems.length) {
      showMessage("error", "把现在先不改的想法也收起来。");
      return;
    }
    if (!v2Plan.trim()) {
      showMessage("error", "选出 V2 最先改的一处。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "iteration_plan",
        title: taskTitle,
        payload: {
          product_name: productName.trim(),
          must_change_items: mustChangeItems,
          must_change_summary: mustChangeItems.join(" / "),
          should_change_items: shouldChangeItems,
          should_change_summary: shouldChangeItems.join(" / "),
          later_items: laterItems,
          later_summary: laterItems.join(" / "),
          v2_plan: v2Plan.trim(),
          test_again: testAgain.trim(),
          source_feedback_ids: selectedFeedbackIds,
          source_feedback_summaries: selectedFeedbackSummaries,
          team_id: student.team_id || "",
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。现在你们知道下一版先改哪里了。");
      setProductName("");
      setMustChange("");
      setShouldChange("");
      setLater("");
      setV2Plan("");
      setTestAgain("");
      setSelectedFeedbackIds([]);
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
        <h1>{taskTitle || "迭代清单"}</h1>
        <p>把刚才听到的反馈分成三类，再决定 V2 先改哪一处。</p>
        <div className="student-card iteration-plan-card">
          <div className="student-current">
            <div>
              <span>产品小组</span>
              <strong>{student.team_name || student.nickname}</strong>
              <small>{student.student_no ? `${student.nickname} · 学号 ${student.student_no}` : student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          {feedbackItems.length > 0 && (
            <div className="iteration-feedback-panel">
              <span>收到的试用反馈</span>
              <div className="iteration-feedback-options">
                {feedbackItems.slice(0, 6).map((item) => {
                  const active = selectedFeedbackIds.includes(item.id);
                  return (
                    <article className={active ? "iteration-feedback-card active" : "iteration-feedback-card"} key={item.id}>
                      <small>{item.student_name || item.team_name || "同学反馈"}</small>
                      <strong>{asText(item.payload.product_name) || "作品"}</strong>
                      <p><b>有用</b>{asText(item.payload.most_useful) || "还没写"}</p>
                      <p><b>建议</b>{asText(item.payload.suggestion) || "还没写"}</p>
                      <div className="iteration-feedback-actions">
                        <button onClick={() => useFeedback(item, "must")}>放进必须改</button>
                        <button onClick={() => useFeedback(item, "should")}>放进建议改</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
          <label>
            作品名
            <input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              placeholder="例如：午餐选择器"
              inputMode="text"
            />
          </label>
          <div className="iteration-bucket-grid">
            <label>
              必须改
              <textarea
                value={mustChange}
                onChange={(event) => setMustChange(event.target.value)}
                placeholder={"例如：\n开始按钮不明显\n结果页看不出下一步"}
                rows={5}
              />
            </label>
            <label>
              建议改
              <textarea
                value={shouldChange}
                onChange={(event) => setShouldChange(event.target.value)}
                placeholder={"例如：\n颜色可以更舒服\n说明文字再短一点"}
                rows={5}
              />
            </label>
            <label>
              暂不改
              <textarea
                value={later}
                onChange={(event) => setLater(event.target.value)}
                placeholder={"例如：\n登录功能\n更多动画\n历史记录"}
                rows={5}
              />
            </label>
          </div>
          <div className="iteration-bucket-preview" aria-label="迭代清单预览">
            <span>必须改 {mustChangeItems.length} 条</span>
            <span>建议改 {shouldChangeItems.length} 条</span>
            <span>暂不改 {laterItems.length} 条</span>
          </div>
          <label>
            V2 最先改的一处
            <textarea
              value={v2Plan}
              onChange={(event) => setV2Plan(event.target.value)}
              placeholder="例如：把开始按钮放到第一屏中间，文字改成“开始选择”"
              rows={3}
            />
          </label>
          <label>
            再找谁试一次（可选）
            <input
              value={testAgain}
              onChange={(event) => setTestAgain(event.target.value)}
              placeholder="例如：请刚才试用过的第 3 组再打开一次"
              inputMode="text"
              enterKeyHint="done"
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <ClipboardCheck size={18} />}
            提交
          </button>
          <p className="hint">好的迭代不是全都改，而是先改最影响别人使用的一处。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentValueCardTask({
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
  const [valueChange, setValueChange] = useState("");
  const [exchangeChoice, setExchangeChoice] = useState<(typeof valueExchangeOptions)[number]["value"]>("stars");
  const [exchangeAmount, setExchangeAmount] = useState("");
  const [whyWorth, setWhyWorth] = useState("");
  const [evidence, setEvidence] = useState("");
  const [nextProof, setNextProof] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const exchangeLabel = valueExchangeLabel(exchangeChoice);
  const exchangePreview = [exchangeLabel, exchangeAmount.trim()].filter(Boolean).join(" ");

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!productName.trim()) {
      showMessage("error", "先写作品名。");
      return;
    }
    if (!targetUser.trim()) {
      showMessage("error", "先写这个作品帮谁。");
      return;
    }
    if (!valueChange.trim()) {
      showMessage("error", "写清它帮别人少烦了什么。");
      return;
    }
    if (!exchangeAmount.trim()) {
      showMessage("error", "写下别人愿意交换多少。");
      return;
    }
    if (!whyWorth.trim()) {
      showMessage("error", "再写一句为什么值得。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "value_card",
        title: taskTitle,
        payload: {
          product_name: productName.trim(),
          target_user: targetUser.trim(),
          value_change: valueChange.trim(),
          exchange_choice: exchangeChoice,
          exchange_label: exchangeLabel,
          exchange_amount: exchangeAmount.trim(),
          why_worth: whyWorth.trim(),
          evidence: evidence.trim(),
          next_proof: nextProof.trim(),
          team_id: student.team_id || "",
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。现在你们能说清作品为什么值得交换。");
      setProductName("");
      setTargetUser("");
      setValueChange("");
      setExchangeChoice("stars");
      setExchangeAmount("");
      setWhyWorth("");
      setEvidence("");
      setNextProof("");
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
        <h1>{taskTitle || "价值交换卡"}</h1>
        <p>说清你的作品帮别人少烦了什么，再看看别人愿意用什么交换。</p>
        <div className="student-card value-card-form">
          <div className="student-current">
            <div>
              <span>产品小组</span>
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
            这个作品帮谁
            <input
              value={targetUser}
              onChange={(event) => setTargetUser(event.target.value)}
              placeholder="例如：每天中午不知道吃什么的同学"
              inputMode="text"
            />
          </label>
          <label>
            帮别人少烦了什么
            <textarea
              value={valueChange}
              onChange={(event) => setValueChange(event.target.value)}
              placeholder="例如：不用在很多选项里纠结，可以 10 秒看到一个推荐"
              rows={3}
            />
          </label>
          <div className="value-choice-grid" aria-label="选择交换方式">
            {valueExchangeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={exchangeChoice === option.value ? "active" : ""}
                onClick={() => setExchangeChoice(option.value)}
              >
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </button>
            ))}
          </div>
          <label>
            别人愿意交换多少
            <input
              value={exchangeAmount}
              onChange={(event) => setExchangeAmount(event.target.value)}
              placeholder="例如：3 枚星星币 / 5 分钟 / 推荐给 2 个同学"
              inputMode="text"
            />
          </label>
          <label>
            为什么值得
            <textarea
              value={whyWorth}
              onChange={(event) => setWhyWorth(event.target.value)}
              placeholder="例如：它让选择变快，还能给出理由"
              rows={3}
            />
          </label>
          <div className="value-proof-preview" aria-label="价值卡预览">
            <span>{exchangePreview || "选择一种交换方式"}</span>
            <strong>{valueChange.trim() || "帮别人少烦了什么"}</strong>
          </div>
          <label>
            你看到的证据（可选）
            <input
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              placeholder="例如：第 2 组试用后说愿意再用一次"
              inputMode="text"
            />
          </label>
          <label>
            下一次再验证什么（可选）
            <input
              value={nextProof}
              onChange={(event) => setNextProof(event.target.value)}
              placeholder="例如：让 3 位没见过作品的同学试一次"
              inputMode="text"
              enterKeyHint="done"
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Coins size={18} />}
            提交
          </button>
          <p className="hint">真正有价值的产品，会让别人愿意付出一点东西来换。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentProductPackagingTask({
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
  const [slogan, setSlogan] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [sellingPoints, setSellingPoints] = useState("");
  const [posterPlan, setPosterPlan] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [posterKey, setPosterKey] = useState("");
  const [accessUrl, setAccessUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const pointItems = useMemo(() => asTextList(sellingPoints).slice(0, 5), [sellingPoints]);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const submit = async () => {
    if (!productName.trim()) {
      showMessage("error", "先写作品名。");
      return;
    }
    if (!slogan.trim()) {
      showMessage("error", "写一句让人记住的标语。");
      return;
    }
    if (!targetUser.trim()) {
      showMessage("error", "写清这张海报给谁看。");
      return;
    }
    if (pointItems.length < 2) {
      showMessage("error", "至少写两个卖点。");
      return;
    }
    if (!posterPlan.trim()) {
      showMessage("error", "写下海报第一眼要看到的画面。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "product_packaging",
        title: taskTitle,
        payload: {
          product_name: productName.trim(),
          slogan: slogan.trim(),
          target_user: targetUser.trim(),
          selling_points: pointItems,
          selling_point_summary: pointItems.join(" / "),
          poster_plan: posterPlan.trim(),
          poster_key: posterKey,
          poster_url: posterUrl.trim() ? normalizeShowcaseUrl(posterUrl) : "",
          access_url: accessUrl.trim() ? normalizeShowcaseUrl(accessUrl) : "",
          team_id: student.team_id || "",
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。你们的产品摊位已经有了第一眼画面。");
      setProductName("");
      setSlogan("");
      setTargetUser("");
      setSellingPoints("");
      setPosterPlan("");
      setPosterUrl("");
      setPosterKey("");
      setAccessUrl("");
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
        <h1>{taskTitle || "产品海报卡"}</h1>
        <p>让别人远远看一眼，就知道你们的作品帮谁、好在哪里。</p>
        <div className="student-card product-packaging-form">
          <div className="student-current">
            <div>
              <span>产品小组</span>
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
            一句标语
            <input
              value={slogan}
              onChange={(event) => setSlogan(event.target.value)}
              placeholder="例如：10 秒找到今天最合适的午餐"
              inputMode="text"
            />
          </label>
          <label>
            这张海报给谁看
            <input
              value={targetUser}
              onChange={(event) => setTargetUser(event.target.value)}
              placeholder="例如：每天中午选择困难的同学"
              inputMode="text"
            />
          </label>
          <label>
            三个卖点
            <textarea
              value={sellingPoints}
              onChange={(event) => setSellingPoints(event.target.value)}
              placeholder={"例如：\n快速推荐\n给出理由\n可以按口味调整"}
              rows={4}
            />
          </label>
          <div className="packaging-point-grid" aria-label="卖点预览">
            {(pointItems.length ? pointItems : ["卖点 1", "卖点 2", "卖点 3"]).slice(0, 3).map((point, index) => (
              <span key={`${point}-${index}`}>{point}</span>
            ))}
          </div>
          <label>
            海报第一眼画面
            <textarea
              value={posterPlan}
              onChange={(event) => setPosterPlan(event.target.value)}
              placeholder="例如：一个同学站在食堂窗口前，手机上出现两个推荐选择"
              rows={3}
            />
          </label>
          <StudentImageUploadField
            label="上传海报或截图（可选）"
            value={posterUrl}
            objectKey={posterKey}
            assetType="product-poster"
            onChange={setPosterUrl}
            onObjectKeyChange={setPosterKey}
          />
          <label>
            作品链接（可选）
            <input
              value={accessUrl}
              onChange={(event) => setAccessUrl(event.target.value)}
              placeholder="https://..."
              inputMode="url"
              enterKeyHint="done"
            />
          </label>
          <div className="packaging-preview" aria-label="产品海报预览">
            <span>{productName.trim() || "作品名"}</span>
            <strong>{slogan.trim() || "一句标语"}</strong>
            <small>{posterPlan.trim() || "海报第一眼画面"}</small>
          </div>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Image size={18} />}
            提交
          </button>
          <p className="hint">好的海报不是装饰，它会让别人一眼知道作品为什么值得打开。</p>
          {message && <p className={`student-message ${message.tone}`}>{message.text}</p>}
        </div>
      </section>
    </main>
  );
}

function StudentStoryPitchTask({
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
  const [storyHook, setStoryHook] = useState("");
  const [userScene, setUserScene] = useState("");
  const [productDemo, setProductDemo] = useState("");
  const [proofLine, setProofLine] = useState("");
  const [inviteLine, setInviteLine] = useState("");
  const [rehearsalQa, setRehearsalQa] = useState(() => [
    { question: "", answer: "" },
    { question: "", answer: "" },
    { question: "", answer: "" }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const isRehearsalMode = /问答预演|预演问题|追问/.test(taskTitle);
  const filledRehearsalQa = useMemo(
    () => rehearsalQa
      .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
      .filter((item) => item.question || item.answer),
    [rehearsalQa]
  );

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };

  const updateRehearsalQa = (index: number, field: "question" | "answer", value: string) => {
    setRehearsalQa((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const submit = async () => {
    if (!productName.trim()) {
      showMessage("error", "先写作品名。");
      return;
    }
    if (!storyHook.trim()) {
      showMessage("error", "先写一句开头，让大家想继续听。");
      return;
    }
    if (!userScene.trim()) {
      showMessage("error", "写清楚故事里的那个人遇到了什么。");
      return;
    }
    if (!productDemo.trim()) {
      showMessage("error", "写清楚上台时先演示作品哪一步。");
      return;
    }
    if (!proofLine.trim()) {
      showMessage("error", "加上一条证据，让别人相信它真的有用。");
      return;
    }
    if (!inviteLine.trim()) {
      showMessage("error", "最后写一句邀请大家做什么。");
      return;
    }
    if (filledRehearsalQa.some((item) => !item.question || !item.answer)) {
      showMessage("error", "有一条问答还差问题或回答。");
      return;
    }
    if (isRehearsalMode && filledRehearsalQa.length < 3) {
      showMessage("error", "先准备 3 个问题和回答。");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "story_pitch",
        title: taskTitle,
        payload: {
          product_name: productName.trim(),
          story_hook: storyHook.trim(),
          user_scene: userScene.trim(),
          product_demo: productDemo.trim(),
          proof_line: proofLine.trim(),
          invite_line: inviteLine.trim(),
          rehearsal_question: filledRehearsalQa[0]?.question || "",
          rehearsal_answer: filledRehearsalQa[0]?.answer || "",
          rehearsal_qa: filledRehearsalQa,
          rehearsal_question_summary: filledRehearsalQa.map((item) => item.question).join(" / "),
          team_id: student.team_id || "",
          team_name: student.team_name || ""
        }
      });
      showMessage("success", "收到啦。你们的作品故事已经有清楚的上台顺序。");
      setProductName("");
      setStoryHook("");
      setUserScene("");
      setProductDemo("");
      setProofLine("");
      setInviteLine("");
      setRehearsalQa([
        { question: "", answer: "" },
        { question: "", answer: "" },
        { question: "", answer: "" }
      ]);
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
        <h1>{taskTitle || "故事发布五步卡"}</h1>
        <p>把作品讲成一个故事：先让大家看见一个人，再让作品上场。</p>
        <div className="student-card story-pitch-form">
          <div className="student-current">
            <div>
              <span>路演小组</span>
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
          <div className="story-step-grid">
            <label>
              1. 一句开头
              <textarea
                value={storyHook}
                onChange={(event) => setStoryHook(event.target.value)}
                placeholder="例如：你有没有在食堂排队时，突然不知道吃什么？"
                rows={3}
              />
            </label>
            <label>
              2. 人物和麻烦
              <textarea
                value={userScene}
                onChange={(event) => setUserScene(event.target.value)}
                placeholder="例如：小宇每天中午都在窗口前纠结，最后随便选一个。"
                rows={3}
              />
            </label>
            <label>
              3. 作品怎么帮他
              <textarea
                value={productDemo}
                onChange={(event) => setProductDemo(event.target.value)}
                placeholder="例如：打开作品，选口味和时间，它会给出一个推荐。"
                rows={3}
              />
            </label>
            <label>
              4. 一条证据
              <textarea
                value={proofLine}
                onChange={(event) => setProofLine(event.target.value)}
                placeholder="例如：3 位同学试用后，有 2 位说愿意明天再用。"
                rows={3}
              />
            </label>
            <label>
              5. 最后邀请
              <textarea
                value={inviteLine}
                onChange={(event) => setInviteLine(event.target.value)}
                placeholder="例如：欢迎大家课间点开试一次，看看它会推荐什么。"
                rows={3}
              />
            </label>
            <label>
              问答预演
              <div className="story-qa-list">
                {rehearsalQa.map((item, index) => (
                  <article className="story-qa-card" key={index}>
                    <span>第 {index + 1} 个问题</span>
                    <textarea
                      value={item.question}
                      onChange={(event) => updateRehearsalQa(index, "question", event.target.value)}
                      placeholder={index === 0 ? "例如：如果推荐结果不喜欢，可以怎么改？" : "例如：这个作品下一版先加什么？"}
                      rows={2}
                    />
                    <textarea
                      value={item.answer}
                      onChange={(event) => updateRehearsalQa(index, "answer", event.target.value)}
                      placeholder="用证据回答一句"
                      rows={2}
                    />
                  </article>
                ))}
              </div>
            </label>
          </div>
          <div className="story-pitch-preview" aria-label="故事发布预览">
            <span>上台顺序</span>
            <strong>{storyHook.trim() || "一句开头"}</strong>
            <small>人物 → 作品 → 证据 → 邀请</small>
          </div>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Megaphone size={18} />}
            提交
          </button>
          <p className="hint">好的故事发布，会让别人先看见问题，再看懂作品怎么帮忙。</p>
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
  const displayTitle = taskTitle && !/观察员投票/.test(taskTitle) ? taskTitle : "同伴投票";

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
        title: displayTitle,
        payload: {
          showcase_item_id: selectedItem.id,
          product_name: selectedItem.product_name,
          team_id: selectedItem.team_id || "",
          team_name: selectedItem.team_name || selectedItem.track || "",
          access_url: selectedItem.access_url || "",
          observer_role: "peer",
          observer_name: student.nickname,
          observer_team_id: student.team_id || "",
          observer_team_name: student.team_name || "",
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
        <h1>{displayTitle}</h1>
        <p>选一个别组作品，点亮五组星星，再写下你看见的亮点和下一步建议。</p>
        <div className="student-card observer-score-card">
          <div className="student-current">
            <div>
              <span>同伴观察员</span>
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
  const pitchDeckUrl = asText(active.payload.pitch_deck_url);
  const screenshot = asText(active.payload.screenshot_url);
  const recording = asText(active.payload.recording_url);
  return (
    <section className="final-showcase-wall">
      <div className="wall-section-title">
        <span className="eyebrow">结营路演</span>
        <h2>逐组展示</h2>
      </div>
      <article className="final-stage-card">
        <div className="final-stage-media">
          {recording ? (
            <video src={normalizeShowcaseUrl(recording)} controls preload="metadata" playsInline />
          ) : screenshot ? (
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
          <div className="final-stage-links">
            {href && (
              <a href={normalizeShowcaseUrl(href)} target="_blank" rel="noreferrer">
                <ExternalLink size={18} />
                打开作品
              </a>
            )}
            {pitchDeckUrl && (
              <a href={normalizeShowcaseUrl(pitchDeckUrl)} target="_blank" rel="noreferrer">
                <ExternalLink size={18} />
                路演 PPT
              </a>
            )}
          </div>
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
  const hasTeam = artifacts.some((item) => item.task_type === "team_card");
  const hasProduct = artifacts.some((item) => item.task_type === "product_definition");
  const hasDirectionPlan = artifacts.some((item) =>
    item.task_type === "product_definition" && asText(item.payload.definition_stage) === "day1_direction_plan"
  );
  const hasPackaging = artifacts.some((item) => item.task_type === "product_packaging");
  const hasPrompt = artifacts.some((item) => item.task_type === "prompt_card");
  const hasFeature = artifacts.some((item) => item.task_type === "feature_scope");
  const hasTech = artifacts.some((item) => item.task_type === "tech_route");
  const hasIteration = artifacts.some((item) => item.task_type === "iteration_plan");
  const hasValue = artifacts.some((item) => item.task_type === "value_card");
  const hasStory = artifacts.some((item) => item.task_type === "story_pitch");
  const hasValidation = artifacts.some((item) => item.task_type === "ai_validation");
  const hasScout = artifacts.some((item) => item.task_type === "market_scout");
  return (
    <section className="wall-artifacts">
      <div className="wall-section-title">
        <span className="eyebrow">{hasDirectionPlan ? "方向墙" : hasProduct ? "产品卡片" : hasPackaging ? "产品海报" : hasStory ? "故事发布" : hasValue ? "价值交换" : hasIteration ? "迭代清单" : hasTech ? "路线流程" : hasFeature ? "核心动作" : hasPrompt ? "提示词卡" : hasValidation ? "AI 验证" : hasScout ? "市场侦察" : hasTeam ? "团队名片" : "真实线索"}</span>
        <h2>{hasDirectionPlan ? "每队明天先做什么" : hasProduct ? "从问题到产品" : hasPackaging ? "一眼看懂作品" : hasStory ? "让大家听懂作品" : hasValue ? "作品为什么值得" : hasIteration ? "把反馈改成下一版" : hasTech ? "30 秒看懂怎么用" : hasFeature ? "先跑通最关键一步" : hasPrompt ? "让 AI 更听得懂" : hasValidation ? "用证据改答案" : hasScout ? "把问题查得更清楚" : hasTeam ? "团队名称和方向" : "问题和用户声音"}</h2>
      </div>
      <div className="wall-artifact-grid">
        {artifacts.map((item) => {
          const isTeam = item.task_type === "team_card";
          const isProblem = item.task_type === "problem_card";
          const isScout = item.task_type === "market_scout";
          const isValidation = item.task_type === "ai_validation";
          const isProduct = item.task_type === "product_definition";
          const isPackaging = item.task_type === "product_packaging";
          const isPrompt = item.task_type === "prompt_card";
          const isFeature = item.task_type === "feature_scope";
          const isTech = item.task_type === "tech_route";
          const isIteration = item.task_type === "iteration_plan";
          const isValue = item.task_type === "value_card";
          const isStory = item.task_type === "story_pitch";
          const qaPairs = isStory ? storyQaPairs(item.payload) : [];
          const trackText = isProduct ? productTrackText(item.payload) : "";
          const isDirectionPlan = isProduct && asText(item.payload.definition_stage) === "day1_direction_plan";
          const productAction = isProduct ? asText(item.payload.core_action) || asText(item.payload.solution) : "";
          return (
            <article
              className={
                isProduct
                  ? "wall-artifact-card product"
                  : isPackaging
                  ? "wall-artifact-card product-packaging"
                  : isStory
                  ? "wall-artifact-card story-pitch"
                  : isValue
                  ? "wall-artifact-card value-card"
                  : isIteration
                  ? "wall-artifact-card iteration-plan"
                  : isTech
                  ? "wall-artifact-card tech-route"
                  : isFeature
                  ? "wall-artifact-card feature-scope"
                  : isPrompt
                  ? "wall-artifact-card prompt"
                  : isScout
                  ? "wall-artifact-card scout"
                  : isValidation
                  ? "wall-artifact-card validation"
                  : isProblem
                  ? "wall-artifact-card problem"
                  : isTeam
                  ? "wall-artifact-card team-card"
                  : "wall-artifact-card voice"
              }
              key={item.id}
            >
              <span>{isProduct ? isDirectionPlan ? "方向计划" : "产品卡" : isPackaging ? "产品海报卡" : isStory ? "故事发布卡" : isValue ? "价值卡" : isIteration ? "迭代清单" : isTech ? "路线流程卡" : isFeature ? "核心动作卡" : isPrompt ? "提示词卡" : isScout ? "侦察卡" : isValidation ? "验证卡" : isProblem ? "问题卡" : isTeam ? "团队名片" : "用户声音"}</span>
              <strong>
                {isProduct
                  ? isDirectionPlan
                    ? asText(item.payload.direction) || asText(item.payload.product_name) || "一个团队方向"
                    : asText(item.payload.product_name) || "一个产品想法"
                  : isPackaging
                  ? asText(item.payload.slogan) || asText(item.payload.product_name) || "一张产品海报"
                  : isStory
                  ? asText(item.payload.story_hook) || asText(item.payload.product_name) || "让大家听懂作品"
                  : isValue
                  ? asText(item.payload.value_change) || asText(item.payload.product_name) || "作品为什么值得"
                  : isIteration
                  ? asText(item.payload.v2_plan) || asText(item.payload.product_name) || "下一版计划"
                  : isTech
                  ? techRouteLabel(item.payload.route_choice)
                  : isFeature
                  ? asText(item.payload.core_action) || asText(item.payload.product_name) || "今天先跑通的一步"
                  : isPrompt
                  ? asText(item.payload.goal) || "一张五句提示词卡"
                  : isScout
                  ? asText(item.payload.ai_rewrite) || asText(item.payload.original_problem) || "一次市场侦察"
                  : isValidation
                  ? asText(item.payload.doubt) || asText(item.payload.revised_conclusion) || "用证据检查 AI"
                  : isProblem
                  ? asText(item.payload.problem_scene) || asText(item.payload.trouble) || "一个真实问题"
                  : isTeam
                  ? asText(item.payload.team_name) || item.team_name || "一个新团队"
                  : asText(item.payload.interviewee) || "一次真实采访"}
              </strong>
              {isProduct ? (
                isDirectionPlan ? (
                  <>
                    <p><b>赛道</b>{trackText || "正在选择"}</p>
                    <p><b>帮谁</b>{asText(item.payload.target_user) || "还没写"}</p>
                    <p><b>卡在哪</b>{asText(item.payload.core_problem) || "还没写"}</p>
                    <p><b>要问什么</b>{asText(item.payload.demand_questions) || "还在准备"}</p>
                    <p><b>明天带回</b>{asText(item.payload.day2_materials) || "可以继续补"}</p>
                    <p><b>明天先做</b>{asText(item.payload.day2_first_step) || productAction || "还在打磨"}</p>
                  </>
                ) : (
                  <>
                    <p><b>赛道</b>{trackText || "正在选择"}</p>
                    <p><b>帮谁</b>{asText(item.payload.target_user) || "还没写"}</p>
                    <p><b>场景</b>{asText(item.payload.use_scene) || "还没写"}</p>
                    <p><b>问题</b>{asText(item.payload.core_problem) || "还没写"}</p>
                    <p><b>先做动作</b>{productAction || "还在打磨"}</p>
                    <p><b>证据</b>{asText(item.payload.interview_evidence) || "还在收集"}</p>
                    <p><b>一句话</b>{asText(item.payload.one_liner) || "还在打磨"}</p>
                  </>
                )
              ) : isPackaging ? (
                <>
                  {asText(item.payload.poster_url) && (
                    <div className="wall-artifact-shot">
                      <img src={normalizeShowcaseUrl(asText(item.payload.poster_url))} alt={asText(item.payload.product_name) || "产品海报"} />
                    </div>
                  )}
                  <p><b>产品</b>{asText(item.payload.product_name) || "还没写"}</p>
                  <p><b>给谁看</b>{asText(item.payload.target_user) || "还没写"}</p>
                  <p><b>卖点</b>{asTextList(item.payload.selling_points).join(" / ") || asText(item.payload.selling_point_summary) || "还没写"}</p>
                  <p><b>第一眼</b>{asText(item.payload.poster_plan) || "还没写"}</p>
                  {asText(item.payload.access_url) && <p><b>作品入口</b>{asText(item.payload.access_url)}</p>}
                </>
              ) : isStory ? (
                <>
                  <p><b>产品</b>{asText(item.payload.product_name) || "还没写"}</p>
                  <p><b>人物</b>{asText(item.payload.user_scene) || "还没写"}</p>
                  <p><b>作品</b>{asText(item.payload.product_demo) || "还没写"}</p>
                  <p><b>证据</b>{asText(item.payload.proof_line) || "还没写"}</p>
                  <p><b>邀请</b>{asText(item.payload.invite_line) || "还没写"}</p>
                  {qaPairs.length > 0 && (
                    <p><b>问答预演</b>{storyQaSummary(item.payload)}</p>
                  )}
                </>
              ) : isValue ? (
                <>
                  <p><b>产品</b>{asText(item.payload.product_name) || "还没写"}</p>
                  <p><b>帮谁</b>{asText(item.payload.target_user) || "还没写"}</p>
                  <p><b>少烦了</b>{asText(item.payload.value_change) || "还没写"}</p>
                  <p><b>愿意交换</b>{[valueExchangeLabel(item.payload.exchange_choice), asText(item.payload.exchange_amount)].filter(Boolean).join(" ") || "还没写"}</p>
                  <p><b>为什么值得</b>{asText(item.payload.why_worth) || "还没写"}</p>
                  <p><b>证据</b>{asText(item.payload.evidence) || "还在整理"}</p>
                </>
              ) : isIteration ? (
                <>
                  <p><b>产品</b>{asText(item.payload.product_name) || "还没写"}</p>
                  <p><b>必须改</b>{iterationListSummary(item.payload.must_change_items, item.payload.must_change_summary) || "还没写"}</p>
                  <p><b>建议改</b>{iterationListSummary(item.payload.should_change_items, item.payload.should_change_summary) || "还没写"}</p>
                  <p><b>暂不改</b>{iterationListSummary(item.payload.later_items, item.payload.later_summary) || "还没写"}</p>
                  <p><b>再试一次</b>{asText(item.payload.test_again) || "还没写"}</p>
                  {asTextList(item.payload.source_feedback_summaries).length > 0 && (
                    <p><b>来自反馈</b>{asTextList(item.payload.source_feedback_summaries).join(" / ")}</p>
                  )}
                </>
              ) : isTech ? (
                <>
                  <p><b>准备用</b>{asText(item.payload.tool_plan) || "还没写"}</p>
                  <p><b>用户流程</b>{userFlowSummary(item.payload) || "还没写"}</p>
                  <p><b>第一屏</b>{asText(item.payload.first_screen) || "还没写"}</p>
                  <p><b>看到结果</b>{asText(item.payload.result_screen) || "还没写"}</p>
                  <p><b>兜底办法</b>{asText(item.payload.fallback_plan) || "还没写"}</p>
                </>
              ) : isFeature ? (
                <>
                  <p><b>功能清单</b>{featureSummary(item.payload) || "还没写"}</p>
                  <p><b>第一版</b>{asText(item.payload.first_version) || "还没写"}</p>
                  <p><b>先不做</b>{asText(item.payload.not_now) || "还在收束"}</p>
                  <p><b>看到结果</b>{asText(item.payload.success_signal) || "还没写"}</p>
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
              ) : isTeam ? (
                <>
                  <p><b>成员</b>{asText(item.payload.team_members) || item.team_name || "还在集合"}</p>
                  <p><b>方向</b>{asText(item.payload.product_direction) || asText(item.payload.direction) || "还在讨论"}</p>
                  <p><b>亮相</b>{asText(item.payload.launch_line) || "还在准备"}</p>
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
  const growthItems = reflections.filter((reflection) => reflection.task_type === "growth_reflection");
  if (!growthItems.length) return null;
  return (
    <section className="wall-growth">
      <div className="wall-section-title">
        <span className="eyebrow">成长卡</span>
        <h2>下一次我怎么指挥 AI</h2>
      </div>
      <div className="wall-growth-grid">
        {growthItems.slice(0, 8).map((reflection) => (
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
