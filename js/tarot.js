// Tarot Reading app logic — draws from tarotCardsData (js/tarot-data.js)

const MAJOR_IMAGES = [
  "RWS_Tarot_00_Fool",
  "RWS_Tarot_01_Magician",
  "RWS_Tarot_02_High_Priestess",
  "RWS_Tarot_03_Empress",
  "RWS_Tarot_04_Emperor",
  "RWS_Tarot_05_Hierophant",
  "RWS_Tarot_06_Lovers",
  "RWS_Tarot_07_Chariot",
  "RWS_Tarot_08_Strength",
  "RWS_Tarot_09_Hermit",
  "RWS_Tarot_10_Wheel_of_Fortune",
  "RWS_Tarot_11_Justice",
  "RWS_Tarot_12_Hanged_Man",
  "RWS_Tarot_13_Death",
  "RWS_Tarot_14_Temperance",
  "RWS_Tarot_15_Devil",
  "RWS_Tarot_16_Tower",
  "RWS_Tarot_17_Star",
  "RWS_Tarot_18_Moon",
  "RWS_Tarot_19_Sun",
  "RWS_Tarot_20_Judgement",
  "RWS_Tarot_21_World",
];

const CARD_IMAGES_DIR = "img/cards";
const SUIT_FOLDERS = { 2: "Wands", 3: "Cups", 4: "Swords", 5: "Pents" };
const COURT_RANKS = { page: 11, knight: 12, queen: 13, king: 14 };

const SPREADS = {
  celtic: {
    label: "Celtic Cross",
    tagline: "A ten-card spread for a deep, detailed reading.",
    // index: 0 Present, 1 Challenge (crosses 0), 2 Foundation (top),
    // 3 Recent Past (right), 4 Potential (bottom), 5 Near Future (left),
    // 6-9 the staff, bottom to top.
    positions: [
      "Present",
      "Challenge",
      "Foundation",
      "Recent Past",
      "Potential",
      "Near Future",
      "You",
      "Environment",
      "Hopes & Fears",
      "Outcome",
    ],
  },
};

const POSITION_MEANINGS = {
  Present:
    "The heart of the matter — what's actually happening in the situation right now.",
  Challenge:
    "What crosses you: the immediate tension or obstacle shaping everything else in the spread.",
  Foundation:
    "The root of the matter — an underlying influence, often from further back, that the situation is built on.",
  "Recent Past":
    "An influence that's fading — something moving out of the picture as the situation develops.",
  Potential:
    "The best that can be achieved here, or the goal you're consciously (or unconsciously) reaching for.",
  "Near Future": "What's coming next on the current path, in the near term.",
  You: "How you see yourself in this situation — your attitude, self-image, or role.",
  Environment:
    "The people and circumstances around you — outside influences bearing on the outcome.",
  "Hopes & Fears":
    "What you privately hope for and privately dread about how this turns out.",
  Outcome: "Where things are heading if the current path continues.",
};

const positionMarkup = (position) => {
  const meaning = POSITION_MEANINGS[position];
  return meaning
    ? `<div class="tarot-card-position clickable" onclick="showPositionInfo(event, '${position}')">${position}</div>`
    : `<div class="tarot-card-position">${position}</div>`;
};

// Thematic re-grouping used by the "Interpret Reading" view: reads the same
// ten cards as a narrative instead of by their position on the cross.
const INTERPRETATION_SECTIONS = [
  { title: "You & the Present", positions: ["Present", "You"] },
  {
    title: "The Throughline",
    positions: ["Foundation", "Potential", "Outcome"],
  },
  {
    title: "The Immediate Path",
    positions: ["Recent Past", "Challenge", "Near Future"],
  },
  { title: "The Outer Layer", positions: ["Environment", "Hopes & Fears"] },
];

let interpretMode = false;

let deck = [];
let activeCards = [];
let activeIndex = -1;
let currentSpreadKey = null;
let placedCount = 0;
let revealedCount = 0;

const cardImage = (card) => {
  if (card.suit === 1) {
    return `${CARD_IMAGES_DIR}/${MAJOR_IMAGES[card.rank]}.jpg`;
  }
  const rankNum =
    typeof card.rank === "number" ? card.rank : COURT_RANKS[card.rank];
  const folder = SUIT_FOLDERS[card.suit];
  return `${CARD_IMAGES_DIR}/${folder}${String(rankNum).padStart(2, "0")}.jpg`;
};

const titleCase = (name) =>
  name.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/ Of /g, " of ");

