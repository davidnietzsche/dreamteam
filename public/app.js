const data = {
  stats: [
    { label: "Memory layers", value: "6" },
    { label: "Captured corpus", value: "29" },
    { label: "Benchmark mode", value: "Live" },
    { label: "Public repo safe", value: "Yes" }
  ],
  memory: [
    {
      title: "Worldview Memory",
      tag: "Mission",
      body:
        "Stores the recurring belief that civilization-scale futures matter more than local optimization.",
      points: [
        "Long-horizon ambition",
        "Future must be materially better",
        "Technology as destiny shaper"
      ]
    },
    {
      title: "Decision Memory",
      tag: "First Principles",
      body:
        "Reduces questions to physics, economics, throughput, and bottleneck math before accepting industry convention.",
      points: [
        "Ask what is actually true",
        "Challenge inherited constraints",
        "Rebuild from fundamentals"
      ]
    },
    {
      title: "Operating Memory",
      tag: "Execution",
      body:
        "Captures the bias toward speed, iteration, compression, and direct intervention when a system is lagging.",
      points: [
        "Prototype fast",
        "Push through layers",
        "Optimize the critical path"
      ]
    },
    {
      title: "Business Memory",
      tag: "Scale",
      body:
        "Frames manufacturing, vertical integration, and cost curves as strategic weapons rather than back-office topics.",
      points: [
        "Factory as product",
        "Control the bottleneck",
        "Use staged expansion"
      ]
    },
    {
      title: "Risk Memory",
      tag: "Tradeoffs",
      body:
        "Tracks the downside of the pattern so the advisor does not become hero mythology.",
      points: [
        "Timeline compression risk",
        "Team fatigue risk",
        "Social and political friction"
      ]
    },
    {
      title: "Voice Memory",
      tag: "Response Style",
      body:
        "Keeps answers direct, compact, unsentimental, and anchored in systems rather than motivational slogans.",
      points: [
        "Name the real problem",
        "Discard fake constraints",
        "State the cost honestly"
      ]
    }
  ],
  training: [
    {
      step: "01 / Source Intake",
      title: "Collect primary materials first",
      body:
        "Use Tesla master plans, Tesla IR biography, TED pages, SpaceX mission pages, and xAI company principles as the base layer."
    },
    {
      step: "02 / Evidence Mapping",
      title: "Convert documents into recurring claims",
      body:
        "Each source is summarized into patterns such as first-principles reasoning, vertical integration, mission framing, speed bias, and manufacturing logic."
    },
    {
      step: "03 / Persona Structuring",
      title: "Separate style from judgment",
      body:
        "The build stores worldview, business philosophy, management behavior, blind spots, and output rules in separate memory layers."
    },
    {
      step: "04 / Public-Safe Packaging",
      title: "Keep GitHub clean",
      body:
        "The repo stores metadata, summaries, prompts, eval rubrics, and source maps, while avoiding full copyrighted books or unsafe transcript dumps."
    },
    {
      step: "05 / Advisor Runtime",
      title: "Answer with a stable frame",
      body:
        "Every response follows the same path: real problem, false constraints, first-principles breakdown, highest-leverage action, and main risk."
    },
    {
      step: "06 / Expansion Path",
      title: "Scale into a founder matrix",
      body:
        "Once this pattern is stable, add Jensen Huang, Lisa Su, and others with the same evidence schema so users can compare operator logic."
    }
  ],
  knowledgeBase: [],
  answerSteps: [
    "Define the real problem instead of accepting the user's framing.",
    "Strip away the constraints that are social habits, not physics or economics.",
    "Identify the single highest-leverage bottleneck in the system.",
    "Recompute the path from first principles.",
    "Recommend an action plan with speed and ownership.",
    "State the execution cost, side effects, and failure risk."
  ],
  demoPrompt:
    "Our robotics startup keeps adding features, but the production line is unstable and unit cost is rising. What would Elon Musk Pixel do first?",
  demoAnswerStyle:
    "It should say the real problem is throughput discipline, not feature shortage; freeze non-critical features, instrument the bottleneck, redesign around manufacturability, and warn that this will frustrate teams who want novelty before stability.",
  repoPublic: [
    "Source registry",
    "Persona specs",
    "Prompt files",
    "Evaluation rubrics",
    "Human-written summaries",
    "Demo interface"
  ],
  repoPrivate: [
    "Licensed books if acquired later",
    "Large transcript stores with unclear rights",
    "Internal chunking experiments",
    "Private ingestion logs",
    "Any materials with unclear reuse terms"
  ]
};

const statsGrid = document.getElementById("stats-grid");
const memoryGrid = document.getElementById("memory-grid");
const timeline = document.getElementById("timeline");
const kbGrid = document.getElementById("kb-grid");
const answerSteps = document.getElementById("answer-steps");
const demoPrompt = document.getElementById("demo-prompt");
const demoAnswerStyle = document.getElementById("demo-answer-style");
const publicList = document.getElementById("public-list");
const privateList = document.getElementById("private-list");
const filters = Array.from(document.querySelectorAll(".filter"));
const readinessScore = document.getElementById("readiness-score");
const readinessBand = document.getElementById("readiness-band");
const readinessNote = document.getElementById("readiness-note");
const readinessGrid = document.getElementById("readiness-grid");

