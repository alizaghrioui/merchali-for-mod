# v1.1.2 upgrade and browser verification report

## Implementation based on inspected project

The project is an unbundled Manifest V3 extension with an in-page floating studio, a service worker, marketplace content scripts, local reference-crop analysis, and OpenAI/Anthropic/Gemini text/vision integrations. The inspected source included the complete file tree, manifest, UI/styling, storage paths, prompt templates, model routing, reference helpers, legacy hidden image/export path, shared libraries and existing documentation. No pre-existing test runner/package manifest was present.

The implementation plan was to preserve those entry points, add a shared validated creative configuration, extend both existing AI stages, snapshot each result's settings, add per-result actions and a narrowly scoped reset, then test with local fixtures without controlling Chrome. The existing defaults and 60-second deadline were retained.

## Changes

- **New:** `generation-config.js` — centralized defaults, four variation modes, three composition policies, Low/Medium/High strength, fabric/background color validation, luminance-based contrast, prompt targets, migration and reset helpers.
- **Changed:** `panel.html`, `panel.css`, `panel.js` — working selectors, optional custom template, structured detailed reference analysis/inspector, English prompt generation, conflict/error validation, saved per-result settings, copy/regenerate one result, a confirmation dialog with both reset actions. Existing black theme, local crop, Darija Rules, batch copy/TXT, model configuration and floating UI remain.
- **Changed:** `text-api.js` — existing total deadline is preserved; expired jobs do not initiate requests and configured credentials are redacted from generation errors.
- **Changed:** `manifest.json` — version 1.1.0 and scope description; no permission/host expansion.
- **New:** `tests/helpers.cjs`, `tests/upgrade.test.cjs`, `tests/api.test.cjs` — built-in Node tests with fake keys, storage/DOM/clipboard and provider responses.
- **Changed:** `README.md`; **new:** this report — current behavior, capability limits, storage audit and manual checks.

`background.js`, `content.js`, overlay/resizing controllers, reference framing, model discovery, library helpers and icons are reused without replacement. No new package, provider, server, build step or browser permission is required.

## Executed verification

Final local run: **32 tests executed, 32 passed, 0 failed** on 2026-10-24, using:

```sh
/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test merch-multiplier-studio/tests/*.test.cjs
```

All tests are offline fixtures rather than claims about live model behavior or Chrome rendering.

- JavaScript parsing: all top-level extension JS files compiled using Node's `vm.Script` during the asset test. Explicit `node --check` also ran for the changed panel and new configuration module.
- Manifest version/permissions, referenced assets, unique DOM IDs and statically referenced UI controls checked.
- Policies checked for each mode, Strict/Balanced/Creative, Low/Medium/High and valid count limits.
- All 40 fabric/background combinations (nine named fabric colors plus Custom, four backgrounds), custom color validation and contrast instructions checked.
- Quality targets 1K/2K/4K, 4:5, removal of earlier fixed-resolution headers and honest output-limit text checked.
- Settings save/reload, Darija Rules/template propagation, reference anatomy/unknowns and lettering-only references checked with fixtures.
- Analysis and prompt processing, exact counts, duplicates, stale crops, reported conflicts and malformed output checked; prior results are retained on failures.
- Single-result regeneration checked through the real panel request/result functions using mocked service-worker messages; other results and edits stay intact.
- Per-result clipboard and batch clipboard checked against the same displayed complete prompt.
- Reset Cancel/no write; Reset Settings/custom-rule retention; Reset Everything/removal only of intended custom fields; credentials/session/unrelated keys retained; reopen persistence; failure/no false success checked.
- Mocked OpenAI Responses, Anthropic Messages and Gemini image analysis requests checked for payloads, model routing and cancellation signals. Text APIs do not receive fake image-size/background parameters.
- Mocked missing keys, empty responses, malformed provider data, network failures, rate limits, compatibility retries and credential redaction checked.
- Total 60-second timer and abort verified with a controlled clock; backoff stops at the same deadline and expired jobs make no call. No real 60-second wait or provider request was used.

