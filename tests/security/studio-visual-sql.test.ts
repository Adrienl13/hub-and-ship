// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { STUDIO_EVENT_TYPES } from '../../src/lib/studio/events'
import {
  VISUAL_MEDIA_COLUMNS,
  VISUAL_NEIGHBOR_COLUMNS,
  ALGORITHM_PUBLIC_COLUMNS,
} from '../../src/lib/studio/visual'
const sql = readFileSync(
  'supabase/migrations/20260908090000_studio_visual_intelligence.sql',
  'utf8',
)
const tables = [
  'studio_product_media',
  'studio_product_visual_features',
  'studio_product_neighbors',
  'studio_model_family_candidates',
  'studio_algorithm_versions',
  'studio_visual_jobs',
]
let db: PGlite
beforeAll(async () => {
  db = new PGlite()
  // Minimal contracts of already deployed 39/40, no network/credentials.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('00000000-0000-0000-0000-000000000001');
    create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
    create function public.is_admin() returns boolean language sql as $$ select coalesce(current_setting('test.admin',true),'false') = 'true' $$;
    create table products(id text primary key,is_active boolean);
    insert into products values ('a',true),('b',true),('inactive',false);
    create table product_variants(id text primary key);
    create function studio_public_data_quality(jsonb) returns jsonb language sql as $$ select '{}'::jsonb $$;
    create schema extensions;
    create function extensions.gen_random_uuid() returns uuid language sql as $$ select gen_random_uuid() $$;
    grant usage on schema extensions to anon,authenticated;
    create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
    grant usage on schema public,auth to anon,authenticated;
  `)
  const foundation = readFileSync(
    'supabase/migrations/20260907120000_studio_foundation.sql',
    'utf8',
  )
  for (const table of [
    'studio_model_families',
    'studio_product_profiles',
    'studio_fulfillment_options',
  ]) {
    const start = foundation.indexOf(
      `create table if not exists public.${table} (`,
    )
    if (start < 0) throw new Error(`Missing foundation DDL ${table}`)
    const ddl = foundation.slice(start, foundation.indexOf('\n);', start) + 4)
    await db.exec(ddl)
  }
  await db.exec(
    foundation.slice(
      foundation.indexOf('alter table public.studio_model_families enable'),
      foundation.indexOf('-- 5. Surfaces publiques'),
    ),
  )
  await db.exec(
    "insert into studio_product_profiles(product_id) values ('a'),('b')",
  )
  await db.exec(
    readFileSync(
      'supabase/migrations/20260907130000_studio_sessions_events.sql',
      'utf8',
    ),
  )
  await db.exec(sql)
  await db.exec(`insert into studio_product_media(id,product_id,role,url,storage_path,source_url,source_hash,quality_score,pipeline_version,status,validated_by,validated_at) values
   ('10000000-0000-0000-0000-000000000001','a','decision','https://example.test/a.webp','studio/a.webp','source','a',.8,'decision-v1','validated','00000000-0000-0000-0000-000000000001',now()),
   ('10000000-0000-0000-0000-000000000002','b','decision','https://example.test/b.webp','studio/b.webp','source','b',.8,'decision-v1','validated','00000000-0000-0000-0000-000000000001',now()),
   ('10000000-0000-0000-0000-000000000003','inactive','decision','https://example.test/c.webp','studio/c.webp','source','c',.8,'decision-v1','pending',null,null);
   insert into studio_product_visual_features values ('a','test','10000000-0000-0000-0000-000000000001',array_fill(.1::double precision,array[384]),'{}',now()),('b','test','10000000-0000-0000-0000-000000000002',array_fill(.1::double precision,array[384]),'{}',now());
   insert into studio_product_neighbors(product_id,neighbor_product_id,model_version,rank,similarity) values ('a','b','test',1,.95);
  `)
}, 30000)
afterAll(async () => {
  await db?.close()
})

describe('Lot 3 — PostgreSQL local, droits réels', () => {
  for (const table of tables)
    it(`${table}: anon refusé, buyer vide, admin autorisé`, async () => {
      await db.exec('set role anon')
      await expect(db.query(`select * from ${table}`)).rejects.toThrow(
        /permission denied/,
      )
      await db.exec(
        "reset role; set test.admin = 'false'; set role authenticated",
      )
      expect((await db.query(`select * from ${table}`)).rows).toEqual([])
      const payloads: Record<string, string> = {
        studio_product_media:
          "(product_id,role,url,storage_path,source_url,source_hash,quality_score,pipeline_version) values ('a','thumb','https://example.test/probe','studio/probe','source','probe',.5,'probe')",
        studio_product_visual_features:
          "(product_id,model_version,source_media_id,embedding,features) values ('a','probe','10000000-0000-0000-0000-000000000001',array_fill(.1::double precision,array[384]),'{}')",
        studio_product_neighbors:
          "(product_id,neighbor_product_id,model_version,rank,similarity) values ('b','a','test',1,.8)",
        studio_model_family_candidates:
          "(product_a_id,product_b_id,model_version,similarity,evidence) values ('a','b','probe',.9,'{}')",
        studio_algorithm_versions:
          "(version,engine,status) values ('v9.0','v0','preview')",
        studio_visual_jobs: "(product_id) values ('a')",
      }
      await expect(
        db.exec(`insert into ${table} ${payloads[table]}`),
      ).rejects.toMatchObject({ code: '42501' })
      await db.exec('reset role; set role anon')
      await expect(
        db.exec(`insert into ${table} ${payloads[table]}`),
      ).rejects.toMatchObject({ code: '42501' })

      await db.exec(
        "reset role; set test.admin = 'true'; set role authenticated",
      )
      await expect(db.query(`select * from ${table}`)).resolves.toBeDefined()
      await db.exec('begin')
      await db.exec(`insert into ${table} ${payloads[table]}`)
      await db.exec('rollback')
      await db.exec("reset role; set test.admin = 'false'")
    })
  it('vues minimales explicitement whitelisted et lisibles anon/buyer', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      for (const [view, columns] of [
        ['studio_product_media_public', VISUAL_MEDIA_COLUMNS],
        ['studio_product_neighbors_public', VISUAL_NEIGHBOR_COLUMNS],
        ['studio_algorithm_versions_public', ALGORITHM_PUBLIC_COLUMNS],
      ] as const) {
        const result = await db.query(`select * from ${view}`)
        expect(result.fields.map((f) => f.name)).toEqual([...columns])
        expect(result.rows.length).toBeGreaterThan(0)
      }
      await db.exec('reset role')
    }
  })
  it('pending/inactifs exclus ; rejet retire immédiatement image ET voisins', async () => {
    expect(
      (await db.query('select * from studio_product_media_public')).rows,
    ).toHaveLength(2)
    await db.exec(
      "update studio_product_media set status='rejected' where product_id='b'",
    )
    expect(
      (await db.query('select * from studio_product_media_public')).rows,
    ).toHaveLength(1)
    expect(
      (await db.query('select * from studio_product_neighbors_public')).rows,
    ).toHaveLength(0)
    await db.exec(
      "update studio_product_media set status='validated' where product_id='b'; update products set is_active=false where id='b'",
    )
    expect(
      (await db.query('select * from studio_product_neighbors_public')).rows,
    ).toHaveLength(0)
    await db.exec("update products set is_active=true where id='b'")
  })
  it('famille proposée reste candidate ; RPC buyer refusé et admin atomique', async () => {
    const id = '20000000-0000-0000-0000-000000000001'
    await db.exec(
      `insert into studio_model_family_candidates(id,product_a_id,product_b_id,model_version,similarity,evidence) values ('${id}','a','b','test',.95,'{}')`,
    )
    expect(
      (await db.query('select * from studio_model_families')).rows,
    ).toEqual([])
    await db.exec('set role authenticated')
    await expect(
      db.query(`select studio_review_family('${id}',true,'Famille')`),
    ).rejects.toThrow(/Forbidden/)
    await db.exec("reset role; set test.admin='true'; set role authenticated")
    await db.query(`select studio_review_family('${id}',true,'Famille')`)
    await db.exec("reset role; set test.admin='false'")
    expect(
      (await db.query('select status from studio_model_families')).rows,
    ).toEqual([{ status: 'verified' }])
    expect(
      (
        await db.query<{ model_family_id: string }>(
          'select model_family_id from studio_product_profiles',
        )
      ).rows.every((r) => r.model_family_id),
    ).toBe(true)
  })
  it('conserve toutes les valeurs événements et source historique, refuse valeurs inventées', async () => {
    await db.exec(
      "insert into studio_sessions(id,algorithm_version) values ('event-session','v1.0')",
    )
    for (const type of STUDIO_EVENT_TYPES)
      await db.query(
        "insert into studio_events(session_id,event_type,algorithm_version) values ('event-session',$1,'v1.0')",
        [type],
      )
    await expect(
      db.exec(
        "insert into studio_events(session_id,event_type,algorithm_version) values ('event-session','unknown','v1.0')",
      ),
    ).rejects.toThrow(/check constraint/)
    await expect(
      db.exec(
        "insert into studio_diagnostic_pairs(product_a_id,product_b_id,axis,source) values ('a','b','openness','pipeline:v1')",
      ),
    ).rejects.toThrow(/check constraint/)
  })
  it('version de session immuable, V1 désactivable sans effacer les données', async () => {
    await db.exec(
      "insert into studio_sessions(id,algorithm_version) values ('session-test','v1.0')",
    )
    await expect(
      db.exec(
        "update studio_sessions set algorithm_version='v0.1' where id='session-test'",
      ),
    ).rejects.toThrow(/immutable/)
    await db.exec(
      "update studio_algorithm_versions set status='disabled' where version='v1.0'",
    )
    expect(
      (
        await db.query(
          "select * from studio_algorithm_versions_public where version='v1.0'",
        )
      ).rows,
    ).toHaveLength(0)
    expect(
      (await db.query('select * from studio_product_visual_features')).rows,
    ).toHaveLength(2)
  })
  it('JSON de traits ne publie aucun texte ni métadonnée interne', async () => {
    const result = await db.query(
      'select studio_public_visual_traits($1::jsonb) as traits',
      [
        JSON.stringify({
          silhouette_ratio: 0.5,
          edge_density: 'secret',
          validated_by: 'secret',
          provenance: 'internal',
          notes: 'secret',
          embedding: [1, 2],
        }),
      ],
    )
    expect(result.rows).toEqual([{ traits: { silhouette_ratio: 0.5 } }])
  })
})

it('import SQL local : artefact réellement exécutable, rejouable, sans activation du pilote', async () => {
  const report = {
    model_version: 'test',
    features: [
      {
        product_id: 'a',
        model_version: 'test',
        source_media_id: '10000000-0000-0000-0000-000000000001',
        embedding: Array(384).fill(0.1),
        features: {},
      },
    ],
    neighbors: [],
    families: [],
    diagnostic_pairs: [
      {
        product_a_id: 'a',
        product_b_id: 'b',
        axis: 'openness',
        source: 'pipeline',
        pipeline_version: 'test',
        status: 'candidate',
        notes: 'distance=.4',
      },
    ],
    errors: [],
    pilot: { product_ids: ['a', 'b'], criteria: { version: 'pilot-v1' } },
  }
  const python =
    "import importlib.util,json,sys; s=importlib.util.spec_from_file_location('imp','pipeline/studio/prepare-import.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(m.render(json.load(sys.stdin),'visual',include_pilot=True))"
  const artifact = execFileSync('python3', ['-c', python], {
    input: JSON.stringify(report),
    encoding: 'utf8',
  })
  await db.exec(artifact)
  await db.exec(artifact)
  expect(
    (await db.query('select status,product_ids from studio_curation_sets'))
      .rows,
  ).toEqual([{ status: 'draft', product_ids: ['a', 'b'] }])
  expect(
    (await db.query('select status,source from studio_diagnostic_pairs')).rows,
  ).toEqual([{ status: 'candidate', source: 'pipeline' }])
})

it('nouvelle image : traits pending masqués et anciens voisins retirés à validation', async () => {
  await db.exec(`insert into studio_product_media(id,product_id,role,url,storage_path,source_url,source_hash,quality_score,pipeline_version)
    values ('10000000-0000-0000-0000-000000000004','a','decision','https://example.test/new.webp','studio/new.webp','source','new',.9,'decision-v1');
    update studio_product_profiles set visual_traits='{"source_hash":"new","version":"decision-v1","silhouette_ratio":0.5,"notes":"internal"}' where product_id='a';
    insert into studio_product_neighbors(product_id,neighbor_product_id,model_version,rank,similarity) values ('a','b','test',1,.95);
  `)
  expect(
    (
      await db.query(
        "select visual_traits from studio_product_profiles_public where product_id='a'",
      )
    ).rows,
  ).toEqual([{ visual_traits: null }])
  expect(
    (await db.query('select * from studio_product_neighbors_public')).rows,
  ).toHaveLength(1)
  await db.exec(
    "update studio_product_media set status='validated',validated_at=now()+interval '1 second',validated_by='00000000-0000-0000-0000-000000000001' where source_hash='new'",
  )
  expect(
    (await db.query('select * from studio_product_neighbors_public')).rows,
  ).toHaveLength(0)
  expect(
    (
      await db.query(
        "select visual_traits from studio_product_profiles_public where product_id='a'",
      )
    ).rows,
  ).toEqual([{ visual_traits: { silhouette_ratio: 0.5 } }])
})

it('sessions/événements : relations valides, aucune écriture client même admin', async () => {
  const probes = [
    "insert into studio_sessions(id,algorithm_version,entry) values ('security-probe','v0.1','seats')",
    "insert into studio_events(session_id,event_type,algorithm_version,product_id) values ('event-session','card_liked','v1.0','a')",
  ]
  for (const probe of probes) {
    await db.exec('begin')
    await db.exec(probe)
    await db.exec('rollback')
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await expect(db.exec(probe)).rejects.toMatchObject({ code: '42501' })
      await db.exec('reset role')
    }
  }
})

it('recalculs SQL : candidats rafraîchis, décisions humaines et pilotes validés préservés', async () => {
  const products = ['ra', 'rb', 'rc', 'rd', 're', 'rf']
  const features = []
  for (const id of products) {
    await db.query('insert into products values ($1,true)', [id])
    const media = await db.query<{ id: string }>(
      "insert into studio_product_media(product_id,role,url,storage_path,source_url,source_hash,quality_score,pipeline_version) values ($1,'decision','https://example.test/image','studio/'||$1,'source',$1,.9,'test') returning id",
      [id],
    )
    features.push({
      product_id: id,
      model_version: 'refresh',
      source_media_id: media.rows[0]!.id,
      embedding: Array(384).fill(0.1),
      features: {},
    })
  }
  const family = (b: string) => ({
    product_a_id: 'ra',
    product_b_id: b,
    model_version: 'refresh',
    similarity: 0.8,
    evidence: { distance: 1 },
  })
  const pair = (b: string) => ({
    product_a_id: 'ra',
    product_b_id: b,
    axis: 'openness',
    source: 'pipeline',
    pipeline_version: 'refresh',
    notes: 'before',
  })
  const report = {
    model_version: 'refresh',
    features,
    neighbors: [],
    families: ['rb', 'rc', 'rd'].map(family),
    diagnostic_pairs: ['rb', 're', 'rf'].map(pair),
    errors: [],
    pilot: { product_ids: ['ra', 'rb'], criteria: { revision: 1 } },
  }
  const apply = async () => {
    const artifact = execFileSync(
      'python3',
      [
        '-c',
        "import importlib.util,json,sys; s=importlib.util.spec_from_file_location('imp','pipeline/studio/prepare-import.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(m.render(json.load(sys.stdin),'visual',include_pilot=True))",
      ],
      { input: JSON.stringify(report), encoding: 'utf8' },
    )
    await db.exec(artifact)
  }
  await apply()
  await db.exec(`update studio_model_family_candidates set status='accepted',reviewed_at=now() where product_a_id='ra' and product_b_id='rc';
 update studio_model_family_candidates set status='rejected',reviewed_at=now() where product_a_id='ra' and product_b_id='rd';
 update studio_diagnostic_pairs set status='verified',verified_by='00000000-0000-0000-0000-000000000001' where product_a_id='ra' and product_b_id='re';
 update studio_diagnostic_pairs set source='manual' where product_a_id='ra' and product_b_id='rf';
 insert into studio_model_family_candidates(product_a_id,product_b_id,model_version,similarity,evidence) values ('rb','rc','old',.9,'{}');
 insert into studio_diagnostic_pairs(product_a_id,product_b_id,axis,source) values ('rb','rc','obsolete','pipeline');`)
  const human = async () => ({
    families: (
      await db.query(
        "select * from studio_model_family_candidates where product_a_id='ra' and status in ('accepted','rejected') order by product_b_id",
      )
    ).rows,
    pairs: (
      await db.query(
        "select * from studio_diagnostic_pairs where product_a_id='ra' and (status='verified' or source='manual') order by product_b_id",
      )
    ).rows,
  })
  const before = await human()
  report.families = report.families.map((f) => ({
    ...f,
    similarity: 0.95,
    evidence: { distance: 2 },
  }))
  report.diagnostic_pairs = report.diagnostic_pairs.map((p) => ({
    ...p,
    notes: 'after',
  }))
  report.pilot = { product_ids: ['ra', 'rc', 'rd'], criteria: { revision: 2 } }
  await apply()
  await apply()
  expect(await human()).toEqual(before)
  expect(
    (
      await db.query(
        "select similarity,evidence from studio_model_family_candidates where product_a_id='ra' and product_b_id='rb'",
      )
    ).rows,
  ).toEqual([{ similarity: 0.95, evidence: { distance: 2 } }])
  expect(
    (
      await db.query(
        "select notes from studio_diagnostic_pairs where product_a_id='ra' and product_b_id='rb'",
      )
    ).rows,
  ).toEqual([{ notes: 'after' }])
  expect(
    (
      await db.query(
        "select * from studio_model_family_candidates where product_a_id='rb' and product_b_id='rc'",
      )
    ).rows,
  ).toEqual([])
  expect(
    (
      await db.query(
        "select * from studio_diagnostic_pairs where axis='obsolete'",
      )
    ).rows,
  ).toEqual([])
  expect(
    (
      await db.query(
        "select product_ids,criteria from studio_curation_sets where id='pilot'",
      )
    ).rows,
  ).toEqual([{ product_ids: ['ra', 'rc', 'rd'], criteria: { revision: 2 } }])
  for (const status of ['active', 'archived']) {
    await db.query(
      "update studio_curation_sets set status=$1 where id='pilot'",
      [status],
    )
    const pilot = (
      await db.query("select * from studio_curation_sets where id='pilot'")
    ).rows
    report.pilot = { product_ids: ['rf'], criteria: { revision: 3 } }
    await apply()
    expect(
      (await db.query("select * from studio_curation_sets where id='pilot'"))
        .rows,
    ).toEqual(pilot)
  }
  // A new model replaces unreviewed pairs but must not reopen a human verdict.
  report.model_version = 'refresh-2'
  report.features = report.features.map((f) => ({
    ...f,
    model_version: 'refresh-2',
  }))
  report.families = report.families.map((f) => ({
    ...f,
    model_version: 'refresh-2',
  }))
  await apply()
  await apply()
  expect(await human()).toEqual(before)
  expect(
    (
      await db.query(
        "select model_version from studio_model_family_candidates where product_a_id='ra' and product_b_id='rb'",
      )
    ).rows,
  ).toEqual([{ model_version: 'refresh-2' }])
  expect(
    (
      await db.query(
        "select * from studio_model_family_candidates where product_a_id='ra' and product_b_id in ('rc','rd')",
      )
    ).rows,
  ).toHaveLength(2)
})

it('sondes historiques valides : familles/profils/options/curation/paires bloquées par RLS', async () => {
  const probes = [
    "insert into studio_model_families(id,label,status,source) values ('security-probe','Probe','candidate','manual')",
    "insert into studio_product_profiles(product_id,studio_role,data_quality) values ('inactive','catalog_only','{}')",
    "insert into studio_fulfillment_options(product_id,mode,source,price_basis,is_active) values ('a','standard_production','admin','container',false)",
    "insert into studio_curation_sets(id,label,product_ids,criteria,status) values ('security-probe','Probe','{}','{}','draft')",
    "insert into studio_diagnostic_pairs(product_a_id,product_b_id,axis,source,status) values ('a','b','security-probe','manual','candidate')",
  ]
  for (const probe of probes) {
    await db.exec("set test.admin='true'; set role authenticated; begin")
    await db.exec(probe)
    await db.exec("rollback; reset role; set test.admin='false'")
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await expect(db.exec(probe)).rejects.toMatchObject({ code: '42501' })
      await db.exec('reset role')
    }
  }
})
