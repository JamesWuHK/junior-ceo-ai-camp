import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CheckCircle2,
  Clock3,
  Image,
  Loader2,
  LogOut,
  Maximize2,
  Mic,
  Monitor,
  Play,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  UsersRound
} from "lucide-react";
import {
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
import type { Camp, CourseModule, FuturePhotoSubmission, Student, StudentAccount, TeacherAccount } from "./types";
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

function coursewarePages(module: CourseModule | null | undefined) {
  if (!module) return [];
  if (module.id !== "future-photo-studio") return module.pages;
  const base = module.pages[0] ?? {
    id: "future-photo-studio-page",
    module_id: module.id,
    page_no: 1,
    title: "",
    page_type: "story",
    activity_buttons: []
  };
  return [
    { ...base, id: "future-photo-story", page_no: 1, title: "神奇照相馆", page_type: "story" },
    { ...base, id: "future-photo-examples", page_no: 2, title: "未来样片", page_type: "image" },
    { ...base, id: "future-photo-your-turn", page_no: 3, title: "轮到你了", page_type: "activity" },
    { ...base, id: "future-photo-wall", page_no: 4, title: "未来照片墙", page_type: "showcase" },
    { ...base, id: "future-photo-ai-secret", page_no: 5, title: "AI 解密", page_type: "experiment" }
  ] satisfies CourseModule["pages"];
}

function lessonPageTitle(module: CourseModule | null | undefined, page: CourseModule["pages"][number]) {
  if (module?.id !== "future-photo-studio") return page.title;
  const titles: Record<number, string> = {
    1: "神奇照相馆",
    2: "未来样片",
    3: "轮到你了",
    4: "照片墙",
    5: "AI 解密"
  };
  return titles[page.page_no] ?? page.title;
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

function useInitialData(active: "teacher" | "student" | "wall") {
  const [camp, setCamp] = useState<Camp | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    const [campResult, moduleResult, wallResult] = await Promise.all([
      api.currentCamp(),
      active === "teacher" ? api.courseModules() : Promise.resolve({ modules: [] }),
      active === "student" ? Promise.resolve({ students: [] }) : api.wall()
    ]);
    setCamp(campResult);
    setModules(moduleResult.modules);
    setStudents(wallResult.students);
  };

  useEffect(() => {
    refresh()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    if (active === "student") return undefined;
    return connectEvents((payload) => {
      setCamp(payload.camp);
      setStudents(payload.wall);
    });
  }, [active]);

  return { camp, modules, students, loading, error, refresh };
}

function App() {
  const route = window.location.pathname || "/teacher";
  const active = route.startsWith("/student") ? "student" : route.startsWith("/wall") ? "wall" : "teacher";
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
      {active === "teacher" && (
        <TeacherApp
          camp={data.camp}
          modules={data.modules}
          students={data.students}
          refresh={data.refresh}
        />
      )}
      {active === "student" && <StudentApp camp={data.camp} refresh={data.refresh} />}
      {active === "wall" && <WallApp camp={data.camp} students={data.students} />}
    </>
  );
}

function TeacherApp({
  camp,
  modules,
  students,
  refresh
}: {
  camp: Camp | null;
  modules: CourseModule[];
  students: Student[];
  refresh: () => Promise<void>;
}) {
  const [isAuthed, setIsAuthed] = useState(hasTeacherToken());
  const [teacher, setTeacher] = useState<TeacherAccount | null>(getTeacherAccount());
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedModuleId, setSelectedModuleId] = useState("future-photo-studio");
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Student | null>(null);
  const [actionMessage, setActionMessage] = useState("");
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

  if (!isAuthed) {
    return (
      <TeacherLogin
        camp={camp}
        onLoggedIn={(account) => {
          setTeacher(account);
          setIsAuthed(true);
        }}
      />
    );
  }

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
            clearTeacherToken();
            setTeacher(null);
            setIsAuthed(false);
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

