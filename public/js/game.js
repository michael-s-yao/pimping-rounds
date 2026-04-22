/**
 * pimping rounds — Wordle-style semantic guessing game
 *
 * Author(s):
 *     Michael Yao @michael-s-yao
 *
 * Licensed under the MIT License. Copyright Michael Yao 2026.
 */
import { loadEmbeddings } from "./embeddings.js";

const CATEGORY_LABELS = {
  all: "All",
  emergency_medicine: "Emergency Medicine",
  family_medicine: "Family Medicine",
  internal_medicine: "Internal Medicine",
  neurology: "Neurology",
  obgyn: "OB/GYN",
  pediatrics: "Pediatrics",
  psychiatry: "Psychiatry",
  surgery: "Surgery",
};

let allTerms = [];
let embIdx = null;
let fuse = null;
let activeCategory = "all";
let filteredTerms = [];
let filteredStrings = [];
let target = "";

let guesses = [];
let solved = false;
let todayDate = "";

let selectedTerm = null;
let highlightedIdx = -1;
let fuseResults = [];

function getDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++)
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getDailyTarget(terms, date, category) {
  const idx = hashCode(`${date}|${category}`) % terms.length;
  return terms[idx].term;
}

function getFilteredTerms(category) {
  if (category === "all")
    return [...allTerms];
  return allTerms.filter(t => t.categories.includes(category));
}

function computeRank(guessedTerm, targetTerm) {
  const targetVec = embIdx.getVecByTerm(targetTerm);
  const guessVec = embIdx.getVecByTerm(guessedTerm);
  const guessSim = embIdx.dot(guessVec, targetVec);
  let rank = 1;
  for (const term of filteredStrings) {
    if (term === guessedTerm)
      continue;
    if (embIdx.dot(embIdx.getVecByTerm(term), targetVec) > guessSim)
      rank++;
  }
  return rank;
}

function getHeat(rank, total) {
  if (rank === 1)
    return { label: "bullseye!", emoji: "🎯", cls: "heat-5" };
  const pct = rank / total;
  if (pct <= 0.05)
    return { label: "on fire", emoji: "🔥", cls: "heat-5" };
  if (pct <= 0.15)
    return { label: "scorching", emoji: "🌶️", cls: "heat-4" };
  if (pct <= 0.35)
    return { label: "warm", emoji: "😮",  cls: "heat-3" };
  if (pct <= 0.60)
    return { label: "lukewarm", emoji: "😐", cls: "heat-2" };
  if (pct <= 0.80)
    return { label: "cold", emoji: "🥶", cls: "heat-1" };
  return { label: "freezing", emoji: "❄️", cls: "heat-0" };
}

function stateKey() {
  return `game_${todayDate}_${activeCategory}`;
}

function statsKey() {
  return 'gameStats';
}

function saveGameState() {
  localStorage.setItem(stateKey(), JSON.stringify({ guesses, solved }));
}

function loadGameState() {
  guesses = [];
  solved = false;
  const raw = localStorage.getItem(stateKey());
  if (!raw)
    return;
  try {
    const data = JSON.parse(raw);
    guesses = data.guesses || [];
    solved = data.solved || false;
  } catch {}
}

function getStats() {
  try {
    return JSON.parse(localStorage.getItem(statsKey()))
      || { solved: 0, played: 0 };
  }
  catch {
    return { solved: 0, played: 0 };
  }
}

function saveStats(s) {
  localStorage.setItem(statsKey(), JSON.stringify(s));
}

function updateStatsDisplay() {
  const s = getStats();
  const acc = s.played > 0 ? Math.round(s.solved / s.played * 100) + "%" : "—";
  document.getElementById("statSolved").textContent = s.solved;
  document.getElementById("statAccuracy").textContent = acc;
}

function renderCategoryList() {
  const list = document.getElementById("categoryList");
  list.innerHTML = "";
  Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
    const count = key === "all"
      ? allTerms.length
      : allTerms.filter(t => t.categories.includes(key)).length;
    const btn = document.createElement("button");
    btn.className = "category-btn" + (key === activeCategory ? " active" : "");
    btn.textContent = `${label} (${count})`;
    btn.onclick = () => switchCategory(key);
    list.appendChild(btn);
  });
}

function renderMessage() {
  const msg = document.getElementById("message");
  if (solved && guesses[guesses.length - 1]?.rank === 1) {
    msg.innerHTML = `🎯 correct! the answer was <strong>${target}</strong>`;
  } else if (solved) {
    msg.innerHTML = `the answer was <strong>${target}</strong>`;
  } else if (guesses.length > 0) {
    const last = guesses[guesses.length - 1];
    const heat = getHeat(last.rank, filteredStrings.length);
    msg.textContent = `${heat.emoji} rank #${last.rank} of ${filteredStrings.length} — ${heat.label}`;
  } else {
    msg.innerHTML = "&emsp;";
  }
}

