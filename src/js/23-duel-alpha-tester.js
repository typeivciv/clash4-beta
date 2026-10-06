'use strict';
const ALPHA_TESTER_VERSION='0.20.11';
function alphaTesterEl(id){return document.getElementById(id)}
function alphaTesterMode(){
  if(globalThis.peerRoom?.role)return'2–4 Player Room';
  if(typeof matchMode!=='undefined'&&matchMode==='arcade')return'Arcade / Solo';
  if(typeof passDuel!=='undefined'&&passDuel?.active)return'Pass & Play';
  if(typeof directDuel!=='undefined'&&(directDuel?.role||directDuel?.pairing))return'Direct Duel';
  if(typeof duelSession!=='undefined'&&duelSession?.room)return'Hosted Room';
  return'Multiplayer lobby'
}
async function alphaTesterRoute(){
  try{
    if(globalThis.peerRoom?.role){const conn=peerRoom.conn||[...peerRoom.connections.values()].find(c=>c.open);const kind=await directAlphaRouteKind(conn);return kind==='relay'?'TURN relay':kind==='direct'?'Direct P2P':peerRoom.active?'Host / room open':'Pairing / not connected'}
    if(typeof directDuel==='undefined'||!directDuel?.role)return'Not connected';
    const kind=typeof directAlphaRouteKind==='function'?await directAlphaRouteKind(directPeerSession?.conn):'';
    if(kind==='relay')return'TURN relay';if(kind==='direct')return'Direct P2P';
    if(directDuel?.active)return'Connected';return'Pairing / not connected'
  }catch{return'Unknown'}
}
function alphaTesterRole(){
  if(globalThis.peerRoom?.role)return peerRoom.role==='host'?'Player 1 / Host':`Player ${peerRoom.seat||'?'} / Guest`;
  try{if(typeof directDuel!=='undefined'&&directDuel?.role)return directDuel.role==='host'?'Player 1 / Host':'Player 2 / Guest'}catch{}
  return'—'
}
async function alphaTesterInfo(){
  const ua=navigator.userAgent||'Unknown browser';
  const viewport=`${window.innerWidth}×${window.innerHeight}`;
  const network=navigator.onLine?'Online':'Offline';
  const safeUrl=`${location.origin}${location.pathname}${location.search}`;
  const peer=globalThis.peerRoom?.role?peerRoom.peer:typeof directPeerSession!=='undefined'?directPeerSession.peer:null;
  const details=await globalThis.c4ConnectionDiagnostics?.report()||'Unavailable';
  return [
    `Clash 4 Multiplayer Alpha ${ALPHA_TESTER_VERSION}`,
    `Mode: ${alphaTesterMode()}`,
    `Role: ${alphaTesterRole()}`,
    `Connection: ${await alphaTesterRoute()}`,
    `Pairing broker: ${peer?`open=${!!peer.open}, disconnected=${!!peer.disconnected}, destroyed=${!!peer.destroyed}`:'No current peer'}`,
    `Network status: ${network}`,
    `Viewport: ${viewport}`,
    `Browser: ${ua}`,
    `Build URL: ${safeUrl}`,
    `Connection details:\n${details}`
  ].join('\n')
}
async function alphaTesterCopy(text,success='Copied test info.'){
  try{await navigator.clipboard.writeText(text);if(typeof msg==='function')msg(success);return true}catch{}
  try{if(alphaTesterEl('alphaTesterModal')?.hidden)alphaTesterOpen('Copy Test Info','<div class="alphaHelpCard">Select and copy the connection details below.</div>',{report:true});const area=alphaTesterEl('alphaTesterModalText');if(area){area.hidden=false;area.value=text;area.focus();area.select()}return false}catch{return false}
}
function alphaTesterOpen(title,bodyHtml,{report=false}={}){
  const modal=alphaTesterEl('alphaTesterModal'),titleEl=alphaTesterEl('alphaTesterModalTitle'),body=alphaTesterEl('alphaTesterModalBody'),text=alphaTesterEl('alphaTesterModalText'),actions=alphaTesterEl('alphaTesterModalActions');
  if(!modal)return;if(titleEl)titleEl.textContent=title;if(body)body.innerHTML=bodyHtml;if(text)text.hidden=!report;if(actions)actions.hidden=!report;
  modal.hidden=false;document.body.classList.add('alpha-tester-modal-open');queueFit?.()
}
function alphaTesterClose(){const modal=alphaTesterEl('alphaTesterModal');if(modal)modal.hidden=true;document.body.classList.remove('alpha-tester-modal-open')}
function alphaConnectionHelp(){
  alphaTesterOpen('Connection Help',[
    '<div class="alphaHelpCard"><b>Normal path</b>Player 1 creates one invite. Player 2 scans the QR nearby or opens the same shared link from anywhere.</div>',
    '<div class="alphaHelpCard"><b>If pairing fails</b>Work, school, hotel, and public Wi-Fi can block WebRTC. Switch to cellular or another Wi-Fi network, then use <strong>Retry Connection</strong> on Player 2.</div>',
    '<div class="alphaHelpCard"><b>Keep the same invite</b>Player 1’s invite remains live for about five minutes. A failed connection attempt does not normally require a new QR or link.</div>',
    '<div class="alphaHelpCard"><b>Refresh only when needed</b><strong>Refresh Invite</strong> on Player 1 deliberately creates a new invite. Use it if the old invite expires or the pairing broker loses the host.</div>',
    '<div class="alphaHelpCard"><b>Still blocked?</b>Keep both game pages open while pairing. Use <strong>Copy Test Info</strong> on each phone after the failure and include both reports. Cellular can also block a direct route; switching networks is a test, not a guaranteed fix.</div>'
  ].join(''))
}
async function alphaReportTemplate(){return `${await alphaTesterInfo()}\n\nWHAT HAPPENED?\nDescribe the problem here.\n\nWHAT WERE YOU DOING?\nExample: Create Duel → scan QR → switch Wi-Fi to cellular → Retry Connection.\n\nWHAT DID YOU EXPECT?\n\nDID IT HAPPEN AGAIN?\nYes / No / Not tested\n\nANYTHING CONFUSING OR HARD TO FIND?\n`}
async function alphaReportProblem(){
  const text=alphaTesterEl('alphaTesterModalText');
  alphaTesterOpen('Report a Problem','<div class="alphaHelpCard"><b>Useful reports are short and specific.</b>Tell us what you pressed, what happened, what you expected, and whether it happened again. Technical test info is already included below.</div>',{report:true});
  if(text){text.value='Collecting connection details…';const report=await alphaReportTemplate();if(!alphaTesterEl('alphaTesterModal')?.hidden)text.value=report}
}
async function alphaShareReport(){
  const value=alphaTesterEl('alphaTesterModalText')?.value||await alphaReportTemplate();
  if(navigator.share){try{await navigator.share({title:`Clash 4 Multiplayer Alpha ${ALPHA_TESTER_VERSION} report`,text:value});return}catch{}}
  await alphaTesterCopy(value,'Report copied. Paste it into your message to the tester coordinator.')
}
function alphaBootTesterTools(){
  alphaTesterEl('alphaConnectionHelp')?.addEventListener('click',alphaConnectionHelp);
  alphaTesterEl('alphaCopyTestInfo')?.addEventListener('click',async()=>alphaTesterCopy(await alphaTesterInfo()));
  alphaTesterEl('alphaReportProblem')?.addEventListener('click',alphaReportProblem);
  alphaTesterEl('alphaTesterClose')?.addEventListener('click',alphaTesterClose);
  alphaTesterEl('alphaTesterCopy')?.addEventListener('click',async()=>alphaTesterCopy(alphaTesterEl('alphaTesterModalText')?.value||await alphaReportTemplate(),'Report copied.'));
  alphaTesterEl('alphaTesterShare')?.addEventListener('click',alphaShareReport);
  alphaTesterEl('alphaTesterModal')?.addEventListener('click',event=>{if(event.target===alphaTesterEl('alphaTesterModal'))alphaTesterClose()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!alphaTesterEl('alphaTesterModal')?.hidden)alphaTesterClose()})
}
globalThis.alphaTesterInfo=alphaTesterInfo;
globalThis.alphaConnectionHelp=alphaConnectionHelp;
globalThis.alphaReportProblem=alphaReportProblem;
alphaBootTesterTools();
