import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowDown,
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
  Menu,
  MessageSquareText,
  Mic,
  Monitor,
  Package,
  Pause,
  Pencil,
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
  RotateCcw,
  RotateCw,
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
import { classroomPath, classroomRoute, isClassroomRoute } from "./routes";

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
    hint: "先从家里、上学路、自己的房间看起，找每天真的会发生的不方便",
    directions: ["出门怕漏带", "老人手机消息", "钱一下没了"]
  },
  {
    value: "learning-tool",
    label: "学习工具",
    hint: "题太长、错题改不明白、英语想开口却接不上",
    directions: ["长题看不懂", "错题找原因", "英语接不上"]
  },
  {
    value: "creative-studio",
    label: "创意工坊",
    hint: "作文、小游戏、漫画，脑子里有画面，手上做不出来",
    directions: ["作文开不了头", "游戏规则说不清", "作文变漫画"]
  },
  {
    value: "campus-community",
    label: "家庭社区",
    hint: "爸妈、爷爷奶奶、宠物和家庭回忆里，也藏着每天会发生的真实需要",
    directions: ["周末安排太乱", "宠物照顾交接", "照片没人整理"]
  }
] as const;

const teacherLessonHref = classroomPath("teacher.html");
const teacherWorkspaceHref = classroomPath("teacher-workspace.html");
const teacherProgressHref = classroomPath("teacher-progress.html");
const teacherStudentsHref = classroomPath("teacher-students.html");
const teacherSubmissionsHref = classroomPath("teacher-submissions.html");
const teacherShowcaseAdminHref = classroomPath("teacher-showcase-admin.html");
const wallHref = classroomPath("wall.html");
const showcaseHref = classroomPath("showcase.html");
const parentsHref = classroomPath("parents.html");

type ProductTrackValue = (typeof productTrackOptions)[number]["value"];

const productTrackExamples: Record<
  ProductTrackValue,
  {
    track: string;
    productName: string;
    user: string;
    need: string;
    product: string;
    vagueAsk: string;
    clearAsk: string;
    aiFirstDraft: string;
    usefulPart: string;
    checkPoint: string;
    mvpAction: string;
    value: string;
    stallCard: string;
    evidence: string;
    nextStep: string;
  }
> = {
  "life-helper": {
    track: "生活帮手",
    productName: "上学前 3 分钟检查台",
    user: "早上出门前怕漏带东西的同学",
    need: "课表、作业和老师通知分散在不同地方，孩子早上出门容易漏带关键东西。",
    product: "上学前 3 分钟检查台：粘贴课表、作业和老师通知，生成今天必带、要提前确认、到校先做的出门清单。",
    vagueAsk: "帮我做个生活产品。",
    clearAsk: "这是明天课表、作业和老师通知。请帮 10 岁同学分成今天必带、要提前确认、到校先做三栏，不要超过 8 项。",
    aiFirstDraft: "今天必带：数学练习册、水杯、校牌、美术彩笔；要确认：体育课运动鞋；到校先做：交作业。",
    usefulPart: "三栏清单能直接放到第一屏，孩子睡前和出门前各查一次。",
    checkPoint: "删掉“保证万无一失”，保留通知整理、缺项提醒和自己勾选。",
    mvpAction: "粘贴明天课表和通知，生成三栏出门清单。",
    value: "把关键物品带齐，出门前少反复确认。",
    stallCard: "把课表、作业和老师通知，变成出门前 3 分钟能勾选的清单。",
    evidence: "同学说：“通知太长了，我看到要带水杯，没看到还要带学生证。”",
    nextStep: "下一版先加“拍背包照片，检查清单里还有哪项没看到”。"
  },
  "learning-tool": {
    track: "学习工具",
    productName: "长应用题第一步",
    user: "一看到长应用题就不知道从哪下手的同学",
    need: "题目很长，人物、数字和问题混在一起，孩子不是不会算，而是不知道先找什么。",
    product: "长应用题第一步：粘贴或拍下题目，拆成谁、已知、要求、第一步提示。",
    vagueAsk: "帮我做个学习产品。",
    clearAsk: "请不要直接算答案。把这道应用题拆成：谁在做什么、已知数字、要求什么、第一步可以画什么或写什么。",
    aiFirstDraft: "人物：小明和同学；已知：每盒 6 支、买了 4 盒；要求：一共有多少支；第一步：先画 4 个盒子。",
    usefulPart: "拆题板能让孩子先开始，而不是盯着长题发呆。",
    checkPoint: "删掉“直接给最终答案”，保留题目结构和第一步提示。",
    mvpAction: "粘贴一道应用题，看到题目结构和第一步提示。",
    value: "让同学遇到长题时先有下手的办法，而不是直接放弃或抄答案。",
    stallCard: "把一大段应用题，拆成能开始的四块。",
    evidence: "同学说：“我会算乘法，可这题太长，我不知道先看哪句话。”",
    nextStep: "下一版先加“让我自己填算式，再检查思路”。"
  },
  "creative-studio": {
    track: "创意工坊",
    productName: "作文漫画分镜台",
    user: "写完作文后，想把文字变成漫画的同学",
    need: "作文写了很多，但别人一下看不见最精彩的画面，孩子也不知道该选哪 4 个时刻。",
    product: "作文漫画分镜台：输入自己的作文，先选出 4 个关键画面，再生成分镜、对白和旁白草稿。",
    vagueAsk: "帮我做个创意产品。",
    clearAsk: "这是我写的运动会作文。请帮我挑 4 个最适合画成漫画的时刻：开场、麻烦、转折、结果。每格只写画面、人物动作和一句对白。",
    aiFirstDraft: "第 1 格：小雨站在起跑线前，手心出汗；对白：我能跑完吗？",
    usefulPart: "4 个关键画面能让孩子重新看见自己的作文，再决定怎么改。",
    checkPoint: "删掉“代写作文”和“自动生成整篇漫画”，保留孩子自己的作文和可修改分镜。",
    mvpAction: "粘贴一段作文，得到 4 格漫画分镜草稿。",
    value: "把一大段作文变成能看、能改、能展示的漫画小作品。",
    stallCard: "把自己的作文，拆成 4 个能画出来的关键画面。",
    evidence: "同学说：“我写了很多，可别人只记住我参加了跑步比赛。”",
    nextStep: "下一版先加“换一个更精彩的第 2 格”。"
  },
  "campus-community": {
    track: "家庭社区",
    productName: "周末出门卡",
    user: "周末活动一多就容易漏安排的家庭",
    need: "周末课程、探望、活动和要带的东西散在不同消息里，家里人很难一眼看清谁负责什么。",
    product: "周末出门卡：把去哪、几点出发、要带什么、谁负责，整理成全家都能看的卡片。",
    vagueAsk: "帮我做个家庭产品。",
    clearAsk: "这是我们周六的安排：篮球课、去爷爷家、科学展。请帮 10 岁孩子整理成一张出门卡，分成去哪、几点、带什么、谁负责四栏。",
    aiFirstDraft: "周六出门卡：9:00 篮球课，带水杯和护具，爸爸负责；10:30 去爷爷家，带药和水果，妈妈负责；14:00 科学展，带预约码，孩子负责提醒。",
    usefulPart: "四栏出门卡能让孩子也参与准备，不只是等爸妈提醒。",
    checkPoint: "删掉自动读取家庭消息，保留手动输入安排、整理卡片和勾选。",
    mvpAction: "输入一天安排，生成一张周末出门卡。",
    value: "让全家少漏东西，出门前少翻消息、少互相催。",
    stallCard: "把周末安排，变成全家都看得懂的出门卡。",
    evidence: "爸爸说：“车开到半路才想起科学展预约码没截图。”",
    nextStep: "下一版先加“每个人负责哪一项”的勾选状态。"
  }
};

type TrackProjectFrame = {
  caption: string;
  text: string;
};

type TrackProjectChoice = {
  title: string;
  user: string;
  image: string;
  imageAlt: string;
  story: string;
  frames: TrackProjectFrame[];
  question: string;
};

const trackProjectChoices: Record<
  ProductTrackValue,
  {
    pageTitle: string;
    intro: string;
    projects: TrackProjectChoice[];
  }
> = {
  "life-helper": {
    pageTitle: "生活帮手：先从家里找需要",
    intro: "生活帮手先从家里和身边看起：谁做一件小事时不方便、不安全，或者总要麻烦别人？",
    projects: [
      {
        title: "爷爷看不懂手机消息",
        user: "收到手机消息却怕点错的爷爷奶奶",
        image: classroomPath("courseware/day1-track-project-comics/images/02-grandpa-phone-message.svg"),
        imageAlt: "四格连环画：爷爷手机弹出多条小字消息，他看不懂哪条重要，错过预约确认，孩子思考怎样把消息讲清楚。",
        story: "爷爷手机上弹出快递、医院、银行和家族群消息，字小又复杂。他不是不会用手机，而是不知道哪条重要、下一步该做什么。",
        frames: [
          { caption: "手机又响了。", text: "长辈每天会收到很多消息。" },
          { caption: "这条在说什么？", text: "他不是不想看，是看不明白。" },
          { caption: "重要消息错过了。", text: "看不懂消息会带来真实麻烦。" },
          { caption: "能不能讲明白？", text: "还差一个把消息讲成大白话的办法。" }
        ],
        question: "如果帮爷爷奶奶看一条手机消息，最该先讲清哪三件事？"
      },
      {
        title: "上学前 3 分钟检查",
        user: "早上容易漏带东西的同学",
        image: classroomPath("courseware/day1-track-project-comics/images/01-morning-check.jpg"),
        imageAlt: "四格连环画：安安出门前被问要带什么，东西散在不同地方，到校门口才发现校卡没带，最后思考出门前先查哪几样。",
        story: "安安已经站在门口，水杯、校卡、美术材料却散在不同地方，到了校门口才发现校卡还夹在练习册里。",
        frames: [
          { caption: "水杯、校卡、美术材料？", text: "已经要出门，又被问到好几样。" },
          { caption: "东西都在不同地方。", text: "课表、通知、作业本和跳绳散开了。" },
          { caption: "到了校门口才发现。", text: "漏带会影响进校，也会让人着急。" },
          { caption: "出门前先查哪几样？", text: "还差一个快速检查的办法。" }
        ],
        question: "如果只剩 3 分钟，出门前最该先查哪几样？"
      },
      {
        title: "零花钱一下就没了",
        user: "想攒钱但容易被小东西吸引的同学",
        image: classroomPath("courseware/day1-track-project-comics/images/03-pocket-money.jpg"),
        imageAlt: "四格连环画：小航想攒钱买篮球挂件，却一次次买贴纸饮料和笔，周日发现钱只剩很少，最后看着目标和小消费犹豫。",
        story: "小航想买篮球挂件，可贴纸、饮料和漂亮的笔每次都不贵，周日一看钱包，只剩 3 元。",
        frames: [
          { caption: "我想攒钱买它。", text: "他有一个真正想买的目标。" },
          { caption: "这个也不贵。", text: "小额诱惑一次次出现。" },
          { caption: "钱去哪儿了？", text: "几次小消费加起来，目标买不起了。" },
          { caption: "买之前要想什么？", text: "还差一个付款前想清楚的办法。" }
        ],
        question: "付款前，怎样看见自己离真正想买的东西还差多远？"
      }
    ]
  },
  "learning-tool": {
    pageTitle: "学习工具：卡住时先看哪一步",
    intro: "学习工具先看同学卡在哪一步，再帮他找到第一步。",
    projects: [
      {
        title: "长应用题第一步",
        user: "看到大段题目就发愣的同学",
        image: classroomPath("courseware/day1-track-project-comics/images/04-word-problem-first-step.jpg"),
        imageAlt: "四格连环画：辰辰面对很长的应用题不知道先看哪句，旁边同学已经开始写，乱猜一步又擦掉，最后把题目分成几块思考。",
        story: "辰辰会算加减乘除，可 6 行应用题像一堵字墙，他真正卡住的是第一步该从哪句开始。",
        frames: [
          { caption: "字好多，我先看哪句？", text: "长题让人不知道从哪里看。" },
          { caption: "大家都开始了。", text: "时间压力一大，更容易慌。" },
          { caption: "乱猜一步，后面更乱。", text: "第一步错了，后面都跟着乱。" },
          { caption: "第一步怎么找？", text: "还差一个把长题拆开看的办法。" }
        ],
        question: "长题里，哪句话最容易把你绕晕？"
      },
      {
        title: "错题到底错在哪里",
        user: "订正错题时不知道改哪一步的同学",
        image: classroomPath("courseware/day1-track-project-comics/images/05-mistake-reason.jpg"),
        imageAlt: "四格连环画：林林拿到有红叉的卷子，抄了正确答案，一周后类似题又错，最后看着几类错因思考。",
        story: "林林把正确答案抄进错题本，可一周后类似题又错了，因为他还没分清自己到底错在哪里。",
        frames: [
          { caption: "又错了 9 道。", text: "错题出现，心里有点压力。" },
          { caption: "答案抄好了。", text: "订正了，但只是抄正确答案。" },
          { caption: "怎么又错同一种？", text: "只抄答案，下一次还会卡住。" },
          { caption: "这次到底错在哪？", text: "还差一个分清错因的办法。" }
        ],
        question: "订正错题时，怎么先找到自己错在哪一类？"
      },
      {
        title: "英语开口不只背稿",
        user: "想练口语但没人陪练的同学",
        image: classroomPath("courseware/day1-track-project-comics/images/06-english-followup.jpg"),
        imageAlt: "四格连环画：阿泽在家背熟英文介绍，课堂上被同学追问后卡住，脑中有想法却说不出，最后看着几个追问气泡。",
        story: "阿泽背熟了英文介绍，可同学一追问，他脑子里明明有想法，嘴巴却只剩一句 Because... good。",
        frames: [
          { caption: "第一段我背熟了。", text: "他准备了稿子，很有信心。" },
          { caption: "有人追问了。", text: "展示从背稿变成对话。" },
          { caption: "我有想法，说不出来。", text: "不是没内容，是接不上。" },
          { caption: "要练哪些追问？", text: "还差一个陪他练追问的办法。" }
        ],
        question: "说英语时，你最怕别人追问哪一种问题？"
      }
    ]
  },
  "creative-studio": {
    pageTitle: "创意工坊：有想法但做不出来",
    intro: "创意工坊先看想法卡在哪里，再让它落到纸上和屏幕上。",
    projects: [
      {
        title: "作文第一句话",
        user: "脑子里有一整个故事的同学",
        image: classroomPath("courseware/day1-track-project-comics/images/07-first-sentence.jpg"),
        imageAlt: "四格连环画：小朵脑中有运动会、接力棒和加油声，却在文档第一行写了又删，时间过去后仍然空白，最后思考从哪一幕开始。",
        story: "小朵脑子里有运动会、接力棒和加油声，可第一句话写了又删，十分钟过去还是空白。",
        frames: [
          { caption: "我明明有好多画面。", text: "她不是没素材，脑子里很热闹。" },
          { caption: "第一句话写不出来。", text: "真正卡住的是开头。" },
          { caption: "越想越着急。", text: "别人写了半页，她还在第一行。" },
          { caption: "从哪一幕开始？", text: "还差一个挑开头画面的办法。" }
        ],
        question: "脑子里有很多画面时，哪一幕最适合当作文开头？"
      },
      {
        title: "我想做一个小游戏",
        user: "脑子里有游戏画面但说不清规则的同学",
        image: classroomPath("courseware/day1-track-project-comics/images/08-mini-game-rules.jpg"),
        imageAlt: "四格连环画：小宇画出小猫接星星小游戏，对电脑只说做个好玩的游戏，结果生成的方块乱跳，最后看着角色操作得分失败四张规则卡。",
        story: "小宇脑子里有“小猫接星星”，但只说“做个好玩的游戏”，结果出来的页面和想象完全不一样。",
        frames: [
          { caption: "我想做这个游戏！", text: "他脑子里有具体游戏画面。" },
          { caption: "这样说够清楚吗？", text: "只说了好玩，没有说规则。" },
          { caption: "这要怎么玩？", text: "做出来的东西和想象不一样。" },
          { caption: "规则要说哪几条？", text: "还差一个说清游戏规则的办法。" }
        ],
        question: "一个小游戏最少要说清哪几条规则？"
      },
      {
        title: "我的作文想变成漫画",
        user: "写完作文后想让故事更好看的同学",
        image: classroomPath("courseware/day1-track-project-comics/images/09-essay-comic.jpg"),
        imageAlt: "四格连环画：小雨写完运动会作文，同桌只记住跑步比赛，小雨脑中出现起跑、鞋带松、同学加油、冲过终点四幕，最后看着四个漫画空格。",
        story: "小雨写了满满一页运动会作文，可同桌只记住“跑步比赛”，没看见最精彩的几个画面。",
        frames: [
          { caption: "我写了很多。", text: "她真的完成了一篇作文。" },
          { caption: "精彩在哪一幕？", text: "别人没看见作文里的画面。" },
          { caption: "画面其实在这里。", text: "起跑、鞋带、加油、冲线都能画出来。" },
          { caption: "哪四格最精彩？", text: "还差一个把作文拆成漫画的办法。" }
        ],
        question: "你的作文里，哪四个时刻最适合画成漫画？"
      }
    ]
  },
  "campus-community": {
    pageTitle: "家庭社区：帮身边的人少卡一步",
    intro: "家庭社区先看爸妈、爷爷奶奶、宠物和家人回忆里的真实麻烦。",
    projects: [
      {
        title: "周末安排总是挤在一起",
        user: "周末活动一多就容易漏安排的家庭",
        image: classroomPath("courseware/day1-track-project-comics/images/10-weekend-plan.svg"),
        imageAlt: "四格连环画：妈妈看见周末日历里塞满活动，餐桌上摆着要带的物品，车开到半路发现预约码没准备，孩子思考出门卡。",
        story: "周五晚上，妈妈要安排篮球课、去爷爷家和科学展。每件事都不难，可时间、地点和要带的东西散在不同消息里。",
        frames: [
          { caption: "周六有好多事。", text: "周末安排很满。" },
          { caption: "每件事都要带东西。", text: "活动多，物品也多。" },
          { caption: "预约码在哪？", text: "漏掉一个小东西，整件事就卡住。" },
          { caption: "出门前先看哪张卡？", text: "还差一个全家都能看的出门卡。" }
        ],
        question: "如果做一张周末出门卡，最该让家里人一眼看到什么？"
      },
      {
        title: "宠物照顾交接不清楚",
        user: "多人一起照顾宠物的家庭",
        image: classroomPath("courseware/day1-track-project-comics/images/11-pet-care-handoff.svg"),
        imageAlt: "四格连环画：全家出门前没人确定小狗是否吃饭，晚上发现漏喂，第二天又重复喂，孩子思考宠物照顾交接卡。",
        story: "家里的小狗豆豆要喂饭、换水、散步。家人都想照顾它，可一忙起来，谁做过、下一步谁做，很容易说不清。",
        frames: [
          { caption: "豆豆吃饭了吗？", text: "宠物每天都要照顾。" },
          { caption: "我以为你喂了。", text: "家里多人照顾时容易记混。" },
          { caption: "少一次、多一次都不行。", text: "交接不清会让宠物不舒服。" },
          { caption: "下一步谁来做？", text: "还差一张全家都能看见的照顾卡。" }
        ],
        question: "照顾宠物时，哪几件事最需要让全家看见？"
      },
      {
        title: "照片太多没人整理",
        user: "想留下孩子成长故事的家庭",
        image: classroomPath("courseware/day1-track-project-comics/images/12-family-photo-story.svg"),
        imageAlt: "四格连环画：爸爸打开密密麻麻的手机相册，妹妹想找骑车照片，外婆看不懂家族群里的照片，孩子思考怎样挑照片讲故事。",
        story: "爸爸想给外婆看妹妹这一年的变化，可相册里有几千张照片。照片不是没有，是太多太散，外婆看不出每张背后的故事。",
        frames: [
          { caption: "照片太多了。", text: "家里有很多照片，但找起来很乱。" },
          { caption: "我想讲这一次。", text: "孩子心里有想讲的故事。" },
          { caption: "这张是什么故事？", text: "只发照片，别人不一定看懂。" },
          { caption: "哪几张最值得留下？", text: "还差一个把照片变成故事的办法。" }
        ],
        question: "如果把 4 张照片做成成长故事，最该留下哪几个时刻？"
      }
    ]
  }
};

function trackProjectForPage(page: Pick<LessonPage, "title">) {
  return courseTrackExampleOrder.find((track) => trackProjectChoices[track].pageTitle === page.title) ?? null;
}

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
  cover: classroomPath("courseware/opening/future-studio-cover.webp"),
  vet: classroomPath("courseware/opening/future-pair-vet.webp"),
  robot: classroomPath("courseware/opening/future-pair-robot.webp"),
  space: classroomPath("courseware/opening/future-pair-space.webp")
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
	  | "track-map"
	  | "track-projects"
	  | "direction-question"
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
  | "business-loop"
  | "differentiation-canvas"
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
  studio: classroomPath("courseware/opening/future-studio-cover.webp"),
  space: classroomPath("courseware/opening/future-pair-space.webp"),
  vet: classroomPath("courseware/opening/future-pair-vet.webp"),
  robot: classroomPath("courseware/opening/future-pair-robot.webp")
};

const aiSketchnoteBasePath = classroomPath(
  "courseware/baoyu-ai-knowledge-sketchnote/slide-deck/day1-ai-basics-sketchnote"
);

const BUSINESS_MODEL_MODULE_ID = "business-model-canvas";

const businessModelSketchnoteBasePath = classroomPath("courseware/day2-business-model-canvas-sketchnote");

const entrepreneurshipDefinitionSlide = {
  src: classroomPath("courseware/day1-entrepreneurship-definition-sketchnote/01-entrepreneurship-definition.webp"),
  alt: "手绘课件：创业是什么？帮别人解决问题，产生价值交换。"
};

const aiJudgementSketchnoteSlides: Array<{
  page_no: number;
  title: string;
  page_type: LessonPage["page_type"];
  content_summary: string;
  image?: string;
  alt?: string;
  chips?: string[];
}> = [
  {
    page_no: 1,
    title: "AI 是一个会学习的大脑",
    page_type: "story",
    content_summary: "AI 能读文字、看图片、听声音，像电脑里的聪明大脑。",
    image: "01-slide-ai-brain.webp",
    alt: "手绘课件：机器人脑袋里有会学习的大脑，旁边标出能读文字、能看图片、能听声音"
  },
  {
    page_no: 2,
    title: "你给它任务，它开始工作",
    page_type: "story",
    content_summary: "孩子写下任务纸条，AI 收到线索后开始生成结果。",
    image: "02-slide-task-starts.webp",
    alt: "手绘课件：孩子把任务纸条送进 AI 大脑，AI 开始工作"
  },
  {
    page_no: 3,
    title: "照片也是线索",
    page_type: "demo",
    content_summary: "照片里的人物、表情、姿势，也能成为 AI 看懂的线索。",
    image: "03-slide-photo-clue.webp",
    alt: "手绘课件：AI 用放大镜看照片里的人物、表情和姿势"
  },
  {
    page_no: 4,
    title: "它以前看过很多例子",
    page_type: "demo",
    content_summary: "AI 学过很多照片、职业照、工具和场景，所以能按线索画新图。",
    image: "04-slide-many-examples.webp",
    alt: "手绘课件：AI 大脑周围围着很多职业和场景例子"
  },
  {
    page_no: 5,
    title: "三张线索卡，画出新画面",
    page_type: "demo",
    content_summary: "照片、职业、任务三张线索卡一起进入 AI，得到新的未来画面。",
    image: "05-slide-three-clues.webp",
    alt: "手绘课件：照片、职业、任务三张线索卡进入 AI，生成一张新的未来职业图"
  },
  {
    page_no: 6,
    title: "说清楚，AI 才好帮你",
    page_type: "demo",
    content_summary: "太短的问题容易跑偏，把职业、地点和动作说清楚，结果会更好。",
    image: "06-slide-clear-task.webp",
    alt: "手绘课件：对比太短的任务和说清楚的任务，右侧画面更具体"
  },
  {
    page_no: 7,
    title: "AI 画完，人来做导演",
    page_type: "demo",
    content_summary: "AI 给出结果后，孩子继续看线索、选一张、再修改。",
    image: "07-slide-human-director.webp",
    alt: "手绘课件：孩子像导演一样看 AI 生成的几张图，圈出线索并准备修改"
  },
  {
    page_no: 8,
    title: "先说清楚，让 AI 画一张",
    page_type: "experiment",
    content_summary: "把想画谁、在哪里、正在做什么说清楚，再让 AI 画第一张。",
    image: "08-slide-first-image-task.webp",
    alt: "手绘课件：用未来的我、动物医院、给小狗检查三个信息组成清楚任务"
  },
  {
    page_no: 10,
    title: "先说清楚：你想画什么？",
    page_type: "experiment",
    content_summary: "每个人用一句话说：画里有谁、在哪里、正在做什么，还想加一个细节。",
    image: "10-slide-say-your-picture.webp",
    alt: "手绘课件：孩子用一句话说清自己想画的未来职业图，画里有谁、在哪里、正在做什么和想加的细节",
    chips: ["说人物", "说地方", "说动作", "加细节"]
  },
  {
    page_no: 11,
    title: "打开 WorkBuddy，画一张自己的图",
    page_type: "experiment",
    content_summary: "把刚才说的话变成任务，生成一张图，再选一处继续改。",
    image: "11-slide-workbuddy-draw.webp",
    alt: "手绘课件：孩子打开自己的 WorkBuddy，把画面描述发出去，生成第一张图，再说清一处想修改的细节",
    chips: ["打开 WorkBuddy", "发出任务", "生成图片", "继续修改"]
  }
];

const businessModelSketchnoteSlides: Array<{
  page_no: number;
  title: string;
  page_type: LessonPage["page_type"];
  content_summary: string;
  image: string;
  alt: string;
  chips?: string[];
}> = [
  {
    page_no: 1,
    title: "这些算产品吗？",
    page_type: "story",
    content_summary: "先看高德地图、微信、Teams、水杯、台灯和单词游戏，判断哪些算产品。",
    image: "01-slide-product-or-not.webp",
    alt: "手绘课件：六个熟悉例子让孩子判断哪些算产品",
    chips: ["产品", "例子", "判断"]
  },
  {
    page_no: 2,
    title: "谁最需要它？",
    page_type: "story",
    content_summary: "把产品和真正会用它的人连起来，理解用户不是所有人。",
    image: "02-slide-who-uses-it.webp",
    alt: "手绘课件：把高德地图、Teams 和单词游戏分别连到赶路的人、上课的人和背单词的人",
    chips: ["用户", "连线", "具体的人"]
  },
  {
    page_no: 3,
    title: "为什么愿意交换？",
    page_type: "story",
    content_summary: "用水杯、单词游戏和安全提醒理解商业是有用的帮助加公平交换。",
    image: "03-slide-what-is-business.webp",
    alt: "手绘课件：有用的帮助和公平交换组成商业",
    chips: ["商业", "帮助", "交换"]
  },
  {
    page_no: 4,
    title: "小怪兽第一天很火",
    page_type: "story",
    content_summary: "用单词小怪兽故事看见，一个好产品刚出现时为什么会受欢迎。",
    image: "04-slide-word-monster-story.webp",
    alt: "手绘课件：单词小怪兽游戏第一天很多孩子围着玩",
    chips: ["故事", "新鲜", "有人用"]
  },
  {
    page_no: 5,
    title: "第三天，没人来了",
    page_type: "story",
    content_summary: "同一个游戏第三天没人继续玩，引出商业模式要让帮助可持续。",
    image: "05-slide-why-no-one-returns.webp",
    alt: "手绘课件：第三天单词小怪兽摊位前没人，孩子在想原因",
    chips: ["追问", "为什么", "可持续"]
  },
  {
    page_no: 6,
    title: "商业模式的 6 个问题",
    page_type: "demo",
    content_summary: "老师用 6 个简单问题演示怎么把一个产品想清楚。",
    image: "06-slide-six-questions.webp",
    alt: "手绘课件：商业模式画布被简化成六个孩子能回答的问题",
    chips: ["六个问题", "想清楚", "画布"]
  },
  {
    page_no: 7,
    title: "AI 会帮你问清楚",
    page_type: "demo",
    content_summary: "老师演示 AI 商业教练怎么继续追问用户、场景、价值和收费方式。",
    image: "07-slide-ai-coach-demo.webp",
    alt: "手绘课件：AI 商业教练围绕单词小怪兽追问用户、场景、价值和收费方式",
    chips: ["AI 教练", "追问", "补完整"]
  },
  {
    page_no: 8,
    title: "轮到你们的产品",
    page_type: "experiment",
    content_summary: "团队把自己的项目放进 6 个问题里，用 AI 帮忙追问和补充。",
    image: "08-slide-team-experiment.webp",
    alt: "手绘课件：孩子团队把自己的产品想法放进六个问题中讨论",
    chips: ["小组讨论", "问 AI", "补想法"]
  },
  {
    page_no: 9,
    title: "先帮一个具体的人",
    page_type: "demo",
    content_summary: "最后记住：先帮一个具体的人，再想怎么让这个帮助可持续。",
    image: "09-slide-takeaway.webp",
    alt: "手绘课件：从一个具体的人出发，想清楚帮助和公平交换",
    chips: ["一个人", "一个麻烦", "可持续"]
  }
];

