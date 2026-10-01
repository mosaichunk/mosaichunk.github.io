// Play complete, synchronized rollouts while the teaser is in view.
(() => {
  'use strict';
  const panel=document.querySelector('.teaser-videos');
  const videos=[...panel.querySelectorAll('video')];
  const button=document.querySelector('#teaser-play');
  const slider=document.querySelector('#teaser-progress');
  const status=document.querySelector('#teaser-status');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const loading=new WeakMap();
  let wanted=!reducedMotion.matches,visible=false,epoch=0,syncTimer=null;
  videos.forEach(video=>{video.defaultPlaybackRate=3;video.playbackRate=3;});
  function label(playing){
    button.innerHTML=playing?'Ⅱ <span>Pause videos</span>':'▶ <span>Play videos</span>';
    button.setAttribute('aria-label',`${playing?'Pause':'Play'} synchronized teaser videos at 3 times speed`);
  }
  function pause(){
    ++epoch;clearInterval(syncTimer);syncTimer=null;
    videos.forEach(video=>video.pause());label(false);
  }
  function ready(video){
    if(video.readyState>=1)return Promise.resolve();
    if(loading.has(video))return loading.get(video);
    const pending=new Promise((resolve,reject)=>{
      const done=()=>{cleanup();resolve();};
      const failed=()=>{cleanup();reject(new Error('Video unavailable'));};
      const cleanup=()=>{
        video.removeEventListener('loadedmetadata',done);video.removeEventListener('error',failed);
        loading.delete(video);
      };
      video.addEventListener('loadedmetadata',done);video.addEventListener('error',failed);video.load();
    });
    loading.set(video,pending);return pending;
  }
  async function play(){
    if(!visible||document.hidden||!wanted)return;
    const request=++epoch;
    if(videos[0].ended)videos.forEach(video=>{video.currentTime=0;});
    status.textContent='';label(true);
    try{
      await Promise.all(videos.map(video=>video.play()));
      if(request!==epoch)return;
      videos.forEach(video=>{video.playbackRate=3;});
      clearInterval(syncTimer);
      syncTimer=setInterval(()=>{
        const [first,second]=videos;
        if(Math.abs(first.currentTime-second.currentTime)>.12)second.currentTime=first.currentTime;
      },250);
    }catch{
      if(request!==epoch)return;
      pause();wanted=false;
      status.textContent=videos.some(v=>v.error)?'Video unavailable. Try again.':'Press Play videos to start.';
    }
  }
  button.addEventListener('click',()=>{
    if(wanted&&!videos[0].paused){wanted=false;pause();}
    else{wanted=true;play();}
  });
  videos[0].addEventListener('timeupdate',()=>{
    if(videos[0].duration)slider.value=String(videos[0].currentTime/videos[0].duration*1000);
  });
  videos[0].addEventListener('ended',()=>{
    if(!wanted)return;
    pause();videos.forEach(video=>{video.currentTime=0;});play();
  });
  slider.addEventListener('input',async()=>{
    wanted=false;pause();
    const request=epoch,fraction=Number(slider.value)/1000;
    try{
      await Promise.all(videos.map(ready));if(request!==epoch)return;
      videos.forEach(video=>{video.currentTime=fraction*video.duration;});
    }catch{if(request===epoch)status.textContent='Video unavailable. Try again.';}
  });
  new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting&&entries[0].intersectionRatio>=.2;
    if(visible)play();else pause();
  },{threshold:.2}).observe(panel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else play();});
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){wanted=false;pause();}});
})();
