// Keep cell labels in sync with dynamically rendered tables.
function labelTables(){
 for(const table of document.querySelectorAll('table')){
  const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
  table.setAttribute('role','table');
  for(const row of table.querySelectorAll('tr')){
   row.setAttribute('role','row');
   [...row.children].forEach((cell,index)=>{cell.setAttribute('role',cell.tagName==='TH'?'columnheader':'cell');if(cell.tagName==='TD')cell.dataset.label=headers[index]??'';});
  }
 }
}
let scheduled=false;
new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;labelTables();});}}).observe(document.body,{childList:true,subtree:true});
labelTables();
