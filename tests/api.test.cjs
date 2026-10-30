const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {source}=require('./helpers.cjs');
function apiFixture(settings, fetch, clocks={}){
 const context=vm.createContext({fetch,console,AbortController,AbortSignal,Response,TextEncoder,Uint8Array,URL,Date,setTimeout:clocks.setTimeout||setTimeout,clearTimeout:clocks.clearTimeout||clearTimeout});
 vm.runInContext(source('models.js'),context);vm.runInContext(source('fast-models.js'),context);vm.runInContext(source('text-api.js'),context);
 return context.MerchTextAPI.create(settings);
}
function json(body,status=200,headers={}){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});}
test('Claude built-in and Fast routing use currently supported model IDs',()=>{
 const context=vm.createContext({fetch,console,AbortController,AbortSignal,Response,TextEncoder,Uint8Array,URL,Date,setTimeout,clearTimeout});
 vm.runInContext(source('models.js'),context);vm.runInContext(source('fast-models.js'),context);
 assert.equal(context.MerchModels.catalog('anthropic').map(model=>model.id).join(','),'claude-haiku-4-5-20251001,claude-sonnet-4-6,claude-sonnet-5');
 assert.equal(context.MerchFastModels.anthropic.join(','),'claude-haiku-4-5-20251001,claude-sonnet-4-6');
});
test('OpenAI analysis transmits reference to the existing text API and receives JSON',async()=>{
 let sent;const api=apiFixture({provider:'openai',apiKey:'fake-openai-key',textModel:'gpt-4o-mini'},async(url,options)=>{sent={url,options,body:JSON.parse(options.body)};return json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"reference":{},"ideas":[]}'}]}]});});
 const raw=await api.generate('Return JSON reference analysis','data:image/png;base64,fixture');assert.match(raw,/reference/);assert.match(sent.url,/responses/);assert.ok(sent.options.signal);assert.equal(sent.body.input[0].content[1].type,'input_image');assert.equal(sent.body.model,'gpt-4o-mini');
 assert.equal(sent.body.size,undefined);assert.equal(sent.body.background,undefined); // Text target controls are not fake image API parameters.
});
test('OpenAI Responses compatibility retry reuses the same deadline signal',async()=>{
 const calls=[];const api=apiFixture({provider:'openai',apiKey:'fake-key',textModel:'gpt-5'},async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return calls.length===1?json({error:{message:'Unsupported reasoning parameter',param:'reasoning'}},400):json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"ideas":[]}'}]}]});});
 assert.equal(await api.generate('JSON prompts',''),' {"ideas":[]}'.trim());assert.equal(calls.length,2);assert.equal(calls[0].options.signal,calls[1].options.signal);assert.equal(calls[1].body.reasoning,undefined);
});
test('Anthropic uses the existing messages integration with inline reference',async()=>{
 let sent;const api=apiFixture({provider:'anthropic',claudeKey:'fake-claude-key',textModel:'claude-sonnet-5'},async(url,options)=>{sent={url,options,body:JSON.parse(options.body)};return json({content:[{type:'text',text:'{"ideas":[]}'}]});});
 await api.generate('JSON analysis','data:image/png;base64,fixture');assert.match(sent.url,/anthropic.com\/v1\/messages/);assert.equal(sent.body.messages[0].content[0].source.type,'base64');assert.ok(sent.options.signal);
});
test('Gemini uses generateContent, inline reference, selected model and an abort signal',async()=>{
 let sent;const api=apiFixture({provider:'google',googleKey:'fake-google-key',textModel:'gemini-2.5-flash'},async(url,options)=>{sent={url,options,body:JSON.parse(options.body)};return json({candidates:[{content:{parts:[{text:'{"ideas":[]}'}]}}]});});
 await api.generate('JSON analysis','data:image/png;base64,fixture');assert.match(sent.url,/gemini-2.5-flash:generateContent/);assert.equal(sent.body.contents[0].parts[0].inline_data.mime_type,'image/png');assert.ok(sent.options.signal);assert.equal(sent.body.generationConfig.responseMimeType,'application/json');
});
test('missing keys, empty responses, rate limits, malformed/provider errors and network failures reject',async()=>{
 await assert.rejects(apiFixture({provider:'openai'},async()=>{throw Error('must not fetch');}).generate('JSON',''),/API key/);
 const cases=[{response:()=>json({choices:[]}),pattern:/no prompt text/},{response:()=>json({error:{message:'Rate limit reached'}},429),pattern:/Rate limit/},{response:()=>new Response('not JSON',{status:502}),pattern:/OpenAI error 502/},{response:()=>Promise.reject(new TypeError('Network unavailable')),pattern:/Network unavailable/}];
 for(const c of cases)await assert.rejects(apiFixture({provider:'openai',apiKey:'fake-key',textModel:'gpt-4o-mini'},c.response).generate('JSON',''),c.pattern);
 await assert.rejects(apiFixture({provider:'google',googleKey:'fake',textModel:'gemini-2.5-flash'},async()=>json({candidates:[]})).generate('JSON',''),/returned no text/);
});
test('60-second total deadline aborts fetch and rejects; no late success',async()=>{
 const timers=[];let signal;
 const clocks={setTimeout:(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer;},clearTimeout:()=>{}};
 const api=apiFixture({provider:'openai',apiKey:'fake-key',textModel:'gpt-4o-mini'},async(_,options)=>{signal=options.signal;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));},clocks);
 const pending=api.generate('JSON','');assert.equal(timers[0].ms,60000);timers[0].fn();await assert.rejects(pending,/stopped after 60 seconds/);assert.equal(signal.aborted,true);
});
test('expired deadline makes no request; Gemini retry backoff is canceled by the same deadline',async()=>{
 let calls=0;const expired=apiFixture({provider:'openai',apiKey:'fake-key'},async()=>{calls++;});await assert.rejects(expired.generate('JSON','',{deadline:Date.now()-1}),/60 seconds/);assert.equal(calls,0);
 const timers=[];let fetchSignal;
 const clocks={setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeout:()=>{}};
 const api=apiFixture({provider:'google',googleKey:'fake-key',textModel:'gemini-2.5-flash'},async(_,opts)=>{calls++;fetchSignal=opts.signal;return json({error:{message:'Too many requests',status:'RESOURCE_EXHAUSTED'}},429);},clocks);
 const pending=api.generate('JSON','');await new Promise(resolve=>setImmediate(resolve));assert.ok(timers.some(x=>x.ms>=800&&x.ms<1000));timers[0].fn();await assert.rejects(pending,/60 seconds/);assert.equal(fetchSignal.aborted,true);assert.equal(calls,1);
});
test('API error messages redact configured credentials',async()=>{
 const key='fixture-secret-never-output';const api=apiFixture({provider:'openai',apiKey:key,textModel:'gpt-4o-mini'},async()=>json({error:{message:`Invalid credential ${key}`}},401));
 await assert.rejects(api.generate('JSON',''),e=>e.message.includes('[redacted]')&&!e.message.includes(key));
});