const fourCaseJourneyCoursewarePath = classroomPath("courseware/four-case-journey/index.html");

type CaseComicFrame = {
  image: string;
  caption: string;
  text: string;
  alt: string;
};

type CaseComicDeck = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ariaLabel: string;
  closing: {
    before: string;
    strong: string;
    after: string;
  };
  frames: CaseComicFrame[];
};

const doorChecklistComicFrames: CaseComicFrame[] = [
  {
    image: classroomPath("courseware/day1-door-checklist-comic-v2/images/01-door.webp"),
    caption: "彩笔带了吗？",
    text: "乐乐要出门了，妈妈一句提醒，让他突然想起今天可能还有东西没带。",
    alt: "乐乐在家门口正要出门，妈妈从厨房探头提醒。"
  },
  {
    image: classroomPath("courseware/day1-door-checklist-comic-v2/images/02-messy-notes.webp"),
    caption: "体育、科学、美术，全挤在一起了。",
    text: "课表、通知、作业要求都在不同地方，出门前一起冒出来。",
    alt: "课表、通知和作业本像纸片一样挤在乐乐脑袋旁边。"
  },
  {
    image: classroomPath("courseware/day1-door-checklist-comic-v2/images/03-art-class.webp"),
    caption: "我不是故意忘的，是早上想不全。",
    text: "到了美术课才发现彩笔没带。他不是不认真，是早上信息太乱。",
    alt: "美术课上，乐乐发现没带彩笔，同桌递给他几支。"
  },
  {
    image: classroomPath("courseware/day1-door-checklist-comic-v2/images/04-product.webp"),
    caption: "清单分三栏：带什么、查什么、到校先做什么。",
    text: "检查台只做一件事：把今天要带、要确认、到校先做的事摆清楚。",
    alt: "桌上的简单页面把课表和通知整理成清单。"
  },
  {
    image: classroomPath("courseware/day1-door-checklist-comic-v2/images/05-next-morning.webp"),
    caption: "东西带齐了，出门就不慌了。",
    text: "第二天他按清单看一遍，发现跳绳还在阳台，马上补上。",
    alt: "第二天，乐乐拿好跳绳和彩笔，安心出门。"
  }
];

const wordProblemComicFrames: CaseComicFrame[] = [
  {
    image: classroomPath("courseware/day1-word-problem-comic-v2/images/01-word-wall.webp"),
    caption: "字好多，我先看哪句？",
    text: "小宇不是怕数学，他是被一大段题目挡住了。",
    alt: "数学练习课上，小宇盯着一大段应用题，笔停在空中。"
  },
  {
    image: classroomPath("courseware/day1-word-problem-comic-v2/images/02-start-stuck.webp"),
    caption: "我不是不会算，是不知道怎么开始。",
    text: "别人已经开始算，他还没找到第一步，越看越急。",
    alt: "同桌已经开始写算式，小宇的草稿纸上只有乱线和擦痕。"
  },
  {
    image: classroomPath("courseware/day1-word-problem-comic-v2/images/03-wrong-guess.webp"),
    caption: "乱猜一步，后面更乱。",
    text: "随便猜一个算式，写到后面就发现对不上。",
    alt: "小宇随便写了一步，又皱眉用橡皮擦掉。"
  },
  {
    image: classroomPath("courseware/day1-word-problem-comic-v2/images/04-product-cards.webp"),
    caption: "先把题目摆整齐。",
    text: "拆题板不直接给答案，只把题目拆成能看清的四块。",
    alt: "应用题拆题板把长题整理成谁、已知、要求、第一步四张卡。"
  },
  {
    image: classroomPath("courseware/day1-word-problem-comic-v2/images/05-start-solving.webp"),
    caption: "不是给答案，是帮我开始。",
    text: "看见第一步以后，小宇终于可以自己动笔了。",
    alt: "小宇看着第一步卡片，开始自己写算式。"
  }
];

const caseComicDecks: Record<string, CaseComicDeck> = {
  "故事：上学出门检查台": {
    eyebrow: "上学出门检查台",
    title: "早上出门前，脑子突然乱了",
    subtitle: "这个早上的小麻烦，可以做成一个小工具。",
    ariaLabel: "上学出门检查台连环画",
    closing: { before: "先帮乐乐", strong: "少慌一次", after: "就是一个产品的开始。" },
    frames: doorChecklistComicFrames
  },
  "生活帮手：上学出门检查台": {
    eyebrow: "上学出门检查台",
    title: "早上出门前，脑子突然乱了",
    subtitle: "这个早上的小麻烦，可以做成一个小工具。",
    ariaLabel: "上学出门检查台连环画",
    closing: { before: "先帮乐乐", strong: "少慌一次", after: "就是一个产品的开始。" },
    frames: doorChecklistComicFrames
  },
  "生活帮手：上学前 3 分钟检查台": {
    eyebrow: "上学前 3 分钟检查台",
    title: "早上出门前，脑子突然乱了",
    subtitle: "这个早上的小麻烦，可以做成一个小工具。",
    ariaLabel: "上学前 3 分钟检查台连环画",
    closing: { before: "先帮乐乐", strong: "少慌一次", after: "就是一个产品的开始。" },
    frames: doorChecklistComicFrames
  },
  "学习工具：应用题拆题板": {
    eyebrow: "应用题拆题板",
    title: "字太多，小宇不知道先看哪句",
    subtitle: "这一步卡住了，也可以做成一个小工具。",
    ariaLabel: "应用题拆题板连环画",
    closing: { before: "先帮小宇", strong: "迈出第一步", after: "就是一个产品的开始。" },
    frames: wordProblemComicFrames
  },
  "学习工具：长应用题第一步": {
    eyebrow: "长应用题第一步",
    title: "字太多，小宇不知道先看哪句",
    subtitle: "这一步卡住了，也可以做成一个小工具。",
    ariaLabel: "长应用题第一步连环画",
    closing: { before: "先帮小宇", strong: "迈出第一步", after: "就是一个产品的开始。" },
    frames: wordProblemComicFrames
  }
};

const fourCaseJourneyModuleIds = new Set([
  "team-formation",
  "track-cases",
  "project-launch",
  "day1-reflection",
  "day2-kickoff",
  "ai-lab",
  "product-prototype",
  "tech-route",
  "tool-demo",
  "build-sprint",
  "user-testing",
  "demo-check",
  "roadshow-rehearsal",
  "value-experiment",
  "product-packaging",
  "brand-story",
  "rehearsal",
  "final-showcase",
  "awards-reflection"
]);

