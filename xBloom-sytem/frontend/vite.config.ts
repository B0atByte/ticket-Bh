import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

// Serve over HTTPS when a cert is present (mounted at ./certs). HTTPS makes the
// page a secure context, which the LIVE camera scanner (getUserMedia) needs to
// work on LAN phones — over plain HTTP it falls back to photo capture.
// Generate certs with: openssl ... (see certs/san.cnf). No certs → plain HTTP.
const certDir = process.env.VITE_CERT_DIR || path.resolve(process.cwd(), "certs");
const keyPath = path.join(certDir, "key.pem");
const certPath = path.join(certDir, "cert.pem");
const https =
  fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
    : undefined;

// Unique per build / dev-server start. The app fetches /__build and reloads
// itself when this changes, so mobile users get updates without clearing cache.
const BUILD_ID = Date.now().toString();

function buildId(): Plugin {
  return {
    name: "build-id",
    configureServer(server) {
      server.middlewares.use("/__build", (_req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "text/plain");
        res.end(BUILD_ID);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "__build", source: BUILD_ID });
    },
  };
}

export default defineConfig(({ mode }) => {
  // In Docker, VITE_PROXY_TARGET is a real container env var and lands in
  // process.env directly. For local `npm run dev` it only lives in .env.local,
  // which Vite doesn't inject into process.env for the config file itself —
  // loadEnv() is what actually reads that file. Browsers always call
  // same-origin /api, so LAN clients don't need to know the API host (and
  // there's no CORS).
  const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
  const proxyTarget = process.env.VITE_PROXY_TARGET || fileEnv.VITE_PROXY_TARGET || "http://localhost:8080";

  return {
    plugins: [react(), buildId()],
    define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
    server: {
      host: true,
      port: 5176,
      https,
      proxy: {
        "/api": { target: proxyTarget, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
      },
    },
  };
});
