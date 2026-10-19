import { defineConfig } from "vite";
import { env } from "node:process";
import { createReadStream, cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// PDF.js resolves these resources by filename. Keep the same local paths in
// development and embedded builds; no CDN or network access is needed at runtime.
const pdfAssets = ["cmaps", "standard_fonts", "wasm", "iccs"];
let outputDirectory = "";
let resourcePath = "/pdf-assets";
export default defineConfig({
  // Desktop builds use the root; Pages builds set their repository subpath.
  base: env.COLLATE_WEB_BASE || "/",
  plugins: [{
    name: "local-pdf-assets",
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir);
      resourcePath = `${config.base}pdf-assets`;
    },
    configureServer(server) {
      server.middlewares.use(resourcePath, (request, response, next) => {
        const match = request.url?.split("?")[0]?.match(/^\/(cmaps|standard_fonts|wasm|iccs)\/([\w.-]+)$/);
        if (!match) { next(); return; }
        const path = resolve("node_modules/pdfjs-dist", match[1]!, match[2]!);
        if (!existsSync(path)) { next(); return; }
        response.setHeader("Content-Type", path.endsWith(".wasm") ? "application/wasm" : path.endsWith(".js") ? "text/javascript" : "application/octet-stream");
        createReadStream(path).pipe(response);
      });
    },
    closeBundle() {
      mkdirSync(resolve(outputDirectory, "pdf-assets"), { recursive: true });
      for (const directory of pdfAssets) cpSync(resolve("node_modules/pdfjs-dist", directory), resolve(outputDirectory, "pdf-assets", directory), { recursive: true });
    },
  }],
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ["**/.mygo/**", "**/build/**"] },
  },
});
