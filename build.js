// Build script to bundle ES modules into CommonJS for pkg
import * as esbuild from "esbuild";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, writeFileSync, cpSync, existsSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // Ensure dist directory exists
  if (!existsSync("dist")) {
    mkdirSync("dist", { recursive: true });
  }

  // First, bundle with esbuild
  await esbuild.build({
    entryPoints: [join(__dirname, "server.ts")],
    bundle: true,
    platform: "node",
    target: "node18",
    format: "cjs",
    outfile: "dist/server.bundled.cjs",
    external: ["express", "socket.io"], // Don't bundle these, pkg will include them
  });

  // Then fix __dirname and __filename references for CommonJS
  let bundled = readFileSync("dist/server.bundled.cjs", "utf8");

  // Replace the fileURLToPath(import.meta.url) pattern with proper CommonJS __filename
  bundled = bundled.replace(
    /var __filename = \(0, import_url\.fileURLToPath\)\(import_meta\.url\);/g,
    "var __filename = __filename;",
  );

  // Replace __dirname assignment
  bundled = bundled.replace(
    /var __dirname = .*?\.dirname\(__filename\);/g,
    "var __dirname = __dirname;",
  );

  writeFileSync("dist/server.bundled.cjs", bundled, "utf8");

  // Copy public assets to dist
  cpSync("public", "dist/public", { recursive: true });

  console.log("✓ Bundle created and patched for CommonJS");
  console.log("✓ Public assets copied to dist/");
} catch (error) {
  console.error("✗ Build failed:", error);
  process.exit(1);
}