const shuffledDeck = () => {
  const copy = [...tarotCardsData];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Three ways to populate the ten Celtic Cross slots: click through the fanned
// deck yourself, have the app deal them for you on a timer, or hand-pick every
// card from a form. Whichever way the cards land in `activeCards`, the rest of
// the app (reveal-on-click gating, the detail panel, interpretation view)
// behaves exactly the same afterwards.
let drawMode = "click"; // "click" | "auto" | "enter"
let autoDrawTimer = null;

// "click": cards drawn one at a time (the Draw button or a click on the
// deck); "auto": Draw All is dealing them on a timer; "enter": the form.
const DRAW_MODES = [
  { id: "click", label: "Draw a Card" },
  { id: "auto", label: "Draw All" },
  { id: "enter", label: "Enter Drawing" },
];

// Same pattern as Rune Reading: "Draw a Card" (then "Draw Next Card") and
// an outline "Draw All", plus "Enter Drawing" before the first card.
const renderDrawModePicker = () => {
  const elem = document.getElementById("draw-mode-picker");
  if (!elem) return;
  // Once every card is drawn the buttons are moot, so the row stays hidden
  // until "New Reading" starts over (placedCount back to 0).
  const drawn = activeCards.length > 0 && placedCount >= activeCards.length;
  elem.style.display = drawn ? "none" : "";
  if (drawn) return;
  const dealing = autoDrawTimer ? " disabled" : "";
  const entering = drawMode === "enter";
  const next = entering ? 0 : placedCount;
  const remaining = activeCards.length - next;
  elem.innerHTML = `
    <button type="button" class="draw-btn" onclick="drawCardClick()"${dealing}>${next === 0 ? "Draw a Card" : "Draw Next Card"}</button>
    ${remaining > 1 ? `<button type="button" class="draw-btn secondary" onclick="drawAllClick()"${dealing}>Draw All</button>` : ""}
    ${next === 0 && !entering ? `<button type="button" class="draw-btn secondary" onclick="startReading('enter')"${dealing}>Enter Drawing</button>` : ""}`;
};

// Draws the next card from the deck, as a click on the deck would.
const drawCardClick = () => {
  if (autoDrawTimer) return;
  if (drawMode === "enter") startReading("click");
  else drawMode = "click";
  const deckCards = document.querySelectorAll(".deck-card");
  if (!deckCards.length) return;
  drawNextCard(deckCards[Math.floor(Math.random() * deckCards.length)]);
};

// Deals every remaining card, one after the other.
const drawAllClick = () => {
  if (autoDrawTimer) return;
  if (drawMode === "enter") return startReading("auto");
  drawMode = "auto";
  startAutoDraw();
  renderDrawModePicker();
  saveReadingState();
};

const stopAutoDraw = () => {
  if (autoDrawTimer) {
    clearInterval(autoDrawTimer);
    autoDrawTimer = null;
  }
};

const startAutoDraw = () => {
  stopAutoDraw();
  if (placedCount >= activeCards.length) return;
  autoDrawTimer = setInterval(() => {
    if (placedCount >= activeCards.length) {
      stopAutoDraw();
      return;
    }
    const deckCards = document.querySelectorAll(".deck-card");
    if (!deckCards.length) {
      stopAutoDraw();
      return;
    }
    const deckCard = deckCards[Math.floor(Math.random() * deckCards.length)];
    drawNextCard(deckCard);
  }, 500);
};

// The current reading (which cards landed where, how far dealt/revealed,
// and which draw mode was in play) is mirrored to localStorage on every
// change, so reloading the page picks the same reading back up instead of
// starting a fresh random one.
const READING_STORAGE_KEY = "tarot-active-reading";

const saveReadingState = () => {
  if (!activeCards.length || (drawMode === "enter" && placedCount === 0)) {
    localStorage.removeItem(READING_STORAGE_KEY);
    return;
  }
  const data = {
    spreadKey: currentSpreadKey,
    drawMode,
    placedCount,
    revealedCount,
    cards: activeCards.map(({ card, position }) => ({
      suit: card.suit,
      rank: card.rank,
      position,
    })),
  };
  try {
    localStorage.setItem(READING_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full/unavailable -- not worth failing the reading over
  }
};

const restoreReadingState = () => {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(READING_STORAGE_KEY) || "null");
  } catch {
    raw = null;
  }
  const positions = SPREADS.celtic.positions;
  if (
    !raw ||
    raw.spreadKey !== "celtic" ||
    !Array.isArray(raw.cards) ||
    raw.cards.length !== positions.length
  ) {
    return false;
  }

  const cards = raw.cards.map((c) =>
    tarotCardsData.find(
      (tc) => tc.suit === c.suit && String(tc.rank) === String(c.rank),
    ),
  );
  if (cards.some((c) => !c)) return false;

  currentSpreadKey = "celtic";
  drawMode = DRAW_MODES.some((m) => m.id === raw.drawMode)
    ? raw.drawMode
    : "click";
  activeCards = positions.map((position, i) => ({ card: cards[i], position }));
  deck = cards.slice();
  activeIndex = -1;
  placedCount = Math.min(
    Math.max(Number(raw.placedCount) || 0, 0),
    activeCards.length,
  );
  revealedCount = Math.min(
    Math.max(Number(raw.revealedCount) || 0, 0),
    placedCount,
  );
  interpretMode = false;

  const spread = SPREADS.celtic;
  const title = document.getElementById("spread-title");
  if (title) title.textContent = spread.label;
  const tagline = document.getElementById("spread-tagline");
  if (tagline) tagline.textContent = spread.tagline;

  document.getElementById("card-grid")?.classList.remove("hidden");
  document.getElementById("interpretation-view")?.classList.remove("open");
  document.getElementById("entry-form")?.classList.remove("open");

  renderSpread();
  for (let i = 0; i < placedCount; i++) {
    const slot = document.querySelector(`#card-grid [data-slot="${i}"]`);
    if (slot) slot.outerHTML = cardMarkup(i);
    if (i < revealedCount) {
      document
        .querySelector(
          `#card-grid .tarot-card[data-index="${i}"] .card-flip-inner`,
        )
        ?.classList.add("flipped");
    }
  }
  renderInterpretBar();
  closeDetail();
  updateNextHighlight();
  renderDrawModePicker();

  if (drawMode === "enter") {
    const area = document.getElementById("deck-area");
    if (area) {
      area.innerHTML = "";
      area.style.display = "none";
    }
  } else {
    renderDeckBand();
    if (drawMode === "auto" && placedCount < activeCards.length)
      startAutoDraw();
  }
  scheduleAlign(document.querySelector("#card-grid .tarot-card.crossing"));
  return true;
};

