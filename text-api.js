/* global MerchModels, MerchFastModels */
// Shared text requests run in the popup or its extension service worker.
globalThis.MerchTextAPI = (() => {
  function create(settings, defaults = {}) {
    const S = { settings: { ...settings }, geminiFallbackUsed: false };
    const DEFAULTS = { textModel: "gpt-4o-mini", claudeTextModel: "claude-haiku-4-5-20251001", geminiTextModel: "gemini-3.8-flash", ...defaults };
    const timeoutError = () => new Error("Generation stopped after 60 seconds. Try again or choose fewer variations.");
    const sleep = (ms, signal) => new Promise((resolve, reject) => {
      signal?.throwIfAborted();
      const stop = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal?.removeEventListener("abort", stop); resolve(); }, ms);
      signal?.addEventListener("abort", stop, { once: true });
    });
    async function generate(prompt, imageUrl, options = {}) {
      const controller = new AbortController();
      const remaining = Math.min(60000, Math.max(0, (options.deadline || Date.now() + 60000) - Date.now()));
      if (remaining <= 0) throw timeoutError();
      let timer;
      const expired = new Promise((_, reject) => {
        timer = setTimeout(() => { const error = timeoutError(); controller.abort(error); reject(error); }, remaining);
      });
      try {
        const requestOptions = { ...options, signal: controller.signal };
        usedModel = ""; attemptedModels = [];
        return await Promise.race([S.settings.strategy === "fast"
          ? requestFast(prompt,imageUrl,requestOptions)
          : requestTextGeneration(prompt,imageUrl,requestOptions), expired]);
      } catch (error) {
        let message = String(error.message || "Generation failed.");
        for (const key of [S.settings.apiKey, S.settings.claudeKey, S.settings.googleKey]) {
          if (key) message = message.split(key).join("[redacted]");
        }
        throw new Error(message);
      } finally { clearTimeout(timer); }
    }
    const openSettings = () => {};
    let usedModel = "";
    let attemptedModels = [];
    function validFastResponse(raw, expectedCount) {
      let text = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      let data;
      try { data = JSON.parse(text); }
      catch (_) { try { data = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}")+1)); } catch (_) {} }
      if (data?.reference && expectedCount == null) return raw;
      if (!data || !Array.isArray(data.ideas)) throw new Error("Model returned malformed JSON. Trying another fast model.");
      if (data.issues?.length) return raw; // A genuine constraints conflict needs user review, not another model.
      if (!data.ideas.length || (expectedCount && data.ideas.length !== expectedCount)) throw new Error("Model returned an incomplete batch. Trying another fast model.");
      return raw;
    }
    async function requestFast(prompt, imageUrl, options) {
      const provider = S.settings.provider || "openai";
      const models = MerchFastModels[provider] || [];
      if (!models.length) throw new Error("No fast text models configured for this provider.");
      const deadline = Math.min(options.deadline || Date.now()+60000, Date.now()+60000);
      let lastError;
      attemptedModels = [];
      for (let i=0; i<models.length; i++) {
        options.signal.throwIfAborted();
        const remaining = deadline-Date.now();
        if (remaining <= 0) throw timeoutError();
        const model = models[i];
        attemptedModels.push(model);
        options.onStatus?.(`Fast ${i+1}/${models.length} · ${model}`);
        const attempt = new AbortController();
        const parentAbort = () => attempt.abort(options.signal.reason);
        options.signal.addEventListener("abort", parentAbort, {once:true});
        const budget = Math.min(30000, Math.max(1, Math.floor(remaining/(models.length-i))));
        let timer;
        const stopped = new Promise((_, reject) => {
          const abort = () => reject(attempt.signal.reason);
          attempt.signal.addEventListener("abort",abort,{once:true});
          timer = setTimeout(()=>attempt.abort(new Error(`Fast model ${model} exceeded its attempt time.`)),budget);
        });
        try {
          const raw = await Promise.race([requestTextGeneration(prompt,imageUrl,{
            ...options,signal:attempt.signal,modelOverride:model,fast:true,
            onStatus:label=>options.onStatus?.(`Fast · ${model} · ${label}`)
          }),stopped]);
          validFastResponse(raw,options.expectedCount);
          usedModel = model;
          return raw;
        } catch (error) {
          options.signal.throwIfAborted();
          lastError = error;
          if ([401,403].includes(error.status) || /invalid.*(?:key|credential)|API key not valid|permission denied|API_KEY_INVALID/i.test(error.message)) throw error;
        } finally {
          clearTimeout(timer);
          options.signal.removeEventListener("abort",parentAbort);
          // Stop any remaining decoding/body work after a rejected attempt.
          if (!attempt.signal.aborted) attempt.abort(new Error("Attempt finished."));
        }
      }
      throw new Error(`Fast mode tried ${attemptedModels.length} models: ${lastError?.message || "no response"}`);
    }
async function openai(path, body, signal) {
  const key = S.settings.apiKey;
  if (!key) { openSettings(); throw new Error("Add your OpenAI API key in Settings."); }
  const r = await fetch("https://api.openai.com/v1/" + path, {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify(body)
  });
  let j = {};
  try { j = await r.json(); } catch (_) {}
  if (!r.ok) {
    const e = new Error((j.error && j.error.message) || "OpenAI error " + r.status);
    e.status = r.status;
    e.code = j.error?.code || "";
    e.param = j.error?.param || "";
    throw e;
  }
  return j;
}

async function requestOpenAIText(prompt, imageUrl, model, options) {
  if (!MerchModels.isTextModel("openai", model)) throw new Error("Choose an OpenAI text-generation model in Settings.");
  if (imageUrl && !MerchModels.supportsImages(model)) {
    throw new Error("This model cannot read design references. Choose a vision-capable text model in Settings.");
  }
  const base = MerchModels.baseId(model);
  if (MerchModels.useResponses(model)) {
    const content = [{ type: "input_text", text: prompt }];
    if (imageUrl) content.push({ type: "input_image", image_url: imageUrl });
    const body = {
      model, store: false, input: [{ role: "user", content }],
      text: { format: { type: "json_object" } }
    };
    // Keep creative requests quick; Pro and older reasoning models retain their defaults.
    if (/^gpt-[56](?:[.-]|$)/.test(base) && !/-pro(?:$|-)/.test(base)) body.reasoning = { effort: "low" };
    let data;
    try { data = await openai("responses", body, options.signal); }
    catch (error) {
      // Custom models can support Responses without JSON mode or adjustable reasoning.
      if (error.status !== 400 || !/unsupported|not supported/i.test(error.message)) throw error;
      if (/reasoning/.test(error.param) || /reasoning/.test(error.message)) delete body.reasoning;
      else if (/format|text/.test(error.param) || /json_object|text\.format/.test(error.message)) delete body.text;
      else throw error;
      data = await openai("responses", body, options.signal);
    }
    if (data.status === "incomplete" || data.status === "failed" || data.error) {
      throw new Error(data.error?.message || "OpenAI could not finish the response. Try a smaller batch.");
    }
    const parts = (data.output || []).filter((item) => item.type === "message").flatMap((item) => item.content || []);
    if (parts.some((part) => part.type === "refusal")) throw new Error("The model declined this request. Try a different generic design idea.");
    const result = parts.filter((part) => part.type === "output_text").map((part) => part.text || "").join("\n").trim();
    if (!result) throw new Error("OpenAI returned no prompt text. Choose another text model and try again.");
    return result;
  }
  const content = [{ type: "text", text: prompt }];
  if (imageUrl) content.push({ type: "image_url", image_url: { url: imageUrl } });
  const body = { model, messages: [{ role: "user", content }] };
  if (!/^(?:o1|gpt-4$)/.test(base)) body.response_format = { type: "json_object" };
  const data = await openai("chat/completions", body, options.signal);
  if (data.choices?.[0]?.finish_reason === "length") throw new Error("The response was cut short. Try a smaller batch.");
  const result = data.choices?.[0]?.message?.content;
  if (!result) throw new Error("OpenAI returned no prompt text. Choose another text model and try again.");
  return result;
}

async function requestTextGeneration(prompt, imageUrl, options = {}) {
  options.signal?.throwIfAborted();
  const provider = S.settings.provider || "openai";
  const model = options.modelOverride || S.settings.textModel || (provider === "anthropic" ? DEFAULTS.claudeTextModel
    : provider === "google" ? DEFAULTS.geminiTextModel : DEFAULTS.textModel);
  usedModel = model;
  if (!attemptedModels.length) attemptedModels = [model];
  if (provider === "anthropic") {
    const key = S.settings.claudeKey;
    if (!key) { openSettings(); throw new Error("Add your Anthropic API key in Settings."); }
    const content = [];
    if (imageUrl) {
      const encoded = String(imageUrl).match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([\s\S]+)$/i);
      content.push({ type: "image", source: encoded
        ? { type: "base64", media_type: encoded[1].toLowerCase(), data: encoded[2] }
        : { type: "url", url: imageUrl } });
    }
    content.push({ type: "text", text: prompt });
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: options.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({ model, max_tokens: Math.min(8192, options.maxOutputTokens || 8192), messages: [{ role: "user", content }] })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error?.message || `Anthropic error ${response.status}`); error.status = response.status; throw error; }
    if (data.stop_reason === "max_tokens") throw new Error("Anthropic could not finish the response within its size limit. Choose fewer variations and try again.");
    const result = (data.content || []).filter((part) => part.type === "text").map((part) => part.text).join("\n").trim();
    if (!result) throw new Error("Anthropic returned no text. Check the model and try again.");
    return result;
  }

  if (provider === "google") {
    const key = S.settings.googleKey;
    if (!key) { openSettings(); throw new Error("Add your Google AI Studio API key in Settings."); }
    const parts = [];
    if (imageUrl) {
      options.onStatus?.("Preparing reference");
      parts.push(await geminiImagePart(imageUrl, options.signal));
    }
    parts.push({ text: prompt });
    options.onStatus?.(options.label || "Generating");
    try {
      return await generateGeminiWithRetry(model, key, parts, options);
    } catch (error) {
      options.signal?.throwIfAborted();
      // Capacity errors switch models immediately instead of waiting through four attempts.
      if (options.fast || !isGeminiOverloaded(error) || model === "gemini-3.5-flash-lite") throw error;
      options.onStatus?.("Using Flash-Lite · selected model busy");
      const result = await generateGeminiWithRetry("gemini-3.5-flash-lite", key, parts, options);
      S.geminiFallbackUsed = true;
      return result;
    }
  }

  return requestOpenAIText(prompt, imageUrl, model, options);
}

