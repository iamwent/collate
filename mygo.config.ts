import { env } from "node:process";
import { defineConfig } from "mygo-cli";

export default defineConfig({
  name: "collate",
  identifier: "com.example.collate",
  version: env.COLLATE_VERSION || "0.1.0",
  // PDF.js supports Safari/WebKit 18+ through its compatibility build.
  macos: { minimumSystemVersion: "15.0" },
  // `mygo dev` runs devCommand and loads devUrl; `mygo build` runs
  // buildCommand and embeds frontendDist into the app.
  devUrl: "http://localhost:5173",
  devCommand: "bun run dev:web",
  buildCommand: "bun run build:web",
  frontendDist: "dist",
  bindings: "src/mygo.ts",
  out: "build",
});
