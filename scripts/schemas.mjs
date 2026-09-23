// Validates the manifests against the schemas their formats publish.
//
//   npm install --no-save ajv@8 ajv-formats@3 && node scripts/schemas.mjs
//
// CI runs it. It fetches each schema, so it checks against what the format
// says today: plugin.json and mcp.json against Agent Plugins', and Cursor's
// manifest against Cursor's, which rejects a field it doesn't know. Claude
// Code's manifests are checked by `claude plugin validate`, which CI runs too.

import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const CHECKS = [
  ["plugin.json", "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json", Ajv2020],
  ["mcp.json", "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json", Ajv2020],
  [".cursor-plugin/plugin.json", "https://raw.githubusercontent.com/cursor/plugins/main/schemas/plugin.schema.json", Ajv],
];

let failed = false;
for (const [file, url, Validator] of CHECKS) {
  const response = await fetch(url);
  if (!response.ok) {
    process.stderr.write(`${file}: couldn't fetch its schema, ${url}: ${response.status}\n`);
    failed = true;
    continue;
  }
  const ajv = new Validator({ allErrors: true, strict: false });
  addFormats(ajv);
  const valid = ajv.validate(await response.json(), JSON.parse(readFileSync(join(root, file), "utf8")));
  if (valid) {
    process.stdout.write(`${file}: valid against ${url}\n`);
  } else {
    failed = true;
    process.stderr.write(`${file}: invalid against ${url}\n${ajv.errors.map((error) => `  ${error.instancePath || "/"} ${error.message}\n`).join("")}`);
  }
}
process.exit(failed ? 1 : 0);
