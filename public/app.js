const chipCorpus = document.getElementById("chip-corpus");
const chipSocial = document.getElementById("chip-social");
const chipReadiness = document.getElementById("chip-readiness");
const brainMap = document.getElementById("brain-map");
const knowledgePulse = document.getElementById("knowledge-pulse");
const readinessLine = document.getElementById("readiness-line");
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const connectForm = document.getElementById("connect-form");
const connectStatus = document.getElementById("connect-status");
const uploadFinanceBtn = document.getElementById("upload-finance-btn");
const financeFileInput = document.getElementById("finance-file");
const generateTodosBtn = document.getElementById("generate-todos-btn");
const downloadReportBtn = document.getElementById("download-report-btn");
const todoBox = document.getElementById("todo-box");

let lastAnswer = "";
let lastQuestion = "";

const wiring = [
  {
    level: "Level 1",
    title: "Civilization Mission",
    note: "Build for species-scale impact, not local optimization."
  },
  {
    level: "Level 2",
    title: "First Principles",
    note: "Break problems into physics, cost, throughput, and constraints."
  },
  {
    level: "Level 3",
    title: "Ideology",
    note: "Technology progress, execution intensity, anti-bureaucracy."
  },
  {
    level: "Level 4",
    title: "Operating Pattern",
    note: "Find bottleneck, assign owner, compress timeline, iterate fast."
  },
  {
    level: "Level 5",
    title: "Experience Memory",
    note: "Factories, launches, scale crises, public pressure, capital cycles."
  },
  {
    level: "Level 6",
    title: "Risk Lens",
    note: "High-upside bets with explicit downside and survivability checks."
  }
];

function renderWiring() {
  brainMap.innerHTML = wiring
    .map(
      (item) => `
        <article class="wiring-node">
          <p class="wiring-level">${item.level}</p>
          <p class="wiring-title">${item.title}</p>
          <p class="wiring-note">${item.note}</p>
        </article>
      `
    )
    .join("");
}

function appendChat(role, text, sources) {
  const card = document.createElement("article");
  card.className = `chat-msg ${role}`;

  const roleNode = document.createElement("p");
  roleNode.className = "chat-role";
  roleNode.textContent = role === "user" ? "You" : "Elon Pixel";

  const bodyNode = document.createElement("p");
  bodyNode.textContent = text;

  card.appendChild(roleNode);
  card.appendChild(bodyNode);

  if (Array.isArray(sources) && sources.length > 0) {
    const sourceNode = document.createElement("p");
    sourceNode.className = "chat-sources";
    sourceNode.innerHTML = sources
      .slice(0, 3)
      .map((url, idx) => `<a href="${url}" target="_blank" rel="noreferrer">Source ${idx + 1}</a>`)
      .join(" · ");
    card.appendChild(sourceNode);
  }

  chatLog.appendChild(card);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function hydrateStats() {
  try {
    const [summaryResponse, readinessResponse] = await Promise.all([
      fetch("/data/corpus/elon-musk/summary.json"),
      fetch("/data/evals/elon-musk/readiness-scorecard.json")
    ]);

    if (!summaryResponse.ok || !readinessResponse.ok) {
      throw new Error("Missing stats");
    }

    const summary = await summaryResponse.json();
    const readiness = await readinessResponse.json();

    chipCorpus.textContent = `Corpus: ${summary.total_records.toLocaleString()}`;
    chipSocial.textContent = `X posts: ${(summary.by_domain_group["x.com"] || 0).toLocaleString()}`;
    chipReadiness.textContent = `Readiness: ${readiness.readiness_score_percent}%`;

    const topDomains = Object.entries(summary.by_domain_group || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    knowledgePulse.innerHTML = topDomains
      .map(([domain, count]) => `<li>${domain}: ${count.toLocaleString()}</li>`)
      .join("");

    const longForm = readiness.components?.long_form_reasoning_balance?.score ?? "--";
    readinessLine.textContent = `${readiness.readiness_score_percent}% (${readiness.readiness_band}) · Long-form balance ${longForm}%`;
  } catch (error) {
    chipCorpus.textContent = "Corpus: unavailable";
    chipSocial.textContent = "X posts: unavailable";
    chipReadiness.textContent = "Readiness: unavailable";
    readinessLine.textContent = "Run ingestion and readiness scripts to populate live stats.";
  }
}

async function hydrateCompanyContext() {
  try {
    const response = await fetch("/api/company-context");
    if (!response.ok) {
      throw new Error("Context unavailable");
    }
    const ctx = await response.json();
    if (ctx.connected) {
      connectStatus.textContent = `Status: connected (${ctx.company_name || "company"})`;
    } else {
      connectStatus.textContent = "Status: not connected";
    }
  } catch (error) {
    connectStatus.textContent = "Status: unable to load context";
  }
}

connectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    companyName: document.getElementById("company-name").value.trim(),
    notionUrl: document.getElementById("notion-url").value.trim(),
    websiteUrl: document.getElementById("website-url").value.trim(),
    folderPath: document.getElementById("folder-path").value.trim(),
    notes: document.getElementById("company-notes").value.trim()
  };

  connectStatus.textContent = "Status: connecting...";
  try {
    const response = await fetch("/api/connect-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Connect failed");
    }
    connectStatus.textContent = `Status: connected (${data.context.company_name || "company"})`;
    appendChat("assistant", "Business context connected. Now I can make company-specific judgments.");
  } catch (error) {
    connectStatus.textContent = `Status: ${error.message}`;
  }
});

