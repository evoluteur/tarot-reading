#!/usr/bin/env node
// Generates the static tarot card pages: tarot-cards/<id>.html (one per card)
// and tarot-cards/index.html (all 78), plus sitemap.xml and robots.txt.
//
//   node scripts/build-card-pages.js
//
// Card data comes from js/tarot-data.js and the image names from js/tarot.js
// (the same files the app uses). The pages are plain HTML so search engines
// can read them without running any JavaScript; re-run the script after
// editing the data, and commit the generated files.
//
// datePublished is kept from the existing page, and dateModified / sitemap
// lastmod only move when a page's content actually changes.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const SITE = "https://evoluteur.github.io/tarot-reading/";

// the GitHub link markup is taken from index.html so the two stay identical
// (\s tolerates the line breaks a code formatter may add inside the tag)
const GITHUB_LINK = fs
  .readFileSync(path.join(root, "index.html"), "utf8")
  .match(/<a\s[^>]*id="omg-github"[\s\S]*?<\/a>/)?.[0];
if (!GITHUB_LINK)
  throw new Error('index.html has no <a id="omg-github"> link to copy');
const DIR = "tarot-cards";
const TODAY = new Date().toISOString().slice(0, 10);

const ctx = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.join(root, "js/tarot-data.js"), "utf8"),
  ctx,
);
// only the constants at the top of tarot.js are needed (image names)
const appJs = fs.readFileSync(path.join(root, "js/tarot.js"), "utf8");
vm.runInContext(appJs.slice(0, appJs.indexOf("const SPREADS")), ctx);
const {
  tarotCardsData,
  MAJOR_IMAGES,
  CARD_IMAGES_DIR,
  SUIT_FOLDERS,
  COURT_RANKS,
} = vm.runInContext(
  "({ tarotCardsData, MAJOR_IMAGES, CARD_IMAGES_DIR, SUIT_FOLDERS, COURT_RANKS })",
  ctx,
);

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const titleCase = (s) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/ Of /g, " of ");
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const listText = (arr) =>
  arr.length < 2
    ? arr.join("")
    : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;

// ---------------------------------------------------------------- card model

const ROMAN = [
  "0",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
  "XXI",
];
const NUMBER_WORDS = [
  "",
  "Ace",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];

// Names the data keeps short or doubled ("The Papess/High Priestess"): the
// page uses the common Rider-Waite-Smith name and mentions the other one.
const MAJOR_NAMES = {
  "The Papess/High Priestess": ["The High Priestess", "The Papess"],
  "The Pope/Hierophant": ["The Hierophant", "The Pope"],
  "The Wheel": ["Wheel of Fortune", "The Wheel"],
};

const SUITS = {
  1: { key: "major", name: "Major Arcana", count: 22 },
  2: {
    key: "wands",
    name: "Wands",
    element: "Fire",
    domain: "energy, drive, ambition and creative work",
  },
  3: {
    key: "cups",
    name: "Cups",
    element: "Water",
    domain: "feelings, love, relationships and intuition",
  },
  4: {
    key: "swords",
    name: "Swords",
    element: "Air",
    domain: "thought, words, conflict and decisions",
  },
  5: {
    key: "coins",
    name: "Coins",
    alt: "Pentacles",
    element: "Earth",
    domain: "money, work, the body and the material world",
  },
};
const SUIT_ORDER = [1, 2, 3, 4, 5];

// what each rank adds to its suit (general tarot numerology, written for this project)
const RANK_NOTES = {
  1: "Aces are seeds: the pure, raw gift of the suit, a fresh start or an opening.",
  2: "Twos are about pairs and balance: a choice, a partnership or two forces to weigh.",
  3: "Threes are early growth: first results, collaboration and something taking shape.",
  4: "Fours bring stability: structure, rest and consolidation, sometimes to the point of standing still.",
  5: "Fives are disruption: loss, conflict or a challenge that breaks the calm of the four.",
  6: "Sixes are harmony regained: sharing, recovery and moving past the trouble of the five.",
  7: "Sevens are tests: assessment, perseverance and choices about what really matters.",
  8: "Eights are movement and mastery: effort, speed and the results of practice.",
  9: "Nines are near completion: the suit at its fullest, for better or for worse.",
  10: "Tens are endings and fulfilment: a cycle complete, with its rewards or its burdens.",
  page: "Pages are students and messengers: curiosity, news and the suit's energy at its most youthful.",
  knight:
    "Knights are action and pursuit: the suit's energy on the move, sometimes to excess.",
  queen:
    "Queens hold the suit from within: mature, caring and in command of its energy.",
  king: "Kings master the suit outwardly: authority, responsibility and control of its energy.",
};

