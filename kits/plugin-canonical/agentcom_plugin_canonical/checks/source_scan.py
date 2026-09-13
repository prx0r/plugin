#!/usr/bin/env python3
"""Conservative regex scanner. Advisory only; source-aware agent review is still required."""
import sys,re
from pathlib import Path
SKIP={'.git','node_modules','dist','build','.venv','venv','__pycache__'}
PATTERNS={
 'secret_literal': re.compile(r'(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*[\'\"][^\'\"]{8,}[\'\"]'),
 'http_write': re.compile(r'(?i)\b(POST|PUT|PATCH|DELETE)\b|\.(post|put|patch|delete)\s*\('),
 'mutation_words': re.compile(r'(?i)\b(create|update|delete|send|publish|book|order|cancel|enqueue|write|upload)\w*\s*\('),
 'wildcard_csp': re.compile(r'(?i)(connectDomains|resourceDomains|frameDomains|connect_domains|resource_domains|frame_domains)[^\n]{0,120}[\'\"]\*'),
 'sensitive_field': re.compile(r'(?i)\b(password|api[_-]?key|mfa|otp|ssn|passport|credit[_-]?card|cvv|latitude|longitude|gps|conversation[_-]?history|raw[_-]?transcript)\b')
}
EXT={'.ts','.tsx','.js','.mjs','.cjs','.py','.json','.yaml','.yml','.md'}

def main(root):
  findings=[]
  for p in Path(root).rglob('*'):
    if not p.is_file() or p.suffix.lower() not in EXT or any(part in SKIP for part in p.parts): continue
    try: txt=p.read_text(errors='ignore')
    except Exception: continue
    for name,pat in PATTERNS.items():
      for m in pat.finditer(txt):
        line=txt.count('\n',0,m.start())+1
        snippet=' '.join(txt[m.start():m.start()+140].split())[:140]
        findings.append((name,str(p),line,snippet))
  for f in findings: print(f'{f[0]}\t{f[1]}:{f[2]}\t{f[3]}')
  print(f'\n{len(findings)} advisory source findings. Inspect each; regex matches are not proof of violation.')
  return 0
if __name__=='__main__':
  if len(sys.argv)!=2: print('usage: source_scan.py <repo-root>',file=sys.stderr); sys.exit(64)
  sys.exit(main(sys.argv[1]))
