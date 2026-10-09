'use strict';
const notify=(message)=>{const el=document.getElementById('notice');el.textContent=message;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.textContent='',4500)};
const grid=document.getElementById('episodes');
if(grid&&Array.isArray(window.EPISODES)){
 let shown=grid.children.length;const more=document.getElementById('more'),progress=document.getElementById('progress');
 const update=()=>{progress.textContent=shown+' de '+window.EPISODES.length+' episódios';more.hidden=shown>=window.EPISODES.length};update();
 more.addEventListener('click',()=>{
  const first=shown,frag=document.createDocumentFragment();
  for(const e of window.EPISODES.slice(shown,shown+20)){
   const link=document.createElement('a');link.className='card';link.href='episodios/'+e.id+'/';
   const cover=document.createElement('div');cover.className='cover';const image=document.createElement('img');image.src=e.image;image.alt='Capa de '+e.title;image.loading='lazy';image.width=600;image.height=600;
   const listen=document.createElement('span');listen.className='listen';listen.textContent='▶ Ouvir episódio';cover.append(image,listen);
   const title=document.createElement('h2');title.textContent=e.title;const meta=document.createElement('p');meta.className='meta';const date=document.createElement('time');date.dateTime=e.dateISO;date.textContent=e.date;const duration=document.createElement('span');duration.textContent='◷ '+e.duration;meta.append(date,duration);link.append(cover,title,meta);frag.append(link);
  }
  grid.append(frag);shown=grid.children.length;update();if(grid.children[first])grid.children[first].focus({preventScroll:true});
 });
 // Ao voltar de um episódio, recupera os episódios que já tinham sido abertos.
 try{const count=Number(sessionStorage.getItem('pi-visible'));while(shown<count&&shown<window.EPISODES.length)more.click();}catch(_){}
 grid.addEventListener('click',()=>{try{sessionStorage.setItem('pi-visible',String(shown))}catch(_){}});
}
const audio=document.getElementById('audio');
if(audio){
 const play=document.getElementById('play'),seek=document.getElementById('seek'),current=document.getElementById('current'),total=document.getElementById('total'),status=document.getElementById('player-status'),error=document.getElementById('audio-error');
 const format=(s)=>{s=Math.max(0,Math.floor(s||0));return(s>=3600?Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0'):Math.floor(s/60))+':'+String(s%60).padStart(2,'0')};
 const state=()=>{play.textContent=audio.paused?'▶':'Ⅱ';play.setAttribute('aria-label',audio.paused?'Reproduzir':'Pausar');status.textContent=audio.paused?'Ouvir este episódio':'A ouvir…'};
 const metadata=()=>{if(Number.isFinite(audio.duration)){seek.disabled=false;seek.max=audio.duration;total.textContent=format(audio.duration)}};
 play.addEventListener('click',async()=>{if(audio.paused){error.textContent='';try{await audio.play()}catch(_){error.textContent='Não foi possível iniciar o áudio. Tente novamente.'}}else audio.pause()});
 audio.addEventListener('play',state);audio.addEventListener('pause',state);audio.addEventListener('ended',state);audio.addEventListener('loadedmetadata',metadata);audio.addEventListener('durationchange',metadata);
 audio.addEventListener('timeupdate',()=>{seek.value=audio.currentTime;current.textContent=format(audio.currentTime);seek.setAttribute('aria-valuetext',format(audio.currentTime))});
 audio.addEventListener('error',()=>{error.textContent='Não foi possível carregar o áudio. Verifique a ligação e volte a tentar.';state()});
 seek.addEventListener('input',()=>{audio.currentTime=Number(seek.value)});
 document.getElementById('speed').addEventListener('change',e=>audio.playbackRate=Number(e.target.value));
 document.getElementById('volume').addEventListener('input',e=>audio.volume=Number(e.target.value));
 document.getElementById('rewind').addEventListener('click',()=>{if(audio.readyState)audio.currentTime=Math.max(0,audio.currentTime-15)});
 document.getElementById('forward').addEventListener('click',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+15)});
 document.getElementById('custom-player').hidden=false;audio.controls=false;audio.hidden=true;
 const canonical=document.querySelector('link[rel=canonical]');const pageURL=canonical?canonical.href:location.href.split('#')[0];const title=document.querySelector('.episode-info h1').textContent;
 const u=encodeURIComponent(pageURL),t=encodeURIComponent(title);const targets={whatsapp:'https://wa.me/?text='+encodeURIComponent(title+'\n'+pageURL),facebook:'https://www.facebook.com/sharer/sharer.php?u='+u,x:'https://twitter.com/intent/tweet?url='+u+'&text='+t,linkedin:'https://www.linkedin.com/sharing/share-offsite/?url='+u,telegram:'https://t.me/share/url?url='+u+'&text='+t};
 document.querySelectorAll('[data-share]').forEach(a=>{a.href=targets[a.dataset.share];a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Partilhar no '+a.textContent)});
 document.getElementById('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(pageURL);notify('Ligação copiada!')}catch(_){const input=document.createElement('textarea');input.value=pageURL;document.body.append(input);input.select();const ok=document.execCommand('copy');input.remove();if(ok)notify('Ligação copiada!');else window.prompt('Copie a ligação deste episódio:',pageURL)}});
 if(navigator.share){const btn=document.getElementById('native-share');btn.hidden=false;btn.addEventListener('click',async()=>{try{await navigator.share({title,url:pageURL})}catch(e){if(e.name!=='AbortError')notify('Use uma das opções de partilha ou copie a ligação.')}})}
 if('mediaSession' in navigator&&'MediaMetadata' in window){navigator.mediaSession.metadata=new MediaMetadata({title,artist:'Prazeres Interrompidos',artwork:[{src:document.querySelector('.episode-cover img').src}]})}
}
