import type {
  AwardResult,
  Camp,
  CourseModule,
  FuturePhotoSubmission,
  ScoreSummary,
  ShowcaseItem,
  SourcePhoto,
  StatePayload,
  Student,
  StudentAccount,
  TaskSubmission,
  TeacherAccount,
  Team,
  UploadTarget,
  WallArtifact
} from "./types";

const configuredBase = import.meta.env.VITE_API_BASE as string | undefined;
export const API_BASE =
  configuredBase || (import.meta.env.DEV ? "/api" : "https://api.camps.wanli.wiki");

const teacherTokenKey = "ceo_camp_teacher_token";
const teacherAccountKey = "ceo_camp_teacher";
const studentTokenKey = "ceo_camp_student_token";
const studentAccountKey = "ceo_camp_student";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function createMemoryStorage(): KeyValueStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key)
  };
}

function usableStorage(kind: "localStorage" | "sessionStorage", fallback: KeyValueStorage) {
  try {
    const storage = window[kind];
    const probeKey = "__ceo_camp_storage_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return fallback;
  }
}

const memoryLocalStorage = createMemoryStorage();
const memorySessionStorage = createMemoryStorage();
const legacyTeacherStorage = usableStorage("localStorage", memoryLocalStorage);
const teacherStorage = usableStorage("sessionStorage", memorySessionStorage);
const studentStorage = usableStorage("localStorage", memoryLocalStorage);

function teacherToken() {
  return teacherStorage.getItem(teacherTokenKey) || "";
}

function studentToken() {
  return studentStorage.getItem(studentTokenKey) || "";
}

function headers(auth = false) {
  const base: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (auth) base.Authorization = `Bearer ${teacherToken()}`;
  return base;
}

function studentHeaders(auth = false, tokenOverride?: string) {
  const base: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (auth) base.Authorization = `Bearer ${tokenOverride || studentToken()}`;
  return base;
}

function friendlyErrorMessage(raw: unknown, status: number) {
  const text = String(raw || `HTTP ${status}`);
  if (text === "INVALID_CREDENTIALS") return "账号或密码不对，请再试一次。";
  if (text === "UNAUTHORIZED") return "登录已过期，请重新进入。";
  if (text === "SOURCE_PHOTO_REQUIRED") return "先上传照片，再提交。";
  if (text === "INVALID_UPLOAD_KEY" || text === "INVALID_UPLOAD_BODY") return "照片没有传好，请重新选择一次。";
  if (text === "QINGYUN_MODEL_NOT_CONFIGURED") return "出图服务还没准备好，请联系现场老师。";
  if (text === "FUTURE_PHOTO_QUEUE_FAILED") return "未来照片暂时没有开始生成，请稍后再试。";
  if (text.startsWith("FUTURE_PHOTO_DAILY_LIMIT_REACHED")) {
    return "今天的自动出图次数用完了，请老师帮忙处理。";
  }
  if (/^HTTP \d+/.test(text)) return `连接不太顺畅（${text}），请稍后再试。`;
  return text;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(friendlyErrorMessage(data?.message || data?.error, response.status));
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean; service: string; version: string }>("/health"),
  login: (username: string, password: string) =>
    request<{ token: string; expires_in: number; teacher: TeacherAccount }>("/auth/teacher/login", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ username, password })
    }),
  me: () => request<{ teacher: TeacherAccount }>("/auth/teacher/me", { headers: headers(true) }),
  studentLogin: (username: string, password: string) =>
    request<{ token: string; expires_in: number; student: StudentAccount }>("/auth/student/login", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ username, password })
    }),
  studentMe: () => request<{ student: StudentAccount }>("/auth/student/me", { headers: studentHeaders(true) }),
  currentCamp: () => request<Camp>("/camp/current"),
  courseModules: () => request<{ modules: CourseModule[] }>("/course/modules", { headers: headers(true) }),
  students: () => request<{ students: Student[] }>("/students", { headers: headers(true) }),
  saveStudents: (students: Partial<Student> | Partial<Student>[]) =>
    request<{ students: Student[] }>("/students", {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify(students)
    }),
  deleteStudent: (id: string) =>
    request<{ ok: boolean; student: Student }>(`/students/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${teacherToken()}` }
    }),
  teams: () => request<{ teams: Team[] }>("/teams"),
  uploadToken: (kind: string, fileName: string, tokenOverride?: string, studentId?: string) =>
    request<UploadTarget>("/future-photo/upload-token", {
      method: "POST",
      headers: studentHeaders(true, tokenOverride),
      body: JSON.stringify({ kind, file_name: fileName, student_id: studentId })
    }),
  mobileUploadLink: () =>
    request<{ token: string; expires_in: number; student_id: string; student: StudentAccount }>("/future-photo/mobile-upload-link", {
      method: "POST",
      headers: studentHeaders(true),
      body: JSON.stringify({})
    }),
  sourcePhoto: () =>
    request<{ source_photo: SourcePhoto | null }>("/future-photo/source-photo", {
      headers: studentHeaders(true)
    }),
  registerSourcePhoto: (sourcePhotoKey: string, tokenOverride?: string, studentId?: string) =>
    request<{ source_photo: SourcePhoto }>("/future-photo/source-photo", {
      method: "POST",
      headers: studentHeaders(true, tokenOverride),
      body: JSON.stringify({ source_photo_key: sourcePhotoKey, student_id: studentId })
    }),
  sourcePhotoBlob: async (sourcePhotoKey: string) => {
    const response = await fetch(
      `${API_BASE}/future-photo/source-photo/object?key=${encodeURIComponent(sourcePhotoKey)}`,
      { headers: studentHeaders(true) }
    );
    if (!response.ok) throw new Error("照片暂时还没显示出来，请稍等一下。");
    return response.blob();
  },
  submitFuturePhoto: (payload: {
    career_text: string;
    career_source: string;
    source_photo_key?: string;
  }) =>
    request<{ submission: FuturePhotoSubmission }>("/future-photo/submissions", {
      method: "POST",
      headers: studentHeaders(true),
      body: JSON.stringify(payload)
    }),
  markGenerated: (id: string, resultPhotoKey?: string) =>
    request<{ submission: FuturePhotoSubmission }>(`/future-photo/${id}/generate`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ result_photo_key: resultPhotoKey })
    }),
  reviewFuturePhoto: (id: string, action: "approve" | "reject" | "save-only") =>
    request<{ submission: FuturePhotoSubmission }>(`/future-photo/${id}/review`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ action })
    }),
  wall: () => request<{ students: Student[] }>("/wall/future-photo"),
  wallArtifacts: () => request<{ artifacts: WallArtifact[] }>("/wall/artifacts"),
  showcase: () => request<{ showcase_items: ShowcaseItem[] }>("/showcase"),
  publicFinalShowcase: () =>
    request<{
      camp: Pick<Camp, "id" | "name" | "city" | "location"> & { starts_on?: string; ends_on?: string };
      final_showcase: WallArtifact[];
      showcase_items: ShowcaseItem[];
      growth_reflections: WallArtifact[];
      project_journey: WallArtifact[];
      score_summaries: ScoreSummary[];
      award_results: AwardResult[];
    }>("/public/final-showcase"),
  manageShowcase: () => request<{ showcase_items: ShowcaseItem[] }>("/showcase/manage", { headers: headers(true) }),
  publishShowcase: (payload: Partial<ShowcaseItem>) =>
    request<{ showcase_item: ShowcaseItem }>("/publish/showcase", {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify(payload)
    }),
  scoreSummary: () =>
    request<{ score_summaries: ScoreSummary[]; score_submissions: TaskSubmission[] }>("/scores/summary", {
      headers: headers(true)
    }),
  manageAwards: () => request<{ award_results: AwardResult[] }>("/awards/manage", { headers: headers(true) }),
  saveAward: (payload: Partial<AwardResult>) =>
    request<{ award_result: AwardResult }>("/awards", {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify(payload)
    }),
  submissions: () =>
    request<{
      future_photo_submissions: FuturePhotoSubmission[];
      task_submissions: TaskSubmission[];
    }>("/submissions", {
      headers: headers(true)
    }),
  submitTask: (payload: { task_type: string; title: string; payload: Record<string, unknown> }) =>
    request<{ submission: TaskSubmission }>("/task-submissions", {
      method: "POST",
      headers: studentHeaders(true),
      body: JSON.stringify(payload)
    }),
  setTaskSubmissionStatus: (id: string, status: "SUBMITTED" | "ON_WALL", displayOrder?: number) =>
    request<{ submission: TaskSubmission | null }>(`/task-submissions/${encodeURIComponent(id)}/status`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify({ status, display_order: displayOrder })
    }),
  setCurrentTask: (payload: { module_id?: string; title: string; activity_type: string; payload?: Record<string, unknown> }) =>
    request<{ task: unknown }>("/tasks/current", {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify(payload)
    }),
  eventsUrl: () => `${API_BASE}/events`
};

