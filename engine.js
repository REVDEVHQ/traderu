// engine.js - Trader U Degen Engine
// UPDATED: intents/synonyms, identity FAQ, menu variants + cooldown,
// tracked wallets w/ alert toggles, safer matching,
// mediaLibrary support (auto-links relevant screenshots),
// bilingual (EN/ES) light support

function normalize(text) {
  return (text || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isQuestion(text) {
  const t = (text || "").toString().trim();
  return t.includes("?") || /^(who|what|why|how|when|where)\b/i.test(t);
}

function containsAny(text, phrases = []) {
  const t = normalize(text);
  return phrases.some((p) => t.includes(normalize(p)));
}

function containsGreeting(text, config) {
  return containsAny(text, config.greetingKeywords || []);
}

/**
 * Intent dictionary (expand over time).
 * Keep phrases short; normalize() handles whitespace.
 */
const INTENTS = {
  MENU: ["menu", "options", "help menu", "start over", "show options"],

  IDENTITY: [
    "who is chepe",
    "who's chepe",
    "whos chepe",
    "who is trader u",
    "what is trader u",
    "what's trader u",
    "whats trader u",
    "what is this",
    "who are you",
    "are you trader u",
    "is this paid",
    "what do you teach"
  ],

  FILTERS: ["filter", "filters", "axiom filter", "pulse", "import", "json", "new pairs", "final stretch", "migrated"],

  SETTINGS: [
    "settings",
    "setting",
    "slippage",
    "tp",
    "take profit",
    "stop loss",
    "stoploss",
    "trailing",
    "trailing stop",
    "advanced strategy",
    "sell settings",
    "buy settings",
    "fees"
  ],

  RUG: [
    "rug",
    "rugpull",
    "scam",
    "honeypot",
    "bundled",
    "bundle",
    "can't sell",
    "cant sell",
    "sell failed",
    "dev dumped",
    "lp pulled",
    "liquidity removed",
    "death star",
    "bubble map"
  ],

  GOODCOIN: ["good coin", "good project", "safe coin", "find coin", "entry", "good entry", "what to buy"],

  RISK: ["risk", "position size", "sizing", "manage risk", "cut loss", "loss", "drawdown"],

  LIQUIDITY: ["liq", "liquidity", "lp", "lp lock", "locked", "lock", "unlock", "remove liquidity"],

  LINKS: ["refer", "referral", "link", "links", "axiom link", "nova link", "padre link", "youtube", "tiktok", "instagram"],

  VOLUME: ["volume", "buys", "transactions", "txns", "5min", "5 min"],

  CA: ["ca", "contract address", "contract", "token address"],

  WORKFLOW: ["workflow", "ape", "scan", "watch", "ape scan watch"],

  TRACKED_WALLETS: [
    "tracked wallets",
    "tracked wallet",
    "wallet tracking",
    "track wallets",
    "tracked",
    "wallets",
    "alerts",
    "alert",
    "follow wallet"
  ]
};

function detectIntent(userMessage) {
  const msg = normalize(userMessage);

  if (containsAny(msg, INTENTS.MENU)) return "MENU";

  if (
    containsAny(msg, INTENTS.IDENTITY) ||
    (isQuestion(msg) && containsAny(msg, ["chepe", "trader u", "traderu"]))
  ) return "IDENTITY";

  if (containsAny(msg, INTENTS.FILTERS)) return "FILTERS";
  if (containsAny(msg, INTENTS.SETTINGS)) return "SETTINGS";
  if (containsAny(msg, INTENTS.RUG)) return "RUG";
  if (containsAny(msg, INTENTS.GOODCOIN)) return "GOODCOIN";
  if (containsAny(msg, INTENTS.RISK)) return "RISK";
  if (containsAny(msg, INTENTS.LIQUIDITY)) return "LIQUIDITY";
  if (containsAny(msg, INTENTS.LINKS)) return "LINKS";
  if (containsAny(msg, INTENTS.VOLUME)) return "VOLUME";
  if (containsAny(msg, INTENTS.CA)) return "CA";
  if (containsAny(msg, INTENTS.WORKFLOW)) return "WORKFLOW";
  if (containsAny(msg, INTENTS.TRACKED_WALLETS)) return "TRACKED_WALLETS";

  return "FALLBACK";
}

function shouldRespond(userMessage, state, config) {
  if (!config.speakOnlyAfterGreeting) return true;

  const strict = !!config.strictHelloOnlyMode;

  // Non-strict: allow questions through even before greeting
  if (!strict && isQuestion(userMessage)) return true;

  return !!state.greeted || containsGreeting(userMessage, config);
}

function nextState(userMessage, state, config) {
  const greeted = state.greeted || containsGreeting(userMessage, config);

  // menuCooldown prevents repeating menu on every message after greeting
  const menuCooldown = Math.max(0, (state.menuCooldown || 0) - 1);

  return {
    ...state,
    greeted,
    onboardingStage: greeted ? state.onboardingStage : 0,
    menuCooldown
  };
}

// -------------------- MEDIA LIBRARY (SCREENSHOTS) --------------------

function getMediaItems(knowledgeBase) {
  const lib = knowledgeBase.mediaLibrary || {};
  const items = lib.items || knowledgeBase.mediaLibraryItems || [];
  return Array.isArray(items) ? items : [];
}

function scoreMediaItem(item, msg, intent) {
  // Simple scoring so the most relevant screenshots show first.
  // You can tune this over time.
  let score = 0;
  const text = normalize(msg);

  // Intent-based boosts
  const intentBoost = {
    SETTINGS: ["stoploss", "stop loss", "trailing", "tp", "slippage", "settings"],
    VOLUME: ["volume", "buys", "txns"],
    RUG: ["rug", "bundles", "bubble", "death star", "can't sell", "cant sell"],
    WORKFLOW: ["ape", "scan", "watch"],
    FILTERS: ["axiom", "filters", "pulse"]
  };

  const tags = Array.isArray(item.tags) ? item.tags.map(normalize) : [];
  const useWhen = Array.isArray(item.useWhen) ? item.useWhen.map(normalize) : [];

  // Tag matches
  tags.forEach((t) => {
    if (t && text.includes(t)) score += 3;
  });

  // UseWhen matches (best-effort keyword match)
  useWhen.forEach((u) => {
    // break the line into rough keywords by removing punctuation
    const cleaned = u.replace(/[^\w\s-]/g, " ");
    const words = cleaned.split(/\s+/).filter(Boolean);
    // if user message hits multiple words, increase score
    const hits = words.filter((w) => w.length >= 4 && text.includes(w)).length;
    score += Math.min(4, hits); // cap per useWhen line
  });

  // Intent keyword boosts
  const boostWords = intentBoost[intent] || [];
  boostWords.forEach((w) => {
    if (text.includes(normalize(w))) score += 2;
  });

  // Direct platform hints
  if (text.includes("padre") && tags.includes("padre")) score += 3;
  if (text.includes("axiom") && tags.includes("axiom")) score += 3;

  return score;
}

function pickRelevantMedia(knowledgeBase, msg, intent, limit = 2) {
  const items = getMediaItems(knowledgeBase);
  if (!items.length) return [];

  const scored = items
    .map((it) => ({ it, score: scoreMediaItem(it, msg, intent) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((x) => x.it);
}

function formatMediaBlock(items) {
  if (!items || items.length === 0) return "";

  const lines = items.map((it) => {
    const title = it.title ? String(it.title).trim() : it.id || "Reference";
    return `• ${title}: ${it.url}`;
  });

  return `\n\nReference images:\n${lines.join("\n")}`;
}

// -------------------- WALLET TRACKING --------------------

function formatWalletLine(w, i) {
  const emoji = w.emoji || "👀";
  const name = (w.name && String(w.name).trim()) ? String(w.name).trim() : `Wallet ${i + 1}`;
  const status = w.alertsOn ? "alerts ON" : "alerts OFF";
  return `• ${emoji} ${name} — ${w.trackedWalletAddress} (${status})`;
}

function getTrackedWallets(knowledgeBase) {
  const wallets =
    knowledgeBase.trackedWallets ||
    knowledgeBase.walletTracking ||
    knowledgeBase.knowledge?.trackedWallets?.wallets ||
    [];

  return Array.isArray(wallets) ? wallets : [];
}

function persistTrackedWallets(wallets) {
  try {
    localStorage.setItem("trackedWallets", JSON.stringify(wallets));
  } catch (e) {}
}

function listTrackedWallets(knowledgeBase) {
  const wallets = getTrackedWallets(knowledgeBase);

  if (wallets.length === 0) {
    return "No tracked wallets yet. Add them to content.json under `trackedWallets`.";
  }

  const lines = wallets.map(formatWalletLine);
  return (
    `👀 **TRACKED WALLETS:**\n\n` +
    `${lines.join("\n")}\n\n` +
    `Commands:\n` +
    `• **tracked wallets** (show list)\n` +
    `• **alerts <name> on/off** (example: alerts cupsey off)\n`
  );
}

function toggleWalletAlerts(msg, knowledgeBase) {
  const parts = normalize(msg).split(" ").filter(Boolean); // ["alerts","cupsey","off"]
  const target = (parts[1] || "").trim();
  const stateWord = (parts[2] || "").trim();

  if (!target || !["on", "off"].includes(stateWord)) {
    return "Use: **alerts <name> on** or **alerts <name> off** (example: alerts cupsey off).";
  }

  const wallets = getTrackedWallets(knowledgeBase);
  if (wallets.length === 0) {
    return "No tracked wallets found. Add them to content.json under `trackedWallets` first.";
  }

  const idx = wallets.findIndex((w) => normalize(w.name || "") === normalize(target));
  if (idx === -1) {
    return `Couldn't find a tracked wallet named **${target}**. Type **tracked wallets** to see names.`;
  }

  wallets[idx].alertsOn = (stateWord === "on");
  persistTrackedWallets(wallets);

  // Write back to knowledgeBase so the UI reflects immediately
  if (Array.isArray(knowledgeBase.trackedWallets)) knowledgeBase.trackedWallets = wallets;
  if (Array.isArray(knowledgeBase.walletTracking)) knowledgeBase.walletTracking = wallets;

  return `✅ Alerts are now **${stateWord.toUpperCase()}** for **${wallets[idx].name}**.`;
}

// -------------------- MENU VARIANTS --------------------

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getMenuText() {
  const variants = [
    "What do you need help with?\n\n1) Axiom filters\n2) Rug vs good coins\n3) Settings (TP/SL/slippage)\n4) Tracked wallets\n\nReply with a number or ask a question.",
    "Pick one:\n\n1) Set up Axiom filters\n2) Rug detection + good coin checklist\n3) Buy/sell settings + stop loss\n4) Tracked wallets\n\nReply with a number or ask a question.",
    "Quick menu:\n\n1) Filters\n2) Rugs vs good coins\n3) Settings + stop loss\n4) Wallet tracking\n\nReply with a number or ask a question."
  ];
  return pickOne(variants);
}

// -------------------- RESPONSES --------------------

function getIdentityResponse(knowledgeBase) {
  const kb = knowledgeBase.knowledge || {};
  if (kb.identity?.content) return kb.identity.content;

  return (
    "Trader U is a meme-coin trading community focused on execution, rug detection, and risk rules.\n\n" +
    "Chepe is the creator behind the Trader U content.\n\n" +
    "If you tell me what platform you're on (Axiom / Nova / Padre / Phantom), I’ll give the exact steps."
  );
}

function appendMediaIfHelpful(baseText, knowledgeBase, userMessage, intent) {
  const picks = pickRelevantMedia(knowledgeBase, userMessage, intent, 2);
  const mediaBlock = formatMediaBlock(picks);
  return baseText + mediaBlock;
}

function getResponse(userMessage, state, knowledgeBase) {
  const msg = normalize(userMessage);
  const config = knowledgeBase.engineConfig || knowledgeBase.meta?.policy || {};
  const intent = detectIntent(msg);

  // Show menu only when:
  // - user explicitly asks for menu OR
  // - they greet and cooldown is 0
  const greetedNow = containsGreeting(userMessage, config);
  if ((intent === "MENU" || (greetedNow && state.menuCooldown === 0)) && state.greeted) {
    state.menuCooldown = 3;
    return getMenuText();
  }

  // Number shortcuts
  if (msg === "1") {
    const text = knowledgeBase.knowledge?.filters?.content || "Go Pulse tab → Filters → Import → paste JSON → Apply All.";
    return appendMediaIfHelpful(text, knowledgeBase, userMessage, "FILTERS");
  }
  if (msg === "2") {
    const text = knowledgeBase.knowledge?.rugpull?.content || "Use the rug checklist: fees vs MC, wallets, bubble map, liquidity/LP lock, test sell.";
    return appendMediaIfHelpful(text, knowledgeBase, userMessage, "RUG");
  }
  if (msg === "3") {
    const text = knowledgeBase.knowledge?.settings?.content || "Set slippage + TP/SL in advanced strategy and keep SOL for fees.";
    return appendMediaIfHelpful(text, knowledgeBase, userMessage, "SETTINGS");
  }
  if (msg === "4") return listTrackedWallets(knowledgeBase);

  // Toggle alerts command
  if (msg.startsWith("alerts ")) return toggleWalletAlerts(msg, knowledgeBase);

  // Intent routing
  let text = "";
  if (intent === "IDENTITY") text = getIdentityResponse(knowledgeBase);
  else if (intent === "FILTERS") text = knowledgeBase.knowledge?.filters?.content || "Go Pulse tab → Filters → Import → paste JSON → Apply All.";
  else if (intent === "SETTINGS") text = knowledgeBase.knowledge?.settings?.content || "Set stop loss in advanced strategy. Keep SOL for fees.";
  else if (intent === "RUG") text = knowledgeBase.knowledge?.rugpull?.content || "Check chart pattern, wallet dates, bubble map, liquidity.";
  else if (intent === "GOODCOIN") text = knowledgeBase.knowledge?.goodcoin?.content || "Look for healthy chart, volume, dispersed wallets.";
  else if (intent === "RISK") text = knowledgeBase.knowledge?.risk?.content || "Risk 1-5% per trade. Set stop loss. Take profits at 2x.";
  else if (intent === "LIQUIDITY") text = knowledgeBase.knowledge?.liquidity?.content || "LP lock reduces rug risk but doesn't prevent dumps.";
  else if (intent === "LINKS") text = knowledgeBase.knowledge?.referrals?.content || "Check platform links for Axiom, Nova, Padre.";
  else if (intent === "VOLUME") text = knowledgeBase.knowledge?.volume?.content || "Look for 200+ buys on 5min chart. Volume = truth.";
  else if (intent === "CA") text = knowledgeBase.knowledge?.ca?.content || "CA = Contract Address. Copy and paste into Axiom to find exact coin.";
  else if (intent === "WORKFLOW") text = knowledgeBase.knowledge?.workflow?.content || "APE = bought in. SCAN = analyzing. WATCH = waiting for dip.";
  else if (intent === "TRACKED_WALLETS") return listTrackedWallets(knowledgeBase);

  if (text) {
    return appendMediaIfHelpful(text, knowledgeBase, userMessage, intent);
  }

  // Helpful fallback (avoid sounding dumb / repetitive)
  if (containsAny(msg, ["fuck you", "stfu", "dumb", "trash"])) {
    return "If you want trading help: tell me what app you're on (Axiom / Padre / Phantom) and what you're trying to do (filters, rug check, entry, settings).";
  }

  return "Tell me what screen you're on (Axiom / Padre / Phantom) and what you're trying to do (buy, sell, filters, or checking a coin).";
}

export function createEngine(knowledgeBase) {
  const config = knowledgeBase.engineConfig || knowledgeBase.meta?.policy || {};

  let state = {
    greeted: false,
    onboardingStage: 0,
    menuCooldown: 0
  };

  return {
    onMessage(userMessage) {
      if (!shouldRespond(userMessage, state, config)) return null;
      state = nextState(userMessage, state, config);
      return getResponse(userMessage, state, knowledgeBase);
    },
    getState() {
      return { ...state };
    }
  };
}
