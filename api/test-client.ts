// Manual API testing client
async function testAPI() {
  const baseURL = "http://localhost:3000";
  
  console.log("=== Testing API Endpoints ===\n");
  
  // Test health check
  try {
    const healthResponse = await fetch(`${baseURL}/health`);
    const healthData = await healthResponse.json();
    console.log("✅ Health check:", healthData);
  } catch (error) {
    console.log("❌ Health check failed:", error instanceof Error ? error.message : String(error));
  }
  
  // Test lint endpoint
  try {
    const lintResponse = await fetch(`${baseURL}/lint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "とてもとても良い文章です。。でも、これはどうかも知れません。",
        filePath: "test.md"
      })
    });
    
    const lintData = await lintResponse.json();
    console.log("\n✅ Lint endpoint:", {
      success: lintData.success,
      totalIssues: lintData.result?.totalIssues,
      fixableIssues: lintData.result?.fixableIssues,
      sampleFinding: lintData.result?.findings?.[0]?.message
    });
  } catch (error) {
    console.log("❌ Lint endpoint failed:", error instanceof Error ? error.message : String(error));
  }
  
  // Test fix endpoint
  try {
    const fixResponse = await fetch(`${baseURL}/fix`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "テスト文章です。",
        findings: [
          {
            id: "test-finding",
            ruleId: "test-rule",
            message: "Test fix",
            range: { start: { line: 1, column: 1 }, end: { line: 1, column: 3 } },
            severity: "error",
            fix: { 
              range: { start: { line: 1, column: 1 }, end: { line: 1, column: 3 } },
              text: "修正済み" 
            }
          }
        ]
      })
    });
    
    const fixData = await fixResponse.json();
    console.log("\n✅ Fix endpoint:", {
      success: fixData.success,
      appliedFixes: fixData.appliedFixes,
      hasFixedText: !!fixData.fixedText
    });
  } catch (error) {
    console.log("❌ Fix endpoint failed:", error instanceof Error ? error.message : String(error));
  }
  
  console.log("\n=== API Test Complete ===");
}

// Export for use as module
export { testAPI };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAPI().catch(console.error);
}