export function connectEvents(onState: (payload: StatePayload) => void) {
  const source = new EventSource(api.eventsUrl());
  const handler = (event: MessageEvent) => {
    const data = JSON.parse(event.data) as StatePayload;
    onState(data);
  };
  source.addEventListener("connected", handler);
  source.addEventListener("state.changed", handler);
  source.addEventListener("students.changed", handler);
  source.addEventListener("future_photo.submitted", handler);
  source.addEventListener("future_photo.generated", handler);
  source.addEventListener("future_photo.reviewed", handler);
  source.addEventListener("task.changed", handler);
  source.addEventListener("task.submitted", handler);
  source.addEventListener("task.display.changed", handler);
  source.addEventListener("publish.changed", handler);
  return () => source.close();
}

export function setTeacherToken(token: string, teacher?: TeacherAccount) {
  teacherStorage.setItem(teacherTokenKey, token);
  legacyTeacherStorage.removeItem(teacherTokenKey);
  if (teacher) {
    teacherStorage.setItem(teacherAccountKey, JSON.stringify(teacher));
    legacyTeacherStorage.removeItem(teacherAccountKey);
  }
}

export function hasTeacherToken() {
  return Boolean(teacherToken());
}

export function getTeacherAccount() {
  const value = teacherStorage.getItem(teacherAccountKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as TeacherAccount;
  } catch {
    return null;
  }
}

export function clearTeacherToken() {
  teacherStorage.removeItem(teacherTokenKey);
  teacherStorage.removeItem(teacherAccountKey);
  legacyTeacherStorage.removeItem(teacherTokenKey);
  legacyTeacherStorage.removeItem(teacherAccountKey);
}

export function setStudentToken(token: string, student?: StudentAccount) {
  studentStorage.setItem(studentTokenKey, token);
  if (student) studentStorage.setItem(studentAccountKey, JSON.stringify(student));
}

export function hasStudentToken() {
  return Boolean(studentToken());
}

export function getStudentToken() {
  return studentToken();
}

export function getStudentAccount() {
  const value = studentStorage.getItem(studentAccountKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as StudentAccount;
  } catch {
    return null;
  }
}

export function clearStudentToken() {
  studentStorage.removeItem(studentTokenKey);
  studentStorage.removeItem(studentAccountKey);
}
