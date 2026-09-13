#!/usr/bin/env python3
import json, sys, re
from pathlib import Path
from urllib.parse import urlparse

ERRORS=[]; WARNS=[]; INFO=[]

def err(code,msg): ERRORS.append((code,msg))
def warn(code,msg): WARNS.append((code,msg))
def info(code,msg): INFO.append((code,msg))

def https_url(v):
    try:
        u=urlparse(v); return u.scheme=='https' and bool(u.netloc)
    except Exception: return False

SENSITIVE_RE=re.compile(r'(password|passwd|api[_-]?key|secret|token|mfa|otp|ssn|social[_-]?security|passport|government[_-]?id|credit[_-]?card|card[_-]?number|cvv|cvc|phi|medical[_-]?record)',re.I)
PRECISE_LOC_RE=re.compile(r'(^|_)(lat|latitude|lng|lon|longitude|gps|coordinates?|street[_-]?address|full[_-]?address)($|_)',re.I)
CHAT_RE=re.compile(r'(full[_-]?(chat|conversation)|raw[_-]?(chat|transcript)|conversation[_-]?history|chat[_-]?history)',re.I)
INTERNAL_OUT_RE=re.compile(r'(trace[_-]?id|request[_-]?id|debug|stack[_-]?trace|internal[_-]?id|session[_-]?id)',re.I)
PROMO_RE=re.compile(r'\b(best|official|pick[_ -]?me|always use|prefer (this|our)|better than|#1|number one)\b',re.I)
ACTION_VERBS={'get','find','search','check','list','create','update','delete','send','request','book','order','quote','compare','prepare','preview','register','cancel','track','resolve','fetch','submit','schedule','estimate','lookup'}


