/* Paper figures as deterministic, staged stories.
 *
 * Each original SVG/HTML element belongs to a named operation. All operations
 * appear initially; during playback, future operations are hidden.
 * The parent supplies stage + progress, so pause,
 * replay, and manual steps never leave an independent animation running.
 * Moving objects are copies of the actual KV cells/sections in the figure;
 * their destination is the matching cell in the composed memory.
 */
(() => {
  'use strict';
  const canvas = document.getElementById('paper-canvas');
  const source = canvas.querySelector('svg');
  const width = Number(document.body.dataset.width);
  const height = Number(document.body.dataset.height);
  const kind = document.body.dataset.figure;
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { const t=clamp(value); return t*t*t*(t*(t*6-15)+10); };
  const interval = (progress,start,end) => clamp((progress-start)/(end-start));
  const groups = [];
  const flights = [];
  const custom = [];
  const owned = new Set();
  const make = (tag,attrs={}) => {
    const el=document.createElementNS(NS,tag);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,value));
    return el;
  };
  const opacity = (el,value) => {
    el.style.opacity=String(value);
    el.style.visibility=value<=0?'hidden':'visible';
  };
  function resize(){
    const scale=document.documentElement.clientWidth/width;
    canvas.style.transform=`scale(${scale})`;
    document.body.style.height=`${height*scale}px`;
  }
  new ResizeObserver(resize).observe(document.documentElement);
  resize();

  // Transform nested groups (including the snowflake/flame) into the root SVG
  // coordinate system before assigning them to a semantic stage.
  function svgBox(el){
    const box=el.getBBox();
    // Stay in SVG coordinates: screen transforms introduce zoom-dependent
    // rounding that can move a component across a story's layout boundary.
    const matrix=source.getCTM().inverse().multiply(el.getCTM());
    const points=[[box.x,box.y],[box.x+box.width,box.y+box.height]]
      .map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
    // Normalize subpixel roundoff before comparing with exact SVG boundaries.
    const stable=value=>Math.round(value*1e6)/1e6;
    return {x:stable(points[0].x),y:stable(points[0].y),w:stable(points[1].x-points[0].x),h:stable(points[1].y-points[0].y)};
  }
  // Flatten layout wrappers only; semantic components and their source
  // transforms stay intact (grids, math labels, DiT, encoder, and arrows).
  const wrappers=new Set(['memory-architecture','retrieval-pipeline','diagram-content','teacher-lane','student-lane','subfigure-backgrounds','mosaichunk-node']);
  const parts=parent=>[...parent.children].flatMap(el=>wrappers.has(el.id)?parts(el):[el]);
  const records=parts(source).filter(el=>!['defs','style','title'].includes(el.tagName.toLowerCase()))
    .map(el=>({el,...svgBox(el),tag:el.tagName.toLowerCase()}));
  const labels=[...canvas.querySelectorAll('.canvas > img,.figure > img')].map(el=>({
    el,x:parseFloat(el.style.left),y:parseFloat(el.style.top),
    w:parseFloat(el.style.width),h:parseFloat(el.style.height),tag:'img'
  }));
  const all=[...records,...labels];
  const select=predicate=>all.filter(predicate);
  const elements=items=>items.map(item=>item.el||item);

  function group(name,items,stage,start=0,end=start+.18,draw=false){
    const members=elements(items).map(el=>{
      if(owned.has(el))throw new Error(`Duplicate story element: ${kind}/${name}`);
      owned.add(el);el.dataset.operation=name;el.dataset.stage=String(stage);
      el.style.transition='none';
      const trace=draw&&el.tagName.toLowerCase()==='path'&&el.getAttribute('stroke')!=='none';
      return {el,length:trace?el.getTotalLength():0};
    });
    groups.push({name,members,stage,start,end,draw});
    return members.map(member=>member.el);
  }
  function remaining(predicate){return select(item=>!owned.has(item.el)&&predicate(item));}
  function cloneCells(items,name){
    const layer=make('g',{'data-motion':name,'aria-hidden':'true',visibility:'hidden'});
    elements(items).forEach(el=>{
      const copy=el.cloneNode(true);copy.removeAttribute('style');copy.removeAttribute('data-operation');copy.removeAttribute('data-stage');
      // Use root coordinates even when the original lives in a translated
      // panel. This preserves cell correspondence in the paper SVG.
      const wrapper=make('g');
      const matrix=source.getCTM().inverse().multiply(el.parentNode.getCTM());
      wrapper.setAttribute('transform',`matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
      wrapper.append(copy);layer.append(wrapper);
    });
    source.append(layer);return layer;
  }
  function movingCopy(items,name,stage,start,end,transform,fadeIntoDiT=false){
    const layer=cloneCells(items,name);
    flights.push({layer,stage,start,end,transform,fadeIntoDiT});
    return layer;
  }
  const isCell=r=>r.tag==='rect'&&r.w>3&&r.w<4&&r.h>3&&r.h<4;

  function teaser(){
    const steps={history:0,query:1,select:2,visualize:3,compose:4,dit:5,output:6};
    // Preserve the filmstrip artwork; reveal the five photographs in time order.
    const frames=select(r=>r.tag==='image'&&r.y<176&&r.x<800).sort((a,b)=>a.x-b.x);
    frames.forEach((frame,index)=>group(`history-frame-${index+1}`,[frame],steps.history,.04+index*.18,.16+index*.18));
    group('history-filmstrip',remaining(r=>r.tag==='rect'&&r.y<176&&r.x<800),-1);
    group('sliding-window',remaining(r=>r.y<176&&r.x<800),steps.query,0,.18);
    group('router',remaining(r=>r.tag==='rect'&&r.w>450&&r.y>200),steps.query,.05,.2);
    group('router-title',remaining(r=>r.tag==='img'&&r.y>215&&r.y<250&&r.x<470),steps.query,.05,.2);
    group('query-arrow',remaining(r=>r.tag!=='img'&&r.x>=470&&r.x<780&&r.y<240),steps.query,.15,.75,true);
    group('query-label',remaining(r=>r.tag==='img'&&r.x>500&&r.x<650&&r.y>180&&r.y<225),steps.query,.05,.2);
    group('select-arrows',remaining(r=>r.tag!=='img'&&r.x<470&&r.y>=176&&r.y<209),steps.select,.08,.85,true);
    group('select-label',remaining(r=>r.tag==='img'&&r.x<500&&r.y>=178&&r.y<210),steps.select,0,.15);

    // Claim both strokes together before the panel bounds split a plus sign
    // across neighboring KV groups with different reveal times.
    group('kv-plus',remaining(r=>r.tag==='path'&&r.x<470&&r.y>250&&r.y<336),steps.visualize,.25,.65);
    const sourceCells=[];
    for(let i=0;i<3;i++){
      const entries=remaining(r=>r.tag!=='img'&&r.y>=250&&r.y<336&&r.x>=i*156&&r.x<(i+1)*156);
      sourceCells.push(entries.filter(isCell));
      group(`kv-${i+1}`,entries,steps.visualize,.05+i*.2,.3+i*.2);
    }
    group('illustration-note',remaining(r=>r.tag==='img'&&r.x<470&&r.y>345),steps.visualize,.7,.95);
    group('compose-arrow',remaining(r=>r.tag!=='img'&&r.x>=470&&r.x<505&&r.y>250),steps.compose,.02,.2,true);
    const destination=remaining(r=>isCell(r)&&r.x>=505&&r.x<650);
    group('composed-kv',destination,steps.compose,.93,1);
    group('mosaichunk-frame',remaining(r=>r.x>=505&&r.x<650&&r.y>250),steps.compose,.04,.2);
    group('dit-input-arrow',remaining(r=>r.x>=650&&r.x<700),steps.dit,0,.25,true);
    group('dit',remaining(r=>r.x>=700&&r.x<795),steps.dit,.12,.35);
    group('output-arrow',remaining(r=>r.x>=795&&r.x<844),steps.output,0,.25,true);
    group('generated-frame',remaining(r=>r.x>=844),steps.output,.28,.75);

    // Each mask has exactly the same cell coordinates in its original panel
    // and the composed panel. Translation preserves that correspondence.
    sourceCells.forEach((cells,index)=>{
      const fill=cells[0].el.getAttribute('fill');
      const target=destination.filter(r=>r.el.getAttribute('fill')===fill);
      if(cells.length!==target.length)throw new Error('KV composition lost cells');
      const dx=target[0].x-cells[0].x;
      movingCopy(cells,`compose-kv-${index+1}`,steps.compose,.08+index*.08,.75+index*.08,t=>
        `translate(${dx*t},${8*Math.sin(Math.PI*t)})`);
      custom.push((stage,p)=>{
        const end=.75+index*.08;
        const arrival=stage>steps.compose?1:stage===steps.compose?ease(interval(p,end-.065,end)):0;
        cells.forEach(({el})=>{
          if(stage===steps.compose)opacity(el,1-.82*ease(interval(p,0,.1))+.82*ease(interval(p,.92,1)));
        });
        target.forEach(({el})=>opacity(el,arrival));
      });
    });
    movingCopy(destination,'memory-into-dit',steps.dit,.25,.85,t=>{
      const scale=1-.82*t;
      return `translate(${576+166*t},293.186) scale(${scale}) translate(-576,-293.186)`;
    },true);
  }

  const bySelector=selector=>[...source.querySelectorAll(selector)];
  const textIs=(r,text)=>r.tag==='text'&&r.el.textContent===text;
  const isFlow=r=>r.el.classList.contains('flow-arrow');
  function transfer(origin,target,name,stage,start,end){
    if(!origin||!target||origin.getAttribute('fill')!==target.getAttribute('fill'))throw new Error(`KV identity mismatch: ${name}`);
    const a=svgBox(origin),b=svgBox(target);
    movingCopy([origin],name,stage,start,end,t=>
      `translate(${a.x+(b.x-a.x)*t},${a.y+(b.y-a.y)*t}) scale(${1+(b.w/a.w-1)*t},${1+(b.h/a.h-1)*t}) translate(${-a.x},${-a.y})`);
    custom.push((at,p)=>opacity(target,at>stage?1:at===stage?ease(interval(p,end-.06,end)):0));
  }

  function motivation(){
    group('canvas',select(r=>r.tag==='rect'&&r.w===width),-1);
    group('earlier-frame',remaining(r=>r.el.id==='earlier-frame'||textIs(r,'Earlier frame')),-1);
    group('mark-region',remaining(r=>r.tag==='rect'&&r.x<316),0,.08,.82);
    group('extract-arrow',remaining(r=>isFlow(r)&&r.x<396&&r.y<200),1,.02,.22);
    group('extract-label',remaining(r=>textIs(r,'Extract')),1,0,.12);
    const selected=bySelector('.historical-cell').filter(el=>el.getAttribute('fill')==='#e995a1');
    group('selected-kv',selected,1,.8,1);
    group('cached-kv-grid',remaining(r=>r.el.classList.contains('historical-cell')||textIs(r,'Selected cached KV')),1,.08,.25);
    selected.forEach((cell,i)=>{
      const box=svgBox(cell),[col,row]=cell.dataset.position.split(',').map(Number);
      const photo=svgBox(source.querySelector('#earlier-frame'));
      const x=photo.x+col*photo.w/18,y=photo.y+row*photo.h/10;
      const start=.22+i/selected.length*.12,end=.78+i/selected.length*.12;
      movingCopy([cell],`extract-cell-${i}`,1,start,end,t=>`translate(${(x-box.x)*(1-t)},${(y-box.y)*(1-t)})`);
      custom.push((at,p)=>opacity(cell,at>1?1:at===1?ease(interval(p,end-.06,end)):0));
    });
    group('sliding-window',remaining(r=>r.el.id==='window-frame'||r.el.classList.contains('window-cell')||textIs(r,'Sliding-window frame')||textIs(r,'Sliding-window KV')),2,0,.15);
    group('window-extract-arrow',remaining(r=>isFlow(r)&&r.x<396),2,.1,.3);
    group('join-inputs',remaining(r=>r.tag==='path'&&r.x>700&&r.x<760||isFlow(r)&&r.x<760),2,.15,.38,true);
    group('context-frame',remaining(r=>r.x>=760&&r.x<1020&&!r.el.classList.contains('packed-history')&&!r.el.classList.contains('packed-window')),2,.24,.4);
    const packed=bySelector('.packed-history,.packed-window');
    group('context-kv',packed,2,.75,.9);
    packed.forEach((target,i)=>{
      const cls=target.classList.contains('packed-history')?'historical-cell':'window-cell';
      const origin=source.querySelector(`.${cls}[data-position="${target.dataset.position}"]`);
      transfer(origin,target,`context-token-${i}`,2,.32+i/packed.length*.1,.68+i/packed.length*.1);
    });
    group('context-to-dit',remaining(r=>isFlow(r)&&r.x>=1020&&r.x<1064),2,.76,.86);
    group('frozen-dit',remaining(r=>r.x>=1064&&r.x<1164),2,.83,.96);
    group('output-arrow',remaining(r=>isFlow(r)&&r.x>=1164),3,.05,.3);
    group('generated-frame',remaining(r=>r.x>=1208),3,.3,.78);
  }

  function architecture(){
    group('panels',select(r=>r.el.id.startsWith('panel-')||r.tag==='rect'&&r.w===width),-1);
    group('chunk-kv',remaining(r=>r.x<150),-1);
    group('partition',remaining(r=>r.x>=150&&r.x<236),0,.06,.24,true);
    const sectionGrids=remaining(r=>r.el.classList.contains('token-grid')&&r.x<400);
    group('sections',sectionGrids,0,.25,.46);
    group('sections-label',remaining(r=>r.el.dataset.columnHeading==='sections'),0,.22,.36);
    group('sections-to-encoder',remaining(r=>isFlow(r)&&r.x<402),0,.42,.55);
    group('encoder',remaining(r=>r.x>=402&&r.x<483||r.el.dataset.columnHeading==='encoder'),0,.48,.7);
    group('encoder-to-query',remaining(r=>isFlow(r)&&r.x<530),0,.7,.84);
    group('query',remaining(r=>r.x<595&&r.el.id!=='query-to-scores'),0,.82,.98);
    // The latest descriptors and the historical bank share the original IDs.
    group('descriptor-bank',remaining(r=>r.x<1000&&r.y>=270),1,0,.18);
    group('query-to-scores',bySelector('#query-to-scores'),1,.14,.32);
    group('history-to-scores',remaining(r=>isFlow(r)&&r.x<800&&r.y>200),1,.14,.32);
    group('similarity-scores',remaining(r=>r.x<808),1,.34,.92);
    group('scores-to-top-n',remaining(r=>isFlow(r)&&r.x<896),2,.02,.18);
    group('top-n',remaining(r=>r.el.id==='global-top-k'||textIs(r,'Top-N')),2,.16,.34);
    group('extract-arrow',bySelector('#top-k-to-memory'),2,.32,.45);
    const extracted=bySelector('.memory-section');
    group('extracted-sections',extracted,2,.44,.58);
    group('extraction-label',remaining(r=>textIs(r,'Extracted Sections')||r.tag==='path'&&r.x>1000),2,.42,.55);
    group('concat-arrow',bySelector('#sections-to-packed-kv'),2,.55,.66);
    group('mosaichunk-label',bySelector('#packed-kv-heading'),2,.65,.8);
    const target=bySelector('#packed-kv .packed-token');
    group('composed-kv',bySelector('#packed-kv'),2,.6,.68);
    target.forEach((dest,i)=>{
      const cells=bySelector(`.memory-section[data-source-key="${dest.dataset.sourceKey}"] .token`);
      const origin=cells[Number(dest.dataset.sourceRow)*8+Number(dest.dataset.sourceCol)];
      const rank=Number(dest.dataset.sectionRank)-1;
      transfer(origin,dest,`compose-section-token-${i}`,2,.6+rank*.065,.79+rank*.065);
    });
  }

  function training(){
    group('canvas',select(r=>r.tag==='rect'&&r.w===width),-1);
    group('column-headings',remaining(r=>r.tag==='text'&&r.y<75),-1);
    for(const [role,stage] of [['teacher',0],['student',1]]){
      const prefix=`#${role}-`;
      group(`${role}-backgrounds`,bySelector(`${prefix}lane-background,${prefix}heading,${prefix}far-memory-background,${prefix}memory-label`),stage,0,.14);
      group(`${role}-memory`,bySelector(`${prefix}memory`),stage,stage?.2:.02,stage?.3:.2);
      group(`${role}-window`,bySelector(`${prefix}window,${prefix}window-background`),stage,.06,.23);
      const cy=Number(source.querySelector(prefix+'lane').dataset.centerY);
      group(`${role}-plus`,remaining(r=>textIs(r,'+')&&Math.abs(r.y-cy)<30),stage,.1,.25);
      group(`${role}-input-arrow`,remaining(r=>isFlow(r)&&r.x<898-72&&Math.abs(r.y-cy)<20),stage,stage?.62:.26,stage?.77:.48);
      group(`${role}-prediction-arrow`,remaining(r=>isFlow(r)&&Math.abs(r.y-cy)<20),stage,stage?.8:.58,stage?.89:.74);
      group(`${role}-prediction`,bySelector(prefix+'prediction'),stage,stage?.88:.74,1);
      group(`${role}-to-loss`,bySelector(prefix+'prediction-to-loss'),2,.06,.5);
    }
    group('shared-frozen-dit',bySelector('#shared-dit'),0,.42,.62);
    group('descriptor-encoder',bySelector('#trainable-encoder,#encoder-label'),1,0,.17);
    group('encoder-to-memory',bySelector('#encoder-to-mosaichunk'),1,.16,.3);
    const targets=bySelector('#student-memory .packed-token');
    targets.forEach((target,i)=>{
      const [,chunk]=target.dataset.sourceKey.split('-');
      const origin=bySelector(`#teacher-memory [data-source-chunk="${chunk}"] .token`)[Number(target.dataset.sourceRow)*8+Number(target.dataset.sourceCol)];
      transfer(origin,target,`student-selected-token-${i}`,1,.24+i/targets.length*.1,.48+i/targets.length*.1);
    });
    group('mse',remaining(r=>r.el.id==='distillation-loss'||textIs(r,'MSE')),2,.48,.8);
    group('gradient-label',bySelector('#gradient-label'),3,0,.2);
    group('gradient-through-dit',bySelector('#loss-to-encoder'),3,.08,.92);
  }

  ({teaser,motivation,architecture,training}[kind])();
  const unassigned=all.filter(r=>!owned.has(r.el));
  if(unassigned.length)throw new Error(`Unassigned ${kind} elements: ${unassigned.map(r=>r.el.id||r.el.textContent?.slice(0,40)||r.tag+"@"+r.x.toFixed(1)+","+r.y.toFixed(1)).join("; ")}`);

  // The source figures draw each arrow as a path followed by a triangle.
  // Pair them geometrically: the path ends at the midpoint of the head's base.
  // Use the line's timing even when a stage boundary split it from its head.
  const arrows=records.filter(record=>record.tag==='polygon').flatMap(({el:head})=>{
    const line=head.previousElementSibling;
    if(line?.tagName.toLowerCase()!=='path'||head.points.numberOfItems!==3)return [];
    const length=line.getTotalLength(),endpoint=line.getPointAtLength(length);
    const a=head.points.getItem(1),b=head.points.getItem(2);
    if(Math.hypot(endpoint.x-(a.x+b.x)/2,endpoint.y-(a.y+b.y)/2)>.1)return [];
    const timing=groups.find(group=>group.members.some(member=>member.el===line));
    if(!timing)return [];
    return [{line,head,length,stage:timing.stage,start:timing.start,end:timing.end}];
  });

  // Current paper SVGs already keep each shaft/head pair in a flow group.
  // Follow its owning operation, including arrows inside loss/encoder groups.
  bySelector('.flow-arrow').forEach(flow=>{
    const line=flow.querySelector('.arrow-shaft'),head=flow.querySelector('.arrow-head');
    const owner=flow.closest('[data-operation]');
    const timing=groups.find(group=>group.name===owner?.dataset.operation);
    if(!timing)throw new Error(`Arrow without stage: ${kind}`);
    let trace=line;
    if(line.hasAttribute('stroke-dasharray')){
      // Reveal a dashed gradient through a mask instead of replacing its
      // dashes with a solid line while drawing it.
      const box=line.getBBox(),id=`arrow-reveal-${arrows.length}`;
      const mask=make('mask',{id,maskUnits:'userSpaceOnUse',x:box.x-10,y:box.y-10,width:box.width+20,height:box.height+20});
      trace=line.cloneNode(false);trace.removeAttribute('class');trace.removeAttribute('stroke-dasharray');trace.setAttribute('stroke','white');trace.setAttribute('stroke-width',Number(line.getAttribute('stroke-width'))+2);
      mask.append(trace);source.querySelector('defs').append(mask);line.setAttribute('mask',`url(#${id})`);
    }
    arrows.push({line,head,trace,length:line.getTotalLength(),stage:timing.stage,start:timing.start,end:timing.end});
  });

  function render(stage,progress){
    canvas.dataset.stage=String(stage);canvas.dataset.progress=progress.toFixed(3);
    groups.forEach(({members,stage:at,start,end,draw})=>{
      const t=at<stage||at<0?1:at>stage?0:interval(progress,start,end);
      members.forEach(({el,length})=>{
        opacity(el,draw&&length?t>0?1:0:ease(t));
        if(length){el.style.strokeDasharray=String(length);el.style.strokeDashoffset=String(length*(1-ease(t)));}
      });
    });
    arrows.forEach(({line,head,trace=line,length,stage:at,start,end})=>{
      const t=at<stage||at<0?1:at>stage?0:interval(progress,start,end);
      // Finish drawing the line before fading in its arrowhead. Both use the
      // parent's timeline, preserving exact pause, seeking, and full previews.
      const drawn=ease(interval(t,0,.85));
      opacity(line,t>0?1:0);
      trace.style.strokeDasharray=String(length);
      trace.style.strokeDashoffset=String(length*(1-drawn));
      head.dataset.arrowProgress=String(drawn);
      opacity(head,ease(interval(t,.85,1)));
    });
    flights.forEach(({layer,stage:at,start,end,transform,fadeIntoDiT})=>{
      const visible=stage===at&&progress>start&&progress<end;
      const t=interval(progress,start,end);
      // KV entering DiT fades throughout its travel, reaching zero at arrival.
      // Composition still transfers visible cells to their destination grid.
      const alpha=fadeIntoDiT?1-ease(t):ease(t/.09)*(1-ease((t-.90)/.10));
      opacity(layer,visible?alpha:0);
      if(visible)layer.setAttribute('transform',transform(ease(t)));
    });
    custom.forEach(update=>update(stage,progress));
  }
  render(Math.max(...groups.map(group=>group.stage)),1);
  canvas.style.visibility='visible';
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||event.data?.type!=='paper-figure-stage')return;
    render(Math.max(0,Number(event.data.stage)||0),clamp(Number(event.data.progress)||0));
  });
  window.parent.postMessage({type:'paper-figure-ready',figure:kind},'*');
})();
