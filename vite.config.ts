import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";

function appVersionPlugin(): Plugin {
  const version = String(Date.now());
  const payload = JSON.stringify({ version });
  return {
    name: "la-solucion-app-version",
    config() {
      return {
        define: {
          __APP_VERSION__: JSON.stringify(version)
        }
      };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] || "";
        if (url !== "/version.json") {
          next();
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.end(payload);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: payload });
    }
  };
}

export default defineConfig({
  plugins: [react(), appVersionPlugin()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate"
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        timeout: 600000
      }
    }
  },
  preview: {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  }
});