function fourCaseJourneyHref(moduleId: string) {
  return `${fourCaseJourneyCoursewarePath}?module=${encodeURIComponent(moduleId)}`;
}

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
    title: "故事：电脑里的聪明大脑",
    content_summary: "它看过很多文字和图片，所以能读懂线索，也能画出第一版画面。",
    kicker: "09:40-10:20 · 故事开场",
    chips: ["读懂文字", "看懂图片", "生成第一版"],
    page_type: "story"
  },
  2: {
    title: "故事：AI 先读懂你给的线索",
    content_summary: "你说清人物、地方、动作和细节，它更容易画出接近你想法的图。",
    kicker: "09:40-10:20 · 故事开场",
    chips: ["人物", "地方", "动作"],
    page_type: "story"
  },
  3: {
    title: "Demo：未来照相馆是这样画出来的",
    content_summary: "照片给样子，职业给方向，任务要求告诉 AI 要画成什么场景。",
    kicker: "09:40-10:20 · 老师演示",
    chips: ["照片", "职业", "任务要求"],
    page_type: "demo"
  },
  4: {
    title: "实验：先说清楚你想画什么",
    content_summary: "用一句话说清画里有谁、在哪里、正在做什么，还想加一个细节。",
    kicker: "09:40-10:20 · 轮到你实验",
    chips: ["说人物", "说地方", "说动作"],
    page_type: "experiment"
  },
  5: {
    title: "实验：打开 WorkBuddy 画一张自己的图",
    content_summary: "生成第一张图，再选一处想修改或增加的细节。",
    kicker: "09:40-10:20 · 轮到你实验",
    chips: ["打开 WorkBuddy", "生成图片", "继续修改"],
    page_type: "experiment"
  },
  6: {
    title: "实验：第一张不满意，就说清改哪里",
    content_summary: "AI 给出第一版后，人负责看、选、说出下一次怎么改。",
    kicker: "09:40-10:20 · 轮到你实验",
    chips: ["看结果", "找问题", "再修改"],
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
    chips: ["身边的人", "真实需要", "AI 帮设计"],
    steps: ["先从家里和身边观察", "找到不方便或不安全的一步", "用 AI 试设计、宣传和画布分析"],
    cards: [
      { title: "用户", text: "你想帮助的那个人" },
      { title: "需求", text: "他做一件事时卡住的一步" },
      { title: "产品", text: "能让这一步更安全或更省心的办法" },
      { title: "AI", text: "帮你画设计图、写宣传语、分析商业画布" }
    ]
  },
  "team-building": {
    icon: UsersRound,
    accent: "mint",
    chips: ["找队友", "起队名", "想队呼"],
    steps: ["找到今天的队友", "起一个队名", "想一句队呼"],
    cards: [
      { title: "队友", text: "今天一起做项目的人" },
      { title: "桌号", text: "找到自己的团队桌" },
      { title: "团队名", text: "短一点，好记一点" },
      { title: "队呼", text: "一句能一起喊出来的话" }
    ]
  },
  "problem-wall": {
    icon: StickyNote,
    accent: "coral",
    chips: ["找麻烦", "改成问题", "投线索"],
    steps: ["写下生活里的小麻烦", "改成“帮谁解决什么”", "把最想继续调查的线索贴上墙"],
    cards: [
      { title: "早上怕漏带", text: "谁每天出门前最容易慌？" },
      { title: "应用题太长", text: "哪一步让同学不敢开始？" },
      { title: "活动凑不齐人", text: "怎样让想参加的人找到同伴？" }
    ]
  },
  "ai-judgement": {
    icon: MessageSquareText,
    accent: "blue",
    chips: ["读懂文字", "看懂图片", "生成第一版"],
    steps: ["先认识电脑里的聪明大脑", "看它怎样根据线索生成", "轮到你说清一张图"],
    cards: [
      { title: "读字", text: "你写什么，它先读懂" },
      { title: "看图", text: "照片里的样子、动作和地方都是线索" },
      { title: "生成", text: "根据线索画出或写出第一版" },
      { title: "修改", text: "哪里不像、哪里还想加，由人说清楚" }
    ],
    flow: [
      { title: "说人物", text: "画里有谁" },
      { title: "说场景", text: "他在哪里、正在做什么" },
      { title: "说修改", text: "第一张出来后，再改一个细节" }
    ]
  },
  "workbuddy-webpage": {
    icon: Monitor,
    accent: "mint",
    chips: ["一句话", "可打开页面", "完成一步"],
    steps: ["先看小游戏跑起来", "再看出门检查台", "最后给网页一句清楚任务"],
    cards: [
      { title: "给谁用", text: "一个真实会遇到麻烦的人" },
      { title: "做什么", text: "打开页面后先完成一个动作" },
      { title: "看结果", text: "完成后看到一个有用结果" },
      { title: "可试玩", text: "别人能点开试一次" }
    ],
    flow: [
      { title: "用户", text: "给早上怕漏带的同学用" },
      { title: "动作", text: "粘贴课表和通知" },
      { title: "结果", text: "得到三栏出门清单" }
    ]
  },
  "track-cases": {
    icon: Route,
    accent: "sun",
    chips: ["家里", "学校", "社区"],
    steps: ["先看身边的人怎么做事", "圈出最想帮的一个人", "写下第一句要问的话"],
    cards: [
      { title: "先看人", text: "家人、同学、邻居，谁在做事时卡住" },
      { title: "再看需要", text: "这件事是不是经常发生，能不能变安全或省心" },
      { title: "圈一个", text: "选你们最想继续问的人" },
      { title: "AI 能帮什么", text: "先做设计图、宣传语、商业画布分析" }
    ],
    flow: [
      { title: "看见", text: "谁在什么地方卡住了" },
      { title: "选择", text: "我们最想帮哪一个人" },
      { title: "提问", text: "先问一句真人会回答的话" }
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
    chips: ["故事卡点", "豆包出三版", "DeepSeek 检查"],
    steps: ["先看四个项目为什么收到空话", "老师用真实模型输出做对比", "小组写自己的 AI 任务单"],
    cards: [
      { title: "故事", text: "AI 不知道帮谁、哪一步、什么结果，就只能写空话" },
      { title: "Demo", text: "出门检查、拆题第一步、作文漫画、小课卡都用真实输出对比" },
      { title: "实验", text: "把团队作品写成一张可复用任务单" }
    ],
    flow: [
      { title: "模糊", text: "帮我做个好产品" },
      { title: "清楚", text: "给一个固定项目写清用户、动作和结果" },
      { title: "检查", text: "删掉没证据的话，留下能放进作品的一句" }
    ]
  },
  "product-prototype": {
    icon: Hammer,
    accent: "coral",
    chips: ["按钮太多", "先救一步", "MVP"],
    steps: ["先看用户第一步为什么卡住", "老师把大产品砍成小动作", "团队圈出第一个能试玩的动作"],
    cards: [
      { title: "故事", text: "12 个按钮挤在第一屏，用户不知道先点哪里" },
      { title: "Demo", text: "四个赛道都先留下一个能试玩的小动作" },
      { title: "实验", text: "留下 30 秒能看懂、能试玩的一步" }
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
    chips: ["接待员", "小轨道", "可打开页面"],
    steps: ["看用户进门问什么", "老师给产品装一个接待员", "小组让 V1 打开一次"],
    cards: [
      { title: "故事", text: "用户只问一句，作品要接得住" },
      { title: "Demo", text: "扣子负责接待，工作流负责按步骤办事" },
      { title: "实验", text: "秒哒把一句话变成能打开的 V1" }
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
  [BUSINESS_MODEL_MODULE_ID]: {
    icon: Coins,
    accent: "sun",
    chips: ["产品", "用户", "交换"],
    steps: ["先判断什么是产品", "用故事看懂商业模式", "让 AI 商业教练追问一轮"],
    cards: [
      { title: "产品", text: "能帮人完成一件事的东西或服务" },
      { title: "用户", text: "真正会用它、需要它的人" },
      { title: "交换", text: "别人觉得有用，愿意拿时间、推荐或钱来换" }
    ]
  },
  "demo-check": {
    icon: Monitor,
    accent: "ink",
    chips: ["跑通一圈", "不一样一点", "愿意再来"],
    steps: ["把用户、麻烦、作品、结果连成一圈", "找出和原来办法不一样的地方", "用 2 分钟演示这一圈"],
    cards: [
      { title: "用户", text: "谁遇到这个麻烦" },
      { title: "入口", text: "他从哪里打开作品" },
      { title: "结果", text: "作品帮他少烦了什么" },
      { title: "差异化", text: "比原来的办法更省心、更好玩或更容易坚持" },
      { title: "交换", text: "他愿意用时间、星星币或推荐来换" }
    ]
  },
  "roadshow-rehearsal": {
    icon: ClipboardCheck,
    accent: "blue",
    chips: ["发布盒子", "作品链接", "发布 PPT"],
    steps: ["看发布盒子为什么乱", "老师用 WorkBuddy 排顺序", "小组交出轻巧材料包"],
    cards: [
      { title: "故事", text: "链接、截图、采访原话和分工都摊在桌上" },
      { title: "Demo", text: "整理成用户、问题、作品、证据、下一步" },
      { title: "实验", text: "只提交作品链接和发布 PPT" }
    ]
  },
  "value-experiment": {
    icon: Coins,
    accent: "sun",
    chips: ["星星币", "时间", "推荐"],
    steps: ["看同学会把星星币交给谁", "老师写一张价值小票", "小组说清别人为什么愿意换"],
    cards: [
      { title: "故事", text: "手里只有 3 枚星星币，会交给哪个作品" },
      { title: "Demo", text: "谁会用、少烦什么、愿意交换什么" },
      { title: "实验", text: "用真实试用说清价值" }
    ]
  },
  "product-packaging": {
    icon: Package,
    accent: "coral",
    chips: ["作品摊位", "3 秒看懂", "真实截图"],
    steps: ["看别人从摊位前走过", "老师把空口号换成产品卡", "小组摆好自己的作品摊位"],
    cards: [
      { title: "故事", text: "同学路过时，3 秒内要看懂帮谁" },
      { title: "Demo", text: "产品名、帮谁、怎么帮和截图放到一张卡" },
      { title: "实验", text: "写名字、标语、截图和三条亮点" }
    ]
  },
  "brand-story": {
    icon: Megaphone,
    accent: "green",
    chips: ["黄金圈", "为什么", "梦想"],
    steps: ["先讲为什么想做", "再演示怎么帮助别人", "最后说出做出了什么和下一步梦想"],
    cards: [
      { title: "为什么", text: "我们为什么想帮这个人" },
      { title: "怎么做", text: "我们用什么办法让他少一点麻烦" },
      { title: "做出了什么", text: "现场打开作品，让大家看到结果" },
      { title: "梦想", text: "如果继续做，我们希望它帮到更多谁" }
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
      { title: "想帮的人", text: "讲清谁真的需要" },
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
  "team-building": [
    { page_no: 1, title: "找到今天的队友", page_type: "teamwork", content_summary: "看见今天一起做项目的伙伴，先坐到同一张桌子。" },
    { page_no: 2, title: "起队名，再想一句队呼", page_type: "teamwork", content_summary: "队名短一点，队呼要能一起喊出来。" },
    { page_no: 3, title: "团队亮个相", page_type: "experiment", content_summary: "说出团队名和队呼，让全班记住你们。" }
  ],
  "workbuddy-webpage": [
    { page_no: 1, title: "一句话让小游戏跑起来", page_type: "story", content_summary: "输入一句话，浏览器里出现一个能玩的俄罗斯方块页面" },
    { page_no: 2, title: "它不只会做游戏", page_type: "demo", content_summary: "同样的能力也能做帮助别人的小页面" },
    { page_no: 3, title: "出门检查台跑一遍", page_type: "demo", content_summary: "给早上怕漏带的同学做一个粘贴课表和通知后生成出门清单的页面" },
    { page_no: 4, title: "给网页一句清楚任务", page_type: "experiment", content_summary: "说清给谁用、做什么、最后看到什么结果" },
    { page_no: 5, title: "第一版页面长什么样", page_type: "showcase", content_summary: "看见输入区、按钮和结果区怎样组成一个可试玩页面" }
  ],
  "team-formation": [
    { page_no: 1, title: "创业是什么？", page_type: "story", content_summary: "创业就是看见真实需要，做出办法帮助别人，并产生价值交换" },
    { page_no: 2, title: "先从家里找到需要", page_type: "story", content_summary: "爷爷看不懂手机消息，错过重要提醒，这就是一个可以观察的真实需要" },
    { page_no: 3, title: "生活帮手：爷爷看不懂手机消息", page_type: "story", content_summary: "先观察长辈看手机消息时卡在哪，再想怎样把消息讲清楚" },
    { page_no: 4, title: "学习工具：长应用题第一步", page_type: "story", content_summary: "长应用题一大段，先拆成能下手的几块" },
    { page_no: 5, title: "创意工坊：我的作文想变成漫画", page_type: "story", content_summary: "作文写了很多，先挑出 4 个关键画面" },
    { page_no: 6, title: "家庭社区：周末安排总是挤在一起", page_type: "story", content_summary: "周末事情一多，先看全家谁要去哪里、带什么、谁负责" },
    { page_no: 7, title: "AI 可以帮哪几步", page_type: "demo", content_summary: "AI 可以帮你画产品设计图、写宣传语，也可以用商业画布分析谁会用、哪里不一样、为什么值得" },
    { page_no: 8, title: "轮到你：写帮忙卡", page_type: "experiment", content_summary: "写下想帮谁、卡在哪、先帮哪一步、AI 可以帮哪一步" }
  ],
  "track-cases": [
    { page_no: 1, title: "从家里和身边找真实需要", page_type: "story", content_summary: "先看家人、同学、邻居做事时哪里不方便、不安全，圈出一个你最想帮的人。" },
    { page_no: 2, title: trackProjectChoices["life-helper"].pageTitle, page_type: "story", content_summary: "看 3 个家里和身边会发生的小麻烦，想想你最想帮谁" },
    { page_no: 3, title: trackProjectChoices["learning-tool"].pageTitle, page_type: "story", content_summary: "看 3 个学习里卡住的时刻，先找最想问清楚的一步" },
    { page_no: 4, title: trackProjectChoices["creative-studio"].pageTitle, page_type: "story", content_summary: "看 3 个想法做不出来的时刻，先别急着给答案" },
    { page_no: 5, title: trackProjectChoices["campus-community"].pageTitle, page_type: "story", content_summary: "看 3 个家庭里会反复发生的小麻烦，找到你们想继续问的人" },
    { page_no: 6, title: "小组时间：选一个最想帮的小麻烦", page_type: "teamwork", content_summary: "从 12 个故事或自己的发现里选一个，说清想帮谁、麻烦在哪里发生" },
    { page_no: 7, title: "留下方向和一个问题", page_type: "experiment", content_summary: "今天先写下想帮谁、事情发生在哪里、你们最想问的一句话" }
  ],
  "project-launch": [
    { page_no: 1, title: "团队讨论：定下今天要做的项目", page_type: "teamwork", content_summary: "从刚才的故事和真实发现里，选一个最想继续做的小麻烦。" },
    { page_no: 2, title: "写清想帮的人", page_type: "teamwork", content_summary: "这个人是谁？什么时候会卡住？最烦的是哪一步？" },
    { page_no: 3, title: "产品一句话", page_type: "teamwork", content_summary: "我们做一个产品，帮谁在什么场景里少掉一个麻烦。" },
    { page_no: 4, title: "把团队方向放上来", page_type: "experiment", content_summary: "放上团队名、主赛道、想帮谁、卡点和产品一句话。" }
  ],
  "problem-wall": [
    { page_no: 1, title: "团队讨论：生活小麻烦", page_type: "teamwork", content_summary: "每个人先写一个真实遇到过的小麻烦" },
    { page_no: 2, title: "抓一张最想追的线索", page_type: "teamwork", content_summary: "团队把小麻烦写成谁、在哪、卡在哪" },
    { page_no: 3, title: "这个麻烦真的有人遇到吗？", page_type: "coaching", content_summary: "把人、地点和发生过的事说清楚" }
  ],
  "user-interview": [
    { page_no: 1, title: "团队分工：谁采访，谁记录", page_type: "teamwork", content_summary: "团队分好采访、记录、追问和整理责任" },
    { page_no: 2, title: "带着三问去采访", page_type: "teamwork", content_summary: "问对方真的发生过吗、多久一次、现在怎么解决" },
    { page_no: 3, title: "把听到的话带回来", page_type: "coaching", content_summary: "留下对方说过的原话，再决定下一步问什么" }
  ],
  "product-prototype": [
    { page_no: 1, title: "12 个按钮挤在第一屏", page_type: "story", content_summary: "四个项目都想做很多功能，可用户其实只想先完成一个动作" },
    { page_no: 2, title: "老师演示：先救一个动作", page_type: "demo", content_summary: "四个方向都先救一个动作：列出门清单、拆应用题第一步、挑作文画面、发布小课卡" },
    { page_no: 3, title: "这就是 MVP：先试最小一版", page_type: "demo", content_summary: "四个项目的 MVP 都很小，但每一个都能让别人试到结果" },
    { page_no: 4, title: "轮到你：把功能倒在桌面上", page_type: "teamwork", content_summary: "先把想做的功能都摊开，再找最先能动的那一块" },
    { page_no: 5, title: "圈出第一个能被试玩的动作", page_type: "teamwork", content_summary: "圈出 30 秒能看懂、能操作、能看到结果的第一个动作" }
  ],
  "ai-lab": [
    { page_no: 1, title: "四个项目都收到空话", page_type: "story", content_summary: "四个方向各派一个项目来问 AI，结果都卡在同一个地方：任务单没说清楚" },
    { page_no: 2, title: "老师演示：同一个项目，说清楚再问", page_type: "demo", content_summary: "同一个项目，把问法说清楚，AI 就能交出能继续做的材料" },
    { page_no: 3, title: "AI 第一版，先挑能用的", page_type: "demo", content_summary: "四个项目都拿到 AI 第一版，孩子留下能用的，划掉没证据的" },
    { page_no: 4, title: "DeepSeek 当检查员", page_type: "demo", content_summary: "让 DeepSeek 帮四个项目找出太大、没证据、今天做不到的句子" },
    { page_no: 5, title: "轮到你：写一张 AI 任务单", page_type: "experiment", content_summary: "把自己小组的项目写成五句话，让 AI 交出一段马上能用的材料" }
  ],
  "brand-story": [
    { page_no: 1, title: "上台先讲为什么", page_type: "story", content_summary: "观众先想知道：你为什么要帮这个人，为什么这件事值得做" },
    { page_no: 2, title: "黄金圈：为什么、怎么做、做出了什么", page_type: "demo", content_summary: "先讲为什么，再讲怎么帮，最后展示做出了什么" },
    { page_no: 3, title: "老师演示：把作品讲成黄金圈", page_type: "demo", content_summary: "用一个项目示范：从一句信念开始，再演示作品，最后说证据和下一步" },
    { page_no: 4, title: "讲出我们的信念和梦想", page_type: "teamwork", content_summary: "用孩子自己的话写一句：我们相信什么，我们希望帮到谁" },
    { page_no: 5, title: "轮到你：写黄金圈路演稿", page_type: "experiment", content_summary: "写下为什么想做、看见谁、怎么帮、做出了什么和最后邀请", activity_buttons: ["发布任务", "启动计时"] },
    { page_no: 6, title: "路演问答：听懂问题再回答", page_type: "teamwork", content_summary: "听清观众问的是什么，再用作品、证据和下一步回答" }
  ],
  "demo-check": [
    { page_no: 1, title: "一圈才算跑通", page_type: "story", content_summary: "用户不是看一眼就结束。要看他从遇到麻烦，到打开作品、得到结果、愿意再来，能不能连成一圈" },
    { page_no: 2, title: "老师演示：商业闭环小地图", page_type: "demo", content_summary: "用一个项目画一圈：谁卡住、怎么打开、先做哪一步、看到什么结果、愿意拿什么来换" },
    { page_no: 3, title: "乔布斯式差异化画布", page_type: "demo", content_summary: "不只是功能多，而是让用户记住一个不一样的体验：更省心、更好玩，或者更容易坚持" },
    { page_no: 4, title: "轮到你：把作品连成一圈", page_type: "teamwork", content_summary: "把自己作品的用户、麻烦、入口、动作、结果、交换和一个不一样的点写清楚", activity_buttons: ["发布任务", "启动计时"] },
    { page_no: 5, title: "2 分钟 Demo：照着这一圈讲", page_type: "showcase", content_summary: "演示时按这一圈走：用户进来，作品帮上忙，结果出现，最后说出哪里不一样", activity_buttons: ["全屏演示"] },
    { page_no: 6, title: "AI 跑偏怎么改回来", page_type: "experiment", content_summary: "写下一次让 AI 改得更清楚的方法", activity_buttons: ["发布任务"] },
    { page_no: 7, title: "明天发布会要带什么", page_type: "teamwork", content_summary: "准备链接、截图、商业闭环小地图、差异化亮点和分工", activity_buttons: ["发布任务"] }
  ],
  "roadshow-rehearsal": [
    { page_no: 1, title: "发布盒子里乱成一团", page_type: "story", content_summary: "作品链接、截图、采访原话和分工纸条都在桌上，先排出上台顺序" },
    { page_no: 2, title: "老师演示：WorkBuddy 整理发布盒子", page_type: "demo", content_summary: "把材料交给 WorkBuddy 分堆，再由团队删掉不真实、太长、没用的句子" },
    { page_no: 3, title: "一页只讲一件事", page_type: "demo", content_summary: "发布 PPT 不塞满，一页只帮观察员看懂一件事" },
    { page_no: 4, title: "轮到你：交出发布盒子", page_type: "experiment", content_summary: "把作品链接、发布 PPT、证据和上台分工一起装进发布盒子" }
  ],
  "final-showcase": [
    { page_no: 1, title: "作品发布会开场", page_type: "showcase", content_summary: "每组把作品、用户和下一步讲给观察员" },
    { page_no: 2, title: "每组 5 分钟作品发布", page_type: "showcase", content_summary: "让大家看到用户怎么用、结果是什么" },
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

function pagesFromSeeds(moduleId: string, seeds: LessonPageSeed[]): LessonPage[] {
  return seeds.map((seed) => ({
    id: `${moduleId}-${seed.page_no}`,
    module_id: moduleId,
    page_no: seed.page_no,
    title: seed.title,
    page_type: seed.page_type,
    activity_buttons: seed.activity_buttons ?? [],
    content_summary: seed.content_summary
  }));
}

function fallbackCourseModule(
  id: string,
  day: number,
  sequence: number,
  title: string,
  subtitle: string,
  timeRange: string
): CourseModule {
  return {
    id,
    day,
    sequence,
    title,
    subtitle,
    time_range: timeRange,
    status: "READY",
    pages: pagesFromSeeds(id, fallbackLessonPages[id] ?? [])
  };
}

function normalizeCourseModules(modules: CourseModule[]) {
  const normalized = modules
    .map((module) => {
      if (module.id === "future-photo-studio") {
        return {
          ...module,
          sequence: 1,
          time_range: "09:00-09:40"
        };
      }

      if (module.id === "team-building") {
        return {
          ...module,
          day: 1,
          sequence: 2,
          title: "组建团队",
          subtitle: "找到队友，起队名和队呼",
          time_range: "09:40-10:00",
          pages: pagesFromSeeds(module.id, fallbackLessonPages["team-building"])
        };
      }

      if (module.id === "ai-judgement") {
        return {
          ...module,
          sequence: 3,
          time_range: "10:00-10:35"
        };
      }

      if (module.id === "workbuddy-webpage") {
        return {
          ...module,
          sequence: 4,
          time_range: "10:35-11:00"
        };
      }

      if (module.id === "team-formation") {
        return {
          ...module,
          sequence: 5,
          title: "从一个小麻烦开始",
          subtitle: "先从家里和身边看见真实需要",
          time_range: "11:00-11:50",
          pages: pagesFromSeeds(module.id, fallbackLessonPages["team-formation"])
        };
      }

      if (module.id === "track-cases") {
        return {
          ...module,
          sequence: 6,
          title: "选方向，找想帮的人",
          subtitle: "从家里、学校、社区找想帮的人",
          time_range: "13:30-14:20",
          pages: pagesFromSeeds(module.id, fallbackLessonPages["track-cases"])
        };
      }

      if (module.id === "project-launch") {
        return {
          ...module,
          sequence: 7,
          title: "定下项目方向",
          subtitle: "说清想帮谁，明天先做哪一步",
          time_range: "14:20-15:10",
          pages: pagesFromSeeds(module.id, fallbackLessonPages["project-launch"])
        };
      }

      if (module.id === "tech-route") {
        return {
          ...module,
          sequence: 4,
          time_range: "11:40-12:00"
        };
      }

      if (module.id === BUSINESS_MODEL_MODULE_ID) {
        return {
          ...module,
          day: 2,
          sequence: 3.5,
          title: "商业模式画布",
          subtitle: "用 AI 商业教练，把产品、用户和交换想清楚",
          time_range: "11:10-11:40",
          pages: pagesFromSeeds(module.id, fallbackLessonPages[BUSINESS_MODEL_MODULE_ID] ?? [])
        };
      }

      return module;
    });

  if (!normalized.some((module) => module.id === "team-building")) {
    normalized.push(
      fallbackCourseModule(
        "team-building",
        1,
        2,
        "组建团队",
        "找到队友，起队名和队呼",
        "09:40-10:00"
      )
    );
  }

  if (!normalized.some((module) => module.id === "workbuddy-webpage")) {
    normalized.push(
      fallbackCourseModule(
        "workbuddy-webpage",
        1,
        4,
        "WorkBuddy 变网页",
        "看一句话怎样变成能点开的页面",
        "10:35-11:00"
      )
    );
  }

  if (!normalized.some((module) => module.id === BUSINESS_MODEL_MODULE_ID)) {
    normalized.push(
      fallbackCourseModule(
        BUSINESS_MODEL_MODULE_ID,
        2,
        3.5,
        "商业模式画布",
        "用 AI 商业教练，把产品、用户和交换想清楚",
        "11:10-11:40"
      )
    );
  }

  return normalized.sort((a, b) => a.day - b.day || a.sequence - b.sequence);
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
    flow: design?.flow,
    slide_image: module.id === "team-formation" && page.page_no === 1 ? entrepreneurshipDefinitionSlide : undefined
  };
}

function aiSketchnoteLessonPages(module: CourseModule, base: LessonPage): DesignedLessonPage[] {
  const design = moduleDesigns[module.id];
  return aiJudgementSketchnoteSlides.map((slide) => ({
    ...base,
    id: `ai-judgement-sketchnote-${slide.page_no}`,
    page_no: slide.page_no,
    title: slide.title,
    page_type: slide.page_type,
    activity_buttons: slide.page_type === "experiment" ? ["发布任务", "全屏演示"] : ["全屏演示"],
    content_summary: slide.content_summary,
    kicker: `${module.time_range || `D${module.day}`} · ${
      slide.page_type === "experiment" ? "轮到你实验" : slide.page_type === "demo" ? "老师演示" : "故事开场"
    }`,
    chips:
      slide.chips ??
      (slide.page_type === "experiment"
        ? ["说清楚", "找问题", "再修改"]
        : slide.page_type === "demo"
          ? ["看线索", "看变化", "借方法"]
          : ["看画面", "猜原因", "听解密"]),
    visual: visualForPage({ ...base, page_type: slide.page_type }),
    accent: design?.accent ?? "ink",
    cards: design?.cards,
    steps: design?.steps,
    flow: design?.flow,
    slide_image:
      slide.image && slide.alt
        ? {
            src: `${aiSketchnoteBasePath}/${slide.image}`,
            alt: slide.alt
          }
        : undefined
  }));
}

function businessModelLessonPages(module: CourseModule, base: LessonPage): DesignedLessonPage[] {
  const design = moduleDesigns[module.id];
  return businessModelSketchnoteSlides.map((slide) => ({
    ...base,
    id: `business-model-sketchnote-${slide.page_no}`,
    page_no: slide.page_no,
    title: slide.title,
    page_type: slide.page_type,
    activity_buttons: slide.page_type === "experiment" ? ["发布任务", "全屏演示"] : ["全屏演示"],
    content_summary: slide.content_summary,
    kicker: `${module.time_range || `D${module.day}`} · ${
      slide.page_no <= 3
        ? "开头互动"
        : slide.page_type === "experiment"
          ? "轮到你实验"
          : slide.page_type === "demo"
            ? "老师演示"
            : "故事开场"
    }`,
    chips: slide.chips ?? ["看画面", "想一想", "说出来"],
    visual: visualForPage({ ...base, page_type: slide.page_type }),
    accent: design?.accent ?? "amber",
    cards: design?.cards,
    steps: design?.steps,
    flow: design?.flow,
    slide_image: {
      src: `${businessModelSketchnoteBasePath}/${slide.image}`,
      alt: slide.alt
    }
  }));
}

function coursewarePages(module: CourseModule | null | undefined): DesignedLessonPage[] {
  if (!module) return [];
  const modulePages = module.pages.length ? module.pages : fallbackPagesFor(module);
  if (module.id === "ai-judgement") {
    const base = modulePages[0] ?? {
      id: "ai-judgement-page",
      module_id: module.id,
      page_no: 1,
      title: module.title,
      page_type: "story",
      activity_buttons: []
    };
    return aiSketchnoteLessonPages(module, base);
  }
  if (module.id === BUSINESS_MODEL_MODULE_ID) {
    const base = modulePages[0] ?? {
      id: "business-model-canvas-page",
      module_id: module.id,
      page_no: 1,
      title: module.title,
      page_type: "story",
      activity_buttons: []
    };
    return businessModelLessonPages(module, base);
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
      id: "future-photo-secret",
      page_no: 5,
      title: "照片怎么画出来",
      page_type: "experiment",
      activity_buttons: ["全屏演示"],
      content_summary: "AI 看照片，也读职业和任务，再画出新的未来想象照"
    }
  ] as DesignedLessonPage[];
}

function caseComicForPage(module: CourseModule, page: DesignedLessonPage) {
  if (module.id !== "team-formation") return null;
  return caseComicDecks[page.title] ?? null;
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
    "选一个方向，找到想帮的人": "每组选定方向和想帮的人",
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
    "老师演示：WorkBuddy 整理材料包": "每组知道怎样整理发布材料",
    "老师演示：整理成上台顺序": "每组知道怎样整理发布材料",
    "发布 PPT 只需要讲清五件事": "每组知道发布 PPT 的 5 页主线",
    "提交作品链接和发布 PPT": "每组只提交作品链接和发布 PPT",
    "给网页一句清楚任务": "每组写出给谁用、做什么、看到什么结果",
    "第一版页面长什么样": "每组知道第一版页面要有输入、按钮和结果",
    "选一条路，做自己的题": "每组先选一个方向和想帮的人",
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
  if (/发布/.test(page.title)) return 10;
  if (page.title.includes("作品秀") || page.title.includes("故事发布")) return 5;
  if (page.page_type === "teamwork") return 8;
  if (page.page_type === "coaching") return 5;
  if (page.page_type === "activity") return 8;
  if (page.page_type === "experiment") return 6;
  if (page.page_type === "showcase") return 3;
  return 4;
}

type LessonRhythmBeat = "story" | "demo" | "experiment" | "teamwork" | "coaching" | "showcase";

const lessonRhythmLabels: Record<LessonRhythmBeat, string> = {
  story: "故事",
  demo: "Demo",
  experiment: "实验",
  teamwork: "团队实践",
  coaching: "老师指导",
  showcase: "展示"
};

function lessonRhythmForModule(module: CourseModule, pages: DesignedLessonPage[]) {
  const order: LessonRhythmBeat[] = ["story", "demo", "experiment", "teamwork", "coaching", "showcase"];
  const counts = Object.fromEntries(order.map((beat) => [beat, 0])) as Record<LessonRhythmBeat, number>;

  pages.forEach((page) => {
    const beat = lessonBeatForPage(module, page) as LessonRhythmBeat;
    counts[beat] += 1;
  });

  const items = order
    .filter((beat) => counts[beat] > 0)
    .map((beat) => ({ beat, label: lessonRhythmLabels[beat], count: counts[beat] }));
  const hasKnowledgePath = counts.story > 0 && counts.demo > 0 && counts.experiment > 0;
  const hasHandsOn = counts.teamwork > 0 || counts.experiment > 0;
  const note = hasKnowledgePath
    ? "知识先看懂，马上动手试"
    : hasHandsOn
      ? "这一段以团队产出为主"
      : "这一段以展示和收束为主";

  return { items, note };
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
  if (page.module_id === "team-building") return "team_card";
  if (page.module_id === "workbuddy-webpage" || page.module_id === "track-cases") return "product_definition";
  if (/卡在哪里|卡点写清楚|需要帮/.test(page.title)) return "blocker_note";
  if (page.title.includes("下一次我怎么指挥 AI")) return "growth_reflection";
  if (/带走一个 AI 判断方法|AI 判断方法|AI 跑偏|改回来|问出第一条好问题|问 DeepSeek 一句清楚问题|留下能用的一句|给 DeepSeek 一张任务单|AI 的回答怎么用|你想画什么|打开 WorkBuddy|画一张自己的图/.test(page.title)) return "learning_reflection";
  if (/给贡献一个名字|五力证书|个人贡献|贡献卡|贡献被看见/.test(page.title)) return "contribution_card";
  if (/团队名片|团队名称和方向|团队名和方向卡|帮忙卡|给团队起名|起队名|队呼|找到你的桌号|找到队友|名字和方向|团队方向亮相/.test(page.title)) return "team_card";
  if (/AI 给答案，先看证据|AI 留下一句可疑答案|证据追踪|真假侦探实验|证据比声音更有力/.test(page.title)) return "ai_validation";
  if (/问题改写卡|把候选问题改清楚|AI 市场侦察卡|竞品观察三格/.test(page.title)) return "market_scout";
  if (/五句提示词卡|给自己的产品写五句提示词|写一张 AI 任务单|AI 任务单|改一版再试|对 AI 说：不对，再改/.test(page.title)) return "prompt_card";
  if (/团队讨论：功能全倒出来|功能先发散|团队列功能|功能倒在桌面|今天必须做出来|圈出第一个能被试玩的动作|只留下核心动作|选择核心动作|核心动作够小|最小可行产品|先试最小一版|明天要做出的第一版|先让一个动作动起来/.test(page.title)) return "feature_scope";
  if (/团队选择制作路线|今天选一条能完成的路|路线卡提交|画出用户使用流程|选择今天能完成的路线|画出今天能完成的路线|用户走 3 步|用户打开后第一步|3-5 步走到结果|流程图检查|工作流|智能体|接待员|小轨道/.test(page.title)) return "tech_route";
  if (/作品链接和发布 PPT|提交作品链接和发布 PPT|交出发布盒子|最终提交/.test(page.title)) return "final_showcase";
  if (/生成可打开的? V1|让 V1 打开一次|秒哒生成应用原型|一句话变成可打开页面|V1 保留下来|明天发布会要带什么/.test(page.title)) return "product_link";
  if (/给别组一条反馈/.test(page.title)) return "product_feedback";
  if (/反馈进作品|改出 V2|试玩互测|团队互测|反馈怎么进作品|V2 先改/.test(page.title)) return "iteration_plan";
  if (/帮别人少烦了什么|价值交换榜|定价三问|别人愿意交换|价值小票|星星币|为什么愿意换|商业闭环|作品连成一圈|愿意再来/.test(page.title)) return "value_card";
  if (/产品包装|产品海报|海报不是装饰|海报是在帮别人看懂|一张好产品卡|换一张让人看懂的卡|摆好自己的作品摊位|产品摊位预览|给产品一个名字|标语|卖点/.test(page.title)) return "product_packaging";
  if (/把作品讲成一个小故事|故事发布五步卡|故事发布五步|问答预演|结论、证据、下一步|用证据回答|追问卡|三明治|观察员举手|黄金圈|为什么想做|信念和梦想|路演稿|商业路演/.test(page.title)) return "story_pitch";
  if (/产品方案一句话|需求三问|选择创业方向|产品摊位开张|需求收集计划|方向和行动计划|团队方向卡|补齐行动计划|团队讨论：我们想帮谁|提交方向和行动计划|接下来要问什么|明天先帮哪一步|写一句网页任务|网页任务/.test(page.title)) return "product_definition";
  if (/作品发布|发布材料|发布盒子|作品秀|每组 5 分钟发布|每组 5 分钟作品发布|最终展示/.test(page.title)) return "final_showcase";
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
    moduleId === "team-building" ||
    moduleId === "team-formation" ||
    /团队名片|团队名称和方向|团队名和方向卡|帮忙卡|给团队起名|起队名|队呼|找到你的桌号|找到队友|名字和方向/.test(title)
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
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "product_link" ||
    payloadType === "product_link" ||
    (
      !isBlockerTask(camp) &&
      !isLearningReflectionTask(camp) &&
      (
        /作品链接|产品链接|真产品检查|作品页上线清单|产品原型|每组作品能打开|2 分钟 Demo|发布材料|发布盒子|生成可打开的? V1|让 V1 打开一次|秒哒生成应用原型|发布 PPT|V1 保留下来|明天发布会要带什么|最终提交/.test(title) ||
        ["build-sprint", "demo-check", "roadshow-rehearsal", "rehearsal"].includes(moduleId)
      )
    )
  );
}

function isBlockerTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return activityType === "blocker_note" || payloadType === "blocker_note" || (moduleId === "build-sprint" && /卡在哪里|卡点|需要帮/.test(title));
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
    (moduleId === "ai-lab" && /五句提示词|提示词卡|写一张 AI 任务单|AI 任务单|给自己的产品写五句提示词|改一版|再改|AI 初稿/.test(title)) ||
    /五句提示词|提示词卡|写一张 AI 任务单|AI 任务单|给自己的产品写五句提示词|改一版|再改|AI 初稿/.test(title)
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
    /团队讨论：功能全倒出来|功能先发散|功能清单|功能倒在桌面|团队列功能|今天必须做出来|核心动作|选择核心动作|最小可行产品|先试最小一版|MVP|明天要做出的第一版|先让一个动作动起来/.test(title)
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
    /技术路线|路线卡|用户流程|流程图|工作流|智能体|接待员|小轨道|今天能完成的路线|今天选一条能完成的路|用户打开后第一步|3-5 步走到结果|团队选择制作路线|画出用户使用流程/.test(title)
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
    (moduleId === "value-experiment" && /帮别人少烦了什么|价值交换|定价三问|价值小票|别人愿意交换|星星币|为什么愿意换/.test(title)) ||
    /价值卡|价值交换|价值小票|星星币|愿意交换|为什么愿意换|帮别人少烦了什么|商业闭环|作品连成一圈|愿意再来/.test(title)
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
    (moduleId === "product-packaging" && /产品包装|产品海报|海报不是装饰|海报是在帮别人看懂|一张好产品卡|换一张让人看懂的卡|摆好自己的作品摊位|产品摊位预览|给产品一个名字|标语|卖点/.test(title)) ||
    /产品海报卡|产品包装|产品海报|海报不是装饰|海报是在帮别人看懂|换一张让人看懂的卡|作品摊位|产品摊位预览|给产品一个名字/.test(title)
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
    (moduleId === "brand-story" && /故事发布五步卡|故事发布五步|把作品讲成一个小故事|问答预演|故事结构|用证据回答|最可能被问到|追问卡|三明治|观察员举手|黄金圈|为什么想做|信念和梦想|路演稿|商业路演/.test(title)) ||
    /故事发布五步卡|故事发布五步|故事结构|故事稿|把作品讲成一个小故事|结论、证据、下一步|用证据回答|观察员会追问|观察员举手|模拟追问|最可能被问到|追问卡|三明治|黄金圈|为什么想做|信念和梦想|路演稿|商业路演/.test(title)
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
    moduleId === "workbuddy-webpage" ||
    moduleId === "track-cases" ||
    /产品一句话|产品定义|把线索变成产品一句话|产品卡片|选一条赛道|真.{0,2}用户|想帮的人|赛道地图|选择创业方向|需求三问|产品方案一句话|需求收集计划|方向和行动计划|团队方向卡|补齐行动计划|接下来要问什么|明天先帮哪一步|明天先做哪一步|写一句网页任务|网页任务/.test(title)
  );
}

function isFinalShowcaseTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "final_showcase" ||
    payloadType === "final_showcase" ||
    moduleId === "final-showcase" ||
    /作品发布|作品展|最终展示|每组上场|交出发布盒子|最终提交/.test(title)
  ) && !isObserverScoreTask(camp) && !isStoryPitchTask(camp);
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
    (moduleId === "ai-judgement" && /DeepSeek|任务单|有用的一句|问真人|问同学|回答怎么用|太大太远|先放下|你想画什么|打开 WorkBuddy|画一张自己的图/.test(title)) ||
    (moduleId === "day1-reflection" && /带走一个 AI 判断方法|判断方法|收束/.test(title)) ||
    (moduleId === "demo-check" && /AI 跑偏|改回来|修正|反思/.test(title)) ||
    /带走一个 AI 判断方法|AI 判断方法|AI 跑偏|改回来|修正方法|给 DeepSeek 一张任务单|AI 的回答怎么用/.test(title)
  );
}

