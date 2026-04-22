import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, "../../"), "");
  const backendPort = env.PORT || "5001";
  const frontendPort = Number(env.PORT_FRONTEND) || 5173;

  return {
    base: "/",
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port: frontendPort,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
      },
    },
    preview: {
      port: frontendPort,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
