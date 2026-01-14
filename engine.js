// engine.js

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

  // If NOT strict, allow explicit questions even without greeting
  if (!strict) {
    const explicitQuestion = (userMessage || "").includes("?");
    if (explicitQuestion) return true;
  }

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

  // greeting menu (only triggers when the greeting is the current message)
  if (state.greeted && state.onboardingStage === 0 && containsGreeting(userMessage, knowledgeBase.engineConfig)) {
    return {
      type: "menu",
      text: "Yo — what do you need help with?",
      options: [
        "Set up Axiom filters",
        "Learn rugs vs good coins",
        "Buy/sell settings + stop loss"
      ]
    };
  }

  // Intent routing
  if (msg.includes("filter") || msg.includes("axiom") || msg === "1") {
    return {
      type: "knowledge",
      key: "filters",
      text: "Go Pulse tab (not Discover) → Filters → Import → paste JSON → Apply All. Repeat for New Pairs, Final Stretch, Migrated. Then turn Dynamic BC OFF on all three."
    };
  }

  if (msg.includes("stop loss") || msg.includes("trailing") || msg.includes("setting") || msg === "3") {
    return {
      type: "knowledge",
      key: "settings",
      text: "There's two types: trailing SL and stop loss. On mobile, bottom right → advanced strategy → set TP/SL. Keep extra SOL for fees so you can sell."
    };
  }

  if (msg.includes("rug") || msg.includes("bundled") || msg.includes("bundle") || msg === "2") {
    return {
      type: "knowledge",
      key: "rugpull",
      text: "Rug check: chart pattern (heartbeat vs straight-up then death), fees must match market cap, wallet dates (all 1 month = bundled), bubble map (death star = rug), and liquidity."
    };
  }

  if (msg.includes("good") || msg.includes("find")) {
    return {
      type: "knowledge",
      key: "goodcoin"
    };
  }

  if (msg.includes("risk") || msg.includes("position")) {
    return {
      type: "knowledge",
      key: "risk"
    };
  }

  if (msg.includes("liq") || msg.includes("lp") || msg.includes("lock")) {
    return {
      type: "knowledge",
      key: "liquidity"
    };
  }

  if (msg.includes("refer") || msg.includes("link") || msg.includes("nova") || msg.includes("padre")) {
    return {
      type: "knowledge",
      key: "referrals"
    };
  }

  if (msg.includes("narrative") || msg.includes("meta")) {
    return {
      type: "text",
      text: "Research is mostly narrative + meta: ask why the meme exists and whether it fits current momentum (AI, politics, animals, culture/viral moments)."
    };
  }

  if (msg.includes("volume")) {
    return {
      type: "knowledge",
      key: "volume"
    };
  }

  if (msg.includes("ca") || msg.includes("contract")) {
    return {
      type: "knowledge",
      key: "ca"
    };
  }

  if (msg.includes("workflow") || msg.includes("ape") || msg.includes("scan") || msg.includes("watch")) {
    return {
      type: "knowledge",
      key: "workflow"
    };
  }

  // Default fallback
  return {
    type: "fallback",
    text: "Got you. Tell me what screen you're on (Axiom / Padre / Phantom) and what you're trying to do (buy, sell, filters, or checking a coin).",
    options: ["Rug detection", "Risk rules", "Platform links"]
  };
}

// Factory so you can wire it into any UI
export function createEngine(knowledgeBase) {
  const config = knowledgeBase.engineConfig;
  let state = { greeted: false };

  return {
    onMessage(userMessage) {
      if (!shouldRespond(userMessage, state, config)) return null;
      state = nextState(userMessage, state, config);
      return getResponse(userMessage, state, knowledgeBase);
    },
    getState() {
      return { ...state };
    },
    // Expose for UI to check
    isGreeted() {
      return state.greeted;
    }
  };
}
