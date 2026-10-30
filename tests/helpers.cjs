const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const source = file => fs.readFileSync(path.join(root,file),'utf8');
class Element {
  constructor(id='') { this.id=id;this.value='';this.hidden=false;this.disabled=false;this.checked=false;this.textContent='';this.innerHTML='';this.dataset={};this.style={};this.listeners={};this.classList={add(){},remove(){},toggle(){}};this.parentElement=this; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  setAttribute(k,v) {this[k]=v;} removeAttribute(k){delete this[k];}
  querySelector(){return new Element();} querySelectorAll(){return [];}
  closest(){return this;} focus(){} showModal(){this.open=true;} close(){this.open=false;}
  getClientRects(){return [1];} getBoundingClientRect(){return {width:100,height:100,left:0,top:0};}
  getContext(){return {clearRect(){},fillRect(){},drawImage(){}};} replaceChildren(){} appendChild(){} remove(){} click(){}
}
function panelFixture(initial={}, initialize=false) {
  const elements = new Map();
  for (const match of source('panel.html').matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const el = new Element(match[3]);
    el.value = /\bvalue="([^"]*)"/.exec(match[2])?.[1] || '';
    el.hidden = /\bhidden\b/.test(match[2]); el.checked = /\bchecked\b/.test(match[2]);
    elements.set('#'+el.id,el);
  }
  const radios=['artwork','text','both'].map(value=>Object.assign(new Element(),{value,checked:value==='artwork'}));
  const el = selector => { if(selector===`input[name="generationMode"]:checked`)return radios.find(x=>x.checked);  if(!elements.has(selector)) elements.set(selector,new Element(selector)); return elements.get(selector); };
  const local = structuredClone({settings:{apiKey:'fixture-key',provider:'openai',textModel:'gpt-4o-mini',appearanceVersion:2,theme:'dark'},...initial});
  const session={};let writes=0;let failWrites=false;let generatedRaw='';let lastJob;const messages=[];
  const area = data => ({async get(keys){return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,structuredClone(data[k])]));},async set(value){if(failWrites)throw new Error('simulated storage failure');Object.assign(data,structuredClone(value));writes++;},async remove(keys){for(const k of Array.isArray(keys)?keys:[keys])delete data[k];}});
  const chrome={runtime:{id:'fixture',getURL:p=>'chrome-extension://fixture/'+p,getManifest:()=>({version:'1.2.4'}),onMessage:{addListener(){}},async sendMessage(message){messages.push(message);if(message.type==='mmStartTextJob'){lastJob={id:'job-fixture',startedAt:Date.now(),context:message.context,status:'done',result:generatedRaw};return {ok:true,job:lastJob};}if(message.type==='mmGetTextJob')return {ok:true,job:lastJob};return {ok:true};}},storage:{local:area(local),session:area(session),onChanged:{addListener(){}}},action:{async setBadgeText(){},async setTitle(){}},tabs:{async get(){return{id:7,url:'https://www.amazon.com/dp/fixture'};}}};
  const timers=new Set();
  const context=vm.createContext({console,chrome,URL,URLSearchParams,Blob,AbortController,AbortSignal,TextEncoder,Uint8Array,Buffer,structuredClone,location:{search:'?surface=overlay&tabId=7'},navigator:{clipboard:{async writeText(text){context.copied=text;}}},setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();timers.add(t);return t;},clearTimeout, setInterval:(fn,ms)=>{const t=setInterval(fn,ms);t.unref();timers.add(t);return t;},clearInterval,requestAnimationFrame:()=>1,cancelAnimationFrame(){},fetch:()=>{throw new Error('Unexpected real network request');}});
  context.window={addEventListener(){},scrollTo(){}};
  context.document={querySelector:el,querySelectorAll:selector=>selector===`input[name="generationMode"]`?radios:[],addEventListener(){},documentElement:{dataset:{}},activeElement:new Element(),body:new Element(),createElement:()=>new Element()};
  for(const file of ['lib.js','models.js','fast-models.js','master-policy.js','studio-intelligence.js','generation-config.js'])vm.runInContext(source(file),context,{filename:file});
  let panel=source('panel.js');
  panel = initialize ? panel.replace('// ---------- go ----------\n(async () => {','// ---------- go ----------\nglobalThis.fixtureReady = (async () => {') : panel.slice(0,panel.indexOf('// ---------- go ----------'));
  vm.runInContext(panel+`\nglobalThis.testPanel={S,G,sendToTab,loadAll,applyOptions,getOpts,saveOpts,readOptions,buildVariationPrompt,buildPromptGenerationPrompt,normalizeReferenceContext,checkedPayload,applyTextJobResult,selectionSignature,finalPrompt,normIdea,resetExtension,regenerateResult,renderIdeas,renderAnalysis,copyPromptBatch,syncGenerationStrategy,analyzeReference,presetAction,loadPresets,reviewBeforeCopy,qualityMarkup,regenerateVariation};`,context,{filename:'panel.js'});
  return {context,api:context.testPanel,el,local,session,messages,get writes(){return writes;},set failWrites(v){failWrites=v;},set raw(v){generatedRaw=v;},dispose(){for(const t of timers){clearTimeout(t);clearInterval(t);}}};
}
module.exports={root,source,panelFixture,Element};