## Remaining manual verification

The initial v1.1.0 checks were offline. The user subsequently explicitly authorized browser testing. v1.1.2 was activated in Chrome, with the live checks recorded below. No API key was displayed, copied or logged. The DOM harness is not a browser renderer. These additional cases still require broader verification:

1. Chrome loads v1.1.0 without manifest/runtime errors. Toggle the toolbar icon; keep the overlay visible while picking a design, navigate within the source tab, resize both corners, check dark/light themes and reference crop/zoom.
2. Run a real design through each mode and composition setting. Visually assess species/anatomy, pose adherence, actual differences, palette and print readability. Fixtures verify instructions and response handling, not a model's visual understanding.
3. Review the expanded reference analysis against the crop, including uncertainty handling. Test typography-only and multi-character artwork.
4. Verify individual copy/TXT downloads and clipboard permissions in the cross-origin extension iframe. Confirm one regenerated prompt changes without replacing others.
5. Open Settings → Reset Extension, cancel first, then try the two confirmed actions using disposable custom rules. Reopen the studio and confirm credentials/provider connections still exist.
6. Verify live account/model access, rate-limit messages, network failure handling and the 60-second stop. A provider may continue server-side work after the HTTP client disconnects; abort cannot guarantee provider billing is canceled.
7. Paste a prompt into the chosen image tool and inspect actual dimensions and alpha. 1K/2K/4K and transparency are requests, not verified image outputs. The legacy hidden image/export path is preserved and not newly enabled or covered by live image-generation tests.

No legal-safety or sales-performance guarantee is made. The reset preserves reference/results snapshots intentionally; Reset Everything removes custom instructions from current creative settings, not from already generated results or saved job context.


## Follow-up browser fixes · v1.1.1–1.1.2

### Reproduced and fixed

- **Read this page returned “No product found” on an Amazon product.** Route capture and picker messages to `frameId: 0` so the embedded extension iframe does not compete with the actual marketplace content script. Overlay toggle/resize messages also explicitly target frame 0. The content listener now leaves unrelated commands unanswered instead of claiming their response channels.
- **Reset was hard to find in Settings.** Added a visible **Reset** button in the studio header next to Settings. It invokes the same confirmation dialog and is disabled with the other controls while generating.
- Changed `panel.js`, `background.js`, `content.js`, `panel.html`, `panel.css`, version in `manifest.json`, documentation and regression tests. No new permissions or dependencies.

### Actually observed in Chrome

- Extension management displayed **v1.1.2** enabled, with no Errors button on its extension card at the inspected state.
- After the routing fix, **Read this page** loaded the Amazon artwork, displayed the framed reference with **1.6× zoom**, and reported “Design focus ready.”
- Header **Reset** was visible. Opening it showed **Cancel**, **Reset Settings**, **Reset Everything**, and the data-preservation explanation. **Cancel** closed it without changing the user's Rules or count. No real reset/destructive action was performed.
- A real five-variation Gemini request reached the configured 60-second maximum, displayed the expected stop message, and re-enabled controls. No successful AI response was claimed from that attempt.
- A second, single-result Gemini request also reached the 60-second maximum without returning a response. The original five-result count and original Rules text (`gad liya design b 5 type dyal cats`) were restored and observed in the UI afterward. A successful live analysis-to-prompts cycle is therefore still unverified; the provider/network timeout was not misreported as successful generation.

The 32 offline tests include regressions for top-frame message routing, unrelated content-message handling, and the visible header Reset/Cancel behavior. Live Gemini latency and model responsiveness are separate from these verified UI fixes.


## Follow-up · v1.1.3–1.1.4: one-click Reset, Fast routing, connection redesign

