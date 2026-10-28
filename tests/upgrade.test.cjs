const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {root,source,panelFixture,Element}=require('./helpers.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const ctx=vm.createContext({});vm.runInContext(source('studio-intelligence.js'),ctx);vm.runInContext(source('generation-config.js'),ctx);const G=ctx.MerchGeneration;
const options=patch=>G.validate({...G.defaults,...patch});
const reference={subject:'A seated rabbit',species:'Rabbit',style:'Flat hand-drawn illustration',layout:'One centered seated rabbit with a small leaf below',subjects:[{kind:'rabbit',species:'rabbit',position:'center',pose:'Seated, forepaws together',facing:'front',anatomy:'Upright ears and folded hind legs',outfit:'',props:'Leaf below'}],essentialElements:'Rabbit and calm theme',optionalDetails:'Leaf shape',uncertainDetails:'Breed not identifiable'};
const prompt = 'A seated rabbit with upright ears faces the viewer in the center of a calm vertical composition. Its forepaws rest together above folded hind legs, and a small simple leaf balances the empty lower area. Use a coherent hand-drawn flat illustration treatment with clean narrow linework and clear separation of forms. Vary the ear markings and expression in a natural way while retaining the overall rabbit identity and seated posture. Keep the relative scale generous and the visual hierarchy focused on the face. Use warm cream accents and muted green details with sufficient contrast, crisp edges and flat color separation for readable T-shirt printing. Avoid added lettering, garment photographs, scenery, watermarks or decorative clutter.';
function idea(mode='breeds',i=1){return{niche:`Variation ${i}`,concept:`Specific rabbit variation ${i}`,variationMode:mode,preserves:'Centered seated pose and calm concept',changes:`Distinct natural markings ${i}`,designText:'',safetyNote:''};}
async function fixture(t,initial){const f=panelFixture(initial);t.after(()=>f.dispose());await f.api.loadAll();return f;}
function seed(f,o,count=2){f.api.S.source={referenceToken:'crop1',referenceImageUrl:'data:image/png;base64,fixture'};f.api.S.referenceContext=reference;f.api.S.referenceOptions=o;f.api.S.ideas=Array.from({length:count},(_,i)=>({...f.api.normIdea(idea(o.variationMode,i+1),[],false),generationOptions:o,imagePrompt:prompt+' '+i}));f.api.S.promptStage='prompts';}
test('manifest and all local assets load as MV3; no new dependencies or permissions',()=>{
 const m=JSON.parse(source('manifest.json'));assert.equal(m.manifest_version,3);assert.equal(m.version,'1.2.0');assert.deepEqual(m.permissions,['activeTab','storage','scripting']);
 for(const file of fs.readdirSync(root).filter(x=>x.endsWith('.js')))new vm.Script(source(file),{filename:file});
 for(const m of source('panel.html').matchAll(/(?:src|href)="([^"#]+\.(?:js|css|svg))"/g))assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
 const ids=[...source('panel.html').matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
 for(const m of source('panel.js').matchAll(/\$\("#([\w-]+)"\)/g))assert.ok(ids.includes(m[1]) || source('panel.js').includes(`id="${m[1]}"`),`Missing UI control ${m[1]}`);
});
test('four subject modes and three composition policies are distinct',()=>{
 const policies=Object.keys(G.modes).map(variationMode=>G.policy(options({variationMode,count:3})));assert.equal(new Set(policies).size,4);
 assert.match(policies[0],/Keep the same main subject and animal species/);assert.match(policies[1],/actual species/);assert.match(policies[2],/Adapt its anatomy/);assert.match(policies[3],/Recoloring.*insufficient/);
 for(const composition of ['strict','balanced','creative'])assert.match(G.policy(options({composition})),new RegExp(composition.toUpperCase()+' composition'));
 assert.match(G.policy(options({sim:70,composition:'strict'})),/HIGH variation/);assert.match(G.policy(options({sim:70,composition:'strict'})),/preserve the visible subject count/);
});
test('all variation modes validate 1–20 results, no silent substitution',()=>{
 for(const count of [1,5])assert.equal(options({variationMode:'new_design',count}).count,count);
 assert.equal(options({variationMode:'new_design',count:20}).count,20);assert.throws(()=>options({count:0}),/1 and 20/);assert.throws(()=>options({count:21}),/1 and 20/);
 for(const variationMode of ['same_subject','breeds','cross_species'])assert.equal(options({variationMode,count:20}).count,20);
 assert.throws(()=>options({variationMode:'unknown'}),/variation mode/);
});
test('shirt and image background are independent across every supported combination',()=>{
 for(const shirt of [...Object.keys(G.shirts),'Custom'])for(const background of ['transparent','black','white','custom']){
  const o=options({shirt,background,shirtCustom:'#123456',backgroundCustom:'#abcdef'});assert.match(G.fabric(o),/Intended T-shirt fabric/);assert.match(G.background(o),/Background target/);
  if(background==='custom')assert.match(G.background(o),/#abcdef/);
  if(shirt==='Custom')assert.match(G.fabric(o),/#123456/);
 }
 assert.match(G.fabric(options({shirt:'White'})),/light fabric/);assert.match(G.fabric(options({shirt:'Black'})),/dark fabric/);assert.match(G.fabric(options({shirt:'Beige'})),/light fabric/);
 assert.throws(()=>options({shirt:'Custom',shirtCustom:'red'}),/#RRGGBB/);assert.throws(()=>options({background:'custom',backgroundCustom:'#12'}),/#RRGGBB/);
});
test('1K/2K/4K targets use 3:4 and 4K has an explicit export target',()=>{
 for(const designQuality of ['1K','2K','4K']){const q=G.quality(options({designQuality}));assert.match(q,new RegExp(designQuality));assert.match(q,/3:4/);if(designQuality==='4K')assert.match(q,/3072 × 4096/);else assert.doesNotMatch(q,/4096/);}
 assert.throws(()=>options({designQuality:'8K'}),/Custom pixel/);
 assert.equal(G.stripQuality('Output resolution: 2K (2048 pixels on the longest side). Hello'),'Hello');
 assert.equal(G.stripQuality('Design quality: 4K. Aspect ratio: 3:4 vertical portrait. No fixed pixel dimensions. Hello'),'Hello');
 assert.match(source('panel.html'),/Your image tool controls actual dimensions and alpha transparency/);
});
test('settings load, persist and reopen; built-in framing and source picking stay wired',async t=>{
 const f=await fixture(t);assert.equal(f.el('#count').value,10);assert.equal(f.el('#designQuality').value,'4K');
 f.api.applyOptions({...G.defaults,variationMode:'cross_species',composition:'balanced',sim:45,count:3,shirt:'Custom',shirtCustom:'#234567',background:'custom',backgroundCustom:'#c0ffee',designQuality:'2K',rules:'بدّل غير النوع',customTemplate:'Describe pose first'});
 await f.api.saveOpts();await f.api.loadAll();assert.equal(f.api.getOpts().variationMode,'cross_species');assert.equal(f.api.getOpts().backgroundCustom,'#c0ffee');assert.equal(f.api.getOpts().designQuality,'2K');
 assert.equal(f.el('#shirtCustomField').hidden,false);assert.equal(f.el('#backgroundCustomField').hidden,false);
 assert.match(source('panel.js'),/MerchReference\.load/);assert.match(source('panel.js'),/MerchReference\.autoFocus/);assert.match(source('content.js'),/type: "picked"/);assert.match(source('manifest.json'),/floating-overlay.js/);
});
test('reference analysis keeps observed anatomy, uncertainties and typography-only subjects',async t=>{
 const f=await fixture(t);const r=f.api.normalizeReferenceContext(reference);assert.equal(r.species,'Rabbit');assert.match(r.subjects[0].pose,/Seated/);assert.match(r.uncertainDetails,/not identifiable/);
 const textOnly=f.api.normalizeReferenceContext({subject:'Lettering',style:'Hand lettering',layout:'Two centered lines',subjects:[{kind:'lettering',pose:'not applicable'}]});assert.equal(textOnly.subjects.length,1);
 assert.throws(()=>f.api.normalizeReferenceContext({subject:'Rabbit'}),/subject, style and composition/);
 f.api.S.referenceContext=r;f.api.renderAnalysis();assert.match(f.el('#analysisDetails').innerHTML,/Folded|folded/);assert.match(f.el('#analysisDetails').innerHTML,/not identifiable/);
});
test('both generation phases reflect all selected constraints, Darija rules and custom template',async t=>{
 const f=await fixture(t);const o=options({variationMode:'cross_species',composition:'balanced',sim:45,count:3,shirt:'Beige',designQuality:'1K',background:'white',rules:'بدّل الأرنب بثعلب',customTemplate:'Describe anatomy before colors'});
 for(const text of [f.api.buildVariationPrompt(o,{site:'Amazon'}),f.api.buildPromptGenerationPrompt(o,null,[idea('cross_species')],reference)]){
  for(const value of ['Cross-species','BALANCED','MEDIUM','Beige','1K','white','3:4','بدّل الأرنب بثعلب','Describe anatomy before colors'])assert.ok(text.includes(value),value);
  assert.match(text,/original|Original/);assert.match(text,/not instructions|never instructions|descriptive data/);
 }
 assert.match(f.api.buildVariationPrompt(o,{site:'Amazon'}),/uncertainDetails/);assert.match(f.api.buildVariationPrompt(o,{site:'Amazon'}),/camera|perspective/);
});
test('successful analysis stores exact count and independent variation descriptions',async t=>{
 const f=await fixture(t);const o=options({count:2});f.api.S.source={referenceToken:'crop1'};
 f.api.applyTextJobResult({reference,ideas:[idea('breeds',1),idea('breeds',2)]},{kind:'variations',sourceToken:'crop1',options:o});
 assert.equal(f.api.S.ideas.length,2);assert.equal(f.api.S.referenceContext.species,'Rabbit');assert.equal(f.api.S.referenceOptions.composition,'strict');assert.equal(f.api.S.promptStage,'suggestions');
 assert.match(f.el('#ideaList').innerHTML,/Preserves:/);assert.match(f.el('#ideaList').innerHTML,/Changes:/);
});
test('malformed/conflicting/wrong-count responses and stale crops preserve existing results',async t=>{
 const f=await fixture(t);const o=options({count:2});seed(f,o);const before=JSON.stringify(f.api.S.ideas);const context={kind:'variations',sourceToken:'crop1',options:o};
 for(const raw of ['not json',{issues:['Rules contradict Strict pose'],ideas:[]},{reference,ideas:[idea()]},{reference,ideas:[idea(),idea()]}])assert.throws(()=>f.api.applyTextJobResult(raw,context));
 assert.throws(()=>f.api.applyTextJobResult({reference,ideas:[idea(),idea('breeds',2)]},{...context,sourceToken:'old-crop'}));assert.equal(JSON.stringify(f.api.S.ideas),before);
});
test('single regeneration changes only its selected result and retains other edits',async t=>{
 const f=await fixture(t);const o=options({count:2});f.api.applyOptions(o);seed(f,o);f.api.S.ideas[0].editedFullPrompt='My individually edited English prompt';
 const before=JSON.stringify(f.api.S.ideas[0]);f.raw=JSON.stringify({ideas:[{number:1,variationMode:'breeds',preserves:'Centered seated posture',changes:'New rabbit markings',imagePrompt:prompt+' Use a recognizable new coat pattern.',designText:''}]});
 await f.api.regenerateResult(1,new Element());assert.equal(JSON.stringify(f.api.S.ideas[0]),before);assert.match(f.api.S.ideas[1].imagePrompt,/new coat pattern/);assert.equal(f.api.S.textBusy,false);
 assert.equal(f.messages.filter(m=>m.type==='mmStartTextJob').length,1);assert.match(f.messages.find(m=>m.type==='mmStartTextJob').prompt,/Regenerate this one result/);
});
test('visible prompts and individual/batch clipboard use the same complete saved settings',async t=>{
 const f=await fixture(t);const o=options({shirt:'White',background:'black',designQuality:'2K',count:2});seed(f,o);f.api.renderIdeas();
 const full=f.api.finalPrompt(f.api.S.ideas[0]);assert.match(full,/White \(#ffffff\)/);assert.match(full,/pure black #000000/);assert.match(full,/2K/);assert.doesNotMatch(full,/report the conflict in issues/);
 // Changing studio controls does not silently relabel earlier results.
 f.api.applyOptions({...G.defaults,designQuality:'4K'});assert.equal(f.api.finalPrompt(f.api.S.ideas[0]),full);
 await f.api.copyPromptBatch([f.api.S.ideas[0]]);assert.equal(f.context.copied,full.replace(/\s+/g,' ').trim());
 const button={dataset:{action:'copy-one'},closest:()=>({dataset:{i:'0'}})};
 await f.el('#ideaList').listeners.click[0]({target:{closest:()=>button}});assert.equal(f.context.copied,full);
 assert.match(f.el('#ideaList').innerHTML,/Regenerate This Result/);assert.match(f.el('#ideaList').innerHTML,/Copy Prompt/);
});
test('one-click Reset restores prompt settings and clears custom instructions, preserves connections and results',async t=>{
 const f=await fixture(t,{unrelated:'keep',opts:{...G.defaults,rules:'Keep ears',banned:'brand',customTemplate:'Pose first',count:3}});f.api.S.ideas=[idea()];
 const connection=JSON.stringify(f.local.settings),session=JSON.stringify(f.session);
 await f.el('#btnResetQuick').onclick();assert.equal(f.local.opts.count,10);for(const key of ['rules','banned','customTemplate'])assert.equal(f.local.opts[key],'');
 assert.equal(f.local.unrelated,'keep');assert.equal(JSON.stringify(f.local.settings),connection);assert.equal(JSON.stringify(f.session),session);assert.equal(f.api.S.ideas.length,1);
 await f.api.loadAll();assert.equal(f.el('#count').value,10);assert.equal(f.el('#rules').value,'');
});
test('Reset Everything removes only custom instructions, preserves built-ins and credentials',async t=>{
 const f=await fixture(t,{opts:{...G.defaults,rules:'custom',banned:'test',customTemplate:'My template'},unrelated:{keep:true}});const connection=JSON.stringify(f.local.settings);
 await f.api.resetExtension(true);for(const key of ['rules','banned','customTemplate'])assert.equal(f.local.opts[key],'');assert.equal(JSON.stringify(f.local.settings),connection);assert.equal(f.local.unrelated.keep,true);
 assert.match(f.api.buildVariationPrompt(options(),{}),/Built-in originality/);assert.equal(f.el('#rules').value,'');assert.equal(f.el('#customTemplate').value,'');
});
test('failed reset retains previous configuration and does not claim success',async t=>{
 const f=await fixture(t,{opts:{...G.defaults,rules:'Keep me',count:3}});const saved=JSON.stringify(f.local);const control=f.el('#count').value;f.failWrites=true;
 await f.api.resetExtension(true);assert.equal(JSON.stringify(f.local),saved);assert.equal(f.el('#count').value,control);assert.match(f.el('#toast').textContent,/Reset failed/);assert.equal(f.el('#btnResetQuick').disabled,false);
});

// Run the complete panel entry point against the documented DOM/storage fixture.
test('full studio initialization completes and persists its scoped workspace',async t=>{
 const f=panelFixture({},true);t.after(()=>f.dispose());await f.context.fixtureReady;
 assert.equal(f.el('#toast').className,undefined);assert.equal(f.session['mmWorkspace:7'].pageUrl,'https://www.amazon.com/dp/fixture');assert.equal(f.api.getOpts().variationMode,'breeds');
});
test('same-concept counts and actual instruction fields remain independent of subject examples',async t=>{
 const f=await fixture(t);const o=options({variationMode:'new_design',count:5,composition:'creative',sim:70});const built=f.api.buildVariationPrompt(o,{});
 assert.match(built,/exactly 5/);assert.match(built,/CREATIVE composition/);assert.match(built,/HIGH variation/);assert.match(built,/Recoloring or replacing a small object alone is insufficient/);
 assert.doesNotMatch(built,/left ghost|witch cat|mummy cat/);
});
test('prompt errors are atomic: wrong mode, duplicate, short or non-English responses retain all results',async t=>{
 const f=await fixture(t);const o=options({count:2});seed(f,o);const before=JSON.stringify(f.api.S.ideas);
 const context={kind:'prompts',options:o,sourceToken:'crop1',selection:[0,1],signature:f.api.selectionSignature(f.api.S.ideas)};
 const valid=(i)=>({number:i,variationMode:'breeds',preserves:'Centered pose',changes:'Coat markings',imagePrompt:prompt+' '+i});
 for(const updates of [[{...valid(1),variationMode:'cross_species'},valid(2)],[valid(1),{...valid(2),imagePrompt:valid(1).imagePrompt}],[{...valid(1),imagePrompt:'too short'},valid(2)],[{...valid(1),imagePrompt:prompt+' رسم حيوان'},valid(2)]]){
  assert.throws(()=>f.api.applyTextJobResult({ideas:updates},context));assert.equal(JSON.stringify(f.api.S.ideas),before);
 }
});
test('reset cannot overlap a generation; crop changes hide stale analysis',async t=>{
 const f=await fixture(t);f.api.S.textBusy=true;const before=f.writes;await f.api.resetExtension(true);assert.equal(f.writes,before);
 f.api.S.referenceContext=null;f.api.renderAnalysis();assert.equal(f.el('#referenceAnalysis').hidden,true);assert.equal(f.el('#analysisDetails').innerHTML,'');
});

test('product capture targets frame 0 so studio iframe cannot consume the reply',async t=>{
 const f=await fixture(t);let routed;
 f.context.chrome.tabs.sendMessage=async(tabId,message,options)=>{routed={tabId,message,options};return options?.frameId===0?{ok:true,data:{title:'Amazon product'}}:undefined;};
 const result=await f.api.sendToTab({type:'getProduct'});assert.equal(result.ok,true);assert.equal(routed.tabId,7);assert.equal(routed.options.frameId,0);
 assert.match(source('background.js'),/mmToggleOverlay[^\n]+frameId: 0/);assert.match(source('background.js'),/mmResizeOverlay[^\n]+frameId: 0/);
});
test('content script responds only to its own page commands',()=>{
 let listener;const image={src:'https://m.media-amazon.com/images/fixture.png',getAttribute:()=>null};
 const document={title:'Amazon product',querySelector(selector){if(selector==='#productTitle')return{textContent:'Original product title'};if(selector==='#landingImage, #imgTagWrapperId img')return image;return null;},querySelectorAll:()=>[]};
 const context=vm.createContext({window:{},document,location:{hostname:'www.amazon.com',href:'https://www.amazon.com/dp/fixture'},chrome:{runtime:{onMessage:{addListener(fn){listener=fn;}}}}});
 vm.runInContext(source('content.js'),context);let response;
 assert.equal(listener({type:'mmToggleOverlay'},{},()=>{throw Error('must not intercept overlay');}),undefined);
 assert.equal(listener({type:'getProduct'},{},data=>{response=data;}),true);assert.equal(response.ok,true);assert.equal(response.data.title,'Original product title');assert.match(response.data.imageUrl,/fixture.png/);
});
test('header Reset is one direct action with no choices or dialog',async t=>{
 const f=await fixture(t);assert.equal(f.el('#btnResetQuick').onclick,f.el('#btnReset').onclick);
 assert.doesNotMatch(source('panel.html'),/resetDialog|resetSettings|resetEverything/);
 assert.match(source('panel.html'),/id="btnResetQuick"[^>]*>Reset<\/button>/);
});
test('Fast strategy persists separately from prompt defaults',async t=>{
 const f=await fixture(t);f.api.S.settings.strategy='fast';f.api.syncGenerationStrategy();assert.match(f.el('#fastModelHint').textContent,/gpt-5.4-nano/);
 f.context.chrome.storage.local.set({settings:{...f.local.settings,strategy:'fast'}});await f.api.resetExtension();assert.equal(f.local.settings.strategy,'fast');
});

test('model routing is only in connection settings, with Fast and Manual controls',async t=>{
 const f=await fixture(t);f.el('#setProvider').value='google';f.el('#setStrategy').value='fast';f.api.syncGenerationStrategy();
 assert.equal(f.el('#fastConfig').hidden,false);assert.equal(f.el('#manualModelPicker').hidden,true);assert.match(f.el('#fastModelHint').textContent,/gemini-3.5-flash-lite/);assert.equal(f.el('#connectionBadge').textContent,'Gemini · Fast');
 f.el('#setStrategy').value='manual';f.api.syncGenerationStrategy();assert.equal(f.el('#fastConfig').hidden,true);assert.equal(f.el('#manualModelPicker').hidden,false);
 const html=source('panel.html');assert.doesNotMatch(html,/id="generationStrategy"/);assert.ok(html.indexOf('id="setStrategy"')>html.indexOf('YOUR STUDIO CONNECTION'));
});
