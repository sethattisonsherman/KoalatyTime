const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {createStore}=require('./estimate-store.cjs');
const files={'/':'index.html','/index.html':'index.html','/privacy.html':'privacy.html','/planner.js':'planner.js','/config.js':'config.js','/google-calendar.js':'google-calendar.js'};
function createServer(store){
  let windowStart=0,contributions=0;
  return http.createServer(async(req,res)=>{
    const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    // Local prototype only; request bodies, IPs, and headers are not logged.
    const origin=`http://localhost:${req.socket.localPort}`;
    if(req.headers.host!==`localhost:${req.socket.localPort}`){reply(403,{error:'Invalid host'});return;}
    let pathname;try{pathname=new URL(req.url,origin).pathname;}catch{reply(400,{error:'Invalid URL'});return;}
    if(pathname==='/api/estimate-model'&&req.method==='GET'){reply(200,store.model());return;}
    if(pathname==='/api/estimate-feedback'){
      if(req.method!=='POST'){reply(405,{error:'Use POST'});return;}
      if(req.headers.origin!==origin){reply(403,{error:'Same origin required'});return;}
      if(req.headers['content-type']?.split(';')[0]!=='application/json'){reply(415,{error:'Use application/json'});return;}
      if(Date.now()-windowStart>60000){windowStart=Date.now();contributions=0;}
      if(++contributions>120){req.resume();reply(429,{error:'Try again later'});return;}
      try{
        let body='',bytes=0;
        for await(const chunk of req){bytes+=chunk.length;if(bytes>1024){reply(413,{error:'Feedback too large'});req.resume();return;}body+=chunk.toString('utf8');}
        let feedback;try{feedback=JSON.parse(body);}catch{reply(400,{error:'Invalid JSON'});return;}
        await store.contribute(feedback);reply(200,{accepted:true,model:store.model()});
      }catch(error){reply(error.status||503,{error:error.status===400?'Only predefined activity families, categories, and duration buckets are accepted.':'Could not save shared estimate. Your draft can still be updated.'});}
      return;
    }
    if(!['GET','HEAD'].includes(req.method)){reply(405,{error:'Method not allowed'});return;}
    const file=files[pathname];if(!file){reply(404,{error:'Not found'});return;}
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer-when-downgrade');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method==='HEAD'){res.end();return;}
    const stream=fs.createReadStream(path.join(__dirname,file));stream.on('error',()=>{res.statusCode=500;res.end();});stream.pipe(res);
  });
}
if(require.main===module)createStore(path.join(__dirname,'data','estimate-aggregates.json')).then(store=>{
  const server=createServer(store);server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 5173 is already in use. Stop the previous Sunday server first.':'Could not start Sunday.');process.exitCode=1;});
  server.listen(5173,'localhost',()=>console.log('Sunday is running at http://localhost:5173'));
}).catch(()=>{console.error('Could not load aggregate estimates. Check the local data file.');process.exitCode=1;});
module.exports={createServer};

