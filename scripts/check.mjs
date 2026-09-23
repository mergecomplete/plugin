// Checks that the plugin's files agree with each other, since each agent reads
// its own copy of the same facts.
//
//   node scripts/check.mjs
//
// CI runs it on every push, and it's the thing to run before tagging a
// release. It needs Node 20 or later and nothing installed.
//
// What it holds:
//   - the three manifests and the marketplace entry name the same plugin, with
//     the same version and description;
//   - .mcp.json (Claude Code), mcp.json (Codex) and Cursor's manifest start the
//     same server, the launcher, each in the form its agent expands;
//   - Codex's listing summary is the marketplace's description;
//   - the fallback servers list the runner's five tools, and the launcher and
//     the Windows server give the same answer on Windows;
//   - the launcher is executable, on disk and in git;
//   - each skill is named for its directory, as the Agent Skills format requires;
//   - every file a manifest points at exists;
//   - CHANGELOG.md has a section for the version, and nothing published names a
//     ticket, which means nothing to someone outside the project.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const failures = [];
const fail = (message) => failures.push(message);

const read = (rel) => readFileSync(join(root, rel), "utf8");
function json(rel) {
  try {
    return JSON.parse(read(rel));
  } catch (err) {
    fail(`${rel} isn't valid JSON: ${err instanceof Error ? err.message : err}`);
    return {};
  }
}

const claude = json(".claude-plugin/plugin.json");
const marketplace = json(".claude-plugin/marketplace.json");
const cursor = json(".cursor-plugin/plugin.json");
const agent = json("plugin.json");
const claudeMcp = json(".mcp.json");
const agentMcp = json("mcp.json");

// The manifests.
const entry = (marketplace.plugins ?? []).find((plugin) => plugin.source === "./");
if (!entry) fail(".claude-plugin/marketplace.json has no entry whose source is this repository (\"./\")");
const manifests = {
  ".claude-plugin/plugin.json": claude,
  ".cursor-plugin/plugin.json": cursor,
  "plugin.json": agent,
  ".claude-plugin/marketplace.json's entry": entry ?? {},
};
for (const field of ["name", "version", "description"]) {
  const values = new Map(Object.entries(manifests).map(([file, manifest]) => [file, manifest[field]]));
  const distinct = new Set(values.values());
  if (distinct.size !== 1 || distinct.has(undefined)) {
    fail(`the manifests' ${field}s disagree:\n${[...values].map(([file, value]) => `    ${file}: ${JSON.stringify(value)}`).join("\n")}`);
  }
}
if (!/^\d+\.\d+\.\d+$/.test(claude.version ?? "")) fail(`the version, ${JSON.stringify(claude.version)}, isn't X.Y.Z`);
if (marketplace.name !== claude.name) fail(`the marketplace is ${JSON.stringify(marketplace.name)} and the plugin ${JSON.stringify(claude.name)}: installing is name@name`);
if (agent.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") {
  fail("plugin.json's $schema must be exactly https://agent-plugins.org/schemas/1.0.0/plugin.schema.json, or Codex doesn't read it as a plugin");
}
const openai = agent.extensions?.["com.openai"]?.interface ?? {};
if (openai.longDescription !== agent.description) fail("plugin.json's extensions.com.openai.interface.longDescription isn't its description");
if (openai.displayName !== agent.name) fail("plugin.json's extensions.com.openai.interface.displayName isn't its name");
if (openai.shortDescription !== marketplace.description) {
  fail(`plugin.json's extensions.com.openai.interface.shortDescription, ${JSON.stringify(openai.shortDescription)}, isn't the marketplace's description, ${JSON.stringify(marketplace.description)}: both are the listing's summary`);
}
for (const field of Object.keys(cursor.author ?? {})) {
  if (!["name", "email"].includes(field)) fail(`.cursor-plugin/plugin.json's author has ${field}, and Cursor's schema takes only name and email`);
}