const startReading = (mode) => {
  drawMode = mode;
  stopAutoDraw();
  stopReveal();

  const spread = SPREADS.celtic;
  currentSpreadKey = "celtic";
  deck = shuffledDeck();
  activeCards = spread.positions.map((position, i) => ({
    card: deck[i],
    position,
  }));
  activeIndex = -1;
  placedCount = 0;
  revealedCount = 0;
  interpretMode = false;

  const title = document.getElementById("spread-title");
  if (title) title.textContent = spread.label;
  const tagline = document.getElementById("spread-tagline");
  if (tagline) tagline.textContent = spread.tagline;

  document.getElementById("card-grid")?.classList.remove("hidden");
  document.getElementById("interpretation-view")?.classList.remove("open");
  document.getElementById("entry-form")?.classList.remove("open");

  renderSpread();
  renderInterpretBar();
  closeDetail();
  updateNextHighlight();
  renderDrawModePicker();

  if (mode === "enter") {
    const area = document.getElementById("deck-area");
    if (area) {
      area.innerHTML = "";
      area.style.display = "none";
    }
    renderEntryForm();
  } else {
    renderDeckBand();
    if (mode === "auto") startAutoDraw();
  }
  saveReadingState();
};

// -- "Enter Drawing": a 10-row form (one per position) with an Arcana
// dropdown and a dependent card dropdown, for dealing a specific, chosen
// reading instead of a random one. --
const ARCANA_OPTIONS = [
  { suit: 1, label: "Major Arcana" },
  { suit: 2, label: "Wands" },
  { suit: 3, label: "Cups" },
  { suit: 4, label: "Swords" },
  { suit: 5, label: "Coins" },
];

const rankValue = (rank) =>
  typeof rank === "number" ? rank : COURT_RANKS[rank];

const cardsForSuit = (suit) =>
  tarotCardsData
    .filter((c) => c.suit === suit)
    .slice()
    .sort((a, b) => rankValue(a.rank) - rankValue(b.rank));

const entryCardOptions = (suit, selectedValue, excluded = []) =>
  `<option value="" disabled${selectedValue ? "" : " selected"}>Choose a card…</option>` +
  cardsForSuit(suit)
    .filter((c) => !excluded.includes(`${c.suit}|${c.rank}`))
    .map((c) => {
      const value = `${c.suit}|${c.rank}`;
      return `<option value="${value}"${value === selectedValue ? " selected" : ""}>${titleCase(c.name)}</option>`;
    })
    .join("");

// A row's card list only ever excludes cards claimed by rows *above* it, so
// this walks the form top-down: whatever a row still legitimately holds
// becomes part of the exclusion set for every row that follows. A row whose
// pick just got claimed by an earlier row (its arcana changed, say) loses
// that selection and falls back to the placeholder, same as clearing it by
// hand.
const refreshEntryRowOptions = () => {
  const claimed = [];
  SPREADS.celtic.positions.forEach((_, i) => {
    const row = document.querySelector(`.entry-row[data-row="${i}"]`);
    const cardSelect = row?.querySelector(".entry-card");
    if (!row || !cardSelect) return;
    const suit = Number(row.querySelector(".entry-arcana")?.value);
    const currentValue = cardSelect.value;
    const stillValid = currentValue && !claimed.includes(currentValue);
    cardSelect.innerHTML = entryCardOptions(
      suit,
      stillValid ? currentValue : "",
      claimed,
    );
    if (stillValid) {
      claimed.push(currentValue);
    } else if (currentValue) {
      updateEntryPreview(i);
    }
  });
};

// Mirrors the in-progress "Enter Drawing" form (every row's arcana + card
// choice, filled or not) to localStorage as the person fills it in, so a
// reload while they're mid-form picks the same picks back up.
const ENTRY_DRAFT_KEY = "tarot-entry-draft";

const saveEntryDraft = () => {
  const rows = document.querySelectorAll(".entry-row");
  if (!rows.length) return;
  const draft = Array.from(rows).map((row) => ({
    suit: row.querySelector(".entry-arcana")?.value || "1",
    value: row.querySelector(".entry-card")?.value || "",
  }));
  try {
    localStorage.setItem(ENTRY_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage full/unavailable -- not worth failing the form over
  }
};

const loadEntryDraft = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(ENTRY_DRAFT_KEY) || "null");
    if (!Array.isArray(raw) || raw.length !== SPREADS.celtic.positions.length)
      return null;
    return raw;
  } catch {
    return null;
  }
};

const clearEntryDraft = () => {
  localStorage.removeItem(ENTRY_DRAFT_KEY);
};

// Resets every row back to its placeholder (Major Arcana, no card chosen),
// wipes the saved draft, and clears the live preview on the spread behind
// the form -- same end state as opening "Enter Drawing" fresh.
const clearEntryForm = () => {
  clearEntryDraft();
  renderEntryForm();
};

const onEntryArcanaChange = (i) => {
  const row = document.querySelector(`.entry-row[data-row="${i}"]`);
  const cardSelect = row?.querySelector(".entry-card");
  if (cardSelect) cardSelect.value = ""; // drop the old suit's pick before recomputing
  refreshEntryRowOptions();
  updateEntryPreview(i);
  saveEntryDraft();
};

const onEntryCardChange = (i) => {
  updateEntryPreview(i);
  refreshEntryRowOptions();
  saveEntryDraft();
  maybeFinalizeEntry();
};

