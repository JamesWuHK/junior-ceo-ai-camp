import type {
  Camp,
  CourseModule,
  FuturePhotoSubmission,
  StatePayload,
  Student,
  StudentAccount,
  TeacherAccount,
  Team,
  UploadTarget
} from "./types";

const configuredBase = import.meta.env.VITE_API_BASE as string | undefined;
export const API_BASE =
  configuredBase || (import.meta.env.DEV ? "/api" : "https://api.camps.wanli.wiki");

function teacherToken() {
  return window.localStorage.getItem("ceo_camp_teacher_token") || "";
}

function studentToken() {
  return window.localStorage.getItem("ceo_camp_student_token") || "";
}

function headers(auth = false) {
  const base: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (auth) base.Authorization = `Bearer ${teacherToken()}`;
  return base;
}

function studentHeaders(auth = false) {
  const base: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (auth) base.Authorization = `Bearer ${studentToken()}`;
  return base;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
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
  courseModules: () => request<{ modules: CourseModule[] }>("/course/modules"),
  students: () => request<{ students: Student[] }>("/students", { headers: headers(true) }),
  saveStudents: (students: Partial<Student> | Partial<Student>[]) =>
    request<{ students: Student[] }>("/students", {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify(students)
    }),
  teams: () => request<{ teams: Team[] }>("/teams"),
  uploadToken: (kind: string, fileName: string) =>
    request<UploadTarget>("/future-photo/upload-token", {
      method: "POST",
      headers: studentHeaders(true),
      body: JSON.stringify({ kind, file_name: fileName })
    }),
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
  submissions: () =>
    request<{
      future_photo_submissions: FuturePhotoSubmission[];
      task_submissions: unknown[];
    }>("/submissions", {
      headers: headers(true)
    }),
  setCurrentTask: (payload: { module_id?: string; title: string; activity_type: string }) =>
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
  return () => source.close();
}

export function setTeacherToken(token: string, teacher?: TeacherAccount) {
  window.localStorage.setItem("ceo_camp_teacher_token", token);
  if (teacher) window.localStorage.setItem("ceo_camp_teacher", JSON.stringify(teacher));
}

export function hasTeacherToken() {
  return Boolean(teacherToken());
}

export function getTeacherAccount() {
  const value = window.localStorage.getItem("ceo_camp_teacher");
  if (!value) return null;
  try {
    return JSON.parse(value) as TeacherAccount;
  } catch {
    return null;
  }
}

export function clearTeacherToken() {
  window.localStorage.removeItem("ceo_camp_teacher_token");
  window.localStorage.removeItem("ceo_camp_teacher");
}

export function setStudentToken(token: string, student?: StudentAccount) {
  window.localStorage.setItem("ceo_camp_student_token", token);
  if (student) window.localStorage.setItem("ceo_camp_student", JSON.stringify(student));
}

export function hasStudentToken() {
  return Boolean(studentToken());
}

export function getStudentAccount() {
  const value = window.localStorage.getItem("ceo_camp_student");
  if (!value) return null;
  try {
    return JSON.parse(value) as StudentAccount;
  } catch {
    return null;
  }
}

export function clearStudentToken() {
  window.localStorage.removeItem("ceo_camp_student_token");
  window.localStorage.removeItem("ceo_camp_student");
}
