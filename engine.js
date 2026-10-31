import {Chess} from 'chess.js';
export function evaluate(chess){
 const values={p:100,n:320,b:335,r:500,q:900,k:0};let score=0;const board=chess.board();
 for(let row=0;row<8;row++)for(let col=0;col<8;col++){const p=board[row][col];if(!p)continue;const center=3.5-(Math.abs(3.5-row)+Math.abs(3.5-col))/2;let bonus=p.type==='p'?(p.color==='w'?6-row:row-1)*8:p.type==='n'?center*18:p.type==='b'?center*10:0;score+=(values[p.type]+bonus)*(p.color==='w'?1:-1)}
 return score*(chess.turn()==='w'?1:-1);
}
export function chooseMove(fen,level=3,budget=1300){
 const chess=new Chess(fen),root=chess.moves({verbose:true});if(!root.length)return null;
 if(level===1)return root[Math.floor(Math.random()*root.length)].san;
 const end=Date.now()+budget;let nodes=0;
 const values={p:100,n:320,b:335,r:500,q:900,k:0};
 const order=m=>(m.captured?10*values[m.captured]-values[m.piece]:0)+(m.promotion?800:0)+(m.san.includes('#')?100000:0);
 function search(depth,alpha,beta,ply){if((++nodes&127)===0&&Date.now()>end)throw new Error('time');if(chess.isCheckmate())return -100000+ply;if(chess.isDraw())return 0;if(depth===0)return evaluate(chess);let best=-Infinity;const moves=chess.moves({verbose:true}).sort((a,b)=>order(b)-order(a));for(const m of moves){chess.move(m);let v;try{v=-search(depth-1,-beta,-alpha,ply+1)}finally{chess.undo()}best=Math.max(best,v);alpha=Math.max(alpha,v);if(alpha>=beta)break}return best}
 let best=root[0].san;const maxDepth=Math.min(4,Math.max(1,level-1));
 for(let depth=1;depth<=maxDepth;depth++){let bestScore=-Infinity,candidate=best;try{const ordered=root.slice().sort((a,b)=>(b.san===best?1000000:order(b))-(a.san===best?1000000:order(a)));for(const m of ordered){if(Date.now()>end)throw new Error('time');chess.move(m);let value;try{value=-search(depth-1,-Infinity,-bestScore,1)}finally{chess.undo()}if(value>bestScore){bestScore=value;candidate=m.san}}best=candidate}catch{break}}
 return best;
}
if(typeof self!=='undefined'&&typeof document==='undefined')self.onmessage=({data})=>{try{self.postMessage({move:chooseMove(data.fen,data.level),id:data.id})}catch(e){self.postMessage({error:e.message,id:data.id})}};
