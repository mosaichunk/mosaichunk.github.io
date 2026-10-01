// Full rollouts occupy the original output windows of the paper figure.
(() => {
  'use strict';
  const windows=[...document.querySelectorAll('[data-video-output]')];
  const buttons=windows.map(window=>window.querySelector('button'));
  const videos=windows.map(window=>window.querySelector('video'));
  if(videos.length!==2)return;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let wanted=!reducedMotion.matches,visible=false,epoch=0,syncTimer=null;
  videos.forEach(video=>{video.defaultPlaybackRate=3;video.playbackRate=3;});
  const shouldPlay=()=>wanted&&visible&&!document.hidden&&windows.every(window=>window.style.visibility!=='hidden');
  function label(playing){
    buttons.forEach(button=>{
      button.setAttribute('aria-label',`${playing?'Pause':'Play'} both full video sequences: ${button.dataset.method}`);
      button.title=`${playing?'Pause':'Play'} both videos`;
    });
  }
  function pause(){
    ++epoch;clearInterval(syncTimer);syncTimer=null;
    videos.forEach(video=>video.pause());label(false);
  }
  async function play(){
    if(!shouldPlay()||videos.every(video=>!video.paused))return;
    const request=++epoch;
    if(videos[0].ended)videos.forEach(video=>{video.currentTime=0;});
    label(true);
    try{
      await Promise.all(videos.map(video=>video.play()));
      if(request!==epoch){if(!shouldPlay())pause();return;}
      videos.forEach(video=>{video.playbackRate=3;});
      clearInterval(syncTimer);
      syncTimer=setInterval(()=>{
        const [first,second]=videos;
        if(Math.abs(first.currentTime-second.currentTime)>.12)second.currentTime=first.currentTime;
      },250);
    }catch{
      if(request!==epoch)return;
      wanted=false;pause();
    }
  }
  function update(){if(shouldPlay())play();else if(videos.some(video=>!video.paused)||syncTimer)pause();}
  buttons.forEach(button=>button.addEventListener('click',()=>{
    wanted=videos[0].paused;
    update();
  }));
  videos[0].addEventListener('ended',()=>{
    pause();videos.forEach(video=>{video.currentTime=0;});update();
  });
  new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting&&entries[0].intersectionRatio>=.2;
    update();
  },{threshold:.2}).observe(document.getElementById('paper-canvas'));
  // native.js handles the same event first, including output visibility.
  window.addEventListener('message',event=>{
    if(event.source===window.parent&&event.data?.type==='paper-figure-stage')update();
  });
  document.addEventListener('visibilitychange',update);
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){wanted=false;pause();}});
})();
