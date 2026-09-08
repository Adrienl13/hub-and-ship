"""Curation auditable : ne crée ni n'active un jeu distant."""
import argparse
import json
from pathlib import Path
from pipeline import build_pilot
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--manifest', required=True)
p.add_argument('--neighbors', required=True)
p.add_argument('--count', type=int, default=40)
a = p.parse_args()
print(json.dumps(build_pilot(json.loads(Path(a.manifest).read_text())['products'], json.loads(Path(a.neighbors).read_text())['neighbors'], a.count), indent=2))