// As soon as a row's card is picked (or cleared, e.g. by switching arcana),
// mirror it straight onto the spread behind the form -- no need to submit
// first to see it land on the cross.
const updateEntryPreview = (i) => {
  const position = SPREADS.celtic.positions[i];
  const row = document.querySelector(`.entry-row[data-row="${i}"]`);
  const value = row?.querySelector(".entry-card")?.value;

  let card = null;
  if (value) {
    const [suitStr, rankStr] = value.split("|");
    const suit = Number(suitStr);
    card =
      tarotCardsData.find(
        (c) => c.suit === suit && String(c.rank) === rankStr,
      ) || null;
  }

  // Small thumbnail right in the row, capped at 40x40, so picking a card
  // gives instant feedback without needing to look over at the spread.
  const thumb = row?.querySelector(".entry-thumb img");
  if (thumb) {
    if (card) {
      thumb.src = cardImage(card);
      thumb.alt = titleCase(card.name);
    } else {
      thumb.removeAttribute("src");
      thumb.alt = "";
    }
  }

  const slotEl = document.querySelector(`#card-grid [data-slot="${i}"]`);
  if (slotEl) {
    if (!card) {
      slotEl.outerHTML = `
      <div class="tarot-card placeholder${slotExtraClass(i) ? " " + slotExtraClass(i) : ""}" data-slot="${i}">
        ${positionMarkup(position)}
        <div class="card-frame placeholder-frame"></div>
      </div>`;
    } else {
      const name = titleCase(card.name);
      const extraClass = slotExtraClass(i);
      slotEl.outerHTML = `
      <div class="tarot-card preview${extraClass ? " " + extraClass : ""}" data-slot="${i}" onclick="showEntryCardDetail(${i})">
        ${positionMarkup(position)}
        <div class="card-frame"><img src="${cardImage(card)}" alt="${name}" loading="lazy" /></div>
        <div class="tarot-card-name">${name}</div>
      </div>`;
    }
  }

  if (i === 0 || i === CROSSING_INDEX) {
    scheduleAlign(document.querySelector("#card-grid .tarot-card.crossing"));
  }
};

const renderEntryForm = () => {
  const elem = document.getElementById("entry-form");
  if (!elem) return;
  const draft = loadEntryDraft();
  const rows = SPREADS.celtic.positions
    .map((position, i) => {
      const saved = draft?.[i];
      const suit = saved?.suit ? Number(saved.suit) : 1;
      const value = saved?.value || "";
      return `
      <div class="entry-row" data-row="${i}">
        <div class="entry-position">${position}</div>
        <div class="entry-thumb"><img alt="" onclick="showEntryCardDetail(${i})" /></div>
        <div class="entry-selects">
          <select class="entry-arcana" onchange="onEntryArcanaChange(${i})">
            ${ARCANA_OPTIONS.map(
              (a) =>
                `<option value="${a.suit}"${a.suit === suit ? " selected" : ""}>${a.label}</option>`,
            ).join("")}
          </select>
          <select class="entry-card" onchange="onEntryCardChange(${i})">${entryCardOptions(suit, value)}</select>
        </div>
      </div>`;
    })
    .join("");
  elem.innerHTML = `
    ${rows}
    <p class="entry-error" id="entry-error"></p>
    <div class="entry-actions">
      <button type="button" class="entry-clear" onclick="clearEntryForm()">Clear</button>
    </div>`;
  elem.classList.add("open");

  // Re-apply the top-down exclusion cascade to whatever was restored (in
  // case a hand-edited/stale draft has conflicts), then mirror every
  // already-picked row onto the spread behind the form.
  refreshEntryRowOptions();
  SPREADS.celtic.positions.forEach((_, i) => updateEntryPreview(i));
  maybeFinalizeEntry();
};

// Once every position has a distinct card chosen, there's nothing left to
// decide -- fold the picks straight into a fully revealed reading (no
// separate submit step, no one-by-one flip -- the picks were deliberate)
// so "Interpret Reading" shows up as soon as the tenth card is picked.
const maybeFinalizeEntry = () => {
  const rows = document.querySelectorAll(".entry-row");
  if (rows.length !== SPREADS.celtic.positions.length) return;
  const chosen = Array.from(rows).map(
    (row) => row.querySelector(".entry-card")?.value || "",
  );
  const errorEl = document.getElementById("entry-error");

  if (chosen.some((v) => !v)) {
    if (errorEl) errorEl.textContent = "";
    return;
  }
  if (new Set(chosen).size !== chosen.length) {
    if (errorEl)
      errorEl.textContent = "Each card can only appear once in a reading.";
    return;
  }
  if (errorEl) errorEl.textContent = "";

  const spread = SPREADS.celtic;
  activeCards = spread.positions.map((position, i) => {
    const [suitStr, rankStr] = chosen[i].split("|");
    const suit = Number(suitStr);
    const card = tarotCardsData.find(
      (c) => c.suit === suit && String(c.rank) === rankStr,
    );
    return { card, position };
  });
  activeIndex = -1;
  placedCount = activeCards.length;
  revealedCount = activeCards.length;

  renderSpread();
  for (let i = 0; i < activeCards.length; i++) {
    const slot = document.querySelector(`#card-grid [data-slot="${i}"]`);
    if (slot) slot.outerHTML = cardMarkup(i);
    document
      .querySelector(
        `#card-grid .tarot-card[data-index="${i}"] .card-flip-inner`,
      )
      ?.classList.add("flipped");
  }
  renderDeckBand();
  renderInterpretBar();
  renderDrawModePicker();
  updateNextHighlight();
  scheduleAlign(document.querySelector("#card-grid .tarot-card.crossing"));
  saveReadingState();
  clearEntryDraft();

  document.getElementById("entry-form")?.classList.remove("open");
};

// Card back is fixed to the first (classic) pattern -- the picker toggle
// was removed, so this is no longer user-selectable.
const CARD_BACK_IMAGE = `${CARD_IMAGES_DIR}/Tarot_Roses_and_Lilies.jpg`;

