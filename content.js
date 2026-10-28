// Runs on Amazon, Etsy and Pinterest. It only answers when the side panel asks:
//  - getProduct: read the product / pin on the current page
//  - startPick / stopPick: let the user click any product card on a results page
if (!window.__mmLoaded) {
  window.__mmLoaded = true;

  const t = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const meta = (p) => {
    const m = document.querySelector(`meta[property="${p}"], meta[name="${p}"]`);
    return m ? m.content || "" : "";
  };

  // Amazon thumbnails carry size tokens like ._AC_UL320_. ; dropping them gives the large image.
  function bigAmazon(url) {
    return /media-amazon|ssl-images-amazon/.test(url)
      ? url.replace(/\._[^./]+_\./, ".")
      : url;
  }

  function amazonMainImage() {
    const img = document.querySelector("#landingImage, #imgTagWrapperId img");
    if (!img) return "";
    const dyn = img.getAttribute("data-a-dynamic-image");
    if (dyn) {
      try {
        const entries = Object.entries(JSON.parse(dyn));
        entries.sort((a, b) => b[1][0] - a[1][0]);
        if (entries[0]) return entries[0][0];
      } catch (_) {}
    }
    return img.getAttribute("data-old-hires") || img.src || "";
  }

  function scrapePage() {
    const host = location.hostname;

    if (/amazon\./.test(host) && document.querySelector("#productTitle")) {
      return {
        site: "Amazon",
        url: location.href,
        title: t(document.querySelector("#productTitle")),
        brand: t(document.querySelector("#bylineInfo")),
        bullets: [...document.querySelectorAll("#feature-bullets li span.a-list-item")]
          .map(t)
          .filter(Boolean)
          .slice(0, 6),
        imageUrl: amazonMainImage()
      };
    }

    if (/etsy\./.test(host)) {
      const desc = document.querySelector("[data-product-details-description-text-content]");
      return {
        site: "Etsy",
        url: location.href,
        title: t(document.querySelector("h1")) || meta("og:title"),
        brand: "",
        bullets: desc ? [t(desc).slice(0, 500)] : [],
        imageUrl: meta("og:image")
      };
    }

    // Pinterest and any other supported page: use the standard social tags.
    return {
      site: /pinterest\./.test(host) ? "Pinterest" : host,
      url: location.href,
      title: t(document.querySelector("h1")) || meta("og:title") || document.title,
      brand: "",
      bullets: [meta("og:description")].filter(Boolean),
      imageUrl: meta("og:image")
    };
  }

  // ---------- pick mode ----------
  let picking = false;
  let hot = null;
  let styleEl = null;

  function ensureStyle() {
    if (styleEl) return;
    styleEl = document.createElement("style");
    styleEl.textContent =
      ".__mm-hot{outline:3px solid #e5484d !important;outline-offset:-3px;cursor:crosshair !important;background-color:rgba(229,72,77,.08) !important}";
    document.documentElement.appendChild(styleEl);
  }

  function cardOf(el) {
    let n = el;
    for (let i = 0; i < 10 && n && n !== document.body; i++, n = n.parentElement) {
      const r = n.getBoundingClientRect();
      if (n.querySelector("img") && t(n).length > 10 && r.width < 900 && r.height < 1400) return n;
    }
    return null;
  }

  function extractCard(card) {
    const imgs = [...card.querySelectorAll("img")].filter((i) => i.src || i.currentSrc);
    imgs.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
    const img = imgs[0];
    const titleEl = card.querySelector("h2, h3, [data-testid*='title'], a[title]");
    const title =
      t(titleEl) || (titleEl && titleEl.getAttribute && titleEl.getAttribute("title")) ||
      (img && img.alt) || t(card).slice(0, 160);
    const link = card.querySelector("a[href]");
    const raw = img ? img.currentSrc || img.src : "";
    return {
      site: /amazon\./.test(location.hostname) ? "Amazon" : /etsy\./.test(location.hostname) ? "Etsy" : /pinterest\./.test(location.hostname) ? "Pinterest" : location.hostname,
      url: link ? link.href : location.href,
      title: title.slice(0, 200),
      brand: "",
      bullets: [],
      imageUrl: bigAmazon(raw)
    };
  }

  function onOver(e) {
    const c = cardOf(e.target);
    if (hot && hot !== c) hot.classList.remove("__mm-hot");
    hot = c;
    if (hot) hot.classList.add("__mm-hot");
  }

  function onClick(e) {
    const c = cardOf(e.target);
    if (!c) return;
    e.preventDefault();
    e.stopPropagation();
    const data = extractCard(c);
    stopPick();
    try { chrome.runtime.sendMessage({ type: "picked", data }); } catch (_) {}
  }

  function onKey(e) {
    if (e.key === "Escape") {
      stopPick();
      try { chrome.runtime.sendMessage({ type: "pickCancel" }); } catch (_) {}
    }
  }

  function startPick() {
    if (picking) return;
    picking = true;
    ensureStyle();
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
  }

  function stopPick() {
    picking = false;
    document.removeEventListener("mouseover", onOver, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    if (hot) hot.classList.remove("__mm-hot");
    hot = null;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !["getProduct", "startPick", "stopPick"].includes(msg.type)) return;
    if (msg.type === "getProduct") {
      const data = scrapePage();
      sendResponse({ ok: !!data.title, data });
    } else if (msg.type === "startPick") {
      startPick();
      sendResponse({ ok: true });
    } else if (msg.type === "stopPick") {
      stopPick();
      sendResponse({ ok: true });
    }
    return true;
  });
}
