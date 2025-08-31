import { TextLintCore } from "textlint";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

const core = new TextLintCore();
const preset = require("textlint-rule-preset-ja-technical-writing");
const textPlugin = require("textlint-plugin-text");
core.setupPlugins({ text: textPlugin }, {});
// Preset exports { rules, rulesConfig }
core.setupRules(preset.rules, preset.rulesConfig || {});

const samplePath = path.join(process.cwd(), "core", "sample.txt");
const text = fs.readFileSync(samplePath, "utf8");
const result = await core.lintText(text, ".txt");

console.log("Messages:");
for (const m of result.messages) {
  console.log(`- [${m.severity}] (${m.ruleId}) ${m.message} at ${m.line}:${m.column}`);
}
console.log(`\nFound: ${result.messages.length} issue(s).`);
