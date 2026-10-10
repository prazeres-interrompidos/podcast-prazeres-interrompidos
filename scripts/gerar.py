#!/usr/bin/env python3
"""Gera páginas estáticas a partir do RSS, sem dependências externas."""
import argparse, hashlib, html, json, os, re, shutil, time, unicodedata, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[1]
FEED='https://anchor.fm/s/9fd320a8/podcast/rss'
NS={'i':'http://www.itunes.com/dtds/podcast-1.0.dtd','content':'http://purl.org/rss/1.0/modules/content/'}
def esc(v): return html.escape(str(v),quote=True)
def url(v):
 return v if v.startswith(('https://','http://')) else ''
class CleanHTML(HTMLParser):
 allowed={'p','br','strong','em','b','i','ul','ol','li','a','blockquote','h2','h3'}
 def __init__(self): super().__init__(convert_charrefs=True); self.out=[]; self.blocked=0
 def handle_starttag(self,tag,attrs):
  if tag in {'script','style','iframe','object'}: self.blocked+=1; return
  if self.blocked or tag not in self.allowed: return
  extra=''
  if tag=='a':
   href=dict(attrs).get('href','')
   if url(href): extra=f' href="{esc(href)}" target="_blank" rel="noopener noreferrer"'
  self.out.append('<'+tag+extra+'>')
 def handle_endtag(self,tag):
  if tag in {'script','style','iframe','object'}: self.blocked=max(0,self.blocked-1); return
  if not self.blocked and tag in self.allowed and tag!='br': self.out.append('</'+tag+'>')
 def handle_data(self,data):
  if not self.blocked: self.out.append(esc(data))
def clean(s):
 p=CleanHTML(); p.feed(s); return ''.join(p.out)
def plain(s): return html.unescape(re.sub('<[^>]+>',' ',s)).strip()
def duration(s):
 try:
  parts=[int(float(x)) for x in s.split(':')]; n=0
  for p in parts: n=n*60+p
  return (f'{n//3600}:{n//60%60:02}:{n%60:02}' if n>=3600 else f'{n//60}:{n%60:02}')
 except (ValueError,TypeError): return 'Duração não indicada'
def card(e,prefix=''):
 return f'<a class="card" href="{prefix}episodios/{e["id"]}/"><div class="cover"><img src="{esc(e["image"])}" alt="Capa de {esc(e["title"])}" loading="lazy" width="600" height="600"><span class="listen">▶ Ouvir episódio</span></div><h2>{esc(e["title"])}</h2><p class="meta"><time datetime="{e["dateISO"]}">{e["date"]}</time><span>◷ {e["duration"]}</span></p></a>'
def page(title,body,prefix='',canonical='',image='',description=''):
 metadata=''
 if canonical:
  metadata=f'<link rel="canonical" href="{esc(canonical)}"><meta property="og:url" content="{esc(canonical)}">'
 return f'''<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} | Prazeres Interrompidos</title><meta name="description" content="{esc(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Prazeres Interrompidos"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:image" content="{esc(image)}"><meta name="twitter:card" content="summary_large_image">{metadata}<meta name="theme-color" content="#153f3c"><link rel="stylesheet" href="{prefix}assets/style.css"><script defer src="{prefix}assets/live.js?v={hashlib.sha256((ROOT/"live.js").read_bytes()).hexdigest()[:12]}"></script><script defer src="{prefix}assets/app.js?v={hashlib.sha256((ROOT/"app.js").read_bytes()).hexdigest()[:12]}"></script></head><body><a class="skip" href="#conteudo">Saltar para o conteúdo</a><header><a class="brand" href="{prefix}index.html"><span class="brand-icon" aria-hidden="true"><svg viewBox="0 0 32 32" width="29" height="29" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 8C12 5 7 5 3 6v20c4-1 9-1 13 2 4-3 9-3 13-2V6c-4-1-9-1-13 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M16 8v20M7 11c2-.3 4 0 6 1m-6 4c2-.3 4 0 6 1m6-5c2-1 4-1.3 6-1m-6 6c2-1 4-1.3 6-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span><span>Prazeres Interrompidos<small>Projeto Internacional de Promoção da Leitura, dos Livros e dos Escritores</small></span></a><a class="site-link" href="https://www.prazeresinterrompidos.pt/" target="_blank" rel="noopener">O nosso site ↗</a></header><main id="conteudo">{body}</main><footer>Prazeres Interrompidos · Um encontro com os livros e com quem lhes dá voz.</footer><div id="notice" role="status" aria-live="polite"></div></body></html>'''