const cardBackImage = () => CARD_BACK_IMAGE;

const CROSSING_INDEX = 1;

const slotExtraClass = (i) => (i === CROSSING_INDEX ? "crossing" : "");

const cardMarkup = (i) => {
  const { card, position } = activeCards[i];
  const name = titleCase(card.name);
  const extraClass = slotExtraClass(i);
  return `
    <div class="tarot-card${extraClass ? " " + extraClass : ""}${
      i === activeIndex ? " active" : ""
    }" data-index="${i}" onclick="selectCard(${i})">
      ${positionMarkup(position)}
      <div class="card-flip">
        <div class="card-flip-inner">
          <div class="card-face card-back">
            <div class="card-frame"><img src="${cardBackImage()}" alt="Card back" /></div>
          </div>
          <div class="card-face card-front">
            <div class="card-frame"><img src="${cardImage(card)}" alt="${name}" loading="lazy" /></div>
          </div>
        </div>
      </div>
      <div class="tarot-card-name">${name}</div>
    </div>`;
};

const slotMarkup = (i) => {
  const { position } = activeCards[i];
  const extraClass = slotExtraClass(i);
  return `
    <div class="tarot-card placeholder${extraClass ? " " + extraClass : ""}" data-slot="${i}">
      ${positionMarkup(position)}
      <div class="card-frame placeholder-frame"></div>
    </div>`;
};

// Present and Challenge share a slot and are meant to form a true plus-sign
// cross: Challenge (rotated 90deg) laid exactly over Present. Their outer
// boxes include a position label above and a name below, and neither is
// the same height, so centering the boxes on each other isn't enough --
// this measures the actual card art (.card-frame) of each and nudges the
// crossing card so the two frames' centers land on the same point.
const alignCrossingCard = () => {
  const presentFrame = document.querySelector(
    ".area-center .tarot-card:not(.crossing) .card-frame",
  );
  const crossingCard = document.querySelector(".tarot-card.crossing");
  const crossingFrame = crossingCard?.querySelector(".card-frame");
  if (!presentFrame || !crossingCard || !crossingFrame) return;

  crossingCard.style.setProperty("--cross-offset-x", "0px");
  crossingCard.style.setProperty("--cross-offset-y", "0px");

  const presentRect = presentFrame.getBoundingClientRect();
  const crossingRect = crossingFrame.getBoundingClientRect();
  const dx =
    presentRect.left +
    presentRect.width / 2 -
    (crossingRect.left + crossingRect.width / 2);
  const dy =
    presentRect.top +
    presentRect.height / 2 -
    (crossingRect.top + crossingRect.height / 2);

  crossingCard.style.setProperty("--cross-offset-x", `${dx}px`);
  crossingCard.style.setProperty("--cross-offset-y", `${dy}px`);
};

// Present/Challenge geometry only settles once their deal-in animation
// finishes (mid-animation they're still scaled down / off-position), so the
// alignment measurement has to wait for that rather than run right after
// the DOM insert. Falls back to a timer in case animationend doesn't fire.
const scheduleAlign = (el) => {
  if (!el) {
    alignCrossingCard();
    return;
  }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    alignCrossingCard();
  };
  el.addEventListener("animationend", run, { once: true });
  setTimeout(run, 450);
};

const renderSpread = () => {
  const grid = document.getElementById("card-grid");
  if (!grid) return;
  grid.classList.add("celtic-layout");
  grid.innerHTML = `
    <div class="celtic-cross">
      <div class="cross-slot area-top">${slotMarkup(2)}</div>
      <div class="cross-slot area-left">${slotMarkup(5)}</div>
      <div class="cross-slot area-center">
        ${slotMarkup(0)}
        ${slotMarkup(1)}
      </div>
      <div class="cross-slot area-right">${slotMarkup(3)}</div>
      <div class="cross-slot area-bottom">${slotMarkup(4)}</div>
    </div>
    <div class="celtic-staff">
      ${slotMarkup(6)}
      ${slotMarkup(7)}
      ${slotMarkup(8)}
      ${slotMarkup(9)}
    </div>`;
  scheduleAlign(grid.querySelector(".tarot-card.crossing"));
};

// The deck band is a hand-of-cards fan: every card hangs from the same
// pivot point above the visible area and swings out across +/-maxAngle,
// so the row reads as a smile-shaped arc (edges up, middle low).
const DECK_CARD_WIDTH = 70;
const DECK_CARD_HEIGHT = 114;
const DECK_RADIUS = 550;
const DECK_MAX_ANGLE = 32;

const renderDeckBand = () => {
  const area = document.getElementById("deck-area");
  if (!area) return;
  if (placedCount >= activeCards.length) {
    area.innerHTML = "";
    area.style.display = "none";
    return;
  }
  area.style.display = "block";

  const remaining = deck.length - placedCount;
  const angleStep = remaining > 1 ? (DECK_MAX_ANGLE * 2) / (remaining - 1) : 0;
  const cards = Array.from({ length: remaining }, (_, i) => {
    const angle = remaining > 1 ? -DECK_MAX_ANGLE + i * angleStep : 0;
    return `
    <div class="deck-card" style="--angle:${angle}deg; --radius:${DECK_RADIUS}px; z-index:${i}" onclick="drawNextCard(this)">
      <div class="card-frame"><img src="${cardBackImage()}" alt="Card back" /></div>
    </div>`;
  }).join("");

  // How far the arc dips below its own edges (the two ends of the smile).
  const dip = DECK_RADIUS * (1 - Math.cos((DECK_MAX_ANGLE * Math.PI) / 180));
  const margin = 10;
  const bandHeight = Math.ceil(dip + DECK_CARD_HEIGHT + margin * 2);
  const bandWidth =
    2 * DECK_RADIUS * Math.sin((DECK_MAX_ANGLE * Math.PI) / 180) +
    DECK_CARD_WIDTH +
    20;
  // Position the shared pivot so the fan's lowest point clears the band's
  // bottom edge by `margin`, and its highest points clear the top by `margin`.
  const pivotOffset = Math.round(
    bandHeight - DECK_RADIUS - DECK_CARD_HEIGHT - margin,
  );

  area.innerHTML = `<div class="deck-band" style="height:${bandHeight}px; width:${bandWidth}px; --pivot-offset:${pivotOffset}px">${cards}</div>`;
};