function renderGuessList() {
  const list = document.getElementById("guessList");
  list.innerHTML = "";
  if (guesses.length === 0)
    return;

  const total = filteredStrings.length;

  const header = document.createElement("div");
  header.className = "guess-list-header";
  header.innerHTML = `
    <span class="gl-num"></span>
    <span class="gl-term">term</span>
    <span class="gl-bar">closeness</span>
    <span class="gl-rank">rank</span>
    <span class="gl-heat"></span>
  `;
  list.appendChild(header);

  guesses.forEach((g, i) => {
    const heat = getHeat(g.rank, total);
    const closeness = (total - g.rank) / Math.max(total - 1, 1);
    const barPct = Math.round(closeness * 100);

    const row = document.createElement("div");
    row.className = `guess-row ${heat.cls}${g.rank === 1 ? " correct" : ""}`;
    row.innerHTML = `
      <span class="guess-num">${i + 1}</span>
      <span class="guess-term" title="${g.term}">${g.term}</span>
      <div class="guess-bar-wrap">
        <div class="guess-bar-fill" style="width:${barPct}%"></div>
      </div>
      <span class="guess-rank-text">#${g.rank}</span>
      <span class="guess-heat-emoji" title="${heat.label}">${heat.emoji}</span>
    `;
    list.appendChild(row);
  });
}

function renderGame() {
  const isLocked = solved;

  const input = document.getElementById("guessInput");
  const submitBtn = document.getElementById("submitBtn");
  const giveUpArea = document.getElementById("giveUpArea");
  const counter = document.getElementById("guessCount");

  if (input)
    input.disabled = isLocked;
  if (submitBtn)
    submitBtn.disabled = true;
  if (giveUpArea) {
    giveUpArea.style.display = (!isLocked && guesses.length > 0)
      ? "block"
      : "none";
  }
  if (counter) {
    counter.textContent = guesses.length > 0
      ? `${guesses.length} guess${guesses.length !== 1 ? 'es' : ''}`
      : '';
  }

  renderMessage();
  renderGuessList();
}

function initFuse() {
  const guessedSet = new Set(guesses.map(g => g.term));
  const available = filteredTerms.filter(t => !guessedSet.has(t.term));
  fuse = new Fuse(available, {
    keys: ["term"],
    threshold: 0.35,
    minMatchCharLength: 3,
    ignoreLocation: true,
    includeScore: true,
  });
}

function openAutocomplete(results) {
  const dropdown = document.getElementById("autocompleteList");
  dropdown.innerHTML = "";
  const top = results.slice(0, 12);
  if (top.length === 0) {
    dropdown.classList.remove("open");
    return;
  }

  top.forEach((r, i) => {
    const termName = r.item.term;
    const item = document.createElement("div");
    item.className = "autocomplete-item" + (
      i === highlightedIdx ? " highlighted" : ""
    );
    item.textContent = termName;
    item.addEventListener(
      "mousedown", e => { e.preventDefault(); selectTerm(termName); }
    );
    dropdown.appendChild(item);
  });
  dropdown.classList.add("open");
}

function closeAutocomplete() {
  const dropdown = document.getElementById("autocompleteList");
  if (dropdown) {
    dropdown.classList.remove("open");
    dropdown.innerHTML = "";
  }
  highlightedIdx = -1;
}

function selectTerm(term) {
  selectedTerm = term;
  document.getElementById("guessInput").value = term;
  closeAutocomplete();
  document.getElementById("submitBtn").disabled = false;
}

function onInputChange(e) {
  const query = e.target.value.trim();
  selectedTerm = null;
  document.getElementById("submitBtn").disabled = true;

  if (query.length < 2) {
    closeAutocomplete();
    return;
  }

  fuseResults = fuse.search(query);
  highlightedIdx = -1;
  openAutocomplete(fuseResults);
}

