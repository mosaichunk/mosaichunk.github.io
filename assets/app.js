/* Scientific copy is condensed from the manuscript;
 * charts also include the labelled completed fractional-budget evaluations.
 */
(() => {
  'use strict';
  const DATA = window.PAPER_DATA;
  const $ = (q, root=document) => root.querySelector(q);
  const $$ = (q, root=document) => [...root.querySelectorAll(q)];
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs={}, text='') => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key,value]) => el.setAttribute(key, value));
    if (text) el.textContent = text;
    return el;
  };
  const pressed = (buttons, active) => buttons.forEach(b => b.setAttribute('aria-pressed',String(b===active)));
  const displayMethod = name => name === 'Ours' || name === 'mc' ? 'MosaiChunk' : name;
  const methodClass = name => /Ours|MosaiChunk|^mc$/.test(name) ? 'ours' : /MoC|^moc$/.test(name) ? 'moc' : 'base';
  const methodColor = name => ({ours:'#478b6a',moc:'#bc8793',base:'#9fa9b6'})[methodClass(name)];
  // SVG controls keep the same appearance on platforms that render ▶ as emoji.
  const playbackButton = (mode,label) => `<svg class="playback-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-${mode}"/></svg> <span>${label}</span>`;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function bindSelection(id, onChange){
    const group=$('#'+id);
    $$('button',group).forEach(button=>button.addEventListener('click',()=>{
      pressed($$('button',group),button);onChange(button.dataset.value);
    }));
  }
  // Start with the complete figure. Play reveals its stages in order; a manual
  // selection shows that stage's result without starting an animation.
  const captions = {
  "teaser": [
    "Generate a video chunk using cached keys and values (KV) from earlier chunks.",
    "Query older memory using sections from the latest chunk.",
    "Retrieve historical sections with the strongest descriptor matches.",
    "Selected KV sections carry visual details from different times and regions.",
    "Concatenate selected sections into a MosaiChunk for the next chunk.",
    "The frozen generator reads this memory alongside the sliding window.",
    "Recover the cookie’s appearance when the tin opens again."
  ],
  "motivation": [
    "Mark the cookie region in a frame from earlier history.",
    "Select the corresponding cached keys and values.",
    "Supply the selected KV alongside the sliding window when the tin reopens.",
    "The frozen generator recovers the cookie’s pink, star-shaped appearance."
  ],
  "architecture": [
    "Partition each chunk’s KV into sections and encode a descriptor for each.",
    "Score each historical section by its best descriptor match with the query.",
    "Select the top-N sections and compose their KV into far memory."
  ],
  "training": [
    "Teacher: predict with whole historical chunks covering the returning content.",
    "Student: predict with a smaller memory selected by the router.",
    "Match the teacher’s predictions with a mean squared error loss.",
    "Update the descriptor encoder; keep the backbone and stored KV frozen."
  ]
};
  const durations={teaser:[3400,2600,2400,3000,4300,3000,2600],motivation:[2600,3600,3200,2600],architecture:[4400,3400,4200],training:[3000,3000,2700,3200]};
  const figureControllers=new Map();
  $$('[data-animation]').forEach(card=>{
    const name=card.dataset.animation;
    const buttons=$$('[data-step]',card),iframe=$('iframe',card),play=$('[data-play]',card);
    const stepGroup=$('.step-buttons',card);
    const overviewCaption=$('[data-stage-caption]',card)?.textContent;
    let overview=true,stage=buttons.length-1,progress=1,running=false,raf=0,last=0;
    const finished=()=>stage===buttons.length-1&&progress>=1;
    const send=()=>iframe.contentWindow?.postMessage({type:'paper-figure-stage',stage,progress:reducedMotion.matches?1:progress},location.origin==='null'?'*':location.origin);
    const render=()=>{
      pressed(buttons,overview?null:buttons[stage]);
      buttons.forEach((button,index)=>{
        button.dataset.state=overview?'overview':index<stage?'complete':index===stage?'current':'pending';
        if(!overview&&index===stage)button.setAttribute('aria-current','step');
        else button.removeAttribute('aria-current');
      });
      // Keep the active word visible when the narrow-screen strip can scroll.
      const target=overview?0:buttons[stage].offsetLeft-(stepGroup.clientWidth-buttons[stage].offsetWidth)/2;
      stepGroup.scrollTo({left:Math.max(0,target),behavior:reducedMotion.matches?'instant':'smooth'});
      play.innerHTML=playbackButton(running?'pause':!overview&&finished()?'replay':'play',running?'Pause':!overview&&finished()?'Replay':'Play');
      if(name==='teaser')$('span',play).textContent+=' diagram';
      const playLabel=`${running?'Pause':!overview&&finished()?'Replay':'Play'} ${name} animation`;
      play.setAttribute('aria-label',playLabel);play.title=playLabel;
      const caption=$('[data-stage-caption]',card);if(caption){caption.textContent=overview?overviewCaption:captions[name][stage];caption.dataset.paperCopy=overview?`${name}-caption`:`${name}-stage-${stage}`;window.PAPER_MATH.render(caption);}
      card.dataset.view=overview?'overview':'stage';
      card.dataset.stage=String(stage);send();
    };
    const pause=()=>{running=false;cancelAnimationFrame(raf);last=0;render();};
    function tick(now){
      if(!running)return;
      if(last)progress+=Math.min(now-last,100)/durations[name][stage];
      last=now;
      if(progress>=1){
        progress=1;send();
        if(stage===buttons.length-1)return pause();
        stage++;progress=0;render();
      }else send();
      raf=requestAnimationFrame(tick);
    }
    play.addEventListener('click',()=>{
      if(running)return pause();
      if(overview||finished()){stage=0;progress=0;}
      else if(progress>=1)progress=0;
      overview=false;running=true;last=0;render();raf=requestAnimationFrame(tick);
    });
    buttons.forEach((button,index)=>button.addEventListener('click',()=>{
      overview=false;stage=index;progress=1;pause();
    }));
    stepGroup.addEventListener('keydown',event=>{
      const index=buttons.indexOf(event.target.closest('[data-step]'));
      if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
      buttons[next].focus({preventScroll:true});buttons[next].click();
    });
    $('[data-reset]',card).addEventListener('click',()=>{overview=true;stage=buttons.length-1;progress=1;pause();});
    iframe.addEventListener('load',send);
    figureControllers.set(iframe.contentWindow,{send,pause,card});
    new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&running)pause();},{threshold:.08}).observe(card);
    render();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)figureControllers.forEach(controller=>controller.pause());});
  window.addEventListener('message',event=>{
    if(event.data?.type==='paper-figure-ready')figureControllers.get(event.source)?.send();
  });

  const dialog=$('#image-dialog');
  function enlarge(url,label){$('img',dialog).src=url;$('img',dialog).alt=label;$('p',dialog).textContent=label;dialog.showModal();}
  $('#close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});

  // Benchmark inputs: actual first frames and a schematic of the commanded
  // camera path. Reconstructed evaluation poses are not implied by this view.
  function renderBenchmark(task){
    const isT2V=task==='t2v';
    $('#benchmark-input').textContent=isT2V?'Prompt':'Initial frame, prompt, and camera trajectory';
    $('#benchmark-split-details').textContent=isT2V
      ? "The split contains 100 samples with scenarios disjoint from router training. Each model input extends Ring Forcing's three-stage appear–disappear–reappear design to four prompt segments, with a separate segment keeping the object out of sight. The nominal prompt transitions occur at 3.6, 6.2, and 11.2 seconds. The third segment therefore requests five seconds with the object out of sight, exceeding the largest sliding-window baseline's approximately three seconds of recent context."
      : "The split contains 150 scenes: 50 indoor and 100 outdoor. Each model input includes an initial frame from DL3DV, a prompt describing the scene, and a camera trajectory. We sample more diverse camera trajectories not seen during training: all 150 scenes have in-place rotation trajectories with 90°, 180°, and 360° settings. The 100 outdoor scenes additionally have trajectories combining these rotations with translation. For 90° and 180°, yaw increases linearly to the specified angle at the midpoint and then reverses to its initial value. The 360° trajectory instead completes one continuous full turn. Each input camera trajectory ends at its initial position and orientation.";
    $('#benchmark-split-intro').textContent=isT2V
      ? "Objects appear, disappear, stay out of sight for five seconds, then return."
      : "The camera turns or moves away, then returns to its starting pose.";
    $('#benchmark-split-intro').dataset.paperCopy=`benchmark-${task}`;
    $('#benchmark-split-details').dataset.paperCopy=`benchmark-${task}-details`;
    $('#contact-caption').dataset.paperCopy=`contact-${task}`;
    $('.benchmark-detail').dataset.task=task;
    $('#prompt-interaction').hidden=!isT2V;$('#camera-interaction').hidden=isT2V;
    if(isT2V)pauseCamera();else playCamera(true,true);
    $('#contact-caption').textContent=isT2V?"Model-generated T2V frames when the prompt first reveals the object; 16 randomly sampled scenes.":"First frames of DL3DV videos used to condition I2V; 16 randomly sampled scenes.";
    $('#contact-sheet').replaceChildren(...DATA.benchmark[task].map(item=>{
      const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',`Enlarge ${item.label.toLowerCase()}`);
      const im=document.createElement('img');im.src=item.image;im.alt=item.label;im.loading='lazy';b.append(im);
      b.addEventListener('click',()=>enlarge(item.image,item.label));return b;
    }));
  }
  $$('#benchmark-tabs button').forEach(button=>button.addEventListener('click',()=>{pressed($$('#benchmark-tabs button'),button);renderBenchmark(button.dataset.task);}));
  const beatIndices=[0,1,2,4];
  const promptFrame=DATA.qualitative[0].rows.find(r=>r.method==='MosaiChunk').frames;
  $$('.prompt-preview').forEach((button,i)=>{
    const image=$('img',button);image.src=promptFrame[beatIndices[i]];
    button.addEventListener('click',()=>enlarge(image.src,`Prompt segment ${i+1} · ${image.alt}`));
  });

  const cameraSlider=$('#camera-progress'),cameraPlay=$('#camera-play');
  let cameraAngle=180,cameraProgress=0,cameraRunning=false,cameraFrame=0,cameraLastTime=null;
  const cameraDuration=4000;
  function renderCamera(){
    const t=cameraProgress;
    const angle=cameraAngle;
    const progress=angle===360?t:1-Math.abs(2*t-1);
    const yaw=angle*progress;
    const translation=$('#camera-translation').checked?185*(1-Math.abs(2*t-1)):0;
    $('#camera-pose').setAttribute('transform',`translate(${115+translation} 76) rotate(${-yaw})`);
    $('#camera-path').style.opacity=$('#camera-translation').checked?'1':'.2';
    $('#camera-svg').setAttribute('aria-label',`Schematic ${angle} degree input trajectory, ${Math.round(t*100)} percent complete${$('#camera-translation').checked?', with translation':''}`);
    cameraSlider.value=String(t*100);
  }
  function renderCameraPlayback(){
    const label=cameraRunning?'Pause':cameraProgress>=1?'Replay':'Play';
    cameraPlay.innerHTML=playbackButton(cameraRunning?'pause':cameraProgress>=1?'replay':'play',label);
    cameraPlay.setAttribute('aria-label',`${label} camera trajectory`);
  }
  function pauseCamera(){
    cameraRunning=false;cancelAnimationFrame(cameraFrame);cameraLastTime=null;
    renderCameraPlayback();
  }
  function tickCamera(now){
    if(!cameraRunning)return;
    if(cameraLastTime!==null)cameraProgress=Math.min(1,cameraProgress+Math.min(now-cameraLastTime,100)/cameraDuration);
    cameraLastTime=now;renderCamera();
    if(cameraProgress>=1)return pauseCamera();
    cameraFrame=requestAnimationFrame(tickCamera);
  }
  function playCamera(restart=false,automatic=false){
    pauseCamera();
    if(restart||cameraProgress>=1)cameraProgress=0;
    renderCamera();renderCameraPlayback();
    // Reduced-motion visitors can start playback explicitly. Switching away
    // cancels the same timeline, so returning never creates a second loop.
    if($('#camera-interaction').hidden||document.hidden||(automatic&&reducedMotion.matches))return;
    cameraRunning=true;renderCameraPlayback();cameraFrame=requestAnimationFrame(tickCamera);
  }
  cameraPlay.addEventListener('click',()=>{if(cameraRunning)pauseCamera();else playCamera();});
  cameraSlider.addEventListener('input',()=>{cameraProgress=Number(cameraSlider.value)/100;pauseCamera();renderCamera();});
  $('#camera-translation').addEventListener('change',()=>playCamera(true,true));
  bindSelection('camera-angle',value=>{cameraAngle=Number(value);playCamera(true,true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseCamera();});
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)pauseCamera();});

  const state={task:'t2v',trajectory:'rotation'};
  const resultKey=()=>state.task==='t2v'?'t2v':state.trajectory;
  function renderResults(){
    const rows=DATA.results[resultKey()];
    $('#trajectory-control').hidden=state.task==='t2v';
    $('#result-cohort').textContent=state.task==='t2v'?'100 T2V scenes · H3-AR':`${state.trajectory==='rotation'?150:100} I2V scenes · LingBot-World-Infinity`;
    // Integer budgets use the paper tables; fractional MosaiChunk points use
    // the completed evaluations on the same scene cohort.
    const fractional=DATA.fractionalResults[resultKey()];
    const readout=$('#metric-readout');
    const defaultReadout='Hover or focus a point for its method, memory budget, and score.';
    readout.textContent=defaultReadout;
    const metrics=[
      {key:'clip',index:0,min:.70,max:1,ticks:[.70,.80,.90,1]},
      {key:'lpips',index:1,min:.48,max:.68,ticks:[.50,.55,.60,.65]}
    ];
    metrics.forEach(metric=>{
      const chart=$(`[data-chart-metric="${metric.key}"]`);chart.replaceChildren();
      const left=48,right=424,top=14,bottom=156;
      const x=budget=>left+(budget-.5)/1.5*(right-left);
      const y=value=>bottom-(value-metric.min)/(metric.max-metric.min)*(bottom-top);
      metric.ticks.forEach(value=>{
        chart.append(svg('line',{x1:left,x2:right,y1:y(value),y2:y(value),stroke:'#e9edf0'}),svg('text',{x:left-10,y:y(value)+4,'text-anchor':'end',fill:'#8c98a3','font-size':12},value.toFixed(2)));
      });
      [.5,1,1.5,2].forEach(budget=>{
        chart.append(svg('line',{x1:x(budget),x2:x(budget),y1:top,y2:bottom,stroke:'#f0f2f4'}),svg('text',{x:x(budget),y:184,'text-anchor':'middle',fill:'#7d8995','font-size':13},String(budget)));
      });
      const series=rows.map(row=>({method:row.method,points:[
        [1,row.values[metric.index]],[2,row.values[4+metric.index]],
        ...(row.method==='Ours'?fractional[metric.key]:[])
      ].sort((a,b)=>a[0]-b[0])}));
      // Lines guide the eye between measured points. No fractional Base or MoC
      // results are synthesized or plotted.
      series.forEach(({method,points})=>{
        chart.append(svg('polyline',{
          points:points.map(([budget,value])=>`${x(budget)},${y(value)}`).join(' '),
          fill:'none',stroke:methodColor(method),'stroke-width':method==='Ours'?2.8:2,
          'stroke-dasharray':method==='Base'?'6 5':'none','stroke-linejoin':'round'
        }));
      });
      series.forEach(({method,points})=>points.forEach(([budget,value])=>{
          const label=`${displayMethod(method)} · ${budget} ${budget===1?'chunk':'chunks'} · ${metric.key.toUpperCase()} ${value.toFixed(3)}`;
          const point=svg('circle',{cx:x(budget),cy:y(value),r:5,fill:methodColor(method),stroke:'white','stroke-width':1.5,tabindex:0,role:'img','aria-label':label,'data-method':method,'data-budget':budget,'data-value':value.toFixed(3)});
          point.append(svg('title',{},label));
          const show=()=>{readout.textContent=label;point.setAttribute('r','7');};
          const clear=()=>{readout.textContent=defaultReadout;point.setAttribute('r','5');};
          point.addEventListener('mouseenter',show);point.addEventListener('focus',show);point.addEventListener('mouseleave',clear);point.addEventListener('blur',clear);
          chart.append(point);
      }));
      chart.setAttribute('aria-label',`${metric.key.toUpperCase()} versus far-memory budget in chunks, absolute score axis ${metric.min} to ${metric.max}. ${series.map(({method,points})=>`${displayMethod(method)}: ${points.map(([budget,value])=>`${budget} chunks ${value.toFixed(3)}`).join(', ')}`).join('; ')}`);
    });
  }
  $$('#result-tabs button').forEach(button=>button.addEventListener('click',()=>{
    pressed($$('#result-tabs button'),button);state.task=button.dataset.task;renderResults();
  }));
  bindSelection('result-trajectory',value=>{state.trajectory=value;renderResults();});

  const videoBudget=2;
  const qualitativePlaybackRate=3;
  const methodOrder=['base','moc','mc'];
  const orderedItems=scene=>[...scene.budgets[String(videoBudget)]].sort((a,b)=>methodOrder.indexOf(a.method)-methodOrder.indexOf(b.method));
  const qualState={task:'t2v',page:{t2v:0,i2v:0}};
  $$('#qual-tabs button').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.task===qualState.task)return;
    const direction=button.dataset.task==='i2v'?1:-1;
    pressed($$('#qual-tabs button'),button);qualState.task=button.dataset.task;transitionVideos(direction);
  }));

  let videos=[],videoItems=[],videoEpoch=0,playing=false,starting=false,syncTimer=null;
  let playbackRequest=0,playbackFrame=0,loopTimer=null,loopPending=false;
  let userPaused=false,videosInView=false,autoplayBlocked=false,snapshots=[];
  const visibleStages=new Set();
  let carouselMoving=false,carouselDirection=1,carouselAnimations=[];
  let renderedTask=null,renderedPage=0;
  function videoPlayButton(mode,label){
    const button=$('#video-play');button.innerHTML=playbackButton(mode,label);
    button.setAttribute('aria-label',`${label} synchronized videos at 3 times speed`);
    button.setAttribute('aria-pressed',String(playing||starting));
  }
  function pauseVideos(manual=false){
    if(manual)userPaused=true;
    ++playbackRequest;playing=false;starting=false;
    clearInterval(syncTimer);clearTimeout(loopTimer);cancelAnimationFrame(playbackFrame);
    syncTimer=null;loopTimer=null;
    videos.forEach(v=>v.pause());
    snapshots.forEach(state=>state.captures.forEach(capture=>capture.animation?.pause()));
    videoPlayButton('play','Play all');
  }
  function maybeAutoplay(){
    if(videosInView&&!document.hidden&&!userPaused&&!autoplayBlocked&&!reducedMotion.matches&&!carouselMoving&&!$('#pair-dialog').open)startVideos();
  }
  // Five explicit examples per split, drawn from the original video viewer.
  // The quantitative controls are independent of this qualitative carousel.
  const featured={t2v:['t2v-11','t2v-01','t2v-04','t2v-14','t2v-17'],i2v:['i2v-01','i2v-09','i2v-03','i2v-11','i2v-18']};
  function pageScene(offset=0,task=qualState.task,page=qualState.page[task]){
    const ids=featured[task],index=(page+offset+ids.length)%ids.length;
    return DATA.scenes.find(scene=>scene.id===ids[index]);
  }
  function turnPage(direction){
    const count=featured[qualState.task].length;
    qualState.page[qualState.task]=(qualState.page[qualState.task]+direction+count)%count;
    transitionVideos(direction);
  }
  async function transitionVideos(direction){
    carouselDirection=direction;
    // Finish the current slide before following the latest requested page.
    // Rapid clicks never replace the moving cards halfway through a gesture.
    if(carouselMoving)return;
    const task=qualState.task,page=qualState.page[task];
    if(task===renderedTask&&page===renderedPage)return;
    pauseVideos();++videoEpoch;
    if($('#pair-dialog').open)$('#pair-dialog').close();
    if(reducedMotion.matches){renderVideos();return;}
    const slide=$('#video-slide'),track=$('.carousel-track'),carousel=$('.video-carousel');
    const incoming=$('#video-peek-'+(direction>0?'next':'prev'));
    renderPreview(incoming,pageScene(0,task,page));
    // A fourth card enters at the far edge, so the next side preview also
    // moves into place instead of appearing after the animation finishes.
    const extra=document.createElement('button');extra.className='video-comparison carousel-peek carousel-extra';
    extra.setAttribute('aria-hidden','true');extra.inert=true;
    renderPreview(extra,pageScene(direction,task,page));
    const gap=parseFloat(getComputedStyle(track).columnGap);
    const step=slide.offsetWidth+gap,gutter=(carousel.clientWidth-slide.offsetWidth)/2;
    const base=gutter-step,from=base-(direction<0?step:0);
    if(direction>0)track.append(extra);else track.prepend(extra);
    carouselMoving=true;carousel.inert=true;slide.inert=true;
    slide.dataset.transition='slide';slide.setAttribute('aria-busy','true');
    const timing={duration:720,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'};
    try{
      carouselAnimations=[
        track.animate([{transform:`translateX(${from}px)`},{transform:`translateX(${from-direction*step}px)`}],timing),
        slide.animate([{opacity:1,transform:'scale(1)'},{opacity:.42,transform:'scale(.95)'}],timing),
        incoming.animate([{opacity:getComputedStyle(incoming).opacity,transform:'scale(.95)'},{opacity:1,transform:'scale(1)'}],timing)
      ];
      await Promise.all(carouselAnimations.map(animation=>animation.finished));
    }catch(error){
      if(error.name!=='AbortError')throw error;
    }finally{
      carouselAnimations.forEach(animation=>animation.cancel());carouselAnimations=[];extra.remove();
      renderVideos(task,page);
      carouselMoving=false;carousel.inert=false;slide.inert=false;
      slide.removeAttribute('aria-busy');delete slide.dataset.transition;
      if(qualState.task!==renderedTask||qualState.page[qualState.task]!==renderedPage)transitionVideos(carouselDirection);
      else maybeAutoplay();
    }
  }
  // Settle a moving track before its responsive dimensions change.
  window.addEventListener('resize',()=>carouselAnimations.forEach(animation=>animation.finish()));
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)carouselAnimations.forEach(animation=>animation.finish());});
  // Show exact excerpts of the input, keeping the complete prompt one click away.
  function promptExcerpt(scene){
    const action=text=>text.replace(/^Static camera(?: unchanged)?\.\s*/, '').match(/[^.!?]+[.!?]/)?.[0]?.trim()||text;
    const first=action(scene.prompts[0]);
    return scene.dataset==='t2v'?`${first} … ${action(scene.prompts[scene.prompts.length-1])}`:first;
  }
  $('#video-slide .video-prompt').addEventListener('toggle',event=>{
    $('.prompt-toggle',event.currentTarget).textContent=event.currentTarget.open?'Hide full prompt':'Full prompt';
  });
  function renderPreview(button,scene){
    if(button.dataset.scene===scene.id)return;
    button.dataset.scene=scene.id;
    if(!button.classList.contains('carousel-extra'))button.setAttribute('aria-label',`${button.id.endsWith('prev')?'Previous':'Next'} video example: ${scene.title}`);
    // Static posters share the live card's layout; neighboring cards do not
    // create or load additional video players.
    button.innerHTML='<div class="scrub-controls" aria-hidden="true"><span class="play-button">'+playbackButton('play','Play all')+'</span><span class="playback-speed">3×</span><span class="preview-progress"></span><span class="small-note">0.0 s</span><span class="subtle-button">Revisit frames</span></div><div class="videos"></div>';
    const preview=document.createElement('div');preview.className='video-prompt';
    const excerpt=document.createElement('div');excerpt.className='prompt-excerpt';
    const label=document.createElement('span');label.className='prompt-label';label.textContent='Prompt (excerpt)';
    const text=document.createElement('span');text.textContent=promptExcerpt(scene);
    excerpt.append(label,text);preview.append(excerpt);button.prepend(preview);
    $('.videos',button).replaceChildren(...buildVideoCards(scene,false));
  }
  function renderVideos(task=qualState.task,page=qualState.page[task]){
    pauseVideos();++videoEpoch;
    videoObserver.disconnect();visibleStages.clear();videosInView=false;
    snapshots.forEach(state=>state.captures.forEach(clearCapture));snapshots=[];
    userPaused=false;autoplayBlocked=false;loopPending=false;
    if($('#pair-dialog').open)$('#pair-dialog').close();
    // Unload the previous three movies when changing the scene or split.
    videos.forEach(video=>{video.removeAttribute('src');video.load();});
    const scene=pageScene(0,task,page),count=featured[task].length;
    renderedTask=task;renderedPage=page;
    $('#video-title').textContent=scene.title;
    $('#video-page').textContent=`${String(page+1).padStart(2,'0')} / ${String(count).padStart(2,'0')}`;
    $('#video-slide').setAttribute('aria-label',`Example ${page+1} of ${count}: ${scene.title}`);
    $('#video-pages').replaceChildren(...featured[task].map((id,i)=>{
      const button=document.createElement('button');button.setAttribute('aria-label',`Video example ${i+1}`);button.setAttribute('aria-pressed',String(i===page));
      button.addEventListener('click',()=>{
        if(i===qualState.page[qualState.task])return;
        const direction=i>qualState.page[qualState.task]?1:-1;
        qualState.page[qualState.task]=i;transitionVideos(direction);
      });return button;
    }));
    [-1,1].forEach(offset=>{
      renderPreview($(`#video-peek-${offset<0?'prev':'next'}`),pageScene(offset,task,page));
    });
    $('#video-prompt-summary').textContent=promptExcerpt(scene);
    $('#video-prompt-text').replaceChildren(...scene.prompts.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
    $('#video-slide .video-prompt').open=false;
    videoItems=orderedItems(scene);
    $('#video-setting').textContent=`${videoBudget}-chunk far memory · ${scene.trajectoryLabel}`;
    $('#videos').replaceChildren(...buildVideoCards(scene,true));
    videos=$$('#videos video');$('#video-progress').value='0';$('#video-time').textContent='0.0 s';
    $$('#videos .video-stage').forEach(stage=>videoObserver.observe(stage));
  }
  function buildVideoCards(scene,interactive){
    return orderedItems(scene).map(item=>{
      const card=document.createElement('div');card.className=`video-item ${methodClass(item.method)}`;
      const stage=document.createElement('div');stage.className='video-stage';
      const label=document.createElement('div');label.className='video-label';const title=document.createElement('b');title.textContent=item.label;const score=document.createElement('span');score.textContent=`CLIP ↑ ${item.clipScore.toFixed(3)}`;label.append(title,score);
      const video=document.createElement(interactive?'video':'img');
      if(interactive){
        video.muted=true;video.playsInline=true;video.preload='none';video.poster='viewer/'+item.departureImage;video.src='viewer/'+item.video;
        video.defaultPlaybackRate=qualitativePlaybackRate;video.playbackRate=qualitativePlaybackRate;
        video.setAttribute('aria-label',`${item.label}, ${scene.title}`);video.addEventListener('ended',finishVideoLoop);
      }else{video.className='preview-video';video.src='viewer/'+item.departureImage;video.alt='';}
      stage.append(video);
      const state={video,item,card,stage,captures:[]};
      // Reuse the viewer's exact evaluation images and original frame times.
      // Each method keeps its own revisit; frames are never shared across runs.
      const pair=document.createElement('div');pair.className='pair-grid';
      ['departure','revisit'].forEach(kind=>{
        const button=document.createElement(interactive?'button':'span');button.className='pair-button';button.dataset.kind=kind;
        if(interactive){button.type='button';button.disabled=true;button.setAttribute('aria-label',`Enlarge captured ${item.label} frames`);}
        const caption=document.createElement('span');caption.className='frame-label';
        const name=document.createElement('span');name.textContent=kind==='departure'?'Departure':'Revisit';
        const time=document.createElement('span');time.className='frame-time';time.textContent=`${(item[kind+'Frame']/item.fps).toFixed(2)} s`;
        caption.append(name,time);
        const image=document.createElement('img');image.src='viewer/'+item[kind+'Image'];image.alt=`${scene.title} — ${item.label} ${kind} frame`;image.decoding='async';
        image.style.aspectRatio=`${item.width} / ${item.height}`;
        const well=document.createElement('span');well.className='frame-well';well.style.aspectRatio=`${item.width} / ${item.height}`;well.append(image);
        button.append(caption,well);if(interactive)button.addEventListener('click',()=>openPair(state,scene));pair.append(button);
        state.captures.push({kind,time:item[kind+'Frame']/item.fps,button,image,well,captured:false,animation:null,ghost:null});
      });
      if(interactive)snapshots.push(state);
      card.dataset.method=item.method;card.append(label,stage,pair);return card;
    });
  }
  function clearCapture(capture){
    capture.animation?.cancel();capture.ghost?.remove();capture.animation=null;capture.ghost=null;
  }
  function settleCapture(capture){
    clearCapture(capture);capture.button.classList.add('is-captured');capture.button.classList.remove('is-capturing');capture.button.disabled=false;
  }
  function resetCapture(capture){
    clearCapture(capture);capture.captured=false;
    capture.button.classList.remove('is-captured','is-capturing');capture.button.disabled=true;
  }
  function captureFrame(state,capture,animate){
    capture.captured=true;
    const source=state.stage.getBoundingClientRect();
    // A frozen copy of the exact evaluation frame moves from the movie into
    // its own slot. Offscreen and reduced-motion captures settle immediately.
    if(!animate||reducedMotion.matches||source.bottom<=0||source.top>=innerHeight)return settleCapture(capture);
    const target=capture.well.getBoundingClientRect(),card=state.card.getBoundingClientRect();
    // Bounding rectangles include the published desktop CSS zoom, while
    // positioned elements and animation translations use local CSS pixels.
    const scale=card.width/state.card.offsetWidth;
    const ghost=document.createElement('div');ghost.className='snapshot-flight';ghost.setAttribute('aria-hidden','true');
    const image=capture.image.cloneNode();image.alt='';
    const label=document.createElement('span');label.textContent=capture.kind==='departure'?'Departure captured':'Revisit captured';
    ghost.append(image,label);
    Object.assign(ghost.style,{left:`${(source.left-card.left)/scale}px`,top:`${(source.top-card.top)/scale}px`,width:`${source.width/scale}px`,height:`${source.height/scale}px`});
    state.card.append(ghost);capture.ghost=ghost;capture.button.classList.add('is-capturing');
    const destination=`translate(${(target.left-source.left)/scale}px,${(target.top-source.top)/scale}px) scale(${target.width/source.width},${target.height/source.height})`;
    const animation=ghost.animate([
      {transform:'translate(0,0) scale(1)',opacity:0,offset:0},
      {transform:'translate(0,0) scale(1)',opacity:1,offset:.08},
      {transform:'translate(0,0) scale(1)',opacity:1,offset:.28},
      {transform:destination,opacity:1,offset:1}
    ],{duration:1050,easing:'cubic-bezier(.22,.61,.36,1)',fill:'forwards'});
    capture.animation=animation;
    animation.finished.then(()=>{if(capture.animation===animation)settleCapture(capture);}).catch(()=>{});
  }
  function updateCaptures(state,time,animate){
    state.captures.forEach(capture=>{
      const reached=time+1/(state.item.fps*2)>=capture.time;
      if(reached&&!capture.captured)captureFrame(state,capture,animate);
      else if(!reached&&capture.captured)resetCapture(capture);
      else if(reached&&!animate&&capture.animation)settleCapture(capture);
    });
  }
  function tickVideos(){
    if(!playing)return;
    snapshots.forEach(state=>{if(!state.video.seeking)updateCaptures(state,state.video.currentTime,true);});
    const time=videos[0].currentTime;
    $('#video-progress').value=String(time/videoItems[0].duration*1000);
    $('#video-time').textContent=time.toFixed(1)+' s';
    playbackFrame=requestAnimationFrame(tickVideos);
  }
  function finishVideoLoop(){
    if(!playing||loopPending||!videos.every(video=>video.ended))return;
    loopPending=true;clearInterval(syncTimer);cancelAnimationFrame(playbackFrame);
    videos.forEach(video=>video.pause());
    // Some annotated revisits are the very last frame. Give every capture
    // time to land and leave the completed comparison visible before looping.
    snapshots.forEach(state=>updateCaptures(state,state.item.duration,true));
    $('#video-progress').value='1000';$('#video-time').textContent=videoItems[0].duration.toFixed(1)+' s';
    loopTimer=setTimeout(()=>{if(playing){playing=false;startVideos(true);}},2400);
  }
  function openPair(state,scene){
    const {item}=state;
    pauseVideos(true);
    state.captures.filter(capture=>capture.captured).forEach(settleCapture);
    $('#pair-dialog-title').textContent=`${scene.title} · ${item.label} · CLIP ${item.clipScore.toFixed(3)}`;
    const captured=state.captures.filter(capture=>capture.captured);
    $('#enlarged-pair').classList.toggle('single-frame',captured.length===1);
    $('#enlarged-pair').replaceChildren(...captured.map(({kind})=>{
      const figure=document.createElement('figure'),caption=document.createElement('figcaption'),image=document.createElement('img');
      caption.textContent=`${kind==='departure'?'Departure':'Revisit'} · ${(item[kind+'Frame']/item.fps).toFixed(2)} s · frame ${item[kind+'Frame']}`;
      image.src='viewer/'+item[kind+'Image'];image.alt=`${scene.title} — ${item.label} ${kind} frame`;
      figure.append(caption,image);return figure;
    }));
    $('#pair-dialog').showModal();
  }
  $('#close-pair').addEventListener('click',()=>$('#pair-dialog').close());
  $('#pair-dialog').addEventListener('click',event=>{if(event.target===$('#pair-dialog'))$('#pair-dialog').close();});
  const videoLoads=new WeakMap();
  function ready(video){
    if(video.readyState>=1)return Promise.resolve();
    if(videoLoads.has(video))return videoLoads.get(video);
    const promise=new Promise((resolve,reject)=>{
      const done=event=>{
        // load() also aborts the initial preload='none' resource selection.
        // Only unloading an obsolete scene should cancel its pending load.
        if(event.type==='abort'&&video.hasAttribute('src'))return;
        ['loadedmetadata','error','abort'].forEach(type=>video.removeEventListener(type,done));
        videoLoads.delete(video);
        if(event.type==='loadedmetadata')resolve();else reject(new Error('Video could not load'));
      };
      ['loadedmetadata','error','abort'].forEach(type=>video.addEventListener(type,done));video.load();
    });
    videoLoads.set(video,promise);return promise;
  }
  let seekRequest=0;
  async function seekVideos(times){
    const epoch=videoEpoch,request=++seekRequest,targets=videos.slice();
    await Promise.all(targets.map(ready));if(epoch!==videoEpoch||request!==seekRequest)return;
    targets.forEach((v,i)=>{
      const time=Math.max(0,Math.min(times[i],v.duration-.001));
      v.currentTime=time;updateCaptures(snapshots[i],time,false);
    });
    loopPending=false;
  }
  async function startVideos(restart=false){
    if(playing||starting||!videos.length)return;
    const epoch=videoEpoch,request=++playbackRequest,targets=videos.slice();
    const current=()=>epoch===videoEpoch&&request===playbackRequest;
    starting=true;videoPlayButton('play','Loading');
    try{
      await Promise.all(targets.map(ready));if(!current())return;
      const rewind=restart||loopPending||targets.some(v=>v.ended||v.currentTime>=v.duration-.08);
      const time=rewind?0:targets[0].currentTime;
      loopPending=false;
      if(rewind)snapshots.forEach(state=>state.captures.forEach(resetCapture));
      targets.forEach(v=>{v.playbackRate=qualitativePlaybackRate;if(rewind||Math.abs(v.currentTime-time)>.06)v.currentTime=time;});
      await Promise.all(targets.map(v=>v.play()));if(!current())return;
      starting=false;playing=true;autoplayBlocked=false;videoPlayButton('pause','Pause');
      snapshots.forEach(state=>state.captures.forEach(capture=>capture.animation?.play()));
      tickVideos();
      syncTimer=setInterval(()=>{
        if(!playing||loopPending)return;
        const master=targets[0];
        if(master.ended)return;
        targets.slice(1).forEach(v=>{if(!v.ended&&!v.seeking&&Math.abs(v.currentTime-master.currentTime)>.15)v.currentTime=Math.min(master.currentTime,v.duration-.001);});
      },300);
    }catch(error){
      if(!current())return;
      pauseVideos();autoplayBlocked=true;
      if(error.name!=='NotAllowedError'&&error.name!=='AbortError')$('#video-time').textContent='Could not load video';
    }
  }
  $('#video-play').addEventListener('click',()=>{
    if(playing||starting)return pauseVideos(true);
    userPaused=false;autoplayBlocked=false;startVideos();
  });
  $('#video-progress').addEventListener('input',async()=>{
    pauseVideos(true);const epoch=videoEpoch,time=Number($('#video-progress').value)/1000*videoItems[0].duration;
    $('#video-time').textContent=time.toFixed(1)+' s';
    try{await seekVideos(videos.map(()=>time));}catch{if(epoch===videoEpoch)$('#video-time').textContent='Could not load video';}
  });
  $('#video-revisit').addEventListener('click',async()=>{
    pauseVideos(true);const epoch=videoEpoch;
    try{
      await seekVideos(videoItems.map(v=>v.revisitFrame/v.fps));if(epoch!==videoEpoch)return;
      $('#video-time').textContent='Revisit';$('#video-progress').value=String(videoItems[0].revisitFrame/videoItems[0].frames*1000);
    }catch{if(epoch===videoEpoch)$('#video-time').textContent='Could not load video';}
  });
  $('#video-prev').addEventListener('click',()=>turnPage(-1));
  $('#video-next').addEventListener('click',()=>turnPage(1));
  $('#video-peek-prev').addEventListener('click',()=>turnPage(-1));
  $('#video-peek-next').addEventListener('click',()=>turnPage(1));
  const videoObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting&&entry.intersectionRatio>=.15)visibleStages.add(entry.target);
      else visibleStages.delete(entry.target);
    });
    videosInView=visibleStages.size>0;
    if(videosInView)maybeAutoplay();else pauseVideos();
  },{threshold:[0,.15]});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseVideos();else maybeAutoplay();});
  reducedMotion.addEventListener('change',()=>{
    if(reducedMotion.matches){pauseVideos();snapshots.forEach(state=>state.captures.filter(capture=>capture.captured).forEach(settleCapture));}
    else maybeAutoplay();
  });
  window.addEventListener('resize',()=>snapshots.forEach(state=>state.captures.filter(capture=>capture.captured).forEach(settleCapture)));

  renderBenchmark('t2v');renderCamera();renderResults();renderVideos();
  window.PAPER_MATH.render(document);
})();
