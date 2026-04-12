-- Civic Mirror — initial schema
--
-- This replaces the old `candidate_issues` table from the prototype. It
-- models the data needed for Layer 2 (plain-language ballot measures) as
-- the anchor layer, with scaffolding for Layers 1 (ballot lookup), 3
-- (candidates), and 4 (funding / endorsements).
--
-- Review status: every piece of LLM-generated content is ingested as
-- `review_status = 'draft'`. Nothing is visible to voters until a human
-- reviewer flips it to `'published'`. This is enforced by RLS policies on
-- the measures table below.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core taxonomy: topics a measure can impact, used to score alignment.
-- Kept in sync with apps/web/src/lib/topics.ts and apps/ingest/src/topics.ts.
-- ---------------------------------------------------------------------------
create table topics (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  label_en     text not null,
  label_es     text not null,
  description_en text not null,
  description_es text not null,
  created_at   timestamptz not null default now()
);

insert into topics (slug, label_en, label_es, description_en, description_es) values
  ('housing',           'Housing',            'Vivienda',               'Availability and affordability of housing; tenant protections; new housing construction.', 'Disponibilidad y asequibilidad de la vivienda; protecciones para inquilinos; construcción de nueva vivienda.'),
  ('homelessness',      'Homelessness',       'Personas sin hogar',     'Services, shelters, and prevention programs for people experiencing homelessness.',         'Servicios, refugios y programas de prevención para personas sin hogar.'),
  ('public-safety',     'Public safety',      'Seguridad pública',      'Policing, emergency response, and general community safety.',                              'Policía, respuesta a emergencias y seguridad comunitaria en general.'),
  ('criminal-justice',  'Criminal justice',   'Justicia penal',         'Courts, incarceration, sentencing, and rights of the accused or formerly incarcerated.',    'Tribunales, encarcelamiento, sentencias y derechos de los acusados o ex encarcelados.'),
  ('education',         'Education',          'Educación',              'Public schools, teachers, curriculum, school funding, early childhood, higher ed.',         'Escuelas públicas, maestros, currículo, financiamiento escolar, primera infancia, educación superior.'),
  ('transit',           'Transit',            'Transporte',             'Public transportation, roads, bike/pedestrian infrastructure, congestion.',                 'Transporte público, carreteras, infraestructura para ciclistas/peatones, congestión.'),
  ('climate',           'Climate',            'Clima',                  'Climate change, air and water quality, renewable energy, environmental protection.',        'Cambio climático, calidad del aire y del agua, energía renovable, protección ambiental.'),
  ('healthcare',        'Healthcare',         'Salud',                  'Access to medical care, mental health services, substance-use treatment, public health.',   'Acceso a atención médica, salud mental, tratamiento de adicciones, salud pública.'),
  ('taxes',             'Taxes',              'Impuestos',              'Tax rates, tax fairness, and how public money is raised.',                                   'Tasas impositivas, equidad tributaria y cómo se recauda el dinero público.'),
  ('civil-rights',      'Civil rights',       'Derechos civiles',       'Voting rights, equal protection, non-discrimination, immigrant rights.',                    'Derecho al voto, igualdad ante la ley, no discriminación, derechos de los inmigrantes.'),
  ('government-reform', 'Government reform',  'Reforma de gobierno',    'Transparency, ethics, accountability, structure of local government.',                      'Transparencia, ética, rendición de cuentas y estructura del gobierno local.'),
  ('economy',           'Economy',            'Economía',               'Jobs, wages, small business support, cost of living, general economic opportunity.',         'Empleos, salarios, apoyo a pequeños negocios, costo de vida, oportunidad económica.');

-- ---------------------------------------------------------------------------
-- Elections. Jurisdiction is a slug like 'la-ca' so we can extend beyond LA
-- without reshaping the table.
-- ---------------------------------------------------------------------------
create table elections (
  id             uuid primary key default gen_random_uuid(),
  jurisdiction   text not null,
  election_date  date not null,
  type           text not null check (type in ('general','primary','special','runoff')),
  label_en       text not null,
  label_es       text not null,
  created_at     timestamptz not null default now(),
  unique (jurisdiction, election_date, type)
);

