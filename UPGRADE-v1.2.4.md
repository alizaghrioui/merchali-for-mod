# MERCHALI for MOD v1.2.4 — Claude fast attempt budget

- Increased the per-model attempt cap in Fast mode from 24 to 30 seconds. The total generation deadline remains 60 seconds.
- Kept Claude Haiku 4.5 as the first Fast model and Sonnet 4.6 as fallback.
- Updated the extension version to 1.2.4.
- This adjustment targets the live test behavior in which Haiku was cut off at 24 seconds and Sonnet fallback also timed out.
- Automated suite: 54 passed, 0 failed.
- Live Chrome test: the five-item request still timed out on Haiku 4.5 and Sonnet 4.6; no suggestions or prompts were produced. The extension showed its timeout and returned to an idle state. This points to a slow or unavailable Anthropic request for the connected account/network; the app key was not exposed.
