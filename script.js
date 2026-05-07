// Lock Screen Password
const LOCK_PASSWORD = "cleap";

function checkPassword() {
  const input = document.getElementById("lockInput");
  const error = document.getElementById("lockError");
  
  if (input.value === LOCK_PASSWORD) {
    document.getElementById("lockScreen").classList.add("hidden");
    document.getElementById("mainContent").classList.remove("hidden");
    error.textContent = "";
  } else {
    error.textContent = "Incorrect password";
    input.value = "";
    input.focus();
  }
}

document.getElementById("lockInput").addEventListener("keydown", e => {
  if (e.key === "Enter") checkPassword();
});

let segments = [];
let matchIndices = [];
let currentMatch = -1;
let selectedFile = null;

function handleFile(file) {
  if (!file) return;
  selectedFile = file;
  const zone = document.getElementById("dropZone");
  document.getElementById("dropLabel").textContent = `✓ ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)`;
  zone.classList.add("has-file");
  checkReady();
}

function checkReady() {
  const key = document.getElementById("apiKey").value.trim();
  document.getElementById("transcribeBtn").disabled = !(key && selectedFile);
}

document.getElementById("apiKey").addEventListener("input", checkReady);

// Drag and drop
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