uploadFinanceBtn.addEventListener("click", async () => {
  const file = financeFileInput.files?.[0];
  if (!file) {
    connectStatus.textContent = "Status: choose a finance file first";
    return;
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const contentBase64 = btoa(binary);

  connectStatus.textContent = "Status: uploading finance...";
  try {
    const response = await fetch("/api/upload-finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentBase64 })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Upload failed");
    }
    connectStatus.textContent = `Status: finance uploaded (${data.filename})`;
  } catch (error) {
    connectStatus.textContent = `Status: ${error.message}`;
  }
});

generateTodosBtn.addEventListener("click", async () => {
  todoBox.textContent = "Generating to-do...";
  try {
    const response = await fetch("/api/generate-todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: lastQuestion || "General operating optimization" })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "To-do generation failed");
    }
    todoBox.textContent = data.todos
      .map((item, idx) => `${idx + 1}. [${item.priority}] ${item.task}\n   Owner: ${item.owner} | Due: ${item.due_in_days}d\n   Why: ${item.why}`)
      .join("\n\n");
  } catch (error) {
    todoBox.textContent = `Error: ${error.message}`;
  }
});

downloadReportBtn.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/download-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: lastQuestion, advice: lastAnswer })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Report generation failed");
    }

    const blob = new Blob([data.content], { type: "text/markdown;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = data.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    connectStatus.textContent = `Status: report downloaded (${data.filename})`;
  } catch (error) {
    connectStatus.textContent = `Status: ${error.message}`;
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) {
    return;
  }

  appendChat("user", message);
  chatInput.value = "";
  chatInput.disabled = true;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Chat request failed");
    }

    lastQuestion = message;
    lastAnswer = payload.answer;

    const readinessSuffix =
      payload.readiness_score_percent !== undefined
        ? `\n\nReadiness score: ${payload.readiness_score_percent}%`
        : "";
    appendChat("assistant", `${payload.answer}${readinessSuffix}`, payload.sources || []);
  } catch (error) {
    appendChat("assistant", `Chat is temporarily unavailable: ${error.message}`);
  } finally {
    chatInput.disabled = false;
    chatInput.focus();
  }
});

renderWiring();
hydrateStats();
hydrateCompanyContext();
