import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["apps", "packages", "docs/new-platform", "scripts"];
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".sql", ".css", ".html", ".example"]);
const forbidden = [
  new RegExp(["AKfycbwAJKCcb", "BwwMqdO0khsiY6yy", "HkQOcdW6BaECIb1u6GfxOSmB9DCVFGlBWLnbiSstSch"].join(""), "i"),
  new RegExp(["d23e6a2d96ee", "47809d524845", "66e7b76e"].join(""), "i"),
  new RegExp(["script\\.google\\.com", "/macros/s/", "AKfy"].join(""), "i")
];

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".vite"].includes(entry.name)) continue;
      files.push(...await listFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const problems = [];
for (const root of roots) {
  try {
    const files = await listFiles(root);
    for (const file of files) {
      const ext = path.extname(file);
      if (!textExtensions.has(ext) && !file.endsWith(".env.example")) continue;
      const text = await readFile(file, "utf8");
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/\s+$/.test(line)) problems.push(`${file}:${index + 1} trailing whitespace`);
        forbidden.forEach((pattern) => {
          if (pattern.test(line)) problems.push(`${file}:${index + 1} forbidden legacy secret/url`);
        });
      });
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("new-platform lint ok");
