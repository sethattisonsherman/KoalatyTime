const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function planner(){
  const storage=new Map(),context=vm.createContext({localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}});
  vm.runInContext(fs.readFileSync(__dirname+'/planner.js','utf8')+';globalThis.planner=Planner;',context);
  return context.planner;
}
const days=[0,1,2,3,4,5,6],quiet=()=>days.map(()=>({start:'',end:''}));
test('leisure examples and obligations receive appropriate starting estimates',()=>{
  const p=planner();
  for(const title of ['Go climbing','Wandering','Date night','Go bouldering','Go hiking','Play Zelda'])assert.equal(p.parse(title).type,'Fun',title);
  for(const title of ['Finish project proposal','Pay electricity bill','Doctor appointment','Homework','Climbing for work'])assert.equal(p.parse(title).type,'To-do',title);
  assert.equal(p.parse('Date night').durationMinutes,180);
  assert.equal(p.parse('Go climbing').durationMinutes,120);
  assert.equal(p.parse('Wandering').durationMinutes,90);
});
test('duration and travel are separate, explicit duration wins, remote activities need no travel',()=>{
  const p=planner(),a=p.parse('Climbing for 90 minutes, travel 25 minutes each way');
  assert.equal(a.durationMinutes,90);assert.equal(a.travelMinutes,25);
  assert.equal(p.parse('Yoga online').travelMinutes,0);
});
test('shared family estimates transfer to related phrases, explicit durations still win',()=>{
  const p=planner(),a=p.parse('Go climbing');
  p.calibrate(a,{type:'To-do',durationMinutes:105,travelMinutes:30});
  p.setModel({version:1,families:{climbing:{samples:5,type:'Fun',durationMinutes:90,travelMinutes:30}}});
  const b=p.parse('Go bouldering');assert.equal(b.type,'Fun');assert.equal(b.durationMinutes,90);assert.equal(b.travelMinutes,30);
  assert.equal(a.durationMinutes,105);
  assert.equal(p.parse('Go climbing for 45 minutes').durationMinutes,45);
  assert.equal(p.parse('Wandering').type,'Fun');
});
test('feedback excludes titles, unknown activities and special contexts',()=>{
  const p=planner(),schema=require('./estimate-schema.cjs');
  const examples=['Date night','Climbing','Hike','Wandering','Skiing','Cycling','Movie','Dinner','Yoga','Walk','Coffee','Read','Project','Groceries','Laundry','Pay bill','Call Mom'];
  assert.deepEqual(examples.map(title=>p.parse(title).family),schema.families);
  const item=p.parse('Climbing with PRIVATE NAME at PRIVATE ADDRESS for 100 minutes');
  const feedback=p.feedback(item);assert.deepEqual(Object.keys(feedback).sort(),['durationBucket','family','travelBucket','type']);
  assert.equal(feedback.durationBucket,90);assert(!JSON.stringify(feedback).includes('PRIVATE'));
  assert.equal(p.feedback(p.parse('Unrecognized private activity')),null);
  assert.equal(p.feedback(p.parse('Climbing for work')),null);
  assert.equal(p.feedback(p.parse('Yoga online')),null);
});
test('saving an unchanged suggestion does not qualify as a new correction',()=>{
  const p=planner(),item=p.parse('Climbing');
  assert.equal(p.calibrate(item,{type:item.type,durationMinutes:item.durationMinutes,travelMinutes:item.travelMinutes}),false);
  assert.equal(p.calibrate(item,{type:'Fun',durationMinutes:90,travelMinutes:20}),true);
  assert.equal(p.calibrate(item,{type:'Fun',durationMinutes:90,travelMinutes:20}),false);
});
test('21 flexible activities yield two to-dos and one fun activity on every day',()=>{
  const p=planner(),items=[...Array.from({length:14},(_,i)=>p.parse('Task '+i)),...Array.from({length:7},(_,i)=>p.parse('Play game '+i))];
  assert.equal(p.schedule(items,days,quiet(),[]).length,0);
  for(const day of days){const count=type=>items.filter(i=>i.type===type).flatMap(i=>i.occurrences).filter(o=>o.day===day).length;assert.equal(count('To-do'),2);assert.equal(count('Fun'),1);}
});
test('small balanced lists form daily groups spaced across the week',()=>{
  const p=planner(),items=['Pay bill','Email team','Clean room','Laundry','Climbing','Wandering'].map(p.parse);
  p.schedule(items,days,quiet(),[]);
  const occupied=[...new Set(items.flatMap(i=>i.occurrences.map(o=>o.day)))];
  assert(occupied.length>=2);assert(Math.max(...occupied)-Math.min(...occupied)>=3);
  for(const day of occupied){assert.equal(items.filter(i=>i.type==='Fun').flatMap(i=>i.occurrences).filter(o=>o.day===day).length,1);assert.equal(items.filter(i=>i.type==='To-do').flatMap(i=>i.occurrences).filter(o=>o.day===day).length,2);}
});
test('weekday calendar occupancy does not send all new activities to Saturday',()=>{
  const p=planner(),items=Array.from({length:14},(_,i)=>p.parse('Task '+i));
  const imported=days.slice(0,5).map(day=>({day,time:'09:00',durationMinutes:60,title:'Meeting',keep:true}));
  p.schedule(items,days,quiet(),imported);
  assert.equal(new Set(items.flatMap(i=>i.occurrences.map(o=>o.day))).size,7);
});
test('travel buffers reject appointments that only fit without travel',()=>{
  const p=planner(),items=[p.parse('Climbing Monday at 11 am for 60 minutes')];
  const imported=[{title:'Meeting online',day:0,time:'10:00',durationMinutes:60,keep:true}];
  assert.equal(p.schedule(items,days,quiet(),imported).length,1);
  assert.equal(items[0].occurrences.length,0);
});
test('downtime respects fixed appointments, and can be turned off',()=>{
  const p=planner(),items=[p.parse('Read Monday at 8:30 pm for 30 minutes')],downtime=[];
  assert.equal(p.schedule(items,days,quiet(),[],{downtime}).length,0);
  assert.equal(downtime.length,7);
  assert.notEqual(downtime.find(d=>d.day===0).time,'20:30');
  p.schedule(items,days,quiet(),[],{downtime,downtimeMinutes:0});assert.equal(downtime.length,0);
});
test('a requested start time without a day takes priority over preferred downtime',()=>{
  const p=planner(),items=[p.parse('Read at 8:30 pm for 30 minutes')],downtime=[];
  assert.equal(p.schedule(items,days,quiet(),[],{downtime}).length,0);
  const occurrence=items[0].occurrences[0];assert.equal(occurrence.time,'20:30');
  assert.notEqual(downtime.find(d=>d.day===occurrence.day).time,'20:30');
});
test('selected days, repeated requests, deadlines, and exclusions remain constraints',()=>{
  const p=planner(),items=[p.parse('Read three times this week except Sunday'),p.parse('Finish report by Wednesday')];
  assert.equal(p.schedule(items,[0,2,4,6],quiet(),[]).length,0);
  assert.equal(items[0].occurrences.length,3);
  for(const o of items[0].occurrences)assert([0,2,4].includes(o.day));
  assert(items[1].occurrences[0].day<=2);
});
test('unavailable time and all-day plans are never overbooked',()=>{
  const p=planner(),items=[p.parse('Climbing Monday')],downtime=[];
  const imported=[{title:'Away',allDay:true,day:0,time:'00:00',durationMinutes:1440,keep:true}];
  assert.equal(p.schedule(items,[0],quiet(),imported,{downtime}).length,1);
  assert.equal(downtime.length,0);assert.equal(items[0].occurrences.length,0);
});
