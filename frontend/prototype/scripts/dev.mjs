import {spawn,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFrontendServer} from './serve.mjs';

const frontend=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const repo=resolve(frontend,'../..');
const args=process.argv.slice(2),flag=name=>args.includes(name)?args[args.indexOf(name)+1]:null;
const supplied=flag('--backend')||process.env.TASTEBRIDGE_BACKEND_DIR;
const candidates=supplied?[resolve(repo,supplied)]:[join(repo,'src/backend'),resolve(repo,'../TasteBridge-backend-review/src/backend')];
const backend=candidates.find(path=>existsSync(join(path,'uv.lock'))&&existsSync(join(path,'app/main.py')));
if(!backend)throw new Error('Backend source is missing. Integrate PR #2 or pass --backend PATH.');
const built=spawnSync(process.execPath,[join(frontend,'scripts/build-prototype.mjs')],{cwd:frontend,stdio:'inherit'});
if(built.status!==0)process.exit(built.status||1);
const uiPort=Number(process.env.TASTEBRIDGE_UI_PORT||4176),apiPort=Number(process.env.TASTEBRIDGE_API_PORT||9016);
if(!Number.isInteger(uiPort)||!Number.isInteger(apiPort)||uiPort<1||apiPort<1||uiPort===apiPort)throw new Error('Use distinct valid frontend and API ports.');
const runtime=join(repo,'.integration-runtime');mkdirSync(runtime,{recursive:true});
const apiBase=`http://127.0.0.1:${apiPort}`;
const child=spawn('uv',['run','--frozen','uvicorn','app.main:app','--host','127.0.0.1','--port',String(apiPort)],{
 cwd:backend,stdio:'inherit',env:{...process.env,FEEDBACK_PATH:join(runtime,'feedback.jsonl')}
});
let launchError,stopping=false;child.once('error',error=>{launchError=error;});
const server=createFrontendServer({root:join(frontend,'dist'),apiBase,log:line=>console.log(`frontend ${line}`)});
async function stop(){
 if(stopping)return;stopping=true;server.closeAllConnections();if(server.listening)server.close();
 if(child.exitCode===null){child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),3000);timer.unref();}
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
try{
 let healthy=false;
 for(let attempt=0;attempt<120;attempt++){
  if(launchError)throw launchError;if(child.exitCode!==null)throw new Error('Backend stopped during startup.');
  try{const reply=await fetch(`${apiBase}/health`,{signal:AbortSignal.timeout(500)});healthy=reply.ok;}catch{}
  if(healthy)break;await new Promise(resolve=>setTimeout(resolve,250));
 }
 if(!healthy)throw new Error('Backend did not become healthy.');
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(uiPort,'127.0.0.1',resolve);});
 console.log(`Connected A: http://127.0.0.1:${uiPort}/a/?api=1`);
 console.log(`Offline A:   http://127.0.0.1:${uiPort}/a/?api=0`);
}catch(error){console.error(error.message);await stop();process.exitCode=1;}
