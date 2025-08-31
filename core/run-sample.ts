import { TextLintCore } from "textlint";
import { createRequire } from "module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

async function main() {
  const core = new TextLintCore();
  // Load preset as a rule set
  const preset = require("textlint-rule-preset-ja-technical-writing");
  core.setupRules({ "preset-ja-technical-writing": preset }, {});

  const samplePath = path.join(process.cwd(), "core", "sample.txt");
  const text = fs.readFileSync(samplePath, "utf8");
  const result = await core.lintText(text, { ext: ".md" });

  console.log("Messages:");
  for (const m of result.messages) {
    console.log(`- [${m.severity}] (${m.ruleId}) ${m.message} at ${m.line}:${m.column}`);
  }
  console.log(`\nFound: ${result.messages.length} issue(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

