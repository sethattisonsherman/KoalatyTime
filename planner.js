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
  const dayToken = '(?:mon(?:day)?|tue(?:sday|s)?|wed(?:nesday)?|thu(?:rsday|rs)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|weekend|weekday)s?';
  const dayList = dayToken + '(?:\\s*(?:,?\\s*(?:and|or|nor|&)\\s+|[,/]\\s*|through\\s+|to\\s+|[-–]\\s*)' + dayToken + ')*';
  function expandDays(text) {
    const result = new Set(namedDays(text));
    if (/\bweekends?\b/i.test(text)) { result.add(5); result.add(6); }
    if (/\bweekdays?\b/i.test(text)) for (let day=0;day<5;day++) result.add(day);
    for (const match of text.matchAll(new RegExp('('+dayToken+')\\s*(?:through|to|[-–])\\s*('+dayToken+')','gi'))) {
      const first=namedDays(match[1])[0],last=namedDays(match[2])[0];
      if(first===undefined||last===undefined)continue;
      for(let day=first;;day=(day+1)%7){result.add(day);if(day===last)break;}
    }
    return [...result].sort((a,b)=>a-b);
  }
  // Parse protected windows locally. Keep unmatched wording visible instead of guessing.
  function parseQuiet(raw, defaultDays=allDays) {
    const ranges=[], unknown=[];
    let days=[...defaultDays];
    const token='(?:\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?|noon|midnight)';
    const normalized=raw.toLowerCase().replace(/[’‘]/g,"'").replace(/\b(a|p)\.m\./g,'$1m');
    const clauses=[];
    // Day lists belong together; start a new clause only after a time has appeared.
    for(const part of normalized.split(/[;\n]+/)){
      let previous=0;
      const separators=new RegExp(',\\s*|\\band\\s+(?=(?:before|after|from|between|'+dayToken+'))','gi');
      for(const match of part.matchAll(separators)){
        if(!/\d|noon|midnight|all day|morning|afternoon|evening|night/.test(part.slice(previous,match.index)))continue;
        clauses.push(part.slice(previous,match.index));previous=match.index+match[0].length;
      }
      clauses.push(part.slice(previous));
    }
    for(let clause of clauses){
      if(!clause.trim())continue;
      const explicitDays=expandDays(clause);
      if(explicitDays.length){days=explicitDays.filter(day=>defaultDays.includes(day));if(!days.length)unknown.push('The named day does not match this input.');}
      clause=clause.replace(new RegExp(dayList,'gi'),' ');
      let matched=false;
      const add=(start,end)=>{
        matched=true;
        for(const day of days){
          if(start<end)ranges.push({day,start:clock(start),end:end===1440?'24:00':clock(end)});
          else if(start>end){ranges.push({day,start:clock(start),end:'24:00'});if(end&&(day<6||days.length===7))ranges.push({day:(day+1)%7,start:'00:00',end:clock(end)});}
          else unknown.push('Use different start and end times, or say “all day”.');
        }
      };
      clause=clause.replace(new RegExp('(?:\\bfrom\\s+|\\bbetween\\s+)?('+token+')\\s*(?:to|until|through|[-–—]|and)\\s*('+token+')\\b','gi'),(whole,a,b)=>{
        // “6–8 pm” inherits pm; “9–5” uses the daytime interpretation.
        let start=readTime(a),end=readTime(b);
        if(!/(?:am|pm|noon|midnight)/i.test(a)&&/(?:am|pm)/i.test(b)){
          start=readTime(a+' '+b.match(/am|pm/i)[0]);
          if(start>=end&&start>=720)start-=720;
        }else if(!/(?:am|pm|noon|midnight)/i.test(a+b)&&end<start&&end<720)end+=720;
        if(start===null||end===null){unknown.push(whole);return ' ';}
        add(start,end);return ' ';
      });
      clause=clause.replace(new RegExp('\\b(before|until|after|from)\\s+('+token+')(?:\\s+onward(?:s)?)?\\b','gi'),(whole,side,time)=>{
        const value=readTime(time);
        if(value===null){unknown.push(whole);return ' ';}
        if(side==='before'||side==='until')add(0,/midnight/.test(time)?1440:value);else add(value,1440);
        return ' ';
      });
      clause=clause.replace(/\b(all day|the whole day|mornings?|afternoons?|evenings?|nights?)\b/gi,(_,period)=>{
        const times=/morning/.test(period)?[0,720]:/afternoon/.test(period)?[720,1020]:/evening/.test(period)?[1020,1320]:/night/.test(period)?[1260,1440]:[0,1440];
        add(...times);return ' ';
      });
      const rest=clause.replace(/\b(?:i|we|my|our|am|are|is|have|need|want|would|like|to|please|keep|leave|open|free|busy|unavailable|available|do|don't|not|no|schedule|scheduling|anything|nothing|events?|activities|plans?|on|in|the|at|every|each|day|daily|all|week|whole|for|and|or|of|work|school|sleep|sleeping)\b/g,'').replace(/[\s:.'"!?()–—-]/g,'');
      if(rest||!matched)unknown.push(clause.trim()||'Missing a time window');
    }
    return {ranges,notice:unknown.length?'Please clarify this time: use “9 am to 5 pm”, “before 8 am”, “after 9 pm”, or “all day”.':''};
  }
  function quietRanges(quietTimes) {
    return quietTimes.flatMap((range,day)=>Array.isArray(range)?range.map(value=>({...value,day})):range.start&&range.end?[{...range,day}]:[]);
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
    [/\b(proposals?|projects?|reports?|study|studying|homework|coursework|assignments?|essays?|research|work)\b/i, 'To-do', 90, 0],
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
    const deadlineMatch = take(new RegExp('\\b(?:by|before)\\s+('+dayToken+')\\b','i'));
    const deadline = deadlineMatch ? expandDays(deadlineMatch[1])[0] : null;
    const excluded=[];
    const negative='(?:(?:do|must|should|can)\\s+not|don[’\x27]t|shouldn[’\x27]t|can[’\x27]t|cannot|(?:but\\s+)?not|never|except|excluding|exclude|avoid|no)';
    const exclusionPattern=new RegExp('\\b'+negative+'\\s+(?:(?:to|be|schedule|scheduled|put|place|placed|plan|planned|do|it|this|that|the|event|activity|on|for|during|over)\\s+)*('+dayList+')','gi');
    text=text.replace(exclusionPattern,(_,days)=>{excluded.push(...expandDays(days));return ' ';});
    const unclearExclusion=new RegExp('\\b'+negative+'\\b','i').test(text)&&expandDays(text).length>0;
    // Session lengths describe parts, not extra time added to the task total.
    const chunkMatch=take(/\b(?:(?:in|into|as)\s+)?(?:(\d+)\s*[-–]\s*)?(\d+)\s*[- ]?\s*(?:minutes?|mins?)\s+(?:chunks?|blocks?|sessions?|parts?)\b/i);
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
    const rangeMatch = take(new RegExp('\\b('+dayToken+')\\s*(?:through|to|[-–])\\s*('+dayToken+')\\b','i'));
    const days = namedDays(text);
    if (rangeMatch) {
      for (const day of expandDays(rangeMatch[0])) if(!days.includes(day))days.push(day);
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
    const notice = unclearExclusion?'A day restriction needs clarification. Try “not on Saturday or Sunday”.':/\b(sunrise|sunset|between|weather|before work|after lunch|before dinner|next month|tomorrow|today)\b/i.test(text) ? 'Some timing details need review; no matching rule yet.' : '';
    const splittable=(!!chunkMatch||/\b(homework|projects?|proposal|report|study|studying|coursework|assignment|essay|research)\b/i.test(title))&&! /\b(?:do not|don't|no|without)\s+(?:split|splitting|break|breaking)|\b(?:one|single)\s+(?:sitting|session|block)\b/i.test(original);
    return { raw: original, title, type, duration: `${durationMinutes} min`, durationMinutes, travelMinutes, splittable, family:guessed.family, estimateSource:duration?'Duration provided':guessed.learned?'Shared estimate':guessed.estimated?'Rough estimate':'Activity estimate', recurrence, count, fixedDays, excluded, start, deadline, exactTime, earliest, latest, period, repeatDaily: recurrence === 'daily', summary: notes.join(' · '), notice, priority: /\b(urgent|important|must|asap)\b/i.test(original) ? 1 : 0, occurrences: [], overrides: {} };
  }
  function chunks(item, maximum=45) {
    const duration=Number(item.durationMinutes)||parseInt(item.duration,10);
    if(!item.splittable||item.type!=='To-do'||item.exactTime!==null||item.travelMinutes||duration<=45)return [duration];
    if(maximum===30)return Array.from({length:Math.ceil(duration/30)},(_,index)=>Math.min(30,duration-index*30));
    const count=Math.ceil(duration/45),base=Math.floor(duration/count/5)*5;
    if(base<30)return [30,duration-30];
    let remaining=duration;
    return Array.from({length:count},(_,index)=>{const size=index===count-1?remaining:Math.min(45,base+(remaining>base*(count-index)?5:0));remaining-=size;return size;});
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
    quietRanges(quietTimes).forEach(({day,...range})=>{
      if(!range.start||!range.end)return;
      const start=minutes(range.start),end=minutes(range.end);
      if(start<end)reserve(day,start,end);
      if(start>end){reserve(day,start,1440);reserve(day,0,end);}
      if(start===end)reserve(day,0,1440);
    });
    const jobs=[];
    items.forEach((item,index)=>{
      item.occurrences=[];
      if(item.notice?.startsWith('A day restriction')){unplaced.push({index,title:item.title,reason:item.notice});return;}
      const eligible=(item.fixedDays||selectedDays).filter(day=>!item.excluded.includes(day)&&day>=item.start&&(item.deadline===null||day<=item.deadline));
      const targets=item.fixedDays&&item.recurrence!=='count'?[...eligible]:Array.from({length:Math.min(item.count,100)},()=>null);
      if(!targets.length)unplaced.push({index,title:item.title,reason:'No days match this request.'});
      // Prefer 30-minute parts when the available calendar contains tight openings.
      const tight=eligible.some(day=>{
        let cursor=item.earliest;
        const blocks=[...busy[day],[item.latest,1440]].sort((a,b)=>a[0]-b[0]);
        for(const [start,end] of blocks){const gap=Math.min(start,item.latest)-cursor;if(gap>=30&&gap<45)return true;cursor=Math.max(cursor,end);if(cursor>=item.latest)break;}
        return false;
      });
      const parts=chunks(item,tight?30:45);
      targets.forEach((target,repeatIndex)=>parts.forEach((duration,chunkIndex)=>{
        const occurrenceIndex=repeatIndex*parts.length+chunkIndex;
        jobs.push({item,index,target,occurrenceIndex,repeatIndex,chunkIndex,chunkCount:parts.length,duration,eligible,override:item.overrides?.[occurrenceIndex]});
      }));
    });
    const pinned=job=>!!job.override||job.item.exactTime!==null;
    jobs.sort((a,b)=>Number(pinned(b))-Number(pinned(a))||Number(b.target!==null)-Number(a.target!==null)||b.item.priority-a.item.priority||(a.item.deadline??7)-(b.item.deadline??7)||Number(a.item.type==='Fun')-Number(b.item.type==='Fun'));
    const selected=[...new Set(selectedDays)].sort((a,b)=>a-b);
    const fun=jobs.filter(j=>j.item.type==='Fun').length,todos=jobs.length-fun;
    const activeCount=Math.min(selected.length,Math.max(1,fun,Math.ceil(todos/2)));
    const active=new Set(Array.from({length:activeCount},(_,i)=>selected[Math.floor(i*selected.length/activeCount)]));
    const used=new Map(items.map(item=>[item,new Set()]));
    const place=job=>{
      const {item,index,target,occurrenceIndex,repeatIndex,chunkIndex,chunkCount,duration,eligible,override}=job;
      const travel=item.travelMinutes||0;
      const session=item.recurrence==='count'&&chunkCount>1?item.occurrences.find(occ=>occ.repeatIndex===repeatIndex):null;
      let candidates=override?[override.day]:target!==null?[target]:session?[session.day]:eligible.filter(day=>chunkCount>1&&item.recurrence!=='count'||!used.get(item).has(day));
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
        item.occurrences.push({day,time:clock(start),occurrenceIndex,durationMinutes:duration,repeatIndex,chunkIndex,chunkCount});used.get(item).add(day);
        counts[day][item.type]++;reserve(day,start-travel,start+duration+travel);return;
      }
      unplaced.push({index,title:item.title,reason:(chunkCount>1?`Part ${chunkIndex+1} of ${chunkCount} (${duration} min): `:'')+(override?'The moved activity conflicts with its timing rules, travel, downtime, or another plan.':target!==null?`No free time fits on ${names[target]}, including travel.`:'No free time fits the requested days and hours, including travel and downtime.')});
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
  return {parse, schedule, calibrate, feedback, setModel, parseQuiet, quietRanges, chunks};
})();
