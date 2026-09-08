"""Studio offline. Plans par défaut ; --compute écrit des artefacts LOCAUX.
Aucune écriture distante. Les embeddings ne quittent pas ce pipeline/admin.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import urllib.request
from datetime import datetime, timezone

MODEL = 'facebook/dinov2-small'
REVISION = 'ed25f3a31f01632728cabb09d1542f84ab7b0056'
MODEL_VERSION = 'dinov2-small:' + REVISION + ':cls-l2-v1'


def cosine(a, b):
    if len(a) != len(b) or not a or not all(math.isfinite(x) for x in a + b):
        raise ValueError('Invalid embedding')
    norm = math.sqrt(sum(x*x for x in a) * sum(x*x for x in b))
    if not norm:
        raise ValueError('Zero embedding')
    return max(0.0, min(1.0, sum(x*y for x, y in zip(a, b)) / norm))


def neighbors(products, k=12):
    rows = sorted((p for p in products if p.get('is_active') is True and p.get('embedding')), key=lambda p: p['product_id'])
    output = []
    for p in rows:
        candidates = [(q['product_id'], cosine(p['embedding'], q['embedding'])) for q in rows if q['product_id'] != p['product_id']]
        ranked = sorted(candidates, key=lambda q: (-q[1], q[0]))[:max(0, min(12, k))]
        output.extend(dict(product_id=p['product_id'], neighbor_product_id=q, similarity=round(score, 8), rank=i+1, model_version=MODEL_VERSION) for i, (q, score) in enumerate(ranked))
    return output


def close_number(a, b, tolerance):
    return isinstance(a, (int, float)) and isinstance(b, (int, float)) and a > 0 and b > 0 and math.isfinite(a+b) and abs(a-b)/max(a, b) <= tolerance


def canonical_edges(edges):
    pairs = {}
    for edge in edges:
        a, b = sorted((edge['product_id'], edge['neighbor_product_id']))
        if a == b: continue
        key = (a,b)
        if key not in pairs or edge['similarity'] > pairs[key]['similarity']:
            pairs[key] = dict(edge,product_id=a,neighbor_product_id=b)
    return [pairs[key] for key in sorted(pairs)]


def family_candidates(products, edges):
    by_id = {p['product_id']: p for p in products}
    proposals = []
    for edge in canonical_edges(edges):
        a, b = edge['product_id'], edge['neighbor_product_id']
        if a >= b or edge['similarity'] < .94:
            continue
        pa, pb = by_id[a], by_id[b]
        dims_a, dims_b = pa.get('dimensions', {}), pb.get('dimensions', {})
        dimensions = all(close_number(dims_a.get(d), dims_b.get(d), .02) for d in ('l', 'w', 'h'))
        weight = close_number(pa.get('weightKg'), pb.get('weightKg'), .05)
        prefix = bool(pa.get('sku')) and pa['sku'].split('-')[0] == pb.get('sku', '').split('-')[0]
        price = close_number(pa.get('basePriceHt'), pb.get('basePriceHt'), .10)
        if dimensions and (weight or (prefix and price)):
            proposals.append(dict(product_a_id=a, product_b_id=b, model_version=MODEL_VERSION, similarity=edge['similarity'], status='candidate', evidence=dict(dimensions_tolerance=.02, weight=weight, prefix=prefix, public_price_corrobates=price)))
    return proposals


def diagnostic_pairs(products, edges):
    by_id = {p['product_id']: p for p in products}
    result = []
    for edge in canonical_edges(edges):
        a, b = edge['product_id'], edge['neighbor_product_id']
        if a >= b:
            continue
        for axis in ('silhouette_ratio', 'edge_density', 'global_contrast', 'openness', 'pattern_score'):
            va, vb = by_id[a].get('visual_traits', {}).get(axis), by_id[b].get('visual_traits', {}).get(axis)
            if not isinstance(va, (int, float)) or not isinstance(vb, (int, float)):
                continue
            distance = abs(va-vb)
            if distance >= .25:
                result.append(dict(product_a_id=a, product_b_id=b, axis=axis, source='pipeline', pipeline_version=MODEL_VERSION, status='candidate', notes=json.dumps(dict(measured_distance=distance))))
    return result


def build_pilot(products, edges, count=40):
    """Sélection gloutonne de couverture et nouveauté ; pas de style ni prix."""
    similarity = {(e['product_id'], e['neighbor_product_id']): e['similarity'] for e in edges}
    candidates, exclusions = [], []
    for p in sorted(products, key=lambda p: p['product_id']):
        reasons = []
        if not p.get('is_active') or not p.get('discovery_ready'): reasons.append('not_discovery_ready')
        if p.get('media_status') != 'validated': reasons.append('decision_not_validated')
        if p.get('quality_score', 0) < .45: reasons.append('quality_below_0.45')
        if reasons: exclusions.append(dict(product_id=p['product_id'], reasons=reasons))
        else: candidates.append(p)
    eligible_total = len(candidates)
    selected, materials, kinds, bins = [], set(), set(), set()
    while candidates and len(selected) < min(50, max(1, count)):
        ranked = []
        for p in candidates:
            maximum = max((similarity.get((p['product_id'], q['product_id']), similarity.get((q['product_id'], p['product_id']), 0)) for q in selected), default=0)
            if maximum >= .97:
                exclusions.append(dict(product_id=p['product_id'], reasons=['near_duplicate_measured']))
                continue
            traits = p.get('visual_traits', {})
            p_bins = {(axis, math.floor(traits[axis]*4)) for axis in ('silhouette_ratio','edge_density','global_contrast','openness','pattern_score') if isinstance(traits.get(axis), (int, float))}
            novel = int(p.get('material') not in materials) + int(p.get('seat_kind') not in kinds) + .2 * len(p_bins-bins)
            ranked.append((novel + p['quality_score'] - maximum, p['product_id'], p, p_bins))
        if not ranked: break
        _, _, chosen, new_bins = sorted(ranked, key=lambda x: (-x[0], x[1]))[0]
        selected.append(chosen); materials.add(chosen.get('material')); kinds.add(chosen.get('seat_kind')); bins.update(new_bins)
        candidates = [p for p in candidates if p['product_id'] != chosen['product_id'] and not any(e['product_id']==p['product_id'] for e in exclusions)]
    ids = [p['product_id'] for p in selected]
    excluded_ids = {e['product_id'] for e in exclusions}
    exclusions.extend(dict(product_id=p['product_id'], reasons=['target_reached']) for p in candidates if p['product_id'] not in ids and p['product_id'] not in excluded_ids)
    exclusions.sort(key=lambda e:e['product_id'])
    return dict(dry_run=True, status='draft', product_ids=ids, exclusions=exclusions,
                candidates=[dict(product_id=p['product_id'], reasons=['validated_decision','quality','objective_diversity']) for p in selected],
                coverage=dict(selected=len(ids), eligible_total=eligible_total, target=min(50,max(1,count))),
                diversity=dict(materials=len(materials), seat_kinds=len(kinds), trait_bins=len(bins)),
                criteria=dict(version='pilot-v1', model_version=MODEL_VERSION, quality_min=.45, duplicate_similarity=.97))


class Embedder:
    def __init__(self):
        import torch
        from transformers import AutoImageProcessor, AutoModel
        self.torch = torch
        torch.manual_seed(0)
        torch.set_num_threads(1)
        torch.use_deterministic_algorithms(True)
        self.processor = AutoImageProcessor.from_pretrained(MODEL, revision=REVISION, use_fast=False)
        self.model = AutoModel.from_pretrained(MODEL, revision=REVISION, use_safetensors=True).cpu().eval()

    def __call__(self, image):
        # Carré complet : pas de crop susceptible de supprimer un pied de chaise.
        inputs = self.processor(images=image, return_tensors='pt', do_center_crop=False)
        with self.torch.inference_mode():
            vector = self.model(**inputs).last_hidden_state[:, 0, :]
            vector = self.torch.nn.functional.normalize(vector, dim=-1)
        return vector[0].tolist()


def image_bytes(product):
    if product.get('local_path'): return Path(product['local_path']).read_bytes()
    url = product['media_url']
    if not url.startswith('https://'): raise ValueError('HTTPS media URL required')
    with urllib.request.urlopen(url, timeout=30) as response:
        data = response.read(20 * 1024 * 1024 + 1)
    if len(data) > 20 * 1024 * 1024: raise ValueError('Image too large')
    return data


def run(manifest, output, compute=False):
    products = manifest['products']
    if not compute:
        return dict(dry_run=True, model_version=MODEL_VERSION, candidates=[p['product_id'] for p in products if p.get('is_active') and p.get('media_status') == 'validated'], writes='none')
    from PIL import Image
    from io import BytesIO
    output.mkdir(parents=True, exist_ok=True)
    cache_dir = output / 'cache'; cache_dir.mkdir(exist_ok=True)
    embedded, errors = [], []
    embedder = None
    for product in sorted(products, key=lambda p: p['product_id']):
        if not product.get('is_active') or product.get('media_status') != 'validated' or not product.get('media_id'): continue
        try:
            data = image_bytes(product)
            key = hashlib.sha256(data + MODEL_VERSION.encode()).hexdigest()
            cache = cache_dir / (key + '.json')
            if cache.exists(): vector = json.loads(cache.read_text())
            else:
                if embedder is None: embedder = Embedder()
                image = Image.open(BytesIO(data)).convert('RGB')
                vector = embedder(image)
                cache.write_text(json.dumps(vector))
            if len(vector) != 384 or not all(math.isfinite(v) for v in vector): raise ValueError('Invalid cached embedding')
            embedded.append(dict(product, embedding=vector))
        except Exception as error:
            errors.append(dict(product_id=product['product_id'], error=type(error).__name__ + ': ' + str(error)[:200]))
    edges = neighbors(embedded)
    report = dict(model_version=MODEL_VERSION, computed_at=datetime.now(timezone.utc).isoformat(),
                  features=[dict(product_id=p['product_id'], model_version=MODEL_VERSION, source_media_id=p['media_id'], embedding=p['embedding'], features=dict(version=MODEL_VERSION, provenance='pipeline')) for p in embedded],
                  neighbors=edges, families=family_candidates(embedded, edges), diagnostic_pairs=diagnostic_pairs(embedded, edges),
                  pilot=build_pilot(embedded, edges), errors=errors,
                  coverage=dict(total=len(products), embeddings=len(embedded), neighbors_12=sum(1 for p in embedded if sum(e['product_id']==p['product_id'] for e in edges)==12)))
    (output / 'visual-report.json').write_text(json.dumps(report, indent=2))
    return {k: report[k] for k in ('model_version','coverage','errors')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--output', default='.cache/studio-visual')
    parser.add_argument('--compute', action='store_true', help='Compute and write LOCAL artifacts only')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    print(json.dumps(run(json.loads(Path(args.manifest).read_text()), Path(args.output), args.compute and not args.dry_run), indent=2))


if __name__ == '__main__': main()
