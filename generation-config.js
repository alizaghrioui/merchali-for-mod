/* Pure, shared generation policy. No credentials, browser state or API calls. */
globalThis.MerchGeneration = (() => {
  const modes = {
    same_subject: { label: 'Same subject variations', rule: 'Keep the same main subject and animal species. Develop meaningful differences in expression, illustration technique, linework, flat shading and permitted decorative details. Do not replace the main subject or change its breed unless expressly requested.' },
    breeds: { label: 'Same species · different breeds or types', rule: 'Keep each actual species seen in the reference. Change recognizable breeds, coat patterns or types appropriate to that species, with natural defining features. For non-animal subjects use equivalent subtypes, never invent an animal. Preserve each subject’s role and costume unless explicitly allowed to change.' },
    cross_species: { label: 'Cross-species variations', rule: 'Replace the main subject with a different compatible species or subject. Name the replacement explicitly. Adapt its anatomy, limbs, posture and proportions naturally, without imposing the original species’ anatomy. Keep the concept, hierarchy and compositional relationships required by the composition setting.' },
    new_design: { label: 'Same concept · new design', rule: 'Produce genuinely distinct original interpretations of the same core concept. Give each result a different coherent illustration technique, shape language, linework, flat shading or supporting visual treatment. Recoloring or replacing a small object alone is insufficient. Keep the core idea and all explicitly locked elements. Avoid near-identical reproductions.' }
  };
  const compositions = {
    strict: 'STRICT composition: preserve the visible subject count, pose structure, orientation, framing, relative scale, placement, hierarchy and major relationships as closely as possible. Keep costume and supporting-object roles unless expressly changed. For substitutions adapt species anatomy naturally while retaining the pose intent. Fit the composition into a 3:4 portrait canvas without stretching or cutting off artwork. Preserve generic staging, never trace distinctive protected artwork.',
    balanced: 'BALANCED composition: preserve the main arrangement, recognizable concept, visual hierarchy and subject roles. Allow controlled adjustments to pose, spacing, proportions and supporting details. Keep every element the user explicitly locks.',
    creative: 'CREATIVE composition: preserve the core idea and explicitly locked elements, while allowing original arrangements, poses, framing and supporting details. Keep the selected subject/species restrictions; composition freedom does not authorize a forbidden subject replacement.'
  };
  const strengths = {
    low: 'LOW variation: maintain the main visual identity; introduce subtle but meaningful differences within the selected mode.',
    medium: 'MEDIUM variation: make noticeable, coherent changes in artistic execution while retaining the concept and selected constraints.',
    high: 'HIGH variation: explore distinct artistic interpretations, without overriding the composition setting, subject restrictions or user locks.'
  };
  const shirts = { Black:'#111111', Navy:'#1f2a44', 'Dark Heather':'#3b3f46', 'Forest Green':'#1f4d36', Red:'#b3202a', White:'#ffffff', 'Heather Grey':'#c4c7cc', 'Royal Blue':'#2454b8', Beige:'#d8c6a5' };
  // Existing studio defaults: breed changes, strict staging, 20% strength, ten ideas.
  const defaults = Object.freeze({ ...MerchStudio.extraDefaults, variationMode:'breeds', composition:'strict', sim:20, count:10, shirt:'Black', shirtCustom:'#808080', style:'auto', designQuality:'4K', background:'transparent', backgroundCustom:'#ffffff', rules:'', banned:'', customTemplate:'' });
  const color = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : null;
  const strength = sim => Number(sim) <= 30 ? 'low' : Number(sim) <= 55 ? 'medium' : 'high';
  function migrate(saved = {}) {
    return { ...defaults, ...MerchStudio.migrate(saved),
      variationMode: saved.variationMode || (saved.mode === 'niche' ? 'same_subject' : 'breeds'),
      composition: saved.composition || 'strict'
    };
  }
  function validate(input) {
    const o = { ...defaults, ...MerchStudio.migrate(input) };
    MerchStudio.validate(o);
    if (!modes[o.variationMode]) throw new Error('Choose a variation mode.');
    if (!compositions[o.composition]) throw new Error('Choose a composition setting.');
    if (!['1K','2K','4K'].includes(o.designQuality)) throw new Error('Choose a prompt target of 1K, 2K or 4K. Custom pixel sizes are not part of this prompt workflow.');
    if (!Object.hasOwn(shirts,o.shirt) && o.shirt !== 'Custom') throw new Error('Choose a shirt fabric color.');
    if (o.shirt === 'Custom' && !color(o.shirtCustom)) throw new Error('Enter a custom shirt color as #RRGGBB.');
    if (!['transparent','black','white','custom'].includes(o.background)) throw new Error('Choose a background mode.');
    if (o.background === 'custom' && !color(o.backgroundCustom)) throw new Error('Enter a custom background color as #RRGGBB.');
    const limit = 20;
    if (!Number.isInteger(Number(o.count)) || Number(o.count) < 1 || Number(o.count) > limit) throw new Error(`Choose between 1 and ${limit} designs for this mode.`);
    if (!Number.isFinite(Number(o.sim)) || Number(o.sim) < 10 || Number(o.sim) > 70) throw new Error('Choose Low, Medium or High variation strength.');
    for (const key of ['rules','banned','customTemplate']) {
      o[key] = String(o[key] || '').trim();
      if (o[key].length > 12000) throw new Error(`${key} is too long (maximum 12,000 characters).`);
    }
    o.count = Number(o.count); o.sim = Number(o.sim);
    return o;
  }
  function fabric(o) {
    const hex = o.shirt === 'Custom' ? o.shirtCustom : shirts[o.shirt];
    const rgb = hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
    const light = .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2] > .35;
    return `Intended T-shirt fabric: ${o.shirt === 'Custom' ? 'custom color' : o.shirt} (${hex}). ${light ? 'Use clearly defined darker boundaries and readable midtone accents against this light fabric.' : 'Use sufficient light accents, separated silhouettes and readable contrasting details against this dark fabric.'} Choose a palette appropriate to the concept and illustration style; do not force all results into one palette. Keep the artwork readable against the separately selected image background too. Do not render the garment.`;
  }
  function background(o) {
    if (o.background === 'transparent') return 'Background target: genuinely transparent PNG with an actual alpha channel outside the visible opaque artwork, clean boundaries, no solid backdrop, scenery, fake transparency checkerboard, or white/gray substitute. Do not make the artwork itself transparent.';
    const name = o.background === 'black' ? 'pure black #000000' : o.background === 'white' ? 'pure white #ffffff' : `custom color ${color(o.backgroundCustom)}`;
    return `Background target: a uniform fully opaque solid ${name} canvas, edge to edge. No gradients, texture, scenery, checkerboard or unintended extra elements. This image background is separate from the fabric color.`;
  }
  function quality(o) { return `Requested target quality: ${o.designQuality}. Aspect ratio: 3:4 vertical portrait. ${o.designQuality === '4K' ? '3072 × 4096 pixels; 300 DPI metadata; RGB PNG target.' : 'Proportional portrait output; 300 DPI metadata; RGB PNG target.'}`; }
  function policy(o, forImage = false) {
    return `${o.generationMode === "text" ? "Artwork subject and illustration are locked; do not apply species replacements." : modes[o.variationMode].rule}\n${compositions[o.composition]}\n${strengths[strength(o.sim)]}\nExplicit user locks take priority over artistic freedom. ${forImage ? "Follow the described permitted changes and explicit constraints." : "If a user rule conflicts with the selected species/subject mode or STRICT composition, report the conflict in issues and do not silently change settings."} Originality and content safeguards always apply. Never use a variation percentage as copyright clearance.\n${fabric(o)}\n${background(o)}\n${quality(o)}\n${MerchStudio.modes[o.generationMode]?.rule || ""}\nFilled solid-color shapes only; STRICT NO STROKE, no outlines, sticker borders or typography borders. No gradients, glow, neon, 3D, metallic, foil, glitter, photorealism, mockups, watermarks or cropped artwork. Preserve exact permitted wording; never claim verified legal clearance or guaranteed output properties.`;
  }
  function policyKey(o) { return JSON.stringify([o.variationMode,o.composition,o.sim,o.rules,o.customTemplate,o.style,o.generationMode,o.theme,o.customStyle,o.customTheme,o.occasionMode,o.occasion]); }
  function stripQuality(prompt) {
    return String(prompt || '').replace(/^(?:(?:(?:Design quality|Requested target quality): (?:1K|2K|4K)\.(?:\s*Aspect ratio: 3:4 vertical portrait\.\s*No fixed pixel dimensions\.)?|Output resolution: (?:2K|4K) \((?:2048|4096) pixels on the longest side\)\.)\s*)+/i,'').trim();
  }
  function resetOptions(saved, everything) {
    return { ...defaults, ...(everything ? {} : { rules:String(saved.rules || ''), banned:String(saved.banned || ''), customTemplate:String(saved.customTemplate || '') }) };
  }
  return { modes, compositions, strengths, shirts, defaults, strength, migrate, validate, fabric, background, quality, policy, policyKey, stripQuality, resetOptions };
})();