function isPeerFeedbackTask(camp: Camp | null) {
  const title = activeTaskTitle(camp);
  const moduleId = camp?.active_task?.module_id || "";
  const activityType = camp?.active_task?.activity_type || "";
  const payloadType = asText(camp?.active_task?.payload?.task_type);
  return (
    activityType === "product_feedback" ||
    payloadType === "product_feedback" ||
    (!isIterationPlanTask(camp) && (/给别组一条反馈|先看别人怎么用|试玩|试用|互测/.test(title) || moduleId === "user-testing"))
  );
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
        setModules(normalizeCourseModules(moduleResult.modules));
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
    setModules(normalizeCourseModules(moduleResult.modules));
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
    href: teacherLessonHref
  },
  workspace: {
    label: "团队空间",
    title: "团队空间",
    description: "看分组、角色、项目状态和团队当前材料。",
    href: teacherWorkspaceHref
  },
  progress: {
    label: "进度看板",
    title: "团队进度看板",
    description: "快速看到每组提交、卡点和需要现场支援的地方。",
    href: teacherProgressHref
  },
  students: {
    label: "学员与照片",
    title: "学员与照片",
    description: "维护学生账号，处理未来照相馆作品上墙。",
    href: teacherStudentsHref
  },
  submissions: {
    label: "课堂提交",
    title: "课堂提交汇总",
    description: "查看问题、提示词、路线、作品入口、反馈和迭代记录。",
    href: teacherSubmissionsHref
  },
  showcase: {
    label: "作品与评分",
    title: "作品与评分",
    description: "整理最终展示卡、观察员评分、分享链接和公开作品区。",
    href: teacherShowcaseAdminHref
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
  const parentScoreMode = isClassroomRoute(window.location.pathname, "parents") && searchParams.get("score");
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
  const publicRoute = isClassroomRoute(window.location.pathname, "parents") ? parentsHref : showcaseHref;
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
        <p>孩子们从真实问题出发，采访用户，做出产品原型，并在结营作品发布中展示自己的作品。</p>
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
          <span>结营作品发布</span>
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
                      发布 PPT
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
              <span>结营作品发布准备好后，家长可以在这里看到作品成果。</span>
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

function publicProjectUrl(projectId: string, route = isClassroomRoute(window.location.pathname, "parents") ? parentsHref : showcaseHref) {
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
  const heroLine = asText(finalItem?.payload.value_line) || showcaseItem?.one_liner || asText(packagingItem?.payload.slogan) || "这是一组正在被同学试用的 AI 产品原型。";
  const targetUser = asText(finalItem?.payload.target_user) || asText(definitionItem?.payload.target_user) || asText(packagingItem?.payload.target_user) || "想帮的人";
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
  const projectRoute = isClassroomRoute(window.location.pathname, "parents") ? parentsHref : showcaseHref;
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
          <a href={isClassroomRoute(window.location.pathname, "parents") ? parentsHref : showcaseHref}>回到作品展</a>
        </section>
      </main>
    );
  }

  return (
    <main className="public-project-page">
      <header className="project-hero">
        <a href={isClassroomRoute(window.location.pathname, "parents") ? parentsHref : showcaseHref}>返回作品展</a>
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
            发布 PPT
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
      ["队呼", asText(item.payload.team_chant)],
      ["方向", asText(item.payload.product_direction) || asText(item.payload.direction)],
      ["少烦了", asText(item.payload.less_trouble)],
      ["AI 帮哪步", asText(item.payload.ai_help_step)],
      ["愿意换", asText(item.payload.exchange_guess)],
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
    if (item.payload.golden_circle) {
      return [
        ["为什么", asText(item.payload.why_belief) || asText(item.payload.story_hook)],
        ["看见谁", asText(item.payload.who_problem) || asText(item.payload.user_scene)],
        ["怎么帮", asText(item.payload.how_help) || asText(item.payload.product_demo)],
        ["做出了什么", asText(item.payload.what_result) || asText(item.payload.proof_line)],
        ["邀请", asText(item.payload.dream_line) || asText(item.payload.invite_line)],
        ["问答预演", storyQaSummary(item.payload)]
      ];
    }
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
  const lessonRhythm = selectedModule ? lessonRhythmForModule(selectedModule, lessonPages) : null;
  const fourCaseDeckHref =
    selectedModule &&
    selectedModule.id !== "team-formation" &&
    selectedModule.id !== "track-cases" &&
    fourCaseJourneyModuleIds.has(selectedModule.id)
      ? fourCaseJourneyHref(selectedModule.id)
      : "";
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
    window.location.href = wallHref;
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
                  window.location.href = `${teacherLessonHref}?day=${module.day}&module=${encodeURIComponent(module.id)}`;
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
          active={view}
          onLogout={() => {
            onLoggedOut();
          }}
        />
        {view === "lesson" ? (
          <section className="lesson-panel">
            <div className="lesson-title">
              <div>
                <span className="eyebrow">现在这一段</span>
                <h1>{lessonModuleTitle(selectedModule)}</h1>
                <p>{lessonModuleSubtitle(selectedModule)}</p>
              </div>
              <div className="lesson-actions">
                {fourCaseDeckHref && (
                  <a className="secondary" href={fourCaseDeckHref} target="_blank" rel="noreferrer">
                    <ExternalLink size={18} />
                    新窗口打开 HTML 课件
                  </a>
                )}
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
            {lessonRhythm && (
              <div className="lesson-rhythm-row" aria-label="本环节结构">
                {lessonRhythm.items.map((item) => (
                  <span key={item.beat} className={`lesson-rhythm-chip ${item.beat}`}>
                    {item.label}
                    <strong>{item.count}</strong>
                  </span>
                ))}
                <span className="lesson-rhythm-note">{lessonRhythm.note}</span>
              </div>
            )}
            {actionMessage && <p className="hint">{actionMessage}</p>}
            {fourCaseDeckHref && (
              <section className="lesson-html-courseware" aria-label="四案例 HTML 课件">
                <div className="lesson-html-courseware-head">
                  <div>
                    <span className="eyebrow">四案例 HTML 课件</span>
                    <h2>从案例页开始讲这一段</h2>
                  </div>
                  <a className="secondary" href={fourCaseDeckHref} target="_blank" rel="noreferrer">
                    <ExternalLink size={18} />
                    放大授课
                  </a>
                </div>
                <iframe
                  key={fourCaseDeckHref}
                  src={fourCaseDeckHref}
                  title={`${lessonModuleTitle(selectedModule)}四案例 HTML 课件`}
                  loading="lazy"
                  allowFullScreen
                />
              </section>
            )}
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
          htmlCoursewareHref={fourCaseDeckHref || undefined}
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
    <details className="teacher-system-menu">
      <summary aria-label="打开系统菜单">
        <Menu size={18} />
        <span>系统菜单</span>
      </summary>
      <nav className="teacher-system-menu-panel" aria-label="系统菜单">
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
    </details>
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
  { key: "d3", label: "D3 发布" },
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
  "team-building": "d1",
  "team-formation": "d1",
  "problem-wall": "d1",
  "ai-judgement": "d1",
  "workbuddy-webpage": "d1",
  "track-cases": "d1",
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
  [BUSINESS_MODEL_MODULE_ID]: "d2",
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
      const [teamResult, studentResult] = await Promise.all([api.teams(), api.wall()]);
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
    asText(item.payload.core_action) ||
    asText(item.payload.first_version) ||
    asText(item.payload.success_signal) ||
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

function studentVisibleTeamMaterials(workspace: StudentWorkspace, limit = 6) {
  const preferredTypes = [
    "team_card",
    "problem_card",
    "market_scout",
    "user_voice",
    "product_definition",
    "prompt_card",
    "feature_scope",
    "tech_route",
    "product_link",
    "product_feedback",
    "iteration_plan",
    "value_card",
    "product_packaging",
    "story_pitch",
    "final_showcase"
  ];
  const seen = new Set<string>();
  return preferredTypes
    .map((type) => latestTeamSubmission(workspace, type))
    .filter((item): item is TaskSubmission => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => taskUpdatedAt(b).localeCompare(taskUpdatedAt(a)))
    .slice(0, limit);
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
  const teamChant = asText(latestTeamCard?.payload.team_chant);
  const launchLine = asText(latestTeamCard?.payload.launch_line);
  const memberNames = workspace.team_members.map((member) => member.nickname).filter(Boolean).join("、");
  const latestMaterials = studentVisibleTeamMaterials(workspace, 5);
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
            <b>队呼</b>
            {teamChant || "还在准备"}
          </span>
          <span>
            <b>亮相</b>
            {launchLine || "还在准备"}
          </span>
        </div>
      )}
      {latestMaterials.length ? (
        <div className="student-work-list student-team-material-list">
          <h3>本组最新材料</h3>
          {latestMaterials.map((item) => (
            <article key={item.id}>
              <span>{studentSubmissionLabel(item)}</span>
              <strong>{studentSubmissionTitle(item)}</strong>
              <small>{studentSubmissionLine(item)}</small>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">完成当前任务后，本组材料会出现在这里。</p>
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
    latestTeamSubmission(workspace, "feature_scope"),
    latestTeamSubmission(workspace, "tech_route"),
    latestTeamSubmission(workspace, "product_link"),
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
  if (firstMissing.key === "team_card") return "请小组先补一张团队名片：团队名和队呼。";
  if (firstMissing.key === "product_definition") return "请小组补齐方向和行动计划：帮谁、收集什么需求、明天先做哪一步。";
  if (!team.selected_problem_id && ["problem_card", "market_scout", "user_voice"].includes(firstMissing.key)) return "请小组先选出要继续调查的问题。";
  if (firstMissing.key === "market_scout") return "先补一张侦察卡：AI 改写、用户声音、已有方案、继续验证。";
  if (firstMissing.key === "user_voice") return `还差 ${Math.max(0, firstMissing.target - firstMissing.count)} 条用户声音，先补真实采访。`;
  if (firstMissing.key === "product_feedback") return `还差 ${Math.max(0, firstMissing.target - firstMissing.count)} 条互测反馈，安排别组打开作品试用。`;
  if (firstMissing.key === "iteration_plan") return "请小组把反馈分成必须改、建议改、暂不改，再定 V2 先改哪一处。";
  if (firstMissing.key === "value_card") return "请小组补一张价值卡：帮谁少烦了什么，别人愿意用什么交换。";
  if (firstMissing.key === "product_packaging") return "请小组补一张产品海报卡：产品名、标语、三个卖点、展示图。";
  if (firstMissing.key === "story_pitch") return "请小组补一张黄金圈路演稿：为什么想做、怎么帮、做出了什么和邀请。";
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
          const latestLabel = summary.latest_submission ? studentSubmissionLabel(summary.latest_submission) : "";
          const latestTitle = summary.latest_submission ? studentSubmissionTitle(summary.latest_submission) : "";
          const latestLine = summary.latest_submission ? studentSubmissionLine(summary.latest_submission) : "";
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
                  {summary.latest_submission
                    ? `${summary.latest_submission.student_name || "学生"}：${latestLabel} · ${latestTitle}${latestLine && latestLine !== latestTitle ? `｜${latestLine}` : ""}`
                    : "还没有提交记录"}
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
          <span>成员名单由老师指定；队名和队呼由孩子提交团队名片后带入。</span>
        </div>
        <div className="team-problem-grid">
          {teams.map((team) => {
            const latestTeamCard = latestTeamCardFor(team);
            const latestDirectionPlan = latestDirectionFor(team);
            const childTeamName = asText(latestTeamCard?.payload.team_name);
            const teamChant = asText(latestTeamCard?.payload.team_chant);
            const aiHelpStep = asText(latestTeamCard?.payload.ai_help_step);
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
                <p><b>队呼</b>{teamChant || "还没提交"}</p>
                <p><b>产品方向</b>{productDirection || "还在讨论"}</p>
                <p><b>AI 先帮哪步</b>{aiHelpStep || "还在讨论"}</p>
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
          const isTeam = item.task_type === "team_card";
          const isProblem = item.task_type === "problem_card";
          const isScout = item.task_type === "market_scout";
          const isValidation = item.task_type === "ai_validation";
          const title = isProduct
            ? asText(item.payload.direction) || asText(item.payload.product_name) || "团队方向"
            : isTeam
            ? asText(item.payload.team_name) || item.team_name || "团队名片"
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
                isTeam ? "team-card" : "",
                isScout ? "scout" : "",
                isValidation ? "validation" : "",
                !isProduct && !isTeam && !isProblem && !isScout && !isValidation ? "voice" : "",
                item.status === "ON_WALL" ? "on-wall" : ""
              ].filter(Boolean).join(" ")}
              key={item.id}
            >
              <header>
                <div>
                  <span>{isProduct ? "方向和行动计划" : isTeam ? "团队名片" : isProblem ? "问题卡" : isScout ? "侦察卡" : isValidation ? "验证卡" : "用户声音"}</span>
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
              ) : isTeam ? (
                <div className="artifact-lines">
                  <p><strong>团队名：</strong>{asText(item.payload.team_name) || "还没写"}</p>
                  <p><strong>成员：</strong>{asText(item.payload.team_members) || "还在集合"}</p>
                  <p><strong>队呼：</strong>{asText(item.payload.team_chant) || "还没写"}</p>
                  {asText(item.payload.ai_help_step) && <p><strong>AI 帮哪步：</strong>{asText(item.payload.ai_help_step)}</p>}
                  <p><strong>亮相：</strong>{asText(item.payload.launch_line) || "还在准备"}</p>
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
            <small>{summary.target_user || "想帮的人"} · {summary.trouble || "值得继续调查"}</small>
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
            !targetUser ? "缺想帮的人" : /大家|所有人|全部人|所有用户/.test(targetUser) ? "用户还可以更具体" : "",
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
                  <span>{item.payload.golden_circle ? "黄金圈路演稿" : "故事发布五步卡"}</span>
                  <strong>{asText(item.payload.product_name) || "未命名作品"}</strong>
                  <small>{item.team_name || item.student_name || "学生提交"}</small>
                </div>
                <button disabled={workingId === item.id} onClick={() => toggleWall(item)}>
                  {item.status === "ON_WALL" ? "从大屏移开" : "放到大屏"}
                </button>
              </header>
              <div className="artifact-lines">
                <p><strong>{item.payload.golden_circle ? "为什么：" : "开头："}</strong>{asText(item.payload.why_belief) || asText(item.payload.story_hook) || "还没写"}</p>
                <p><strong>{item.payload.golden_circle ? "看见谁：" : "人物："}</strong>{asText(item.payload.who_problem) || asText(item.payload.user_scene) || "还没写"}</p>
                <p><strong>{item.payload.golden_circle ? "怎么帮：" : "作品："}</strong>{asText(item.payload.how_help) || asText(item.payload.product_demo) || "还没写"}</p>
                <p><strong>{item.payload.golden_circle ? "做出了什么：" : "证据："}</strong>{asText(item.payload.what_result) || asText(item.payload.proof_line) || "还没写"}</p>
                <p><strong>邀请：</strong>{asText(item.payload.dream_line) || asText(item.payload.invite_line) || "还没写"}</p>
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
        <h2>D3 作品发布与作品展</h2>
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
                    <strong>发布 PPT：</strong>
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
    reason: (summary) => `能力标签：共情力。观察员看见了：${summary.highlights[0] || "他们能从别人的真实麻烦出发。"}`
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
  const parentShowcaseUrl = absoluteUrl(parentsHref);
  const classroomShowcaseUrl = absoluteUrl(showcaseHref);
  const wallUrl = absoluteUrl(wallHref);

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
          const url = absoluteUrl(publicProjectUrl(item.id, parentsHref));
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
  active,
  onLogout
}: {
  camp: Camp | null;
  students: Student[];
  teacher: TeacherAccount | null;
  active: TeacherView;
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
          <TeacherFunctionLinks active={active} />
          <a className="icon-link" href={wallHref} target="_blank" rel="noreferrer">
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
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editStudentNo, setEditStudentNo] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editAge, setEditAge] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editSavingId, setEditSavingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const visibleStudents = students;

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
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "添加失败");
    } finally {
      setSaving(false);
    }
  };

  const startEditStudent = (student: Student) => {
    setEditingId(student.id);
    setEditStudentNo(student.student_no || "");
    setEditNickname(student.nickname);
    setEditAge(student.age === undefined || student.age === null ? "" : String(student.age));
    setMessage("");
  };

  const cancelEditStudent = () => {
    setEditingId("");
    setEditStudentNo("");
    setEditNickname("");
    setEditAge("");
  };

  const saveStudentEdit = async (student: Student) => {
    const nextNickname = editNickname.trim();
    if (!nextNickname) {
      setMessage("昵称不能为空。");
      return;
    }
    const nextAge = editAge.trim() ? Number(editAge) : undefined;
    if (editAge.trim() && (!Number.isFinite(nextAge) || Number(nextAge) <= 0)) {
      setMessage("年龄要填数字。");
      return;
    }
    setEditSavingId(student.id);
    setMessage("");
    try {
      await api.saveStudents({
        id: student.id,
        student_no: editStudentNo.trim() || undefined,
        nickname: nextNickname,
        age: nextAge,
        photo_authorization: student.photo_authorization,
        projection_consent: student.projection_consent,
        public_showcase_consent: student.public_showcase_consent,
        team_id: student.team_id,
        display_status: student.display_status,
        username: student.username,
        account_status: student.account_status
      });
      setMessage(`已更新 ${nextNickname}。`);
      cancelEditStudent();
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setEditSavingId("");
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
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <section className="panel student-admin-panel">
      <div className="student-admin-heading">
        <div>
          <div className="panel-title">
            <UsersRound size={20} />
            <h2>学生名单</h2>
          </div>
          <p>这里就是照片墙会使用的名单。改这里，照片墙也会跟着用这份名单。</p>
        </div>
        <strong className="student-count-pill">{visibleStudents.length} 人</strong>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="student-admin-layout">
        <section className="student-roster-section" aria-labelledby="student-roster-title">
          <div className="student-list-title">
            <div>
              <span>本次营期</span>
              <h3 id="student-roster-title">全部学生</h3>
            </div>
            <small>照片墙按这份名单显示</small>
          </div>
          <div className="student-table roster-table">
            {visibleStudents.map((student) => {
              const isEditing = editingId === student.id;
              return (
                <div key={student.id} className={isEditing ? "student-row editing" : "student-row"}>
                  {isEditing ? (
                    <>
                      <input
                        value={editStudentNo}
                        onChange={(event) => setEditStudentNo(event.target.value)}
                        placeholder="学号"
                        aria-label="学号"
                      />
                      <input
                        value={editNickname}
                        onChange={(event) => setEditNickname(event.target.value)}
                        placeholder="昵称"
                        aria-label="昵称"
                      />
                      <input
                        value={editAge}
                        onChange={(event) => setEditAge(event.target.value)}
                        placeholder="年龄"
                        inputMode="numeric"
                        aria-label="年龄"
                      />
                      <div className="student-row-actions">
                        <button
                          className="student-action-icon save"
                          disabled={editSavingId === student.id}
                          onClick={() => void saveStudentEdit(student)}
                          aria-label={`保存${student.nickname}`}
                        >
                          {editSavingId === student.id ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
                        </button>
                        <button
                          className="student-action-icon"
                          disabled={editSavingId === student.id}
                          onClick={cancelEditStudent}
                          aria-label={`取消编辑${student.nickname}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span>{student.student_no || "--"}</span>
                      <strong>
                        {student.nickname}
                        {student.username && <small>账号 {student.username}</small>}
                      </strong>
                      <small>{statusText[student.display_status]}</small>
                      <div className="student-row-actions">
                        <button
                          className="student-action-icon"
                          disabled={Boolean(deletingId)}
                          onClick={() => startEditStudent(student)}
                          aria-label={`编辑${student.nickname}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="danger-icon"
                          disabled={deletingId === student.id}
                          onClick={() => deleteStudent(student)}
                          aria-label={`删除${student.nickname}`}
                        >
                          {deletingId === student.id ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            {!visibleStudents.length && <p className="empty">先加学员，照片墙会先出现他们的名字。</p>}
          </div>
        </section>
        <aside className="student-add-block" aria-label="添加学生">
          <div>
            <span>添加学生</span>
            <h3>新同学</h3>
          </div>
          <div className="student-form">
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="昵称" />
            <input value={age} onChange={(event) => setAge(event.target.value)} placeholder="年龄" inputMode="numeric" />
            <button disabled={saving} onClick={addStudent}>{saving ? "保存中" : "添加"}</button>
          </div>
        </aside>
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
  "workbuddy-webpage",
  "team-formation",
  BUSINESS_MODEL_MODULE_ID,
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
  const storyCardPages = new Set([
    "四个项目都收到空话",
    "老师演示：同一个项目，说清楚再问",
    "AI 第一版，先挑能用的",
    "DeepSeek 当检查员",
    "轮到你：写一张 AI 任务单",
    "12 个按钮挤在第一屏",
    "老师演示：先救一个动作",
    "这就是 MVP：先试最小一版",
    "轮到你：把功能倒在桌面上",
    "圈出第一个能被试玩的动作",
    "发布盒子里乱成一团",
    "老师演示：WorkBuddy 整理发布盒子",
    "一页只讲一件事",
    "轮到你：交出发布盒子",
    "星星币市场开张",
    "他为什么愿意换？",
    "老师演示：一张价值小票",
    "轮到你：写价值小票",
    "作品摊位开张了",
    "老师演示：换一张让人看懂的卡",
    "标语不是夸自己",
    "轮到你：摆好自己的作品摊位",
    "观察员举手了",
    "老师演示：DeepSeek 扮演观察员",
    "好回答像三明治",
    "轮到你：抽出 2 张追问卡",
    "用证据回答"
  ]);
  if (storyCardPages.has(page.title)) return null;

  if (module.id === "team-building") return "team-roles";

  if (module.id === "team-formation") {
    if (/为什么愿意换|价值交换|价格/.test(page.title)) {
      return "pricing-ticket";
    }
    return null;
  }
	  if (module.id === "workbuddy-webpage") return "product-browser";
	  if (module.id === "track-cases") {
	    if (trackProjectForPage(page)) return "track-projects";
	    if (/12 个小麻烦|家里和身边/.test(page.title)) return "track-map";
	    return "direction-question";
	  }
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
  if (module.id === "project-launch") return /方向墙|亮起来/.test(page.title) ? "direction-map" : "product-sentence";
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
  if (module.id === "demo-check" && /差异化|不一样/.test(page.title)) return "differentiation-canvas";
  if (module.id === "demo-check" && /一圈才算跑通|商业闭环|作品连成一圈/.test(page.title)) return "business-loop";
  if (module.id === "demo-check" || module.id === "rehearsal") return "demo-strip";
  if (module.id === "value-experiment") return "pricing-ticket";
  if (module.id === "product-packaging") return page.title.includes("清单") ? "launch-checklist" : "product-browser";
  if (module.id === "brand-story") return "story-spine";
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
    "V1 保留下来": "product-browser",
    "先看别人怎么用": "testing-board",
    "第一批用户来了": "testing-board",
    "老师演示：把一句反馈变成改动": "testing-board",
    "给别组一条反馈": "testing-board",
    "反馈进作品": "testing-board",
    "改出 V2": "testing-board",
    "2 分钟 Demo": "demo-strip",
    "用户、作品、结果连起来": "demo-strip",
    "明天发布会要带什么": "demo-strip",
    "每组作品能打开吗": "product-browser",
    "定价三问": "pricing-ticket",
    "别人愿意交换，是因为真的有用": "pricing-ticket",
    "价值不是喊出来的": "pricing-ticket",
    "老师演示：一张价值小票": "pricing-ticket",
    "轮到你：价值小票": "pricing-ticket",
    "价值交换榜": "pricing-ticket",
    "作品页上线清单": "launch-checklist",
    "海报是在帮别人看懂": "launch-checklist",
    "老师演示：一张好产品卡": "launch-checklist",
    "把作品讲成一个小故事": "story-spine",
    "故事发布五步卡": "story-spine",
    "问答预演": "story-spine",
    "好回答有三层": "story-spine",
    "选 2 个最可能被问到的问题": "story-spine",
    "用证据回答": "story-spine",
    "彩排开始": "demo-strip",
    "删掉一句多余的话": "demo-strip",
    "谁负责哪一步": "demo-strip",
    "最终提交": "roadshow-pack",
    "每组 5 分钟故事发布": "showcase-run",
    "作品秀开场": "showcase-run",
    "每组 5 分钟发布": "showcase-run",
    "观察员提问": "observer-cards",
    "看见亮点，给出下一步建议": "observer-cards",
    "家长观察员提问": "observer-cards",
    "观察员投票": "observer-cards",
    "五力证书": "five-forces",
    "带走自己的作品故事": "five-forces",
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
    "创业是什么？": ["真实麻烦", "帮别人", "价值交换"],
    "创业从帮助开始": ["用户", "需求", "产品"],
    "故事：上学出门检查台": ["早上想不全", "清单帮忙", "出门不慌"],
    "老师演示：上学出门检查台": ["用户", "需求", "第一步"],
    "别人为什么愿意换": ["价值交换", "星星币", "价格"],
    "轮到你：写帮忙卡": ["帮谁", "卡在哪", "少什么麻烦"],
    "一句话让小游戏跑起来": ["一句话", "能打开", "能操作"],
    "它不只会做游戏": ["换成真实麻烦", "完成一步", "浏览器体验"],
    "出门检查台跑一遍": ["课表和通知", "出门清单", "第一版页面"],
    "给网页一句清楚任务": ["给谁用", "做什么", "看结果"],
    "第一版页面长什么样": ["输入区", "按钮", "结果区"],
    "AI 市场侦察卡": ["用户声音", "已有方案", "继续验证"],
    "竞品观察三格": ["谁在用", "怎么解决", "哪里不同"],
    "先从家里找到需要": ["家人", "不安全", "真实需要"],
    "生活帮手：爷爷看不懂手机消息": ["手机消息", "讲成大白话", "下一步"],
    "生活帮手：上学前 3 分钟检查台": ["课表和通知", "出门清单", "少漏带"],
    "学习工具：长应用题第一步": ["长题卡住", "拆成四块", "先下手"],
    "创意工坊：我的作文想变成漫画": ["作文画面", "四格分镜", "自己改"],
    "家庭社区：周末安排总是挤在一起": ["去哪", "带什么", "谁负责"],
    "AI 可以帮哪几步": ["设计图", "宣传语", "商业画布"],
    "从家里和身边找真实需要": ["家里", "学校", "社区"],
    "12 个小麻烦，圈出你想帮的人": ["看谁卡住", "圈一个人", "带问题去问"],
    "生活帮手：先从家里找需要": ["老人手机消息", "出门怕漏带", "钱一下没了"],
    "学习工具：卡住时先看哪一步": ["长题看不懂", "错题找原因", "英语接不上"],
    "创意工坊：有想法但做不出来": ["作文开不了头", "规则说不清", "作文变漫画"],
    "家庭社区：帮身边的人少卡一步": ["周末安排", "宠物交接", "照片故事"],
    "小组时间：选一个最想帮的小麻烦": ["选故事", "想帮谁", "问细节"],
	    "留下方向和一个问题": ["选方向", "想帮谁", "先问什么"],
	    "12 个真实创业方向": ["生活帮手", "学习工具", "创意工坊", "家庭社区"],
    "作品可以有很多样子": ["浏览器打开", "作品卡片", "点击体验"],
    "真产品检查": ["能打开", "能完成动作", "能分享"],
    "定价三问": ["谁会用", "付出什么", "为什么值得"],
    "作品页上线清单": ["产品名", "链接", "截图", "用户故事"],
    "家长观察员提问": ["提问", "投票", "建议"],
    "五力证书": ["共情力", "提问力", "创造力", "判断力", "领导力"],
    "昨天我们决定帮谁": ["方向墙", "想帮的人", "产品一句话"],
    "今天必须做出来": ["核心动作", "能打开", "能试玩"],
    "晚上检查三件事": ["能打开", "能试玩", "能演示"],
    "四个项目都收到空话": ["模糊任务", "AI 卡住", "重新说清"],
    "老师演示：同一个项目，说清楚再问": ["四个方向", "AI 给的材料", "结果对比"],
    "AI 第一版，先挑能用的": ["检查清单", "错因卡", "4 格开头", "活动卡", "证据句"],
    "DeepSeek 当检查员": ["太大", "没证据", "不像用户"],
    "轮到你：写一张 AI 任务单": ["目标", "用户", "材料", "限制", "格式"],
    "12 个按钮挤在第一屏": ["按钮太多", "用户迷路", "先救一步"],
    "老师演示：先救一个动作": ["大产品", "砍小", "能试玩"],
    "这就是 MVP：先试最小一版": ["产品", "原型", "MVP"],
    "圈出第一个能被试玩的动作": ["30 秒", "能操作", "有结果"],
    "今天选一条能完成的路": ["标准", "轻量", "兜底"],
    "3-5 步走到结果": ["打开", "输入", "结果"],
    "用户进门，只问了一句话": ["真实问题", "接住第一句", "少读说明"],
    "老师演示：给产品装一个接待员": ["名字", "帮谁", "边界"],
    "接待员跑偏了怎么办？": ["真实问题", "测试", "再改边界"],
    "老师演示：把步骤排成小轨道": ["收集", "判断", "输出"],
    "老师演示：把一句话变成可打开页面": ["用户", "核心动作", "第一屏"],
    "轮到你：让 V1 打开一次": ["输入一句话", "打开预览", "改一处"],
    "一圈才算跑通": ["用户进来", "作品帮忙", "愿意再来"],
    "老师演示：商业闭环小地图": ["谁卡住", "怎么用", "换什么"],
    "乔布斯式差异化画布": ["原来办法", "不一样一点", "愿意再来"],
    "轮到你：把作品连成一圈": ["用户", "入口", "不一样"],
    "2 分钟 Demo：照着这一圈讲": ["用户进来", "作品帮忙", "哪里不一样"],
    "明天发布会要带什么": ["作品链接", "截图", "闭环小地图", "差异化亮点"],
    "发布盒子里乱成一团": ["链接", "截图", "证据", "分工"],
    "老师演示：WorkBuddy 整理发布盒子": ["材料", "顺序", "缩短"],
    "一页只讲一件事": ["用户", "问题", "作品", "证据", "下一步"],
    "轮到你：交出发布盒子": ["作品链接", "发布 PPT", "上台顺序"],
    "他为什么愿意换？": ["少烦一点", "愿意继续用", "真实交换"],
    "换一张让人看懂的卡": ["名字", "帮谁", "截图"],
    "标语不是夸自己": ["不喊口号", "说清动作", "用户听懂"],
    "轮到你：摆好自己的作品摊位": ["名字", "标语", "截图", "亮点"],
    "观察员举手了": ["追问", "证据", "下一步"],
    "老师演示：DeepSeek 扮演观察员": ["用户", "作品", "证据", "下一步"],
    "好回答像三明治": ["结论", "证据", "下一步"],
    "轮到你：抽出 2 张追问卡": ["用户问题", "作品问题", "下一步问题"],
    "上台先讲为什么": ["为什么", "想帮谁", "值得做"],
    "黄金圈：为什么、怎么做、做出了什么": ["为什么", "怎么做", "做出了什么"],
    "老师演示：把作品讲成黄金圈": ["信念", "作品", "证据"],
    "讲出我们的信念和梦想": ["我们相信", "我们希望", "下一步"],
    "轮到你：写黄金圈路演稿": ["为什么", "怎么帮", "邀请"],
    "路演问答：听懂问题再回答": ["听懂问题", "拿出证据", "说下一步"],
    "带走自己的作品故事": ["作品", "贡献", "下一次"]
  };
  return chips[page.title];
}

function childFacingSummaryForPage(module: CourseModule, page: DesignedLessonPage) {
  const summaries: Record<string, string> = {
    "创业是什么？": "创业就是看见别人遇到的真实需要，用产品或服务帮他解决，并产生价值交换。",
    "创业从帮助开始": "创业不是先做一个很大的东西，而是先帮一个真实的人少一点麻烦。",
    "先从家里找到需要": "真实需要不一定在远方。爷爷看不懂手机消息、爸爸周末找预约码、家里照顾宠物，都可能藏着可以发明的机会。",
    "生活帮手：爷爷看不懂手机消息": "先别急着说答案。看清爷爷卡在哪里：看不清、怕点错、不知道急不急，还是不知道下一步做什么。",
    "AI 可以帮哪几步": "AI 不只会聊天。它可以帮你画产品设计草图、写宣传语，也可以用商业画布检查谁会用、哪里不一样、为什么值得。",
    "故事：上学出门检查台": "乐乐早上想不全。一个小清单，帮他把东西带齐，出门不慌。",
    "老师演示：上学出门检查台": "把早上怕漏带这件事拆开，看它怎样变成一个能每天打开的小产品。",
    "别人为什么愿意换": "如果作品真的帮上忙，别人可能愿意试玩、推荐，甚至拿星星币来换。",
    "轮到你：写帮忙卡": "用几句话写清：你们想帮谁，他卡在哪，先帮哪一步，帮完少烦什么。",
    "从家里和身边找真实需要": "先看家人、同学、邻居做事时哪里不方便、不安全。哪个人让你想说“我想帮他”，就把他圈出来。",
    "12 个小麻烦，圈出你想帮的人": "先看 12 个小故事。哪个人让你想说“我也遇到过”，就把他圈出来。办法先不急，下午去问清楚。",
    "生活帮手：先从家里找需要": "爷爷看不懂手机消息、同学出门怕漏带、零花钱一下花光。先看这些麻烦是不是你也见过。",
    "学习工具：卡住时先看哪一步": "有人被长题绕晕，有人订正完还是会错，有人英语一被追问就接不上。先找最想问清楚的一步。",
    "创意工坊：有想法但做不出来": "脑子里有画面，手上却做不出来。作文、小游戏、漫画都可能卡在“第一步怎么说”。",
    "家庭社区：帮身边的人少卡一步": "爸妈周末安排很多，宠物照顾容易记混，家里照片也常常没人整理。先看谁最需要被帮一把。",
    "小组时间：选一个最想帮的小麻烦": "从 12 个故事里选一个，也可以写你们自己发现的麻烦。先说清你们想帮谁。",
    "留下方向和一个问题": "今天先留下想帮谁、事情发生在哪里、你们最想问的一句话。",
	    "四个项目都收到空话": "四个方向各派一个项目来问 AI，结果都卡在同一个地方：任务单没说清楚。",
    "老师演示：同一个项目，说清楚再问": "同一个项目，把问法说清楚，AI 就能交出能继续做的材料。",
    "AI 第一版，先挑能用的": "拿到 AI 第一版，先留下能帮小组往前走的内容，划掉没证据的句子。",
    "DeepSeek 当检查员": "让 DeepSeek 帮四个项目找出太大、没证据、今天做不到的句子。",
    "轮到你：写一张 AI 任务单": "把自己小组的项目写成五句话，让 AI 交出一段马上能用的材料。",
    "12 个按钮挤在第一屏": "四个项目都想做很多功能，可用户其实只想先完成一个动作。",
    "老师演示：先救一个动作": "四个方向都先救一个动作：列出门清单、拆应用题第一步、排作文漫画、发布小课卡。",
    "这就是 MVP：先试最小一版": "四个项目的 MVP 都很小，但每一个都能让别人试到结果。",
    "轮到你：把功能倒在桌面上": "先把想做的功能都摊开，再找最先能动的那一块。",
    "圈出第一个能被试玩的动作": "圈出 30 秒能看懂、能操作、能看到结果的第一个动作。",
    "一圈才算跑通": "商业闭环就是一圈：有人遇到麻烦，打开你的作品，完成一步，真的变轻松，愿意再用或推荐。",
    "老师演示：商业闭环小地图": "用一个项目画一圈：谁来、怎么打开、先做哪一步、看到什么结果、愿意拿什么来换。",
    "乔布斯式差异化画布": "乔布斯做产品时，不是堆很多功能，而是让人记住一个不一样的体验。今天你们也找一个最值得被记住的点。",
    "轮到你：把作品连成一圈": "把自己作品也画成一圈，再圈出一个不一样的点。哪一段说不清，明天就先补哪一段。",
    "2 分钟 Demo：照着这一圈讲": "别从功能清单开始。先让大家看见用户怎么进来，作品怎么帮忙，最后说出哪里不一样。",
    "明天发布会要带什么": "带上能打开的作品、核心截图、商业闭环小地图、差异化亮点和每个人要讲的一段。",
    "发布盒子里乱成一团": "作品链接、截图、采访原话和分工纸条都在桌上，先排出上台顺序。",
    "老师演示：WorkBuddy 整理发布盒子": "把材料交给 WorkBuddy 分堆，再由团队删掉不真实、太长、没用的句子。",
    "一页只讲一件事": "发布 PPT 不塞满，一页只帮观察员看懂一件事。",
    "轮到你：交出发布盒子": "把作品链接、发布 PPT、证据和上台分工一起装进发布盒子。",
    "星星币市场开张": "四个项目摆上作品街，孩子先试玩，再决定星星币交给谁。",
    "他为什么愿意换？": "四个项目都要说清楚：它到底帮别人少掉了哪一种麻烦。",
    "老师演示：一张价值小票": "一张价值小票写清谁会用、少烦什么、愿意拿什么来换。",
    "轮到你：写价值小票": "把产品带来的真实变化写成一张能被别人读懂的小票。",
    "作品摊位开张了": "四个项目都要摆成摊位卡，让同学 3 秒看懂帮谁、怎么帮。",
    "老师演示：换一张让人看懂的卡": "四个项目都把大口号换成产品名、真实动作和一张能看懂的截图。",
    "标语不是夸自己": "好标语不喊厉害，它直接告诉用户打开后能完成什么。",
    "轮到你：摆好自己的作品摊位": "摆出名字、截图、一句话和 3 个亮点，让别人愿意点开试一次。",
    "观察员举手了": "观察员开始追问四个项目：你怎么知道真的有人需要？证据在哪里？",
    "老师演示：DeepSeek 扮演观察员": "让 DeepSeek 先追问四个项目，团队再准备自己的真实回答。",
    "好回答像三明治": "四个项目都用同一招：先答结论，中间夹证据，最后说下一步。",
    "轮到你：抽出 2 张追问卡": "选出最可能被问到的两个问题，准备 30 秒证据回答。",
    "用证据回答": "用采访原话、试玩反馈或现场演示，让回答听起来有根。",
    "上台先讲为什么": "路演不是一上来念功能。先告诉大家：你们为什么想帮这个人，为什么这件事值得做。",
    "黄金圈：为什么、怎么做、做出了什么": "黄金圈就是三句话顺序：为什么想做，怎么帮助别人，最后展示做出了什么。",
    "老师演示：把作品讲成黄金圈": "同一个作品，先用一句“我们相信”开头，再演示作品，最后拿出证据和下一步。",
    "讲出我们的信念和梦想": "信念不是大口号。可以很简单：我们希望爷爷看懂重要消息，我们希望同学遇到长题也敢开始。",
    "轮到你：写黄金圈路演稿": "写下你们为什么想做、看见谁的麻烦、作品怎么帮、做出了什么、最后邀请大家做什么。",
    "路演问答：听懂问题再回答": "先听清观众问的是用户、作品、证据还是下一步，再用真实材料回答。"
  };
  return summaries[page.title] ?? page.content_summary ?? module.subtitle;
}

const courseTrackExampleOrder: ProductTrackValue[] = [
  "life-helper",
  "learning-tool",
  "creative-studio",
  "campus-community"
];

function trackExampleCards(makeCard: (example: (typeof productTrackExamples)[ProductTrackValue]) => LessonCard) {
  return courseTrackExampleOrder.map((track) => makeCard(productTrackExamples[track]));
}

const fourTrackProgressPageTitles = new Set([
  "四个项目都收到空话",
  "老师演示：同一个项目，说清楚再问",
  "AI 第一版，先挑能用的",
  "DeepSeek 当检查员",
  "轮到你：写一张 AI 任务单",
  "12 个按钮挤在第一屏",
  "老师演示：先救一个动作",
  "这就是 MVP：先试最小一版",
  "轮到你：把功能倒在桌面上",
  "圈出第一个能被试玩的动作",
  "发布盒子里乱成一团",
  "老师演示：WorkBuddy 整理发布盒子",
  "一页只讲一件事",
  "轮到你：交出发布盒子",
  "星星币市场开张",
  "他为什么愿意换？",
  "老师演示：一张价值小票",
  "轮到你：写价值小票",
  "作品摊位开张了",
  "老师演示：换一张让人看懂的卡",
  "标语不是夸自己",
  "轮到你：摆好自己的作品摊位",
  "观察员举手了",
  "老师演示：DeepSeek 扮演观察员",
  "好回答像三明治",
  "轮到你：抽出 2 张追问卡",
  "用证据回答"
]);

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
    "创业是什么？": [
      { title: "真实麻烦", text: "先看见一个人卡在哪一步" },
      { title: "产品或服务", text: "做一个办法帮他少一点麻烦" },
      { title: "价值交换", text: "别人觉得有用，愿意继续用、推荐或付费" }
    ],
    "创业从帮助开始": [
      { title: "用户", text: "你想帮助的那个人" },
      { title: "需求", text: "他反复遇到、愿意解决的麻烦" },
      { title: "产品", text: "能帮他完成一步的办法" },
      { title: "价值交换", text: "别人觉得有用，愿意拿时间、推荐或星星币来换" },
      { title: "价格", text: "别人觉得值得换多少" }
    ],
    "老师演示：上学出门检查台": [
      { title: "用户", text: "早上出门前怕漏带东西的同学" },
      { title: "需求", text: "课表、作业和通知分散在不同地方" },
      { title: "产品", text: "上学前 3 分钟检查台" },
      { title: "先帮一步", text: "粘贴课表和通知，生成三栏出门清单" },
      { title: "少掉麻烦", text: "出门前自己勾一遍，东西带齐了再走" }
    ],
    "别人为什么愿意换": [
      { title: "试玩 30 秒", text: "听起来有用，我愿意点开试一次" },
      { title: "推荐给同学", text: "我觉得别人也会需要" },
      { title: "1 枚星星币", text: "它真的帮我少烦了" },
      { title: "每天都想用", text: "说明它可能更有价值" }
    ],
    "轮到你：写帮忙卡": [
      { title: "帮谁", text: "写一个真实的人，不写所有人" },
      { title: "卡在哪", text: "写最不顺的那一步" },
      { title: "先帮哪一步", text: "第一版只帮一个动作" },
      { title: "少掉什么麻烦", text: "帮完以后他轻松了哪里" },
      { title: "愿意换什么", text: "试玩、推荐、星星币，先猜一种" }
    ],
    "竞品观察三格": [
      { title: "谁在用", text: "它现在服务哪类用户" },
      { title: "怎么解决", text: "它让用户完成什么动作" },
      { title: "哪里不同", text: "我们可以做出一个新角度" }
    ],
    "先从家里找到需要": [
      { title: "看见人", text: "爷爷、爸爸、弟弟、邻居，谁做事时不方便" },
      { title: "看见动作", text: "看消息、找预约码、拿东西、走路，哪一步卡住" },
      { title: "看见风险", text: "点错、漏带、忘记、够不到，哪里不安全或不省心" },
      { title: "留下问题", text: "怎样让这一步更安全、更省力、更容易完成" }
    ],
    "生活帮手：爷爷看不懂手机消息": [
      { title: "需求", text: "手机消息字小又复杂，爷爷不知道这条消息急不急" },
      { title: "产品", text: "消息大白话卡：这是什么、急不急、下一步做什么" },
      { title: "AI 怎么帮", text: "把复杂消息改写成 3 句家人能看懂的话" },
      { title: "价值", text: "让长辈少怕点错，也让家人少临时解释" }
    ],
    "AI 可以帮哪几步": [
      { title: "产品设计", text: "让 AI 画 3 个外形草图，再挑最安全的一版" },
      { title: "宣传", text: "让 AI 写一句家人一听就懂的宣传语" },
      { title: "商业画布", text: "让 AI 帮你检查用户、需求、差异化和交换理由" },
      { title: "人来判断", text: "最后由小组决定哪一版真的适合用户" }
    ],
    "生活帮手：上学前 3 分钟检查台": [
      { title: "需求", text: "课表和通知分散，早上怕漏带关键东西" },
      { title: "产品", text: "上学前 3 分钟检查台：课表和通知变成三栏出门清单" },
      { title: "AI 怎么帮", text: "读课表和通知，分成必带、要确认、到校先做" },
      { title: "价值", text: "早上出门少慌张，少反复确认" }
    ],
    "学习工具：长应用题第一步": [
      { title: "需求", text: "应用题太长，不知道先看哪句话" },
      { title: "产品", text: "长应用题第一步：拆成谁、已知、要求、第一步" },
      { title: "AI 怎么帮", text: "读长题，整理结构，但不直接算答案" },
      { title: "价值", text: "遇到长题时先能开始，不是直接放弃" }
    ],
    "创意工坊：我的作文想变成漫画": [
      { title: "需求", text: "作文写了很多，别人却看不见最精彩的画面" },
      { title: "产品", text: "作文漫画分镜台：从作文里选 4 个关键画面" },
      { title: "AI 怎么帮", text: "整理画面、动作、对白和旁白草稿" },
      { title: "价值", text: "孩子愿意重读自己的作文，再把它改成漫画小作品" }
    ],
    "家庭社区：周末安排总是挤在一起": [
      { title: "需求", text: "周末活动多，时间、地点、要带的东西散在不同消息里" },
      { title: "产品", text: "周末出门卡：去哪、几点、带什么、谁负责" },
      { title: "AI 怎么帮", text: "把一堆安排整理成全家能看的四栏卡片" },
      { title: "价值", text: "爸妈少翻消息，孩子也知道自己能负责哪一步" }
    ],
    "我们看见了谁的麻烦？": [
      { title: "真实的人", text: "不是“所有人”，先写一个会遇到这件事的人" },
      { title: "真实场景", text: "这件事发生在什么时候、什么地方" },
      { title: "卡住的一步", text: "他最不顺的是哪一步" }
    ],
    "是不是很多人也会遇到？": [
      { title: "我也见过", text: "不是只存在想象里" },
      { title: "反复发生", text: "不是只发生一次" },
      { title: "能问清楚", text: "可以找到同学或用户继续问" }
    ],
    "他在哪一步卡住？": [
      { title: "场景", text: "事情发生在哪里" },
      { title: "麻烦", text: "最不顺的一步是什么" },
      { title: "现在办法", text: "他现在怎么解决" }
    ],
    "接下来要问什么？": [
      { title: "问谁", text: "找真正会遇到这件事的人" },
      { title: "问什么", text: "问发生过吗、多久一次、现在怎么解决" },
      { title: "看什么", text: "看别人真实使用时卡在哪里" }
    ],
    "明天先帮哪一步？": [
      { title: "30 秒看懂", text: "别人一眼知道怎么开始" },
      { title: "一步能试", text: "先完成一个核心动作" },
      { title: "明天能做", text: "范围小到可以真的做出来" }
    ],
    "提交方向和行动计划": [
      { title: "方向", text: "我们想帮谁" },
      { title: "卡住的一步", text: "他在哪一步不顺" },
      { title: "Day 2 动作", text: "明天先帮哪一步" }
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
    "昨天我们决定帮谁": [
      { title: "想帮的人", text: "昨天写下的那个人" },
      { title: "麻烦", text: "最值得继续追的一步" },
      { title: "产品一句话", text: "我们打算用什么帮助他" }
    ],
    "今天必须做出来": [
      { title: "核心动作", text: "别人打开后能完成的一步" },
      { title: "第一版", text: "先小到今天能做出来" },
      { title: "可试玩", text: "让别组同学真的试一次" }
    ],
    "晚上检查三件事": [
      { title: "能打开", text: "链接或文件能顺利展示" },
      { title: "能试玩", text: "别人能完成一个动作" },
      { title: "能演示", text: "2 分钟讲清用户、作品和结果" }
    ],
    "AI 听不懂“帮我做个好产品”": [
      { title: "模糊任务", text: "帮我做个好产品" },
      { title: "空话结果", text: "听起来热闹，却不知道下一步做什么" },
      { title: "重新说清", text: "补上目标、用户、材料、限制、格式" }
    ],
    "四个项目都收到空话": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `${example.user}带着一句“${example.vagueAsk}”来问。AI 只能先反问：给谁用？要做到哪一步？`
      }))
    ],
    "老师演示：同一个项目，说清楚再问": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `${example.clearAsk} → AI 第一版：${example.aiFirstDraft}`
      }))
    ],
    "AI 第一版，先挑能用的": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `${example.usefulPart} 这就是能继续往作品里放的材料。`
      }))
    ],
    "DeepSeek 当检查员": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: example.checkPoint
      }))
    ],
    "五句提示词卡": [
      { title: "目标", text: "请 AI 帮我做什么" },
      { title: "用户", text: "这是给谁用的" },
      { title: "材料", text: "我们已经知道什么" },
      { title: "限制", text: "今天只能做到什么程度" },
      { title: "格式", text: "希望它用什么样子给我" }
    ],
    "轮到你：给自己的产品写五句提示词": [
      { title: "目标", text: "请 AI 帮产品完成哪一步" },
      { title: "想帮的人", text: "你们想帮助谁" },
      { title: "格式", text: "输出要能直接带回团队使用" }
    ],
    "轮到你：写一张 AI 任务单": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `目标：让 ${example.productName} 先完成“${example.mvpAction}”。输出：给我一段能放进作品的结果。`
      }))
    ],
    "想帮太多，反而谁也帮不到": [
      { title: "12 个功能", text: "看起来很厉害，但用户不知道先点哪里" },
      { title: "第一步卡住", text: "第一版先让一个动作跑通" },
      { title: "先缩小", text: "小到别人能试，才知道有没有用" }
    ],
    "12 个按钮挤在第一屏": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `${example.user}不是想看 12 个按钮，他只想先完成：${example.mvpAction}`
      }))
    ],
    "产品、原型、MVP": [
      { title: "产品", text: "别人真的会使用、能解决问题的东西" },
      { title: "原型", text: "还不是最终版，但已经能演示核心功能" },
      { title: "MVP", text: "最小但能验证想法的一版产品" }
    ],
    "老师演示：先救一个动作": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `先只做：${example.mvpAction}`
      }))
    ],
    "这就是 MVP：先试最小一版": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `小到今天能做：${example.mvpAction}。大到别人能试：${example.value}`
      }))
    ],
    "团队列功能": [
      { title: "先倒出来", text: "把想做的 5-8 个功能放到桌面上" },
      { title: "不急着选", text: "先看每个功能帮的是哪一步" },
      { title: "准备收敛", text: "下一页只留下一个核心动作" }
    ],
    "轮到你：把功能倒在桌面上": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `先把想法倒出来，再圈最先能动的一块：${example.mvpAction}`
      }))
    ],
    "只留下核心动作": [
      { title: "用户打开", text: "第一眼知道要做什么" },
      { title: "30 秒体验", text: "能完成一个动作" },
      { title: "看到结果", text: "试用后有清楚变化" }
    ],
    "圈出第一个能被试玩的动作": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `${example.mvpAction}。完成后能截图，也能放进明天的发布 PPT。`
      }))
    ],
    "今天选一条能完成的路": [
      { title: "标准路线", text: "用课堂推荐工具完成" },
      { title: "轻量路线", text: "做成可点击网页或表单" },
      { title: "兜底路线", text: "用截图和流程演示核心动作" }
    ],
    "用户打开后第一步做什么？": [
      { title: "打开", text: "用户看到的第一屏" },
      { title: "第一步", text: "用户马上要点、选或输入什么" },
      { title: "别绕路", text: "先让核心动作出现" }
    ],
    "3-5 步走到结果": [
      { title: "打开作品", text: "进入作品入口" },
      { title: "输入或选择", text: "完成核心动作需要的信息" },
      { title: "看到结果", text: "用户得到帮助或反馈" }
    ],
    "路线卡提交": [
      { title: "路线", text: "标准、轻量、进阶或兜底" },
      { title: "流程", text: "3-5 步从打开走到结果" },
      { title: "今天能完成", text: "路线要适合当前时间" }
    ],
    "产品需要一个会接待用户的脑袋": [
      { title: "用户来问", text: "我今天先写什么？" },
      { title: "产品追问", text: "哪一科最难，明天要交什么？" },
      { title: "给出建议", text: "只给 3 步，先开始第一步" }
    ],
    "什么是智能体": [
      { title: "角色", text: "它在产品里负责什么" },
      { title: "任务", text: "它主要帮用户完成哪一步" },
      { title: "边界", text: "它不做什么" },
      { title: "开场问题", text: "用户进来第一句问什么" }
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
    "轮到你：生成可打开 V1": [
      { title: "输入一句话", text: "把用户、场景、动作说清楚" },
      { title: "打开预览", text: "看别人能不能完成动作" },
      { title: "改一处", text: "让核心按钮更明显" }
    ],
    "制作开始": [
      { title: "倒计时", text: "开始让核心动作动起来" },
      { title: "分工", text: "有人做页面，有人试用，有人记录" },
      { title: "保留证据", text: "链接、截图或录屏都要留下" }
    ],
    "先让核心动作动起来": [
      { title: "先跑通", text: "先让一个核心动作能完成" },
      { title: "再变好看", text: "先有可试版本，再改细节" },
      { title: "随时截图", text: "每次能打开都留下证据" }
    ],
    "卡在哪里，写清楚": [
      { title: "卡住的一步", text: "现在最影响前进的一步" },
      { title: "试过", text: "团队已经尝试过什么" },
      { title: "需要", text: "需要工具、产品还是协作帮助" }
    ],
    "V1 保留下来": [
      { title: "作品链接", text: "让别人能打开体验" },
      { title: "截图", text: "看得见第一版样子" },
      { title: "录屏", text: "能说明核心动作怎么跑" }
    ],
    "第一批用户来了": [
      { title: "自己觉得清楚", text: "团队已经知道怎么用" },
      { title: "别人第一次用", text: "才会看到哪里不顺" },
      { title: "先观察", text: "不要急着解释，让作品自己接受试用" }
    ],
    "先看别人怎么用": [
      { title: "动作", text: "他先点了哪里" },
      { title: "停顿", text: "他在哪一步停下来" },
      { title: "提问", text: "他问了什么，说明哪里不清楚" }
    ],
    "老师演示：把一句反馈变成改动": [
      { title: "反馈", text: "看不懂按钮" },
      { title: "改动 1", text: "按钮改名" },
      { title: "改动 2", text: "放到第一屏更明显的位置" }
    ],
    "给别组一条反馈": [
      { title: "我试了", text: "先打开别组作品完成一步" },
      { title: "我卡在", text: "写下停顿或看不懂的地方" },
      { title: "我建议", text: "给出下一版可以改的一处" }
    ],
    "一圈才算跑通": [
      { title: "麻烦", text: "有人真的会遇到" },
      { title: "作品", text: "打开后能帮一步" },
      { title: "结果", text: "少烦一点，看得见" },
      { title: "交换", text: "愿意再用、推荐或付星星币" }
    ],
    "老师演示：商业闭环小地图": [
      ...trackExampleCards((example) => ({
        title: example.productName,
        text: `${example.user}先完成一个动作，看到结果后愿意继续试。`
      }))
    ],
    "乔布斯式差异化画布": [
      { title: "原来办法", text: "用户现在怎么凑合解决" },
      { title: "不一样一点", text: "你的作品更省心、更好玩或更容易坚持" },
      { title: "惊喜瞬间", text: "哪一秒让用户觉得有用" },
      { title: "交换理由", text: "为什么愿意再用、推荐或付星星币" }
    ],
    "轮到你：把作品连成一圈": [
      { title: "谁来", text: "一个真实的人" },
      { title: "怎么进来", text: "打开链接、扫码或同学推荐" },
      { title: "做哪一步", text: "先完成最小动作" },
      { title: "哪里不一样", text: "比原来的办法更值得记住" }
    ],
    "2 分钟 Demo：照着这一圈讲": [
      { title: "用户进来", text: "先说谁遇到麻烦" },
      { title: "作品帮忙", text: "现场打开完成一步" },
      { title: "结果出现", text: "展示少烦了什么" },
      { title: "不一样一点", text: "说出为什么值得再来" }
    ],
    "2 分钟 Demo": [
      { title: "只讲核心动作", text: "不讲所有想法" },
      { title: "让作品自己说话", text: "现场打开完成一步" },
      { title: "时间够短", text: "2 分钟内讲清楚" }
    ],
    "用户、作品、结果连起来": [
      { title: "用户", text: "谁遇到这个麻烦" },
      { title: "作品", text: "打开后怎么帮他" },
      { title: "结果", text: "试用后看见什么变化" }
    ],
    "明天发布会要带什么": [
      { title: "链接", text: "能打开作品" },
      { title: "截图", text: "看得见核心画面" },
      { title: "闭环小地图", text: "用户、作品、结果和交换" },
      { title: "差异化亮点", text: "一句话说清哪里不一样" }
    ],
    "发布会前，材料铺满桌面": [
      { title: "作品链接", text: "能打开" },
      { title: "截图", text: "能看懂" },
      { title: "证据", text: "采访和试玩反馈" },
      { title: "分工", text: "谁讲哪一步" }
    ],
    "发布盒子里乱成一团": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `用户：${example.user}。证据：${example.evidence} 先别乱放，等讲到“为什么需要”时再拿出来。`
      }))
    ],
    "老师演示：整理成上台顺序": [
      { title: "材料", text: "只放已经有的成果" },
      { title: "顺序", text: "用户、作品、证据、下一步" },
      { title: "检查", text: "太长就再缩短" }
    ],
    "老师演示：WorkBuddy 整理发布盒子": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `${example.user}遇到麻烦 → ${example.productName} 完成“${example.mvpAction}” → 证据 → ${example.nextStep}`
      }))
    ],
    "发布 PPT 只需要讲清五件事": [
      { title: "用户", text: "谁真的需要" },
      { title: "问题", text: "他卡在哪里" },
      { title: "作品", text: "我们做了什么" },
      { title: "证据", text: "采访和试玩说明什么" },
      { title: "下一步", text: "继续做先改哪里" }
    ],
    "一页只讲一件事": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `1 用户：${example.user}。2 动作：${example.mvpAction}。3 证据。4 下一步：${example.nextStep}`
      }))
    ],
    "提交作品链接和发布 PPT": [
      { title: "作品链接", text: "让别人能打开体验" },
      { title: "发布 PPT", text: "只放展示需要的页面" },
      { title: "上台顺序", text: "每个人负责一段" }
    ],
    "轮到你：交出发布盒子": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `${example.productName} 链接或截图 + 一句证据 + 一页“${example.mvpAction}”的演示页。`
      }))
    ],
    "星星币市场开张": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `试玩后再决定：它有没有真的帮到${example.user}？`
      }))
    ],
    "他为什么愿意换？": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `${example.productName}让用户得到：${example.value}`
      }))
    ],
    "价值不是喊出来的": [
      { title: "不是口号", text: "价值要看别人是否愿意交换" },
      { title: "少烦一点", text: "作品帮用户少花时间、少出错或更愿意开始" },
      { title: "继续验证", text: "用试用和反馈证明它有用" }
    ],
    "老师演示：一张价值小票": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `谁会用：${example.user}。少烦什么：${example.value}。愿意交换：再用一次或推荐给同学。`
      }))
    ],
    "轮到你：写价值小票": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `${example.user}愿意换，是因为：${example.value}`
      }))
    ],
    "轮到你：价值小票": [
      { title: "用户", text: "谁最需要这个作品" },
      { title: "变化", text: "他少烦了什么" },
      { title: "交换", text: "别人愿意拿什么来换" }
    ],
    "海报是在帮别人看懂": [
      { title: "名字", text: "第一眼知道作品是谁" },
      { title: "标语", text: "一句话说清怎么帮人" },
      { title: "截图", text: "看见作品真实样子" },
      { title: "亮点", text: "帮谁、怎么帮、结果是什么" }
    ],
    "作品摊位开张了": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `${example.stallCard} 配一张能看见“${example.mvpAction}”的截图。`
      }))
    ],
    "老师演示：一张好产品卡": [
      { title: "产品名", text: "上学前 3 分钟检查台" },
      { title: "帮谁", text: "早上出门前怕漏带东西的同学" },
      { title: "怎么帮", text: "把课表、作业和老师通知整理成三栏出门清单" },
      { title: "截图", text: "放一张能看懂的作品画面" }
    ],
    "老师演示：换一张让人看懂的卡": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `别写“智能平台”。写：${example.stallCard}`
      }))
    ],
    "标语不是夸自己": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: example.stallCard
      }))
    ],
    "轮到你：摆好自己的作品摊位": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `${example.productName} + 截图 + “${example.stallCard}” + 一条证据。`
      }))
    ],
    "观察员会追问": [
      { title: "真的需要吗", text: "拿出采访证据" },
      { title: "能用起来吗", text: "现场演示核心动作" },
      { title: "下一步呢", text: "说出先改哪里" }
    ],
    "观察员举手了": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `你怎么知道${example.user}真的需要？你能拿出哪句证据？`
      }))
    ],
    "好回答有三层": [
      { title: "结论", text: "先直接回答问题" },
      { title: "证据", text: "再拿出采访或试玩反馈" },
      { title: "下一步", text: "最后说准备先改哪里" }
    ],
    "好回答像三明治": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `结论：有人需要。证据：${example.evidence} 下一步：${example.nextStep}`
      }))
    ],
    "老师演示：DeepSeek 模拟追问": [
      { title: "用户", text: "谁真的需要" },
      { title: "作品", text: "是否完成核心动作" },
      { title: "证据", text: "试玩反馈说明什么" },
      { title: "下一步", text: "先改哪一处" }
    ],
    "老师演示：DeepSeek 扮演观察员": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `DeepSeek 可以问：${example.productName}证据够吗？第一次打开能完成“${example.mvpAction}”吗？`
      }))
    ],
    "选 2 个最可能被问到的问题": [
      { title: "用户问题", text: "你怎么知道真的有人需要" },
      { title: "作品问题", text: "用户能不能自己用起来" },
      { title: "下一步问题", text: "继续做先改哪里" }
    ],
    "轮到你：抽出 2 张追问卡": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `用户卡：${example.user}真的需要吗？作品卡：能完成“${example.mvpAction}”吗？`
      }))
    ],
    "用证据回答": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `先答：我们看到需要。再放证据：${example.evidence} 最后说：${example.nextStep}`
      }))
    ],
    "上台先讲为什么": [
      { title: "先别念功能", text: "先让大家听见：你们为什么想帮这个人。" },
      { title: "让观众看见人", text: "他在哪里卡住？这件事为什么值得被解决？" },
      { title: "一句孩子话", text: "我们相信，小麻烦也值得被认真解决。" }
    ],
    "黄金圈：为什么、怎么做、做出了什么": [
      { title: "为什么", text: "我们为什么想帮这个人" },
      { title: "怎么做", text: "我们用什么办法帮他少一点麻烦" },
      { title: "做出了什么", text: "现场打开作品，让大家看到结果" }
    ],
    "老师演示：把作品讲成黄金圈": [
      ...trackExampleCards((example) => ({
        title: `${example.track}｜${example.productName}`,
        text: `为什么：想帮${example.user}。怎么做：${example.mvpAction}。做出了什么：${example.stallCard}`
      }))
    ],
    "讲出我们的信念和梦想": [
      { title: "我们相信", text: "用一句真心话开头，不喊空口号。" },
      { title: "我们希望", text: "说出继续做下去，最想帮到谁。" },
      { title: "下一步梦想", text: "不是吹很大，而是说下一版想让它更有用。" }
    ],
    "轮到你：写黄金圈路演稿": [
      { title: "为什么", text: "我们看见了谁的麻烦" },
      { title: "怎么帮", text: "作品先帮他完成哪一步" },
      { title: "邀请", text: "请大家试玩、提问或给建议" }
    ],
    "路演问答：听懂问题再回答": [
      { title: "先听懂", text: "观众在问用户、作品、证据还是下一步？" },
      { title: "再回答", text: "用作品截图、试玩反馈或采访原话回答。" },
      { title: "说下一步", text: "最后说你们准备先改哪一处。" }
    ],
    "12 个真实创业方向": [
      { title: "生活帮手", text: "课表和通知太散，出门检查台帮你早上勾一遍。" },
      { title: "学习工具", text: "应用题不知道从哪开始，拆题板先帮你找到第一步。" },
      { title: "创意工坊", text: "故事点子排不成四格，分镜台先给你一张草稿。" },
      { title: "家庭社区", text: "周末安排太散，出门卡帮全家看清去哪、带什么、谁负责。" }
    ],
    "产品摊位开张": [
      { title: "想帮的人", text: "谁会用这个产品" },
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
      { title: "看使用的人", text: "哪里还不够顺手" },
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
      { title: "提问", text: "听懂别人为什么需要" },
      { title: "投票", text: "选出最打动自己的作品" },
      { title: "建议", text: "给团队一个下一步方向" }
    ],
    "每组 5 分钟故事发布": [
      { title: "用户故事", text: "谁遇到了这个麻烦" },
      { title: "现场试用", text: "打开作品完成核心动作" },
      { title: "测试证据", text: "别人试过后怎么说" },
      { title: "下一步", text: "如果继续做，先改哪里" }
    ],
    "彩排开始": [
      { title: "完整走一遍", text: "按发布顺序演一遍" },
      { title: "看时间", text: "把时间留给作品和用户" },
      { title: "记下来", text: "哪里不顺就马上标出来" }
    ],
    "删掉一句多余的话": [
      { title: "少解释", text: "把时间让给作品演示" },
      { title: "保留证据", text: "留下采访和试玩最有力的一句" },
      { title: "句子更短", text: "让观察员更容易听懂" }
    ],
    "谁负责哪一步": [
      { title: "开头", text: "谁讲用户和问题" },
      { title: "中间", text: "谁演示作品" },
      { title: "结尾", text: "谁回答证据和下一步" }
    ],
    "最终提交": [
      { title: "作品链接", text: "能打开体验" },
      { title: "发布 PPT", text: "只放展示需要的页" },
      { title: "备用截图", text: "现场也能讲清楚" }
    ],
    "作品秀开场": [
      { title: "看用户", text: "谁真的需要" },
      { title: "看作品", text: "核心动作能不能跑起来" },
      { title: "看结果", text: "试用后有什么变化" }
    ],
    "每组 5 分钟发布": [
      { title: "用户故事", text: "谁遇到了这个麻烦" },
      { title: "现场试用", text: "打开作品完成核心动作" },
      { title: "结果证据", text: "别人试过后怎么说" },
      { title: "下一步", text: "如果继续做，先改哪里" }
    ],
    "观察员提问": [
      { title: "听懂问题", text: "先确认观察员问的是什么" },
      { title: "拿出证据", text: "用采访或试玩来回答" },
      { title: "说下一步", text: "给出一个可以继续改的方向" }
    ],
    "看见亮点，给出下一步建议": [
      { title: "我看见的亮点", text: "作品里值得借走的方法" },
      { title: "我想追问", text: "还想了解的用户或证据" },
      { title: "我建议下一步", text: "继续做可以先改哪里" }
    ],
    "观察员投票": [
      { title: "最想继续用", text: "我会把它打开再试" },
      { title: "最会解决问题", text: "它真的帮到一个用户" },
      { title: "最会指挥 AI", text: "团队会提要求，也会判断结果" }
    ],
    "五力证书": [
      { title: "共情力", text: "听见别人的真实麻烦" },
      { title: "提问力", text: "问出关键线索" },
      { title: "创造力", text: "做出新的方案" },
      { title: "判断力", text: "看见 AI 哪里要改" },
      { title: "领导力", text: "把想法带到展示台" }
    ],
    "每个人的贡献被看见": [
      { title: "我看见", text: "队友做过的一件真实贡献" },
      { title: "有证据", text: "它出现在作品、采访、测试或展示里" },
      { title: "给名字", text: "用一个能力词把贡献留下来" }
    ],
    "带走自己的作品故事": [
      { title: "我的作品", text: "三天里参与做出的真实成果" },
      { title: "我的贡献", text: "团队里被看见的一步" },
      { title: "下一次", text: "继续练习指挥 AI 的方法" }
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
    "创业是什么？": ["看见真实麻烦", "做出帮忙办法", "产生价值交换"],
    "创业从帮助开始": ["看见用户", "发现需求", "做出产品"],
    "先从家里找到需要": ["看见一个身边的人", "看清他卡在哪一步", "留下一个真实问题"],
    "生活帮手：爷爷看不懂手机消息": ["看见手机消息", "讲成大白话", "说清下一步"],
    "AI 可以帮哪几步": ["画产品设计图", "写一句宣传语", "分析商业画布"],
    "故事：上学出门检查台": ["看乐乐哪里慌", "看清单怎么帮", "说出少了哪个麻烦"],
    "老师演示：上学出门检查台": ["谁卡住", "先帮哪一步", "少掉什么麻烦"],
    "别人为什么愿意换": ["愿意试玩", "愿意推荐", "愿意付星星币"],
    "轮到你：写帮忙卡": ["写帮谁", "写卡住的一步", "写少掉什么麻烦"],
    "一句话让小游戏跑起来": ["输入一句话", "打开页面", "看见作品能动"],
    "它不只会做游戏": ["同样能力", "换成真实麻烦", "帮人完成一步"],
    "出门检查台跑一遍": ["粘贴课表和通知", "点击生成", "得到出门清单"],
    "给网页一句清楚任务": ["给谁用", "完成什么动作", "看到什么结果"],
    "第一版页面长什么样": ["输入区", "按钮", "结果区"],
    "从家里和身边找真实需要": ["看家里", "看学校", "看社区"],
    "12 个小麻烦，圈出你想帮的人": ["看 12 个故事", "圈出一个人", "写下一句问题"],
    "生活帮手：先从家里找需要": ["看手机消息", "看出门漏带", "看钱怎么花没"],
    "学习工具：卡住时先看哪一步": ["看长题卡住", "看错题原因", "看英语接不上"],
    "创意工坊：有想法但做不出来": ["看作文开头", "看小游戏规则", "看作文漫画"],
    "家庭社区：帮身边的人少卡一步": ["看周末安排", "看宠物交接", "看照片故事"],
    "小组时间：选一个最想帮的小麻烦": ["选一个故事", "说出想帮谁", "写下要问的问题"],
	    "留下方向和一个问题": ["写方向", "写想帮谁", "写下一步要问谁"],
    "问题改写卡": ["选一个原始烦恼", "让豆包改成 3 个问题", "团队选一个今天继续追"],
    "AI 市场侦察卡": ["找一条用户声音", "找一个已有方案", "写下还要验证的问题"],
    "老师演示：DeepSeek 找已有方案": ["输入产品一句话", "看已有办法", "写下还要问真人的问题"],
    "生活帮手：上学前 3 分钟检查台": ["看见早上怕漏带", "做出出门清单", "说清为什么每天有用"],
    "学习工具：长应用题第一步": ["看见长题卡住", "拆出题目结构", "说清为什么先能下手"],
    "创意工坊：我的作文想变成漫画": ["看见作文没画面", "做出四格分镜", "说清哪一格最精彩"],
    "家庭社区：周末安排总是挤在一起": ["看见全家安排", "做出出门卡", "说清为什么爸妈愿意用"],
    "选一个方向，找到想帮的人": ["选定一个方向", "写出想帮的人", "准备问他三个问题"],
    "把线索变成产品一句话": ["谁遇到麻烦", "麻烦发生在哪里", "我们用什么帮他"],
    "老师演示：豆包先出三版": ["输入五句提示词", "得到 3 个版本", "挑出最清楚的一版"],
    "老师演示：DeepSeek 帮忙检查": ["粘贴第一版", "找夸张和缺证据的句子", "改成更稳的一版"],
    "老师演示：扣子最小智能体": ["写清服务对象", "写清任务边界", "用真实问题测试"],
    "工作流：把步骤排清楚": ["收集信息", "补充条件", "判断顺序", "输出 3 步"],
    "老师演示：秒哒生成应用原型": ["写清用户和场景", "写清核心动作", "预览第一版"],
    "生成可打开的 V1": ["生成第一版", "打开预览", "写一条修改指令"],
    "一圈才算跑通": ["看见真实麻烦", "打开作品完成一步", "结果让人愿意再来"],
    "老师演示：商业闭环小地图": ["谁会来", "先做哪一步", "为什么愿意交换"],
    "乔布斯式差异化画布": ["看原来办法", "找不一样一点", "说出惊喜瞬间"],
    "轮到你：把作品连成一圈": ["写用户和麻烦", "写入口和动作", "写结果、交换和不一样的点"],
    "2 分钟 Demo：照着这一圈讲": ["用户进来", "作品帮忙", "结果出现", "说出哪里不一样"],
    "明天发布会要带什么": ["作品能打开", "截图看得懂", "闭环小地图和差异化亮点说得清"],
    "团队讨论：选择创业方向": ["看采访证据", "选一个创业方向", "说出为什么继续做"],
    "需求三问：用户、场景、动作": ["谁会遇到", "在哪里发生", "希望哪个动作变简单"],
    "产品方案一句话": ["帮谁", "解决什么", "用什么动作帮他"],
    "发布会前，材料铺满桌面": ["作品链接", "截图", "采访证据", "分工"],
    "老师演示：WorkBuddy 整理材料包": ["粘贴已有材料", "生成发布顺序", "缩短到孩子能讲"],
    "作品链接和发布 PPT": ["填作品链接", "上传发布 PPT", "确认上台分工"],
    "结论、证据、下一步": ["选 2 个追问", "先答结论", "补证据和下一步"],
    "上台先讲为什么": ["先说想帮谁", "说为什么值得做", "再进入作品"],
    "黄金圈：为什么、怎么做、做出了什么": ["为什么想做", "怎么帮助别人", "做出了什么"],
    "老师演示：把作品讲成黄金圈": ["写一句信念", "演示作品动作", "拿出证据和下一步"],
    "讲出我们的信念和梦想": ["我们相信什么", "我们希望帮谁", "下一版想做到什么"],
    "轮到你：写黄金圈路演稿": ["写为什么", "写怎么帮", "写做出了什么和邀请"],
    "路演问答：听懂问题再回答": ["听懂问题", "拿出证据", "说下一步"],
    "作品页上线清单": ["产品名和一句话", "可打开链接", "截图或演示画面", "用户故事和下一步"],
    "下一次我怎么指挥 AI": ["先说清目标", "用证据检查结果", "继续改到更适合用户"]
  };
  return steps[page.title];
}

