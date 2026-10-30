# MERCHALI for MOD v1.2.3 — Faster Claude defaults

- Set Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) as the default model for latency-sensitive prompt generation.
- Kept Haiku first in Fast mode and changed its fallback from Sonnet 5 to Sonnet 4.6.
- Updated the built-in Claude model list order and test fixtures for Arabic-script variation descriptions.
- Bumped the extension version to 1.2.3.
- Anthropic documents Haiku 4.5 as its fastest model for latency-sensitive workloads: https://docs.anthropic.com/en/docs/about-claude/model-deprecations
- Live Chrome test: a five-variation request timed out on Haiku and the existing Sonnet 5 fallback. A separate reference-analysis attempt was started but did not return before the extension became unresponsive. No prompt batch completed, so the Claude connection or API service may be slow/unavailable for this account. The key was not exposed.
- Automated test suite: 54 tests, pending final run.
