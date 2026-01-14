// engine.js - Trader U Degen Engine (UPDATED: intents/synonyms, identity FAQ, menu variants + cooldown,
// tracked wallets w/ alert toggles, safer matching, bilingual (EN/ES) light support)

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
    "follow wallet",
    "cupsey",
    "cchesta",
    "gakey",
    "orangie",
    "cented"
  ]
};

function detectIntent(userMessage) {
  const msg = normalize(userMessage);

  if (containsAny(msg, INTENTS.MENU)) return "MENU";
  if (containsAny(msg, INTENTS.IDENTITY) || (isQuestion(msg) && containsAny(msg, ["chepe", "trader u", "traderu"])))
    return "IDENTITY";

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

// -------------------- WALLET TRACKING --------------------

function formatWalletLine(w, i) {
  const emoji = w.emoji || "👀";
  const name = (w.name && String(w.name).trim()) ? String(w.name).trim() : `Wallet ${i + 1}`;
  const status = w.alertsOn ? "alerts ON" : "alerts OFF";
  return `• ${emoji} ${name} — ${w.trackedWalletAddress} (${status})`;
}

function getTrackedWallets(knowledgeBase) {
  // Support multiple keys if you ever change naming
  const wallets =
    knowledgeBase.trackedWallets ||
    knowledgeBase.walletTracking ||
    knowledgeBase.knowledge?.trackedWallets?.wallets ||
    [];

  return Array.isArray(wallets) ? wallets : [];
}

function persistTrackedWallets(wallets) {
  // Optional persistence (won't crash if localStorage not available)
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
  // Expected: "alerts cupsey off" or "alerts cchesta on"
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
  // Prefer your JSON knowledge if present
  const kb = knowledgeBase.knowledge || {};
  if (kb.identity?.content) return kb.identity.content;

  // Fallback
  return (
    "Trader U is a meme-coin trading community focused on execution, rug detection, and risk rules.\n\n" +
    "Chepe is the main creator/caller behind the Trader U content.\n\n" +
    "If you tell me what platform you're on (Axiom / Nova / Padre / Phantom), I’ll give the exact steps."
  );
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
    // Set cooldown so it doesn't repeat every message
    state.menuCooldown = 3;
    return getMenuText();
  }

  // Number shortcuts
  if (msg === "1") return knowledgeBase.knowledge?.filters?.content || "Go Pulse tab → Filters → Import → paste JSON → Apply All.";
  if (msg === "2") return knowledgeBase.knowledge?.rugpull?.content || "Use the rug checklist: fees vs MC, wallets, bubble map, liquidity/LP lock, test sell.";
  if (msg === "3") return knowledgeBase.knowledge?.settings?.content || "Set slippage + TP/SL in advanced strategy and keep SOL for fees.";
  if (msg === "4") return listTrackedWallets(knowledgeBase);

  // Toggle alerts command
  if (msg.startsWith("alerts ")) return toggleWalletAlerts(msg, knowledgeBase);

  // Intent routing
  if (intent === "IDENTITY") return getIdentityResponse(knowledgeBase);
  if (intent === "FILTERS") return knowledgeBase.knowledge?.filters?.content || "Go Pulse tab → Filters → Import → paste JSON → Apply All.";
  if (intent === "SETTINGS") return knowledgeBase.knowledge?.settings?.content || "Set stop loss in advanced strategy. Keep SOL for fees.";
  if (intent === "RUG") return knowledgeBase.knowledge?.rugpull?.content || "Check chart pattern, wallet dates, bubble map, liquidity.";
  if (intent === "GOODCOIN") return knowledgeBase.knowledge?.goodcoin?.content || "Look for healthy chart, volume, dispersed wallets.";
  if (intent === "RISK") return knowledgeBase.knowledge?.risk?.content || "Risk 1-5% per trade. Set stop loss. Take profits at 2x.";
  if (intent === "LIQUIDITY") return knowledgeBase.knowledge?.liquidity?.content || "LP lock reduces rug risk but doesn't prevent dumps.";
  if (intent === "LINKS") return knowledgeBase.knowledge?.referrals?.content || "Check platform links for Axiom, Nova, Padre.";
  if (intent === "VOLUME") return knowledgeBase.knowledge?.volume?.content || "Look for 200+ buys on 5min chart. Volume = truth.";
  if (intent === "CA") return knowledgeBase.knowledge?.ca?.content || "CA = Contract Address. Copy and paste into Axiom to find exact coin.";
  if (intent === "WORKFLOW") return knowledgeBase.knowledge?.workflow?.content || "APE = bought in. SCAN = analyzing. WATCH = waiting for dip.";
  if (intent === "TRACKED_WALLETS") return listTrackedWallets(knowledgeBase);

  // Helpful fallback (avoid sounding dumb / repetitive)
  if (containsAny(msg, ["fuck you", "stfu", "dumb", "trash"])) {
    return "If you want trading help: tell me what app you're on (Axiom / Padre / Phantom) and what you're trying to do (filters, rug check, entry, settings).";
  }

  return "Tell me what screen you're on (Axiom / Padre / Phantom) and what you're trying to do (buy, sell, filters, or checking a coin).";
}

export function createEngine(knowledgeBase) {
  // Support both formats:
  // - knowledgeBase.engineConfig
  // - knowledgeBase.meta.policy (your JSON)
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