function expectedOutputForLesson(module: CourseModule, page: DesignedLessonPage) {
  const outputs: Record<string, string> = {
    "team-building": "提交一张团队名片：团队名、成员和队呼",
    "team-formation": "提交一张帮忙卡：想帮谁、卡在哪、先帮哪一步、AI 可以帮哪一步",
    "problem-wall": "提交一张问题卡：谁、在哪里、遇到什么麻烦",
    "ai-judgement": "提交一张 WorkBuddy 出图卡：画面描述、想修改的细节和下一步",
    "workbuddy-webpage": "提交一句网页任务：给谁用、完成什么动作、看到什么结果",
	    "track-cases": "提交方向问题卡：选的方向、想帮的人、发生场景和要问的问题",
    "ai-superpowers": "提交一张侦察卡：原始烦恼、问题改写、已有方案和继续追问",
    "user-interview": "带回一条用户原话和一个新的发现",
    "project-launch": "写出产品一句话：帮谁、解决什么、怎么解决",
    "day1-reflection": "写下一条下次还能用的 AI 判断方法",
    "day2-kickoff": "圈出今天必须先跑通的一个核心动作",
    "ai-lab": "完成一张五句提示词卡，并用 DeepSeek 检查一次",
    "product-prototype": "提交核心动作卡：功能清单、第一版范围和最小结果",
    [BUSINESS_MODEL_MODULE_ID]: "用 6 个问题说清产品、用户、帮助和交换",
    "tech-route": "提交路线流程卡：路线选择和 3 到 5 步使用流程",
    "tool-demo": "完成一个最小智能体规则或可打开 V1 原型",
    "build-sprint": "作品能打开，别人能完成一个核心动作",
    "user-testing": "收到一条同伴反馈，并写进下一版改动",
    "demo-check": "画出商业闭环小地图，并确认 2 分钟演示能跑通",
    "roadshow-rehearsal": "提交作品链接和发布 PPT，排好上台顺序",
    "value-experiment": "完成价值卡：产品帮别人少烦了什么，别人愿意交换什么",
    "product-packaging": "完成产品海报卡：名字、标语、截图和三条亮点",
    "brand-story": "完成黄金圈路演稿：为什么想做、怎么帮、做出了什么和最后邀请",
    "rehearsal": "完成一轮作品发布彩排，保留最清楚的展示动作",
    "final-showcase": "完成一次作品发布：用户、作品、结果和下一步",
    "awards-reflection": "写下一条自己的真实贡献和下一次 AI 使用方法"
  };
  if (page.page_type === "showcase") return page.content_summary || outputs[module.id];
  return outputs[module.id] || expectedOutputForPage(page);
}

