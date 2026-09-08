"""Render reviewable LOCAL SQL only. No credentials, connection or execution.
Decision media must first be uploaded under studio/ in catalogue-images by an
admin. A human reviews this transaction before applying it to a chosen database.
"""
import argparse
import json
import math
import uuid
import re
from pathlib import Path

def literal(value):
    if value is None: return 'null'
    if isinstance(value, bool): return 'true' if value else 'false'
    if isinstance(value, (dict, list)): value = json.dumps(value, allow_nan=False)
    return "'" + str(value).replace("'", "''") + "'"

def insert(table, row, conflict='do nothing'):
    if not re.fullmatch(r'[a-z_][a-z0-9_]*', table) or not all(re.fullmatch(r'[a-z_][a-z0-9_]*', key) for key in row):
        raise ValueError('Unsafe SQL identifier')
    return 'insert into public.'+table+' ('+','.join(row)+') values ('+','.join(literal(v) for v in row.values())+') on conflict '+conflict+';'

def render(report, kind, storage_base=None, include_pilot=False):
    lines=['-- LOCAL REVIEW ARTIFACT. No SQL executed by this tool.', 'begin;']
    if kind == 'decision':
        if not storage_base or not storage_base.startswith('https://'): raise ValueError('HTTPS public catalogue-images base URL required')
        for p in report['products']:
            for role, path in zip(('decision','thumb'),p['paths']):
                if not path.startswith('studio/') or '..' in path.split('/'): raise ValueError('Unsafe storage path')
                row={k:p[k] for k in ('product_id','source_url','source_hash','quality_score','pipeline_version')}
                row.update(role=role,url=storage_base.rstrip('/')+'/'+path,storage_path=path,status='pending')
                lines.append(insert('studio_product_media',row)) # never reset prior review
            lines.append('update public.studio_product_profiles set visual_traits='+literal(p['visual_traits'])+'::jsonb where product_id='+literal(p['product_id'])+';')
    elif kind == 'visual':
        version=report['model_version']
        # One transaction replaces this model's graph before upserting features.
        # Never imports an incomplete batch unless human explicitly reviews it.
        if report.get('errors'): raise ValueError('Resolve per-product errors before preparing an import')
        lines.append('delete from public.studio_product_neighbors where model_version='+literal(version)+';')
        for feature in report['features']:
            row=dict(feature); embedding=row.pop('embedding')
            if len(embedding)!=384 or not all(math.isfinite(float(v)) for v in embedding): raise ValueError('Embedding must have 384 dimensions')
            row['embedding']='{'+','.join(str(float(v)) for v in embedding)+'}'
            lines.append(insert('studio_product_visual_features',row,'(product_id,model_version) do update set source_media_id=excluded.source_media_id, embedding=excluded.embedding, features=excluded.features, created_at=now()'))
        for edge in report['neighbors']: lines.append(insert('studio_product_neighbors',edge))
        for family in report['families']: lines.append(insert('studio_model_family_candidates',{**family,'status':'candidate'}))
        for pair in report['diagnostic_pairs']:
            import hashlib
            key=hashlib.sha256(json.dumps(pair,sort_keys=True).encode()).hexdigest()[:32]
            lines.append(insert('studio_diagnostic_pairs',{'id':str(uuid.UUID(key)),**pair,'status':'candidate'}))
        if include_pilot:
            lines.append("insert into public.studio_curation_sets(id,label,product_ids,criteria,status) values ('pilot','Pilote visuel à valider',ARRAY["+','.join(literal(v) for v in report['pilot']['product_ids'])+"]::text[],"+literal(report['pilot']['criteria'])+"::jsonb,'draft') on conflict do nothing;")
    else: raise ValueError('Unknown report kind')
    lines.append('commit;')
    return '\n'.join(lines)+'\n'

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report',required=True); parser.add_argument('--kind',choices=['decision','visual'],required=True)
    parser.add_argument('--storage-base'); parser.add_argument('--include-pilot-draft',action='store_true')
    parser.add_argument('--output',required=True,help='LOCAL .sql file, never executed')
    args=parser.parse_args()
    Path(args.output).write_text(render(json.loads(Path(args.report).read_text()),args.kind,args.storage_base,args.include_pilot_draft))