def main():
 parser=argparse.ArgumentParser(); parser.add_argument('--feed-file'); parser.add_argument('--base-url',default=os.environ.get('SITE_URL','')); args=parser.parse_args()
 if args.feed_file: raw=Path(args.feed_file).read_bytes()
 else:
  # Um endereço diferente por execução evita reutilizar uma versão antiga do RSS.
  for attempt in range(3):
   try:
    feed_url=FEED+'?refresh='+str(time.time_ns())
    request=urllib.request.Request(feed_url,headers={'User-Agent':'PrazeresInterrompidos/1.1','Cache-Control':'no-cache, no-store','Pragma':'no-cache'})
    with urllib.request.urlopen(request,timeout=90) as response: raw=response.read()
    if ET.fromstring(raw).find('channel') is None: raise RuntimeError('RSS sem canal')
    break
   except Exception:
    if attempt==2: raise
    time.sleep(3*(attempt+1))
 channel=ET.fromstring(raw).find('channel')
 if channel is None: raise RuntimeError('RSS sem canal')
 fallback=channel.find('i:image',NS); fallback=url(fallback.get('href','')) if fallback is not None else ''
 items=[]; seen=set()
 for x in channel.findall('item'):
  enclosure=x.find('enclosure'); audio=url(enclosure.get('url','')) if enclosure is not None else ''
  if not audio: continue
  guid=x.findtext('guid') or audio
  # O endereço depende apenas do identificador RSS, mesmo que o título mude.
  ident='episodio-'+hashlib.sha256(guid.encode()).hexdigest()[:20]
  if ident in seen: continue
  seen.add(ident)
  title=x.findtext('title') or 'Episódio'; im=x.find('i:image',NS)
  image=url(im.get('href','')) if im is not None else fallback
  try: date=parsedate_to_datetime(x.findtext('pubDate')).astimezone(ZoneInfo('Europe/Lisbon'))
  except (ValueError,TypeError,AttributeError): date=None
  description=clean(x.findtext('content:encoded',namespaces=NS) or x.findtext('description') or x.findtext('i:summary',namespaces=NS) or '')
  items.append(dict(id=ident,title=title,image=image or fallback,audio=audio,description=description,date=date.strftime('%d/%m/%Y') if date else 'Data não indicada',dateISO=date.isoformat() if date else '',duration=duration(x.findtext('i:duration',default='',namespaces=NS))))
 if not items: raise RuntimeError('O RSS não contém episódios com áudio; publicação cancelada.')
 items.sort(key=lambda e:e['dateISO'],reverse=True)
 out=ROOT/'public'; assets=out/'assets'; assets.mkdir(parents=True,exist_ok=True)
 for name in ('style.css','app.js','live.js'): (assets/name).write_text((ROOT/name).read_text(),encoding='utf-8')
 (assets/'episodes.js').write_text('window.EPISODES='+json.dumps(items,ensure_ascii=False).replace('<','\\u003c')+';',encoding='utf-8')
 # Fotografias geridas no ficheiro vozes.json; imagens podem ser locais ou incorporadas.
 (assets/'vozes.json').write_text((ROOT/'vozes.json').read_text(encoding='utf-8'),encoding='utf-8')
 if (ROOT/'imagens').exists(): shutil.copytree(ROOT/'imagens',out/'imagens',dirs_exist_ok=True)
 shutil.copyfile(ROOT/'gerir-vozes.html',out/'gerir-vozes.html')
 (assets/'atualizacao.json').write_text(json.dumps({'generated_at':datetime.now(ZoneInfo('UTC')).isoformat(),'count':len(items),'ids':[e['id'] for e in items]},ensure_ascii=False),encoding='utf-8')
 base=args.base_url.rstrip('/')
 home=f'''<section class="intro"><img class="podcast-logo" src="{esc(fallback)}" alt="Logótipo do Podcast Prazeres Interrompidos" width="150" height="150"><p class="eyebrow">O PODCAST · PRAZERES INTERROMPIDOS</p><h1>Os livros têm voz.<br><em>Descobre a tua próxima leitura.</em></h1><p>Histórias, leituras e encontros com os livros e os escritores.</p><p class="count">{len(items)} episódios para descobrir</p></section><section class="voices" id="voices-section" aria-label="Vozes do Podcast"><h2>Vozes do Podcast</h2><div id="voices" class="voices-list"></div><p id="voices-empty">As vozes que dão vida aos livros.</p></section><section aria-label="Episódios"><div class="section-heading"><h2>Todos os episódios</h2><span>Do mais recente ao mais antigo</span></div><form class="search" role="search" id="search-form"><label for="search">Procurar episódios</label><div class="search-field"><span aria-hidden="true">⌕</span><input type="search" id="search" placeholder="Título, livro, autor ou voz do podcast…" autocomplete="off"><button type="reset" id="clear-search" aria-label="Limpar pesquisa">×</button></div></form><p id="search-result" role="status" aria-live="polite"></p><div class="grid" id="episodes">{''.join(card(e) for e in items[:20])}</div><div class="load"><p id="progress" role="status">20 de {len(items)} episódios</p><button id="more" type="button" hidden>Ver mais <span aria-hidden="true">↓</span></button><noscript><p>Ative o JavaScript para ver os restantes episódios.</p></noscript></div></section><script src="assets/episodes.js"></script>'''
 (out/'index.html').write_text(page('Episódios',home,canonical=base+'/' if base else '',image=fallback,description='Ouça os episódios do Podcast Prazeres Interrompidos. Livros, leituras e escritores num só espaço.'),encoding='utf-8')
 for e in items:
  dest=out/'episodios'/e['id']; dest.mkdir(parents=True,exist_ok=True)
  body=f'''<a class="back" href="../../index.html">← Todos os episódios</a><article class="episode"><div class="episode-cover"><img src="{esc(e['image'])}" alt="Capa de {esc(e['title'])}" width="800" height="800"></div><div class="episode-info"><p class="eyebrow">PRAZERES INTERROMPIDOS · PODCAST</p><h1>{esc(e['title'])}</h1><p class="meta"><time datetime="{e['dateISO']}">{e['date']}</time><span>◷ {e['duration']}</span></p><section class="player" aria-label="Leitor de áudio"><audio id="audio" controls preload="none" src="{esc(e['audio'])}">O seu navegador não suporta áudio. <a href="{esc(e['audio'])}">Ouvir áudio</a></audio><div id="custom-player" hidden><div class="player-top"><button id="play" aria-label="Reproduzir" type="button">▶</button><span id="player-status">Ouvir este episódio</span><select id="speed" aria-label="Velocidade de reprodução"><option value="0.75">0,75×</option><option value="1" selected>1×</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option><option value="2">2×</option></select></div><input id="seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Posição no episódio" disabled><div class="times"><span id="current">0:00</span><span id="total">{e['duration']}</span></div><div class="player-bottom"><button id="rewind" type="button" aria-label="Recuar 15 segundos">↶ 15 s</button><button id="forward" type="button" aria-label="Avançar 15 segundos">15 s ↷</button><label class="volume">Volume <input id="volume" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume"></label></div></div><p id="audio-error" role="status"></p></section><section class="sharing" aria-label="Partilhar episódio"><h2>Partilhe esta escuta</h2><div class="share-buttons"><a data-share="whatsapp">WhatsApp</a><a data-share="facebook">Facebook</a><a data-share="x">X</a><a data-share="linkedin">LinkedIn</a><a data-share="telegram">Telegram</a><button id="copy" type="button">Copiar ligação</button><button id="native-share" type="button" hidden>Mais opções ↗</button></div></section></div></article><section class="description"><p class="eyebrow">SOBRE ESTE EPISÓDIO</p><h2>Uma história para descobrir</h2><div>{e['description'] or '<p>Este episódio não tem descrição no feed RSS.</p>'}</div></section>'''
  canonical=base+'/episodios/'+e['id']+'/' if base else ''
  (dest/'index.html').write_text(page(e['title'],body,'../../',canonical,e['image'],plain(e['description'])[:240]),encoding='utf-8')
 # Página dinâmica com endereço próprio para episódios ainda não gerados pelo GitHub.
 sample=out/'episodios'/items[0]['id']/'index.html'
 dynamic=sample.read_text(encoding='utf-8').replace('../../','')
 dynamic=dynamic.replace('<body>','<body data-live-episode>')
 dynamic=re.sub(r'<link rel="canonical"[^>]*>','',dynamic)
 dynamic=re.sub(r'<meta (?:property="og:[^"]+"|name="(?:description|twitter:card)")[^>]*>','',dynamic)
 dynamic=re.sub(r'<title>.*?</title>','<title>Episódio | Prazeres Interrompidos</title>',dynamic)
 dynamic=re.sub(r'<article class="episode">','<p id="live-episode-status" role="status">A obter o episódio…</p><article class="episode" hidden>',dynamic)
 dynamic=dynamic.replace('<section class="description">','<section class="description" hidden>')
 dynamic=re.sub(r'(<audio id="audio"[^>]*?) src="[^"]*"',r'\1',dynamic)
 (out/'episodio.html').write_text(dynamic,encoding='utf-8')
 if base:
  urls=[base+'/']+[base+'/episodios/'+e['id']+'/' for e in items]
  (out/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+esc(u)+'</loc></url>' for u in urls)+'</urlset>',encoding='utf-8')
  (out/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: '+base+'/sitemap.xml\n',encoding='utf-8')
 print(f'Gerados {len(items)} episódios em {out}')
 print('Episódio mais recente:',items[0]['title'],items[0]['date'])
if __name__=='__main__': main()
