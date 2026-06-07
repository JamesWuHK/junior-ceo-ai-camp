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
  X,
  UsersRound
} from "lucide-react";
import {
  api,
  clearTeacherToken,
  connectEvents,
  getTeacherAccount,
  hasTeacherToken,
  setTeacherToken
} from "./api";
import type { Camp, CourseModule, FuturePhotoSubmission, Student, TeacherAccount } from "./types";
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

const statusText: Record<Student["display_status"], string> = {
  WAITING: "等待提交",
  GENERATING: "生成中",
  AWAITING_REVIEW: "等待审核",
  ON_WALL: "已上墙",
  SAVED_ONLY: "已保存"
};

function useInitialData() {
  const [camp, setCamp] = useState<Camp | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
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
    refresh()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    return connectEvents((payload) => {
      setCamp(payload.camp);
      setStudents(payload.wall);
    });
  }, []);

  return { camp, modules, students, loading, error, refresh };
}

function App() {
  const route = window.location.pathname || "/teacher";
  const data = useInitialData();
  const active = route.startsWith("/student") ? "student" : route.startsWith("/wall") ? "wall" : "teacher";

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
      {active === "student" && <StudentApp camp={data.camp} students={data.students} refresh={data.refresh} />}
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
  const [presenting, setPresenting] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const selectedModule = modules.find((module) => module.id === selectedModuleId) || modules[0];
  const byDay = useMemo(
    () => [1, 2, 3].map((day) => ({ day, modules: modules.filter((module) => module.day === day) })),
    [modules]
  );

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
              <button className="secondary" onClick={() => setPresenting(true)}>
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
          <div className="slide-strip">
            {selectedModule?.pages.map((page) => (
              <article key={page.id} className="slide-card">
                <small>第 {page.page_no} 页 · {page.page_type}</small>
                <h3>{page.title}</h3>
                <p>{page.content_summary}</p>
                <div className="button-row">
                  {page.activity_buttons.map((button) => (
                    <span key={button}>{button}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="teacher-grid">
          <TeacherStudents students={students} refresh={refresh} />
          <FuturePhotoReview refresh={refresh} />
        </section>
      </section>
      {presenting && selectedModule && (
        <PresentationOverlay module={selectedModule} onClose={() => setPresenting(false)} />
      )}
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
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const addStudent = async () => {
    if (!nickname.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      await api.saveStudents({
        id: `student-${Date.now()}`,
        student_no: String(students.length + 1).padStart(2, "0"),
        nickname: nickname.trim(),
        age: age ? Number(age) : undefined,
        photo_authorization: "SELF_PHOTO",
        projection_consent: true,
        public_showcase_consent: false
      });
      setNickname("");
      setAge("");
      setMessage("已加入大屏占位。");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "添加失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <UsersRound size={20} />
        <h2>学员占位</h2>
      </div>
      <div className="student-form">
        <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="昵称" />
        <input value={age} onChange={(event) => setAge(event.target.value)} placeholder="年龄" inputMode="numeric" />
        <button disabled={saving} onClick={addStudent}>{saving ? "保存中" : "添加"}</button>
      </div>
      {message && <p className="hint">{message}</p>}
      <div className="student-table">
        {students.map((student) => (
          <div key={student.id} className="student-row">
            <span>{student.student_no || "--"}</span>
            <strong>{student.nickname}</strong>
            <small>{statusText[student.display_status]}</small>
          </div>
        ))}
        {!students.length && <p className="empty">先录入学员，大屏会显示名字占位。</p>}
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
        await api.markGenerated(item.id, item.result_photo_key || `mock/generated/${item.id}.jpg`);
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
            </div>
            <div className="review-actions">
              {(item.status === "GENERATING" || item.status === "SUBMITTED") && (
                <button disabled={loading} onClick={() => act(item, "generate")}>生成完成</button>
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

function PresentationOverlay({ module, onClose }: { module: CourseModule; onClose: () => void }) {
  const [pageIndex, setPageIndex] = useState(0);
  const page = module.pages[pageIndex];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setPageIndex((index) => Math.min(index + 1, module.pages.length - 1));
      if (event.key === "ArrowLeft") setPageIndex((index) => Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [module.pages.length, onClose]);

  return (
    <section className="presentation-overlay">
      <button className="close-presentation" onClick={onClose} aria-label="关闭演示">
        <X size={24} />
      </button>
      <article className="presentation-slide">
        <span className="eyebrow">D{module.day} · {module.time_range}</span>
        <h1>{page?.title || module.title}</h1>
        {page?.content_summary && <p>{page.content_summary}</p>}
        <div className="presentation-tags">
          <span>{page?.page_type || "课件页"}</span>
          {page?.activity_buttons.map((button) => <span key={button}>{button}</span>)}
        </div>
      </article>
      <footer className="presentation-footer">
        <button disabled={pageIndex === 0} onClick={() => setPageIndex((index) => Math.max(index - 1, 0))}>
          上一页
        </button>
        <span>{pageIndex + 1} / {module.pages.length}</span>
        <button
          disabled={pageIndex === module.pages.length - 1}
          onClick={() => setPageIndex((index) => Math.min(index + 1, module.pages.length - 1))}
        >
          下一页
        </button>
      </footer>
    </section>
  );
}

function StudentApp({
  camp,
  students,
  refresh
}: {
  camp: Camp | null;
  students: Student[];
  refresh: () => Promise<void>;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || "");
  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const [nickname, setNickname] = useState(selectedStudent?.nickname || "");
  const [career, setCareer] = useState("");
  const [photoKey, setPhotoKey] = useState("");
  const [preview, setPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    if (selectedStudent) setNickname(selectedStudent.nickname);
  }, [selectedStudentId]);

  const onFile = async (file?: File) => {
    if (!file) return;
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
    if (!nickname.trim() || !career.trim()) return;
    setSubmitting(true);
    try {
      await api.submitFuturePhoto({
        student_id: selectedStudentId || undefined,
        student_name: nickname.trim(),
        career_text: career.trim(),
        career_source: "choice",
        source_photo_key: photoKey || undefined
      });
      setResult("已提交，照片会先进入生成和老师审核。");
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="student-page">
      <section className="student-shell">
        <span className="eyebrow">{camp?.name || "少年CEO AI 创业营"}</span>
        <h1>未来照相馆</h1>
        <p>上传照片，告诉未来照相馆：你理想的未来职业是？</p>
        <div className="student-card">
          <label>
            选择你的名字
            <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
              <option value="">自己填写</option>
              {students.map((student) => (
                <option value={student.id} key={student.id}>
                  {student.nickname}
                </option>
              ))}
            </select>
          </label>
          <label>
            昵称
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="你的昵称" />
          </label>
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

function WallApp({ camp, students }: { camp: Camp | null; students: Student[] }) {
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
      <section className="wall-grid">
        {students.map((student) => (
          <article className={`wall-tile ${student.display_status.toLowerCase()}`} key={student.id}>
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
              <span>{statusText[student.display_status]}</span>
            </footer>
          </article>
        ))}
        {!students.length && (
          <article className="wall-empty">
            <CheckCircle2 size={42} />
            老师录入名单后，这里会显示每位同学的占位。
          </article>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
