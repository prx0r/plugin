#!/usr/bin/env python3
import json,sys
from pathlib import Path
try:
 from jsonschema import Draft202012Validator
except ImportError:
 print("jsonschema is required: pip install jsonschema",file=sys.stderr); sys.exit(64)
if len(sys.argv)!=2:
 print("usage: validate_schema.py plugin_spec.json",file=sys.stderr); sys.exit(64)
root=Path(__file__).resolve().parents[1]
schema=json.loads((root/"schemas/plugin_spec.schema.json").read_text())
data=json.loads(Path(sys.argv[1]).read_text())
errs=sorted(Draft202012Validator(schema).iter_errors(data),key=lambda e:list(e.path))
for e in errs:
 print("ERROR SCHEMA:",".".join(map(str,e.path)) or "<root>","-",e.message)
print(f"Schema validation: {len(errs)} error(s)")
sys.exit(2 if errs else 0)
