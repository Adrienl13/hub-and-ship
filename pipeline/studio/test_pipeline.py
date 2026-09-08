import importlib.util
import json
import math
import tempfile
import unittest
from pathlib import Path
from pipeline import neighbors, family_candidates, diagnostic_pairs, build_pilot, run, MODEL_VERSION
spec=importlib.util.spec_from_file_location('importer',Path(__file__).with_name('prepare-import.py'))
importer=importlib.util.module_from_spec(spec);spec.loader.exec_module(importer)

class PipelineTests(unittest.TestCase):
    def products(self,n=45):
        return [dict(product_id=str(i).zfill(3),is_active=True,discovery_ready=True,media_status='validated',quality_score=.8,embedding=[math.cos(i),math.sin(i)],material=str(i%3),seat_kind=str(i%2),visual_traits={'silhouette_ratio':i/50,'edge_density':.2,'openness':.3}) for i in range(n)]
    def test_neighbors_real_cosine_order_cap(self):
        p=self.products();p[-1]['is_active']=False
        edges=neighbors(p)
        self.assertEqual(len(edges),44*12);self.assertEqual(edges,neighbors(list(reversed(p))))
        for e in edges:
            self.assertNotEqual(e['product_id'],e['neighbor_product_id']);self.assertLessEqual(e['rank'],12)
            self.assertTrue(0<=e['similarity']<=1);self.assertNotEqual(e['neighbor_product_id'],'044')
        a=[e['similarity'] for e in edges if e['product_id']=='000'];self.assertEqual(a,sorted(a,reverse=True))
    def test_family_never_name_only(self):
        p=self.products(2)
        for x in p:x.update(name='Same chair',embedding=[1,0])
        edges=neighbors(p)
        self.assertEqual(family_candidates(p,edges),[])
        for x in p:x.update(dimensions={'l':50,'w':50,'h':80},weightKg=5)
        proposals=family_candidates(p,edges)
        self.assertEqual(len(proposals),1);self.assertEqual(proposals[0]['status'],'candidate')
        self.assertEqual(family_candidates(p,[edges[1]]),proposals)
    def test_diagnostics_measured_only(self):
        p=self.products(2);edges=neighbors(p)
        self.assertEqual(diagnostic_pairs(p,edges),[])
        p[1]['visual_traits']['silhouette_ratio']=.8
        result=diagnostic_pairs(p,edges)
        self.assertEqual(result[0]['source'],'pipeline');self.assertEqual(result[0]['status'],'candidate')
    def test_pilot_draft_diverse_exclusions(self):
        p=self.products();p[-1]['media_status']='pending'
        result=build_pilot(p,[])
        self.assertEqual(len(result['product_ids']),40);self.assertEqual(result['status'],'draft')
        self.assertTrue(result['dry_run']);self.assertNotIn('044',result['product_ids'])
        self.assertEqual(result,build_pilot(list(reversed(p)),[]))
    def test_dryrun_no_files_and_only_validated(self):
        p=self.products(2);p[1]['media_status']='pending'
        with tempfile.TemporaryDirectory() as d:
            output=Path(d)/'absent';result=run({'products':p},output)
            self.assertEqual(result['candidates'],['000']);self.assertFalse(output.exists())
    def test_import_is_pending_no_commercial_updates(self):
        p=dict(product_id="a';drop table products;--",source_url='source',source_hash='hash',quality_score=.9,pipeline_version='decision-v1',paths=['studio/a.webp','studio/b.webp'],visual_traits={'version':'decision-v1'})
        sql=importer.render({'products':[p]},'decision','https://example.test')
        self.assertIn("a'';drop table products;--",sql)
        self.assertIn("'pending'",sql);self.assertNotIn('main_image_url',sql);self.assertNotIn('verified',sql)
    def test_import_rejects_identifier_injection(self):
        with self.assertRaises(ValueError):importer.insert('studio_product_media',{'id) values (1); --':'x'})
    def test_import_rejects_incomplete_visual_report(self):
        with self.assertRaises(ValueError):importer.render({'model_version':MODEL_VERSION,'errors':['failure']},'visual')
if __name__=='__main__':unittest.main()