test('legacy chat models continue to use Chat Completions',async()=>{
 let sent;const api=apiFixture({provider:'openai',apiKey:'fake-key',textModel:'gpt-4-turbo'},async(url,options)=>{sent={url,body:JSON.parse(options.body)};return json({choices:[{message:{content:'{"ideas":[]}'}}]});});
 assert.equal(await api.generate('Return JSON','data:image/png;base64,fixture'),'{"ideas":[]}');assert.match(sent.url,/chat\/completions/);assert.equal(sent.body.messages[0].content[1].type,'image_url');
});
test('Anthropic empty and truncated output get actionable errors',async()=>{
 const settings={provider:'anthropic',claudeKey:'fake-key',textModel:'claude-sonnet-5'};
 await assert.rejects(apiFixture(settings,async()=>json({content:[]})).generate('JSON',''),/returned no text/);
 await assert.rejects(apiFixture(settings,async()=>json({stop_reason:'max_tokens',content:[{type:'text',text:'{"ideas":['}]})).generate('JSON',''),/fewer variations/);
});
test('Fast rotates Gemini models on errors without changing provider or key',async()=>{
 const models=[];const api=apiFixture({provider:'google',googleKey:'fake-key',strategy:'fast',textModel:'saved-choice'},async(url,opts)=>{models.push(url);assert.equal(opts.headers['x-goog-api-key'],'fake-key');return models.length===1?json({error:{message:'Busy',status:'UNAVAILABLE'}},503):json({candidates:[{content:{parts:[{text:'{"ideas":[{"concept":"valid"}]}'}]}}]});});
 await api.generate('JSON','',{expectedCount:1});assert.equal(models.length,2);assert.match(models[0],/gemini-3.5-flash-lite/);assert.match(models[1],/gemini-3.1-flash-lite/);assert.equal(api.modelInfo().model,'gemini-3.1-flash-lite');assert.equal(api.fallbackUsed(),true);
});
test('Fast retries malformed JSON but stops on invalid keys',async()=>{
 let calls=0;const api=apiFixture({provider:'google',googleKey:'fake-key',strategy:'fast'},async()=>{calls++;return json({candidates:[{content:{parts:[{text:calls===1?'not json':'{"ideas":[{}]}'}]}}]});});await api.generate('JSON','',{expectedCount:1});assert.equal(calls,2);
 calls=0;const invalid=apiFixture({provider:'google',googleKey:'fake-key',strategy:'fast'},async()=>{calls++;return json({error:{message:'API key not valid',status:'INVALID_ARGUMENT'}},400);});await assert.rejects(invalid.generate('JSON',''),/API key not valid/);assert.equal(calls,1);
});
