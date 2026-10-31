import { Chess } from 'npm:chess.js@1.4.0';
const base=Deno.env.get('SUPABASE_URL')!+'/rest/v1/';
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={'apikey':secret,'Authorization':'Bearer '+secret,'Content-Type':'application/json'};
class Problem extends Error{constructor(message:string,public status=400){super(message)}}
async function db(path:string,method='GET',body?:unknown){const r=await fetch(base+path,{method,headers:{...headers,Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>null);if(!r.ok){if(data?.code==='23505')throw new Problem('That username is already taken.');console.error('Database request failed',r.status,data?.code);throw new Problem('Could not save this change. Please retry.',500)}return data}
async function hash(value:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function limit(key:string,seconds:number,hits:number){if(!await db('rpc/nk_rate_limit','POST',{bucket:key,seconds,max_hits:hits}))throw new Problem('Slow down a little. Please try again shortly.',429)}
function clean(value:unknown,max:number,min=1){if(typeof value!=='string')throw new Problem('Please enter text.');const t=value.trim();if(t.length<min||t.length>max)throw new Problem(`Use ${min}–${max} characters.`);return t}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value:unknown){if(typeof value!=='string'||!uuid.test(value))throw new Problem('Invalid ID.');return value}
const avatars=['knight','rook','queen','king','bishop','pawn'];
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const allowed=origin==='https://neon-knight-arena.vercel.app'||/^https:\/\/neon-knight-arena-[a-z0-9-]+-nikki-edu-ai\.vercel\.app$/.test(origin)||/^http:\/\/localhost:\d+$/.test(origin);
 const cors={'Access-Control-Allow-Origin':allowed?origin:'https://neon-knight-arena.vercel.app','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-player-token, x-email-session','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(origin&&!allowed)return reply({error:'Origin not allowed.'},403);
 if(req.method!=='POST')return reply({error:'Use POST.'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>12000)throw new Problem('Request too large.');
  const raw=await req.text();if(raw.length>12000)throw new Problem('Request too large.');
  const input=JSON.parse(raw),a=input.action;
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
  const ipHash=await hash(secret+':nk:'+ip);
  await limit('request:'+ipHash,60,240);
  let emailUser:any=null;
  const emailSession=req.headers.get('x-email-session');
  if(emailSession){
   const response=await fetch(Deno.env.get('SUPABASE_URL')!+'/auth/v1/user',{headers:{apikey:secret,Authorization:'Bearer '+emailSession}});
   if(!response.ok)throw new Problem('Your email session expired. Please sign in again.',401);
   emailUser=await response.json();
   if(!emailUser.id||!emailUser.email_confirmed_at||emailUser.is_anonymous)throw new Problem('Verify your email before continuing.',401);
  }
  if(a==='linkemail'){
   if(!emailUser)throw new Problem('Verify your email first.',401);
   const recovery=req.headers.get('x-player-token')||'';
   if(!/^[a-f0-9]{64}$/.test(recovery))throw new Problem('Open your existing profile on its original device or restore its recovery key before linking.',401);
   const existing=(await db('nk_accounts?token_hash=eq.'+await hash(recovery)))[0];
   if(!existing)throw new Problem('The existing profile could not be authenticated.',401);
   if(existing.email_user_id&&existing.email_user_id!==emailUser.id)throw new Problem('This profile is already linked to another email.');
   const mapped=(await db('nk_accounts?email_user_id=eq.'+id(emailUser.id)))[0];
   if(mapped&&mapped.id!==existing.id)throw new Problem('That email is already linked to another chess profile. Sign out to use that profile.');
   if(!existing.email_user_id){const changed=await db('nk_accounts?id=eq.'+existing.id+'&email_user_id=is.null','PATCH',{email_user_id:emailUser.id});if(!changed.length)throw new Problem('Profile changed. Please try again.',409)}
   return reply({profile:(await db('nk_profiles?id=eq.'+existing.id))[0],emailLinked:true});
  }
  if(a==='signup'){
   await limit('signup:'+ipHash,3600,6);
   const username=clean(input.username,20,3);if(!/^[A-Za-z0-9_]+$/.test(username))throw new Problem('Use letters, numbers, and underscores.');
   if((await db('nk_profiles?select=id&username=ilike.'+encodeURIComponent(username))).length)throw new Problem('That username is already taken.');
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
   if(emailUser&&(await db('nk_accounts?email_user_id=eq.'+id(emailUser.id))).length)throw new Problem('This email already has a chess profile. Sign in to use it.');
   const account=(await db('nk_accounts','POST',{token_hash:await hash(token),...(emailUser?{email_user_id:emailUser.id}:{})}))[0];
   let profile;try{profile=(await db('nk_profiles','POST',{id:account.id,username,bio:clean(input.bio||'',160,0),avatar:avatars.includes(input.avatar)?input.avatar:'knight'}))[0]}catch(e){await db('nk_accounts?id=eq.'+account.id,'DELETE');throw e}
   return reply({profile,token,emailLinked:!!emailUser});
  }
  if(a==='feed'){
   const [profiles,messages,posts,games]=await Promise.all([db('nk_profiles?select=*&order=created_at.desc&limit=200'),db('nk_messages?select=*&order=created_at.desc&limit=60'),db('nk_posts?select=*&order=created_at.desc&limit=40'),db('nk_games?select=*&order=updated_at.desc&limit=150')]);
   return reply({profiles,messages:messages.reverse(),posts,games});
  }
  if(a==='game'){const game=(await db('nk_games?id=eq.'+id(input.id)))[0];if(!game)throw new Problem('Game not found.',404);return reply({game})}
  if(a==='thread'){return reply({replies:await db('nk_replies?post_id=eq.'+id(input.id)+'&order=created_at.asc&limit=100')})}
  const token=req.headers.get('x-player-token')||'';
  if(!emailUser&&!/^[a-f0-9]{64}$/.test(token))throw new Problem('Sign in with email, create a profile, or restore your recovery key first.',401);
  const account=emailUser?(await db('nk_accounts?select=id,email_user_id&email_user_id=eq.'+id(emailUser.id)))[0]:(await db('nk_accounts?select=id,email_user_id&token_hash=eq.'+await hash(token)))[0];
  if(!account&&emailUser&&a==='me')return reply({profile:null,emailLinked:false,emailVerified:true});
  if(!account)throw new Problem('Recovery key not recognized.',401);
  const uid=account.id;
  if(a==='me'){return reply({profile:(await db('nk_profiles?id=eq.'+uid))[0],emailLinked:!!account.email_user_id})}
  if(a==='profile'){
   await limit('profile:'+uid,60,10);const username=clean(input.username,20,3);if(!/^[A-Za-z0-9_]+$/.test(username))throw new Problem('Use letters, numbers, and underscores.');
   return reply({profile:(await db('nk_profiles?id=eq.'+uid,'PATCH',{username,bio:clean(input.bio||'',160,0),avatar:avatars.includes(input.avatar)?input.avatar:'knight'}))[0],emailLinked:!!account.email_user_id});
  }
  if(a==='message'||a==='post'||a==='reply'){
   await limit(a+':'+uid,a==='post'?30:4,1);
   const table=a==='message'?'nk_messages':a==='post'?'nk_posts':'nk_replies';
   const body:any={author_id:uid,body:clean(input.body,a==='post'?1500:a==='reply'?600:300)};
   if(a==='post')body.title=clean(input.title,100,3);
   if(a==='reply')body.post_id=id(input.post_id);
   return reply({item:(await db(table,'POST',body))[0]});
  }
  if(a==='report'){
   await limit('report:'+uid,60,5);if(!['message','post','reply'].includes(input.type))throw new Problem('Invalid report.');
   const target=id(input.id);const existing=await db('nk_reports?reporter_id=eq.'+uid+'&target_id=eq.'+target+'&target_type=eq.'+input.type);
   if(!existing.length)await db('nk_reports','POST',{reporter_id:uid,target_type:input.type,target_id:target});
   return reply({ok:true});
  }
  if(a==='delete'){
   const table={message:'nk_messages',post:'nk_posts',reply:'nk_replies'}[input.type as string];if(!table)throw new Problem('Invalid content.');
   await db(table+'?id=eq.'+id(input.id)+'&author_id=eq.'+uid,'DELETE');return reply({ok:true});
  }
  if(a==='create'){
   await limit('game:'+uid,60,5);const open=await db('nk_games?white_id=eq.'+uid+'&status=in.(waiting,active)&select=id');if(open.length>=3)throw new Problem('Finish or cancel an existing game first (maximum 3).');
   return reply({game:(await db('nk_games','POST',{white_id:uid}))[0]});
  }
  if(['join','move','resign','cancel','draw','acceptdraw'].includes(a)){
   const game=(await db('nk_games?id=eq.'+id(input.id)))[0];if(!game)throw new Problem('Game not found.',404);
   let patch:any={version:game.version+1,updated_at:new Date().toISOString()};
   if(a==='join'){
    if(game.status!=='waiting')throw new Problem('Someone already joined this game.');if(game.white_id===uid)throw new Problem('Share the link with a friend to join.');
    patch.black_id=uid;patch.status='active';
   }else{
    if(uid!==game.white_id&&uid!==game.black_id)throw new Problem('Only players in this game can change it.',403);
    if(a==='cancel'){if(game.status!=='waiting')throw new Problem('Only waiting games can be cancelled.');patch.status='cancelled'}
    else{
     if(game.status!=='active')throw new Problem('This game is not active.');
     const chess=new Chess();for(const m of game.moves)chess.move(m);
     if(a==='move'){
      if(input.version!==game.version)throw new Problem('The board changed. Refresh and try again.',409);
      const current=chess.turn()==='w'?game.white_id:game.black_id;if(uid!==current)throw new Problem('It is not your turn.');
      let move;try{move=chess.move({from:input.from,to:input.to,promotion:input.promotion||'q'})}catch{throw new Problem('That move is not legal.')}
      patch.fen=chess.fen();patch.moves=[...game.moves,move.san];patch.draw_offer=null;
      if(chess.isGameOver()){patch.status='finished';patch.result=chess.isCheckmate()?(chess.turn()==='w'?'0-1':'1-0'):'1/2-1/2';patch.finish_reason=chess.isCheckmate()?'Checkmate':chess.isStalemate()?'Stalemate':chess.isThreefoldRepetition()?'Threefold repetition':chess.isInsufficientMaterial()?'Insufficient material':'Fifty-move rule'}
     }else if(a==='resign'){patch.status='finished';patch.result=uid===game.white_id?'0-1':'1-0';patch.finish_reason='Resignation'}
     else if(a==='draw'){patch.draw_offer=uid}
     else if(a==='acceptdraw'){if(!game.draw_offer||game.draw_offer===uid)throw new Problem('There is no opponent draw offer.');patch.status='finished';patch.result='1/2-1/2';patch.finish_reason='Draw by agreement'}
    }
   }
   const changed=await db('nk_games?id=eq.'+game.id+'&version=eq.'+game.version,'PATCH',patch);if(!changed.length)throw new Problem('Another action arrived first. Please retry.',409);return reply({game:changed[0]});
  }
  throw new Problem('Unknown action.');
 }catch(e){if(e instanceof SyntaxError)return reply({error:'Invalid request.'},400);return reply({error:e instanceof Problem?e.message:'Something went wrong. Please retry.'},e instanceof Problem?e.status:500)}
});
