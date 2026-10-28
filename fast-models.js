// Provider-local fast pools; verified against official catalogs on 2026-10-24.
globalThis.MerchFastModels = Object.freeze({
  google: Object.freeze(["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash"]),
  openai: Object.freeze(["gpt-5.4-nano", "gpt-5.4-mini", "gpt-4o-mini"]),
  anthropic: Object.freeze(["claude-haiku-5-5", "claude-sonnet-5-5"])
});
