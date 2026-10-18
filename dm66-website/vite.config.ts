import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiFiles: Record<string, string> = {
  "/api/letters": "/api/letters.ts",
  "/api/recipient/login": "/api/recipient/login.ts",
  "/api/recipient/session": "/api/recipient/session.ts",
  "/api/recipient/logout": "/api/recipient/logout.ts",
  "/api/admin/login": "/api/admin/login.ts",
  "/api/admin/logout": "/api/admin/logout.ts",
  "/api/admin/session": "/api/admin/session.ts",
  "/api/admin/letters": "/api/admin/letters.ts",
  "/api/admin/export": "/api/admin/export.ts",
};

// Use the same server handlers locally and on Vercel; never emulate saved letters.
function localApi(): Plugin {
  return {
    name: "dm66-local-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = new URL(request.url || "/", "http://localhost").pathname;
        if (!path.startsWith("/api/")) return next();
        const file = apiFiles[path];
        if (!file) {
          response.statusCode = 404;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: "Không tìm thấy API." }));
          return;
        }
        void server.ssrLoadModule(file).then((module) => module.default(request, response)).catch(() => {
          if (response.writableEnded) return;
          response.statusCode = 503;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: "Chưa thể khởi động API. Vui lòng kiểm tra cấu hình máy chủ.", code: "DEV_API_ERROR" }));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "SUPABASE_");
  for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY_FORMAT"]) {
    if (!process.env[name] && environment[name]) process.env[name] = environment[name];
  }
  return {
    plugins: [localApi(), react(), tailwindcss()],
    server: { host: "0.0.0.0" },
  };
});