function isGeminiTransient(error) {
  return [408, 429, 500, 502, 503, 504].includes(error.status) ||
    ["UNAVAILABLE", "RESOURCE_EXHAUSTED", "INTERNAL"].includes(error.code) ||
    error instanceof TypeError;
}

function isGeminiOverloaded(error) {
  return error.status === 503 || error.code === "UNAVAILABLE";
}

function geminiGenerationConfig(model, options) {
  const config = { responseMimeType: "application/json", maxOutputTokens: options.maxOutputTokens || 8192 };
  // Use only supported families; preserve custom models without assuming capabilities.
  if (/^gemini-(?:3(?:[.-])|4-argon(?:$|-))/.test(model) && !/image|audio|tts|live/i.test(model)) {
    config.thinkingConfig = { thinkingLevel: model === "gemini-3.5-flash-lite" ? "MINIMAL" : "LOW" };
  } else if (/^gemini-2\.5-flash(?:$|-)/.test(model) && !/image|audio|tts|live/i.test(model)) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }
  return config;
}

function geminiRetryDelay(response, data) {
  const header = response.headers.get("Retry-After");
  const seconds = Number(header);
  const headerDelay = header ? (Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now()) : 0;
  const retryInfo = (data.error?.details || []).find((detail) => /(?:^|\.)RetryInfo$/.test(detail["@type"] || ""));
  const duration = String(retryInfo?.retryDelay || "").match(/^(\d+(?:\.\d+)?)s$/);
  return Math.max(0, Number.isFinite(headerDelay) ? headerDelay : 0, duration ? Number(duration[1]) * 1000 : 0);
}

