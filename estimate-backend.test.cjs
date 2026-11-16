const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {once}=require('node:events');
const {createStore,validFeedback}=require('./estimate-store.cjs');
const {createServer}=require('./server.cjs');
const sample={family:'climbing',type:'Fun',durationBucket:90,travelBucket:20};
async function fixture(t){
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'sunday-estimates-')),file=path.join(directory,'aggregate.json');
  t.after(async()=>{for(const f of [file,file+'.tmp'])await fs.unlink(f).catch(e=>{if(e.code!=='ENOENT')throw e;});await fs.rmdir(directory);});
  return {file,store:await createStore(file)};
}
test('learning activates at five contributions and persists only histograms',async t=>{
  const {store,file}=await fixture(t);
  for(let i=0;i<4;i++)await store.contribute(sample);
  assert.deepEqual(store.model().families,{});
  await store.contribute({...sample,type:'To-do',durationBucket:1440,travelBucket:180});
  assert.deepEqual(store.model().families.climbing,{samples:5,type:'Fun',durationMinutes:90,travelMinutes:20});
  const stored=JSON.parse(await fs.readFile(file,'utf8'));
  assert.deepEqual(Object.keys(stored).sort(),['families','version']);
  assert.deepEqual(stored.families.climbing,{fun:4,todo:1,durations:{90:4,1440:1},travel:{20:4,180:1}});
  assert.deepEqual((await createStore(file)).model(),store.model());
});
test('concurrent contributions are not lost',async t=>{
  const {store}=await fixture(t);await Promise.all(Array.from({length:20},()=>store.contribute(sample)));
  assert.equal(store.model().families.climbing.samples,20);
});
test('only predefined fields, families and buckets are accepted',async t=>{
  const {store,file}=await fixture(t);
  for(const value of [null,[],{...sample,title:'Private appointment'},{...sample,userId:'123'},{...sample,family:'Unknown private title'},{...sample,durationBucket:91},{...sample,type:'Other'},{...sample,travelBucket:-1}]){
    assert(!validFeedback(value));await assert.rejects(store.contribute(value));
  }
  await assert.rejects(fs.access(file));
});
test('HTTP enforces origin, content type, request size, and private-field rejection',async t=>{
  const {store}=await fixture(t),server=createServer(store);server.listen(0,'localhost');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const origin='http://localhost:'+server.address().port;
  const post=(body,headers={})=>fetch(origin+'/api/estimate-feedback',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  assert.equal((await post(sample,{Origin:'https://other.example'})).status,403);
  assert.equal((await post(sample,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await post({...sample,title:'Private'})).status,400);
  assert.equal((await post({...sample,title:'x'.repeat(2000)})).status,413);
  assert.equal((await post(sample)).status,200);
  const result=await (await fetch(origin+'/api/estimate-model')).json();assert.deepEqual(result.families,{});
  assert.equal((await fetch(origin+'/data/estimate-aggregates.json')).status,404);
});
test('failed persistence does not teach a model or prevent a later retry',async t=>{
  const {file}=await fixture(t);
  // Use a valid store first, then make its parent unwritable as a directory.
  const live=await createStore(file);await fs.mkdir(file+'.tmp');
  await assert.rejects(live.contribute(sample));assert.deepEqual(live.model().families,{});
  await fs.rmdir(file+'.tmp');await live.contribute(sample);
  const data=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(data.families.climbing.fun,1);
});
