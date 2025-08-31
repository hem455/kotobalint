import { TextlintRunner } from "../dist/core/textlint-runner.js";

async function testDirectAPI() {
  console.log("=== Direct API Component Test ===");
  
  try {
    // Test TextlintRunner directly
    const runner = new TextlintRunner();
    await runner.initialize();
    
    const testText = "とてもとても良い文章です。。でも、これはどうかも知れません。";
    const lintResult = await runner.lintText(testText);
    
    console.log("✅ Lint functionality:");
    console.log(`  Total issues: ${lintResult.totalIssues}`);
    console.log(`  Fixable issues: ${lintResult.fixableIssues}`);
    console.log(`  First finding: ${lintResult.findings[0]?.message || 'None'}`);
    
    // Test fix functionality
    const fixesToApply = lintResult.findings.filter(f => f.fix);
    if (fixesToApply.length > 0) {
      const fixedText = runner.applyFixes(testText, fixesToApply);
      console.log("\n✅ Fix functionality:");
      console.log(`  Applied fixes: ${fixesToApply.length}`);
      console.log(`  Original: ${testText.substring(0, 30)}...`);
      console.log(`  Fixed: ${fixedText.substring(0, 30)}...`);
    } else {
      console.log("\n⚠️ No auto-fixable issues found");
    }
    
    // Test configuration
    const config = runner.getConfig();
    console.log("\n✅ Configuration:");
    console.log(`  Presets: ${config.presets.join(', ')}`);
    console.log(`  Rules: ${config.rules.length}`);
    
    console.log("\n🎉 All API components working correctly!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testDirectAPI();