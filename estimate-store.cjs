const fs=require('node:fs/promises');
const path=require('node:path');
const schema=require('./estimate-schema.cjs');
function validFeedback(v){return v&&Object.keys(v).sort().join(',')==='durationBucket,family,travelBucket,type'&&schema.families.includes(v.family)&&['Fun','To-do'].includes(v.type)&&schema.durations.includes(v.durationBucket)&&schema.travel.includes(v.travelBucket);}
function validCount(n){return Number.isSafeInteger(n)&&n>=0&&n<=1000000;}
function validHistogram(hist,buckets){return hist&&typeof hist==='object'&&Object.entries(hist).every(([key,n])=>buckets.includes(Number(key))&&String(Number(key))===key&&validCount(n));}
function validState(state){
  return state?.version===1&&state.families&&Object.keys(state).sort().join(',')==='families,version'&&Object.entries(state.families).every(([key,v])=>
    schema.families.includes(key)&&v&&Object.keys(v).sort().join(',')==='durations,fun,todo,travel'&&validCount(v.fun)&&validCount(v.todo)&&v.fun+v.todo<=1000000&&validHistogram(v.durations,schema.durations)&&validHistogram(v.travel,schema.travel)&&
    Object.values(v.durations).reduce((a,b)=>a+b,0)===v.fun+v.todo&&Object.values(v.travel).reduce((a,b)=>a+b,0)===v.fun+v.todo);
}
function median(hist){
  const values=Object.entries(hist).sort((a,b)=>Number(a[0])-Number(b[0]));
  const halfway=Math.ceil(values.reduce((sum,[,n])=>sum+n,0)/2);let n=0;
  for(const [bucket,count]of values){n+=count;if(n>=halfway)return Number(bucket);}
}
async function createStore(filename){
  let state={version:1,families:{}},queue=Promise.resolve();
  try{const loaded=JSON.parse(await fs.readFile(filename,'utf8'));if(!validState(loaded))throw Error('Invalid aggregate estimate store');state=loaded;}
  catch(error){if(error.code!=='ENOENT')throw error;}
  return {
    model(){
      const families={};
      for(const [key,v]of Object.entries(state.families)){
        const count=v.fun+v.todo;if(count<schema.minimumSamples)continue;
        families[key]={samples:count,type:v.fun===v.todo?null:v.fun>v.todo?'Fun':'To-do',durationMinutes:median(v.durations),travelMinutes:median(v.travel)};
      }
      return {version:1,minimumSamples:schema.minimumSamples,families};
    },
    contribute(feedback){
      if(!validFeedback(feedback))return Promise.reject(Object.assign(Error('Invalid feedback'),{status:400}));
      const operation=queue.then(async()=>{
        const next=structuredClone(state),key=feedback.family;
        const counts=next.families[key]||={fun:0,todo:0,durations:{},travel:{}};
        if(counts.fun+counts.todo>=1000000)throw Object.assign(Error('Family capacity reached'),{status:429});
        counts[feedback.type==='Fun'?'fun':'todo']++;
        counts.durations[feedback.durationBucket]=(counts.durations[feedback.durationBucket]||0)+1;
        counts.travel[feedback.travelBucket]=(counts.travel[feedback.travelBucket]||0)+1;
        await fs.mkdir(path.dirname(filename),{recursive:true});
        await fs.writeFile(filename+'.tmp',JSON.stringify(next),{mode:0o600});
        await fs.rename(filename+'.tmp',filename);state=next;
      });
      queue=operation.catch(()=>{});return operation;
    }
  };
}
module.exports={createStore,validFeedback};
