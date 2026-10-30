/* Model discovery uses read-only provider endpoints. No generation requests are made here. */
globalThis.MerchModels = (() => {
  // Offline catalog checked against official model directories on 2026-10-20.
  // Refresh replaces this catalog with the full list returned for the entered API key.
  const builtins = {
    openai: [
      "gpt-6-astra", "gpt-6.1-sol", "gpt-6-luna", "gpt-6-sol",
      "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.5", "gpt-5.5-pro",
      "gpt-5.4", "gpt-5.4-pro", "gpt-5.4-mini", "gpt-5.4-nano",
      "gpt-5.3-codex", "gpt-5.3-chat-latest", "gpt-5.2", "gpt-5.2-pro", "gpt-5.2-codex", "gpt-5.2-chat-latest",
      "gpt-5.1", "gpt-5.1-codex", "gpt-5.1-codex-max", "gpt-5.1-codex-mini", "gpt-5.1-chat-latest",
      "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-pro", "gpt-5-codex", "gpt-5-chat-latest",
      "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "chatgpt-4o-latest",
      "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "o3", "o3-pro", "o3-mini", "o4-mini", "o1", "o1-pro", "o1-mini"
    ],
    google: [
      "gemini-4-argon", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite", "gemini-3.1-pro-preview", "gemini-3-flash-preview",
      "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"
    ],
    anthropic: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-sonnet-5"]
  };

  function baseId(id) { return String(id || "").replace(/^ft:/, "").split(":")[0]; }
  function isTextModel(provider, id, methods) {
    if (provider === "google") {
      return /^gemini-/.test(id) && (!methods || methods.includes("generateContent")) &&
        !/image|banana|tts|audio|live|transcrib|embedding|omni|robotics/i.test(id);
    }
    if (provider === "openai") {
      const base = baseId(id);
      return /^(?:gpt-|chatgpt-|o\d(?:[-.]|$)|codex-mini)/.test(base) &&
        !/image|audio|realtime|transcrib|tts|embedding|moderation|instruct|deep-research|search|live/i.test(base);
    }
    return /^claude-/.test(id);
  }
  function entry(provider, id, name = id, methods) {
    return { id, name, text: isTextModel(provider, id, methods) };
  }
  function catalog(provider) { return (builtins[provider] || []).map((id) => entry(provider, id)); }

  async function readPage(url, headers, signal) {
    const response = await fetch(url, { headers, signal });
    if (!response.ok) {
      // Do not echo provider errors which could include key fragments.
      throw new Error(response.status === 401 || response.status === 403
        ? "Cannot load models. Check this provider's API key and its model-list permission."
        : `Cannot load models (${response.status}). Try Refresh again later.`);
    }
    return response.json();
  }

  async function discover(provider, key, signal) {
    if (!key) throw new Error("Enter this provider's API key, then click Refresh models.");
    if (provider === "openai") {
      const data = await readPage("https://api.openai.com/v1/models", { Authorization: `Bearer ${key}` }, signal);
      if (!Array.isArray(data.data)) throw new Error("The provider returned an invalid model list.");
      return unique(data.data.filter((m) => m && typeof m.id === "string").map((m) => entry(provider, m.id)));
    }
    if (provider !== "google") throw new Error("Use a custom model ID for this provider.");
    const models = [];
    const seenPages = new Set();
    let pageToken = "";
    do {
      if (seenPages.has(pageToken)) throw new Error("The provider repeated a models page. Try Refresh again.");
      seenPages.add(pageToken);
      const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url.searchParams.set("pageSize", "1000");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const data = await readPage(url.href, { "x-goog-api-key": key }, signal);
      if (!Array.isArray(data.models)) throw new Error("The provider returned an invalid model list.");
      for (const model of data.models) {
        if (!model || typeof model.name !== "string") continue;
        const id = model.name.replace(/^models\//, "");
        models.push(entry(provider, id, model.displayName || id, model.supportedGenerationMethods || []));
      }
      pageToken = data.nextPageToken || "";
    } while (pageToken);
    return unique(models);
  }
  function unique(models) {
    return [...new Map(models.map((m) => [m.id, m])).values()]
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }
  function supportsImages(id) {
    return !/^(?:gpt-3\.5|gpt-4(?:$|-(?!turbo(?:$|-2024)|vision))|o1-mini|o1-preview|o3-mini)/.test(baseId(id));
  }
  function useResponses(id) {
    const base = baseId(id);
    return !/^o1-(?:mini|preview)/.test(base) && /^(?:gpt-(?:[5-9]|4\.1|4o)|o[134](?:[-.]|$)|codex-mini)/.test(base);
  }
  return { catalog, discover, isTextModel, supportsImages, useResponses, baseId };
})();