function onInputKeydown(e) {
  const dropdown = document.getElementById("autocompleteList");
  const items = dropdown.querySelectorAll(".autocomplete-item");

  if (e.key === "ArrowDown") {
    e.preventDefault();
    highlightedIdx = Math.min(highlightedIdx + 1, items.length - 1);
    applyHighlight(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    highlightedIdx = Math.max(highlightedIdx - 1, -1);
    applyHighlight(items);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (highlightedIdx >= 0 && items[highlightedIdx]) {
      selectTerm(items[highlightedIdx].textContent);
    } else if (selectedTerm) {
      submitGuess();
    }
  } else if (e.key === "Escape") {
    closeAutocomplete();
  }
}

function applyHighlight(items) {
  items.forEach(
    (item, i) => item.classList.toggle("highlighted", i === highlightedIdx)
  );
  if (highlightedIdx >= 0 && items[highlightedIdx])
    selectTerm(items[highlightedIdx].textContent);
}

function submitGuess() {
  if (!selectedTerm || solved)
    return;
  if (guesses.find(g => g.term === selectedTerm)) {
    flashMessage('already guessed that one!');
    return;
  }

  const rank = computeRank(selectedTerm, target);
  guesses.push({ term: selectedTerm, rank });

  if (guesses.length === 1) {
    const stats = getStats();
    stats.played++;
    saveStats(stats);
    updateStatsDisplay();
  }

  if (rank === 1) {
    solved = true;
    const stats = getStats();
    stats.solved++;
    saveStats(stats);
    updateStatsDisplay();
  }

  saveGameState();

  selectedTerm = null;
  document.getElementById("guessInput").value = "";
  document.getElementById("submitBtn").disabled = true;
  initFuse();
  renderGame();

  if (solved) setTimeout(showResult, 900);
}

function giveUp() {
  if (solved)
    return;
  if (!confirm("reveal the answer and end today\'s game?"))
    return;
  solved = true;
  saveGameState();
  document.getElementById("giveUpArea").style.display = "none";
  document.getElementById("guessInput").disabled = true;
  document.getElementById("submitBtn").disabled  = true;
  renderMessage();
  renderGuessList();
}

function flashMessage(text) {
  const msg = document.getElementById("message");
  msg.textContent = text;
  setTimeout(renderMessage, 2000);
}

function showResult() {
  const stats = getStats();
  const acc = stats.played > 0
    ? Math.round(stats.solved / stats.played * 100) + "%"
    : "—";
  document.getElementById("resultEmoji").textContent = "🎯";
  document.getElementById("resultTitle").textContent = "you got it!";
  document.getElementById("resultMsg").innerHTML =
    `the answer was <strong>${target}</strong><br>solved in ${guesses.length} guess${guesses.length !== 1 ? 'es' : ''}`;
  document.getElementById("rsSolved").textContent = stats.solved;
  document.getElementById("rsPlayed").textContent = stats.played;
  document.getElementById("rsAccuracy").textContent = acc;
  document.getElementById("resultOverlay").style.display = "flex";
}

function switchCategory(category) {
  if (category === activeCategory)
    return;
  activeCategory = category;
  localStorage.setItem("activeCategory", category);
  filteredTerms = getFilteredTerms(category);
  filteredStrings = filteredTerms.map(t => t.term);
  target = getDailyTarget(filteredTerms, todayDate, category);
  loadGameState();
  selectedTerm = null;
  highlightedIdx = -1;
  renderCategoryList();
  initFuse();
  const input = document.getElementById("guessInput");
  if (input) {
    input.value = "";
    input.disabled = false;
  }
  closeAutocomplete();
  renderGame();
}

window.closeResult = function () {
  document.getElementById("resultOverlay").style.display = "none";
};

window.toggleDark = function () {
  const dark = document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", dark ? "1" : "0");
  document.getElementById("iconMoon").style.display = dark ? "none" : "";
  document.getElementById("iconSun").style.display = dark ? "" : "none";
};

async function init() {
  const dark = localStorage.getItem("darkMode") === "1";
  if (dark) {
    document.body.classList.add("dark");
    document.getElementById("iconMoon").style.display = "none";
    document.getElementById("iconSun").style.display = "";
  }

  const termsRes = await fetch("/public/terms.json");
  allTerms = await termsRes.json();
  const termStrings = allTerms.map(t => t.term);

  embIdx = await loadEmbeddings("/public/embeddings.json", termStrings);

  activeCategory = localStorage.getItem("activeCategory") || "all";
  todayDate = getDateString();
  filteredTerms = getFilteredTerms(activeCategory);
  filteredStrings = filteredTerms.map(t => t.term);
  target = getDailyTarget(filteredTerms, todayDate, activeCategory);

  loadGameState();

  renderCategoryList();
  initFuse();
  updateStatsDisplay();
  renderGame();

  const input = document.getElementById("guessInput");
  const submitBtn = document.getElementById("submitBtn");
  const giveUpBtn = document.getElementById("giveUpBtn");

  input.addEventListener("input", onInputChange);
  input.addEventListener("keydown", onInputKeydown);
  input.addEventListener("blur", () => setTimeout(closeAutocomplete, 160));

  submitBtn.addEventListener("click", submitGuess);
  if (giveUpBtn)
    giveUpBtn.addEventListener("click", giveUp);

  if (solved && guesses.length > 0 && guesses[guesses.length - 1].rank === 1) {
    setTimeout(showResult, 400);
  }

  document.getElementById("app").style.display = "flex";
}

init().catch(console.error);
