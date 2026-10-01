/* Хук PostToolUse: после правки файла в src/ — dev-сборка Vite всего приложения и тесты модели «Лавки».
   Работает на Linux, macOS и Windows (только Node). При ошибке — код 2: Claude Code покажет вывод и попросит починить. */
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
let file = "";
try { const j = JSON.parse(raw); file = j.tool_input?.file_path || j.tool_input?.path || ""; } catch {}

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join("/");
if (!rel.startsWith("src/")) process.exit(0);
try { fs.mkdirSync(path.join(root, "node_modules/.cache"), { recursive: true }); fs.writeFileSync(path.join(root, "node_modules/.cache/hook-last.txt"), `${new Date().toISOString()} ${rel}\n`); } catch {}

try {
  execSync("npm run --silent check", { cwd: root, stdio: "pipe", encoding: "utf8", timeout: 170000 });
  process.stdout.write(`Проверка после правки ${rel}: сборка и тесты — OK\n`);
} catch (e) {
  const out = `${e.stdout || ""}\n${e.stderr || ""}`.split("\n").filter((l) => /rror|not ok|fail|✖|Expected|at .*src\//i.test(l)).slice(0, 40).join("\n");
  process.stderr.write(`Проверка после правки ${rel} не прошла (npm run check):\n${out || (e.stdout || "") + (e.stderr || "")}\n`);
  process.exit(2);
}
