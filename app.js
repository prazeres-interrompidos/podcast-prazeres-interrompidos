'use strict';
const notify=(message)=>{const el=document.getElementById('notice');el.textContent=message;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.textContent='',4500)};


window.appShareOptions=function(parent,getData){
 const hint=document.createElement('p');hint.className='app-share-hint';hint.setAttribute('role','status');parent.append(hint);
 for(const app of ['Instagram','TikTok','WeChat','Messenger']){const b=document.createElement('button');b.type='button';b.textContent=app+' · copiar ligação';b.addEventListener('click',async()=>{const {url}=getData();try{await navigator.clipboard.writeText(url);hint.textContent='Ligação copiada. Abre '+app+' e cola-a numa mensagem'+(app==='Instagram'?' ou no autocolante de ligação de uma história.':'.')}catch(_){hint.textContent='Copia esta ligação e cola-a no '+app+'.';let input=parent.querySelector('.app-share-copy');if(!input){input=document.createElement('input');input.className='app-share-copy';input.readOnly=true;input.setAttribute('aria-label','Ligação para copiar');parent.append(input)}input.value=url;input.focus();input.select()}});parent.append(b)}
 if(navigator.share){const b=document.createElement('button');b.type='button';b.textContent='Escolher aplicação no dispositivo';b.addEventListener('click',async()=>{try{await navigator.share(getData())}catch(e){if(e.name!=='AbortError')hint.textContent='Não foi possível abrir a partilha do dispositivo. Usa uma opção de copiar ligação.'}});parent.append(b)}
};

window.moreShareOptions=function(trigger,parent,getData){
 const box=document.createElement('div');box.className='extra-share-options';box.hidden=true;parent.append(box);trigger.setAttribute('aria-expanded','false');
 trigger.addEventListener('click',()=>{box.hidden=!box.hidden;trigger.setAttribute('aria-expanded',String(!box.hidden));if(box.hidden)return;box.replaceChildren();const {title,url}=getData(),u=encodeURIComponent(url),t=encodeURIComponent(title);const choices=[['Snapchat','https://www.snapchat.com/share?link='+u],['Facebook','https://www.facebook.com/sharer/sharer.php?u='+u],['X','https://twitter.com/intent/tweet?text='+t+'&url='+u],['LinkedIn','https://www.linkedin.com/sharing/share-offsite/?url='+u],['Telegram','https://t.me/share/url?url='+u+'&text='+t],['E-mail','mailto:?subject='+t+'&body='+u],['Bluesky','https://bsky.app/intent/compose?text='+encodeURIComponent(title+' '+url)]];for(const [label,href] of choices){const a=document.createElement('a');a.textContent=label;a.href=href;if(!href.startsWith('mailto:')){a.target='_blank';a.rel='noopener noreferrer'}box.append(a)}window.appShareOptions(box,getData)});
};

