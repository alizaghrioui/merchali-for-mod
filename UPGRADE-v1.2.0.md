# MERCHALI for MOD v1.2.0 — Upgrade report

## Implemented

- Change Artwork / Change Text / Change Both share centralized mode constraints. Artwork mode checks exact observed/corrected wording. Text mode locks artwork style/species/pose and bypasses optional species/style replacements. Text-free references do not request invented slogans by default.
- Art Style (24 options) and Theme/Niche (24 options) are independent, with custom descriptions. Existing jobs/food/typography values migrate without deleting Rules.
- Occasion auto-detection, manual override and none. Strong/moderate/weak/absent evidence; ambiguous pumpkin/spooky motifs do not force Halloween. Calendar contains fixed dates, Gregorian Easter and US moving-day rules; non-US dates are flagged for verification.
- Structured analysis uses the existing provider/API path. Analyze, forced Reanalyze and manual corrections are available. Per-crop analysis is cached in the existing scoped workspace. Suggestions reuse corrected analysis without resending the image when unchanged. Source/framing changes invalidate the cache.
- Single-card suggestion regeneration preserves stable identity, selection, neighboring cards and user-edited concept instructions. Existing per-prompt regeneration remains.
- Prompt checker reports Pass/Warning/Needs Attention, checks settings/locks/canvas/contrast and identifies heuristic IP risks. Noncritical warnings do not block copy. This is not a comprehensive trademark search or legal clearance.
- Named presets support save/load/rename/delete/default. Default preset loads on studio opening. Reset clears prompt options and default selection while retaining preset records, API settings, references and results.
- Removed the special five-result cap. Every existing variation mode accepts 1–20 results. The existing overall 20-result limit and 60-second generation deadline remain.
- Restored composition, background, quality and strength choices as requested by this upgrade, superseding v1.1.7's hard locking. 3:4 and filled shapes / no-stroke guard remain; 4K requests 3072×4096 while 1K/2K are proportional quality targets. User-selected backgrounds remain distinct from fabric color.

## Files

- studio-intelligence.js (new): catalogues, mode constraints, migration, occasion detection/date rules and heuristic checks.
- generation-config.js: compatible new fields, validation, subject/composition policies, 1–20 counts and selected background/quality handling.
- panel.html / panel.css: new controls, analysis correction fields, presets and card reviews within the existing layout.
- panel.js: settings integration, cached analysis, per-card regeneration, preset persistence, exact text checks and review before copy/download.
- background.js / text-api.js: analysis job type through the existing provider, deadline and Fast fallback infrastructure.
- manifest.json: version 1.2.0. Host permissions and permissions unchanged.
- tests/helpers.cjs / upgrade.test.cjs / intelligence.test.cjs: fixture updates, regression assertions and focused new tests.
- README.md, UPGRADE-REPORT.md, tests/results-v1.2.0.txt: documentation and actual test output.

## Storage

Existing settings, opts, mmWorkspace:<tab>, job and reference keys remain. New optional fields are merged into opts. New studioPresets and studioDefaultPreset keys contain prompt options only; no API credentials are copied into presets. Existing settings and custom Rules are not deleted. Earlier results retain saved options; changing analysis or mode requires fresh suggestions before generating new prompts.

## Checks actually run

`/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test merch-multiplier-studio/tests/*.test.cjs`

53 tests passed, 0 failed. Tests include actual JavaScript parsing for every project JS file, MV3 manifest/local asset and DOM ID checks, mocked provider errors/fallback/deadlines, analysis/cache/corrections, mode locks, occasion calculations, preset CRUD/reset/failures, count limits, single-card updates, clipboard, ASIN tab cleanup and full-page workspace setup.

`node --check` was also run on panel.js and generation-config.js during implementation. No npm/build/lint configuration exists. Packaging uses Python zipfile and checks its CRC and required runtime assets.

## Limits and remaining manual verification

- No live Gemini/OpenAI/Anthropic calls were made for this upgrade. Provider behavior is covered with mocked requests, not paid live inference.
- An attempt to open the local preview in the in-app browser was rejected by the browser security URL policy (file: is not allowed). No workaround was attempted; visual browser integration remains unverified.
- After reloading the unpacked extension, manually check ASIN import / Read This Page / Pick a Design on an actual marketplace page, then test the three modes with text and text-free designs. Verify the crop, wording, selected background and quality before downstream use.
- Generative diversity, observed text accuracy, exact artwork preservation and downstream alpha/DPI/resolution are not guaranteed by prompts or heuristics. The tool generates prompts, not an image editor that locks pixels.
- Large 20-prompt batches can still time out or exhaust provider output limits; existing results are retained on failure.
- Occasion date rules primarily cover US conventions and Western/Gregorian Easter; marketplace-specific differences are flagged, not silently assumed correct.
- The standalone HTML bundles the UI but Chrome APIs such as ASIN import, page capture and extension settings require the installed extension. It is not a converted hosted service.
