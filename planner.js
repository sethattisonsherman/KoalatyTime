// Titles stay in the browser. Shared learning accepts only fixed family IDs and numeric buckets.
const Planner = (() => {
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayPattern = /\b(mon(?:day)?|tue(?:sday|s)?|wed(?:nesday)?|thu(?:rsday|rs)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?:s)?\b/gi;
  const numbers = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
  const number = value => numbers[value] || Number(value);
  const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  function readTime(value) {
    if (/noon/i.test(value)) return 720;
    if (/midnight/i.test(value)) return 0;
    const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!match) return null;
    let hour = +match[1];
    const minute = +(match[2] || 0), suffix = (match[3] || '').toLowerCase();
    if (minute > 59 || hour > (suffix ? 12 : 23) || (suffix && hour === 0)) return null;
    if (suffix) hour = hour % 12 + (suffix === 'pm' ? 12 : 0);
    return hour * 60 + minute;
  }
  function namedDays(text) {
    return [...new Set([...text.matchAll(dayPattern)].map(match => names.findIndex(day => day.toLowerCase() === match[1].slice(0, 3).toLowerCase())))].sort((a, b) => a - b);
  }
  // Starting estimates, not measured facts. Specific activities precede general verbs.
  const profiles = [
    [/\b(date night|romantic dinner)\b/i, 'Fun', 180, 20],
    [/\b(climb(?:ing)?|boulder(?:ing)?)\b/i, 'Fun', 120, 20],
    [/\b(hik(?:e|ing)|trail)\b/i, 'Fun', 180, 30],
    [/\b(wander(?:ing)?|explor(?:e|ing)|stroll(?:ing)?)\b/i, 'Fun', 90, 15],
    [/\b(ski(?:ing)?|snowboard(?:ing)?|kayak(?:ing)?|camp(?:ing)?|beach)\b/i, 'Fun', 180, 30],
    [/\b(bik(?:e|ing)|cycling|soccer|tennis|basketball|bowling|danc(?:e|ing)|skating)\b/i, 'Fun', 90, 15],
    [/\b(movie|cinema|concert|theat(?:er|re))\b/i, 'Fun', 120, 20],
    [/\b(dinner|ramen|restaurant|brunch|lunch out)\b/i, 'Fun', 90, 20],
    [/\b(pickleball|gym|swim(?:ming)?|yoga|exercise|workout)\b/i, 'Fun', 60, 15],
    [/\b(walk(?:ing)?|run(?:ning)?)\b/i, 'Fun', 45, 0],
    [/\b(friends|picnic|museum|coffee|visit|hang out|meet up)\b/i, 'Fun', 90, 15],
    [/\b(play|zelda|gam(?:e|ing)|read(?:ing)?|paint(?:ing)?|draw(?:ing)?|bak(?:e|ing)|cook(?:ing)?|relax|music|guitar|piano|practice)\b/i, 'Fun', 60, 0],
    [/\b(proposal|project|report|study|homework|work)\b/i, 'To-do', 90, 0],
    [/\b(appointment|dentist|doctor|errands?|groceries|shopping)\b/i, 'To-do', 60, 20],
    [/\b(clean(?:ing)?|laundry|chores?|repair)\b/i, 'To-do', 45, 0],
    [/\b(bills?|pay|submit|email)\b/i, 'To-do', 20, 0],
    [/\bcall\b/i, 'To-do', 20, 0]
  ];
  const familyIds=['date-night','climbing','hiking','wandering','outdoors','sports','entertainment','dining','fitness','walking','social','hobbies','focused-work','errands','household','administration','communication'];
  const durationBuckets=[5,10,15,20,30,45,60,90,120,150,180,240,300,360,480,720,1440];
  const travelBuckets=[0,5,10,15,20,30,45,60,90,120,180];
  let sharedModel={};
  // Remove legacy title-based preferences; only aggregate learning is persisted now.
  try{localStorage.removeItem('sunday.activity-estimates.v1');}catch{}
  function setModel(model){
    const valid={};
    if(model?.version===1)for(const [family,value]of Object.entries(model.families||{})){
      if(familyIds.includes(family)&&value.samples>=5&&[null,'Fun','To-do'].includes(value.type)&&durationBuckets.includes(value.durationMinutes)&&travelBuckets.includes(value.travelMinutes))valid[family]=value;
    }
    sharedModel=valid;
  }
  const nearest=(n,buckets)=>buckets.reduce((best,v)=>Math.abs(v-n)<Math.abs(best-n)?v:best,buckets[0]);
  function feedback(item){
    if(!familyIds.includes(item.family))return null;
    return {family:item.family,type:item.type,durationBucket:nearest(item.durationMinutes,durationBuckets),travelBucket:nearest(item.travelMinutes||0,travelBuckets)};
  }
  function estimate(text) {
    const profile=profiles.find(([pattern])=>pattern.test(text));
    const family=profile?familyIds[profiles.indexOf(profile)]:null, learned=sharedModel[family];
    let type=learned?.type || profile?.[1] || 'To-do', duration=learned?.durationMinutes || profile?.[2] || 45, travel=learned?.travelMinutes ?? profile?.[3] ?? 0;
    if (/\b(homework|chores?|errands?|appointment|must|submit|deadline|for work)\b/i.test(text)) type='To-do';
    if (/\b(quick|brief|short)\b/i.test(text)) duration=Math.max(15,Math.round(duration*.5/5)*5);
    if (/\b(long|extended)\b/i.test(text)) duration=Math.round(duration*1.5/5)*5;
    if (/\b(at home|from home|online|virtual|remote)\b/i.test(text)) travel=0;
    const contextual=/\b(homework|chores?|errands?|appointment|must|submit|deadline|for work|quick|brief|short|long|extended|at home|from home|online|virtual|remote)\b/i.test(text);
    return {type,duration,travel,family:contextual?null:family,learned:!!learned,estimated:!profile};
  }
  function calibrate(item, values) {
    const before=[item.type,item.durationMinutes,item.travelMinutes||0].join(':');
    item.type=values.type==='Fun'?'Fun':'To-do';
    item.durationMinutes=Math.max(5,Math.min(1440,Math.round(Number(values.durationMinutes)||45)));
    item.duration=String(item.durationMinutes)+' min';
    item.travelMinutes=Math.max(0,Math.min(180,Math.round(Number(values.travelMinutes)||0)));
    item.estimateSource='Your estimate';item.occurrences=[];item.overrides={};
    return before!==[item.type,item.durationMinutes,item.travelMinutes].join(':');
  }
  function parse(raw) {
    let text = raw.trim().replace(/\s+/g, ' ');
    const original = text;
    const take = pattern => { let found; text = text.replace(pattern, (...args) => { found = args; return ' '; }); return found; };
    const travelMatch=take(/\b(?:travel|commute)\s+(\d+)\s*(?:minutes?|mins?)(?:\s+each way)?\b/i);
    // Remove deadlines and exclusions before interpreting named days as event dates.
    const deadlineMatch = take(/\b(?:by|before)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    const deadline = deadlineMatch ? namedDays(deadlineMatch[1])[0] : null;
    const excludedMatch = take(/\b(?:except|excluding|but not)\s+((?:(?:mon\w*|tue\w*|wed\w*|thu\w*|fri\w*|sat\w*|sun\w*|weekends?|weekdays?)(?:\s*(?:,|and|&)\s*|\s*)?)+)/i);
    let excluded = excludedMatch ? namedDays(excludedMatch[1]) : [];
    if (excludedMatch && /weekends?/i.test(excludedMatch[1])) excluded.push(5, 6);
    if (excludedMatch && /weekdays?/i.test(excludedMatch[1])) excluded.push(0, 1, 2, 3, 4);
    const startMatch = take(/\bstarting\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    const start = startMatch ? namedDays(startMatch[1])[0] : 0;
    let duration = 0;
    const half = take(/\b(?:for\s+)?(?:half an? hour|half hour)\b/i);
    if (half) duration += 30;
    text = text.replace(/\b(?:for\s+)?(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|a|an)\s*(hours?|hrs?|h|minutes?|mins?)\b/gi, (_, n, unit) => { duration += number(n.toLowerCase()) * (/^h/i.test(unit) ? 60 : 1); return ' '; });
    const timeToken = '(?:\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)|\\d{1,2}:\\d{2}|noon|midnight)';
    const timeMatch = take(new RegExp('\\b(at|after|before)\\s+(' + timeToken + ')\\b', 'i'));
    let exactTime = null, earliest = 480, latest = 1320;
    const periodMatch = take(/(?<!date )\b(?:(?:in the|every|each)\s+)?(mornings?|afternoons?|evenings?|nights?)\b/i);
    const period = periodMatch ? periodMatch[1].toLowerCase().replace(/s$/, '') : null;
    if (period === 'morning') { earliest = 480; latest = 720; }
    if (period === 'afternoon') { earliest = 720; latest = 1020; }
    if (period === 'evening' || period === 'night') { earliest = 1020; latest = 1320; }
    if (timeMatch) {
      const time = readTime(timeMatch[2]);
      if (time !== null) {
        if (timeMatch[1].toLowerCase() === 'at') { exactTime = time; earliest = 0; latest = 1440; }
        if (timeMatch[1].toLowerCase() === 'after') earliest = time;
        if (timeMatch[1].toLowerCase() === 'before') latest = time;
      }
    }
    const afterWork = take(/\bafter work\b/i);
    if (afterWork && exactTime === null) { earliest = 1080; latest = 1320; }
    const intervalMatch = take(/\bevery (?:other day|(?:two|2|three|3) days)\b/i);
    const dailyMatch = take(/\b(?:daily|every day|each day)\b/i);
    const weekdayMatch = take(/\b(?:(?:on|every|each)\s+)?weekdays?\b/i);
    const weekendMatch = take(/\b(?:(?:on|every|each)\s+)?weekends?\b/i);
    const countMatch = take(/\b(?:(once|twice)|((?:one|two|three|four|five|six|seven|\d+))\s*(?:times|x))\s*(?:(?:a|per|this|each|every)\s+week|weekly)?\b/i);
    const onceWeek = take(/\bweekly\b/i);
    const rangeMatch = take(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*(?:through|to|-)\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    const days = namedDays(text);
    if (rangeMatch) {
      const first=namedDays(rangeMatch[1])[0], last=namedDays(rangeMatch[2])[0];
      for (let n=first; ; n=(n+1)%7) { if(!days.includes(n)) days.push(n); if(n===last) break; }
      days.sort((a,b)=>a-b);
    }
    let recurrence = 'once', count = 1, fixedDays = null;
    if (intervalMatch) { recurrence = 'interval'; const stride = /three|3/.test(intervalMatch[0]) ? 3 : 2; fixedDays = allDays.filter(day => day >= start && (day - start) % stride === 0); }
    else if (dailyMatch || (periodMatch && /every|each/i.test(periodMatch[0]))) { recurrence = 'daily'; fixedDays = [...allDays]; }
    else if (days.length) { recurrence = 'days'; fixedDays = days; }
    else if (weekdayMatch) { recurrence = 'days'; fixedDays = [0, 1, 2, 3, 4]; }
    else if (weekendMatch) { recurrence = 'days'; fixedDays = [5, 6]; }
    if (countMatch) { count = countMatch[1] ? (/twice/i.test(countMatch[1]) ? 2 : 1) : number(countMatch[2].toLowerCase()); recurrence = 'count'; }
    if (onceWeek && !countMatch && !fixedDays) count = 1;
    if (fixedDays) fixedDays = fixedDays.filter(day => !excluded.includes(day) && day >= start && (deadline === null || day <= deadline));
    text = text.replace(dayPattern, ' ').replace(/\b(?:on|and|every|each)\s*(?=,|$)/gi, ' ').replace(/^[\s,&]+|[\s,&]+$/g, '').replace(/\s+/g, ' ').trim();
    const title = text || original;
    const guessed=estimate(title);
    const type = guessed.type;
    const durationMinutes = Math.max(1, Math.round(duration || guessed.duration));
    const travelMinutes=travelMatch?Math.min(180,+travelMatch[1]):guessed.travel;
    const notes = [];
    notes.push(recurrence === 'daily' ? 'Daily' : recurrence === 'interval' ? 'Every ' + (/three|3/.test(intervalMatch[0]) ? '3 days' : 'other day') : fixedDays && recurrence !== 'count' ? fixedDays.map(day => names[day]).join(', ') || 'No matching days' : count > 1 ? `${count} times this week` : 'Once this week');
    if (period) notes.push(period);
    if (startMatch) notes.push('starting ' + names[start]);
    if (afterWork) notes.push('after work');
    if (timeMatch) notes.push(timeMatch[0].trim());
    if (deadlineMatch) notes.push('by ' + names[deadline]);
    if (excluded.length) notes.push('except ' + [...new Set(excluded)].map(day => names[day]).join(', '));
    const notice = /\b(sunrise|sunset|between|weather|before work|after lunch|before dinner|next month|tomorrow|today)\b/i.test(text) ? 'Some timing details need review; no matching rule yet.' : '';
    return { raw: original, title, type, duration: `${durationMinutes} min`, durationMinutes, travelMinutes, family:guessed.family, estimateSource:duration?'Duration provided':guessed.learned?'Shared estimate':guessed.estimated?'Rough estimate':'Activity estimate', recurrence, count, fixedDays, excluded, start, deadline, exactTime, earliest, latest, period, repeatDaily: recurrence === 'daily', summary: notes.join(' · '), notice, priority: /\b(urgent|important|must|asap)\b/i.test(original) ? 1 : 0, occurrences: [], overrides: {} };
  }
  function schedule(items, selectedDays, quietTimes, imported, options={}) {
    const busy=allDays.map(()=>[]), counts=allDays.map(()=>({'Fun':0,'To-do':0})), unplaced=[];
    const downtime=options.downtime || [];downtime.length=0;
    const downtimeMinutes=Math.max(0,Math.min(120,Number(options.downtimeMinutes??30)));
    const reserve=(day,start,end)=>{
      if(day<0||day>6||end<=start)return;
      busy[day].push([Math.max(0,start),Math.min(1440,end)]);
      if(start<0&&day>0)busy[day-1].push([1440+start,1440]);
      if(end>1440&&day<6)busy[day+1].push([0,end-1440]);
    };
    const free=(day,start,end)=>start>=0&&end<=1440&&!busy[day].some(([a,b])=>start<b&&end>a);
    imported.filter(e=>e.keep).forEach(e=>{
      const travel=e.allDay?0:e.travelMinutes??estimate(e.title).travel;
      reserve(e.day,minutes(e.time)-travel,minutes(e.time)+(e.durationMinutes||60)+travel);
    });
    quietTimes.forEach((range,day)=>{
      if(!range.start||!range.end)return;
      const start=minutes(range.start),end=minutes(range.end);
      if(start<end)reserve(day,start,end);
      if(start>end){reserve(day,start,1440);reserve(day,0,end);}
      if(start===end)reserve(day,0,1440);
    });
    const jobs=[];
    items.forEach((item,index)=>{
      item.occurrences=[];
      const eligible=(item.fixedDays||selectedDays).filter(day=>!item.excluded.includes(day)&&day>=item.start&&(item.deadline===null||day<=item.deadline));
      const targets=item.fixedDays&&item.recurrence!=='count'?[...eligible]:Array.from({length:Math.min(item.count,100)},()=>null);
      if(!targets.length)unplaced.push({index,title:item.title,reason:'No days match this request.'});
      targets.forEach((target,occurrenceIndex)=>jobs.push({item,index,target,occurrenceIndex,eligible,override:item.overrides?.[occurrenceIndex]}));
    });
    const pinned=job=>!!job.override||job.item.exactTime!==null;
    jobs.sort((a,b)=>Number(pinned(b))-Number(pinned(a))||Number(b.target!==null)-Number(a.target!==null)||b.item.priority-a.item.priority||(a.item.deadline??7)-(b.item.deadline??7)||Number(a.item.type==='Fun')-Number(b.item.type==='Fun'));
    const selected=[...new Set(selectedDays)].sort((a,b)=>a-b);
    const fun=jobs.filter(j=>j.item.type==='Fun').length,todos=jobs.length-fun;
    const activeCount=Math.min(selected.length,Math.max(1,fun,Math.ceil(todos/2)));
    const active=new Set(Array.from({length:activeCount},(_,i)=>selected[Math.floor(i*selected.length/activeCount)]));
    const used=new Map(items.map(item=>[item,new Set()]));
    const place=job=>{
      const {item,index,target,occurrenceIndex,eligible,override}=job;
      const duration=Number(item.durationMinutes)||parseInt(item.duration,10),travel=item.travelMinutes||0;
      let candidates=override?[override.day]:target!==null?[target]:eligible.filter(day=>!used.get(item).has(day));
      if(override)candidates=candidates.filter(day=>allDays.includes(day)&&!item.excluded.includes(day)&&day>=item.start&&(item.deadline===null||day<=item.deadline)&&(!item.fixedDays||item.fixedDays.includes(day)));
      if(target===null&&!override){
        const score=day=>{
          const c=counts[day],quota=item.type==='Fun'?1:2;
          const ratio=Math.abs(c['To-do']+Number(item.type==='To-do')-2*(c.Fun+Number(item.type==='Fun')));
          return c[item.type]/quota+(active.has(day)?0:.75)+ratio*.01+(c.Fun+c['To-do'])*.001;
        };
        candidates.sort((a,b)=>score(a)-score(b)||a-b);
      }
      for(const day of candidates){
        const exact=override?minutes(override.time):item.exactTime;
        const preferred=item.period||exact!==null?item.earliest:item.type==='Fun'?1080:540;
        const slots=exact!==null?[exact]:[...new Set([preferred,...Array.from({length:96},(_,i)=>i*15)])];
        const start=slots.find(time=>time-travel>=item.earliest&&time+duration+travel<=item.latest&&free(day,time-travel,time+duration+travel));
        if(start===undefined)continue;
        item.occurrences.push({day,time:clock(start),occurrenceIndex});used.get(item).add(day);
        counts[day][item.type]++;reserve(day,start-travel,start+duration+travel);return;
      }
      unplaced.push({index,title:item.title,reason:override?'The moved activity conflicts with its timing rules, travel, downtime, or another plan.':target!==null?`No free time fits on ${names[target]}, including travel.`:'No free time fits the requested days and hours, including travel and downtime.'});
    };
    jobs.filter(pinned).forEach(place);
    // Fixed appointments win; protect rest before filling the remaining openings.
    if(downtimeMinutes)for(const day of selected){
      const starts=[1230,...Array.from({length:17},(_,i)=>1080+i*15),...Array.from({length:40},(_,i)=>480+i*15)];
      const start=starts.find(t=>t+downtimeMinutes<=1320&&free(day,t,t+downtimeMinutes));
      if(start!==undefined){reserve(day,start,start+downtimeMinutes);downtime.push({day,time:clock(start),durationMinutes:downtimeMinutes,title:'Downtime'});}
    }
    jobs.filter(job=>!pinned(job)).forEach(place);
    return unplaced;
  }
  return {parse, schedule, calibrate, feedback, setModel};
})();
