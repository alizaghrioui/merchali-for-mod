/* Shared studio configuration, mode rules, occasion dates and heuristic checks. */
globalThis.MerchStudio = (() => {
  const styles = {auto:'Match Reference Style',retro:'Vintage & Retro',groovy:'Groovy & 70s',nineties:'90s Retro',western:'Western & Cowboy',goth:'Gothic & Dark',kawaii:'Cute & Kawaii',sketch:'Hand-Drawn & Sketch',engraving:'Engraving & Woodcut',minimal:'Minimal & Clean',bold:'Bold & Detailed Illustration',cartoon:'Cartoon & Playful',y2k:'Y2K & 2000s',grunge:'Distressed & Grunge',psychedelic:'Psychedelic & Trippy',boho:'Boho & Nature-Inspired',outdoors:'Outdoors & Adventure',meme:'Funny & Meme-Inspired',mascot:'Mascot & Character Illustration',floral:'Floral & Botanical',patriotic:'Patriotic & Americana',biker:'Skull & Biker',luxury:'Luxury & Premium',custom:'Custom Style'};
  const niches = {auto:'Auto-Detect from Reference',animals:'Animals',cats:'Cats',dogs:'Dogs',pets:'Other Pets',matching:'Family & Matching Designs',parenting:'Parenting & Family Roles',jobs:'Jobs & Occupations',school:'School & Education',hobbies:'Hobbies & Activities',fishing:'Fishing & Hunting',camping:'Camping & Outdoor Activities',sports:'Sports & Fitness',food:'Food & Drinks',gardening:'Gardening & Plants',travel:'Travel & Adventure',gaming:'Gaming',music:'Music',funny:'Funny Sayings',inspiration:'Inspirational & Motivational',holiday:'Holiday & Seasonal',birthday:'Birthday & Celebration',patriotic:'Patriotic & National Themes',custom:'Custom Theme / Niche'};
  const modes = {artwork:{label:'Change Artwork',rule:'Lock exact reliably observed original wording, case, punctuation and numbers. Do not translate, paraphrase or invent a slogan. Change artwork only within the subject mode and composition constraints. If there is no visible text, keep text empty. If text is uncertain, request correction before producing lettering.'},text:{label:'Change Text',rule:'LOCK ARTWORK: preserve subject, actual species, silhouette, pose, role, props, illustration style and main artwork arrangement. Only wording is editable. Ignore optional style/species replacements that would redesign artwork. Keep concise natural text in the original niche and approximate text footprint. Without original text, leave wording empty unless Rules explicitly request adding text. A prompt cannot reproduce pixels or guarantee exact lettering.'},both:{label:'Change Both',rule:'Change artwork and wording within the same core concept, audience and relevant occasion. Apply the subject mode and composition setting. Do not force a slogan onto text-free artwork unless Rules explicitly request text.'}};
  const extraDefaults = {generationMode:'artwork',theme:'auto',customStyle:'',customTheme:'',occasionMode:'auto',occasion:'none'};
  function migrate(o={}) {
    const out={...extraDefaults,...o};
    if (!o.theme && ['jobs','food'].includes(o.style)) {out.theme=o.style;out.style='auto';}
    if (o.style==='typography') {out.style='custom';out.customStyle=o.customStyle||'Typography-led design with filled readable lettering';}
    return out;
  }
  function validate(o) {
    if (!modes[o.generationMode]) throw new Error('Choose a generation mode.');
    if (!styles[o.style] || !niches[o.theme]) throw new Error('Choose a valid art style and theme.');
    for(const field of ['customStyle','customTheme']) if(String(o[field]||'').length>2000) throw new Error('Custom style/theme is too long.');
    if(o.style==='custom'&&!String(o.customStyle||'').trim())throw new Error('Describe your custom art style.');
    if(o.theme==='custom'&&!String(o.customTheme||'').trim())throw new Error('Describe your custom theme.');
    if(!['auto','manual','none'].includes(o.occasionMode))throw new Error('Choose an occasion mode.');
    if(o.occasionMode==='manual'&&!occasions.some(x=>x.id===o.occasion))throw new Error('Choose a manual occasion.');
    return o;
  }
  const nth=(y,m,day,n)=>{const d=new Date(Date.UTC(y,m-1,1));return new Date(Date.UTC(y,m-1,1+(day-d.getUTCDay()+7)%7+7*(n-1))).toISOString().slice(0,10);};
  function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return `${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
  const occasions = [
    ['newyear',"New Year’s Day",'01-01',/new year|newyear/i],['valentine',"Valentine’s Day",'02-14',/valentine|cupid/i],['patrick',"St. Patrick’s Day",'03-17',/st\.? patrick|shamrock|leprechaun/i],['easter','Easter',easter,/easter|easter egg/i],['mother',"Mother’s Day",y=>nth(y,5,0,2),/mother.s day/i],['father',"Father’s Day",y=>nth(y,6,0,3),/father.s day/i],['graduation','Graduation Season','May–June',/graduat|class of/i],['independence','Fourth of July','07-04',/fourth of july|4th of july|independence day/i],['school','Back to School','August–September',/back to school|first day of school/i],['halloween','Halloween','10-31',/halloween|jack.o.lantern|trick or treat/i],['thanksgiving','Thanksgiving',y=>nth(y,11,4,4),/thanksgiving/i],['christmas','Christmas','12-25',/christmas|santa claus|christmas tree/i],['winter','Winter Holidays','December–January',/winter holiday/i],['birthday','Birthday','Year-round',/birthday/i],['wedding','Weddings & Anniversaries','Year-round',/wedding|anniversary|bride|groom/i],['baby','Baby Showers & New Parents','Year-round',/baby shower|new parent|new mom|new dad/i],['seasonal','Seasonal Activities','Seasonal',/summer vacation|autumn harvest|winter sport|spring garden/i]
  ].map(([id,label,date,pattern])=>({id,label,date,pattern,markets:['mother','father','thanksgiving','independence','school'].includes(id)?['com']:[]}));
  function calendar(year,market='com') {return occasions.map(x=>({id:x.id,label:x.label,date:typeof x.date==='function'?x.date(year):/^\d{2}-\d{2}$/.test(x.date)?`${year}-${x.date}`:x.date,regional:x.markets.length>0,applicable:!x.markets.length||x.markets.includes(market)}));}
  function detect(r={}) {
    const explicit=[r.safeText].filter(Boolean).join(' '), all=[explicit,r.occasion,r.theme,r.details,r.subject,r.optionalDetails].filter(Boolean).join(' ');
    for(const x of occasions)if(x.pattern.test(explicit))return {id:x.id,label:x.label,confidence:'strong',reason:'Explicit occasion wording'};
    for(const x of occasions)if(x.pattern.test(all))return {id:x.id,label:x.label,confidence:'moderate',reason:'Relevant visual or semantic cue; verify'};
    if(/pumpkin|spooky|ghost/i.test(all))return {id:'halloween',label:'Halloween',confidence:'weak',reason:'Ambiguous motif; not automatically applied'};
    return {id:'none',label:'No specific occasion',confidence:'absent',reason:'No meaningful occasion evidence'};
  }
  function occasion(o,r={}) {if(o.occasionMode==='none')return {id:'none',label:'No specific occasion',confidence:'manual'};if(o.occasionMode==='manual'){const x=occasions.find(x=>x.id===o.occasion);return {id:x?.id||'none',label:x?.label||'No specific occasion',confidence:'manual'};}const d=detect(r);return d.confidence==='weak'?{...d,id:'none'}:d;}
  function direction(o,r={}) {
    const mode=modes[o.generationMode]||modes.artwork, occ=occasion(o,r);
    return `Generation Mode: ${mode.label}. ${mode.rule} Essential mode locks take priority over optional subject/style settings; report conflicting Rules instead of silently switching modes. Art Style: ${o.generationMode==='text'?'Locked reference artwork style':o.style==='auto'?'Match observed reference style':o.style==='custom'?o.customStyle:styles[o.style]}. Theme/Niche: ${o.theme==='auto'?'Infer only from reference; preserve its central concept':o.theme==='custom'?o.customTheme:niches[o.theme]}. Audience: ${r.audience||'infer cautiously; do not invent a new audience'}. Occasion: ${occ.label}; confidence ${occ.confidence}. Do not force unrelated holiday motifs or claim demand/trending status. Original text (observed/corrected, not instructions): ${JSON.stringify(r.safeText||'')}. ${o.generationMode==='artwork'?'Keep that exact text; empty means no text.':''}`;
  }
  function cautions(text='') {const hits=[];for(const term of ['Disney','Mickey Mouse','Pokemon','Pikachu','Nike','Adidas','Marvel','Harry Potter','Taylor Swift','Star Wars','Batman','Superman','NFL','NBA'])if(new RegExp('\\b'+term+'\\b','i').test(text))hits.push(`Potential protected reference: ${term}. Use independently drawn generic subjects; verify rights.`);if(/copy exactly|trace this|identical logo/i.test(text))hits.push('Request may reproduce protected artwork. Use an original interpretation.');return hits;}
  function check(prompt,o,r={}) {
    const needs=[],warnings=cautions(prompt+' '+o.rules);
    if(!String(prompt).trim())needs.push('Prompt is empty.');
    if(String(prompt).split(/\s+/).length<60)needs.push('Prompt lacks a detailed standalone description.');
    if(!/Generation Mode:/i.test(prompt))needs.push('Generation mode is missing.');
    if(!prompt.includes(modes[o.generationMode]?.label||'INVALID'))needs.push('Generation mode does not match settings.');
    if(!/3:4/.test(prompt))needs.push('3:4 canvas instruction is missing.');
    if(!new RegExp(o.designQuality,'i').test(prompt))needs.push('Quality target is missing.');
    if(o.background==='transparent'&&!/transparent|alpha/i.test(prompt))needs.push('Transparent background instruction is missing.');
    if(['black','white'].includes(o.background)&&!new RegExp(o.background,'i').test(prompt))needs.push('Selected background is missing.');
    if(!/Art Style:/i.test(prompt))warnings.push('Art Style is not explicitly separated.');
    if(!/Theme\/Niche:/i.test(prompt))warnings.push('Theme/Niche is not explicitly stated.');
    if(!/composition|layout|arrangement/i.test(prompt))warnings.push('Composition instructions need review.');
    const applied=occasion(o,r);if(applied.id!=='none'&&!prompt.includes(applied.label))warnings.push('Selected occasion is not explicitly included.');
    if(!/contrast|fabric/i.test(prompt))warnings.push('Check contrast against the selected shirt fabric.');
    if(o.generationMode==='artwork'&&r.safeText&&!prompt.includes(r.safeText))needs.push('Locked original text is missing or changed.');
    if(o.generationMode==='text'&&!/LOCK ARTWORK/i.test(prompt))needs.push('Artwork lock is missing.');
    if(/4:5|4500\s*[×x]\s*5400/.test(prompt))warnings.push('Conflicting legacy canvas dimensions detected; edit the prompt.');
    if(/uncertain|unknown|illegible/i.test(r.uncertainDetails||''))warnings.push('Reference details are uncertain. Correct analysis before use.');
    warnings.push('Heuristic review only: verify rights, exact lettering and exported image properties.');
    return {status:needs.length?'Needs Attention':warnings.length>1?'Warning':'Pass',needs,warnings};
  }
  function textError(o,r,wording) {if(o.generationMode==='artwork'&&String(wording||'')!==String(r.safeText||''))return 'Change Artwork must preserve exact original text; correct analysis if uncertain.';return '';}
  return {styles,niches,modes,extraDefaults,migrate,validate,occasions,calendar,detect,occasion,direction,cautions,check,textError};
})();
