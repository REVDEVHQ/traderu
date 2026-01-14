// engine.js - Simple string responses

function normalize(text) {
  return (text || "").trim().toLowerCase();
}

function containsGreeting(text, config) {
  const t = normalize(text);
  return (config.greetingKeywords || []).some((k) => t.includes(k));
}

function shouldRespond(userMessage, state, config) {
  if (!config.speakOnlyAfterGreeting) return true;
  const strict = !!config.strictHelloOnlyMode;
  if (!strict && (userMessage || "").includes("?")) return true;
  return !!state.greeted || containsGreeting(userMessage, config);
}

function nextState(userMessage, state, config) {
  if (state.greeted) return state;
  if (containsGreeting(userMessage, config)) {
    return { ...state, greeted: true, onboardingStage: 0 };
  }
  return state;
}

function getResponse(userMessage, state, knowledgeBase) {
  const msg = normalize(userMessage);
  const config = knowledgeBase.engineConfig;

  // Greeting menu
  if (state.greeted && state.onboardingStage === 0 && containsGreeting(userMessage, config)) {
    return "Yo — what do you need help with?\n\n1) Set up Axiom filters\n2) Learn rugs vs good coins\n3) Buy/sell settings + stop loss\n\nReply with a number or ask a question.";
  }

  // Number shortcuts
  if (msg === "1") return knowledgeBase.knowledge?.filters?.content || "Check Axiom filters in Pulse tab.";
  if (msg === "2") return knowledgeBase.knowledge?.rugpull?.content || "Check rug detection guide.";
  if (msg === "3") return knowledgeBase.knowledge?.settings?.content || "Check buy/sell settings.";

  // Intent matching
  if (msg.includes("filter") || msg.includes("axiom")) {
    return knowledgeBase.knowledge?.filters?.content || "Go Pulse tab → Filters → Import → paste JSON → Apply All.";
  }

  if (msg.includes("stop loss") || msg.includes("trailing") || msg.includes("setting")) {
    return knowledgeBase.knowledge?.settings?.content || "Set stop loss in advanced strategy. Keep SOL for fees.";
  }

  if (msg.includes("rug") || msg.includes("bundled") || msg.includes("bundle")) {
    return knowledgeBase.knowledge?.rugpull?.content || "Check chart pattern, wallet dates, bubble map, liquidity.";
  }

  if (msg.includes("good") || msg.includes("find coin")) {
    return knowledgeBase.knowledge?.goodcoin?.content || "Look for healthy chart, volume, dispersed wallets.";
  }

  if (msg.includes("risk") || msg.includes("position") || msg.includes("stop")) {
    return knowledgeBase.knowledge?.risk?.content || "Risk 1-5% per trade. Set stop loss. Take profits at 2x.";
  }

  if (msg.includes("liq") || msg.includes("lp") || msg.includes("lock")) {
    return knowledgeBase.knowledge?.liquidity?.content || "LP lock reduces rug risk but doesn't prevent dumps.";
  }

  if (msg.includes("refer") || msg.includes("link") || msg.includes("nova") || msg.includes("padre")) {
    return knowledgeBase.knowledge?.referrals?.content || "Check platform links for Axiom, Nova, Padre.";
  }

  if (msg.includes("narrative") || msg.includes("meta")) {
    return "Research is mostly narrative + meta: ask why the meme exists and whether it fits current momentum (AI, politics, animals, culture/viral moments).";
  }

  if (msg.includes("volume")) {
    return knowledgeBase.knowledge?.volume?.content || "Look for 200+ buys on 5min chart. Volume = truth.";
  }

  if (msg.includes("ca") || msg.includes("contract")) {
    return knowledgeBase.knowledge?.ca?.content || "CA = Contract Address. Copy and paste into Axiom to find exact coin.";
  }

  if (msg.includes("workflow") || msg.includes("ape") || msg.includes("scan") || msg.includes("watch")) {
    return knowledgeBase.knowledge?.workflow?.content || "APE = bought in. SCAN = analyzing. WATCH = waiting for dip.";
  }

  if (msg.includes("help") || msg.includes("start") || msg.includes("what can")) {
    return "I can help with:\n\n• Rug detection\n• Good coin checklist\n• Risk management\n• Axiom filters\n• Buy/sell settings\n• Platform links\n\nJust ask about any topic!";
  }

  // Default fallback
  return "Got you. Tell me what screen you're on (Axiom / Padre / Phantom) and what you're trying to do (buy, sell, filters, or checking a coin).";
}

export function createEngine(knowledgeBase) {
  const config = knowledgeBase.engineConfig || {};
  let state = { greeted: false, onboardingStage: 0 };

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
