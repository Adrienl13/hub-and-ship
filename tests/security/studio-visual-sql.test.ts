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
    create table studio_model_families(id text primary key,label text,status text,source text check(source in ('manual','pipeline')));
    create table studio_product_profiles(product_id text primary key references products(id),studio_role text,seat_kind text,material text,model_family_id text references studio_model_families(id),visual_traits jsonb,data_quality jsonb);
    insert into studio_product_profiles(product_id) values ('a'),('b');
    create function studio_public_data_quality(jsonb) returns jsonb language sql as $$ select '{}'::jsonb $$;
    create table studio_diagnostic_pairs(id uuid primary key default gen_random_uuid(),product_a_id text,product_b_id text,axis text,source text check(source in ('manual','pipeline')),status text,notes text);
    create table studio_curation_sets(id text primary key,label text,product_ids text[],criteria jsonb,status text);
    create table studio_events(event_type text constraint studio_events_event_type_check check(event_type in ('studio_started')));
    create table studio_sessions(id text primary key,algorithm_version text);
    grant usage on schema public,auth to anon,authenticated;
  `)
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
      if (table === 'studio_algorithm_versions')
        await expect(
          db.exec(
            `insert into ${table}(version,engine,status) values ('v9.0','v0','preview')`,
          ),
        ).rejects.toThrow(/row-level security/)
      await db.exec(
        "reset role; set test.admin = 'true'; set role authenticated",
      )
      await expect(db.query(`select * from ${table}`)).resolves.toBeDefined()
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
    for (const type of STUDIO_EVENT_TYPES)
      await db.query('insert into studio_events values ($1)', [type])
    await expect(
      db.exec("insert into studio_events values ('unknown')"),
    ).rejects.toThrow(/check constraint/)
    await expect(
      db.exec(
        "insert into studio_diagnostic_pairs(source) values ('pipeline:v1')",
      ),
    ).rejects.toThrow(/check constraint/)
  })
  it('version de session immuable, V1 désactivable sans effacer les données', async () => {
    await db.exec("insert into studio_sessions values ('s','v1.0')")
    await expect(
      db.exec(
        "update studio_sessions set algorithm_version='v0.1' where id='s'",
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
