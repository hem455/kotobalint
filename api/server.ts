import express from "express";
import cors from "cors";
import { TextlintRunner } from "../core/textlint-runner.js";
import type { FindingResult, LintResult } from "../core/types.js";

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.text({ limit: "10mb" }));

// Global textlint runner instance
let runner: TextlintRunner;

// Initialize textlint runner
async function initializeRunner() {
  runner = new TextlintRunner();
  await runner.initialize();
  console.log("TextlintRunner initialized");
}

// Request/Response interfaces
interface LintRequest {
  text: string;
  filePath?: string;
}

interface FixRequest {
  text: string;
  findingIds: string[];
  findings: FindingResult[];
}

interface LintResponse {
  success: boolean;
  result?: LintResult;
  error?: string;
}

interface FixResponse {
  success: boolean;
  fixedText?: string;
  appliedFixes?: number;
  error?: string;
}

// Routes
app.post("/lint", async (req, res) => {
  try {
    const { text, filePath }: LintRequest = req.body;
    
    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid request: 'text' field is required and must be a string"
      } as LintResponse);
    }

    const result = await runner.lintText(text, filePath);
    
    res.json({
      success: true,
      result
    } as LintResponse);
  } catch (error) {
    console.error("Lint error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    } as LintResponse);
  }
});

app.post("/fix", async (req, res) => {
  try {
    const { text, findingIds, findings }: FixRequest = req.body;
    
    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid request: 'text' field is required and must be a string"
      } as FixResponse);
    }

    // If no findings provided, attempt automatic fix using textlint
    if (!Array.isArray(findings) || findings.length === 0) {
      const auto = await runner.fixTextAuto(text, req.body?.filePath);
      return res.json({ success: true, fixedText: auto.fixedText, appliedFixes: auto.applied } as FixResponse);
    }

    // Filter findings by IDs if provided
    let fixesToApply = findings;
    if (findingIds && Array.isArray(findingIds)) {
      fixesToApply = findings.filter(f => findingIds.includes(f.id));
    }

    const fixedText = runner.applyFixes(text, fixesToApply);
    res.json({ success: true, fixedText, appliedFixes: fixesToApply.filter(f => f.fix).length } as FixResponse);
  } catch (error) {
    console.error("Fix error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    } as FixResponse);
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "kousei-api",
    timestamp: new Date().toISOString()
  });
});

// Rule configuration endpoints
app.get("/rules", (req, res) => {
  try {
    const config = runner.getConfig();
    res.json({
      success: true,
      rules: config.rules,
      presets: config.presets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.put("/rules", async (req, res) => {
  try {
    const { rules, presets } = req.body;
    await runner.updateConfig({ rules, presets });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Start server
async function startServer() {
  try {
    await initializeRunner();
    
    app.listen(port, () => {
      console.log(`Kousei API server running on http://localhost:${port}`);
      console.log("Available endpoints:");
      console.log("  POST /lint - Lint text and get findings");
      console.log("  POST /fix - Apply fixes to text");
      console.log("  GET /health - Health check");
      console.log("  GET /rules - Get rule configuration");
      console.log("  PUT /rules - Update rule configuration");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  process.exit(0);
});

export { app, startServer };

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