window.setupPlaylists=function(all,favorites,actions){
 const LIMIT=20,key='pi-playlists-v1';let lists=[],active='',queue=[],position=0,failed=0;
 try{const data=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(data))lists=data.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Array.isArray(p.ids)).map(p=>({id:p.id,name:p.name.slice(0,80),ids:[...new Set(p.ids.filter(id=>/^episodio-[a-f0-9]{20}$/.test(id)))].slice(0,LIMIT)}))}catch(_){}
 const button=(text,fn,parent)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',fn);parent.append(b);return b};
 const manager=document.createElement('section');manager.className='playlist-manager';manager.hidden=true;manager.setAttribute('aria-label','Playlists');document.getElementById('search-form').after(manager);
 const heading=document.createElement('h2');heading.textContent='As minhas playlists';manager.append(heading);
 const tools=document.createElement('div');tools.className='playlist-tools';manager.append(tools);const select=document.createElement('select');select.setAttribute('aria-label','Escolher playlist');tools.append(select);
 const name=document.createElement('input');name.type='text';name.maxLength=80;name.placeholder='Nome da playlist';name.setAttribute('aria-label','Nome da playlist');tools.append(name);
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(lists));return true}catch(_){notify('Não foi possível guardar neste navegador. Exporta a playlist para conservar uma cópia.');return false}};
 const current=()=>lists.find(p=>p.id===active);
 const entries=document.createElement('ol');manager.append(entries);
 const rebuild=()=>{select.replaceChildren();select.add(new Option('Escolher playlist',''));lists.forEach(p=>select.add(new Option(p.name+' ('+p.ids.length+'/20)',p.id)));select.value=active;const p=current();name.value=p?.name||'';entries.replaceChildren();if(!p)return;p.ids.forEach((id,i)=>{const li=document.createElement('li'),title=document.createElement('span');title.textContent=all.find(e=>e.id===id)?.title||'Episódio a carregar';li.append(title);const up=button('↑',()=>{[p.ids[i-1],p.ids[i]]=[p.ids[i],p.ids[i-1]];save();rebuild()},li);up.disabled=i===0;up.setAttribute('aria-label','Mover episódio para cima');const down=button('↓',()=>{[p.ids[i+1],p.ids[i]]=[p.ids[i],p.ids[i+1]];save();rebuild()},li);down.disabled=i===p.ids.length-1;down.setAttribute('aria-label','Mover episódio para baixo');button('Retirar',()=>{p.ids.splice(i,1);save();rebuild()},li);entries.append(li)})};
 const create=(title,ids=[])=>{const p={id:crypto.randomUUID(),name:title.slice(0,80),ids:[...new Set(ids)].slice(0,LIMIT)};lists.push(p);active=p.id;save();rebuild();return p};
 select.addEventListener('change',()=>{active=select.value;rebuild()});
 button('Criar playlist',()=>{const title=name.value.trim()||'A minha playlist';create(title);notify('Playlist criada. Usa o botão + nas capas para acrescentar episódios.')},tools);
 const renameStatus=document.createElement('p');renameStatus.className='playlist-name-status';renameStatus.setAttribute('role','status');renameStatus.setAttribute('aria-live','polite');manager.append(renameStatus);
 const rename=()=>{const p=current();if(!p){renameStatus.textContent='Escolhe primeiro a playlist cujo nome queres alterar.';return}const value=name.value.trim();if(!value){renameStatus.textContent='Escreve o novo nome da playlist.';name.focus();return}const old=p.name;p.name=value;if(save()){rebuild();renameStatus.textContent='Nome guardado: «'+value+'».'}else{p.name=old;renameStatus.textContent='Não foi possível guardar o nome neste navegador.'}};
 button('Guardar nome',rename,tools);name.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();rename()}});name.addEventListener('input',()=>{renameStatus.textContent=''});select.addEventListener('change',()=>{renameStatus.textContent=''});
 const deleteBox=document.createElement('div');deleteBox.className='playlist-delete-confirm';deleteBox.hidden=true;manager.append(deleteBox);
 button('Eliminar',()=>{const selected=current();if(!selected){notify('Escolhe a playlist que queres eliminar.');return}deleteBox.replaceChildren();deleteBox.hidden=false;const message=document.createElement('p');message.textContent='Eliminar a playlist «'+selected.name+'»?';deleteBox.append(message);button('Sim, eliminar',()=>{lists=lists.filter(p=>p.id!==selected.id);if(active===selected.id)active='';save();rebuild();deleteBox.hidden=true;notify('Playlist eliminada.')},deleteBox);button('Cancelar',()=>{deleteBox.hidden=true},deleteBox)},tools);
 select.addEventListener('change',()=>{deleteBox.hidden=true});
 const player=document.createElement('section');player.className='playlist-player';player.hidden=true;player.setAttribute('aria-label','Player da playlist');manager.after(player);const now=document.createElement('p');now.setAttribute('aria-live','polite');player.append(now);const audio=document.createElement('audio');audio.controls=true;audio.preload='none';player.append(audio);const controls=document.createElement('div');controls.className='playlist-tools';player.append(controls);
 const playAt=async i=>{if(i<0||i>=queue.length)return;position=i;const e=all.find(e=>e.id===queue[i]);if(!e){now.textContent='Este episódio ainda não está disponível. Volta a abrir a playlist após a atualização.';return}audio.src=e.audio;now.textContent=(i+1)+' de '+queue.length+' · '+e.title;try{await audio.play()}catch(_){now.textContent+=' · Carrega em reproduzir para continuar.'}};
 button('⏮ Anterior',()=>{failed=0;playAt(position-1)},controls);button('Seguinte ⏭',()=>{failed=0;playAt(position+1)},controls);button('Fechar player',()=>{audio.pause();player.hidden=true},controls);
 audio.addEventListener('ended',()=>{failed=0;if(position+1<queue.length)playAt(position+1);else now.textContent='Playlist terminada.'});audio.addEventListener('error',()=>{failed++;if(failed<queue.length&&position+1<queue.length){notify('Áudio indisponível. A passar ao seguinte.');playAt(position+1)}else now.textContent='Não foi possível reproduzir o áudio. Tenta novamente mais tarde.'});
 const listen=ids=>{if(!ids.length){notify('Esta seleção ainda não tem episódios.');return}queue=ids.slice(0,LIMIT);failed=0;player.hidden=false;playAt(0);player.scrollIntoView({behavior:'smooth',block:'nearest'})};
 const shareBox=document.createElement('div');shareBox.className='playlist-share';shareBox.hidden=true;manager.append(shareBox);
 const share=(title,ids)=>{if(!ids.length){notify('Não há episódios para partilhar.');return}if(ids.length>LIMIT){notify('Escolhe até 20 episódios numa playlist para partilhar os favoritos.');return}const url=new URL(location.href);url.search='';url.hash='playlist='+encodeURIComponent(JSON.stringify({name:title.slice(0,80),ids}));shareBox.replaceChildren();shareBox.hidden=false;const input=document.createElement('input');input.readOnly=true;input.value=url.href;input.setAttribute('aria-label','Ligação da playlist');shareBox.append(input);button('Copiar ligação',async()=>{try{await navigator.clipboard.writeText(url.href);notify('Ligação copiada.')}catch(_){input.select();notify('Copia a ligação selecionada.')}},shareBox);const wa=document.createElement('a');wa.textContent='WhatsApp';wa.href='https://wa.me/?text='+encodeURIComponent(title+' '+url.href);wa.target='_blank';wa.rel='noopener noreferrer';shareBox.append(wa);const extra=button('Mais opções',()=>{},shareBox);window.moreShareOptions(extra,shareBox,()=>({title,url:url.href}));manager.hidden=false};
 button('Ouvir playlist',()=>{if(current())listen(current().ids);else notify('Escolhe uma playlist.')},tools);
 button('Partilhar playlist',()=>{if(current())share(current().name,current().ids);else notify('Escolhe uma playlist.')},tools);
 button('Criar com os favoritos',()=>{const ids=all.filter(e=>favorites.has(e.id)).map(e=>e.id);if(!ids.length){notify('Ainda não tens favoritos.');return}if(ids.length>LIMIT){notify('Tens mais de 20 favoritos. Cria uma playlist e seleciona até 20 episódios.');return}create(name.value.trim()||'Os meus favoritos',ids)},tools);
 button('Exportar',()=>{const p=current();if(!p)return;const url=URL.createObjectURL(new Blob([JSON.stringify({name:p.name,ids:p.ids})],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='playlist.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},tools);
 const importer=document.createElement('input');importer.type='file';importer.accept='.json,application/json';importer.hidden=true;tools.append(importer);button('Importar',()=>importer.click(),tools);
 const validate=p=>p&&typeof p.name==='string'&&p.name.trim()&&p.name.length<=80&&Array.isArray(p.ids)&&p.ids.length>0&&p.ids.length<=LIMIT&&p.ids.every(id=>typeof id==='string'&&/^episodio-[a-f0-9]{20}$/.test(id));
 importer.addEventListener('change',async()=>{try{const f=importer.files[0];if(!f||f.size>10000)throw Error();const p=JSON.parse(await f.text());if(!validate(p))throw Error();create(p.name,p.ids)}catch(_){notify('Ficheiro inválido. A playlist deve conter de 1 a 20 episódios.')}importer.value=''});
 const show=button('Playlists',()=>{manager.hidden=!manager.hidden;show.setAttribute('aria-expanded',String(!manager.hidden));rebuild()},actions);show.className='search-action';show.setAttribute('aria-expanded','false');
 button('▶ Ouvir favoritos',()=>{const ids=all.filter(e=>favorites.has(e.id)).map(e=>e.id);if(ids.length>LIMIT){notify('Para ouvir uma seleção, cria uma playlist com até 20 favoritos.');return}listen(ids)},actions).className='search-action';
 button('Partilhar favoritos',()=>share('Os meus favoritos',all.filter(e=>favorites.has(e.id)).map(e=>e.id)),actions).className='search-action';
 let shared=null;try{if(location.hash.startsWith('#playlist=')){const p=JSON.parse(decodeURIComponent(location.hash.slice(10)));if(!validate(p))throw Error();shared=p}}catch(_){notify('A ligação da playlist é inválida.')}
 if(shared){const box=document.createElement('section');box.className='shared-playlist';const h=document.createElement('h2');h.textContent=shared.name;box.append(h);const text=document.createElement('p');text.textContent=shared.ids.length+' episódios · Playlist partilhada';box.append(text);button('▶ Ouvir playlist',()=>listen(shared.ids),box);button('Guardar nas minhas playlists',()=>{create(shared.name,shared.ids);manager.hidden=false;notify('Playlist guardada neste navegador.')},box);manager.before(box)}
 return {add:id=>{manager.hidden=false;if(!current())create('A minha playlist');const p=current();if(p.ids.includes(id)){notify('Este episódio já está na playlist.');return}if(p.ids.length>=LIMIT){notify('A playlist já tem 20 episódios. Cria outra ou retira um episódio.');return}p.ids.push(id);save();rebuild();notify('Episódio acrescentado a «'+p.name+'».')},refresh:rebuild};
};

const grid=document.getElementById('episodes');
if(grid&&Array.isArray(window.EPISODES)){
 const all=window.EPISODES,more=document.getElementById('more'),progress=document.getElementById('progress'),search=document.getElementById('search'),result=document.getElementById('search-result');
 let filtered=all,shown=0;
 const dateFilters=document.createElement('div');dateFilters.className='date-filters';
 const makeSelect=(id,label,first)=>{const wrap=document.createElement('label');wrap.htmlFor=id;wrap.textContent=label;const select=document.createElement('select');select.id=id;select.add(new Option(first,''));wrap.append(select);dateFilters.append(wrap);return select};
 const year=makeSelect('filter-year','Ano','Todos os anos'),month=makeSelect('filter-month','Mês','Todos os meses');
 ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].forEach((name,i)=>month.add(new Option(name,String(i+1).padStart(2,'0'))));
 document.getElementById('search-form').append(dateFilters);
 const form=document.getElementById('search-form'),fields=document.createElement('div');fields.className='search-fields';while(form.firstChild)fields.append(form.firstChild);form.append(fields);
 const actions=document.createElement('div');actions.className='search-actions';form.append(actions);
 const favorites=new Set();try{const saved=JSON.parse(localStorage.getItem('pi-favorites-v1')||'[]');if(Array.isArray(saved))saved.filter(id=>typeof id==='string').forEach(id=>favorites.add(id))}catch(_){}
 let onlyFavorites=false;
 const playlists=window.setupPlaylists(all,favorites,actions);
 const favFilter=document.createElement('button');favFilter.type='button';favFilter.className='search-action';favFilter.setAttribute('aria-pressed','false');actions.append(favFilter);
 const updateFavCount=()=>{favFilter.textContent='♥ Os meus favoritos ('+all.filter(e=>favorites.has(e.id)).length+')';favFilter.setAttribute('aria-pressed',String(onlyFavorites))};updateFavCount();
 const shareSearch=document.createElement('button');shareSearch.type='button';shareSearch.className='search-action';shareSearch.textContent='Partilhar pesquisa';actions.append(shareSearch);
 const panel=document.createElement('div');panel.className='search-share';panel.hidden=true;actions.append(panel);shareSearch.setAttribute('aria-expanded','false');shareSearch.setAttribute('aria-controls','search-share-panel');panel.id='search-share-panel';
 const searchURL=()=>{const url=new URL(location.href);url.search='';url.hash='';if(search.value.trim())url.searchParams.set('q',search.value.trim());if(year.value)url.searchParams.set('ano',year.value);if(month.value)url.searchParams.set('mes',month.value);return url.href};
 const copy=document.createElement('button');copy.type='button';copy.textContent='Copiar ligação';panel.append(copy);
 copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(searchURL());notify('Ligação da pesquisa copiada.')}catch(_){const input=document.createElement('input');input.value=searchURL();panel.append(input);input.select();notify('Seleciona e copia a ligação apresentada.')}});
 const whats=document.createElement('a');whats.textContent='WhatsApp';whats.target='_blank';whats.rel='noopener noreferrer';panel.append(whats);
 const email=document.createElement('a');email.textContent='E-mail';panel.append(email);
 const native=document.createElement('button');native.type='button';native.textContent='Mais opções';panel.append(native);window.moreShareOptions(native,panel,()=>({title:'Pesquisa — Prazeres Interrompidos',url:searchURL()}));
 const updateShare=()=>{whats.href='https://wa.me/?text='+encodeURIComponent('Descobre estes episódios do Prazeres Interrompidos: '+searchURL());email.href='mailto:?subject='+encodeURIComponent('Prazeres Interrompidos — Pesquisa')+'&body='+encodeURIComponent(searchURL())};
 shareSearch.addEventListener('click',()=>{panel.hidden=!panel.hidden;shareSearch.setAttribute('aria-expanded',String(!panel.hidden));updateShare()});form.addEventListener('input',updateShare);form.addEventListener('change',updateShare);

 const dateParts=e=>{const match=(e.date||'').match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/);if(match)return {year:match[3],month:match[2]};const d=new Date(e.dateISO);if(!Number.isFinite(d.getTime()))return {};const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit'}).formatToParts(d);return Object.fromEntries(parts.filter(p=>p.type==='year'||p.type==='month').map(p=>[p.type,p.value]))};
 const updateYears=()=>{const selected=year.value;year.replaceChildren(new Option('Todos os anos',''));[...new Set(all.map(e=>dateParts(e).year).filter(Boolean))].sort().reverse().forEach(value=>year.add(new Option(value,value)));if([...year.options].some(o=>o.value===selected))year.value=selected};updateYears();

 const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-PT');
 const text=e=>{const doc=new DOMParser().parseFromString(e.description||'','text/html');return normalize(e.title+' '+doc.body.textContent+' '+e.date)};
 let index=all.map(text);
 const published=new Set(all.map(e=>e.id));
 const add=()=>{
  const frag=document.createDocumentFragment();
  for(const e of filtered.slice(shown,shown+20)){
   const link=document.createElement('a');link.className='card';link.href=published.has(e.id)?'episodios/'+e.id+'/':'episodio.html?id='+encodeURIComponent(e.id);
   const cover=document.createElement('div');cover.className='cover';const image=document.createElement('img');image.src=e.image;image.alt='Capa de '+e.title;image.loading='lazy';image.width=600;image.height=600;
   const listen=document.createElement('span');listen.className='listen';listen.textContent='▶ Ouvir episódio';cover.append(image,listen);
   const title=document.createElement('h2');title.textContent=e.title;const meta=document.createElement('p');meta.className='meta';const date=document.createElement('time');date.dateTime=e.dateISO;date.textContent=e.date;const duration=document.createElement('span');duration.textContent='◷ '+e.duration;meta.append(date,duration);link.append(cover,title,meta);const item=document.createElement('article');item.className='episode-card';const fav=document.createElement('button');fav.type='button';fav.className='favorite-toggle';const update=()=>{const selected=favorites.has(e.id);fav.textContent=selected?'♥':'♡';fav.setAttribute('aria-pressed',String(selected));fav.setAttribute('aria-label',(selected?'Retirar dos favoritos: ':'Guardar nos favoritos: ')+e.title);fav.title=selected?'Retirar dos favoritos':'Guardar nos favoritos'};update();fav.addEventListener('click',()=>{if(favorites.has(e.id))favorites.delete(e.id);else favorites.add(e.id);try{localStorage.setItem('pi-favorites-v1',JSON.stringify([...favorites]))}catch(_){notify('Não foi possível guardar os favoritos neste navegador.')}update();updateFavCount();if(onlyFavorites)filter()});const plus=document.createElement('button');plus.type='button';plus.className='playlist-add';plus.textContent='+';plus.title='Acrescentar à playlist';plus.setAttribute('aria-label','Acrescentar à playlist: '+e.title);plus.addEventListener('click',()=>playlists.add(e.id));item.append(link,fav,plus);frag.append(item);
  }
  grid.append(frag);shown=grid.children.length;progress.textContent=filtered.length?shown+' de '+filtered.length+' episódios':'';more.hidden=shown>=filtered.length;
 };
 const filter=()=>{const terms=normalize(search.value.trim()).split(/\s+/).filter(Boolean);filtered=all.filter((e,i)=>terms.every(t=>index[i].includes(t))&&(!onlyFavorites||favorites.has(e.id))&&(!year.value||dateParts(e).year===year.value)&&(!month.value||dateParts(e).month===month.value));grid.replaceChildren();shown=0;add();result.textContent=(terms.length||year.value||month.value||onlyFavorites)?(filtered.length?filtered.length+' episódio'+(filtered.length===1?' encontrado':'s encontrados'):'Não foram encontrados episódios. Experimente outra pesquisa.'):'';};
 favFilter.addEventListener('click',()=>{onlyFavorites=!onlyFavorites;updateFavCount();filter()});
 document.getElementById('search-form').addEventListener('submit',e=>e.preventDefault());
 year.addEventListener('change',filter);month.addEventListener('change',filter);search.addEventListener('input',filter);document.getElementById('search-form').addEventListener('reset',()=>{search.value='';year.value='';month.value='';onlyFavorites=false;updateFavCount();filter();updateShare();search.focus()});
 more.addEventListener('click',()=>{const first=shown;add();grid.children[first]?.querySelector('a')?.focus({preventScroll:true})});
 let count=20;try{search.value=sessionStorage.getItem('pi-search')||'';year.value=sessionStorage.getItem('pi-year')||'';month.value=sessionStorage.getItem('pi-month')||'';count=Number(sessionStorage.getItem('pi-visible'))||20}catch(_){}const params=new URLSearchParams(location.search);if(params.has('q')||params.has('ano')||params.has('mes')){search.value=params.get('q')||'';year.value=params.get('ano')||'';month.value=params.get('mes')||'';count=20;}filter();while(shown<count&&shown<filtered.length)add();
 grid.addEventListener('click',()=>{try{sessionStorage.setItem('pi-visible',String(shown));sessionStorage.setItem('pi-search',search.value);sessionStorage.setItem('pi-year',year.value);sessionStorage.setItem('pi-month',month.value)}catch(_){}});
 let refreshing=false;
 const applyFeed=episodes=>{const signature=JSON.stringify(episodes);if(signature===JSON.stringify(all))return;const count=Math.max(20,shown);all.splice(0,all.length,...episodes);index=all.map(text);updateYears();updateFavCount();playlists.refresh();filter();while(shown<count&&shown<filtered.length)add();const counter=document.querySelector('.intro .count');if(counter)counter.textContent=all.length+' episódios para descobrir';};
 const refresh=async()=>{if(refreshing)return;refreshing=true;try{applyFeed(await PI.getFeed());}catch(_){}finally{refreshing=false;}};
 if(window.PI){const cache=PI.cached();if(cache.length&&Date.parse(cache[0]?.dateISO)>Date.parse(all[0]?.dateISO))applyFeed(cache);refresh();setInterval(()=>{if(!document.hidden&&navigator.onLine)refresh()},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});window.addEventListener('online',refresh);}
 (async()=>{
  let voices=[];
  try{const r=await fetch('assets/vozes.json');if(r.ok)voices=await r.json()}catch(_){}
  try{
   const fallbackNames=voices.map(v=>v.nome).filter(Boolean).join('\n'),query=new URLSearchParams({fallback:fallbackNames});\n   const r=await fetch('https://parcerias-prazeres-interrompidos.jauntymink64.chatgpt.site/api/voices?'+query.toString());
   if(r.ok){const managed=await r.json(),key=s=>String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('pt-PT').trim(),merged=new Map(voices.filter(v=>v.nome&&v.foto).map(v=>[key(v.nome),v]));(managed.hidden||[]).forEach(n=>merged.delete(key(n)));(managed.voices||[]).forEach(v=>{if(v.nome&&v.foto)merged.set(key(v.nome),v)});voices=[...merged.values()]}
  }catch(_){}
  const container=document.getElementById('voices');
  for(const voice of voices){
   if(!voice.nome||!voice.foto)continue;
   const button=document.createElement('button');button.type='button';button.className='voice';button.title=voice.nome;button.setAttribute('aria-label','Procurar episódios com '+voice.nome);
   const img=document.createElement('img');img.src=voice.foto;img.alt=voice.nome;img.loading='lazy';img.width=88;img.height=88;const name=document.createElement('span');name.textContent=voice.nome;button.append(img,name);
   button.addEventListener('click',()=>{search.value=voice.nome;filter();search.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'})});container.append(button);
  }
  document.getElementById('voices-empty').hidden=container.children.length>0;
 })().catch(()=>{});
}
window.initEpisodePlayer=function(){
const audio=document.getElementById('audio');
if(audio&&!audio.dataset.initialized){
audio.dataset.initialized='true';
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
 const moreShare=document.getElementById('native-share');moreShare.hidden=false;
 const panel=document.createElement('div');panel.id='share-extra';panel.className='share-extra';panel.hidden=true;
 const heading=document.createElement('h3');heading.textContent='Mais formas de partilhar';panel.append(heading);
 const options=document.createElement('div');options.className='share-buttons';
 const extra={ 'Snapchat':'https://www.snapchat.com/share?link='+u, 'E-mail':'mailto:?subject='+t+'&body='+encodeURIComponent(title+'\n'+pageURL), 'Bluesky':'https://bsky.app/intent/compose?text='+encodeURIComponent(title+' '+pageURL), 'Reddit':'https://www.reddit.com/submit?url='+u+'&title='+t, 'Pinterest':'https://www.pinterest.com/pin/create/button/?url='+u+'&media='+encodeURIComponent(document.querySelector('.episode-cover img').src)+'&description='+t };
 for(const [label,url] of Object.entries(extra)){const a=document.createElement('a');a.textContent=label;a.href=url;if(!url.startsWith('mailto:')){a.target='_blank';a.rel='noopener noreferrer'}options.append(a)}
 if(navigator.share){const system=document.createElement('button');system.type='button';system.textContent='Partilhar noutras aplicações';system.addEventListener('click',async()=>{try{await navigator.share({title,url:pageURL})}catch(e){if(e.name!=='AbortError')notify('Escolha uma opção de partilha ou copie a ligação.')}});options.append(system)}
 window.appShareOptions(options,()=>({title,url:pageURL}));
 const close=document.createElement('button');close.type='button';close.textContent='Fechar';close.addEventListener('click',()=>{panel.hidden=true;moreShare.setAttribute('aria-expanded','false');moreShare.focus()});options.append(close);panel.append(options);moreShare.closest('.sharing').append(panel);
 moreShare.setAttribute('aria-controls',panel.id);moreShare.setAttribute('aria-expanded','false');moreShare.addEventListener('click',()=>{panel.hidden=!panel.hidden;moreShare.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)options.querySelector('a').focus()});
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;moreShare.setAttribute('aria-expanded','false');moreShare.focus()}});
 const downloadArea=document.createElement('div');downloadArea.className='download-area';const download=document.createElement('button');download.type='button';download.className='download-button';download.textContent='↓ Descarregar episódio';
 const downloadStatus=document.createElement('p');downloadStatus.setAttribute('role','status');const fallback=document.createElement('a');fallback.href=audio.src;fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.textContent='Abrir o áudio para guardar';fallback.hidden=true;
 downloadArea.append(download,downloadStatus,fallback);document.querySelector('.player').after(downloadArea);
 download.addEventListener('click',async()=>{download.disabled=true;download.textContent='A descarregar…';downloadStatus.textContent='A preparar o ficheiro MP3.';fallback.hidden=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),90000);
  try{const response=await fetch(audio.src,{signal:controller.signal});if(!response.ok)throw Error();const blob=await response.blob();if(!blob.size||(!blob.type.startsWith('audio/')&&!blob.type.startsWith('application/octet-stream')&&blob.type!==''))throw Error();const objectURL=URL.createObjectURL(blob);const a=document.createElement('a');a.href=objectURL;a.download=(title.replace(/[\\/:*?"<>|]/g,'-').slice(0,160)||'episodio')+'.mp3';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectURL),60000);downloadStatus.textContent='Ficheiro preparado. Consulte as transferências do navegador.'}
  catch(_){downloadStatus.textContent='O servidor de áudio não permitiu a transferência direta. Abra o áudio e utilize «Guardar áudio como…» ou a opção de descarga do navegador.';fallback.hidden=false}
  finally{clearTimeout(timeout);download.disabled=false;download.textContent='↓ Descarregar episódio'}
 });
 if('mediaSession' in navigator&&'MediaMetadata' in window){navigator.mediaSession.metadata=new MediaMetadata({title,artist:'Prazeres Interrompidos',artwork:[{src:document.querySelector('.episode-cover img').src}]})}
}

};
if(!document.body.hasAttribute("data-live-episode"))window.initEpisodePlayer();
