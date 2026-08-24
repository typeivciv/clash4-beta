// Rules engine and move resolution. No DOM ownership lives here.
function outcome(a,d){
  if(a==='decoy'||d==='decoy')return'tie';
  if(a===d)return'tie';
  return(a==='rock'&&d==='scissors')||(a==='paper'&&d==='rock')||(a==='scissors'&&d==='paper')?'win':'lose'
}
function cloneState(st){return{...st,board:st.board.map(col=>col.map(p=>({...p}))),inv:{human:{...st.inv.human},ai:{...st.inv.ai}},aiKnow:{...st.aiKnow},aiOpponentModel:{...(st.aiOpponentModel||{humanMoves:0,proactiveBlocks:0,immediateBlocks:0,counterThreatMoves:0})},cooldowns:(st.cooldowns||[]).map(cd=>({...cd})),lastMove:st.lastMove?{...st.lastMove}:null,clashmate:st.clashmate?{...st.clashmate}:null}}
function connectOn(st,owner){
  let g=Array.from({length:ROWS},()=>Array(COLS).fill(null));
  for(let c=0;c<COLS;c++)for(let r=0;r<st.board[c].length;r++)g[ROWS-1-r][c]=st.board[c][r].owner;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(g[r][c]===owner)for(const[dr,dc]of[[0,1],[1,0],[1,1],[1,-1]]){let n=1;for(let k=1;k<4;k++){let rr=r+dr*k,cc=c+dc*k;if(rr<0||rr>=ROWS||cc<0||cc>=COLS||g[rr][cc]!==owner)break;n++}if(n>=4)return true}
  return false
}
function connect(owner){return connectOn(s,owner)}
function decoyContact(a,d){return a==='decoy'||d==='decoy'}
function physicalCols(st){let x=[];for(let c=0;c<COLS;c++)if(st.board[c].length<ROWS)x.push(c);return x}
function typesLeft(st,owner){return T.filter(t=>st.inv[owner][t]>0)}
function pruneList(st){return(st.cooldowns||[]).filter(cd=>{let col=st.board[cd.column],top=col&&col[col.length-1];return top&&top.id===cd.pieceId&&top.type!=='decoy'&&top.owner===cd.protectedOwner})}
function rawBlocking(st,owner){const physical=physicalCols(st);if(!physical.length)return[];const ps=new Set(physical);const active=pruneList(st).filter(cd=>cd.blockedOwner===owner&&ps.has(cd.column));const blocked=new Set(active.map(cd=>cd.column));if(physical.filter(c=>!blocked.has(c)).length===0)return[];return active}
function baseLegal(st,owner){const physical=physicalCols(st);if(!physical.length)return[];const blocked=new Set(rawBlocking(st,owner).map(cd=>cd.column));const legal=physical.filter(c=>!blocked.has(c));return legal.length?legal:physical}
function gridOf(board){let g=Array.from({length:ROWS},()=>Array(COLS).fill(null));for(let c=0;c<COLS;c++)for(let d=0;d<board[c].length;d++)g[ROWS-1-d][c]=board[c][d];return g}
function pieceInRun(board,id,owner,min=3){let loc=null;for(let c=0;c<COLS&&!loc;c++)for(let d=0;d<board[c].length;d++)if(board[c][d].id===id){loc={r:ROWS-1-d,c};break}if(!loc)return false;let g=gridOf(board);if(g[loc.r][loc.c]?.owner!==owner)return false;for(const[dr,dc]of[[0,1],[1,0],[1,1],[1,-1]]){let n=1;for(const sign of[-1,1])for(let k=1;k<min+2;k++){let r=loc.r+dr*k*sign,c=loc.c+dc*k*sign;if(r<0||r>=ROWS||c<0||c>=COLS||g[r][c]?.owner!==owner)break;n++}if(n>=min)return true}return false}
function pieceRunLength(board,id,owner){let loc=null;for(let c=0;c<COLS&&!loc;c++)for(let d=0;d<board[c].length;d++)if(board[c][d].id===id){loc={r:ROWS-1-d,c};break}if(!loc)return 0;let g=gridOf(board);if(g[loc.r][loc.c]?.owner!==owner)return 0;let best=1;for(const[dr,dc]of[[0,1],[1,0],[1,1],[1,-1]]){let n=1;for(const sign of[-1,1])for(let k=1;k<=4;k++){let r=loc.r+dr*k*sign,c=loc.c+dc*k*sign;if(r<0||r>=ROWS||c<0||c>=COLS||g[r][c]?.owner!==owner)break;n++}best=Math.max(best,n)}return best}
function mkCooldown(p,c,level='normal',elims=1){return p&&p.type!=='decoy'?{pieceId:p.id,column:c,protectedOwner:p.owner,blockedOwner:other(p.owner),level,eliminations:elims}:null}
function resolveRaw(st,owner,type,c,{ignoreCooldown=false}={}){
  let n=cloneState(st);n.winner=null;n.winReason=null;n.clashmate=null;n.draw=false;n.cooldowns=pruneList(n);
  if(!ignoreCooldown&&!baseLegal(n,owner).includes(c))return{error:'blocked'};if(n.board[c].length>=ROWS)return{error:'full'};if(n.inv[owner][type]<=0)return{error:'inventory'};
  let atkP={owner,type,id:n.nextId++},events=[],col=n.board[c],hadCombat=false,elims=0,defWinner=null;n.inv[owner][type]--;
  while(true){if(!col.length){col.push(atkP);break}let defP=col[col.length-1];if(defP.owner===owner){col.push(atkP);break}hadCombat=true;let dc=decoyContact(atkP.type,defP.type),o=outcome(atkP.type,defP.type);events.push({kind:'combat',atk:{...atkP},def:{...defP},o,decoyContact:dc});if(!dc){if(atkP.owner===H)n.aiKnow[atkP.id]=atkP.type;if(defP.owner===H)n.aiKnow[defP.id]=defP.type}if(o==='win'){let dead=col.pop();if(dead.owner===H)delete n.aiKnow[dead.id];if(dead.type!=='decoy')elims++;if(!col.length){col.push(atkP);break}continue}if(o==='lose'){if(atkP.owner===H)delete n.aiKnow[atkP.id];defWinner=defP;break}col.push(atkP);break}
  n.moveNumber=(n.moveNumber||0)+1;let survived=n.board[c].some(p=>p.id===atkP.id);n.lastMove={owner,type,column:c,survived,eliminations:elims,hadCombat};n.cooldowns=pruneList(n).filter(cd=>cd.blockedOwner!==owner);let fresh=null;
  if(survived&&elims>0){let fort=elims>=2&&pieceInRun(n.board,atkP.id,owner,3);fresh=mkCooldown(atkP,c,fort?'fortified':'normal',elims)}else if(!survived&&defWinner)fresh=mkCooldown(defWinner,c,'normal',1);
  if(fresh){let top=n.board[c][n.board[c].length-1];if(top?.id===fresh.pieceId){n.cooldowns=n.cooldowns.filter(cd=>cd.pieceId!==fresh.pieceId);n.cooldowns.push(fresh);events.push({kind:fresh.level==='fortified'?'fortified':'cooldown-earned',cooldown:{...fresh}})}}
  if(connectOn(n,H)&&connectOn(n,A))n.draw=true;else if(connectOn(n,H)){n.winner=H;n.winReason='connect4'}else if(connectOn(n,A)){n.winner=A;n.winReason='connect4'}else if(n.board.every(x=>x.length>=ROWS))n.draw=true;else{let nx=other(owner);if(!T.some(t=>n.inv[nx][t]>0))n.draw=true;else n.turn=nx}
  return{state:n,events,fresh,error:null}
}
function cloneBoard(board){return board.map(col=>col.map(p=>({...p})))}
function structuralWins(board,owner,blocked=new Set()){let out=[];for(let c=0;c<COLS;c++){if(blocked.has(c)||board[c].length>=ROWS)continue;let b=cloneBoard(board);b[c].push({owner,type:'structural',id:-100000-c});let fake={board:b};if(connectOn(fake,owner))out.push(c)}return out}
function hasStructuralWin(board,owner,blocked=new Set()){return structuralWins(board,owner,blocked).length>0}
function publicDefenseCanSave(st,owner,c){let opp=other(owner),board=st.board;if(board[c].length>=ROWS)return false;let top=board[c][board[c].length-1];if(!top||top.owner===owner){let b=cloneBoard(board);b[c].push({owner,type:'structural',id:-200000-c});return!hasStructuralWin(b,opp)}if(st.inv[owner].decoy>0){let b=cloneBoard(board);b[c].push({owner,type:'structural',id:-300000-c});if(!hasStructuralWin(b,opp))return true}let hasReal=['rock','paper','scissors'].some(t=>st.inv[owner][t]>0);if(hasReal){let b=cloneBoard(board);b[c].pop();b[c].push({owner,type:'structural',id:-400000-c});if(!hasStructuralWin(b,opp,new Set([c])))return true}return false}
function lockedChallengeCanSave(st,owner,c){let opp=other(owner),board=st.board,top=board[c][board[c].length-1];if(!top||top.owner===owner)return false;if(!['rock','paper','scissors'].some(t=>st.inv[owner][t]>0))return false;let b=cloneBoard(board);b[c].pop();b[c].push({owner,type:'structural',id:-500000-c});return!hasStructuralWin(b,opp,new Set([c]))}
function criticalColsFor(st,owner){if(st.winner||st.draw)return[];let blocking=rawBlocking(st,owner),normal=blocking.filter(cd=>cd.level!=='fortified');if(!normal.length)return[];let opp=other(owner);if(!hasStructuralWin(st.board,opp))return[];for(const c of baseLegal(st,owner))if(publicDefenseCanSave(st,owner,c))return[];return normal.filter(cd=>lockedChallengeCanSave(st,owner,cd.column)).map(cd=>cd.column)}
function displayCooldowns(st,owner){let crit=new Set(criticalColsFor(st,owner)),physical=new Set(physicalCols(st));return rawBlocking(st,owner).filter(cd=>physical.has(cd.column)).map(cd=>({...cd,critical:crit.has(cd.column)}))}
function cooldownCols(owner){return displayCooldowns(s,owner).filter(cd=>!cd.critical).map(cd=>cd.column)}
function legalCols(owner){let physical=physicalCols(s),blocked=new Set(cooldownCols(owner));let legal=physical.filter(c=>!blocked.has(c));return legal.length?legal:physical}
function immediateWinNoCritical(st,owner){if(st.winner===owner)return true;if(st.winner||st.draw)return false;for(const c of baseLegal(st,owner))for(const type of typesLeft(st,owner)){let q=resolveRaw(st,owner,type,c);if(!q.error&&q.state.winner===owner&&q.state.winReason==='connect4')return true}return false}
function defenderCanAvoid(st,defender,attacker){let legal=(function(){let physical=physicalCols(st),crit=new Set(criticalColsFor(st,defender)),blocked=new Set(rawBlocking(st,defender).filter(cd=>!crit.has(cd.column)).map(cd=>cd.column));let x=physical.filter(c=>!blocked.has(c));return x.length?x:physical})();for(const c of legal)for(const type of typesLeft(st,defender)){let ignore=!baseLegal(st,defender).includes(c),q=resolveRaw(st,defender,type,c,{ignoreCooldown:ignore});if(q.error)continue;if(q.state.winner===defender||q.state.draw)return true;if(!immediateWinNoCritical(q.state,attacker))return true}return false}
function detectClashmate(st,attacker,fresh){if(!fresh||fresh.level!=='fortified'||st.winner||st.draw)return false;if(!pieceInRun(st.board,fresh.pieceId,attacker,3))return false;if(!immediateWinNoCritical(st,attacker))return false;return!defenderCanAvoid(st,other(attacker),attacker)}
