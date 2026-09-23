// Starts the plugin's server the way an agent does and talks MCP to it over
// standard input and output.
//
//   node scripts/smoke.mjs                         start bin/mergecomplete-mcp; initialize, list the tools
//   node scripts/smoke.mjs --every-tool "<text>"   and call every tool, each of which must answer
//                                                  isError with <text> in what it says
//   node scripts/smoke.mjs --call <tool> "<text>"  and call one tool, whose answer must have <text> in it
//   node scripts/smoke.mjs --command <path> --args mcp
//                                                  start something else, such as a runner's own mcp
//
// initialize must be answered within INIT_TIMEOUT_MS, ten seconds by default,
// which is how long Codex waits for a server to start.
//
// The command is started with no extension on every platform, as the manifests
// start it, so on Windows this also shows that bin/mergecomplete-mcp.exe is the
// program an agent finds. Its standard error is passed through, since that's
// where the launcher says what it did.

import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? null : args[at + 1];
};
const root = fileURLToPath(new URL("..", import.meta.url));
const command = flag("--command") ?? join(root, "bin", "mergecomplete-mcp");
const commandArgs = (flag("--args") ?? "").split(" ").filter(Boolean);
const expect = flag("--every-tool");
const one = flag("--call");
const oneText = one === null ? null : args[args.indexOf("--call") + 2];
const TOOLS = ["list_changes", "read_review", "review", "review_result", "status"];
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 120_000);
const INIT_TIMEOUT_MS = Number(process.env.INIT_TIMEOUT_MS ?? 10_000);

const die = (message) => {
  process.stderr.write(`smoke: ${message}\n`);
  process.exit(1);
};

const server = spawn(command, commandArgs, { stdio: ["pipe", "pipe", "inherit"] });
server.on("error", (err) => die(`couldn't start ${command}: ${err.message}`));
const timer = setTimeout(() => {
  server.kill();
  die(`no answer from ${command} within ${TIMEOUT_MS / 1000}s`);
}, TIMEOUT_MS);

const waiting = new Map();
let buffer = "";
server.stdout.setEncoding("utf8");
server.stdout.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      die(`the server wrote a line that isn't JSON, which breaks the protocol: ${line.slice(0, 200)}`);
    }
    const resolve = waiting.get(message.id);
    if (!resolve && "id" in message && !("method" in message)) die(`the server answered id ${JSON.stringify(message.id)}, which was never asked: ${line.slice(0, 200)}`);
    if (resolve) {
      waiting.delete(message.id);
      resolve(message);
    }
  }
});
server.on("exit", (code) => {
  if (waiting.size > 0) die(`${command} exited with ${code} before answering`);
});

let next = 1;
// Every request is written with its id last, after params, as Claude Code and
// Cursor write theirs.
const request = (method, params) =>
  new Promise((resolve) => {
    const id = next++;
    waiting.set(id, resolve);
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params, id })}\n`);
  });
const notify = (method) => server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);

const started = Date.now();
const init = await request("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "smoke", version: "1" },
});
const took = Date.now() - started;
if (took > INIT_TIMEOUT_MS) die(`initialize took ${took}ms, and Codex waits ${INIT_TIMEOUT_MS}ms for a server to start`);
if (init.error) die(`initialize failed: ${JSON.stringify(init.error)}`);
if (init.result?.serverInfo?.name !== "mergecomplete") die(`initialize answered as ${JSON.stringify(init.result?.serverInfo)}`);
if (init.result.protocolVersion !== "2025-06-18") die(`initialize answered protocol ${init.result.protocolVersion}, not the one asked for`);
process.stdout.write(`initialize: ${init.result.serverInfo.name} ${init.result.serverInfo.version}, protocol ${init.result.protocolVersion}, in ${took}ms\n`);
notify("notifications/initialized");

const list = await request("tools/list", {});
const names = (list.result?.tools ?? []).map((tool) => tool.name);
if (JSON.stringify(names) !== JSON.stringify(TOOLS)) die(`tools/list answered ${names.join(", ")}, not ${TOOLS.join(", ")}`);
process.stdout.write(`tools/list: ${names.join(", ")}\n`);

if (expect !== null) {
  const ping = await request("ping", {});
  if (!ping.result) die(`ping answered ${JSON.stringify(ping)}`);
  for (const name of TOOLS) {
    // An argument named id, which mustn't be taken for the request's.
    const call = await request("tools/call", { name, arguments: name === "review" ? { id: "999" } : {} });
    const text = call.result?.content?.[0]?.text ?? "";
    if (call.result?.isError !== true) die(`${name} didn't answer with isError: ${JSON.stringify(call)}`);
    if (!text.includes(expect)) die(`${name} answered ${JSON.stringify(text)}, without ${JSON.stringify(expect)}`);
    process.stdout.write(`tools/call ${name}: isError, "${text}"\n`);
  }
}

if (one !== null) {
  const call = await request("tools/call", { name: one, arguments: {} });
  const text = call.result?.content?.[0]?.text ?? "";
  if (!text.includes(oneText ?? "")) die(`${one} answered ${JSON.stringify(call)}, without ${JSON.stringify(oneText)}`);
  process.stdout.write(`tools/call ${one}: "${text}"\n`);
}

clearTimeout(timer);
server.stdin.end();
process.stdout.write("ok\n");
