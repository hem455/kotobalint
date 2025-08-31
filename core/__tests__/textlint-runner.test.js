import { test } from "node:test";
import assert from "node:assert";
import { TextlintRunner } from "../../dist/core/textlint-runner.js";

test("TextlintRunner basic functionality", async () => {
  const runner = new TextlintRunner();
  await runner.initialize();
  
  const testText = "とてもとても良い文章です。。でも、これはどうかも知れません。";
  const result = await runner.lintText(testText);
  
  assert.strictEqual(typeof result.totalIssues, "number");
  assert.strictEqual(typeof result.fixableIssues, "number");
  assert.ok(Array.isArray(result.findings));
  assert.ok(result.totalIssues > 0, "Should detect issues in test text");
});

test("TextlintRunner config management", async () => {
  const runner = new TextlintRunner({
    presets: ["textlint-rule-preset-ja-technical-writing"],
    rules: [],
    dictionary: [],
    ignorePatterns: []
  });
  
  const config = runner.getConfig();
  assert.ok(Array.isArray(config.presets));
  assert.ok(config.presets.includes("textlint-rule-preset-ja-technical-writing"));
});

test("Finding structure validation", async () => {
  const runner = new TextlintRunner();
  await runner.initialize();
  
  const result = await runner.lintText("とてもとても良い");
  
  if (result.findings.length > 0) {
    const finding = result.findings[0];
    assert.ok(finding.id);
    assert.ok(finding.ruleId);
    assert.ok(finding.message);
    assert.ok(finding.range);
    assert.ok(finding.range.start);
    assert.ok(typeof finding.range.start.line === "number");
    assert.ok(typeof finding.range.start.column === "number");
    assert.ok(["error", "warning", "info"].includes(finding.severity));
  }
});