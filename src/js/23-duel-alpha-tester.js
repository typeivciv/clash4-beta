'use strict';
const ALPHA_TESTER_VERSION='0.16.4';
function alphaTesterEl(id){return document.getElementById(id)}
function alphaTesterMode(){
  if(typeof matchMode!=='undefined'&&matchMode==='arcade')return'Arcade / Solo';
  if(typeof passDuel!=='undefined'&&passDuel?.active)return'Pass & Play';
  if(typeof directDuel!=='undefined'&&(directDuel?.role||directDuel?.pairing))return'Direct Duel';
  if(typeof duelSession!=='undefined'&&duelSession?.room)return'Hosted Room';
  return'Multiplayer lobby'
}
function alphaTesterRoute(){
  try{
    if(typeof directDuel==='undefined'||!directDuel?.role)return'Not connected';
    const kind=typeof directAlphaRouteKind==='function'?directAlphaRouteKind(directDuel?.channel||directPeerSession?.conn):'';
    if(kind==='relay')return'TURN relay';if(kind==='direct')return'Direct P2P';
    if(directDuel?.active)return'Connected';return'Pairing / not connected'
  }catch{return'Unknown'}
}
function alphaTesterRole(){
  try{if(typeof directDuel!=='undefined'&&directDuel?.role)return directDuel.role==='host'?'Player 1 / Host':'Player 2 / Guest'}catch{}
  return'—'
}
function alphaTesterInfo(){
  const ua=navigator.userAgent||'Unknown browser';
  const viewport=`${window.innerWidth}×${window.innerHeight}`;
  const network=navigator.onLine?'Online':'Offline';
  const safeUrl=`${location.origin}${location.pathname}${location.search}`;
  return [
    `Clash 4 Multiplayer Alpha ${ALPHA_TESTER_VERSION}`,
    `Mode: ${alphaTesterMode()}`,
    `Role: ${alphaTesterRole()}`,
    `Connection: ${alphaTesterRoute()}`,
    `Network status: ${network}`,
    `Viewport: ${viewport}`,
    `Browser: ${ua}`,
    `Build URL: ${safeUrl}`
  ].join('\n')
}
async function alphaTesterCopy(text,success='Copied test info.'){
  try{await navigator.clipboard.writeText(text);if(typeof msg==='function')msg(success);return true}catch{}
  try{const area=alphaTesterEl('alphaTesterModalText');if(area){area.hidden=false;area.value=text;area.focus();area.select()}return false}catch{return false}
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
    '<div class="alphaHelpCard"><b>Still blocked?</b>Try cellular on both devices. Hosted Room and Manual Connection remain experimental fallbacks under More Options / Advanced.</div>'
  ].join(''))
}
function alphaReportTemplate(){return `${alphaTesterInfo()}\n\nWHAT HAPPENED?\nDescribe the problem here.\n\nWHAT WERE YOU DOING?\nExample: Create Duel → scan QR → switch Wi-Fi to cellular → Retry Connection.\n\nWHAT DID YOU EXPECT?\n\nDID IT HAPPEN AGAIN?\nYes / No / Not tested\n\nANYTHING CONFUSING OR HARD TO FIND?\n`}
function alphaReportProblem(){
  const text=alphaTesterEl('alphaTesterModalText');
  alphaTesterOpen('Report a Problem','<div class="alphaHelpCard"><b>Useful reports are short and specific.</b>Tell us what you pressed, what happened, what you expected, and whether it happened again. Technical test info is already included below.</div>',{report:true});
  if(text)text.value=alphaReportTemplate()
}
async function alphaShareReport(){
  const value=alphaTesterEl('alphaTesterModalText')?.value||alphaReportTemplate();
  if(navigator.share){try{await navigator.share({title:`Clash 4 Multiplayer Alpha ${ALPHA_TESTER_VERSION} report`,text:value});return}catch{}}
  await alphaTesterCopy(value,'Report copied. Paste it into your message to the tester coordinator.')
}
function alphaBootTesterTools(){
  alphaTesterEl('alphaConnectionHelp')?.addEventListener('click',alphaConnectionHelp);
  alphaTesterEl('alphaCopyTestInfo')?.addEventListener('click',()=>alphaTesterCopy(alphaTesterInfo()));
  alphaTesterEl('alphaReportProblem')?.addEventListener('click',alphaReportProblem);
  alphaTesterEl('alphaTesterClose')?.addEventListener('click',alphaTesterClose);
  alphaTesterEl('alphaTesterCopy')?.addEventListener('click',()=>alphaTesterCopy(alphaTesterEl('alphaTesterModalText')?.value||alphaReportTemplate(),'Report copied.'));
  alphaTesterEl('alphaTesterShare')?.addEventListener('click',alphaShareReport);
  alphaTesterEl('alphaTesterModal')?.addEventListener('click',event=>{if(event.target===alphaTesterEl('alphaTesterModal'))alphaTesterClose()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!alphaTesterEl('alphaTesterModal')?.hidden)alphaTesterClose()})
}
globalThis.alphaTesterInfo=alphaTesterInfo;
globalThis.alphaConnectionHelp=alphaConnectionHelp;
globalThis.alphaReportProblem=alphaReportProblem;
alphaBootTesterTools();