async function generateGeminiWithRetry(model, key, parts, options = {}) {
  const config = geminiGenerationConfig(model, options);
  let compatibilityRetried = false;
  let transientRetries = 0;
  let lastError;
  while (true) {
    options.signal?.throwIfAborted();
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", signal: options.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: config
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error?.message || `Google Gemini error ${response.status}`);
        error.status = response.status;
        error.code = data.error?.status || "";
        error.retryAfterMs = geminiRetryDelay(response, data);
        throw error;
      }
      const candidate = data.candidates?.[0];
      if (candidate?.finishReason === "MAX_TOKENS") {
        throw new Error("The response exceeded its size limit. Select fewer variations and try again.");
      }
      const result = (candidate?.content?.parts || []).filter((part) => !part.thought).map((part) => part.text || "").join("\n").trim();
      if (!result) throw new Error("Gemini returned no text. Check the model and API key, then try again.");
      return result;
    } catch (error) {
      options.signal?.throwIfAborted();
      lastError = error;
      if (error.status === 400 && config.thinkingConfig && /thinking|budget/i.test(error.message) && !compatibilityRetried) {
        delete config.thinkingConfig;
        compatibilityRetried = true;
        continue;
      }
      if (options.fast || isGeminiOverloaded(error) || !isGeminiTransient(error) || transientRetries >= 1) break;
      // Respect server backoff. Long quota waits are surfaced instead of hiding a minute-long retry.
      if (error.retryAfterMs > 10000) {
        error.message += ` Retry in ${Math.ceil(error.retryAfterMs / 1000)} seconds.`;
        break;
      }
      const delay = Math.max(800, error.retryAfterMs || 0) + Math.floor(Math.random() * 200);
      transientRetries++;
      options.onStatus?.(`Retrying · ${Math.ceil(delay / 1000)}s`);
      await sleep(delay, options.signal);
      options.onStatus?.(options.label || "Generating");
    }
  }
  throw lastError;
}