- Reset is now a single immediate action, as explicitly requested. It restores prompt controls and removes active custom instructions; it preserves connections, API keys, references, results and historical result settings. Previous confirmation/Reset Everything UI has been removed.
- `fast-models.js` centralizes provider-local lightweight model pools from official catalogs. `text-api.js` aborts slow individual attempts and advances on errors or invalid/incomplete JSON within one 60-second total deadline. The pool never sends data to a different provider. Background jobs record the model/attempt metadata and completion identifies the actual model.
- v1.1.4 moves Generation mode exclusively to YOUR STUDIO CONNECTION. The sheet separates Provider & access from Model routing, shows Fast pool and 60s limit, and reveals the manual catalog only in manual mode. A Save connection action persists choices; API keys remain password fields and are not printed.
- Live v1.1.3 test: Reset succeeded with one click; Fast was enabled and saved. The selected Amazon reference was captured; **five variation suggestions** and then **five detailed English prompts** were generated successfully by `gemini-3.5-flash-lite`. All five result textareas and individual Copy/Regenerate controls were observed in Chrome. The first model succeeded, so no live fallback was needed. Automatic fallback on model errors/malformed output is covered by mocked tests.
- Local suite after v1.1.4 changes: **36 tests executed, 36 passed, 0 failed**. Tests now reflect direct Reset and connection-only routing, including preservation of Fast through prompt reset.
- Version 1.1.4 was observed loaded in Chrome extension management without an Errors button. Connection-sheet visual verification is completed separately below.

Sources: https://ai.google.dev/gemini-api/docs/models ; https://developers.openai.com/api/docs/models/gpt-5.4-nano ; https://developers.openai.com/api/docs/models/gpt-5.4-mini ; https://platform.claude.com/docs/en/models/overview .


## v1.1.5 — MERCHALI for MOD

Renamed the existing studio and toolbar identity, replaced SVG/PNG icons with a light blue prompt bubble and AI sparkle, added Open as page with an independent copied workspace, and added validated Amazon ASIN/product URL import across the eight existing Amazon marketplaces. Temporary background product tabs close in a finally block. Actual product images pass through the existing adjustable local focus pipeline. Worker generation now accepts the extension's full-page studio. No new permissions, API requests, browser reloads or tests for this update.


## v1.1.6 — UI simplification
Removed decorative hero cards, redundant eyebrow labels, category tags, ornamental results symbols and empty-state sparkle. Added a semantic document/prompt heading, factual empty states, compact controls, flat status text and consistent light blue accents over the black theme. Existing functional control IDs and workflows retained. No browser reload or tests performed for this visual update.


## v1.1.7 — mandatory user master profile
User master prompt retained in MASTER-PROMPT.md and sent as mandatory guidance for suggestions and prompts. Fixed output targets: 3:4, 3072×4096, 4K, 300 DPI, RGB transparent PNG. Filled shapes only; strict no-stroke restrictions. Fresh composition mandatory; conflicting composition/background/quality controls locked and saved options migrated. User exclusion list merged with extra exclusions; exact design wording checked for changes and exclusion conflicts. Batch copy/TXT use one complete unnumbered prompt per line. Image targets are instructions, not verified generated file properties. No browser/API tests run.


## v1.2.0
See UPGRADE-v1.2.0.md for the complete advanced upgrade report. 53 automated tests passed; live browser/API verification remains pending.

## v1.2.1
See UPGRADE-v1.2.1.md. Replaced stale Claude model IDs with currently active Anthropic IDs. Verified one variation and the corresponding English prompt live in Chrome with `claude-haiku-4-5-20251001`; the request completed inside the 60-second cap.

## v1.2.2
See UPGRADE-v1.2.2.md. Variation suggestions now require Arabic script; English image prompts remain English. No tests run for this language-only update.

## v1.2.3
See UPGRADE-v1.2.3.md. Haiku 4.5 is now the default Claude model and Sonnet 4.6 is the Fast-mode fallback. Five-item live tests timed out on both Haiku and the previous Sonnet 5 fallback; the user's saved Claude key was not displayed. Automated tests run after the model update.

## v1.2.4
Fast mode now gives each model up to 30 seconds, while preserving the 60-second total generation limit. The live five-item test still timed out on Haiku 4.5 and Sonnet 4.6; no prompts were produced. Automated tests passed (54/54).