function LessonPageCanvas({
  module,
  page,
  students,
  onOpenPhoto
}: {
  module: CourseModule;
  page: CourseModule["pages"][number];
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

  return (
    <article className="lesson-canvas">
      <div className="lesson-canvas-copy">
        <small>第 {page.page_no} 页 · {page.page_type}</small>
        <h2>{page.title}</h2>
        {page.content_summary && <p>{page.content_summary}</p>}
        <div className="button-row">
          {page.activity_buttons.map((button) => (
            <span key={button}>{button}</span>
          ))}
        </div>
      </div>
      <div className="lesson-visual">
        <Sparkles size={44} />
        <span>{module.title}</span>
      </div>
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
  page: CourseModule["pages"][number];
  students: Student[];
  onOpenPhoto: (student: Student) => void;
}) {
  if (page.page_no === 1) {
    return (
      <article className="lesson-canvas studio-slide studio-cover studio-cover-image">
        <img src={openingImages.cover} alt="未来照相馆封面" />
        <div className="studio-cover-shade" />
        <div className="studio-copy">
          <span className="studio-kicker">传说有一家照相馆</span>
          <h2>它能拍到长大后的你</h2>
          <p>一张今天的照片，加上一个理想职业，就会出现一张未来照片。</p>
          <div className="studio-badges">
            <span>一张照片</span>
            <span>一个理想职业</span>
            <span>一张未来照</span>
          </div>
        </div>
      </article>
    );
  }

  if (page.page_no === 2) {
    return (
      <article className="lesson-canvas studio-slide studio-story">
        <div className="studio-copy">
          <span className="studio-kicker">三张未来样片</span>
          <h2>这些孩子好像去了未来</h2>
          <p>看场景、工具和动作，猜猜他们长大后在做什么。</p>
        </div>
        <div className="opening-pairs">
          <figure>
            <img src={openingImages.vet} alt="孩子与未来动物医生职业照对比" />
            <figcaption>动物医生</figcaption>
          </figure>
          <figure>
            <img src={openingImages.robot} alt="孩子与未来机器人设计师职业照对比" />
            <figcaption>机器人设计师</figcaption>
          </figure>
          <figure>
            <img src={openingImages.space} alt="孩子与未来太空建筑师职业照对比" />
            <figcaption>太空建筑师</figcaption>
          </figure>
        </div>
      </article>
    );
  }

  if (page.page_no === 3) {
    return (
      <article className="lesson-canvas studio-slide studio-task">
        <div className="studio-copy">
          <span className="studio-kicker">轮到你进入照相馆</span>
          <h2>拍下今天的你，说出未来的职业</h2>
          <p>照片会先回到你的屏幕上，确认后再一起点亮照片墙。</p>
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
            <span>1. 拍一张今天的照片</span>
            <span>2. 说出理想职业</span>
            <span>3. 看见未来照片</span>
          </div>
          <img className="task-preview-image" src={openingImages.robot} alt="未来职业照生成示例" />
        </div>
      </article>
    );
  }

  return (
    page.page_no === 4 ? (
      <article className="lesson-canvas studio-slide studio-wall">
        <div className="studio-copy compact">
          <span className="studio-kicker">照片墙亮起来</span>
          <h2>我们的未来照片到了</h2>
          <p>看看每张照片里出现了哪些职业线索。</p>
        </div>
        <CoursePhotoWall students={students} variant="lesson" onOpenPhoto={onOpenPhoto} />
      </article>
    ) : (
      <article className="lesson-canvas studio-slide studio-secret">
        <div className="studio-copy compact">
          <span className="studio-kicker">照相馆解密</span>
          <h2>原来是 AI 在画未来</h2>
          <p>AI 把今天的照片和职业关键词合在一起，生成一张未来想象照。</p>
        </div>
        <div className="ai-secret-flow">
          <div>
            <Image size={36} />
            <strong>今天的照片</strong>
          </div>
          <span>+</span>
          <div>
            <Mic size={36} />
            <strong>职业关键词</strong>
          </div>
          <span>=</span>
          <div className="highlight">
            <Sparkles size={40} />
            <strong>未来想象照</strong>
          </div>
        </div>
        <div className="ai-secret-words">
          <span>大模型</span>
          <span>提示词</span>
          <span>图像生成</span>
        </div>
      </article>
    )
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
          老师录入名单后，这里会显示每位同学的占位。
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
  pages: CourseModule["pages"];
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
      setResult("已提交，照片会先进入生成和老师审核。");
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
          <p className="hint">提交后老师审核，通过后会出现在大屏上。</p>
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

function WallApp({ camp, students }: { camp: Camp | null; students: Student[] }) {
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
      {selectedPhoto && <PhotoLightbox student={selectedPhoto} onClose={() => setSelectedPhoto(null)} />}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
