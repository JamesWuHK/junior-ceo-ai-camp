import "./styles.css";
import { classroomPath } from "./routes";

const entries = [
  { title: "教师端", text: "课件与课堂流程", href: classroomPath("teacher.html"), marker: "T" },
  { title: "学生端", text: "当前课堂任务", href: classroomPath("student.html"), marker: "S" },
  { title: "课堂大屏", text: "照片墙与作品秀", href: classroomPath("wall.html"), marker: "W" },
  { title: "作品展", text: "结营路演作品", href: classroomPath("showcase.html"), marker: "P" },
  { title: "家长观察", text: "作品展示与观察评分", href: classroomPath("parents.html"), marker: "F" }
];

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

root.innerHTML = `
  <main class="home-page">
    <section class="home-hero">
      <span class="eyebrow">少年CEO AI 创业营</span>
      <h1>课堂系统入口</h1>
    </section>
    <section class="home-entry-grid" aria-label="课堂入口">
      ${entries
        .map(
          (entry) => `
            <a class="home-entry-card" href="${entry.href}">
              <span class="home-entry-icon" aria-hidden="true">${entry.marker}</span>
              <strong>${entry.title}</strong>
              <span>${entry.text}</span>
            </a>
          `
        )
        .join("")}
    </section>
  </main>
`;