// Reuse the prepared reference during this panel session; never store image data with API keys.
const referenceImageCache = new Map();
async function geminiImagePart(imageUrl, signal) {
  signal?.throwIfAborted();
  if (referenceImageCache.has(imageUrl)) return referenceImageCache.get(imageUrl);
  const pending = prepareGeminiImage(imageUrl, signal);
  referenceImageCache.set(imageUrl, pending);
  while (referenceImageCache.size > 3) referenceImageCache.delete(referenceImageCache.keys().next().value);
  try { return await pending; }
  catch (error) { referenceImageCache.delete(imageUrl); throw error; }
}

async function prepareGeminiImage(imageUrl, signal) {
  const encoded = String(imageUrl).match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([\s\S]+)$/i);
  if (encoded) return { inline_data: { mime_type: encoded[1].toLowerCase(), data: encoded[2] } };
  const response = await fetch(imageUrl, { signal: signal || AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Could not read the reference image. Pick another reference and try again.");
  let blob = await response.blob();
  if (blob.size > 12 * 1024 * 1024) throw new Error("The reference image is too large. Pick an image smaller than 12 MB.");
  let mimeType = (blob.type || "").toLowerCase().split(";")[0];
  if (mimeType === "image/jpg") mimeType = "image/jpeg";
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)) {
    throw new Error("The reference image must be JPEG, PNG, GIF, or WebP.");
  }
  // Resize only the analysis copy, keeping detail for the broad subject and style.
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    if (scale < 1 || blob.size > 300 * 1024) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const compressed = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
      if (compressed && compressed.size < blob.size) { blob = compressed; mimeType = "image/jpeg"; }
    }
  } catch (_) { /* Keep the valid original when browser decoding is unavailable. */ }
  finally { bitmap?.close(); }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return { inline_data: { mime_type: mimeType, data: btoa(binary) } };
}

    return { generate, openai, fallbackUsed: () => S.geminiFallbackUsed || attemptedModels.length > 1, modelInfo: () => ({model:usedModel,attempted:[...attemptedModels],strategy:S.settings.strategy || "manual"}) };
  }
  return { create };
})();