const drawNextCard = (el) => {
  if (placedCount >= activeCards.length) return;
  const idx = placedCount;
  const slot = document.querySelector(`#card-grid [data-slot="${idx}"]`);
  if (!slot) return;

  const startRect = el.getBoundingClientRect();
  el.remove();
  placedCount++;
  renderDeckBand();
  renderDrawModePicker();
  saveReadingState(); // capture placedCount right away, not just once the flight animation ends

  const { card } = activeCards[idx];
  const name = titleCase(card.name);
  const flyer = document.createElement("div");
  flyer.className = "tarot-card flying";
  flyer.innerHTML = `
    <div class="card-flip">
      <div class="card-flip-inner">
        <div class="card-face card-back">
          <div class="card-frame"><img src="${cardBackImage()}" alt="Card back" /></div>
        </div>
        <div class="card-face card-front">
          <div class="card-frame"><img src="${cardImage(card)}" alt="${name}" /></div>
        </div>
      </div>
    </div>`;
  flyer.style.left = `${startRect.left}px`;
  flyer.style.top = `${startRect.top}px`;
  flyer.style.width = `${startRect.width}px`;
  document.body.appendChild(flyer);

  const targetRect = slot.getBoundingClientRect();
  flyer.getBoundingClientRect(); // force layout before animating
  setTimeout(() => {
    flyer.style.left = `${targetRect.left}px`;
    flyer.style.top = `${targetRect.top}px`;
    flyer.style.width = `${targetRect.width}px`;
  }, 20);

  const finishFlight = () => {
    flyer.remove();
    slot.outerHTML = cardMarkup(idx);
    updateNextHighlight();
    renderInterpretBar(); // "Reveal Cards" becomes available once the last card lands
    scheduleAlign(
      document.querySelector(`#card-grid .tarot-card[data-index="${idx}"]`),
    );
    saveReadingState();
  };
  flyer.addEventListener("transitionend", function onEnd(e) {
    if (e.propertyName !== "left") return;
    flyer.removeEventListener("transitionend", onEnd);
    finishFlight();
  });
  setTimeout(() => {
    if (flyer.isConnected) finishFlight();
  }, 700);
};

const renderList = (items) =>
  `<ul>${items.map((t) => `<li>${t}</li>`).join("")}</ul>`;

const cardDetailMarkup = (card, position) => {
  const name = titleCase(card.name);
  const fortune = pickOne(card.fortune_telling);
  return `
    <button type="button" class="detail-close" onclick="closeDetail()" aria-label="Close">&times;</button>
    <div class="detail-header">
      <div class="card-frame">
        <img src="${cardImage(card)}" alt="${name}" />
      </div>
      <div>
        <h3>${name}</h3>
        <div class="detail-position">${position}</div>
        <div class="keywords">
          ${card.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}
        </div>
      </div>
    </div>
    <h4>Meaning</h4>
    ${renderList(card.meanings_light)}
    <h4>Fortune telling</h4>
    <p class="fortune">${fortune}</p>
    <p class="detail-credit">
      Meanings adapted from Mark McElroy's
      <a href="http://www.madebymark.com/a-guide-to-tarot-card-meanings/" target="_blank" rel="noopener">A Guide to Tarot Card Meanings</a>.
      <br />Card images: Rider-Waite-Smith deck, illustrated by Pamela Colman Smith (1909, published by Rider &amp; Co.; public domain).
    </p>
  `;
};

const renderDetail = () => {
  const panel = document.getElementById("card-detail");
  if (!panel || activeIndex < 0 || !activeCards[activeIndex]) return;
  const { card, position } = activeCards[activeIndex];
  panel.innerHTML = cardDetailMarkup(card, position);
};

// A card picked (but not yet dealt) in "Enter Drawing" isn't in activeCards
// yet -- its real card lives only in that row's dropdown -- so clicking its
// thumbnail or its live preview on the cross reads the card straight off
// the row instead of going through the normal reveal flow.
const showEntryCardDetail = (i) => {
  const row = document.querySelector(`.entry-row[data-row="${i}"]`);
  const value = row?.querySelector(".entry-card")?.value;
  if (!value) return;
  const [suitStr, rankStr] = value.split("|");
  const suit = Number(suitStr);
  const card = tarotCardsData.find(
    (c) => c.suit === suit && String(c.rank) === rankStr,
  );
  if (!card) return;
  const panel = document.getElementById("card-detail");
  if (panel)
    panel.innerHTML = cardDetailMarkup(card, SPREADS.celtic.positions[i]);
  openDetail();
};

