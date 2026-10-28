/* global MerchTextAPI */
importScripts("models.js", "fast-models.js", "text-api.js");

// The floating studio owns the UI; generation runs independently in this worker.
const activeJobs = new Map();
const workspaceKey = (tabId) => `mmWorkspace:${tabId}`;
const jobKey = (tabId) => `mmTextJob:${tabId}`;
const pickKey = (tabId) => `mmPicked:${tabId}`;

async function openFloatingStudio(tab) {
  if (!Number.isInteger(tab.id) || !/^https?:\/\//.test(tab.url || "")) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => { globalThis.__mmOverlayActionInjection = true; } });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["floating-overlay.js"] });
  const result = await chrome.tabs.sendMessage(tab.id, { type: "mmToggleOverlay", tabId: tab.id }, { frameId: 0 });
  await chrome.storage.session.set({ [`mmOverlay:${tab.id}`]: Boolean(result?.visible) });
  await chrome.action.setBadgeText({ tabId: tab.id, text: result?.visible ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#23815e" });
}
chrome.action.onClicked.addListener((tab) => {
  openFloatingStudio(tab).catch(() => { chrome.action.setBadgeText({ tabId: tab.id, text: "!" }).catch(() => {}); });
});

async function setJob(job) {
  await chrome.storage.session.set({ [jobKey(job.tabId)]: job });
}
async function readJob(tabId) {
  const job = (await chrome.storage.session.get(jobKey(tabId)))[jobKey(tabId)];
  if (job?.status === "running" && !activeJobs.has(job.id)) {
    job.status = "failed";
    job.error = "Chrome interrupted this generation. Please try again.";
    await setJob(job);
  }
  return job;
}
async function runJob(job, request) {
  const entry = activeJobs.get(job.id);
  const heartbeat = setInterval(() => { chrome.runtime.getPlatformInfo().catch(() => {}); }, 20000);
  try {
    const { settings } = await chrome.storage.local.get("settings");
    const api = MerchTextAPI.create(settings || {});
    const result = await api.generate(request.prompt, request.imageUrl || "", {
      ...request.options,
      deadline: job.startedAt + 60000,
      expectedCount: job.context.kind === "analysis" ? undefined : job.context.kind === "variations" ? job.context.options.count : job.context.selection.length,
      onStatus: (label) => {
        job.label = label;
        if (!entry.cancelled) setJob(job).catch(() => {});
      }
    });
    job.status = "done";
    job.result = result;
    job.fallbackUsed = api.fallbackUsed();
    job.modelInfo = api.modelInfo();
  } catch (error) {
    job.status = "failed";
    job.error = error.message || "Generation failed.";
  } finally {
    clearInterval(heartbeat);
    if (!entry.cancelled) await setJob(job);
    activeJobs.delete(job.id);
  }
}

// Use Amazon's actual product page and existing content-script access; never guess an image URL.
async function loadAsin({asin, market}) {
  if (!/^[A-Z0-9]{10}$/.test(asin || "") || !["com","co.uk","de","fr","it","es","ca","co.jp"].includes(market)) throw new Error("Invalid ASIN or marketplace.");
  const tab = await chrome.tabs.create({url:`https://www.amazon.${market}/dp/${asin}`, active:false});
  try {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      try {
        const result = await chrome.tabs.sendMessage(tab.id,{type:"getProduct"},{frameId:0});
        if (result?.ok && result.data?.site === "Amazon" && result.data.imageUrl && result.data.title) return {ok:true,data:result.data};
      } catch (_) { /* Page/content script may still be loading. */ }
      await new Promise(resolve=>setTimeout(resolve,700));
    }
    throw new Error("Amazon did not provide a product image. Open the product yourself, complete any Amazon check, then use Read this page or Pick a design.");
  } finally { await chrome.tabs.remove(tab.id).catch(()=>{}); }
}

async function handleMessage(message, sender) {
  if (sender.id !== chrome.runtime.id) return { ok: false };
  if (["mmOverlayReady", "mmOverlayClose"].includes(message.type)) {
    const id = sender.tab?.id;
    if (!Number.isInteger(id)) return { ok: false };
    if (message.type === "mmOverlayClose") {
      await chrome.storage.session.remove(`mmOverlay:${id}`);
      await chrome.action.setBadgeText({ tabId: id, text: "" });
    }
    const data = await chrome.storage.session.get(`mmOverlay:${id}`);
    return { ok: true, tabId: id, visible: Boolean(data[`mmOverlay:${id}`]) };
  }
  if (["picked", "pickCancel"].includes(message.type)) {
    const tabId = sender.tab?.id;
    if (!Number.isInteger(tabId)) return { ok: false };
    if (message.type === "picked" && message.data?.imageUrl) {
      await chrome.storage.session.set({ [pickKey(tabId)]: { source: message.data, pageUrl: sender.tab.url } });
      await chrome.action.setBadgeText({ tabId, text: "✓" });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: "#23815e" });
      await chrome.action.setTitle({ tabId, title: "Design selected — reopen MERCHALI for MOD" });
    }
    return { ok: true };
  }
  if (!sender.url?.startsWith(chrome.runtime.getURL(""))) return { ok: false };
  if (message.type === "mmLoadAsin") return loadAsin(message);
  const tabId = message.tabId;
  if (!Number.isInteger(tabId) || tabId < 0) throw new Error("Open the extension on a website first.");
  if (message.type === "mmResizeOverlay") {
    if (sender.tab?.id !== tabId) return { ok: false };
    const bounds = message.bounds || {};
    if (![bounds.width, bounds.height].every(Number.isFinite)) return { ok: false };
    return chrome.tabs.sendMessage(tabId, { type: "mmResizeOverlay", bounds, corner: message.corner }, { frameId: 0 });
  }
  if (message.type === "mmStartTextJob") {
    const tab = await chrome.tabs.get(tabId);
    if (!/^https?:\/\//.test(tab.url || "") && !tab.url?.startsWith(chrome.runtime.getURL("panel.html"))) throw new Error("Open the studio or a product page first.");
    const previous = await readJob(tabId);
    if (previous?.status === "running") throw new Error("A generation is already running for this tab.");
    if (!message.prompt || !["analysis", "variations", "prompts"].includes(message.context?.kind)) throw new Error("Invalid generation request.");
    const job = {
      id: crypto.randomUUID(), tabId, startedAt: Date.now(), status: "running",
      label: message.options?.label || "Generating", context: message.context
    };
    activeJobs.set(job.id, { cancelled: false, tabId });
    try { await setJob(job); }
    catch (error) { activeJobs.delete(job.id); throw error; }
    runJob(job, message).catch(() => {});
    return { ok: true, job };
  }
  if (message.type === "mmGetTextJob") {
    const job = await readJob(tabId);
    return { ok: true, job: !message.id || job?.id === message.id ? job : null };
  }
  if (message.type === "mmAcknowledgeTextJob") {
    const job = await readJob(tabId);
    if (job?.id === message.id && job.status !== "running") await chrome.storage.session.remove(jobKey(tabId));
    return { ok: true };
  }
  return { ok: false };
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !["mmLoadAsin", "picked", "pickCancel", "mmStartTextJob", "mmGetTextJob", "mmAcknowledgeTextJob", "mmResizeOverlay", "mmOverlayReady", "mmOverlayClose"].includes(message.type)) return;
  handleMessage(message, sender).then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const entry of activeJobs.values()) if (entry.tabId === tabId) entry.cancelled = true;
  chrome.storage.session.remove([workspaceKey(tabId), jobKey(tabId), pickKey(tabId)]).catch(() => {});
  chrome.storage.session.remove(`mmOverlay:${tabId}`).catch(() => {});
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" }).catch(() => {});
  chrome.action.setTitle({ title: "MERCHALI for MOD" }).catch(() => {});
});
