// Runs the API and the web app together: `npm run dev`. One Ctrl+C stops both.
// Plain Node (no extra package), so it works the same on macOS, Linux and Windows.
import { spawn } from "node:child_process";

const services = [
  { name: "api", script: "dev:api" },
  { name: "web", script: "dev:web" },
];
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const children = services.map(({ name, script }) => {
  const child = spawn(npm, ["run", script], { stdio: ["inherit", "pipe", "pipe"], shell: process.platform === "win32" });
  const prefix = `[${name}] `;
  for (const [stream, out] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    let pending = "";
    stream.on("data", (chunk) => {
      const lines = (pending + chunk).split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) out.write(`${prefix}${line}\n`);
    });
    stream.on("end", () => pending && out.write(`${prefix}${pending}\n`));
  }
  child.on("exit", (code, signal) => {
    console.log(`${prefix}stopped (${signal ?? code})`);
    stop(code ?? 1);
  });
  return child;
});

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 3000).unref();
  Promise.all(children.map((child) => new Promise((resolve) => (child.exitCode === null ? child.once("exit", resolve) : resolve())))).then(() => process.exit(code));
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
