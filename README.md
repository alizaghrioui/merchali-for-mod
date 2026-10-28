# MERCHALI for MOD — AI Prompt Generator for Amazon Merch on Demand

**Turn a print-on-demand design reference into controlled artwork variations and detailed English image prompts.** MERCHALI for MOD is a Chrome extension for Amazon Merch on Demand creators and POD designers who use Gemini, OpenAI or Claude with their own API key.

![MERCHALI for MOD AI prompt studio logo](icons/icon128.png)

## What it does

- **Amazon ASIN design import:** load a shirt by ASIN or supported Amazon product URL, then focus and crop the printed artwork.
- **Reference capture:** read the current Amazon, Etsy or Pinterest product page, or pick a design image directly.
- **Three generation modes:** Change Artwork, Change Text, or Change Both.
- **Controlled design variations:** same subject, different breeds/types, cross-species variations, or a new design around the same concept. Request 1–20 suggestions per batch.
- **Separate art style and niche:** choose retro, groovy, kawaii, western, botanical and other styles independently from the subject or audience. Add custom descriptions.
- **Editable design analysis:** review observed text, subject, art style, audience and occasion before generating prompts.
- **Holiday context:** auto-detect an occasion, choose one manually, or keep the design non-seasonal.
- **Reusable presets:** save Rules, style, niche and other prompt settings without copying API keys.
- **Batch image prompts:** copy one complete English prompt per line or download a UTF-8 TXT file for your preferred image-generation workflow.
- **Prompt checks:** review mode locks, canvas/background instructions, readability and preliminary intellectual-property cautions.
- **Black dark theme and floating panel:** keep the studio beside the product page, resize it, or open it as a separate tab.

## Install the Chrome extension

1. Download this repository with **Code → Download ZIP**, then extract it.
2. Open `chrome://extensions` in Google Chrome.
3. Enable **Developer mode** and choose **Load unpacked**.
4. Select the extracted folder containing `manifest.json`.
5. Pin **MERCHALI for MOD** to the browser toolbar.
6. Open **Your Studio Connection**, select your AI provider, enter your own API key, and save.

To update an existing installation, replace its files and select **Reload** on the extension card. Your saved Chrome extension settings remain separate from repository files.

## Create POD design prompts

1. Open a reference product or enter an Amazon ASIN in the studio. Verify the artwork crop.
2. Select **Analyze reference** and correct any uncertain wording or details.
3. Choose what may change: artwork, text, or both.
4. Set the variation mode, composition, art style, niche, fabric color, image background and quality target. Write your Rules in English, Moroccan Darija, Arabic, Arabizi or French.
5. Suggest variations, review and select concepts, then generate the English image prompts.
6. Review each prompt and use **Copy all prompts** or **Download .txt**.

This extension writes image-generation prompts. It does not turn a prompt into a verified image file or perform pixel-accurate editing of the reference artwork.

## AI providers and privacy

Gemini, OpenAI and Anthropic Claude use the existing direct provider integrations. You supply your own key; generation may incur provider charges. API keys are stored in Chrome local extension storage and are not included in this repository or named presets.

When you request analysis, the focused reference artwork and applicable instructions are sent to your selected AI provider. Prompt writing reuses the observed design summary. Fast mode can switch supported models within the same provider, with an overall 60-second generation deadline. There is no MERCHALI-hosted generation backend.

## Print settings and originality

Prompts use a 3:4 portrait composition and filled-shape, no-stroke instructions. Background, quality and composition follow selected settings. A 4K target requests 3072 × 4096 pixels, 300 DPI metadata and RGB PNG; the downstream image tool determines actual output dimensions, transparency and metadata.

Use only artwork, wording and reference material you have the right to use. AI cautions are heuristic: they are not a comprehensive trademark search, legal clearance, Amazon approval or a promise of sales. Review [Amazon Merch on Demand content policies](https://merch.amazon.com/resource/201858630) and relevant intellectual-property records before publishing.

MERCHALI for MOD is an independent tool and is not affiliated with or endorsed by Amazon, Google, OpenAI or Anthropic.

## Development

Manifest V3 extension using plain JavaScript, HTML and CSS. No build step or npm dependencies are required.

```sh
node --test tests/*.test.cjs
```

The v1.2.0 test run passed 53 automated tests using mocked provider/browser interactions. Live marketplace capture and provider inference require manual verification in Chrome.

See [the v1.2.0 upgrade report](UPGRADE-v1.2.0.md) for architecture changes, storage compatibility and limitations.