const renderInterpretBar = () => {
  const elem = document.getElementById("interpret-bar");
  if (!elem) return;
  if (!activeCards.length || placedCount < activeCards.length) {
    elem.innerHTML = "";
    return;
  }
  const allRevealed = revealedCount >= activeCards.length;
  const primary = allRevealed
    ? `<button type="button" class="interpret-btn" onclick="toggleInterpretation()">
        ${interpretMode ? "Back to Spread" : "Interpret Reading"}
      </button>`
    : `<button type="button" class="interpret-btn" onclick="revealAll()"${
        revealTimer ? " disabled" : ""
      }>
        Reveal Cards
      </button>`;
  elem.innerHTML = `
    ${primary}
    <button type="button" class="interpret-btn" onclick="newReading()">
      New Reading
    </button>`;
};

// Turns every remaining card face-up, one at a time in cross order.
const REVEAL_DELAY_MS = 800;
let revealTimer = null;

const stopReveal = () => {
  if (revealTimer) {
    clearInterval(revealTimer);
    revealTimer = null;
  }
};

const revealAll = () => {
  if (revealTimer || placedCount < activeCards.length) return;
  if (revealedCount >= activeCards.length) return;
  closeDetail();

  const step = () => {
    if (revealedCount < activeCards.length) {
      const i = revealedCount;
      revealedCount++;
      document
        .querySelector(
          `#card-grid .tarot-card[data-index="${i}"] .card-flip-inner`,
        )
        ?.classList.add("flipped");
      updateNextHighlight();
      saveReadingState();
    }
    if (revealedCount >= activeCards.length) {
      stopReveal();
      renderInterpretBar();
    }
  };

  revealTimer = setInterval(step, REVEAL_DELAY_MS);
  renderInterpretBar(); // shows the button disabled while cards turn
  step();
};

// Starts over with a fresh reading in the same draw mode the current one
// used (for "Enter Drawing" that also means an empty form, not the old
// draft).
const newReading = () => {
  if (drawMode === "enter") {
    clearEntryDraft();
    startReading("enter");
  } else startReading("click");
};

const interpretCardTile = (i) => {
  const { card, position } = activeCards[i];
  const name = titleCase(card.name);
  const firstLine = card.meanings_light?.[0] || "";
  return `
    <div class="interpret-card" data-index="${i}" onclick="selectInterpretCard(${i})">
      <div class="card-frame"><img src="${cardImage(card)}" alt="${name}" /></div>
      <div class="interpret-card-info">
        <div class="interpret-card-position">${position}</div>
        <div class="interpret-card-name">${name}</div>
        <div class="keywords">
          ${card.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}
        </div>
        <p class="interpret-card-line">${firstLine}</p>
      </div>
    </div>`;
};

const renderInterpretation = () => {
  const elem = document.getElementById("interpretation-view");
  if (!elem) return;
  elem.innerHTML = INTERPRETATION_SECTIONS.map((section) => {
    const indexes = section.positions
      .map((pos) => activeCards.findIndex((entry) => entry.position === pos))
      .filter((i) => i !== -1);
    if (!indexes.length) return "";
    return `
      <div class="interpret-section">
        <h3>${section.title}</h3>
        <div class="interpret-row">
          ${indexes.map(interpretCardTile).join("")}
        </div>
      </div>`;
  }).join("") + `
    <p class="interpret-credit">
      Meanings adapted from Mark McElroy's
      <a href="http://www.madebymark.com/a-guide-to-tarot-card-meanings/" target="_blank" rel="noopener">A Guide to Tarot Card Meanings</a>.
      <br />Card images: Rider-Waite-Smith deck, illustrated by Pamela Colman Smith (1909, published by Rider &amp; Co.; public domain).
    </p>`;
};

const selectInterpretCard = (i) => {
  selectCard(i);
  document
    .querySelectorAll("#interpretation-view .interpret-card.active")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelector(`#interpretation-view .interpret-card[data-index="${i}"]`)
    ?.classList.add("active");
};

const FLIP_MS = 500;

// Classic FLIP transition: `destFrameFor(i)` hands back a card frame that
// is already sitting in its real, final DOM position (the interpretation
// tile, or the cross slot -- whichever the caller just switched to). This
// visually rewinds it to where `srcRectFor(i)` says it used to be, then
// lets it ease back to its true spot on the very next frame. All ten
// cards move as themselves, all at once -- there's no cloned "flyer" and
// nothing needs to be hidden or shown to pull it off, since it's the real
// elements sliding into place.
const flipCards = (srcRectFor, destFrameFor, onComplete) => {
  const flips = [];
  for (let i = 0; i < activeCards.length; i++) {
    const srcRect = srcRectFor(i);
    const destFrame = destFrameFor(i);
    if (!srcRect || !destFrame) continue;

    const destRect = destFrame.getBoundingClientRect();
    if (!destRect.width || !destRect.height) continue;

    const dx = srcRect.left - destRect.left;
    const dy = srcRect.top - destRect.top;
    const sx = srcRect.width / destRect.width;
    const sy = srcRect.height / destRect.height;

    // The Present/Challenge crossing card sits inside an ancestor that's
    // permanently rotated 90deg to form the cross. A translate/scale
    // injected on an element inside a rotated ancestor gets carried along
    // by that rotation, so for that one card the vector has to be rotated
    // -90deg first (x,y -> y,-x) to land on screen where it's meant to.
    const rotated = !!destFrame.closest(".tarot-card.crossing");
    const tx = rotated ? dy : dx;
    const ty = rotated ? -dx : dy;
    const scaleX = rotated ? sy : sx;
    const scaleY = rotated ? sx : sy;

    destFrame.style.transformOrigin = "0 0";
    destFrame.style.transition = "none";
    destFrame.style.transform = `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`;
    flips.push(destFrame);
  }

  if (!flips.length) {
    onComplete?.();
    return;
  }

  flips.forEach((f) => f.getBoundingClientRect()); // force layout before animating away from the inverted state

  requestAnimationFrame(() => {
    flips.forEach((f) => {
      f.style.transition = `transform ${FLIP_MS}ms ease`;
      f.style.transform = "none";
    });
  });

  setTimeout(() => {
    flips.forEach((f) => {
      f.style.transition = "";
      f.style.transform = "";
      f.style.transformOrigin = "";
    });
    onComplete?.();
  }, FLIP_MS + 60);
};

