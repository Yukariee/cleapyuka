// ═══════════════════════════════════════════
//  LOCK SCREEN
// ═══════════════════════════════════════════
const LOCK_PASSWORD = "cleap";

function checkPassword() {
  const input = document.getElementById("lockInput");
  const error = document.getElementById("lockError");
  if (input.value === LOCK_PASSWORD) {
    document.getElementById("lockScreen").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    error.textContent = "";
  } else {
    error.textContent = "Incorrect password.";
    input.value = "";
    input.focus();
  }
}

document.getElementById("lockInput").addEventListener("keydown", e => {
  if (e.key === "Enter") checkPassword();
});

// ═══════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════
// To add a new tool in the future:
// 1. Add its id string to TOOLS array below
// 2. Add a tool-card in index.html pointing to openTool('yourToolId')
// 3. Add a <div id="toolYourtoolid" class="tool-view hidden"> section in index.html
// 4. Add its logic in script.js
const TOOLS = ["transcriber", "highlight"];

function openTool(id) {
  document.getElementById("homeView").classList.add("hidden");
  TOOLS.forEach(t => document.getElementById(`tool${cap(t)}`).classList.add("hidden"));
  document.getElementById(`tool${cap(id)}`).classList.remove("hidden");
  document.getElementById("backBtn").classList.remove("hidden");
}

function goHome() {
  document.getElementById("homeView").classList.remove("hidden");
  TOOLS.forEach(t => document.getElementById(`tool${cap(t)}`).classList.add("hidden"));
  document.getElementById("backBtn").classList.add("hidden");
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ═══════════════════════════════════════════
//  TRANSCRIBER
// ═══════════════════════════════════════════
let segments = [];
let matchIndices = [];
let currentMatch = -1;
let selectedFile = null;

function handleFile(file) {
  if (!file) return;
  selectedFile = file;
  document.getElementById("dropLabel").textContent = `✓ ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)`;
  document.getElementById("dropZone").classList.add("has-file");
  checkReady();
}

function checkReady() {
  const key = document.getElementById("apiKey").value.trim();
  document.getElementById("transcribeBtn").disabled = !(key && selectedFile);
}

document.getElementById("apiKey").addEventListener("input", checkReady);

const dropZone = document.getElementById("dropZone");
dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

async function startTranscribe() {
  const apiKey = document.getElementById("apiKey").value.trim();
  if (!apiKey || !selectedFile) return;

  const btn = document.getElementById("transcribeBtn");
  const status = document.getElementById("status");

  btn.disabled = true;
  document.getElementById("searchSection").classList.remove("visible");
  document.getElementById("transcriptSection").classList.remove("visible");
  document.getElementById("searchInput").value = "";

  status.className = "status";
  status.textContent = "Uploading to Groq Whisper...";

  try {
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("model", "whisper-large-v3");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "segment");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      status.className = "status error";
      status.textContent = "Error: " + (data.error?.message || "Unknown error");
      btn.disabled = false;
      return;
    }

    segments = (data.segments || []).map(seg => ({
      start: Math.round(seg.start * 10) / 10,
      end: Math.round(seg.end * 10) / 10,
      text: seg.text.trim(),
    }));

    renderTranscript();
    document.getElementById("langLabel").textContent = data.language ? `lang: ${data.language}` : "";
    document.getElementById("searchSection").classList.add("visible");
    document.getElementById("transcriptSection").classList.add("visible");
    status.className = "status";
    status.textContent = `✓ ${segments.length} segments transcribed`;

  } catch (e) {
    status.className = "status error";
    status.textContent = "Error: " + e.message;
  }

  btn.disabled = false;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 10);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${ms}`;
}

function renderTranscript(query = "") {
  const body = document.getElementById("transcriptBody");
  matchIndices = [];
  currentMatch = -1;

  body.innerHTML = segments.map((seg, i) => {
    let text = seg.text;
    let isMatch = false;
    if (query) {
      const re = new RegExp(`(${escapeRe(query)})`, "gi");
      if (re.test(text)) {
        isMatch = true;
        matchIndices.push(i);
        text = text.replace(re, "<mark>$1</mark>");
      }
    }
    return `<div class="segment ${isMatch ? 'highlighted' : ''}" id="seg-${i}">
      <span class="ts">${formatTime(seg.start)}</span>
      <span class="words">${text}</span>
    </div>`;
  }).join("");

  updateMatchNav();
}

function handleSearch() {
  const q = document.getElementById("searchInput").value.trim();
  renderTranscript(q);
  if (matchIndices.length > 0) { currentMatch = 0; scrollToMatch(); }
}

function navigateMatch(dir) {
  if (!matchIndices.length) return;
  currentMatch = (currentMatch + dir + matchIndices.length) % matchIndices.length;
  scrollToMatch();
}

function scrollToMatch() {
  const el = document.getElementById(`seg-${matchIndices[currentMatch]}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  updateMatchNav();
}

