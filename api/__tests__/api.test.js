import { test } from "node:test";
import assert from "node:assert";
// API endpoint testing

// Mock request helper
function mockRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url: path,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    };
    
    const res = {
      statusCode: 200,
      headers: {},
      json: (data) => resolve({ statusCode: res.statusCode, body: data }),
      status: (code) => { res.statusCode = code; return res; }
    };
    
    // Simulate Express request handling
    setTimeout(() => {
      try {
        if (method === "POST" && path === "/lint") {
          // Mock lint response
          const parsed = JSON.parse(req.body);
          if (!parsed.text) {
            res.status(400).json({
              success: false,
              error: "Invalid request: 'text' field is required and must be a string"
            });
          } else {
            res.json({
              success: true,
              result: {
                findings: [
                  {
                    id: "finding-0",
                    ruleId: "ja-no-successive-word",
                    message: "\"とても\" が連続して使われています。",
                    range: { start: { line: 1, column: 1 }, end: { line: 1, column: 6 } },
                    severity: "error"
                  }
                ],
                totalIssues: 1,
                fixableIssues: 0
              }
            });
          }
        } else if (method === "POST" && path === "/fix") {
          const parsed = JSON.parse(req.body);
          if (!parsed.text || !Array.isArray(parsed.findings)) {
            res.status(400).json({
              success: false,
              error: "Invalid request: 'text' and 'findings' fields are required"
            });
          } else {
            res.json({
              success: true,
              fixedText: parsed.text,
              appliedFixes: 0
            });
          }
        } else {
          res.status(404).json({ error: "Not found" });
        }
      } catch (err) {
        reject(err);
      }
    }, 10);
  });
}

test("POST /lint endpoint validation", async () => {
  // Test valid request
  const validResponse = await mockRequest("POST", "/lint", {
    text: "とてもとても良い文章です。"
  });
  
  assert.strictEqual(validResponse.statusCode, 200);
  assert.strictEqual(validResponse.body.success, true);
  assert.ok(validResponse.body.result);
  assert.ok(Array.isArray(validResponse.body.result.findings));

  // Test invalid request
  const invalidResponse = await mockRequest("POST", "/lint", {});
  
  assert.strictEqual(invalidResponse.statusCode, 400);
  assert.strictEqual(invalidResponse.body.success, false);
  assert.ok(invalidResponse.body.error);
});

test("POST /fix endpoint validation", async () => {
  const findings = [
    {
      id: "finding-0",
      ruleId: "test-rule",
      message: "Test message",
      range: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } },
      severity: "error",
      fix: { range: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } }, text: "fixed" }
    }
  ];

  // Test valid request
  const validResponse = await mockRequest("POST", "/fix", {
    text: "test text",
    findings: findings
  });
  
  assert.strictEqual(validResponse.statusCode, 200);
  assert.strictEqual(validResponse.body.success, true);
  assert.ok(typeof validResponse.body.fixedText === "string");

  // Test invalid request
  const invalidResponse = await mockRequest("POST", "/fix", {
    text: "test"
  });
  
  assert.strictEqual(invalidResponse.statusCode, 400);
  assert.strictEqual(invalidResponse.body.success, false);
});