const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = 9999;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const CORPUS_PATH = path.join(DATA_DIR, "corpus", "elon-musk", "corpus.json");
const READINESS_PATH = path.join(DATA_DIR, "evals", "elon-musk", "readiness-scorecard.json");
const COMPANY_DIR = path.join(DATA_DIR, "company");
const COMPANY_CONTEXT_PATH = path.join(COMPANY_DIR, "context.json");
const COMPANY_UPLOADS_DIR = path.join(COMPANY_DIR, "uploads");
const REPORTS_DIR = path.join(DATA_DIR, "reports");

let chatHistory = [];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function sendFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeNowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function readJson(pathname) {
  try {
    return JSON.parse(fs.readFileSync(pathname, "utf8"));
  } catch (error) {
    return null;
  }
}

function writeJson(pathname, payload) {
  fs.writeFileSync(pathname, JSON.stringify(payload, null, 2), "utf8");
}

function getCorpus() {
  const corpus = readJson(CORPUS_PATH);
  return Array.isArray(corpus) ? corpus : [];
}

function getReadiness() {
  return readJson(READINESS_PATH) || {};
}

function defaultCompanyContext() {
  return {
    connected: false,
    company_name: "",
    notion_url: "",
    website_url: "",
    website_summary: "",
    folder_path: "",
    folder_snapshot: [],
    finance_files: [],
    notes: "",
    updated_at: ""
  };
}

function getCompanyContext() {
  const ctx = readJson(COMPANY_CONTEXT_PATH);
  return ctx && typeof ctx === "object" ? ctx : defaultCompanyContext();
}

function saveCompanyContext(next) {
  ensureDir(COMPANY_DIR);
  writeJson(COMPANY_CONTEXT_PATH, next);
}