def validate(path):
    data=json.loads(Path(path).read_text())
    app=data.get('app',{}); pub=data.get('publisher',{}); mcp=data.get('mcp',{}); tools=data.get('tools',[]); tests=data.get('tests',{}); priv=data.get('privacy',{}); ui=data.get('ui',{}); tpis=data.get('third_party_integrations',[])

    # App
    if not app.get('name'): err('APP001','Missing app.name')
    if len(app.get('name',''))>30: err('APP001B',f"Display name is {len(app.get('name',''))} chars; current limit is 30.")
    sub=app.get('subtitle','')
    if len(sub)>30: err('APP002',f'Subtitle is {len(sub)} chars; current limit is 30.')
    if len(app.get('description',''))>4000: err('APP002B',f"Long description is {len(app.get('description',''))} chars; current limit is 4000.")
    caps=app.get('capabilities',[]) or []
    if len(caps)>20: err('APP002C',f'{len(caps)} capabilities; current limit is 20.')
    for c in caps:
        if len(c)>120: err('APP002D',f'Capability exceeds 120 chars: {c[:80]}...')
    starters=app.get('starter_prompts',[]) or []
    if len(starters)>3: err('APP002E',f'{len(starters)} starter prompts; current limit is 3.')
    for sp in starters:
        if len(sp)>128: err('APP002F',f'Starter prompt exceeds 128 chars: {sp[:80]}...')
        if '@' in sp: err('APP002G',f'Starter prompt contains forbidden @mention: {sp}')
    if not https_url(app.get('demo_recording_url','')): err('APP002H','Remote MCP public submission requires a live HTTPS demo recording URL.')
    if not app.get('release_notes','').strip(): err('APP002I','Missing release notes for final submission.')
    if PROMO_RE.search(app.get('name','')) or PROMO_RE.search(app.get('description','')): err('APP003','App metadata contains promotional/comparative selection language.')
    if app.get('serves_ads'): err('APP004','Plugins may not serve advertisements.')
    if app.get('commerce')=='digital_goods_or_services': err('APP005','Current plugin commerce rules do not allow selling digital goods/services through plugins.')

    # Publisher
    if not pub.get('verified_identity'): err('PUB001','Publisher identity is not marked verified.')
    if not pub.get('identity_name_matches_public_urls'): err('PUB002','Publisher identity does not match public listing URLs.')
    for f in ['website_url','support_url','privacy_url','terms_url']:
        if not https_url(pub.get(f,'')): err('PUB003',f'{f} must be public HTTPS.')

    # MCP
    if not https_url(mcp.get('url','')): err('MCP001','MCP URL must be HTTPS.')
    if not mcp.get('public_production'): err('MCP002','MCP is not marked public production endpoint.')
    if mcp.get('url_type')=='Template': warn('MCP003','Template MCP URLs are limited/trusted scenarios; confirm OpenAI approval.')
    if mcp.get('auth_required') and not mcp.get('review_account_no_mfa'): err('MCP004','Authenticated review flow must not require MFA/SMS/email confirmation/private setup.')
    if not mcp.get('domain_verified'): err('MCP005','Domain verification must be complete before final remote-MCP submission.')
    if not mcp.get('scan_current'): err('MCP006','Current successful MCP tool scan is required before final submission.')

    # privacy
    for f in ['policy_covers_categories','policy_covers_purposes','policy_covers_recipients','policy_covers_retention','policy_covers_controls']:
        if not priv.get(f): err('PRIV001',f'Privacy policy missing required coverage flag: {f}')

    # third-party
    for p in tpis:
        name=p.get('name','<unnamed>')
        if not p.get('authorized'): err('TP001',f'{name}: integration not marked authorized.')
        if not p.get('official_api_or_partner_access'): err('TP002',f'{name}: no official API/partner access marked.')
        if not p.get('terms_reviewed'): err('TP003',f'{name}: third-party terms not marked reviewed.')
        if p.get('primary_pass_through'): err('TP004',f'{name}: primary pass-through/unofficial connector risk.')

    # UI/CSP
    if app.get('has_ui'):
        for bucket in ['connect_domains','resource_domains','frame_domains','redirect_domains']:
            for d in ui.get(bucket,[]) or []:
                if '*' in d: err('UI001',f'Wildcard CSP domain in {bucket}: {d}')
        if ui.get('frame_domains'): warn('UI002','frame_domains present; iframe usage triggers stricter review and needs essential justification.')
        if not ui.get('widget_uri_versioned'): warn('UI003','Widget URI not marked versioned; caching changes can cause stale UI behavior.')
    elif any(ui.get(k) for k in ['connect_domains','resource_domains','frame_domains','redirect_domains']): warn('UI004','CSP domains provided while app.has_ui=false.')

    # tools
    names=[]
    if len(tools)>6: warn('TOOL000',f'{len(tools)} model-visible tools. AgentCom heuristic is 3-6 unless routing evals justify more.')
    desc_tokens=[]
    for i,t in enumerate(tools):
        name=t.get('name',''); desc=t.get('description',''); names.append(name)
        if not re.match(r'^[a-z][a-z0-9_]*$',name): warn('TOOL001',f'{name}: prefer stable lowercase action-oriented snake_case name.')
        first=name.split('_',1)[0]
        if first not in ACTION_VERBS: warn('TOOL002',f'{name}: first verb `{first}` is not in common action-oriented set; inspect manually.')
        if len(desc)<40: warn('TOOL003',f'{name}: description may be too thin to explain what/when/limits.')
        if PROMO_RE.search(name) or PROMO_RE.search(desc): err('TOOL004',f'{name}: contains promotional/fair-play manipulation language.')
        ann=t.get('annotations',{})
        just=t.get('annotation_justifications',{})
        for a in ['readOnlyHint','openWorldHint','destructiveHint']:
            if not isinstance(ann.get(a),bool): err('ANN001',f'{name}: {a} must be explicit boolean.')
            if len(str(just.get(a,'' )).strip())<12: err('ANN001B',f'{name}: {a} needs a behavior-grounded written justification.')
        beh=t.get('behavior',{})
        if beh.get('mutates_state') and ann.get('readOnlyHint') is True: err('ANN002',f'{name}: mutates_state=true but readOnlyHint=true.')
        if not beh.get('mutates_state') and ann.get('readOnlyHint') is False: warn('ANN003',f'{name}: readOnlyHint=false but declared behavior does not mutate state; inspect source.')
        if beh.get('accesses_public_or_open_ended_external_entities') and ann.get('openWorldHint') is not True: err('ANN004',f'{name}: accesses open-world entities but openWorldHint is not true.')
        if beh.get('irreversible_or_hard_to_reverse') and ann.get('destructiveHint') is not True: err('ANN005',f'{name}: hard-to-reverse behavior but destructiveHint is not true.')
        if t.get('returns_structured_content') and not t.get('has_output_schema'): err('SCHEMA001',f'{name}: structuredContent requires outputSchema.')
        for inp in t.get('inputs',[]):
            n=inp.get('name','')
            if SENSITIVE_RE.search(n): err('DATA001',f'{name}.{n}: restricted/sensitive input field.')
            if PRECISE_LOC_RE.search(n): err('DATA002',f'{name}.{n}: precise/raw location input should not be solicited in normal tool schema.')
            if CHAT_RE.search(n): err('DATA003',f'{name}.{n}: full/raw conversation collection is prohibited.')
        for out in t.get('outputs',[]):
            if INTERNAL_OUT_RE.search(str(out)): err('DATA004',f'{name}.{out}: internal/debug identifier should not be returned unless strictly required.')
        toks=set(re.findall(r'[a-z0-9]+',desc.lower()))-{ 'the','a','an','to','for','and','or','of','when','use','user','users','this','it','is','with' }
        desc_tokens.append((name,toks))
    if len(set(names))!=len(names): err('TOOL005','Tool names must be unique.')
    for i in range(len(desc_tokens)):
        for j in range(i+1,len(desc_tokens)):
            a,ta=desc_tokens[i]; b,tb=desc_tokens[j]
            if not ta or not tb: continue
            sim=len(ta&tb)/max(1,len(ta|tb))
            if sim>=0.65: warn('TOOL006',f'Potential selection overlap: {a} vs {b} description Jaccard={sim:.2f}. Add boundary language/evals.')

    # tests
    p=tests.get('positive',[]); n=tests.get('negative',[])
    if len(p)!=5: err('TEST001',f'Current remote-MCP final submission requires exactly 5 positive tests; found {len(p)}.')
    if len(n)!=3: err('TEST002',f'Current remote-MCP final submission requires exactly 3 negative tests; found {len(n)}.')

    print(f'AgentCom Plugin Preflight: {path}')
    for code,msg in ERRORS: print(f'ERROR {code}: {msg}')
    for code,msg in WARNS: print(f'WARN  {code}: {msg}')
    for code,msg in INFO: print(f'INFO  {code}: {msg}')
    print(f'\nSummary: {len(ERRORS)} errors, {len(WARNS)} warnings.')
    if ERRORS:
        print('NO_GO')
        return 2
    if WARNS:
        print('GO_WITH_WAIVERS')
        return 1
    print('GO')
    return 0

if __name__=='__main__':
    if len(sys.argv)!=2:
        print('usage: plugin_lint.py plugin_spec.json',file=sys.stderr); sys.exit(64)
    sys.exit(validate(sys.argv[1]))