-- ---------------------------------------------------------------------------
-- Measures — the center of the MVP. Plain-language fields are the LLM output
-- after human review. official_text_url is the canonical source PDF.
-- ---------------------------------------------------------------------------
create table measures (
  id                 uuid primary key default gen_random_uuid(),
  election_id        uuid not null references elections(id) on delete cascade,
  code               text not null,  -- 'Measure A', 'Measure G', 'Proposition 36'
  title_en           text not null,
  title_es           text not null,
  official_text_url  text,
  plain_summary_en   text not null,
  plain_summary_es   text not null,
  what_yes_means_en  text not null,
  what_yes_means_es  text not null,
  what_no_means_en   text not null,
  what_no_means_es   text not null,
  fiscal_impact_en   text,
  fiscal_impact_es   text,
  review_status      text not null default 'draft' check (review_status in ('draft','reviewed','published')),
  reviewed_by        text,
  reviewed_at        timestamptz,
  source_citations   jsonb not null default '[]'::jsonb,
  reviewer_notes_en  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (election_id, code)
);

create index measures_election_status_idx on measures (election_id, review_status);

-- ---------------------------------------------------------------------------
-- Pro/con arguments, taken from the official voter pamphlet.
-- ---------------------------------------------------------------------------
create table measure_arguments (
  id          uuid primary key default gen_random_uuid(),
  measure_id  uuid not null references measures(id) on delete cascade,
  side        text not null check (side in ('pro','con')),
  summary_en  text not null,
  summary_es  text not null,
  author      text,  -- literal named signer(s) of the pamphlet argument, not endorsers
  source_url  text,
  created_at  timestamptz not null default now()
);

create index measure_arguments_measure_idx on measure_arguments (measure_id);

-- ---------------------------------------------------------------------------
-- Topic-level impact tags. direction is from the perspective of someone
-- who cares about *advancing* the topic: +1 means "a YES vote moves this
-- topic forward", -1 means "a YES vote moves this topic backward", 0 mixed.
-- confidence is 0..100 and drives how heavily this impact swings the
-- alignment score in apps/web/src/lib/alignment/score.ts.
-- ---------------------------------------------------------------------------
create table measure_impacts (
  id            uuid primary key default gen_random_uuid(),
  measure_id    uuid not null references measures(id) on delete cascade,
  topic_id      uuid not null references topics(id),
  direction     smallint not null check (direction in (-1, 0, 1)),
  confidence    smallint not null check (confidence between 0 and 100),
  rationale_en  text not null,
  rationale_es  text not null,
  unique (measure_id, topic_id)
);

create index measure_impacts_measure_idx on measure_impacts (measure_id);

-- ---------------------------------------------------------------------------
-- Named supporters / opponents (organizations or individuals exactly as the
-- source lists them). Do not duplicate argument signers here.
-- ---------------------------------------------------------------------------
create table measure_endorsements (
  id          uuid primary key default gen_random_uuid(),
  measure_id  uuid not null references measures(id) on delete cascade,
  name        text not null,
  role        text not null check (role in ('support','oppose')),
  source_url  text
);

create index measure_endorsements_measure_idx on measure_endorsements (measure_id);

-- ---------------------------------------------------------------------------
-- Campaign finance summary per measure, per side.
-- ---------------------------------------------------------------------------
create table measure_funding (
  id                 uuid primary key default gen_random_uuid(),
  measure_id         uuid not null references measures(id) on delete cascade,
  side               text not null check (side in ('support','oppose')),
  committee_name     text,
  total_raised_cents bigint,
  top_donors         jsonb not null default '[]'::jsonb,
  source_url         text,
  as_of              date,
  created_at         timestamptz not null default now()
);

create index measure_funding_measure_idx on measure_funding (measure_id);

-- ---------------------------------------------------------------------------
-- Races and candidates (Layer 1 scaffolding; Layer 3 content for post-MVP).
-- ---------------------------------------------------------------------------
create table races (
  id           uuid primary key default gen_random_uuid(),
  election_id  uuid not null references elections(id) on delete cascade,
  office       text not null,      -- 'Mayor', 'Supervisor District 5', 'School Board'
  district     text,
  voter_type   text not null check (voter_type in ('all','district')),
  created_at   timestamptz not null default now()
);