function jsonResponse(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache"
  });
  res.end(JSON.stringify(payload));
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function stripHtmlTags(text) {
  return String(text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWebsiteSummary(websiteUrl) {
  if (!websiteUrl) {
    return "";
  }
  try {
    const response = await fetch(websiteUrl, { redirect: "follow" });
    if (!response.ok) {
      return `Unable to fetch website: ${response.status}`;
    }
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const title = titleMatch ? stripHtmlTags(titleMatch[1]).slice(0, 120) : "";
    const meta = metaMatch ? stripHtmlTags(metaMatch[1]).slice(0, 240) : "";
    const body = stripHtmlTags(html).slice(0, 280);
    return [title, meta, body].filter(Boolean).join(" | ").slice(0, 520);
  } catch (error) {
    return `Unable to fetch website: ${error.message}`;
  }
}

function listFolderSnapshot(rootFolder, maxItems = 80) {
  if (!rootFolder) {
    return [];
  }
  const resolved = path.resolve(rootFolder);
  if (!fs.existsSync(resolved)) {
    return [{ type: "error", path: resolved, note: "Folder not found" }];
  }

  const out = [];
  function walk(current, depth) {
    if (out.length >= maxItems || depth > 3) {
      return;
    }
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      out.push({ type: "error", path: current, note: error.message });
      return;
    }
    for (const entry of entries) {
      if (out.length >= maxItems) {
        break;
      }
      const full = path.join(current, entry.name);
      const relative = path.relative(resolved, full) || entry.name;
      if (entry.isDirectory()) {
        out.push({ type: "dir", path: relative });
        walk(full, depth + 1);
      } else {
        out.push({ type: "file", path: relative });
      }
    }
  }
  walk(resolved, 0);
  return out;
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreRow(row, terms) {
  const hay = normalize(`${row.title || ""} ${row.notes || ""} ${row.url || ""} ${(row.tags || []).join(" ")}`);
  let score = 0;
  for (const term of terms) {
    if (term.length < 3) {
      continue;
    }
    if (hay.includes(term)) {
      score += term.length > 5 ? 2 : 1;
    }
  }
  return score;
}

function hasCompanyContext(context) {
  return Boolean(
    context.connected &&
      (context.notion_url ||
        context.website_url ||
        context.folder_path ||
        (Array.isArray(context.finance_files) && context.finance_files.length > 0))
  );
}

function topContextSignals(context) {
  const signals = [];
  if (context.company_name) {
    signals.push(`Company: ${context.company_name}`);
  }
  if (context.website_url) {
    signals.push(`Website: ${context.website_url}`);
  }
  if (context.notion_url) {
    signals.push("Notion connected");
  }
  if (context.folder_path) {
    signals.push(`Folder connected (${(context.folder_snapshot || []).length} indexed items)`);
  }
  if ((context.finance_files || []).length > 0) {
    signals.push(`Finance files: ${context.finance_files.length}`);
  }
  return signals;
}

function buildAdvice(question, corpus, readiness, context) {
  if (!hasCompanyContext(context)) {
    return {
      answer:
        "Connect your business first. Add at least one source: Notion, Website, Company Folder, or Finance file. Then I can do company-specific judgment.",
      sources: [],
      readiness_score_percent: Number(readiness.readiness_score_percent || 0),
      requires_context: true
    };
  }

  const normalized = normalize(question);
  const terms = normalized.split(" ").filter(Boolean);
  const scored = corpus
    .map((row) => ({ row, score: scoreRow(row, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const defaultSources = corpus.slice(0, 4).map((row) => row.url).filter(Boolean);
  const sourceUrls = scored.length > 0 ? scored.map((item) => item.row.url).filter(Boolean) : defaultSources;
  const readinessScore = Number(readiness.readiness_score_percent || 0);
  const contextSignals = topContextSignals(context);

  const focusLine =
    normalized.includes("hire") || normalized.includes("consult")
      ? "Use this advisor as an Elon-style strategist, not as a legal or identity substitute."
      : "Start from the bottleneck, remove fake constraints, then execute with clear ownership.";

  const cautionLine =
    readinessScore < 55
      ? "Current readiness is limited by low long-form reasoning balance, so validate critical decisions with humans."
      : "Readiness is improving, but still validate high-stakes decisions with domain experts.";

  return {
    answer: [
      `Context used: ${contextSignals.join(" | ") || "baseline company context"}.`,
      "Real problem: your decision quality depends on constraint clarity, not inspiration.",
      "False constraints: consensus comfort and feature creep usually hide the true bottleneck.",
      `First-principles move: ${focusLine}`,
      "Highest-leverage action: define one owner, one bottleneck metric, and one 14-day execution sprint.",
      `Main risk: ${cautionLine}`
    ].join("\n\n"),
    sources: sourceUrls.slice(0, 4),
    readiness_score_percent: readinessScore
  };
}

function parseFinancePreview(text) {
  const lines = String(text || "").split(/\r?\n/).filter(Boolean);
  const preview = lines.slice(0, 6).join("\n").slice(0, 1200);
  return preview;
}

function generateTodos(context, question) {
  const scope = question || "Improve company execution with Elon-style bottleneck logic";
  const filesCount = (context.folder_snapshot || []).filter((x) => x.type === "file").length;
  const financeCount = (context.finance_files || []).length;
  return [
    {
      priority: "P0",
      owner: "CEO",
      task: "Define one critical bottleneck metric and 14-day target.",
      why: `Current scope: ${scope}`,
      due_in_days: 1
    },
    {
      priority: "P0",
      owner: "COO/Ops",
      task: "Run daily bottleneck review and kill low-leverage work.",
      why: "Execution speed beats broad parallelism in constrained systems.",
      due_in_days: 2
    },
    {
      priority: "P1",
      owner: "Finance Lead",
      task: "Map margin leak points and propose top 3 cost-down interventions.",
      why: `Finance docs connected: ${financeCount}.`,
      due_in_days: 3
    },
    {
      priority: "P1",
      owner: "Product Lead",
      task: "Freeze non-critical features until reliability baseline is stable.",
      why: "Feature creep usually hides root execution constraints.",
      due_in_days: 3
    },
    {
      priority: "P2",
      owner: "Chief of Staff",
      task: "Summarize folder intelligence into one-page decision brief.",
      why: `Indexed company files: ${filesCount}.`,
      due_in_days: 5
    }
  ];
}

function buildReportMarkdown(context, question, advice, todos) {
  return [
    `# Elon Pixel Consultant Report`,
    ``,
    `Generated at: ${new Date().toISOString()}`,
    ``,
    `## Company Context`,
    `- Company: ${context.company_name || "N/A"}`,
    `- Website: ${context.website_url || "N/A"}`,
    `- Notion: ${context.notion_url || "N/A"}`,
    `- Folder: ${context.folder_path || "N/A"}`,
    `- Finance files: ${(context.finance_files || []).length}`,
    ``,
    `## Question`,
    question || "N/A",
    ``,
    `## Consultant Judgment`,
    advice || "N/A",
    ``,
    `## To-Do List`,
    ...todos.map((t, idx) => `${idx + 1}. [${t.priority}] ${t.task} (Owner: ${t.owner}, Due: ${t.due_in_days}d)`),
    ``,
    `## Notes`,
    `- This report is an AI advisory output, not legal or financial advice.`,
    `- Validate high-stakes decisions with domain experts.`
  ].join("\n");
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/company-context") {
    jsonResponse(res, 200, getCompanyContext());
    return;
  }

  if (req.method === "POST" && req.url === "/api/connect-business") {
    collectRequestBody(req)
      .then(async (raw) => {
        const body = raw ? JSON.parse(raw) : {};
        const previous = getCompanyContext();
        const next = {
          ...previous,
          connected: true,
          company_name: String(body.companyName || "").trim(),
          notion_url: String(body.notionUrl || "").trim(),
          website_url: String(body.websiteUrl || "").trim(),
          folder_path: String(body.folderPath || "").trim(),
          notes: String(body.notes || "").trim(),
          updated_at: new Date().toISOString()
        };

        next.website_summary = await fetchWebsiteSummary(next.website_url);
        next.folder_snapshot = listFolderSnapshot(next.folder_path);
        next.finance_files = Array.isArray(previous.finance_files) ? previous.finance_files : [];

        saveCompanyContext(next);
        jsonResponse(res, 200, { ok: true, context: next });
      })
      .catch((error) => jsonResponse(res, 500, { error: error.message || "Connect failed" }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/upload-finance") {
    collectRequestBody(req)
      .then((raw) => {
        const body = raw ? JSON.parse(raw) : {};
        const filename = String(body.filename || `finance-${safeNowStamp()}.txt`).replace(/[^\w.\-]/g, "_");
        const contentBase64 = String(body.contentBase64 || "");
        if (!contentBase64) {
          jsonResponse(res, 400, { error: "Missing contentBase64" });
          return;
        }

        ensureDir(COMPANY_UPLOADS_DIR);
        const filePath = path.join(COMPANY_UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, Buffer.from(contentBase64, "base64"));

        const textPreview = parseFinancePreview(Buffer.from(contentBase64, "base64").toString("utf8"));
        const context = getCompanyContext();
        context.connected = true;
        context.finance_files = Array.isArray(context.finance_files) ? context.finance_files : [];
        context.finance_files.push({
          filename,
          stored_path: filePath,
          uploaded_at: new Date().toISOString(),
          preview: textPreview
        });
        context.updated_at = new Date().toISOString();
        saveCompanyContext(context);

        jsonResponse(res, 200, { ok: true, filename, preview: textPreview });
      })
      .catch((error) => jsonResponse(res, 500, { error: error.message || "Upload failed" }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/generate-todos") {
    collectRequestBody(req)
      .then((raw) => {
        const body = raw ? JSON.parse(raw) : {};
        const context = getCompanyContext();
        if (!hasCompanyContext(context)) {
          jsonResponse(res, 400, { error: "Connect your business first." });
          return;
        }
        const todos = generateTodos(context, String(body.question || "").trim());
        jsonResponse(res, 200, { ok: true, todos });
      })
      .catch((error) => jsonResponse(res, 500, { error: error.message || "To-do generation failed" }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/download-report") {
    collectRequestBody(req)
      .then((raw) => {
        const body = raw ? JSON.parse(raw) : {};
        const context = getCompanyContext();
        if (!hasCompanyContext(context)) {
          jsonResponse(res, 400, { error: "Connect your business first." });
          return;
        }
        const question = String(body.question || (chatHistory[chatHistory.length - 1]?.question || "")).trim();
        const advice = String(body.advice || (chatHistory[chatHistory.length - 1]?.answer || "")).trim();
        const todos = generateTodos(context, question);
        const markdown = buildReportMarkdown(context, question, advice, todos);

        ensureDir(REPORTS_DIR);
        const filename = `elon-pixel-report-${safeNowStamp()}.md`;
        const stored = path.join(REPORTS_DIR, filename);
        fs.writeFileSync(stored, markdown, "utf8");

        jsonResponse(res, 200, {
          ok: true,
          filename,
          download_url: `/data/reports/${filename}`,
          content: markdown
        });
      })
      .catch((error) => jsonResponse(res, 500, { error: error.message || "Report generation failed" }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    collectRequestBody(req)
      .then((raw) => {
        const body = raw ? JSON.parse(raw) : {};
        const question = String(body.message || "").trim();
        if (!question) {
          jsonResponse(res, 400, { error: "Missing message" });
          return;
        }

        const corpus = getCorpus();
        const readiness = getReadiness();
        const context = getCompanyContext();
        const payload = buildAdvice(question, corpus, readiness, context);
        chatHistory.push({ question, answer: payload.answer, created_at: new Date().toISOString() });
        if (chatHistory.length > 60) {
          chatHistory = chatHistory.slice(-60);
        }
        jsonResponse(res, 200, payload);
      })
      .catch((error) => {
        jsonResponse(res, 500, { error: error.message || "Chat processing failed" });
      });
    return;
  }

  const cleanUrl = (req.url || "/").split("?")[0];
  const requestedPath = cleanUrl === "/" ? "/index.html" : cleanUrl;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");

  const baseDir = safePath.startsWith("/data/") ? DATA_DIR : PUBLIC_DIR;
  const relativePath = safePath.startsWith("/data/") ? safePath.replace(/^\/data/, "") : safePath;
  const filePath = path.join(baseDir, relativePath);

  if (!filePath.startsWith(baseDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      sendFile(path.join(filePath, "index.html"), res);
      return;
    }

    sendFile(filePath, res);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Elon Musk Pixel running at http://127.0.0.1:${PORT}`);
});
