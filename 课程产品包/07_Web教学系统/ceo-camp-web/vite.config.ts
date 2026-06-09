import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        teacher: resolve(__dirname, "teacher.html"),
        teacherWorkspace: resolve(__dirname, "teacher-workspace.html"),
        teacherProgress: resolve(__dirname, "teacher-progress.html"),
        teacherStudents: resolve(__dirname, "teacher-students.html"),
        teacherSubmissions: resolve(__dirname, "teacher-submissions.html"),
        teacherShowcaseAdmin: resolve(__dirname, "teacher-showcase-admin.html"),
        student: resolve(__dirname, "student.html"),
        wall: resolve(__dirname, "wall.html"),
        showcase: resolve(__dirname, "showcase.html"),
        parents: resolve(__dirname, "parents.html")
      }
    }
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:7001",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