const cardImage = (c) => {
  if (c.suit === 1) return `${CARD_IMAGES_DIR}/${MAJOR_IMAGES[c.rank]}.jpg`;
  const n = typeof c.rank === "number" ? c.rank : COURT_RANKS[c.rank];
  return `${CARD_IMAGES_DIR}/${SUIT_FOLDERS[c.suit]}${String(n).padStart(2, "0")}.jpg`;
};

const cards = SUIT_ORDER.flatMap((s) =>
  tarotCardsData.filter((c) => c.suit === s),
).map((c) => {
  const suit = SUITS[c.suit];
  let name, altName, rankLabel;
  if (c.suit === 1) {
    [name, altName] = MAJOR_NAMES[c.name] || [c.name];
    rankLabel = ROMAN[c.rank];
  } else {
    name = titleCase(c.name);
    const r =
      typeof c.rank === "number" ? NUMBER_WORDS[c.rank] : titleCase(c.rank);
    altName = suit.alt ? `${r} of ${suit.alt}` : null;
    rankLabel = r;
  }
  return {
    ...c,
    name,
    altName,
    rankLabel,
    suitInfo: suit,
    id: slug(name),
    img: cardImage(c),
  };
});
if (cards.length !== 78)
  throw new Error(`expected 78 cards, got ${cards.length}`);

// ---------------------------------------------------------------- page parts