function updateMatchNav() {
  const count = matchIndices.length;
  const mc = document.getElementById("matchCount");
  const info = document.getElementById("searchInfo");
  const prev = document.getElementById("prevBtn");
  const next = document.getElementById("nextBtn");

  if (count === 0) {
    mc.textContent = document.getElementById("searchInput").value ? "0 matches" : "";
    info.textContent = "";
    prev.disabled = true;
    next.disabled = true;
  } else {
    mc.textContent = `${currentMatch + 1} / ${count} match${count > 1 ? 'es' : ''}`;
    const seg = segments[matchIndices[currentMatch]];
    info.textContent = seg ? `→ timestamp: ${formatTime(seg.start)}` : "";
    prev.disabled = false;
    next.disabled = false;
  }
}

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

document.getElementById("searchInput").addEventListener("keydown", e => {
  if (e.key === "Enter") navigateMatch(1);
});

// ═══════════════════════════════════════════
//  HIGHLIGHT FINDER
// ═══════════════════════════════════════════

// --- Tab switching ---
let hlMode = "file"; // "file" | "yt"
let hlSelectedFile = null;

function switchTab(mode) {
  hlMode = mode;
  document.getElementById("tabFile").classList.toggle("active", mode === "file");
  document.getElementById("tabYt").classList.toggle("active", mode === "yt");
  document.getElementById("hlFileSource").classList.toggle("hidden", mode !== "file");
  document.getElementById("hlYtSource").classList.toggle("hidden", mode !== "yt");
  checkHlReady();
}

function handleHlFile(file) {
  if (!file) return;
  hlSelectedFile = file;
  document.getElementById("hlDropLabel").textContent = `✓ ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)`;
  document.getElementById("hlDropZone").classList.add("has-file");
  checkHlReady();
}

// Drag-and-drop for highlight file zone
const hlDropZone = document.getElementById("hlDropZone");
hlDropZone.addEventListener("dragover", e => { e.preventDefault(); hlDropZone.classList.add("dragover"); });
hlDropZone.addEventListener("dragleave", () => hlDropZone.classList.remove("dragover"));
hlDropZone.addEventListener("drop", e => {
  e.preventDefault();
  hlDropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) handleHlFile(file);
});

function checkHlReady() {
  const groqKey = document.getElementById("hlApiKey").value.trim();
  let sourceReady = false;
  if (hlMode === "file") {
    sourceReady = !!hlSelectedFile;
  } else {
    const url = document.getElementById("ytUrl").value.trim();
    sourceReady = url.includes("youtube.com") || url.includes("youtu.be");
  }
  document.getElementById("hlBtn").disabled = !(groqKey && sourceReady);
}

document.getElementById("hlApiKey").addEventListener("input", checkHlReady);
document.getElementById("ytUrl").addEventListener("input", checkHlReady);

// --- Step state helpers ---
function setStep(stepNum, state) {
  const el = document.getElementById(`hlStep${stepNum}`);
  el.className = "hl-step" + (state ? ` ${state}` : "");
}