// The server. Each agent starts it from its own file, in the form it expands:
// Codex takes a ./ path and expands nothing in a command (Agent Plugins), and
// Claude Code and Cursor take their own root variable.
const LAUNCHER = "bin/mergecomplete-mcp";
const FORMS = {
  ".mcp.json": { servers: claudeMcp.mcpServers, prefix: "${CLAUDE_PLUGIN_ROOT}/" },
  "mcp.json": { servers: agentMcp.mcpServers, prefix: "./" },
  ".cursor-plugin/plugin.json": { servers: cursor.mcpServers, prefix: "${CURSOR_PLUGIN_ROOT}/" },
};
const normalised = {};
for (const [file, { servers, prefix }] of Object.entries(FORMS)) {
  const names = Object.keys(servers ?? {});
  if (names.length !== 1) {
    fail(`${file} should start one server, and starts ${names.length}`);
    continue;
  }
  const server = servers[names[0]];
  if (typeof server.command !== "string" || !server.command.startsWith(prefix)) {
    fail(`${file} starts ${JSON.stringify(server.command)}, and its agent needs a command starting ${prefix}`);
    continue;
  }
  normalised[file] = JSON.stringify({
    name: names[0],
    command: server.command.slice(prefix.length),
    args: server.args ?? [],
    env: server.env ?? {},
  });
}
if (new Set(Object.values(normalised)).size > 1) {
  fail(`the MCP files disagree about the server:\n${Object.entries(normalised).map(([file, server]) => `    ${file}: ${server}`).join("\n")}`);
}
const first = Object.values(normalised)[0];
if (first) {
  const { name, command } = JSON.parse(first);
  if (command !== LAUNCHER) fail(`the server is started as ${command}, not the launcher, ${LAUNCHER}`);
  if (name !== claude.name) fail(`the server is called ${name}, and the plugin ${claude.name}`);
}
if (agentMcp.$schema !== "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json") fail("mcp.json's $schema isn't the Agent Plugins MCP schema");
for (const server of Object.values(agentMcp.mcpServers ?? {})) {
  if (server.type !== "stdio") fail("mcp.json's server needs \"type\": \"stdio\"");
}
if (!existsSync(join(root, LAUNCHER)) || !(statSync(join(root, LAUNCHER)).mode & 0o111)) fail(`${LAUNCHER} is missing or not executable`);
if (!existsSync(join(root, `${LAUNCHER}.exe`))) fail(`${LAUNCHER}.exe, the server on Windows, is missing: scripts/build-windows.sh builds it`);
// Git keeps the mode it was given, and every manifest runs the launcher
// directly, so a launcher committed without its executable bit breaks every
// install. Only checked once it's tracked.
try {
  const staged = execFileSync("git", ["ls-files", "-s", "--", LAUNCHER], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  if (staged && !staged.startsWith("100755 ")) fail(`git has ${LAUNCHER} as ${staged.split(" ")[0]}, not 100755: git update-index --chmod=+x ${LAUNCHER}`);
} catch {
  // Not a git checkout, such as an agent's copy of the plugin.
}

// The fallback servers' tools, which are the runner's.
const TOOLS = ["list_changes", "read_review", "review", "review_result", "status"];
const tools = json("fallback/tools.json");
const names = Array.isArray(tools) ? tools.map((tool) => tool.name) : [];
if (JSON.stringify(names) !== JSON.stringify(TOOLS)) fail(`fallback/tools.json lists ${names.join(", ")}, not the runner's ${TOOLS.join(", ")}`);
for (const tool of Array.isArray(tools) ? tools : []) {
  if (!tool.description || tool.inputSchema?.type !== "object") fail(`fallback/tools.json's ${tool.name} needs a description and an object inputSchema`);
}
if (!existsSync(join(root, "fallback/instructions.txt"))) fail("fallback/instructions.txt, the runner's instructions, which the launcher gives while it installs the runner, is missing");

// The answer on Windows is written twice: in the launcher, for a shell on
// Windows such as Git Bash, and in the .exe the agents start there.
const windows = (text) => /"(There's no runner for Windows yet[^"]*)"/.exec(text)?.[1];
const launcherWindows = windows(read(LAUNCHER));
const exeWindows = windows(read("fallback/main.go"));
if (!launcherWindows || launcherWindows !== exeWindows) {
  fail(`the launcher and fallback/main.go answer differently on Windows:\n    ${LAUNCHER}: ${JSON.stringify(launcherWindows)}\n    fallback/main.go: ${JSON.stringify(exeWindows)}\n  Change both, then run scripts/build-windows.sh`);
}

// The skills.
const SKILLS = ["address-the-review", "review", "setup"];
const skills = existsSync(join(root, "skills")) ? readdirSync(join(root, "skills")).filter((dir) => !dir.startsWith(".")).sort() : [];
if (JSON.stringify(skills) !== JSON.stringify(SKILLS)) fail(`skills/ holds ${skills.join(", ") || "nothing"}, not ${SKILLS.join(", ")}`);
for (const skill of skills) {
  const rel = `skills/${skill}/SKILL.md`;
  if (!existsSync(join(root, rel))) {
    fail(`${rel} is missing`);
    continue;
  }
  const front = /^---\n([\s\S]*?)\n---\n/.exec(read(rel))?.[1];
  if (!front) {
    fail(`${rel} has no frontmatter`);
    continue;
  }
  const name = /^name:\s*(.+)$/m.exec(front)?.[1].trim();
  const description = /^description:\s*(.+)$/m.exec(front)?.[1].trim();
  if (name !== skill) fail(`${rel} is named ${JSON.stringify(name)}, and must be named for its directory, ${skill}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name ?? "") || name.length > 64) fail(`${rel}'s name must be lowercase words joined by hyphens, at most 64 characters`);
  if (!description) fail(`${rel} has no description`);
  else if (description.length > 1024) fail(`${rel}'s description is ${description.length} characters, and the limit is 1024`);
}

// Every file a manifest points at.
const pointed = [
  cursor.logo,
  openai.composerIcon,
  openai.logo,
  openai.logoDark,
].filter(Boolean);
for (const path of pointed) {
  if (!existsSync(join(root, path))) fail(`a manifest points at ${path}, which doesn't exist`);
}

// What's published.
const changelog = existsSync(join(root, "CHANGELOG.md")) ? read("CHANGELOG.md") : "";
if (!changelog.includes(`## [${claude.version}]`)) fail(`CHANGELOG.md has no section for ${claude.version}`);
const published = ["README.md", "CHANGELOG.md", ...skills.map((skill) => `skills/${skill}/SKILL.md`)];
for (const rel of published) {
  if (!existsSync(join(root, rel))) {
    fail(`${rel} is missing`);
    continue;
  }
  read(rel)
    .split("\n")
    .forEach((line, at) => {
      const ticket = /\b[A-Z]{2,}-\d+\b/.exec(line);
      if (ticket) fail(`${rel}:${at + 1} names ${ticket[0]}, a ticket, which means nothing to someone outside the project`);
    });
}

if (failures.length > 0) {
  process.stderr.write(`The plugin's files disagree:\n${failures.map((failure) => `  - ${failure}`).join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`The plugin's files agree: ${claude.name} ${claude.version}, three manifests, three MCP files, ${skills.length} skills.\n`);
