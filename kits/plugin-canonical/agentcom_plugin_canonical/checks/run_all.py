#!/usr/bin/env python3
import subprocess,sys
from pathlib import Path
if len(sys.argv)<2:
 print("usage: run_all.py plugin_spec.json [repo-root]",file=sys.stderr); sys.exit(64)
base=Path(__file__).parent
rc_schema=subprocess.call([sys.executable,str(base/"validate_schema.py"),sys.argv[1]])
rc_lint=subprocess.call([sys.executable,str(base/"plugin_lint.py"),sys.argv[1]])
if len(sys.argv)>2:
 subprocess.call([sys.executable,str(base/"source_scan.py"),sys.argv[2]])
sys.exit(2 if (rc_schema==2 or rc_lint==2) else max(rc_schema,rc_lint))