// --- Main highlight flow ---
async function startHighlight() {
  const groqKey = document.getElementById("hlApiKey").value.trim();
  const maxH = parseInt(document.getElementById("maxHighlights").value);
  const clipLen = document.getElementById("clipLength").value;
  const ytUrl = hlMode === "yt" ? document.getElementById("ytUrl").value.trim() : null;

  const btn = document.getElementById("hlBtn");
  const status = document.getElementById("hlStatus");
  const progress = document.getElementById("hlProgress");
  const results = document.getElementById("hlResults");

  btn.disabled = true;
  results.classList.add("hidden");
  results.innerHTML = "";
  progress.classList.remove("hidden");
  [1,2,3].forEach(n => setStep(n, ""));

  status.className = "status";

  // ── STEP 1: Get audio blob ──────────────────
  let audioBlob = null;

  if (hlMode === "file") {
    // Direct file upload
    document.getElementById("hlStep1Label").textContent = "Reading audio file...";
    setStep(1, "active");
    status.textContent = "Step 1: Reading file...";
    audioBlob = hlSelectedFile;
    setStep(1, "done");

  } else {
    // YouTube → cobalt.tools → audio blob
    document.getElementById("hlStep1Label").textContent = "Fetching audio from YouTube...";
    setStep(1, "active");
    status.textContent = "Step 1: Fetching audio from YouTube...";

    try {
      // cobalt.tools API — free, no key required
      const cobaltRes = await fetch("https://api.cobalt.tools/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          url: ytUrl,
          downloadMode: "audio",
          audioFormat: "mp3",
          audioBitrate: "64"
        })
      });

      if (!cobaltRes.ok) {
        const errText = await cobaltRes.text();
        throw new Error(`Audio fetch failed (${cobaltRes.status}). The video may be private, age-restricted, or too long. Details: ${errText}`);
      }

      const cobaltData = await cobaltRes.json();

      if (cobaltData.status === "error") {
        throw new Error(cobaltData.error?.code || "Cobalt API error — video may be unavailable.");
      }

      const audioUrl = cobaltData.url || (cobaltData.tunnel && cobaltData.tunnel[0]);
      if (!audioUrl) throw new Error("No audio URL returned from cobalt. Try a different video.");

      status.textContent = "Step 1: Downloading audio stream...";
      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) throw new Error("Failed to download audio stream.");
      audioBlob = await audioRes.blob();

    } catch (e) {
      setStep(1, "error");
      status.className = "status error";
      status.textContent = "Error fetching YouTube audio: " + e.message;
      btn.disabled = false;
      return;
    }
  }

  // ── STEP 1b: Whisper transcription ──────────
  status.textContent = "Step 1: Transcribing with Groq Whisper...";
  let transcriptSegments = [];
  let fullText = "";

  try {
    const fileName = hlMode === "file" ? (hlSelectedFile.name || "audio.mp3") : "audio.mp3";
    const formData = new FormData();
    formData.append("file", audioBlob, fileName);
    formData.append("model", "whisper-large-v3");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "segment");

    const whisperRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqKey}` },
      body: formData,
    });

    const whisperData = await whisperRes.json();
    if (!whisperRes.ok) throw new Error(whisperData.error?.message || "Whisper transcription failed.");

    transcriptSegments = (whisperData.segments || []).map(seg => ({
      start: Math.round(seg.start * 10) / 10,
      end: Math.round(seg.end * 10) / 10,
      text: seg.text.trim(),
    }));

    fullText = transcriptSegments.map(s => `[${formatTime(s.start)} → ${formatTime(s.end)}] ${s.text}`).join("\n");
    setStep(1, "done");

  } catch (e) {
    setStep(1, "error");
    status.className = "status error";
    status.textContent = "Whisper Error: " + e.message;
    btn.disabled = false;
    return;
  }

  // ── STEP 2: Groq LLM highlight analysis ──────
  status.textContent = "Step 2: Analyzing with Llama AI...";
  setStep(2, "active");

  const clipGuide = {
    short: "30 to 60 seconds",
    medium: "60 to 120 seconds",
    long: "2 to 5 minutes",
  }[clipLen];

  const systemPrompt = `You are a viral video highlight expert. Analyze the transcript and find the most compelling clips.

For each highlight return a JSON object with exactly these fields:
- start_time: number (seconds, from the timestamps in the transcript)
- end_time: number (seconds, clip should be ${clipGuide} long)
- title: string (punchy viral-ready title, max 10 words)
- genre: one of [Story, Reaction, Insight, Debate, Humor, Tutorial, Emotional, Shocking, Motivational, Viral Moment]
- score: integer 1-100 (virality potential)
- reason: string (one sentence why this clip will perform well)