function renderStats() {
  statsGrid.innerHTML = data.stats
    .map(
      (item) => `
        <article class="stat-card">
          <span class="stat-label">${item.label}</span>
          <p class="stat-value">${item.value}</p>
        </article>
      `
    )
    .join("");
}

function renderMemory() {
  memoryGrid.innerHTML = data.memory
    .map(
      (item) => `
        <article class="memory-card">
          <span class="memory-tag">${item.tag}</span>
          <h3>${item.title}</h3>
          <p>${item.body}</p>
          <ul class="memory-points">
            ${item.points.map((point) => `<li>${point}</li>`).join("")}
          </ul>
        </article>
      `
    )
    .join("");
}

function renderTimeline() {
  timeline.innerHTML = data.training
    .map(
      (item) => `
        <article class="timeline-card">
          <div class="timeline-step">${item.step}</div>
          <div>
            <h3>${item.title}</h3>
            <p>${item.body}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderKnowledgeBase(filter) {
  const sources =
    filter === "all"
      ? data.knowledgeBase
      : data.knowledgeBase.filter((item) => item.authority === filter);

  kbGrid.innerHTML = sources
    .map(
      (item) => `
        <article class="kb-card">
          <span class="kb-meta">${item.id} / ${item.authority}</span>
          <h3>${item.title}</h3>
          <p>${item.reason || item.notes || "Captured into the live corpus for downstream enrichment, tagging, and benchmarking."}</p>
          <div>
            <span class="chip">${item.category || item.surface_id || "corpus"}</span>
            <span class="chip">${item.type || item.source_type || "page"}</span>
            <span class="chip">${item.publishedAt || item.published_at || "unknown"}</span>
          </div>
          ${item.url ? `<p><a href="${item.url}" target="_blank" rel="noreferrer">Open source</a></p>` : ""}
        </article>
      `
    )
    .join("");
}

function renderAnswerLogic() {
  answerSteps.innerHTML = data.answerSteps
    .map((item) => `<li>${item}</li>`)
    .join("");
  demoPrompt.textContent = data.demoPrompt;
  demoAnswerStyle.textContent = data.demoAnswerStyle;
}

function renderRepoLists() {
  publicList.innerHTML = data.repoPublic.map((item) => `<li>${item}</li>`).join("");
  privateList.innerHTML = data.repoPrivate.map((item) => `<li>${item}</li>`).join("");
}

function renderReadiness(scorecard) {
  readinessScore.textContent = `${scorecard.readiness_score_percent}%`;
  readinessBand.textContent = `Band: ${scorecard.readiness_band}`;
  readinessNote.textContent = (scorecard.notes && scorecard.notes[0]) || "";

  const components = scorecard.components || {};
  readinessGrid.innerHTML = Object.entries(components)
    .map(([key, value]) => {
      const display = value.score !== undefined ? `${value.score}%` : "--";
      const label = key.replace(/_/g, " ");
      return `
        <article class="readiness-item">
          <p class="value">${display}</p>
          <p class="label">${label}</p>
        </article>
      `;
    })
    .join("");
}

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderKnowledgeBase(button.dataset.filter);
  });
});

renderStats();
renderMemory();
renderTimeline();
renderAnswerLogic();
renderRepoLists();

async function hydrateCorpus() {
  try {
    const [summaryResponse, corpusResponse] = await Promise.all([
      fetch("/data/corpus/elon-musk/summary.json"),
      fetch("/data/corpus/elon-musk/corpus.json")
    ]);

    if (!summaryResponse.ok || !corpusResponse.ok) {
      throw new Error("Corpus files not ready");
    }

    const summary = await summaryResponse.json();
    const corpus = await corpusResponse.json();

    data.stats = [
      { label: "Memory layers", value: "6" },
      { label: "Captured corpus", value: String(summary.total_records) },
      { label: "Primary records", value: String(summary.by_authority.primary || 0) },
      { label: "Source surfaces", value: String(Object.keys(summary.by_domain_group || {}).length) }
    ];

    data.knowledgeBase = corpus;
    renderStats();
    renderKnowledgeBase("all");
  } catch (error) {
    data.knowledgeBase = [];
    kbGrid.innerHTML = `
      <article class="kb-card">
        <span class="kb-meta">corpus / pending</span>
        <h3>Corpus not loaded yet</h3>
        <p>Run the ingestion pipeline to populate the live knowledge base. The page shell is ready for it.</p>
      </article>
    `;
  }
}

hydrateCorpus();

async function hydrateReadiness() {
  try {
    const response = await fetch("/data/evals/elon-musk/readiness-scorecard.json");
    if (!response.ok) {
      throw new Error("Readiness score unavailable");
    }
    const scorecard = await response.json();
    renderReadiness(scorecard);
  } catch (error) {
    readinessScore.textContent = "--";
    readinessBand.textContent = "Band: unavailable";
    readinessNote.textContent = "Run scripts/build_readiness_scorecard.py to generate a readiness score.";
  }
}

hydrateReadiness();
