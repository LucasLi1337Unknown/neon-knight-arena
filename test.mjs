import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {chooseMove} from './engine.js';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const game=new Chess();
assert.throws(()=>game.move({from:'e2',to:'e5'}));
game.move('f3');game.move('e5');game.move('g4');game.move('Qh4#');assert(game.isCheckmate());assert(game.isGameOver());
const castle=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');castle.move('O-O');assert.equal(castle.get('g1').type,'k');assert.equal(castle.get('f1').type,'r');
const ep=new Chess();for(const m of ['e4','a6','e5','d5','exd6'])ep.move(m);assert.equal(ep.get('d5'),undefined);
const promotion=new Chess('7k/P7/8/8/8/8/8/K7 w - - 0 1');promotion.move({from:'a7',to:'a8',promotion:'n'});assert.equal(promotion.get('a8').type,'n');
const stalemate=new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');assert(stalemate.isStalemate());
for(let level=1;level<=5;level++){const c=new Chess();const m=chooseMove(c.fen(),level,350);assert(c.moves().includes(m),'AI must return a legal move');}
const mate=new Chess();for(const m of ['f3','e5','g4'])mate.move(m);for(let l=2;l<=5;l++){const c=new Chess(mate.fen());c.move(chooseMove(c.fen(),l,500));assert(c.isCheckmate(),'AI should find mate in one');}
console.log('PASS: legality, checkmate, castling, en passant, promotion, stalemate, five AI tiers, and mate-in-one.');
let serve;const emailUsers={'verified-a':{id:crypto.randomUUID(),email_confirmed_at:new Date().toISOString()},'verified-b':{id:crypto.randomUUID(),email_confirmed_at:new Date().toISOString()},'unverified':{id:crypto.randomUUID(),email_confirmed_at:null}};
const tables={nk_accounts:[],nk_profiles:[],nk_games:[],nk_messages:[],nk_posts:[],nk_replies:[],nk_reports:[]};
async function dbFetch(url,options){const u=new URL(url);if(u.pathname==='/auth/v1/user'){const user=emailUsers[options.headers.Authorization?.replace('Bearer ','')];return Response.json(user||{error:'Invalid token'},{status:user?200:401})}const table=u.pathname.split('/').at(-1);if(table==='nk_rate_limit')return Response.json(true);const filters=[...u.searchParams].filter(([k])=>!['order','limit','select'].includes(k));let rows=tables[table].filter(row=>filters.every(([k,v])=>v.startsWith('eq.')?String(row[k])===v.slice(3):v.startsWith('ilike.')?String(row[k]).toLowerCase()===v.slice(6).toLowerCase():v.startsWith('in.')?v.slice(4,-1).split(',').includes(row[k]):true));const body=options.body?JSON.parse(options.body):null;if(options.method==='POST'){const record={id:crypto.randomUUID(),created_at:new Date().toISOString(),...body};if(table==='nk_games')Object.assign(record,{black_id:null,status:'waiting',version:0,moves:[],fen:new Chess().fen(),updated_at:new Date().toISOString()},body);tables[table].push(record);return Response.json([record])}if(options.method==='PATCH'){for(const row of rows)Object.assign(row,body)}if(options.method==='DELETE')tables[table]=tables[table].filter(r=>!rows.includes(r));return Response.json(structuredClone(rows))}
let source=readFileSync('server.ts','utf8').replace("import { Chess } from 'npm:chess.js@1.4.0';",'');source=stripTypeScriptTypes(source,{mode:'transform'});vm.runInNewContext(source,{Chess,Deno:{env:{get(name){return name==='SUPABASE_URL'?'https://test.example':'test-secret'}},serve(fn){serve=fn}},fetch:dbFetch,crypto,TextEncoder,Response,console});
async function call(action,data={},token,emailSession){const res=await serve(new Request('https://example.com',{method:'POST',headers:{'content-type':'application/json',...(token?{'x-player-token':token}:{}),...(emailSession?{'x-email-session':emailSession}:{})},body:JSON.stringify({action,...data})}));return{status:res.status,...await res.json()}}
const a=await call('signup',{username:'TestWhite'}),b=await call('signup',{username:'TestBlack'}),c=await call('signup',{username:'Spectator'});assert(a.token&&b.token&&c.token);const r=await call('create',{},a.token);const gid=r.game.id;assert.equal(r.game.status,'waiting');const joined=await call('join',{id:gid},b.token);assert.equal(joined.game.status,'active');assert.equal((await call('join',{id:gid},c.token)).status,400);assert.equal((await call('move',{id:gid,version:1,from:'e2',to:'e4'},c.token)).status,403);assert.equal((await call('move',{id:gid,version:1,from:'e7',to:'e5'},b.token)).status,400);assert.equal((await call('move',{id:gid,version:1,from:'e2',to:'e5'},a.token)).status,400);
let v=1;for(const [from,to,t] of [['f2','f3',a.token],['e7','e5',b.token],['g2','g4',a.token],['d8','h4',b.token]]){const r=await call('move',{id:gid,version:v,from,to},t);assert.equal(r.status,200);v=r.game.version}assert.equal(tables.nk_games[0].result,'0-1');assert.equal(tables.nk_games[0].finish_reason,'Checkmate');
const second=await call('create',{},a.token);await call('join',{id:second.game.id},b.token);assert.equal((await call('move',{id:second.game.id,version:0,from:'e2',to:'e4'},a.token)).status,409);await call('draw',{id:second.game.id},a.token);assert.equal((await call('acceptdraw',{id:second.game.id},a.token)).status,400);assert.equal((await call('acceptdraw',{id:second.game.id},b.token)).game.result,'1/2-1/2');
const msg=await call('message',{body:'Good game!'},a.token);assert.equal(msg.item.author_id,a.profile.id);await call('delete',{type:'message',id:msg.item.id},b.token);assert.equal(tables.nk_messages.length,1);await call('delete',{type:'message',id:msg.item.id},a.token);assert.equal(tables.nk_messages.length,0);assert.equal((await call('message',{body:'a'.repeat(301)},a.token)).status,400);assert.equal((await call('message',{body:'test'})).status,401);
const post=await call('post',{title:'London players?',body:'Let’s play.'},a.token);const reply=await call('reply',{post_id:post.item.id,body:'I’m in.'},b.token);assert.equal(reply.item.post_id,post.item.id);const recover=await call('me',{},a.token);assert.equal(recover.profile.username,'TestWhite');console.log('PASS: server auth, profiles, create/join, membership, turns, illegal moves, version conflicts, checkmate, draws, chat ownership, content limits, posts, replies, and recovery.');

assert.equal((await call('linkemail',{},a.token)).status,401);
assert.equal((await call('linkemail',{},a.token,'unverified')).status,401);
assert.equal((await call('linkemail',{},undefined,'verified-a')).status,401);
const linked=await call('linkemail',{},a.token,'verified-a');assert.equal(linked.status,200);assert.equal(linked.profile.id,a.profile.id);
const same=await call('me',{},undefined,'verified-a');assert.equal(same.profile.id,a.profile.id);assert.equal(same.emailLinked,true);
assert.equal((await call('linkemail',{},b.token,'verified-a')).status,400);
assert.equal((await call('linkemail',{},a.token,'verified-b')).status,400);
assert.equal((await call('me',{},undefined,'verified-b')).profile,null);
assert.equal((await call('me',{},a.token)).profile.id,a.profile.id);
console.log('PASS: email linking requires a verified session AND original profile proof, preserves profile IDs, rejects collisions, and supports email-only login plus legacy recovery.');
