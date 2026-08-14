/**
 * Dev tool: screenshot a page with a real wall-clock wait (unlike chrome's
 * --virtual-time-budget, which races past network I/O).
 *
 * Usage: node scripts/headless-shot.mjs <url> <outfile.png> [waitMs=12000]
 * Prints page console messages tagged [GLOBE] or errors to stdout.
 */
import { spawn } from "child_process";

const [url = "http://localhost:3000/dashboard", out = "/tmp/shot.png", waitMs = "12000"] =
  process.argv.slice(2);
const PORT = 9223;

const chrome = spawn(
  "google-chrome-stable",
  [
    "--headless=new",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1600,1000",
    "--no-first-run",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // wait for CDP
  let target;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      target = targets.find((t) => t.type === "page");
      if (target) break;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  if (!target) throw new Error("CDP never came up");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let msgId = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((res) => {
      const id = ++msgId;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    } else if (msg.method === "Runtime.consoleAPICalled") {
      const text = (msg.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ");
      if (/GLOBE|error|Error|fail/i.test(text)) console.log("[console]", text.slice(0, 300));
    }
  };

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url });
  await sleep(Number(waitMs));

  const shot = await send("Page.captureScreenshot", { format: "png" });
  const { writeFileSync } = await import("fs");
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("saved", out);
  ws.close();
} finally {
  chrome.kill("SIGKILL");
}
