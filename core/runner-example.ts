import { TextlintRunner } from "./textlint-runner.js";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const runner = new TextlintRunner();
  await runner.initialize();

  const samplePath = path.join(process.cwd(), "core", "sample.txt");
  const text = fs.readFileSync(samplePath, "utf8");
  
  const result = await runner.lintText(text);
  
  console.log("=== Lint Results ===");
  console.log(`Total issues: ${result.totalIssues}`);
  console.log(`Fixable issues: ${result.fixableIssues}`);
  console.log("");
  
  for (const finding of result.findings) {
    console.log(`[${finding.severity.toUpperCase()}] ${finding.ruleId}`);
    console.log(`  Message: ${finding.message}`);
    console.log(`  Location: ${finding.range.start.line}:${finding.range.start.column}`);
    if (finding.fix) {
      console.log(`  Fix available: "${finding.fix.text}"`);
    }
    console.log("");
  }

  if (result.fixableIssues > 0) {
    console.log("=== Applying Fixes ===");
    const fixableFindings = result.findings.filter(f => f.fix);
    const fixedText = runner.applyFixes(text, fixableFindings);
    
    console.log("Original text:");
    console.log(text);
    console.log("\nFixed text:");
    console.log(fixedText);
  }
}

main().catch(console.error);