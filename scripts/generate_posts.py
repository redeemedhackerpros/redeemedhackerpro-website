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
return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="{html.escape(body, quote=True)}"><title>{html.escape(title)} | Redeemed Hacker Pro</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"><style>:root{{--bg:#07101f;--panel:#0c1b30;--cyan:#42d9f4;--green:#70f4c5;--text:#edf5ff;--muted:#a4b5cc;--border:rgba(100,180,230,.2)}}*{{box-sizing:border-box}}body{{margin:0;background:radial-gradient(ellipse at top,#102746 0%,#07101f 55%);color:var(--text);font-family:Manrope,Arial,sans-serif;line-height:1.75;min-height:100vh}}.wrap{{width:min(900px,calc(100% - 32px));margin:0 auto;padding:28px 0 70px}}header{{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0 28px;border-bottom:1px solid var(--border)}}.brand{{font-weight:800;letter-spacing:-.04em;font-size:19px}}.brand span{{color:var(--cyan)}}.tag{{font:12px 'DM Mono',monospace;color:var(--green);letter-spacing:.08em;text-transform:uppercase}}a{{color:var(--cyan);text-decoration:none}}a:hover{{text-decoration:underline}}.back{{display:inline-block;margin:26px 0;color:var(--green);font-size:14px}}article{{margin-top:12px;padding:clamp(24px,6vw,54px);border:1px solid var(--border);border-radius:22px;background:linear-gradient(145deg,rgba(12,27,48,.96),rgba(7,16,31,.96));box-shadow:0 24px 80px rgba(0,0,0,.22)}}.meta{{font:12px 'DM Mono',monospace;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}}h1{{font-size:clamp(30px,6vw,48px);line-height:1.15;letter-spacing:-.045em;margin:22px 0;color:white}}.rule{{height:3px;width:68px;background:linear-gradient(90deg,var(--cyan),var(--green));border-radius:5px;margin:24px 0}}.body{{font-size:17px;color:#d7e4f4}}.action{{margin-top:30px;padding:20px 22px;border:1px solid rgba(112,244,197,.3);border-radius:14px;background:rgba(112,244,197,.06)}}.action strong{{display:block;color:var(--green);font-size:12px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}}.note{{margin-top:30px;padding-top:20px;border-top:1px solid var(--border);color:var(--muted);font-size:12px}}footer{{padding:24px 0;color:var(--muted);font-size:12px;text-align:center}}@media(max-width:500px){{.tag{{font-size:10px}}.wrap{{width:calc(100% - 22px)}}}}</style></head><body><div class="wrap"><header><div class="brand">REDEEMED <span>HACKER PRO</span></div><div class="tag">Security awareness</div></header><a class="back" href="/posts/">&#8592; All cybersecurity posts</a><article><div class="meta">{html.escape(category)} &nbsp; / &nbsp; <time datetime="{html.escape(date, quote=True)}">{html.escape(date)}</time></div><h1>{html.escape(title)}</h1><div class="rule"></div><p class="body">{html.escape(body)}</p><div class="action"><strong>Try this</strong>{html.escape(action)}</div><p class="note">Cybersecurity awareness information. Adapt advice to your device, account, and organization policies.</p></article><footer>&copy; Redeemed Hacker Pro &middot; Stay aware. Stay secure.</footer></div></body></html>'''
def write_index(items):
    POSTS.mkdir(parents=True, exist_ok=True)
    rows = []
    for x in sorted(
        items,
        key=lambda x: (x.get('date', ''), x.get('title', '')),
        reverse=True
    ):
        rows.append(
            f'<li class="post-item">'
            f'<time>{html.escape(str(x.get("date", "")))}</time>'
            f'<span class="dash">—</span> '
            f'<a href="/{html.escape(str(x.get("path", "")), quote=True)}">'
            f'{html.escape(str(x.get("title", "")))}</a> '
            f'<span class="category">'
            f'{html.escape(str(x.get("category", "")))}</span>'
            f'</li>'
        )
    listing = '\n'.join(rows) or (
        '<li class="post-item">No posts published yet.</li>'
    )
    page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Short cybersecurity awareness tips from Redeemed Hacker Pro.">
<title>Cybersecurity Short Posts | Redeemed Hacker Pro</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root {{
  --bg: #07101f;
  --panel: #0c1b30;
  --cyan: #42d9f4;
  --green: #70f4c5;
  --text: #edf5ff;
  --muted: #a4b5cc;
  --border: rgba(100,180,230,.2);
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0;
  min-height: 100vh;
  background: radial-gradient(ellipse at top, #102746 0%, var(--bg) 58%);
  color: var(--text);
  font-family: Manrope, Arial, sans-serif;
  line-height: 1.7;
}}
.wrap {{ width: min(1000px, calc(100% - 32px)); margin: 0 auto; }}
header {{
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 0;
  border-bottom: 1px solid var(--border);
}}
.brand {{ font-size: 19px; font-weight: 800; letter-spacing: -.04em; }}
.brand span {{ color: var(--cyan); }}
.tag {{
  color: var(--green);
  font: 12px 'DM Mono', monospace;
  letter-spacing: .08em;
  text-transform: uppercase;
}}
main {{ padding: 48px 0 64px; }}
.eyebrow {{
  color: var(--green);
  font: 12px 'DM Mono', monospace;
  letter-spacing: .1em;
  text-transform: uppercase;
}}
h1 {{
  margin: 12px 0;
  color: white;
  font-size: clamp(32px, 6vw, 52px);
  line-height: 1.15;
  letter-spacing: -.045em;
}}
.intro {{ color: var(--muted); margin-bottom: 28px; }}
.panel {{
  padding: clamp(18px, 4vw, 32px);
  border: 1px solid var(--border);
  border-radius: 20px;
  background: linear-gradient(145deg, rgba(12,27,48,.96), rgba(7,16,31,.96));
  box-shadow: 0 24px 80px rgba(0,0,0,.22);
}}
ol {{ list-style: none; padding: 0; margin: 0; }}
.post-item {{
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}}
.post-item:last-child {{ border-bottom: 0; }}
time, .category {{
  color: var(--muted);
  font: 12px 'DM Mono', monospace;
}}
a {{ color: var(--cyan); text-decoration: none; }}
a:hover {{ color: var(--green); text-decoration: underline; }}
.dash {{ color: var(--muted); }}
.category {{
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2px 8px;
}}
.back {{
  display: inline-block;
  margin-top: 28px;
  color: var(--green);
  font-size: 14px;
}}
footer {{
  padding: 24px 0;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}}
@media (max-width: 600px) {{
  .post-item {{ gap: 6px; }}
  .category {{ font-size: 10px; }}
}}
</style>
</head>
<body>
<div class="wrap">
<header>
  <div class="brand">REDEEMED <span>HACKER PRO</span></div>
  <div class="tag">Security awareness</div>
</header>
<main>
  <div class="eyebrow">Learn · Protect · Stay aware</div>
  <h1>Cybersecurity Short Posts</h1>
  <p class="intro">Practical cybersecurity awareness tips to help you stay safer online.</p>
  <section class="panel">
    <ol>{listing}</ol>
  </section>
  <a class="back" href="/">&larr; Return to Redeemed Hacker Pro</a>
</main>
<footer>&copy; Redeemed Hacker Pro &middot; Stay aware. Stay secure.</footer>
</div>
</body>
</html>'''
    (POSTS / 'index.html').write_text(page, encoding='utf-8')
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
