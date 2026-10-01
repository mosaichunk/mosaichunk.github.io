/* Keep the method name consistent in static copy and changing captions. */
(() => {
  'use strict';
  const skip='script,style,textarea,option,pre,code,svg,.katex,.mosaichunk-name,[contenteditable]';
  function render(root){
    if(!root.isConnected)return;
    const nodes=[];
    if(root.nodeType===Node.TEXT_NODE)nodes.push(root);
    else{
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      while(walker.nextNode())nodes.push(walker.currentNode);
    }
    for(const node of nodes){
      if(!node.data.includes('MosaiChunk')||node.parentElement?.closest(skip))continue;
      const matches=[...node.data.matchAll(/\bMosaiChunk\b/g)];
      if(!matches.length)continue;
      const fragment=document.createDocumentFragment();let offset=0;
      for(const match of matches){
        fragment.append(document.createTextNode(node.data.slice(offset,match.index)));
        const name=document.createElement('strong');name.className='mosaichunk-name';name.textContent=match[0];
        fragment.append(name);offset=match.index+match[0].length;
      }
      fragment.append(document.createTextNode(node.data.slice(offset)));
      node.replaceWith(fragment);
    }
  }
  render(document.body);
  new MutationObserver(records=>{
    const roots=new Set();
    for(const record of records){
      if(record.type==='characterData')roots.add(record.target);
      else record.addedNodes.forEach(node=>roots.add(node));
    }
    roots.forEach(render);
  }).observe(document.body,{childList:true,subtree:true,characterData:true});
})();
