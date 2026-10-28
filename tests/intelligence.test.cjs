const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {source,panelFixture}=require('./helpers.cjs');
const ctx=vm.createContext({});vm.runInContext(source('studio-intelligence.js'),ctx);vm.runInContext(source('generation-config.js'),ctx);
const I=ctx.MerchStudio,G=ctx.MerchGeneration;
const opts=patch=>G.validate({...G.defaults,...patch});
const r={subject:'Cat with book',species:'cat',safeText:'READ, SLEEP & REPEAT!',style:'Flat filled shapes',layout:'Seated cat above text',subjects:[{kind:'cat',species:'cat',pose:'Seated',position:'center'}],theme:'Reading cats',audience:'Readers',occasion:'',uncertainDetails:''};
const suggestion=(n=1,mode='breeds',text='')=>({niche:`Concept ${n}`,concept:`Different original arrangement ${n}`,preserves:'Cat species and reading theme',changes:`Book placement ${n}`,variationMode:mode,designText:text});
async function fixture(t,initial){const f=panelFixture(initial);t.after(()=>f.dispose());await f.api.loadAll();return f;}
function seed(f,o){f.api.S.source={referenceToken:'ref',referenceImageUrl:'data:image/png;base64,test'};f.api.S.referenceContext=structuredClone(r);f.api.S.analysisToken='ref';f.api.S.referenceOptions=o;f.api.applyOptions(o);}
test('three modes enforce artwork/text locks and no-text behavior without inventing animals',()=>{
 const a=I.direction(opts({generationMode:'artwork'}),r);assert.match(a,/Change Artwork/);assert.match(a,/Lock exact/);assert.ok(a.includes(r.safeText));
 const b=I.direction(opts({generationMode:'text',style:'western',variationMode:'cross_species'}),r);assert.match(b,/LOCK ARTWORK/);assert.match(b,/Locked reference artwork style/);assert.doesNotMatch(b,/Western & Cowboy/);assert.match(G.policy(opts({generationMode:'text',variationMode:'cross_species'})),/do not apply species replacements/);
 const c=I.direction(opts({generationMode:'both'}),r);assert.match(c,/Change Both/);assert.match(c,/same core concept/);
 assert.match(I.direction(opts({generationMode:'text'}),{}),/Without original text, leave wording empty/);
 assert.match(I.direction(opts({generationMode:'both'}),{}),/Do not force a slogan/);
 assert.match(G.policy(opts({variationMode:'breeds'})),/never invent an animal/);
 assert.ok(I.textError(opts({generationMode:'artwork'}),r,'changed'));
 assert.equal(I.textError(opts({generationMode:'artwork'}),r,r.safeText),'');
 assert.equal(I.textError(opts({generationMode:'artwork'}),{safeText:''},''),'');
});
test('high strength preserves strict composition and mode locks',()=>{
 const p=G.policy(opts({generationMode:'text',sim:70,composition:'strict'}));assert.match(p,/HIGH variation/);assert.match(p,/STRICT composition/);assert.match(p,/LOCK ARTWORK/);assert.match(p,/without overriding the composition/);
});
test('art styles and niches are independent, extensible and migrate legacy choices',()=>{
 assert.equal(Object.keys(I.styles).length,24);assert.equal(Object.keys(I.niches).length,24);
 const o=opts({style:'custom',customStyle:'Flat 90s shapes',theme:'custom',customTheme:'Librarians'}),d=I.direction(o,r);assert.match(d,/Flat 90s shapes/);assert.match(d,/Librarians/);
 assert.equal(G.migrate({style:'jobs',rules:'خلي النص'}).theme,'jobs');assert.equal(G.migrate({style:'jobs'}).style,'auto');assert.equal(G.migrate({style:'typography'}).style,'custom');
 assert.throws(()=>opts({style:'custom',customStyle:''}),/custom art style/);assert.throws(()=>opts({theme:'invalid'}),/valid art style/);
});
test('occasion inference does not turn unrelated fishing into a holiday; manual override wins',()=>{
 assert.equal(I.detect({subject:'Fishing rod and fish',theme:'Fishing'}).id,'none');
 assert.equal(I.detect({safeText:'Merry Christmas'}).confidence,'strong');
 assert.equal(I.occasion(opts({occasionMode:'manual',occasion:'valentine'}),{safeText:'Merry Christmas'}).id,'valentine');
 assert.equal(I.occasion(opts({occasionMode:'none'}),{safeText:'Merry Christmas'}).id,'none');
 assert.equal(I.detect({details:'A pumpkin'}).confidence,'weak');assert.equal(I.occasion(opts({}),{details:'A pumpkin'}).id,'none');
});
test('moving holiday calculations and regional caveats remain correct across years',()=>{
 const us=I.calendar(2026,'com'),uk=I.calendar(2026,'co.uk'),get=id=>us.find(x=>x.id===id);
 assert.equal(get('easter').date,'2026-04-05');assert.equal(get('mother').date,'2026-05-10');assert.equal(get('father').date,'2026-06-21');assert.equal(get('thanksgiving').date,'2026-11-26');
 assert.equal(I.calendar(2027).find(x=>x.id==='easter').date,'2027-03-28');
 assert.equal(uk.find(x=>x.id==='thanksgiving').applicable,false);assert.equal(uk.find(x=>x.id==='christmas').applicable,true);
});
test('analysis is cached per crop, can be forced and does not erase existing variations',async t=>{
 const f=await fixture(t);f.api.S.source={referenceToken:'ref',referenceImageUrl:'data:image/png;base64,test'};f.raw=JSON.stringify({reference:r,issues:[]});f.api.S.ideas=[{id:'keep'}];
 await f.api.analyzeReference();assert.equal(f.messages.filter(x=>x.type==='mmStartTextJob').length,1);assert.equal(f.api.S.referenceContext.safeText,r.safeText);assert.equal(f.api.S.ideas[0].id,'keep');
 await f.api.analyzeReference();assert.equal(f.messages.filter(x=>x.type==='mmStartTextJob').length,1);
 await f.api.analyzeReference(true);assert.equal(f.messages.filter(x=>x.type==='mmStartTextJob').length,2);
 f.api.S.source.referenceToken='changed';await f.api.analyzeReference();assert.equal(f.messages.filter(x=>x.type==='mmStartTextJob').length,3);
});
test('manual analysis corrections retain settings and make old cards stale',async t=>{
 const f=await fixture(t),o=opts({rules:'Original rules'});seed(f,o);f.api.S.ideas=[{id:'one'}];
 for(const [id,value] of Object.entries({analysisSubject:'Rabbit',analysisText:'EXACT!',analysisStyle:'Filled shapes',analysisTheme:'Reading',analysisAudience:'Readers',analysisOccasion:''}))f.el('#'+id).value=value;
 f.el('#btnApplyAnalysis').onclick();assert.equal(f.api.S.referenceContext.subject,'Rabbit');assert.equal(f.api.S.referenceContext.safeText,'EXACT!');assert.equal(f.api.S.ideas[0].id,'one');assert.equal(f.api.readOptions().rules,'Original rules');assert.equal(f.api.S.analysisRevision,1);
});
test('one variation regeneration retains identity, selections, neighbors and edited instructions',async t=>{
 const f=await fixture(t),o=opts({count:2});seed(f,o);f.api.S.referenceContext.safeText='';
 f.api.S.ideas=[{...f.api.normIdea(suggestion(),[],false),id:'stable',include:false,userInstructions:true,concept:'My custom variation instructions'}, {...f.api.normIdea(suggestion(2),[],false),id:'neighbor',include:true}];
 const before=JSON.stringify(f.api.S.ideas[1]);f.raw=JSON.stringify({reference:{...r,safeText:''},ideas:[suggestion(3)]});
 await f.api.regenerateVariation(0,f.el('#btnIdeas'));assert.equal(f.api.S.ideas[0].id,'stable');assert.equal(f.api.S.ideas[0].include,false);assert.equal(f.api.S.ideas[0].concept,'My custom variation instructions');assert.equal(JSON.stringify(f.api.S.ideas[1]),before);
});
test('analysis failure and stale crop responses do not overwrite corrected state',async t=>{
 const f=await fixture(t),o=opts({});seed(f,o);const original=JSON.stringify(f.api.S.referenceContext);f.raw='broken';await f.api.analyzeReference(true);assert.equal(JSON.stringify(f.api.S.referenceContext),original);
 assert.throws(()=>f.api.applyTextJobResult(JSON.stringify({reference:r}),{kind:'analysis',sourceToken:'old',options:o}),/تبدّل/);assert.equal(JSON.stringify(f.api.S.referenceContext),original);
});
test('presets save, load, rename, default and delete without touching API connections or unrelated data',async t=>{
 const f=await fixture(t,{unrelated:'keep'}),connection=JSON.stringify(f.local.settings);f.api.applyOptions(opts({style:'custom',customStyle:'Flat doodle fills',theme:'cats',rules:'خلي النص',count:12}));f.el('#presetName').value='Cats';await f.api.presetAction('save');
 assert.equal(f.local.studioPresets.length,1);const id=f.local.studioPresets[0].id;f.el('#presetSelect').value=id;
 f.api.applyOptions(opts({rules:'other'}));await f.api.presetAction('load');assert.equal(f.api.readOptions().rules,'خلي النص');assert.equal(f.api.readOptions().count,12);
 f.el('#presetSelect').value=id;f.el('#presetName').value='Renamed';await f.api.presetAction('rename');assert.equal(f.local.studioPresets[0].name,'Renamed');
 f.el('#presetSelect').value=id;await f.api.presetAction('default');assert.equal(f.local.studioDefaultPreset,id);
 await f.api.resetExtension();assert.equal(f.local.studioPresets.length,1);assert.equal(JSON.stringify(f.local.settings),connection);assert.equal(f.local.unrelated,'keep');
 f.el('#presetSelect').value=id;await f.api.presetAction('delete');assert.equal(f.local.studioPresets.length,0);
});
test('invalid presets and storage failures retain current controls',async t=>{
 const f=await fixture(t,{studioPresets:[{id:'bad',name:'Bad',options:{...G.defaults,variationMode:'unknown'}}]});const before=JSON.stringify(f.api.readOptions());f.el('#presetSelect').value='bad';await f.api.presetAction('load');assert.equal(JSON.stringify(f.api.readOptions()),before);
 f.el('#presetName').value='Failed';f.failWrites=true;await f.api.presetAction('save');assert.equal(f.local.studioPresets.length,1);assert.equal(JSON.stringify(f.api.readOptions()),before);
});
test('quality status reflects actual mode, wording, background and contradictions without legal clearance',()=>{
 const o=opts({generationMode:'text',background:'white'});const p='Generation Mode: Change Text. LOCK ARTWORK. '+G.policy(o)+' '+I.direction(o,r)+' '+('Describe the cat and book clearly. '.repeat(15));
 assert.equal(I.check(p,o,r).status,'Pass');assert.equal(I.check('',o,r).status,'Needs Attention');assert.ok(I.check(p+' 4:5',o,r).warnings.some(x=>/Conflicting/.test(x)));
 assert.equal(I.cautions('Happy garden cat').length,0);assert.ok(I.cautions('Disney logo').length);assert.match(I.check(p,o,r).warnings.join(' '),/Heuristic review only/);
});
test('non-critical review warnings do not block clipboard, one full line per prompt',async t=>{
 const f=await fixture(t),o=opts({});seed(f,o);const idea={...f.api.normIdea(suggestion(),[],false),generationOptions:o,editedFullPrompt:'Generation Mode: Change Artwork. Disney themed request to review. '+('Use a generic original cat instead. '.repeat(20))};await f.api.copyPromptBatch([idea,idea]);assert.equal(f.context.copied.split('\n').length,2);assert.ok(!f.context.copied.startsWith('1.'));
});
test('all modes including new design accept 20; no hidden five-result cap survives',()=>{
 for(const variationMode of Object.keys(G.modes))assert.equal(opts({variationMode,count:20}).count,20);
 assert.doesNotMatch(source('panel.js'),/selected.length > 5|count.*value = 5|supports 1–5/);
});
test('ASIN import validates marketplace, returns the actual page image and always closes its temporary tab',async()=>{
 const background=source('background.js'),code=background.slice(background.indexOf('async function loadAsin'),background.indexOf('async function handleMessage'));
 let closed=0,created;const context=vm.createContext({Date,setTimeout,chrome:{tabs:{async create(input){created=input;return{id:99};},async sendMessage(){return{ok:true,data:{site:'Amazon',imageUrl:'https://m.media-amazon.com/images/test.jpg',title:'Shirt'}};},async remove(id){assert.equal(id,99);closed++;}}}});vm.runInContext(code,context);
 const result=await context.loadAsin({asin:'B012345678',market:'co.uk'});assert.equal(result.ok,true);assert.equal(created.url,'https://www.amazon.co.uk/dp/B012345678');assert.equal(created.active,false);assert.equal(closed,1);
 await assert.rejects(context.loadAsin({asin:'bad',market:'com'}),/Invalid ASIN/);assert.equal(closed,1);
 let now=0;context.Date={now:()=>now};context.setTimeout=fn=>{now+=30000;fn();};context.chrome.tabs.sendMessage=async()=>({ok:false});await assert.rejects(context.loadAsin({asin:'B012345678',market:'com'}),/Amazon did not provide/);assert.equal(closed,2);
});
test('full-page studio copies reference and results into its own workspace before navigation',async t=>{
 const f=await fixture(t),o=opts({});seed(f,o);f.api.S.ideas=[{id:'kept'}];let navigation,creation;
 f.context.chrome.tabs.create=async input=>{creation=input;return{id:42};};f.context.chrome.tabs.update=async(id,input)=>{navigation={id,...input};};
 await f.el('#btnOpenWeb').onclick();assert.equal(creation.url,'about:blank');assert.equal(navigation.id,42);assert.match(navigation.url,/panel.html\?surface=web/);assert.equal(f.session['mmWorkspace:42'].ideas[0].id,'kept');assert.equal(f.session['mmWorkspace:42'].source.referenceToken,'ref');
});
test('named default preset loads on opening, and Reset keeps the saved record while restoring defaults',async t=>{
 const f=await fixture(t,{opts:{...G.defaults,count:3},studioDefaultPreset:'default',studioPresets:[{id:'default',name:'My default',options:{...G.defaults,count:14,rules:'keep wording'}}]});assert.equal(f.api.readOptions().count,14);await f.api.resetExtension();assert.equal(f.api.readOptions().count,10);assert.equal(f.local.studioDefaultPreset,'');assert.equal(f.local.studioPresets.length,1);
});