const toggleInterpretation = () => {
  const grid = document.getElementById("card-grid");
  const view = document.getElementById("interpretation-view");
  if (!grid || !view) return;
  closeDetail();

  if (!interpretMode) {
    // Measure where each card's art sits in the cross right now, switch
    // straight over to the interpretation view, then FLIP its real
    // (already-final) tiles back to those cross positions.
    const srcRects = activeCards.map(
      (_, i) =>
        grid
          .querySelector(
            `.tarot-card[data-index="${i}"] .card-face.card-front .card-frame`,
          )
          ?.getBoundingClientRect() || null,
    );
    interpretMode = true;
    renderInterpretation();
    grid.classList.add("hidden");
    view.classList.add("open");
    renderInterpretBar();

    // Text starts hidden/shifted under the card art; only once the cards
    // have finished flying into place does it slide out from their left.
    // The cards themselves start only as wide as their art and widen as
    // the text comes out.
    view
      .querySelectorAll(".interpret-card, .interpret-card-info")
      .forEach((el) => el.classList.add("pending"));

    flipCards(
      (i) => srcRects[i],
      (i) =>
        view.querySelector(`.interpret-card[data-index="${i}"] .card-frame`),
      () => {
        view
          .querySelectorAll(
            ".interpret-card.pending, .interpret-card-info.pending",
          )
          .forEach((el) => el.classList.remove("pending"));
      },
    );
  } else {
    // The spread's cards never left the DOM (toggling only ever hid the
    // grid), so measure the interpretation tiles now, switch back, then
    // FLIP the real cross cards back from those interpretation positions.
    const srcRects = activeCards.map(
      (_, i) =>
        view
          .querySelector(`.interpret-card[data-index="${i}"] .card-frame`)
          ?.getBoundingClientRect() || null,
    );
    interpretMode = false;
    grid.classList.remove("hidden");
    view.classList.remove("open");
    renderInterpretBar();

    flipCards(
      (i) => srcRects[i],
      (i) =>
        grid.querySelector(
          `.tarot-card[data-index="${i}"] .card-face.card-front .card-frame`,
        ),
    );
  }
};

const openDetail = () => {
  document.getElementById("card-detail")?.classList.add("open");
  document.getElementById("detail-overlay")?.classList.add("open");
};

const closeDetail = () => {
  document.getElementById("card-detail")?.classList.remove("open");
  document.getElementById("detail-overlay")?.classList.remove("open");
  // No panel, no selection: drop the highlight on the card it was showing
  // (in the spread and in the interpretation view).
  activeIndex = -1;
  document
    .querySelectorAll(".tarot-card.active, .interpret-card.active")
    .forEach((el) => el.classList.remove("active"));
};

const showPositionInfo = (e, position) => {
  e.stopPropagation();
  const panel = document.getElementById("card-detail");
  if (!panel) return;
  const meaning = POSITION_MEANINGS[position] || "";
  document
    .querySelectorAll("#card-grid .tarot-card.active")
    .forEach((el) => el.classList.remove("active"));
  panel.innerHTML = `
    <button type="button" class="detail-close" onclick="closeDetail()" aria-label="Close">&times;</button>
    <h3>${position}</h3>
    <p class="position-meaning">${meaning}</p>
  `;
  openDetail();
};

const updateNextHighlight = () => {
  document
    .querySelectorAll("#card-grid .tarot-card.next-up")
    .forEach((el) => el.classList.remove("next-up"));
  const allPlaced = placedCount >= activeCards.length;
  const allRevealed = revealedCount >= activeCards.length;
  if (!allPlaced || allRevealed) return;
  document
    .querySelector(`#card-grid .tarot-card[data-index="${revealedCount}"]`)
    ?.classList.add("next-up");
};

const selectCard = (i) => {
  if (i > revealedCount) return; // cards reveal one by one, in cross order
  if (i === revealedCount) revealedCount++;

  activeIndex = i;
  document
    .querySelectorAll("#card-grid .tarot-card.active")
    .forEach((el) => el.classList.remove("active"));
  const cardEl = document.querySelector(
    `#card-grid .tarot-card[data-index="${i}"]`,
  );
  cardEl?.classList.add("active");
  cardEl?.querySelector(".card-flip-inner")?.classList.add("flipped");
  renderDetail();
  openDetail();
  renderInterpretBar();
  updateNextHighlight();
  saveReadingState();
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetail();
});

// Close the detail panel on any click that isn't on a card (in the cross or
// in the interpretation view), a position label, or inside the panel itself
// -- clicking empty space in the cross, the deck, filters, etc. dismisses
// it, but switching cards or reading a position's meaning doesn't.
document.addEventListener("click", (e) => {
  if (!document.getElementById("card-detail")?.classList.contains("open"))
    return;
  if (
    e.target.closest(".tarot-card") ||
    e.target.closest(".tarot-card-position") ||
    e.target.closest(".interpret-card") ||
    e.target.closest(".card-detail")
  )
    return;
  closeDetail();
});

window.addEventListener("resize", () => alignCrossingCard());

const initTarot = () => {
  renderDrawModePicker();
  if (restoreReadingState()) return;

  const draft = loadEntryDraft();
  if (draft && draft.some((row) => row.value)) {
    startReading("enter");
    return;
  }

  startReading("click");
};
