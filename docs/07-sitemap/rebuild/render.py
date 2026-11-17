"""Render stage-07 YAML with the already pinned external PyYAML QA tool; no service dependency."""
from pathlib import Path
import html,json,datetime
import yaml
ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'docs/07-sitemap/sources/rebuild.yaml'
def flatten(nodes,parent=None):
 result=[]
 for item in nodes:
  result.append({**{k:v for k,v in item.items() if k!='children'},'parent':parent})
  result.extend(flatten(item.get('children',[]),item['id']))
 return result
screens=flatten(yaml.safe_load(SOURCE.read_text()));assert len(screens)==11
assert len({c['id'] for c in screens})==len(screens)==len({c['path'] for c in screens})
ids={c['id'] for c in screens};assert all(c['parent'] is None or c['parent'] in ids for c in screens)
data=json.dumps(screens,ensure_ascii=False).replace('<','\\u003c')
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
page='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NEXUS 재설계 사이트맵</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f7f7;color:#202020;font:16px/1.6 system-ui,sans-serif;word-break:keep-all;overflow-wrap:break-word}header,main{max-width:1200px;margin:auto;padding:24px}h1{font-size:28px}button{min-height:44px;padding:8px 16px;border:1px solid #666;background:white;color:#202020;border-radius:4px;cursor:pointer}button[aria-pressed=true]{background:#202020;color:white}button:focus-visible{outline:3px solid #205dc1;outline-offset:3px}nav{display:flex;gap:8px;flex-wrap:wrap}.views{margin-top:24px}.tree{display:grid;gap:16px}.node{border:1px solid #777;background:white;padding:16px;text-align:left;width:100%}.node span{display:block}.route{font:13px/1.6 monospace;overflow-wrap:anywhere}.child{margin-left:24px}.panel{background:white;padding:24px;border:1px solid #777;margin-top:24px}table{border-collapse:collapse;width:100%}th,td{text-align:left;border-bottom:1px solid #aaa;padding:12px;vertical-align:top}.scroll{overflow:auto}.slide{background:white;border:1px solid #777;padding:24px;margin-bottom:24px}#detail{min-height:100px}@media(max-width:600px){header,main{padding:16px}.child{margin-left:12px}th,td{padding:8px}}[hidden]{display:none!important}</style><header><p>01–10 재설계 · Stage 07</p><h1>한 프로젝트, 모든 검토 경로</h1><p>루트에서 화면 11개로 연결됩니다. 경로·권한·플로우는 YAML에서 생성했습니다.</p><p>생성: STAMP</p><nav aria-label="사이트맵 보기"><button data-view="board" aria-pressed="true">보드</button><button data-view="list" aria-pressed="false">목록</button><button data-view="slides" aria-pressed="false">슬라이드</button></nav></header><main><section id="board" class="views tree" aria-label="화면 트리"></section><section id="list" class="views scroll" hidden></section><section id="slides" class="views" hidden></section><section id="detail" class="panel" aria-live="polite">화면을 선택하면 경로와 권한을 확인할 수 있습니다. 실제 화면은 08·09 단계에서 작성합니다.</section></main><script>
const screens=DATA;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const depth=c=>c.parent?1+depth(screens.find(x=>x.id===c.parent)):0;
document.querySelector('#board').innerHTML=screens.map(c=>`<div style="margin-left:${depth(c)*12}px"><button class="node" data-screen="${c.id}"><strong>${c.id} · ${esc(c.name)}</strong><span class="route">${esc(c.path)}</span><span>${esc(c.access)}</span></button></div>`).join('');
document.querySelector('#list').innerHTML='<table><thead><tr><th>화면</th><th>경로</th><th>권한·플로우</th></tr></thead><tbody>'+screens.map(c=>`<tr><td>${c.id}<br/>${esc(c.name)}</td><td class="route">${esc(c.path)}</td><td>${esc(c.access)}<br/>${c.flows.join(', ')}</td></tr>`).join('')+'</tbody></table>';
document.querySelector('#slides').innerHTML=`<article class="slide"><h2>${screens[0].id} · ${esc(screens[0].name)}</h2><p class="route">${esc(screens[0].path)}</p><p>${esc(screens[0].access)}</p><p>${screens[0].flows.join(', ')}</p></article>`+screens.filter(c=>c.parent==='SCR-131').map(branch=>`<article class="slide"><h2>${branch.id} · ${esc(branch.name)}</h2>${screens.filter(c=>c.id===branch.id||c.parent===branch.id||screens.find(x=>x.id===c.parent)?.parent===branch.id).map(c=>`<p><strong>${c.id} · ${esc(c.name)}</strong><br/><span class="route">${esc(c.path)}</span><br/>${esc(c.access)} · ${c.flows.join(', ')}</p>`).join('')}</article>`).join('');
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.views').forEach(v=>v.hidden=v.id!==b.dataset.view);document.querySelectorAll('[data-view]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)))}));
document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>{const c=screens.find(x=>x.id===b.dataset.screen);document.querySelector('#detail').innerHTML=`<h2>${c.id} · ${esc(c.name)}</h2><p class="route">${esc(c.path)}</p><p>${esc(c.access)}</p><p>${c.flows.join(', ')}</p><p>설계한 경로입니다. 제품 화면과 상태는 08·09에서 작성합니다.</p>`}));
</script></html>'''.replace('STAMP',html.escape(stamp)).replace('DATA',data)
(ROOT/'docs/07-sitemap/rebuild/index.html').write_text(page)
print(json.dumps({'screens':len(screens),'views':['board','list','slides'],'generated_at':stamp}))
