// Multiplayer privacy projection. Authoritative rules stay in 10-rules.js.
// DOM-free so the same contract can be reused by the passcode-lobby server.
function cloneProjectedCooldown(cd){return cd?{...cd}:cd}
function projectCombatPieceForViewer(piece,viewer,decoyContact){
  if(!piece)return piece;
  const out={...piece};
  if(decoyContact&&out.owner!==viewer&&out.type!=='decoy')out.type=null;
  return out
}
function projectEventsForViewer(events,viewer){
  return(events||[]).map(e=>{
    if(e.kind==='combat')return{...e,atk:projectCombatPieceForViewer(e.atk,viewer,!!e.decoyContact),def:projectCombatPieceForViewer(e.def,viewer,!!e.decoyContact)};
    if(e.cooldown)return{...e,cooldown:cloneProjectedCooldown(e.cooldown)};
    return{...e}
  })
}
function projectBoardForViewer(board,viewer,{revealAll=false}={}){
  return board.map(col=>col.map(piece=>({owner:piece.owner,id:piece.id,type:revealAll||piece.owner===viewer?piece.type:null})))
}
function projectedLastMove(lastMove,viewer,{revealAll=false}={}){
  if(!lastMove)return null;
  return{...lastMove,type:revealAll||lastMove.owner===viewer?lastMove.type:null}
}
function projectDuelState(st,viewer,{revealAll=false}={}){
  const opponent=other(viewer);
  return{
    viewer,opponent,board:projectBoardForViewer(st.board,viewer,{revealAll}),
    inventory:{self:{...st.inv[viewer]},opponentTotal:T.reduce((n,type)=>n+st.inv[opponent][type],0)},
    turn:st.turn,winner:st.winner,winReason:st.winReason,draw:!!st.draw,moveNumber:st.moveNumber||0,
    cooldowns:(st.cooldowns||[]).map(cloneProjectedCooldown),lastMove:projectedLastMove(st.lastMove,viewer,{revealAll}),clashmate:st.clashmate?{...st.clashmate}:null
  }
}
function projectInteractionForViewer(interaction,viewer,{revealAll=false}={}){
  return{owner:interaction.owner,type:revealAll||interaction.owner===viewer?interaction.type:null,column:interaction.column,moveNumber:interaction.moveNumber,before:projectDuelState(interaction.before,viewer,{revealAll}),after:projectDuelState(interaction.after,viewer,{revealAll}),events:projectEventsForViewer(interaction.events,viewer)}
}
