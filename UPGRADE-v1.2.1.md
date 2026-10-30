# MERCHALI for MOD v1.2.1 — Claude model routing fix

- Replaced unsupported/stale Claude Fast model IDs with the active Anthropic API IDs `claude-haiku-4-5-20251001` and `claude-sonnet-5`.
- Changed the default Claude model to `claude-sonnet-5`; kept `claude-sonnet-4-6` in the built-in manual catalog.
- Updated extension version to 1.2.1. No permissions, API keys, or provider routing behavior changed.
- Verified against Anthropic's current [model deprecations and active model list](https://docs.anthropic.com/en/docs/about-claude/model-deprecations).
- Live Chrome test using the saved Claude connection and Amazon ASIN `B0DMKL9GXC`: one variation and its English image prompt both completed with `claude-haiku-4-5-20251001`. The request finished within the existing 60-second cap; no API key was displayed.
- Automated suite: 54 tests passed, 0 failed. The live test validates one selected reference and does not guarantee future provider capacity or latency.