function cardsForPage(module: CourseModule, page: DesignedLessonPage) {
  const design = moduleDesigns[module.id];
  const specialCards = specialCardsForPage(page);
  const childSummary = childFacingSummaryForPage(module, page);
  if (specialCards) return specialCards;
  const beat = lessonBeatForPage(module, page);
  if (beat === "teamwork") {
    return [
      { title: "团队要决定", text: childSummary || "先把小组决定说清楚" },
      { title: "小组产出", text: expectedOutputForLesson(module, page) },
      { title: "老师会看", text: "分工、证据、卡点和下一步是否清楚" }
    ];
  }
  if (beat === "coaching") {
    return [
      { title: "卡点摊开", text: childSummary || "把卡在哪里说成别人能帮忙的一句话" },
      { title: "老师答疑", text: "现场看问题、给建议、帮团队缩小范围" },
      { title: "观察记录", text: "记录每个人在团队里的真实贡献" }
    ];
  }
  if (beat === "story") {
    return [
      { title: "发生了什么", text: childSummary || "先走进一个真实场景" },
      { title: "桌上有什么", text: design?.steps?.[0] || "找一找能继续追的线索" },
      { title: "轮到我们", text: design?.steps?.[1] || "马上动手试一次" }
    ];
  }
  if (beat === "demo") {
    const flow = page.flow ?? design?.flow ?? design?.cards;
    return [
      { title: "老师先演示", text: childSummary || "看一次完整做法" },
      { title: "看变化", text: flow?.[1]?.text || design?.steps?.[1] || "看输入和结果哪里变了" },
      { title: "借方法", text: flow?.[2]?.text || design?.steps?.[2] || "把方法带回自己的作品" }
    ];
  }
  if (beat === "experiment") {
    return [
      { title: "你的实验", text: childSummary || "自己动手试一次" },
      { title: "动手动作", text: design?.steps?.[1] || design?.cards?.[1]?.text || "完成一个小结果" },
      { title: "留下证据", text: expectedOutputForLesson(module, page) }
    ];
  }
  if (beat === "showcase") {
    return [
      { title: "看作品", text: childSummary || "看见同学的真实结果" },
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
      { title: "看见画面", text: childSummary || module.title },
      { title: "马上行动", text: "完成当前课堂动作" },
      { title: "期待结果", text: "准备展示一个可看见的小成果" }
    ]
  );
}

function stepsForPage(page: DesignedLessonPage) {
  return specialStepsForPage(page) ?? page.steps ?? ["看清当前任务", "动手完成一个小版本", "准备展示一个亮点"];
}

function cardLimitForPage(page: DesignedLessonPage, cards: LessonCard[]) {
  if (fourTrackProgressPageTitles.has(page.title)) return Math.min(cards.length, 4);
  if (page.title === "五力证书") return Math.min(cards.length, 5);
  if (page.title === "12 个真实创业方向") return Math.min(cards.length, 4);
  if (page.visual === "roadmap" || page.visual === "demo" || page.visual === "flow") return Math.min(cards.length, 3);
  return Math.min(cards.length, 4);
}