Return ONLY a raw JSON array. No markdown. No code fences. No explanation. Just the array starting with [ and ending with ].`;

  let highlights = [];

  try {
    // Use Groq's free LLM (llama-3.3-70b) — same API key as Whisper
    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2000,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Transcript below. Find the top ${maxH} highlights (each ${clipGuide} long). Return only the JSON array:\n\n${fullText}`
          }
        ]
      })
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) throw new Error(aiData.error?.message || "Groq LLM analysis failed.");

    const raw = aiData.choices?.[0]?.message?.content || "[]";
    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, "").trim();

    // Find the JSON array in the response (sometimes model adds a note before/after)
    const arrayStart = clean.indexOf("[");
    const arrayEnd = clean.lastIndexOf("]");
    if (arrayStart === -1 || arrayEnd === -1) throw new Error("AI returned unexpected format. Try again.");

    highlights = JSON.parse(clean.slice(arrayStart, arrayEnd + 1));
    if (!Array.isArray(highlights) || highlights.length === 0) throw new Error("No highlights found. The video may be too short or the transcript too sparse.");

    setStep(2, "done");

  } catch (e) {
    setStep(2, "error");
    status.className = "status error";
    status.textContent = "AI Error: " + e.message;
    btn.disabled = false;
    return;
  }

  // ── STEP 3: Score, rank, render ──────────────
  status.textContent = "Step 3: Ranking highlights...";
  setStep(3, "active");

  highlights.sort((a, b) => b.score - a.score);

  const GENRE_COLORS = {
    Story:          "#a78bfa",
    Reaction:       "#f87171",
    Insight:        "#60a5fa",
    Debate:         "#fb923c",
    Humor:          "#fbbf24",
    Tutorial:       "#34d399",
    Emotional:      "#f472b6",
    Shocking:       "#ff6b6b",
    Motivational:   "#e8ff3f",
    "Viral Moment": "#ffffff",
  };

  results.innerHTML = `
    <div class="hl-results-header">
      <span>${highlights.length} highlight${highlights.length !== 1 ? 's' : ''} found</span>
      <span class="hl-results-sub">sorted by virality score</span>
    </div>
    ${highlights.map((h, i) => {
      const color = GENRE_COLORS[h.genre] || "#e8ff3f";
      const duration = Math.round(h.end_time - h.start_time);
      const ytTimestamp = ytUrl ? `${ytUrl}&t=${Math.floor(h.start_time)}s` : null;
      const tsText = `${formatTime(h.start_time)} → ${formatTime(h.end_time)}`;

      return `
        <div class="hl-card">
          <div class="hl-card-top">
            <div class="hl-rank">#${i+1}</div>
            <div class="hl-card-main">
              <div class="hl-card-title">${h.title}</div>
              <div class="hl-card-meta">
                <span class="hl-genre" style="color:${color};border-color:${color}44">${h.genre}</span>
                <span class="hl-duration">⏱ ${duration}s</span>
                <span class="hl-ts">${tsText}</span>
              </div>
            </div>
            <div class="hl-score-box">
              <div class="hl-score-num" style="color:${color}">${h.score}</div>
              <div class="hl-score-label">score</div>
            </div>
          </div>
          <div class="hl-score-bar-track">
            <div class="hl-score-bar" style="width:${h.score}%;background:${color}"></div>
          </div>
          <div class="hl-reason">${h.reason}</div>
          <div class="hl-actions">
            ${ytTimestamp ? `<a class="hl-link" href="${ytTimestamp}" target="_blank" rel="noopener">Open in YouTube →</a>` : ""}
            <button class="hl-copy-btn" onclick="copyTimestamp(this, '${tsText}')">Copy Timestamp</button>
          </div>
        </div>
      `;
    }).join("")}
  `;

  results.classList.remove("hidden");
  setStep(3, "done");
  status.className = "status";
  status.textContent = `✓ Done! Found ${highlights.length} highlight${highlights.length !== 1 ? 's' : ''}.`;
  btn.disabled = false;
}

// ── Copy timestamp to clipboard ──
function copyTimestamp(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Copy Timestamp";
      btn.classList.remove("copied");
    }, 1800);
  });
}
