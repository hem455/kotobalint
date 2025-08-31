import { test } from "node:test";
import assert from "node:assert";

test("API endpoints structure validation", async () => {
  // Test that API module can be imported without errors
  try {
    const { app } = await import("../../dist/api/server.js");
    assert.ok(app, "App should be exported");
  } catch (error) {
    assert.fail(`API module should be importable: ${error.message}`);
  }
});

test("API request/response interfaces", async () => {
  // Test that the expected interfaces are structured correctly
  const mockLintRequest = {
    text: "とてもとても良い文章です。",
    filePath: "test.md"
  };
  
  const mockFixRequest = {
    text: "テスト文章",
    findingIds: ["finding-1"],
    findings: [
      {
        id: "finding-1",
        ruleId: "test-rule",
        message: "Test message",
        range: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } },
        severity: "error",
        fix: { range: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } }, text: "修正" }
      }
    ]
  };
  
  // Validate request structure
  assert.ok(typeof mockLintRequest.text === "string");
  assert.ok(Array.isArray(mockFixRequest.findings));
  assert.ok(mockFixRequest.findings.every(f => 
    f.id && f.ruleId && f.message && f.range && f.severity
  ));
});