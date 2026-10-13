#!/usr/bin/env python3
import argparse, hashlib, html, json, re
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TOPICS_FILE=ROOT/'content/topics/topics.json'; MANIFEST=ROOT/'content/published_manifest.json'; POSTS=ROOT/'posts'
MAX_PER_DAY=20; MAX_PER_RUN=5
TEMPLATES=[('Quick security tip','{tip}'),('Security habit to try','A practical security habit: {tip}'),('Cybersecurity reminder','Keep this in mind: {tip}'),('Small step, stronger security','One small step can help: {tip}')]
def norm(s): return re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',s.lower())).strip()
def digest(s): return hashlib.sha256(norm(s).encode()).hexdigest()
def slugify(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')[:70] or 'security-tip'
def load(path,default):
    if not path.exists(): return default
    try: return json.loads(path.read_text(encoding='utf-8'))
    except Exception as e: raise SystemExit(f'Cannot read {path}: {e}')
def check(title,body,action):
    errors=[]
    if not 8<=len(title.strip())<=90: errors.append('title length outside 8–90 characters')
    if not 12<=len(body.split())<=90: errors.append('body must be 12–90 words')
    if len(action.split())<4: errors.append('call-to-action too short')
    combined=f'{title} {body} {action}'
    if re.search(r'https?://|www\.',combined,re.I): errors.append('URLs disallowed in generated copy')
    if any(re.search(p,combined,re.I) for p in [r'\b100%\s+secure\b',r'\bguaranteed\s+protection\b',r'\bimpossible to hack\b',r'\bzero risk\b']): errors.append('absolute/misleading security claim')
    return errors
def render(title,category,body,action,date):
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="{html.escape(body)}"><title>{html.escape(title)} | Redeemed Hacker Pro</title></head><body><main><p><a href="/posts/">All posts</a> | {html.escape(category)} | <time datetime="{date}">{date}</time></p><article><h1>{html.escape(title)}</h1><p>{html.escape(body)}</p><p><strong>Try this:</strong> {html.escape(action)}</p><p><small>Cybersecurity awareness information. Adapt advice to your device, account, and organization policies.</small></p></article></main></body></html>'''
def write_index(items):
    POSTS.mkdir(parents=True,exist_ok=True); rows=[]
    for x in sorted(items,key=lambda x:(x.get('date',''),x.get('title','')),reverse=True):
        rows.append(f'<li><time>{html.escape(str(x.get("date","")))}</time> — <a href="/{html.escape(str(x.get("path","")),quote=True)}">{html.escape(str(x.get("title","")))}</a> <small>({html.escape(str(x.get("category","")))})</small></li>')
    listing='\n'.join(rows) or '<li>No posts published yet.</li>'
    (POSTS/'index.html').write_text(f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cybersecurity Short Posts | Redeemed Hacker Pro</title><meta name="description" content="Short cybersecurity awareness tips from Redeemed Hacker Pro."></head><body><main><h1>Cybersecurity Short Posts</h1><p>Practical cybersecurity awareness tips.</p><ol>{listing}</ol><p><a href="/">Return to Redeemed Hacker Pro</a></p></main></body></html>',encoding='utf-8')
def main():
    p=argparse.ArgumentParser(); p.add_argument('--limit',type=int,default=5); p.add_argument('--date',help='UTC date YYYY-MM-DD'); a=p.parse_args()
    if not 1<=a.limit<=MAX_PER_RUN: raise SystemExit(f'--limit must be 1–{MAX_PER_RUN}')
    today=a.date or datetime.now(timezone.utc).strftime('%Y-%m-%d')
    try: datetime.strptime(today,'%Y-%m-%d')
    except ValueError: raise SystemExit('--date must be YYYY-MM-DD')
    topics=load(TOPICS_FILE,[]); manifest=load(MANIFEST,{'items':[],'daily_counts':{}}); items=manifest.setdefault('items',[]); counts=manifest.setdefault('daily_counts',{})
    already=int(counts.get(today,0)); limit=min(a.limit,max(0,MAX_PER_DAY-already))
    if not limit: print(f'Daily cap reached ({MAX_PER_DAY}) for {today}; nothing published.'); return
    titles={norm(x.get('title','')) for x in items}; hashes={x.get('content_hash') for x in items}; topics_today={norm(x.get('topic','')) for x in items if x.get('date')==today}
    for f in POSTS.rglob('*.html') if POSTS.exists() else []:
        try: m=re.search(r'<h1>(.*?)</h1>',f.read_text(encoding='utf-8'),re.S|re.I)
        except OSError: continue
        if m: titles.add(norm(html.unescape(m.group(1))))
    created=[]
    for i,t in enumerate(topics):
        if len(created)>=limit: break
        name=str(t.get('topic','')).strip(); category=str(t.get('category','Cybersecurity')).strip(); tip=str(t.get('tip','')).strip(); action=str(t.get('action','')).strip()
        if norm(name) in topics_today: print(f'DUPLICATE TOPIC: skipped {name} for {today}'); continue
        if not name or not tip or not action: print(f'CHECK: skipped incomplete topic {name!r}'); continue
        prefix,fmt=TEMPLATES[(already+len(created)+i)%len(TEMPLATES)]; title=f'{prefix}: {name}'; body=fmt.format(tip=tip); fp=digest(title+' '+body+' '+action)
        problems=check(title,body,action)
        if problems: print(f'CHECK: rejected {title!r}: {problems}'); continue
        if norm(title) in titles or fp in hashes: print(f'DUPLICATE: skipped {title}'); continue
        slug=slugify(name+'-'+hashlib.sha1(fp.encode()).hexdigest()[:8]); rel=Path('posts')/today[:4]/today[5:7]/(slug+'.html'); out=ROOT/rel; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(render(title,category,body,action,today),encoding='utf-8')
        item={'date':today,'topic':name,'title':title,'category':category,'path':rel.as_posix(),'content_hash':fp}; items.append(item); created.append(item); titles.add(norm(title)); hashes.add(fp); topics_today.add(norm(name))
    counts[today]=already+len(created); MANIFEST.parent.mkdir(parents=True,exist_ok=True); MANIFEST.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf-8'); write_index(items)
    print(f'Created {len(created)} post(s) for {today}; daily count {counts[today]}/{MAX_PER_DAY}.')
    for x in created: print(f'PASS: {x["path"]} — {x["title"]}')
    if not created: print('No new posts passed checks. No content was published.')
if __name__=='__main__': main()