create index races_election_idx on races (election_id);

create table candidates (
  id          uuid primary key default gen_random_uuid(),
  race_id     uuid not null references races(id) on delete cascade,
  name        text not null,
  party       text,
  incumbent   boolean not null default false,
  website_url text,
  bio_en      text,
  bio_es      text
);

create index candidates_race_idx on candidates (race_id);

-- ---------------------------------------------------------------------------
-- Anonymous voter sessions — no accounts for MVP. Sessions store a locale,
-- a ZIP, optional district hints, and the priorities the user set in the
-- values quiz. Scoring happens server-side so priorities never leak to
-- other clients.
-- ---------------------------------------------------------------------------
create table voter_sessions (
  id             uuid primary key default gen_random_uuid(),
  locale         text not null check (locale in ('en','es')),
  zip            text,
  district_hints jsonb not null default '{}'::jsonb,
  priorities     jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shareable ballot summaries. The id in the URL is the capability — no
-- auth, whoever has the link can read the snapshot. The snapshot is a
-- frozen denormalized view at share time so editing measures later doesn't
-- mutate someone's saved cheat sheet.
-- ---------------------------------------------------------------------------
create table ballot_shares (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references voter_sessions(id) on delete set null,
  election_id   uuid not null references elections(id) on delete cascade,
  snapshot      jsonb not null,
  created_at    timestamptz not null default now()
);

create index ballot_shares_election_idx on ballot_shares (election_id);

-- ---------------------------------------------------------------------------
-- Row Level Security. Voters use the anon key in the browser, so we have to
-- lock everything down to "published content only" by default. The service-
-- role key (used only server-side) bypasses RLS entirely.
-- ---------------------------------------------------------------------------
alter table topics               enable row level security;
alter table elections            enable row level security;
alter table measures             enable row level security;
alter table measure_arguments    enable row level security;
alter table measure_impacts      enable row level security;
alter table measure_endorsements enable row level security;
alter table measure_funding      enable row level security;
alter table races                enable row level security;
alter table candidates           enable row level security;
alter table voter_sessions       enable row level security;
alter table ballot_shares        enable row level security;

-- Public read: reference tables and elections are always visible.
create policy topics_public_read     on topics               for select using (true);
create policy elections_public_read  on elections            for select using (true);
create policy races_public_read      on races                for select using (true);
create policy candidates_public_read on candidates           for select using (true);

-- Public read: only PUBLISHED measures and their children.
create policy measures_public_read
  on measures for select using (review_status = 'published');

create policy measure_arguments_public_read
  on measure_arguments for select using (
    exists (select 1 from measures m where m.id = measure_arguments.measure_id and m.review_status = 'published')
  );

create policy measure_impacts_public_read
  on measure_impacts for select using (
    exists (select 1 from measures m where m.id = measure_impacts.measure_id and m.review_status = 'published')
  );

create policy measure_endorsements_public_read
  on measure_endorsements for select using (
    exists (select 1 from measures m where m.id = measure_endorsements.measure_id and m.review_status = 'published')
  );

create policy measure_funding_public_read
  on measure_funding for select using (
    exists (select 1 from measures m where m.id = measure_funding.measure_id and m.review_status = 'published')
  );

-- Voter sessions: owner-only read/write, keyed by the session id passed in
-- a client-side cookie. The app mints these via a server action and the
-- browser client never lists them — it only reads/writes the one it owns
-- by id. No anonymous browsing of other people's priorities.
create policy voter_sessions_self_read
  on voter_sessions for select using (false);
create policy voter_sessions_self_write
  on voter_sessions for insert with check (false);
-- Real policies will be added once we have the session-cookie mechanism;
-- until then all voter_sessions access goes through the server client.

-- Ballot shares are readable by anyone who has the id (the capability model).
create policy ballot_shares_public_read
  on ballot_shares for select using (true);