function TrackProjectArtifact({ page }: { page: DesignedLessonPage }) {
  const trackKey = trackProjectForPage(page);
  const track = trackKey ? productTrackOptions.find((item) => item.value === trackKey) : null;
  const choice = trackKey ? trackProjectChoices[trackKey] : null;
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const viewerPointerStartRef = useRef<number | null>(null);
  const activeProject = viewerIndex === null ? null : choice?.projects[viewerIndex] ?? null;

  useEffect(() => {
    if (!choice || viewerIndex === null) return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (!["Escape", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.key === "Escape") setViewerIndex(null);
      if (event.key === "ArrowLeft") {
        setViewerIndex((current) =>
          current === null ? current : (current - 1 + choice.projects.length) % choice.projects.length
        );
      }
      if (event.key === "ArrowRight") {
        setViewerIndex((current) => (current === null ? current : (current + 1) % choice.projects.length));
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [choice, viewerIndex]);

  if (!track || !choice) return null;

  const showPreviousStory = () => {
    setViewerIndex((current) =>
      current === null ? current : (current - 1 + choice.projects.length) % choice.projects.length
    );
  };

  const showNextStory = () => {
    setViewerIndex((current) => (current === null ? current : (current + 1) % choice.projects.length));
  };

  const handleViewerPointerUp = (event: React.PointerEvent) => {
    if (viewerPointerStartRef.current === null) return;
    const distance = event.clientX - viewerPointerStartRef.current;
    viewerPointerStartRef.current = null;
    if (Math.abs(distance) < 48) return;
    if (distance > 0) {
      showPreviousStory();
    } else {
      showNextStory();
    }
  };

  return (
    <div className="timeline-artifact artifact-track-projects">
      <header>
        <small>{track.label}</small>
        <strong>选一个最想帮的人</strong>
        <span>{choice.intro}</span>
      </header>
      {choice.projects.map((project, index) => (
        <article key={project.title}>
          <small>{index + 1}</small>
          <strong>{project.title}</strong>
          <span className="track-project-user">{project.user}</span>
          <figure className="track-comic-figure">
            <button
              type="button"
              className="track-comic-open"
              onClick={() => setViewerIndex(index)}
              aria-label={`放大看：${project.title}`}
            >
              <img src={project.image} alt={project.imageAlt} loading="lazy" />
              <span>放大看故事</span>
            </button>
          </figure>
          <ol className="track-comic-captions" aria-label={`${project.title} 四格字幕`}>
            {project.frames.map((frame, panelIndex) => (
              <li key={`${project.title}-${frame.caption}`}>
                <b>{panelIndex + 1}</b>
                <span>
                  <strong>{frame.caption}</strong>
                  <em>{frame.text}</em>
                </span>
              </li>
            ))}
          </ol>
          <p className="track-story-line">{project.story}</p>
          <em>{project.question}</em>
        </article>
      ))}
      <footer>先选一个身边的人，再问清他哪一步最不方便。</footer>

      {activeProject && viewerIndex !== null && (
        <section className="track-comic-viewer" role="dialog" aria-modal="true" aria-label="放大看故事">
          <button className="track-comic-viewer-close" type="button" onClick={() => setViewerIndex(null)} aria-label="关闭">
            <X size={24} />
          </button>
          <button className="track-comic-viewer-nav previous" type="button" onClick={showPreviousStory} aria-label="上一个故事">
            <ChevronLeft size={34} />
          </button>
          <figure
            onPointerDown={(event) => {
              viewerPointerStartRef.current = event.clientX;
            }}
            onPointerUp={handleViewerPointerUp}
          >
            <img src={activeProject.image} alt={activeProject.imageAlt} draggable={false} />
            <figcaption>
              <div className="track-comic-viewer-head">
                <small>{track.label}</small>
                <strong>{activeProject.title}</strong>
                <span>{activeProject.user}</span>
              </div>
              <ol className="track-comic-viewer-captions" aria-label={`${activeProject.title} 四格字幕`}>
                {activeProject.frames.map((frame, panelIndex) => (
                  <li key={`${activeProject.title}-${frame.caption}`}>
                    <b>{panelIndex + 1}</b>
                    <span>
                      <strong>{frame.caption}</strong>
                      <em>{frame.text}</em>
                    </span>
                  </li>
                ))}
              </ol>
              <p>{activeProject.story}</p>
              <em>{activeProject.question}</em>
            </figcaption>
          </figure>
          <button className="track-comic-viewer-nav next" type="button" onClick={showNextStory} aria-label="下一个故事">
            <ChevronRight size={34} />
          </button>
        </section>
      )}
    </div>
  );
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
      ["桌号", "找到团队桌", "先坐到一起"],
      ["名称", "给团队起名", "起一个能被记住的名字"],
      ["队呼", "一起喊出来", "一句能把大家叫到一起的话"]
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

	  if (kind === "track-map") {
	    return (
	      <div className="timeline-artifact artifact-track-map">
	        <header>
	          <strong>先从身边找真实需要</strong>
	          <span>家里、学校、社区都有可以观察的人。先看谁做事时不方便，办法等会儿再发明。</span>
	        </header>
	        {productTrackOptions.map((track, index) => (
	          <article key={track.value}>
	            <small>{String.fromCharCode(65 + index)}</small>
	            <strong>{track.label}</strong>
	            <span>{track.hint}</span>
	            <div>
	              {track.directions.map((direction) => (
	                <b key={direction}>{direction}</b>
	              ))}
	            </div>
	          </article>
	        ))}
	      </div>
	    );
	  }

	  if (kind === "track-projects") {
	    return <TrackProjectArtifact page={page} />;
	  }

	  if (kind === "direction-question") {
	    const fields = [
	      ["我们选的方向", "生活、学习、创意或校园"],
	      ["想帮助的人", "一个能找到、能问到的人"],
	      ["发生场景", "什么时候、在哪里卡住"],
	      ["先问哪一句", "先问发生过吗、多久一次、现在怎么做"]
	    ];
	    return (
	      <div className="timeline-artifact artifact-direction-question">
	        <header>
	          <strong>先把问题带回小组</strong>
	          <span>办法由你们小组继续发明。</span>
	        </header>
	        {fields.map(([title, text], index) => (
	          <article key={title}>
	            <small>{index + 1}</small>
	            <strong>{title}</strong>
	            <span>{text}</span>
	          </article>
	        ))}
	      </div>
	    );
	  }

	  if (kind === "direction-map") {
	    return (
      <div className="timeline-artifact artifact-directions">
        {productTrackOptions.map((track, index) => {
          const example = productTrackExamples[track.value];
          return (
            <article key={track.value}>
              <small>{String.fromCharCode(65 + index)}</small>
              <strong>{track.label}</strong>
              <span>{track.hint}</span>
              <div className="track-example-lines">
                <p><b>需求</b>{example.need}</p>
                <p><b>产品</b>{example.product}</p>
                <p><b>价值</b>{example.value}</p>
              </div>
              <div className="direction-chip-list">
                {track.directions.map((direction) => (
                  <b key={direction}>{direction}</b>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  if (kind === "product-sentence") {
    return (
      <div className="timeline-artifact artifact-sentence">
        <span>为</span>
        <strong>想帮的人</strong>
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

  if (kind === "business-loop") {
    const loop = [
      ["用户", "谁会来"],
      ["麻烦", "他卡在哪里"],
      ["入口", "从哪里打开"],
      ["动作", "先完成哪一步"],
      ["结果", "少烦了什么"],
      ["交换", "愿意拿什么来换"],
      ["再来", "为什么下次还会用"]
    ];
    return (
      <div className="timeline-artifact artifact-business-loop">
        {loop.map(([label, text], index) => (
          <React.Fragment key={label}>
            <article>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <strong>{label}</strong>
              <span>{text}</span>
            </article>
            {index < loop.length - 1 && <em>→</em>}
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (kind === "differentiation-canvas") {
    const fields = [
      ["谁会用", "一个真实用户"],
      ["原来办法", "他现在怎么凑合"],
      ["不一样一点", "更省心、更好玩或更容易坚持"],
      ["惊喜瞬间", "哪一秒让他想继续用"],
      ["交换理由", "为什么愿意再来或推荐"]
    ];
    return (
      <div className="timeline-artifact artifact-differentiation">
        <header>
          <strong>差异化画布</strong>
          <span>不是功能更多，是一个体验更值得被记住。</span>
        </header>
        {fields.map(([title, text], index) => (
          <article key={title}>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <strong>{title}</strong>
            <span>{text}</span>
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
      ["发布 PPT", "只放需要展示的页"],
      ["证据", "采访和试玩反馈"],
      ["分工", "每个人一段"]
    ];
    return (
      <div className="timeline-artifact artifact-roadshow-pack">
        <header>
          <ClipboardCheck size={22} />
          <strong>发布材料包</strong>
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
    const items = /黄金圈|为什么|信念|梦想|路演/.test(page.title)
      ? ["为什么", "怎么帮", "做出了什么", "证据", "邀请"]
      : ["人物", "麻烦", "办法", "证据", "邀请"];
    return (
      <div className="timeline-artifact artifact-story">
        {items.map((item) => (
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
    2: "一句话：你给线索，它先读懂",
    3: "一句话：照片、职业和任务会一起影响结果",
    4: "一句话：大模型靠很多例子学会找规律",
    5: "一句话：照片、职业和要求会一起变成线索",
    6: "现在做：先写清楚，再挑一句能带回小组的话",
    10: "现在做：把脑子里的画说成一句清楚的话",
    11: "现在做：用 WorkBuddy 画一张，再继续改一处"
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
            <strong>照相馆后面，像坐着一个电脑里的聪明大脑。</strong>
          </div>
          <div className="ai-clue-cards" aria-label="给 AI 的三条线索">
            <article>
              <MessageSquareText size={24} />
              <strong>看过很多字</strong>
              <span>问题、故事、任务单</span>
            </article>
            <article>
              <Image size={24} />
              <strong>看过很多图</strong>
              <span>照片、工具、场景</span>
            </article>
            <article>
              <Mic size={24} />
              <strong>听过很多问法</strong>
              <span>别人怎么向它提要求</span>
            </article>
          </div>
          <div className="ai-kid-prompt">
            <span>你给它清楚线索，它才更接近你的想法。</span>
          </div>
        </section>
        <section className="ai-brain-workshop" aria-label="AI 怎么工作">
          <div className="ai-smart-brain" aria-label="电脑里的聪明大脑">
            <Brain size={64} />
            <strong>AI 大脑</strong>
            <span>先看线索，再往下猜</span>
          </div>
          <div className="ai-output-cards" aria-label="AI 生成的结果">
            <article>
              <MessageSquareText size={24} />
              <strong>读懂线索</strong>
              <span>先看你给了什么材料</span>
            </article>
            <article>
              <Sparkles size={24} />
              <strong>生成第一版</strong>
              <span>顺着线索继续画出来</span>
            </article>
            <article>
              <Lightbulb size={24} />
              <strong>还要修改</strong>
              <span>哪里不像，由人继续说清</span>
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
            <strong>你给的线索太少，AI 就不知道该往哪画</strong>
          </header>
          <main className="ai-chat-thread">
            <article className="ai-chat-bubble from-kid">
              <small>你说</small>
              <b>帮我做个好产品。</b>
            </article>
            <div className="ai-demo-arrow" aria-label="AI 读懂问题再回答">
              <MessageSquareText size={18} />
              <span>线索不够</span>
            </div>
            <article className="ai-chat-bubble from-ai">
              <small>AI 回答</small>
              <b>你可以先调研需求、设计功能、优化体验，做出一个优秀产品。</b>
            </article>
          </main>
          <div className="ai-chat-steps">
            <span>没说帮谁</span>
            <span>没说卡哪</span>
            <span>没说今天先要什么</span>
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
          <div className="ai-visual-sentence">同一个 AI，要求一清楚，答案马上就能用</div>
          <main>
            <article className="weak-prompt">
              <small>这样问太散</small>
              <b>帮我做个学习产品。</b>
              <span>它不知道先帮谁，也不知道先做哪一步</span>
            </article>
            <div className="ai-demo-arrow" aria-label="老师把问题说清楚">
              <Sparkles size={18} />
              <span>说清楚</span>
            </div>
            <article className="clear-prompt">
              <small>这样问能用</small>
              <b>请不要直接算答案，只帮 10 岁孩子把这道应用题拆成谁、已知、要求和第一步。</b>
              <span>它就能交出长应用题第一步的第一版</span>
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
          <span className="ai-photo-tag tag-left">见过很多图</span>
          <span className="ai-photo-tag tag-right">记住常见搭配</span>
          <figcaption>它不是背答案，而是从很多例子里慢慢学规律</figcaption>
        </figure>
        <div className="ai-sense-stack">
          <div className="ai-visual-sentence">它见得越多，猜下一步就越像样</div>
          <article>
            <MessageSquareText size={24} />
            <strong>雨天常配什么</strong>
            <span>雨伞、雨鞋、湿地面</span>
          </article>
          <article>
            <Image size={24} />
            <strong>兽医常配什么</strong>
            <span>小动物、白大褂、听诊器</span>
          </article>
          <article className="ai-dark-card">
            <Sparkles size={24} />
            <strong>所以它会猜</strong>
            <span>下一张画面最像什么</span>
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
          <span className="ai-photo-tag tag-left">原来的你</span>
          <span className="ai-photo-tag tag-right">它猜出的未来画面</span>
          <figcaption>未来照相馆不是魔法，是 AI 按线索交出第一版</figcaption>
        </figure>
        <div className="ai-case-board">
          <div className="ai-visual-sentence">照片 + 职业 + 要求 = AI 猜出的未来想象照</div>
          <div className="ai-equation-strip">
            <span>我的照片</span>
            <b>+</b>
            <span>我想当什么</span>
            <b>+</b>
            <span>请画成什么样</span>
            <b>=</b>
            <strong>新照片</strong>
          </div>
          <div className="ai-camera-core" aria-label="AI 收到三条线索">
            <Sparkles size={28} />
            <strong>AI 交第一版</strong>
            <span>多数靠谱，偶尔也会瞎编</span>
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
        <div className="ai-visual-sentence">像给同伴派任务一样，把空格填清楚</div>
        <p>请你当 <b>产品顾问</b></p>
        <p>我们想先帮 <b>________</b><span className="ai-cursor" aria-hidden="true">|</span></p>
        <p>请用三句话告诉我们：</p>
        <footer>
          <span>卡在哪？</span>
          <span>先做哪步？</span>
          <span>交回什么结果？</span>
        </footer>
      </div>
      <div className="ai-sort-board">
        <header>
          <Search size={24} />
          <strong>挑一句带回小组</strong>
        </header>
        <div className="ai-example-answer">“一看到长应用题就不知道从哪下手的同学，先需要一张第一步提示卡。”</div>
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

type TetrisBoard = Array<Array<string | null>>;
type TetrisPiece = {
  name: string;
  color: string;
  shape: number[][];
  row: number;
  col: number;
};

const tetrisRows = 16;
const tetrisCols = 10;
const tetrisShapes = [
  { name: "I", color: "#48c6ef", shape: [[1, 1, 1, 1]] },
  { name: "O", color: "#f7d66d", shape: [[1, 1], [1, 1]] },
  { name: "T", color: "#8f7cf4", shape: [[0, 1, 0], [1, 1, 1]] },
  { name: "L", color: "#ef7d58", shape: [[1, 0], [1, 0], [1, 1]] },
  { name: "S", color: "#49b36d", shape: [[0, 1, 1], [1, 1, 0]] }
] as const;

function createEmptyTetrisBoard(): TetrisBoard {
  return Array.from({ length: tetrisRows }, () => Array.from({ length: tetrisCols }, () => null));
}

function createTetrisPiece(index = Math.floor(Math.random() * tetrisShapes.length)): TetrisPiece {
  const template = tetrisShapes[index % tetrisShapes.length];
  const shape = template.shape.map((row) => [...row]);
  return {
    name: template.name,
    color: template.color,
    shape,
    row: 0,
    col: Math.floor((tetrisCols - shape[0].length) / 2)
  };
}

function rotateTetrisShape(shape: number[][]) {
  return shape[0].map((_, colIndex) => shape.map((row) => row[colIndex]).reverse());
}

function tetrisCollides(board: TetrisBoard, piece: TetrisPiece, row = piece.row, col = piece.col, shape = piece.shape) {
  for (let y = 0; y < shape.length; y += 1) {
    for (let x = 0; x < shape[y].length; x += 1) {
      if (!shape[y][x]) continue;
      const boardRow = row + y;
      const boardCol = col + x;
      if (boardCol < 0 || boardCol >= tetrisCols || boardRow >= tetrisRows) return true;
      if (boardRow >= 0 && board[boardRow][boardCol]) return true;
    }
  }
  return false;
}

function mergeTetrisPiece(board: TetrisBoard, piece: TetrisPiece): TetrisBoard {
  const nextBoard = board.map((row) => [...row]);
  piece.shape.forEach((shapeRow, y) => {
    shapeRow.forEach((cell, x) => {
      if (!cell) return;
      const boardRow = piece.row + y;
      const boardCol = piece.col + x;
      if (boardRow >= 0 && boardRow < tetrisRows && boardCol >= 0 && boardCol < tetrisCols) {
        nextBoard[boardRow][boardCol] = piece.color;
      }
    });
  });
  return nextBoard;
}

function clearTetrisLines(board: TetrisBoard) {
  const remaining = board.filter((row) => row.some((cell) => !cell));
  const cleared = tetrisRows - remaining.length;
  const emptyRows = Array.from({ length: cleared }, () => Array.from({ length: tetrisCols }, () => null));
  return {
    board: [...emptyRows, ...remaining],
    cleared
  };
}

function PlayableTetrisSlide({ module, page }: { module: CourseModule; page: DesignedLessonPage }) {
  const gameRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState<TetrisBoard>(() => createEmptyTetrisBoard());
  const [piece, setPiece] = useState<TetrisPiece>(() => createTetrisPiece(2));
  const [nextShapeIndex, setNextShapeIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const nextShape = tetrisShapes[nextShapeIndex % tetrisShapes.length];
  const paintedBoard = useMemo(() => mergeTetrisPiece(board, piece), [board, piece]);

  function focusGame() {
    window.setTimeout(() => gameRef.current?.focus(), 0);
  }

  function resetGame() {
    setBoard(createEmptyTetrisBoard());
    setPiece(createTetrisPiece(2));
    setNextShapeIndex(Math.floor(Math.random() * tetrisShapes.length));
    setScore(0);
    setLines(0);
    setGameOver(false);
    setRunning(true);
    focusGame();
  }

  function lockPieceAndSpawn(lockedPiece: TetrisPiece) {
    const merged = mergeTetrisPiece(board, lockedPiece);
    const result = clearTetrisLines(merged);
    const nextPiece = createTetrisPiece(nextShapeIndex);
    const nextIndex = Math.floor(Math.random() * tetrisShapes.length);
    setBoard(result.board);
    setScore((value) => value + 10 + result.cleared * 120 + result.cleared * result.cleared * 40);
    setLines((value) => value + result.cleared);
    setNextShapeIndex(nextIndex);
    if (tetrisCollides(result.board, nextPiece)) {
      setRunning(false);
      setGameOver(true);
    }
    return nextPiece;
  }

  function movePiece(deltaCol: number) {
    if (!running || gameOver) return;
    setPiece((current) => {
      if (tetrisCollides(board, current, current.row, current.col + deltaCol)) return current;
      return { ...current, col: current.col + deltaCol };
    });
    focusGame();
  }

  function rotatePiece() {
    if (!running || gameOver) return;
    setPiece((current) => {
      const rotated = rotateTetrisShape(current.shape);
      for (const kick of [0, -1, 1, -2, 2]) {
        if (!tetrisCollides(board, current, current.row, current.col + kick, rotated)) {
          return { ...current, shape: rotated, col: current.col + kick };
        }
      }
      return current;
    });
    focusGame();
  }

  function dropOneStep() {
    if (!running || gameOver) return;
    setPiece((current) => {
      if (!tetrisCollides(board, current, current.row + 1, current.col)) {
        return { ...current, row: current.row + 1 };
      }
      return lockPieceAndSpawn(current);
    });
    focusGame();
  }

  function dropToBottom() {
    if (!running || gameOver) return;
    setPiece((current) => {
      let row = current.row;
      while (!tetrisCollides(board, current, row + 1, current.col)) {
        row += 1;
      }
      return lockPieceAndSpawn({ ...current, row });
    });
    focusGame();
  }

  function toggleRunning() {
    if (gameOver) {
      resetGame();
      return;
    }
    setRunning((value) => !value);
    focusGame();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "Enter"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    if (event.key === "Enter" && !running) {
      toggleRunning();
      return;
    }
    if (event.key === "ArrowLeft") movePiece(-1);
    if (event.key === "ArrowRight") movePiece(1);
    if (event.key === "ArrowDown") dropOneStep();
    if (event.key === "ArrowUp") rotatePiece();
    if (event.key === " ") dropToBottom();
  }

  useEffect(() => {
    if (!running || gameOver) return undefined;
    const timer = window.setInterval(() => {
      setPiece((current) => {
        if (!tetrisCollides(board, current, current.row + 1, current.col)) {
          return { ...current, row: current.row + 1 };
        }
        return lockPieceAndSpawn(current);
      });
    }, 650);
    return () => window.clearInterval(timer);
  }, [board, gameOver, nextShapeIndex, running]);

  return (
    <article className="lesson-canvas timeline-slide playable-tetris-slide accent-mint module-workbuddy-webpage">
      <div className="timeline-copy">
        <small>{page.kicker || `${module.time_range || `D${module.day}`} · 故事开场`}</small>
        <h2>{page.title}</h2>
        <p>把想要的玩法说清楚，WorkBuddy 才知道要做出什么。</p>
        <div className="timeline-chip-row">
          <span>完整提示词</span>
          <span>能打开</span>
          <span>能操作</span>
        </div>
        <div className="lesson-beat-strip" aria-label="教学节奏">
          <span className="active">故事开场</span>
          <span>老师演示</span>
          <span>轮到你实验</span>
        </div>
      </div>
      <div
        ref={gameRef}
        className="tetris-stage"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={focusGame}
        aria-label="可玩的俄罗斯方块页面"
      >
        <header className="tetris-browser-bar">
          <span />
          <span />
          <span />
          <strong>tetris.html</strong>
        </header>
        <div className="tetris-prompt">
          <small>发给 WorkBuddy</small>
          <div>
            <strong>我想做一个能玩的俄罗斯方块小游戏，放在网页里。</strong>
            <ul>
              <li>打开后可以马上开始玩。</li>
              <li>方块会自己往下掉。</li>
              <li>方向键可以左移、右移、旋转、加速下落。</li>
              <li>一行填满就消掉，并且加分。</li>
              <li>旁边显示分数、下一块、开始、暂停、重开。</li>
              <li>画面要清楚，投到大屏上也能看懂。</li>
            </ul>
          </div>
        </div>
        <div className="tetris-layout">
          <div className="tetris-board-wrap">
            <div
              className="tetris-board"
              style={{ gridTemplateColumns: `repeat(${tetrisCols}, minmax(0, 1fr))` }}
              aria-label="俄罗斯方块游戏区"
            >
              {paintedBoard.flatMap((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <span
                    key={`${rowIndex}-${colIndex}`}
                    className={`tetris-cell${cell ? " filled" : ""}`}
                    style={{ "--cell-color": cell || "transparent" } as React.CSSProperties}
                  />
                ))
              )}
            </div>
            {!running && (
              <button type="button" className="tetris-overlay" onClick={toggleRunning}>
                {gameOver ? "再来一局" : "开始玩"}
              </button>
            )}
          </div>
          <aside className="tetris-side">
            <div className="tetris-score-row">
              <article>
                <small>分数</small>
                <strong>{score}</strong>
              </article>
              <article>
                <small>行数</small>
                <strong>{lines}</strong>
              </article>
            </div>
            <div className="tetris-next">
              <small>下一块</small>
              <div
                className="tetris-mini-grid"
                style={{
                  gridTemplateColumns: `repeat(${nextShape.shape[0].length}, minmax(0, 1fr))`
                }}
              >
                {nextShape.shape.flatMap((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <span
                      key={`${nextShape.name}-${rowIndex}-${colIndex}`}
                      className={cell ? "filled" : ""}
                      style={{ "--cell-color": cell ? nextShape.color : "transparent" } as React.CSSProperties}
                    />
                  ))
                )}
              </div>
            </div>
            <div className="tetris-actions">
              <button type="button" onClick={toggleRunning} title={running ? "暂停" : "开始"}>
                {running ? <Pause size={18} /> : <Play size={18} />}
                <span>{running ? "暂停" : gameOver ? "再来" : "开始"}</span>
              </button>
              <button type="button" onClick={resetGame} title="重开">
                <RotateCcw size={18} />
                <span>重开</span>
              </button>
            </div>
            <div className="tetris-controls" aria-label="游戏按钮">
              <button type="button" onClick={() => movePiece(-1)} title="向左">
                <ChevronLeft size={20} />
              </button>
              <button type="button" onClick={rotatePiece} title="旋转">
                <RotateCw size={20} />
              </button>
              <button type="button" onClick={() => movePiece(1)} title="向右">
                <ChevronRight size={20} />
              </button>
              <button type="button" onClick={dropOneStep} title="向下">
                <ArrowDown size={20} />
              </button>
            </div>
            <p>方向键也可以玩，空格直接落下。</p>
          </aside>
        </div>
        <footer className="tetris-result">
          <Sparkles size={18} />
          <span>一句话，变成能玩的网页作品</span>
        </footer>
      </div>
    </article>
  );
}

function DesignedLessonSlide({ module, page }: { module: CourseModule; page: DesignedLessonPage }) {
  const design = moduleDesigns[module.id];
  const Icon = design?.icon ?? Lightbulb;
  const cards = cardsForPage(module, page);
  const steps = stepsForPage(page);
  const childSummary = childFacingSummaryForPage(module, page);
  const artifactKind = artifactKindForPage(module, page);
  const isTrackComicPage = artifactKind === "track-projects";
  const isTrackCasesModule = module.id === "track-cases";
  const isAiPrincipleModule = module.id === "ai-judgement";
  const beat = lessonBeatForPage(module, page);
  const isKnowledgePage = (!isTrackCasesModule && isKnowledgeInputPage(module, page)) || module.id === "future-photo-studio";
  const pblStep = pblStepForPage(page);
  const trackCaseStep = page.page_no >= 7 ? "question" : page.page_no >= 6 ? "choose" : "story";
  const visualLabel = isTrackCasesModule
    ? artifactKind === "track-map" || artifactKind === "track-projects"
      ? "小故事"
      : page.page_type === "teamwork"
      ? "小组选择"
      : "去问真人"
    : pageTypeLabel(page.page_type);
  const visibleCards = cards.slice(0, cardLimitForPage(page, cards));
  const gridClass = [
    page.visual === "showcase" ? "timeline-showcase" : "timeline-card-grid",
    visibleCards.length >= 5 ? "dense" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={`lesson-canvas timeline-slide accent-${page.accent || "mint"} visual-${page.visual || "cards"} module-${module.id}${isTrackComicPage ? " track-comic-slide" : ""}`}
    >
      <div className="timeline-copy">
        <small>{page.kicker || `${module.time_range || `D${module.day}`} · ${pageTypeLabel(page.page_type)}`}</small>
        <h2>{page.title}</h2>
        <p>{childSummary}</p>
        <div className="timeline-chip-row">
          {(specialChipsForPage(page) || page.chips || []).slice(0, 6).map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
        <div className="lesson-beat-strip" aria-label="教学节奏">
          {isTrackCasesModule ? (
            <>
              <span className={trackCaseStep === "story" ? "active" : ""}>看小故事</span>
              <span className={trackCaseStep === "choose" ? "active" : ""}>圈想帮的人</span>
              <span className={trackCaseStep === "question" ? "active" : ""}>带问题去问</span>
            </>
          ) : isKnowledgePage ? (
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
            {visualLabel}
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

function CaseComicSlide({ deck }: { deck: CaseComicDeck }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const viewerPointerStartRef = useRef<number | null>(null);
  const activeFrame = viewerIndex === null ? null : deck.frames[viewerIndex];

  useEffect(() => {
    if (viewerIndex === null) return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (!["Escape", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.key === "Escape") setViewerIndex(null);
      if (event.key === "ArrowLeft") {
        setViewerIndex((current) =>
          current === null ? current : (current - 1 + deck.frames.length) % deck.frames.length
        );
      }
      if (event.key === "ArrowRight") {
        setViewerIndex((current) => (current === null ? current : (current + 1) % deck.frames.length));
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [deck.frames.length, viewerIndex]);

  const showPreviousFrame = () => {
    setViewerIndex((current) =>
      current === null ? current : (current - 1 + deck.frames.length) % deck.frames.length
    );
  };

  const showNextFrame = () => {
    setViewerIndex((current) => (current === null ? current : (current + 1) % deck.frames.length));
  };

  const handleViewerPointerUp = (event: React.PointerEvent) => {
    if (viewerPointerStartRef.current === null) return;
    const distance = event.clientX - viewerPointerStartRef.current;
    viewerPointerStartRef.current = null;
    if (Math.abs(distance) < 48) return;
    if (distance > 0) {
      showPreviousFrame();
    } else {
      showNextFrame();
    }
  };

  return (
    <article className="lesson-canvas door-comic-slide">
      <header className="door-comic-head">
        <span>{deck.eyebrow}</span>
        <h2>{deck.title}</h2>
        <p>{deck.subtitle}</p>
      </header>

      <section className="door-comic-grid" aria-label={deck.ariaLabel}>
        {deck.frames.map((frame, index) => (
          <article className="door-comic-frame" key={frame.image}>
            <button
              type="button"
              className="door-comic-art"
              onClick={() => setViewerIndex(index)}
              aria-label={`放大看第 ${index + 1} 格：${frame.caption}`}
            >
              <img src={frame.image} alt={frame.alt} />
            </button>
            <p>
              <strong>{index + 1}</strong>
              <span className="door-comic-copy">
                <span className="door-comic-line">{frame.caption}</span>
                <span className="door-comic-text">{frame.text}</span>
              </span>
            </p>
          </article>
        ))}
      </section>

      <footer className="door-comic-close">
        <span>{deck.closing.before}</span>
        <strong>{deck.closing.strong}</strong>
        <span>{deck.closing.after}</span>
      </footer>

      {activeFrame && viewerIndex !== null && (
        <section className="door-comic-viewer" role="dialog" aria-modal="true" aria-label="连环画浏览">
          <button className="door-comic-viewer-close" type="button" onClick={() => setViewerIndex(null)} aria-label="关闭连环画">
            <X size={24} />
          </button>
          <button className="door-comic-viewer-nav previous" type="button" onClick={showPreviousFrame} aria-label="上一格">
            <ChevronLeft size={34} />
          </button>
          <figure
            onPointerDown={(event) => {
              viewerPointerStartRef.current = event.clientX;
            }}
            onPointerUp={handleViewerPointerUp}
          >
            <img src={activeFrame.image} alt={activeFrame.alt} draggable={false} />
            <figcaption>
              <strong>{viewerIndex + 1} / {deck.frames.length}</strong>
              <span className="door-comic-copy door-comic-viewer-copy">
                <span className="door-comic-line">{activeFrame.caption}</span>
                <span className="door-comic-text">{activeFrame.text}</span>
              </span>
            </figcaption>
          </figure>
          <button className="door-comic-viewer-nav next" type="button" onClick={showNextFrame} aria-label="下一格">
            <ChevronRight size={34} />
          </button>
        </section>
      )}
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
  const caseComicDeck = caseComicForPage(module, page);

  if (page.slide_image) {
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

  if (module.id === "workbuddy-webpage" && page.title === "一句话让小游戏跑起来") {
    return <PlayableTetrisSlide module={module} page={page} />;
  }

  if (caseComicDeck) {
    return <CaseComicSlide deck={caseComicDeck} />;
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
  htmlCoursewareHref,
  onClose,
  onOpenPhoto
}: {
  module: CourseModule;
  pages: DesignedLessonPage[];
  students: Student[];
  initialPageIndex: number;
  htmlCoursewareHref?: string;
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

  if (htmlCoursewareHref) {
    return (
      <section className="presentation-overlay html-courseware">
        <button className="close-presentation" onClick={onClose} aria-label="关闭演示">
          <X size={24} />
        </button>
        <iframe
          key={htmlCoursewareHref}
          className="presentation-html-frame"
          src={htmlCoursewareHref}
          title={`${lessonModuleTitle(module)}四案例 HTML 课件全屏演示`}
          allowFullScreen
        />
      </section>
    );
  }

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
  const [teamChant, setTeamChant] = useState("");
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [targetUser, setTargetUser] = useState("");
  const [stuckPoint, setStuckPoint] = useState("");
  const [otherUsers, setOtherUsers] = useState("");
  const [firstStep, setFirstStep] = useState("");
  const [lessTrouble, setLessTrouble] = useState("");
  const [aiHelpStep, setAiHelpStep] = useState("");
  const [exchangeGuess, setExchangeGuess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);
  const activeTaskTitle = taskTitle || camp?.active_task?.title || "";
  const isTeamNameOnly =
    camp?.active_task?.module_id === "team-building" ||
    /组建团队|找到今天的队友|给团队起一个名字|起队名|队呼|团队亮个相/.test(activeTaskTitle);

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
        setTeamChant((current) => current.trim() || asText(latestTeamCard?.payload.team_chant).trim());
        setTargetUser((current) =>
          current.trim() ||
          asText(latestTeamCard?.payload.target_user).trim() ||
          asText(latestTeamCard?.payload.product_direction).trim() ||
          asText(latestTeamCard?.payload.direction).trim()
        );
        setStuckPoint((current) => current.trim() || asText(latestTeamCard?.payload.stuck_point).trim());
        setOtherUsers((current) => current.trim() || asText(latestTeamCard?.payload.other_users).trim());
        setFirstStep((current) => current.trim() || asText(latestTeamCard?.payload.first_step).trim());
        setLessTrouble((current) => current.trim() || asText(latestTeamCard?.payload.less_trouble).trim());
        setAiHelpStep((current) => current.trim() || asText(latestTeamCard?.payload.ai_help_step).trim());
        setExchangeGuess((current) => current.trim() || asText(latestTeamCard?.payload.exchange_guess).trim());
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [student.team_name]);

  const submit = async () => {
    if (!teamName.trim()) {
      showMessage("error", "先起一个能被记住的队名。");
      return;
    }
    if (isTeamNameOnly && !teamChant.trim()) {
      showMessage("error", "再想一句全队能一起喊出来的队呼。");
      return;
    }
    if (!isTeamNameOnly && !targetUser.trim()) {
      showMessage("error", "先写你们想帮谁。");
      return;
    }
    if (!isTeamNameOnly && !stuckPoint.trim()) {
      showMessage("error", "写清他卡在哪一步。");
      return;
    }
    if (!isTeamNameOnly && !firstStep.trim()) {
      showMessage("error", "写清你们先帮哪一步。");
      return;
    }
    if (!isTeamNameOnly && !lessTrouble.trim()) {
      showMessage("error", "写清帮完以后少掉什么麻烦。");
      return;
    }
    const aiHelpLine = aiHelpStep.trim() ? `，AI 可以先帮${aiHelpStep.trim()}` : "";
    const productDirection = isTeamNameOnly
      ? ""
      : `帮${targetUser.trim()}，先做${firstStep.trim()}，让他少掉${lessTrouble.trim()}${aiHelpLine}`;
    const launchLine = isTeamNameOnly
      ? `我们是${teamName.trim()}。${teamChant.trim()}`
      : `我们是${teamName.trim()}，想帮${targetUser.trim()}。他卡在${stuckPoint.trim()}，第一版先做${firstStep.trim()}，让他少掉${lessTrouble.trim()}${aiHelpLine}。`;
    setSubmitting(true);
    setMessage(null);
    try {
      await api.submitTask({
        task_type: "team_card",
        title: taskTitle,
        payload: {
          team_name: teamName.trim(),
          team_chant: teamChant.trim(),
          team_members: teamMembers.join("、") || student.nickname,
          target_user: targetUser.trim(),
          stuck_point: stuckPoint.trim(),
          other_users: otherUsers.trim(),
          first_step: firstStep.trim(),
          less_trouble: lessTrouble.trim(),
          ai_help_step: aiHelpStep.trim(),
          exchange_guess: exchangeGuess.trim(),
          product_direction: productDirection,
          launch_line: launchLine,
          team_id: student.team_id || "",
          class_team_name: student.team_name || ""
        }
      });
      showMessage("success", isTeamNameOnly ? "收到。你们的队名和队呼已经准备亮相。" : "收到。你们的帮忙卡已经上墙准备亮相。");
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
        <h1>{taskTitle || (isTeamNameOnly ? "起队名和队呼" : "写第一张帮忙卡")}</h1>
        <p>{isTeamNameOnly ? "老师已经分好成员。你们先起队名，再想一句队呼。" : "老师已经分好成员。你们来决定团队名和第一张帮忙卡。"}</p>
        <div className="student-card d1-task-card team-card-form">
          <div className="student-current">
            <div>
              <span>{teamName ? "队名" : "分组"}</span>
              <strong>{teamName || student.team_name || "还在分组"}</strong>
              <small>{teamMembers.length ? teamMembers.join("、") : student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            <span className="field-helper-row">
              <span>队名</span>
              <FieldVoiceButton
                fieldKey="team-name"
                label="说队名"
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
          {isTeamNameOnly && (
            <label>
              <span className="field-helper-row">
                <span>队呼</span>
                <FieldVoiceButton
                  fieldKey="team-chant"
                  label="说队呼"
                  listeningKey={listeningKey}
                  onStart={() => startVoiceInput("team-chant", setTeamChant)}
                />
              </span>
              <input
                value={teamChant}
                onChange={(event) => setTeamChant(event.target.value)}
                placeholder="例如：闪电闪电，马上开工！"
                inputMode="text"
              />
            </label>
          )}
          {teamMembers.length > 0 && (
            <div className="team-member-chips" aria-label="团队成员">
              {teamMembers.map((member) => (
                <span key={member}>{member}</span>
              ))}
            </div>
          )}
          {!isTeamNameOnly && (
            <>
              <label>
                <span className="field-helper-row">
                  <span>我们想帮谁</span>
                  <FieldVoiceButton
                    fieldKey="target-user"
                    label="说出你们想帮谁"
                    listeningKey={listeningKey}
                    onStart={() => startVoiceInput("target-user", setTargetUser)}
                  />
                </span>
                <textarea
                  value={targetUser}
                  onChange={(event) => setTargetUser(event.target.value)}
                  placeholder="例如：课间拿不定主意的同学"
                  rows={2}
                />
              </label>
              <label>
                <span className="field-helper-row">
                  <span>他卡在哪</span>
                  <FieldVoiceButton
                    fieldKey="stuck-point"
                    label="说出卡住的一步"
                    listeningKey={listeningKey}
                    onStart={() => startVoiceInput("stuck-point", setStuckPoint)}
                  />
                </span>
                <textarea
                  value={stuckPoint}
                  onChange={(event) => setStuckPoint(event.target.value)}
                  placeholder="例如：大家讨论玩什么就花掉很多时间"
                  rows={2}
                />
              </label>
              <label>
                <span className="field-helper-row">
                  <span>还有谁也会遇到</span>
                  <FieldVoiceButton
                    fieldKey="other-users"
                    label="说出还有谁会遇到"
                    listeningKey={listeningKey}
                    onStart={() => startVoiceInput("other-users", setOtherUsers)}
                  />
                </span>
                <textarea
                  value={otherUsers}
                  onChange={(event) => setOtherUsers(event.target.value)}
                  placeholder="例如：别的班同学、兴趣小组、放学后的同学"
                  rows={2}
                />
              </label>
              <label>
                <span className="field-helper-row">
                  <span>我们先帮哪一步</span>
                  <FieldVoiceButton
                    fieldKey="first-step"
                    label="说出先帮哪一步"
                    listeningKey={listeningKey}
                    onStart={() => startVoiceInput("first-step", setFirstStep)}
                  />
                </span>
                <textarea
                  value={firstStep}
                  onChange={(event) => setFirstStep(event.target.value)}
                  placeholder="例如：先生成上学出门清单，或者先把应用题拆成四块"
                  rows={2}
                />
              </label>
              <label>
                <span className="field-helper-row">
                  <span>帮完以后少掉什么麻烦</span>
                  <FieldVoiceButton
                    fieldKey="less-trouble"
                    label="说出少掉什么麻烦"
                    listeningKey={listeningKey}
                    onStart={() => startVoiceInput("less-trouble", setLessTrouble)}
                  />
                </span>
                <textarea
                  value={lessTrouble}
                  onChange={(event) => setLessTrouble(event.target.value)}
                  placeholder="例如：出门前不用一遍遍问有没有漏带"
                  rows={2}
                />
              </label>
              <label>
                <span className="field-helper-row">
                  <span>AI 可以先帮哪一步（可选）</span>
                  <FieldVoiceButton
                    fieldKey="ai-help-step"
                    label="说出 AI 先帮哪一步"
                    listeningKey={listeningKey}
                    onStart={() => startVoiceInput("ai-help-step", setAiHelpStep)}
                  />
                </span>
                <textarea
                  value={aiHelpStep}
                  onChange={(event) => setAiHelpStep(event.target.value)}
                  placeholder="例如：画 3 个隔热工具草图，或者写一句宣传语"
                  rows={2}
                />
              </label>
              <label>
                <span className="field-helper-row">
                  <span>他可能愿意拿什么来换（可选）</span>
                  <FieldVoiceButton
                    fieldKey="exchange-guess"
                    label="说出愿意换什么"
                    listeningKey={listeningKey}
                    onStart={() => startVoiceInput("exchange-guess", setExchangeGuess)}
                  />
                </span>
                <textarea
                  value={exchangeGuess}
                  onChange={(event) => setExchangeGuess(event.target.value)}
                  placeholder="例如：愿意花 30 秒打开，或者推荐给同桌"
                  rows={2}
                />
              </label>
            </>
          )}
          <div className="team-card-preview" aria-label="帮忙卡预览">
            <span>{isTeamNameOnly ? "团队名片" : "帮忙卡"}</span>
            <strong>{teamName.trim() || "还没起名"}</strong>
            <div>
              <p><b>成员</b>{teamMembers.join("、") || student.nickname}</p>
              {isTeamNameOnly ? (
                <>
                  <p><b>队呼</b>{teamChant.trim() || "想一句能一起喊出来的话"}</p>
                  <p><b>亮相</b>{teamName.trim() ? `我们是${teamName.trim()}` : "起好名字后亮相"}</p>
                </>
              ) : (
                <>
                  <p><b>想帮谁</b>{targetUser.trim() || "写一个真实的人"}</p>
                  <p><b>卡在哪</b>{stuckPoint.trim() || "写清最烦的一步"}</p>
                  <p><b>先帮哪一步</b>{firstStep.trim() || "写一个能先试的小动作"}</p>
                  <p><b>少掉麻烦</b>{lessTrouble.trim() || "写帮完以后轻松了哪里"}</p>
                  <p><b>AI 帮哪步</b>{aiHelpStep.trim() || "可以写设计图、宣传语或商业画布"}</p>
                  <p><b>愿意换</b>{exchangeGuess.trim() || "可以先空着，等试玩后再改"}</p>
                </>
              )}
            </div>
            <small>{isTeamNameOnly ? "方向等下午看完项目故事以后再定。" : otherUsers.trim() || "还可以写：还有谁也会遇到"}</small>
          </div>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <UsersRound size={18} />}
            提交
          </button>
          <p className="hint">{isTeamNameOnly ? "现在只起队名和队呼，项目方向等下午再定。" : "每格只写一句就够，也可以直接说出来。"}</p>
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
                      <small>{asText(item.payload.target_user) || "想帮的人"}</small>
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
              placeholder="例如：爷爷看不懂手机里的医院提醒"
              inputMode="text"
            />
          </label>
          <label>
            这个问题发生在谁身上
            <input
              value={targetUser}
              onChange={(event) => setTargetUser(event.target.value)}
              placeholder="例如：收到手机消息却怕点错的爷爷"
              inputMode="text"
            />
          </label>
          <label>
            最卡住的地方
            <textarea
              value={trouble}
              onChange={(event) => setTrouble(event.target.value)}
              placeholder="例如：早读、体育后、午饭后总想不起来喝"
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
              placeholder="例如：同学想学魔方，却不知道谁愿意教他 10 分钟"
              rows={2}
            />
          </label>
          <label>
            AI 帮我们改成
            <textarea
              value={aiRewrite}
              onChange={(event) => setAiRewrite(event.target.value)}
              placeholder="例如：想学一个小本领时，怎么找到愿意教我的同学？"
              rows={3}
            />
          </label>
          <label>
            我们找到的用户声音
            <textarea
              value={userClue}
              onChange={(event) => setUserClue(event.target.value)}
              placeholder="例如：同学说，我会魔方，可不知道谁想学"
              rows={3}
            />
          </label>
          <label>
            别人现在怎么解决
            <textarea
              value={existingSolution}
              onChange={(event) => setExistingSolution(event.target.value)}
              placeholder="例如：课间临时问一圈，常常时间对不上"
              rows={2}
            />
          </label>
          <label>
            我们可以不同的角度
            <textarea
              value={differentAngle}
              onChange={(event) => setDifferentAngle(event.target.value)}
              placeholder="例如：把想学什么、谁会教、什么时候有空整理成小课卡"
              rows={2}
            />
          </label>
          <label>
            下一步还要验证
            <textarea
              value={nextQuestion}
              onChange={(event) => setNextQuestion(event.target.value)}
              placeholder="例如：同学愿不愿意发布一张“我想学”的小课卡？"
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
              placeholder="例如：帮我们生成长应用题第一步的首页文案"
              rows={2}
            />
          </label>
          <label>
            用户
            <input
              value={targetUser}
              onChange={(event) => setTargetUser(event.target.value)}
              placeholder="例如：一看到长应用题就不知道从哪下手的同学"
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
              placeholder="例如：长应用题第一步"
              inputMode="text"
            />
          </label>
          <label>
            可能的功能
            <textarea
              value={featureIdeas}
              onChange={(event) => setFeatureIdeas(event.target.value)}
              placeholder={"例如：\n拍错题\n读自己的步骤\n判断可能错因\n给一句再试提示\n生成一张错题卡"}
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
              placeholder="例如：同学粘贴应用题后，马上看到谁、已知、要求和第一步提示"
              rows={3}
            />
          </label>
          <label>
            第一版做成什么样
            <textarea
              value={firstVersion}
              onChange={(event) => setFirstVersion(event.target.value)}
              placeholder="例如：一个浏览器页面，有上传入口、错因卡和再试提示"
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
              placeholder="例如：他知道先检查读题、步骤、计算还是单位"
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
              placeholder="例如：作文漫画分镜台"
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
              placeholder="例如：用浏览器页面收集主角、地点和麻烦，再让 AI 生成 4 格开头"
              rows={3}
            />
          </label>
          <label>
            用户使用流程
            <textarea
              value={userFlow}
              onChange={(event) => setUserFlow(event.target.value)}
              placeholder={"例如：\n打开页面\n输入主角和地点\n点击生成开头\n看到 4 格草稿\n选一格继续改"}
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
              placeholder="例如：4 格开头草稿和一句对白"
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
                      <em>{asText(item.payload.target_user) || "想帮的人"}</em>
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
                placeholder="例如：上学前 3 分钟检查台"
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
              placeholder="例如：早上出门前怕漏带东西的同学"
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
              placeholder="例如：明天有体育课、听写和小雨时"
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
              placeholder="例如：不是不想带，是早上太急，总漏掉一样东西"
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
                  placeholder="例如：问 5 个同学研学时最怕漏带什么、现在怎么检查"
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
                placeholder="例如：有同学说，早上太急，水杯和听写本总会忘一个"
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
              placeholder="例如：粘贴课表和通知，生成今天必带、要确认、到校先做三栏清单"
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
  const isAiFix = /AI 跑偏|改回来|修正/.test(title);
  const isWorkBuddyDraw = camp?.active_task?.module_id === "ai-judgement";
  const isAiDialog = isWorkBuddyDraw || /DeepSeek|任务单|问真人|问同学|回答怎么用/.test(title);
  const [moment, setMoment] = useState("");
  const [method, setMethod] = useState("");
  const [nextUse, setNextUse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<StudentMessage | null>(null);

  const showMessage = (tone: StudentMessage["tone"], text: string) => {
    setMessage({ tone, text });
  };
  const { listeningKey, startVoiceInput } = useStudentVoiceInput(showMessage);

  const submit = async () => {
    if (isWorkBuddyDraw && !moment.trim()) {
      showMessage("error", "先说一句你想画什么。");
      return;
    }
    if (isWorkBuddyDraw && !method.trim()) {
      showMessage("error", "再说一句你想改什么，或者想加什么细节。");
      return;
    }
    if (!isWorkBuddyDraw && !method.trim()) {
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
          reflection_kind: isWorkBuddyDraw ? "day1_workbuddy_draw" : isAiDialog ? "day1_ai_dialog" : isAiFix ? "day2_ai_fix" : "day1_ai_rule",
          moment: moment.trim(),
          method: method.trim(),
          next_use: nextUse.trim(),
          team_id: student.team_id || "",
          team_name: student.team_name || ""
        }
      });
      showMessage("success", isWorkBuddyDraw ? "收到啦。现在用这句话去 WorkBuddy 画一张，再选一处继续改。" : isAiDialog ? "收到啦。这条线索可以带进团队讨论。" : "收到啦。这个方法会留在你的项目路上。");
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
        <p>{isWorkBuddyDraw ? "把脑子里的画说清楚，再用自己的 WorkBuddy 画一张。" : isAiDialog ? "把 DeepSeek 帮你想到的线索，变成下一步能讨论的材料。" : isAiFix ? "回想今天制作时，AI 哪次没听懂？你怎样让它改回来？" : "把今天最有用的一条 AI 判断方法带走。"}</p>
        <div className="student-card growth-reflection-form">
          <div className="student-current">
            <div>
              <span>{isWorkBuddyDraw ? "WorkBuddy 出图实验" : isAiDialog ? "AI 对话实验" : isAiFix ? "修正方法" : "判断方法"}</span>
              <strong>{student.nickname}</strong>
              <small>{student.team_name || student.username}</small>
            </div>
            <button className="text-button" onClick={onLogout}>退出</button>
          </div>
          <label>
            <span className="field-helper-row">
              <span>{isWorkBuddyDraw ? "我想画的画面" : isAiDialog ? "我们问 AI 的任务单（可选）" : isAiFix ? "AI 跑偏的一刻（可选）" : "今天记住的一刻（可选）"}</span>
              {isWorkBuddyDraw && (
                <FieldVoiceButton
                  fieldKey="workbuddy-picture"
                  label="说画面"
                  listeningKey={listeningKey}
                  onStart={() => startVoiceInput("workbuddy-picture", setMoment)}
                />
              )}
            </span>
            <input
              value={moment}
              onChange={(event) => setMoment(event.target.value)}
              placeholder={isWorkBuddyDraw ? "例如：我在海边动物医院，给受伤海龟检查" : isAiDialog ? "例如：请你当产品顾问，帮我们看课间活动产品可能帮谁" : isAiFix ? "例如：AI 做了很多功能，却没突出核心按钮" : "例如：我发现 AI 的答案听起来很像真的"}
              inputMode="text"
            />
          </label>
          <label>
            <span className="field-helper-row">
              <span>{isWorkBuddyDraw ? "我想改或加的细节" : isAiDialog ? "AI 回答里能帮小组的一句" : isAiFix ? "我让它改回来的方法" : "我会继续使用的判断方法"}</span>
              {isWorkBuddyDraw && (
                <FieldVoiceButton
                  fieldKey="workbuddy-detail"
                  label="说细节"
                  listeningKey={listeningKey}
                  onStart={() => startVoiceInput("workbuddy-detail", setMethod)}
                />
              )}
            </span>
            <textarea
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              placeholder={isWorkBuddyDraw ? "例如：让海龟更大一点，窗外加上蓝色海浪和救援船" : isAiDialog ? "例如：课间活动最需要帮的是不知道和谁一起玩的同学" : isAiFix ? "例如：先指出哪里不符合用户，再给一个更清楚的例子" : "例如：先找证据，再相信答案"}
              rows={3}
            />
          </label>
          <label>
            <span className="field-helper-row">
              <span>{isWorkBuddyDraw ? "生成后再看一眼（可选）" : isAiDialog ? "还不确定，要问同学或用户的一句（可选）" : isAiFix ? "下一次我会怎么说得更清楚（可选）" : "明天我想把它用在哪里（可选）"}</span>
              {isWorkBuddyDraw && (
                <FieldVoiceButton
                  fieldKey="workbuddy-next"
                  label="说下一步"
                  listeningKey={listeningKey}
                  onStart={() => startVoiceInput("workbuddy-next", setNextUse)}
                />
              )}
            </span>
            <textarea
              value={nextUse}
              onChange={(event) => setNextUse(event.target.value)}
              placeholder={isWorkBuddyDraw ? "例如：如果人物不像我，我会换一张再试" : isAiDialog ? "例如：你课间最想有人帮你安排哪一件事？" : isAiFix ? "例如：先告诉 AI 只做一个核心动作" : "例如：采访后让 AI 帮我整理，但我要检查证据"}
              rows={2}
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Brain size={18} />}
            提交
          </button>
          <p className="hint">{isWorkBuddyDraw ? "可以先说短句。画出来以后，选一处继续让 WorkBuddy 改。" : isAiDialog ? "AI 可以先给线索，真正的方向还要回到会使用的人身上。" : "好的方法要能下一次继续用。"}</p>
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
      showMessage("error", "贴上发布 PPT 链接。");
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
        <p>把能打开的作品和发布 PPT 交上来，就可以准备上台。</p>
        <div className="student-card final-showcase-card">
          <div className="student-current">
            <div>
              <span>发布小组</span>
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
            发布 PPT
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
              placeholder="例如：同伴小课卡片墙"
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
              placeholder="例如：长应用题第一步"
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
  const isBusinessLoopTask = /商业闭环|作品连成一圈|差异化|不一样/.test(taskTitle);

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
      showMessage("success", isBusinessLoopTask ? "收到啦。你们的闭环和不一样的点都更清楚了。" : "收到啦。现在你们能说清作品为什么值得交换。");
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
        <p>{isBusinessLoopTask ? "把用户怎么进来、作品怎么帮忙、哪里不一样、为什么值得说清楚。" : "说清你的作品帮别人少烦了什么，再看看别人愿意用什么交换。"}</p>
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
              placeholder="例如：上学前 3 分钟检查台"
              inputMode="text"
            />
          </label>
          <label>
            这个作品帮谁
            <input
              value={targetUser}
              onChange={(event) => setTargetUser(event.target.value)}
              placeholder="例如：早上出门前怕漏带东西的同学"
              inputMode="text"
            />
          </label>
          <label>
            帮别人少烦了什么
            <textarea
              value={valueChange}
              onChange={(event) => setValueChange(event.target.value)}
              placeholder="例如：出发前自己查一遍，少漏带关键物品"
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
            {isBusinessLoopTask ? "哪里不一样，为什么值得" : "为什么值得"}
            <textarea
              value={whyWorth}
              onChange={(event) => setWhyWorth(event.target.value)}
              placeholder={isBusinessLoopTask ? "例如：不用翻很多聊天记录，打开就能看到今天必带三件事" : "例如：它把家长提醒变成孩子自己能勾选的清单"}
              rows={3}
            />
          </label>
          <div className="value-proof-preview" aria-label="价值卡预览">
            <span>{exchangePreview || "选择一种交换方式"}</span>
            <strong>{valueChange.trim() || "帮别人少烦了什么"}</strong>
          </div>
          <label>
            {isBusinessLoopTask ? "用户从哪里打开作品（可选）" : "你看到的证据（可选）"}
            <input
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              placeholder={isBusinessLoopTask ? "例如：扫码打开、同学发链接、从作品街点开" : "例如：第 2 组试用后说愿意再用一次"}
              inputMode="text"
            />
          </label>
          <label>
            {isBusinessLoopTask ? "为什么下次还会回来（可选）" : "下一次再验证什么（可选）"}
            <input
              value={nextProof}
              onChange={(event) => setNextProof(event.target.value)}
              placeholder={isBusinessLoopTask ? "例如：每次放学前都能生成新清单" : "例如：让 3 位没见过作品的同学试一次"}
              inputMode="text"
              enterKeyHint="done"
            />
          </label>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Coins size={18} />}
            提交
          </button>
          <p className="hint">{isBusinessLoopTask ? "一圈能跑通，明天发布时就更容易讲清楚。" : "真正有价值的产品，会让别人愿意付出一点东西来换。"}</p>
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
              placeholder="例如：同伴小课卡片墙"
              inputMode="text"
            />
          </label>
          <label>
            一句标语
            <input
              value={slogan}
              onChange={(event) => setSlogan(event.target.value)}
              placeholder="例如：看到通知，30 秒知道能不能参加"
              inputMode="text"
            />
          </label>
          <label>
            这张海报给谁看
            <input
              value={targetUser}
              onChange={(event) => setTargetUser(event.target.value)}
              placeholder="例如：总是错过社团和午休活动的同学"
              inputMode="text"
            />
          </label>
          <label>
            三个卖点
            <textarea
              value={sellingPoints}
              onChange={(event) => setSellingPoints(event.target.value)}
              placeholder={"例如：\n提取时间地点\n写清适合谁\n提醒要带什么"}
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
              placeholder="例如：一张活动海报变成时间、地点和要带什么的活动卡"
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
  const isGoldenCircleMode = /黄金圈|为什么想做|信念|梦想|路演稿|商业路演/.test(taskTitle);
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
      showMessage("error", isGoldenCircleMode ? "先写你们为什么想做这个作品。" : "先写一句开头，让大家想继续听。");
      return;
    }
    if (!userScene.trim()) {
      showMessage("error", isGoldenCircleMode ? "写清你们看见了谁的麻烦。" : "写清楚故事里的那个人遇到了什么。");
      return;
    }
    if (!productDemo.trim()) {
      showMessage("error", isGoldenCircleMode ? "写清你们怎么帮他。" : "写清楚上台时先演示作品哪一步。");
      return;
    }
    if (!proofLine.trim()) {
      showMessage("error", isGoldenCircleMode ? "写清做出了什么，或者拿出一条证据。" : "加上一条证据，让别人相信它真的有用。");
      return;
    }
    if (!inviteLine.trim()) {
      showMessage("error", isGoldenCircleMode ? "最后写一句邀请，或者说出下一步梦想。" : "最后写一句邀请大家做什么。");
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
          golden_circle: isGoldenCircleMode,
          why_belief: isGoldenCircleMode ? storyHook.trim() : "",
          who_problem: userScene.trim(),
          how_help: isGoldenCircleMode ? productDemo.trim() : "",
          what_result: isGoldenCircleMode ? proofLine.trim() : "",
          dream_line: isGoldenCircleMode ? inviteLine.trim() : "",
          rehearsal_question: filledRehearsalQa[0]?.question || "",
          rehearsal_answer: filledRehearsalQa[0]?.answer || "",
          rehearsal_qa: filledRehearsalQa,
          rehearsal_question_summary: filledRehearsalQa.map((item) => item.question).join(" / "),
          team_id: student.team_id || "",
          team_name: student.team_name || ""
        }
      });
      showMessage("success", isGoldenCircleMode ? "收到啦。你们的黄金圈路演稿已经有清楚顺序。" : "收到啦。你们的作品故事已经有清楚的上台顺序。");
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
        <h1>{taskTitle || (isGoldenCircleMode ? "黄金圈路演稿" : "故事发布五步卡")}</h1>
        <p>{isGoldenCircleMode ? "先讲为什么想做，再让大家看见作品怎样帮忙。" : "把作品讲成一个故事：先让大家看见一个人，再让作品上场。"}</p>
        <div className="student-card story-pitch-form">
          <div className="student-current">
            <div>
              <span>发布小组</span>
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
              placeholder="例如：作文漫画分镜台"
              inputMode="text"
            />
          </label>
          <div className="story-step-grid">
            <label>
              {isGoldenCircleMode ? "1. 为什么想做" : "1. 一句开头"}
              <textarea
                value={storyHook}
                onChange={(event) => setStoryHook(event.target.value)}
                placeholder={isGoldenCircleMode ? "例如：我们相信，写完作文的同学也应该看见自己的故事画面。" : "例如：你有没有故事点子，却不知道四格怎么排？"}
                rows={3}
              />
            </label>
            <label>
              {isGoldenCircleMode ? "2. 我们看见了谁" : "2. 人物和麻烦"}
              <textarea
                value={userScene}
                onChange={(event) => setUserScene(event.target.value)}
                placeholder={isGoldenCircleMode ? "例如：小宇作文写了很多，可不知道哪 4 个画面最精彩。" : "例如：小宇想好了月球便利店，可不知道四格怎么开头和收尾。"}
                rows={3}
              />
            </label>
            <label>
              {isGoldenCircleMode ? "3. 我们怎么帮" : "3. 作品怎么帮他"}
              <textarea
                value={productDemo}
                onChange={(event) => setProductDemo(event.target.value)}
                placeholder={isGoldenCircleMode ? "例如：打开作品，粘贴作文，它会先挑出 4 个关键画面。" : "例如：打开作品，输入主角、地点和麻烦，它会生成 4 格开头草稿。"}
                rows={3}
              />
            </label>
            <label>
              {isGoldenCircleMode ? "4. 做出了什么" : "4. 一条证据"}
              <textarea
                value={proofLine}
                onChange={(event) => setProofLine(event.target.value)}
                placeholder={isGoldenCircleMode ? "例如：我们已经做出第一版，3 位同学试过，有 2 位说愿意再用。" : "例如：3 位同学试用后，有 2 位说愿意明天再用。"}
                rows={3}
              />
            </label>
            <label>
              {isGoldenCircleMode ? "5. 邀请和下一步梦想" : "5. 最后邀请"}
              <textarea
                value={inviteLine}
                onChange={(event) => setInviteLine(event.target.value)}
                placeholder={isGoldenCircleMode ? "例如：欢迎大家课间试一次。下一版，我们想让更多同学把作文变成漫画。" : "例如：欢迎大家课间点开试一次，看看它会推荐什么。"}
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
                      placeholder={index === 0 ? "例如：如果 AI 拆出的第一步不准，可以怎么改？" : "例如：这个作品下一版先加什么？"}
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
            <span>{isGoldenCircleMode ? "黄金圈顺序" : "上台顺序"}</span>
            <strong>{storyHook.trim() || (isGoldenCircleMode ? "为什么想做" : "一句开头")}</strong>
            <small>{isGoldenCircleMode ? "为什么 → 怎么帮 → 做出了什么 → 邀请" : "人物 → 作品 → 证据 → 邀请"}</small>
          </div>
          <button className="submit-button" disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="spin" size={18} /> : <Megaphone size={18} />}
            提交
          </button>
          <p className="hint">{isGoldenCircleMode ? "好的路演，会让别人先听见你们的相信，再看见作品真的帮上忙。" : "好的故事发布，会让别人先看见问题，再看懂作品怎么帮忙。"}</p>
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
              <p className="hint">好的观察会让作品更适合会使用的人。</p>
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
        <span className="eyebrow">结营作品发布</span>
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
                发布 PPT
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
        <h2>{hasDirectionPlan ? "每队明天先做什么" : hasProduct ? "从问题到产品" : hasPackaging ? "一眼看懂作品" : hasStory ? "让大家听懂作品" : hasValue ? "作品为什么值得" : hasIteration ? "把反馈改成下一版" : hasTech ? "30 秒看懂怎么用" : hasFeature ? "先跑通最关键一步" : hasPrompt ? "让 AI 更听得懂" : hasValidation ? "用证据改答案" : hasScout ? "把问题查得更清楚" : hasTeam ? "团队名和队呼" : "问题和用户声音"}</h2>
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
                  ? asText(item.payload.product_name) || asText(item.payload.core_action) || "今天先跑通的一步"
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
                  <p><b>{item.payload.golden_circle ? "为什么" : "人物"}</b>{asText(item.payload.why_belief) || asText(item.payload.story_hook) || asText(item.payload.user_scene) || "还没写"}</p>
                  {item.payload.golden_circle && <p><b>看见谁</b>{asText(item.payload.who_problem) || asText(item.payload.user_scene) || "还没写"}</p>}
                  <p><b>{item.payload.golden_circle ? "怎么帮" : "作品"}</b>{asText(item.payload.how_help) || asText(item.payload.product_demo) || "还没写"}</p>
                  <p><b>{item.payload.golden_circle ? "做出了什么" : "证据"}</b>{asText(item.payload.what_result) || asText(item.payload.proof_line) || "还没写"}</p>
                  <p><b>邀请</b>{asText(item.payload.dream_line) || asText(item.payload.invite_line) || "还没写"}</p>
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
                  <p><b>核心动作</b>{asText(item.payload.core_action) || "还没写"}</p>
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
                  <p><b>队呼</b>{asText(item.payload.team_chant) || "还在准备"}</p>
                  {asText(item.payload.product_direction) && <p><b>方向</b>{asText(item.payload.product_direction)}</p>}
                  {asText(item.payload.less_trouble) && <p><b>少烦了</b>{asText(item.payload.less_trouble)}</p>}
                  {asText(item.payload.ai_help_step) && <p><b>AI 帮哪步</b>{asText(item.payload.ai_help_step)}</p>}
                  {asText(item.payload.exchange_guess) && <p><b>愿意换</b>{asText(item.payload.exchange_guess)}</p>}
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