const head = ({
  title,
  description,
  url,
  image,
  ogType = "article",
  jsonld,
}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-063933E3C2"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag("js", new Date());
      gtag("config", "G-063933E3C2");
    </script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="author" content="Olivier Giulieri" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" type="image/png" href="../favicon.png" />
    <meta name="theme-color" content="#1a212d" />
    <meta property="og:site_name" content="Tarot Reading" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
    </script>

    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Overpass" />
    <link id="omg-core-css" rel="stylesheet" href="../css/core.css" />
    <script>
      // Themes (dark, light, evol-blue) are copies of omg-themes; the base is "../" because this page is in ${DIR}/.
      window.OMG_THEMES_BASE = "../";
      window.OMG_DEFAULT_THEME = "dark";
      (function () {
        var t = window.OMG_DEFAULT_THEME;
        try {
          t = localStorage.getItem("omg-theme") || t;
        } catch (e) {}
        if (t !== "dark" && t !== "light" && t !== "evol-blue") t = window.OMG_DEFAULT_THEME;
        document.documentElement.setAttribute("data-theme", t);
        // written here (not in the markup) so the saved theme loads before first paint
        document.write(
          '<link id="omg-theme-css" rel="stylesheet" href="' + window.OMG_THEMES_BASE + "css/themes/" + t + "/" + t + '.css" />',
        );
      })();
    </script>
    <link id="omg-density-css" rel="stylesheet" href="../css/densities.css" />
    <link rel="stylesheet" href="../css/overrides.css" />
    <link rel="stylesheet" href="../css/tarot.css" />
    <link rel="stylesheet" href="../css/about.css" />
    <link rel="stylesheet" href="../css/card-page.css" />

    <script src="../js/omg.js"></script>
  </head>
`;

const header = () => `
  <body onload="setupPage('card');" id="omg-body">
    <div id="omg-header">
      <h1><a href="../index.html">Tarot Reading</a></h1>
      <div id="omg-theme-picker"></div>
      ${GITHUB_LINK}
    </div>`;

const footer = () => `
      <div class="footer">
        <p><a href="../index.html">Draw a tarot reading</a> · <a href="index.html">All 78 cards</a> · <a href="../about.html">About tarot</a></p>
        <p>Card meanings adapted from Mark McElroy's <em>A Guide to Tarot Card Meanings</em>. Deck: Rider-Waite-Smith, illustrated by Pamela Colman Smith (1909).</p>
        <p>
          Tarot Reading is open source on
          <a href="https://github.com/evoluteur/tarot-reading">GitHub</a>
          with an MIT license. Had fun browsing the app?
          <a href="https://github.com/sponsors/evoluteur">Buy me a coffee by becoming a sponsor</a>.
        </p>
        <p>
          You may also enjoy other readings like <a href="https://evoluteur.github.io/i-ching-reading/">I Ching</a>, <a href="https://evoluteur.github.io/rune-reading/">Runes</a>, <a href="https://evoluteur.github.io/tibetan-mo-reading/">Tibetan Mo</a>, and <a href="https://evoluteur.github.io/motivational-numerology/">Numerology</a>. For more mystic arts as small web apps, see
          <a href="https://evoluteur.github.io/esoterica.html">Esoterica</a>.
        </p>
        <p class="copyright">
          &#169; 2026
          <a href="https://evoluteur.github.io/">Olivier Giulieri</a>
        </p>
      </div>
    </div>
  </body>
</html>
`;

const author = {
  "@type": "Person",
  name: "Olivier Giulieri",
  url: "https://evoluteur.github.io/",
};
const breadcrumb = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, url], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item: url,
  })),
});
const website = { "@type": "WebSite", name: "Tarot Reading", url: SITE };

const thumb = (c, cls = "card-thumb") =>
  `<img class="${cls}" src="../${c.img}" alt="${esc(c.name)}" width="60" height="103" loading="lazy" />`;
const cardChip = (c, current) =>
  `<li><a class="card-pick${current ? " current" : ""}" href="${c.id}.html"${
    current ? ' aria-current="page"' : ""
  }>${thumb(c)}<span class="cn">${c.name}</span></a></li>`;
const ul = (items) => `<ul>
        ${items.map((t) => `<li>${t}</li>`).join("\n        ")}
      </ul>`;

// ---------------------------------------------------------------- one card

const cardPage = (c, i) => {
  const s = c.suitInfo;
  const major = c.suit === 1;
  const siblings = cards.filter((o) => o.suit === c.suit);
  const prev = cards[i - 1];
  const next = cards[i + 1];
  const url = `${SITE}${DIR}/${c.id}.html`;
  // previous / next links, shown under the title and again at the bottom
  const cardNav = (
    where,
  ) => `<nav class="card-nav ${where}" aria-label="Previous and next card${where === "top" ? " (top)" : ""}">
        <span>${prev ? `<a href="${prev.id}.html" rel="prev">← ${prev.name}</a>` : ""}</span>
        <a href="index.html">All 78 cards</a>
        <span>${next ? `<a href="${next.id}.html" rel="next">${next.name} →</a>` : ""}</span>
      </nav>`;
  const alsoTitle = c.altName ? ` (${c.altName})` : "";
  const title = `${c.name}${alsoTitle} Tarot Card Meaning | Tarot Reading`;
  const kw = listText(c.keywords);
  const description = major
    ? `${c.name} (${c.rankLabel}) is card ${c.rank} of the 22 Major Arcana in the Rider-Waite-Smith tarot: ${kw}. Its upright and shadow meanings, and what it foretells.`
    : `${c.name}${alsoTitle} is a Minor Arcana tarot card of the suit of ${s.name} (${s.element}): ${kw}. Its upright and shadow meanings, and what it foretells.`;
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: `${c.name} tarot card meaning`,
        description,
        url,
        mainEntityOfPage: url,
        inLanguage: "en",
        about: `The ${c.name} tarot card`,
        keywords: [
          c.name,
          `${c.name} tarot`,
          c.altName,
          s.name,
          "tarot card meaning",
          ...c.keywords,
        ]
          .filter(Boolean)
          .join(", "),
        image: `${SITE}${c.img}`,
        datePublished: "%DATE_PUBLISHED%",
        dateModified: "%DATE_MODIFIED%",
        author,
        isPartOf: website,
      },
      breadcrumb([
        ["Tarot Reading", SITE],
        ["The 78 tarot cards", `${SITE}${DIR}/`],
        [c.name, url],
      ]),
    ],
  };
  const facts = major
    ? `Major Arcana · ${c.rankLabel}`
    : `Minor Arcana · ${s.name} · ${s.element}${c.altName ? ` · also ${c.altName}` : ""}`;
  const lede = major
    ? `${c.name}${c.altName ? ` (also called ${c.altName})` : ""} is card ${c.rankLabel} of the 22 Major Arcana, the trump cards of the tarot that stand for the big turning points and archetypes of a life. Its keywords are ${kw}.`
    : `${c.name}${c.altName ? ` (also called the ${c.altName})` : ""} is one of the 14 cards of the suit of ${s.name}, the suit of ${s.element} in the Minor Arcana, which speaks of ${s.domain}. Its keywords are ${kw}.`;
  const anatomy = major
    ? `<dt>Card</dt><dd>${c.rankLabel} ${c.name}</dd>
        ${c.altName ? `<dt>Also called</dt><dd>${c.altName}</dd>` : ""}
        <dt>Arcana</dt><dd>Major Arcana, card ${c.rank} of 22 (0 to XXI)</dd>
        <dt>Keywords</dt><dd>${kw}</dd>`
    : `<dt>Card</dt><dd>${c.name}</dd>
        ${c.altName ? `<dt>Also called</dt><dd>${c.altName}</dd>` : ""}
        <dt>Arcana</dt><dd>Minor Arcana</dd>
        <dt>Suit</dt><dd>${s.name}${s.alt ? ` (${s.alt})` : ""}: ${s.domain}</dd>
        <dt>Element</dt><dd>${s.element}</dd>
        <dt>Rank</dt><dd>${c.rankLabel}: ${lc(RANK_NOTES[c.rank])}</dd>
        <dt>Keywords</dt><dd>${kw}</dd>`;
  return (
    head({ title, description, url, image: `${SITE}${c.img}`, jsonld }) +
    header() +
    `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="../index.html">Tarot Reading</a> › <a href="index.html">The 78 cards</a> › ${c.name}</nav>
    <h2 class="card-title">${c.name} tarot card meaning</h2>
    <div class="content about card-page">
      ${cardNav("top")}

      <div class="card-hero">
        <img class="card-figure" src="../${c.img}" alt="${esc(c.name)} tarot card (Rider-Waite-Smith)" width="120" height="206" />
        <div>
          <p class="card-facts">${facts}</p>
          <div class="keywords">${c.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>
        </div>
      </div>

      <p class="lede">${lede}</p>

      <h3>${c.name} upright meaning</h3>
      <p>In the light, ${c.name} points to:</p>
      ${ul(c.meanings_light)}

      <h3>${c.name} reversed or shadow meaning</h3>
      <p>In its shadow, drawn reversed or in a difficult position, ${c.name} can point to:</p>
      ${ul(c.meaning_shadow)}

      <h3>${c.name} in fortune telling</h3>
      ${ul(c.fortune_telling.map((t) => `<span class="fortune">${t}</span>`))}

      <h3>About the card</h3>
      <dl class="anatomy">
        ${anatomy}
      </dl>
      <p><button type="button" class="interpret-btn" onclick="location.href='../index.html'">Draw a Reading Now</button></p>

      <h3>${major ? "The other Major Arcana" : `The other cards of ${s.name}`}</h3>
      <ol class="card-chips">
        ${siblings.map((o) => cardChip(o, o === c)).join("\n        ")}
      </ol>

      ${cardNav("bottom")}
` +
    footer()
  );
};

// ---------------------------------------------------------------- hub

const hubPage = () => {
  const url = `${SITE}${DIR}/`;
  const title = "Tarot Card Meanings: All 78 Cards | Tarot Reading";
  const description =
    "The meaning of all 78 tarot cards of the Rider-Waite-Smith deck, from The Fool to the King of Coins: the 22 Major Arcana and the four suits of the Minor Arcana.";
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "The 78 tarot cards",
        description,
        url,
        inLanguage: "en",
        author,
        isPartOf: website,
        mainEntity: {
          "@type": "ItemList",
          itemListElement: cards.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.name,
            url: `${SITE}${DIR}/${c.id}.html`,
          })),
        },
      },
      breadcrumb([
        ["Tarot Reading", SITE],
        ["The 78 tarot cards", url],
      ]),
    ],
  };
  const sections = SUIT_ORDER.map((sk) => {
    const s = SUITS[sk];
    const intro =
      sk === 1
        ? "The 22 trump cards, numbered 0 to XXI: the archetypes and turning points of a life."
        : `The suit of ${s.element}${s.alt ? ` (also called ${s.alt})` : ""}: ${s.domain}.`;
    const list = cards
      .filter((c) => c.suit === sk)
      .map(
        (c) => `
        <li><a class="card-row" href="${c.id}.html">
          ${thumb(c, "card-thumb sm")}
          <span class="cr-text">
            <span class="cr-name">${c.suit === 1 ? `${c.rankLabel} · ` : ""}${c.name}</span>
            <span class="cr-line">${listText(c.keywords)}</span>
          </span>
        </a></li>`,
      )
      .join("");
    return `
      <h3 id="${s.key}">${s.name}</h3>
      <p class="note">${intro}</p>
      <ol class="card-list">${list}
      </ol>`;
  }).join("\n");
  return (
    head({
      title,
      description,
      url,
      image: `${SITE}tarot-reading.png`,
      ogType: "website",
      jsonld,
    }) +
    header() +
    `
    <h2>The 78 tarot cards</h2>
    <div class="content about card-page">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="../index.html">Tarot Reading</a> › The 78 cards</nav>
      <p class="lede">A tarot deck has 78 cards: 22 Major Arcana for the big themes of a life, and 56 Minor Arcana in four suits, Wands, Cups, Swords and Coins, for its everyday matters.</p>
      <p>Choose a card for its upright and shadow meaning and what it foretells. The pictures are from the Rider-Waite-Smith deck (1909). For a personal reading, <a href="../index.html">draw a Celtic Cross</a>; to learn how the deck is built and where it comes from, see <a href="../about.html">about tarot</a>.</p>
      <p class="suit-jump">${SUIT_ORDER.map((sk) => `<a href="#${SUITS[sk].key}">${SUITS[sk].name}</a>`).join(" · ")}</p>
      ${sections}
      <p><button type="button" class="interpret-btn" onclick="location.href='../index.html'">Draw a Reading Now</button></p>
` +
    footer()
  );
};

// ---------------------------------------------------------------- write

// Keeps datePublished from the existing file, and only bumps dateModified
// (returned, for the sitemap) when the page content changed.
const writePage = (file, html) => {
  let published = TODAY;
  let modified = TODAY;
  if (fs.existsSync(file)) {
    const old = fs.readFileSync(file, "utf8");
    const p = old.match(/"datePublished": "([\d-]+)"/);
    const m = old.match(/"dateModified": "([\d-]+)"/);
    if (p) published = p[1];
    if (m) {
      const same = html
        .replace("%DATE_PUBLISHED%", published)
        .replace("%DATE_MODIFIED%", m[1]);
      if (same === old) modified = m[1];
    }
  }
  fs.writeFileSync(
    file,
    html
      .replace("%DATE_PUBLISHED%", published)
      .replace("%DATE_MODIFIED%", modified),
  );
  return modified;
};
const writeIfChanged = (file, content) => {
  const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (old === content) return false;
  fs.writeFileSync(file, content);
  return true;
};

const outDir = path.join(root, DIR);
fs.mkdirSync(outDir, { recursive: true });

const ids = new Set();
const titles = new Set();
const descriptions = new Set();
const lastmod = {};
cards.forEach((c, i) => {
  if (ids.has(c.id)) throw new Error(`duplicate id ${c.id}`);
  ids.add(c.id);
  const html = cardPage(c, i);
  const t = html.match(/<title>(.*?)<\/title>/)[1];
  const d = html.match(/name="description" content="(.*?)"/)[1];
  if (titles.has(t) || descriptions.has(d))
    throw new Error(`duplicate title/description for ${c.id}`);
  titles.add(t);
  descriptions.add(d);
  lastmod[`${DIR}/${c.id}.html`] = writePage(
    path.join(outDir, `${c.id}.html`),
    html,
  );
});
const hubFile = path.join(outDir, "index.html");
lastmod[`${DIR}/`] = writeIfChanged(hubFile, hubPage()) ? TODAY : null;

// sitemap: keep the old lastmod of any URL whose page did not change
const sitemapFile = path.join(root, "sitemap.xml");
const oldSitemap = fs.existsSync(sitemapFile)
  ? fs.readFileSync(sitemapFile, "utf8")
  : "";
const oldLastmod = (u) =>
  oldSitemap.match(
    new RegExp(
      `<loc>${SITE}${u.replace(/[.]/g, "\\.")}</loc>\\s*<lastmod>([\\d-]+)`,
    ),
  )?.[1];
const urls = [
  ["", "1.0"],
  [`${DIR}/`, "0.9"],
  ["about.html", "0.7"],
  ...cards.map((c) => [`${DIR}/${c.id}.html`, "0.8"]),
];
writeIfChanged(
  sitemapFile,
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ([u, p]) => `  <url>
    <loc>${SITE}${u}</loc>
    <lastmod>${lastmod[u] && lastmod[u] !== null ? lastmod[u] : oldLastmod(u) || TODAY}</lastmod>
    <priority>${p}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`,
);
writeIfChanged(
  path.join(root, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`,
);

const lens = [...descriptions].map((d) => d.length);
console.log(
  `${cards.length} card pages + hub + sitemap.xml + robots.txt; description length ${Math.min(...lens)}-${Math.max(...lens)}`,
);
