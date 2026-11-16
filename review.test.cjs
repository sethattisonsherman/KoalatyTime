const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function app(){
  const context=vm.createContext({Intl,Date,Set});
  vm.runInContext(fs.readFileSync(__dirname+'/planner.js','utf8'),context);
  const html=fs.readFileSync(__dirname+'/index.html','utf8');
  const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1].replace(/\n    render\(\);\n    loadSharedEstimates\(\);/,'');
  vm.runInContext(script,context);return code=>vm.runInContext(code,context);
}
test('Plans and Review share seven time-based columns and overlapping event lanes',()=>{
  const run=app();
  const html=run(`weekCalendarMarkup([{id:'a',day:0,time:'09:00',durationMinutes:90,title:'A',keep:true},{id:'b',day:0,time:'09:30',durationMinutes:30,title:'B',keep:true}],{separated:true,action:'focusReviewEvent'})`);
  assert.equal((html.match(/class="plan-day"/g)||[]).length,7);
  assert(html.includes('review-timeline'));assert(html.includes('top:37.5%;height:6.25%'));
  assert(html.includes('width:calc(50% - 2px)'));assert(html.includes('data-action="focusReviewEvent"'));
  assert(run('planCalendarMarkup()').includes('plan-week'));
});
test('Before hides additions and downtime; After shows uniquely identified occurrences',()=>{
  const run=app();
  run(`state.items=[Planner.parse('Read daily for 30 minutes')];state.imported=[{day:0,time:'08:00',durationMinutes:60,title:'Meeting',keep:true}];allocate();`);
  assert.equal(run(`reviewEvents().filter(e=>e.kind==='new').length`),7);
  assert.equal(run(`reviewEvents().filter(e=>e.kind==='downtime').length`),7);
  assert.equal(run(`new Set(reviewEvents().map(e=>e.id)).size===reviewEvents().length`),true);
  run(`state.reviewMode='before'`);
  assert.equal(run('reviewEvents().length'),1);
  assert.equal(run(`reviewAgendaMarkup(reviewEvents()).includes('data-occ-day')`),false);
});
test('day details sort all-day plans first and escape titles',()=>{
  const run=app();
  const html=run(`reviewAgendaMarkup([{id:'late',kind:'existing',index:0,title:'Late <script>',day:0,time:'18:00',durationMinutes:60,keep:true},{id:'early',kind:'existing',index:1,title:'Earlier',day:0,time:'08:00',durationMinutes:30,keep:true},{id:'all',kind:'existing',index:2,title:'All-day plan',day:0,time:'00:00',allDay:true,durationMinutes:1440,keep:true}])`);
  assert.equal((html.match(/<details /g)||[]).length,7);
  assert(html.indexOf('All-day plan')<html.indexOf('Earlier'));
  assert(html.indexOf('Earlier')<html.indexOf('Late &lt;script&gt;'));
  assert(html.includes('data-action="togglePlanKeep"'));assert(html.includes('data-action="planTentative"'));
});
test('new activities can be moved to another free day and time',()=>{
  const run=app();run(`state.items=[Planner.parse('Read for 30 minutes')];allocate();`);
  assert.equal(run(`tryMoveOccurrence(0,0,{day:3,time:'17:00'})`),true);
  assert.equal(run('state.items[0].occurrences[0].day'),3);
  assert.equal(run('state.items[0].occurrences[0].time'),'17:00');
  assert.equal(run('state.openReviewDay'),3);
});
test('invalid moves preserve the previous placement and override',()=>{
  const run=app();run(`state.items=[Planner.parse('Read for 30 minutes')];state.imported=[{day:2,time:'10:00',durationMinutes:60,title:'Meeting online',keep:true}];allocate();tryMoveOccurrence(0,0,{day:3,time:'17:00'});`);
  assert.equal(run(`tryMoveOccurrence(0,0,{day:2,time:'10:15'})`),false);
  assert.equal(run('state.items[0].occurrences[0].day'),3);
  assert.equal(run('state.items[0].occurrences[0].time'),'17:00');
  assert.equal(run('state.items[0].overrides[0].day'),3);
  assert.equal(run('state.unplaced.length'),0);
  assert.equal(run(`tryMoveOccurrence(0,0,{day:9,time:'25:00'})`),false);
});
test('existing-plan actions rerender the current review instead of navigating to Plans',()=>{
  const run=app();run(`state.page=4;state.imported=[{title:'Meeting',day:1,keep:true,tentative:false}];let reviewRenders=0;renderReview=()=>reviewRenders++;`);
  run(`actions.togglePlanKeep({currentTarget:{dataset:{id:'0'}}});actions.planTentative({currentTarget:{dataset:{id:'0'}}});`);
  assert.equal(run('reviewRenders'),2);assert.equal(run('state.page'),4);
  assert.equal(run('state.imported[0].keep'),false);assert.equal(run('state.imported[0].tentative'),true);
});
