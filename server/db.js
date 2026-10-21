const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
const NODE_ENV = process.env.NODE_ENV || "development";

if (!DATABASE_URL) {
  if (NODE_ENV === "production") {
    throw new Error("DATABASE_URL ontbreekt. Stel DATABASE_URL in voor productie.");
  }
}

/** Neon: channel_binding kan node-pg breken. */
function normalizeDatabaseUrl(raw) {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return String(raw).replace(/([?&])channel_binding=[^&]*&?/g, "$1").replace(/[?&]$/, "");
  }
}

const pool = DATABASE_URL
  ? new Pool({
      connectionString: normalizeDatabaseUrl(DATABASE_URL),
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
    })
  : null;

if (pool) {
  pool.on("error", (err) => {
    console.error("Databaseverbinding verbroken (idle); wordt opnieuw geopend bij de volgende query.", err.message);
  });
}

async function query(text, params) {
  if (!pool) {
    throw new Error("Database niet geconfigureerd (DATABASE_URL ontbreekt).");
  }
  const res = await pool.query(text, params);
  return res;
}

async function migrateLegacyUsersTable() {
  const cols = await query(
    `
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'users'
    `,
    []
  );
  if (!cols.rows.length) return;

  const names = new Set(cols.rows.map((r) => r.column_name));
  if (names.has("password_hash")) return;

  // Oud schema (o.a. kolom "password", integer id) — lege tabel veilig vervangen.
  const count = await query("select count(*)::int as c from users", []);
  if (count.rows[0].c > 0) {
    throw new Error(
      "De tabel users heeft een verouderd schema en bevat nog data. Neem contact op met beheer of migreer handmatig."
    );
  }
  await query("drop table if exists users cascade", []);
  console.log("[db] Verouderde users-tabel verwijderd; nieuwe structuur wordt aangemaakt.");
}

async function migrate() {
  if (!pool) return;

  await migrateLegacyUsersTable();

  await query(
    `
    create table if not exists users (
      id uuid primary key,
      name text not null,
      email text not null unique,
      password_hash text not null,
      role text not null check (role in ('EIGENAAR','MEDEWERKER')),
      active boolean not null default true,
      created_at timestamptz not null default now()
    );

    create table if not exists opdrachten (
      id text primary key,
      klant_naam text not null,
      omschrijving text not null,
      datum_aangemaakt date not null,
      datum_deadline date,
      status text not null check (status in ('NIEUW','AFWACHTING','IN_BEHANDELING','INGEDIEND','AFGEROND')),
      prioriteit int not null check (prioriteit in (1,2,3)),
      behandelaar_user_id text,
      notities text,
      categorie text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists bestanden (
      id text primary key,
      opdracht_id text not null,
      originele_naam text not null,
      opslag_naam text not null unique,
      mime_type text not null,
      grootte int not null,
      uploaded_by_user_id text,
      created_at timestamptz not null default now()
    );

    create table if not exists password_reset_tokens (
      id text primary key,
      user_id text not null,
      token_hash text not null,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );

    create index if not exists idx_opdrachten_behandelaar on opdrachten(behandelaar_user_id);
    create index if not exists idx_bestanden_opdracht on bestanden(opdracht_id);
    `,
    []
  );

  await query(
    `
    alter table opdrachten add column if not exists deleted_at timestamptz;
    create index if not exists idx_opdrachten_deleted_at
      on opdrachten(deleted_at)
      where deleted_at is not null;
    `,
    []
  );

  // Bestaande databases: status-check uitbreiden met AFWACHTING en INGEDIEND
  await query(
    `
    do $$
    declare
      cname text;
    begin
      select con.conname into cname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where rel.relname = 'opdrachten'
        and nsp.nspname = 'public'
        and con.contype = 'c'
        and pg_get_constraintdef(con.oid) ilike '%status%'
        and pg_get_constraintdef(con.oid) not ilike '%financiele%';
      if cname is not null then
        execute format('alter table opdrachten drop constraint %I', cname);
      end if;
      alter table opdrachten
        add constraint opdrachten_status_check
        check (status in ('NIEUW','AFWACHTING','IN_BEHANDELING','INGEDIEND','AFGEROND'));
    end $$;
    `,
    []
  );

  await query(
    `
    create table if not exists financiele_posten (
      id text primary key,
      datum timestamptz not null,
      type text not null check (type in ('INKOMST','UITGAVE','KASGELD')),
      omschrijving text not null,
      bedrag numeric(12,2) not null check (bedrag >= 0),
      valuta text not null default 'EUR',
      categorie text,
      referentie text,
      klant_naam text,
      status text not null check (status in ('OPEN','BETAALD')),
      notities text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_financiele_posten_datum on financiele_posten(datum desc);
    create index if not exists idx_financiele_posten_type on financiele_posten(type);
    alter table financiele_posten add column if not exists klant_naam text;
    alter table financiele_posten add column if not exists opdracht_id text;
    alter table financiele_posten add column if not exists afgehandeld_door_user_id text;
    alter table financiele_posten add column if not exists afgehandeld_door_naam text;
    alter table financiele_posten add column if not exists valuta text;
    alter table financiele_posten add column if not exists betalingswijze text;
    alter table financiele_posten add column if not exists kas_effect text;
    alter table financiele_posten add column if not exists bank text;
    alter table financiele_posten add column if not exists geld_bij_user_id text;
    alter table financiele_posten add column if not exists geld_bij_naam text;
    alter table financiele_posten add column if not exists wisselkoers numeric(18,6);
    update financiele_posten set valuta = 'EUR' where valuta is null or valuta = '';
    alter table financiele_posten alter column valuta set default 'EUR';
    alter table financiele_posten add column if not exists geld_van_user_id text;
    alter table financiele_posten add column if not exists geld_van_naam text;
    alter table financiele_posten add column if not exists gebruikingen jsonb not null default '[]'::jsonb;
    -- Type OVERDRACHT toestaan (geld van A naar B).
    alter table financiele_posten drop constraint if exists financiele_posten_type_check;
    alter table financiele_posten
      add constraint financiele_posten_type_check
      check (type in ('INKOMST','UITGAVE','KASGELD','OVERDRACHT'));
    -- Check constraint (idempotent): bestaande constraint negeren als hij al bestaat.
    do $$
    begin
      alter table financiele_posten
        add constraint financiele_posten_valuta_check
        check (valuta in ('EUR', 'USD', 'SRD', 'XCG'));
    exception
      when duplicate_object then null;
    end $$;
    alter table financiele_posten drop constraint if exists financiele_posten_betalingswijze_check;
    do $$
    begin
      alter table financiele_posten
        add constraint financiele_posten_betalingswijze_check
        check (
          betalingswijze is null
          or betalingswijze in ('OPGEHAALD', 'OVERGEMAAKT', 'GESTORT', 'PINPAS', 'MEDEWERKER')
        );
    exception
      when duplicate_object then null;
    end $$;
    alter table financiele_posten drop constraint if exists financiele_posten_kas_effect_check;
    do $$
    begin
      alter table financiele_posten
        add constraint financiele_posten_kas_effect_check
        check (
          kas_effect is null
          or kas_effect in ('NEE', 'ERBIJ', 'AF')
        );
    exception
      when duplicate_object then null;
    end $$;
    create index if not exists idx_financiele_posten_opdracht on financiele_posten(opdracht_id);
    -- Bestaande date-kolom upgraden naar datum+tijd.
    do $$
    begin
      if exists (
        select 1
        from information_schema.columns
        where table_name = 'financiele_posten'
          and column_name = 'datum'
          and data_type = 'date'
      ) then
        alter table financiele_posten
          alter column datum type timestamptz
          using (datum::timestamp);
      end if;
    end $$;
    `,
    []
  );

  await query(
    `
    create table if not exists financiele_inzendingen (
      id text primary key,
      created_at timestamptz not null default now(),
      van_user_id text not null,
      van_naam text not null,
      datum timestamptz not null,
      type text not null check (type in ('INKOMST','UITGAVE','KASGELD','OVERDRACHT')),
      omschrijving text not null,
      bedrag numeric(12,2) not null check (bedrag >= 0),
      valuta text not null default 'EUR',
      wisselkoers numeric(18,6),
      categorie text,
      referentie text,
      klant_naam text,
      betalingswijze text,
      kas_effect text,
      bank text,
      geld_bij_naam text,
      geld_van_naam text,
      waaraan text,
      notities text,
      status text not null default 'NIEUW' check (status in ('NIEUW','GEZIEN','VERWERKT'))
    );
    create index if not exists idx_financiele_inzendingen_status on financiele_inzendingen(status);
    create index if not exists idx_financiele_inzendingen_van on financiele_inzendingen(van_user_id);
    create index if not exists idx_financiele_inzendingen_created on financiele_inzendingen(created_at desc);
    alter table financiele_inzendingen add column if not exists kas_effect text;
    `,
    []
  );

  await query(
    `
    create table if not exists financiele_inzending_bestanden (
      id text primary key,
      inzending_id text not null references financiele_inzendingen(id) on delete cascade,
      originele_naam text not null,
      opslag_naam text not null unique,
      mime_type text not null,
      grootte int not null,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_fin_inzending_bestanden_inzending
      on financiele_inzending_bestanden(inzending_id);
    `,
    []
  );

  await query(
    `
    create table if not exists financiele_post_bestanden (
      id text primary key,
      post_id text not null references financiele_posten(id) on delete cascade,
      originele_naam text not null,
      opslag_naam text not null unique,
      mime_type text not null,
      grootte int not null,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_fin_post_bestanden_post
      on financiele_post_bestanden(post_id);
    `,
    []
  );

  await query(
    `
    create table if not exists app_settings (
      key text primary key,
      value text not null default '',
      updated_at timestamptz not null default now()
    );

    create table if not exists help_video_files (
      id int primary key default 1,
      original_name text not null default 'Uitlegvideo',
      mime_type text not null default 'video/mp4',
      data bytea not null,
      updated_at timestamptz not null default now(),
      constraint help_video_files_singleton check (id = 1)
    );
    `,
    []
  );

  await query(`alter table bestanden add column if not exists inhoud bytea;`, []);

  await koppelLoginAccountsAanFinancieleNamen();
}

const VASTE_MEDEWERKER_NAMEN = ["Natasha", "Vanessa"];

/**
 * Naam-only posten (oude extra vakjes) koppelen aan het login-account met dezelfde naam.
 * Bedragen blijven staan; alleen identiteit wordt gelijkgetrokken.
 */
async function koppelLoginAccountsAanFinancieleNamen() {
  const { rows: users } = await query(
    `
    select id::text as id, btrim(name) as name
    from users
    where coalesce(btrim(name), '') <> ''
    order by created_at asc
    `,
    []
  );
  const byName = new Map();
  for (const u of users) {
    const key = String(u.name || "").trim().toLowerCase();
    if (!key || byName.has(key)) continue;
    byName.set(key, { id: String(u.id), name: String(u.name).trim() });
  }

  for (const vasteNaam of VASTE_MEDEWERKER_NAMEN) {
    await canoniseerFinancieleNaam(vasteNaam, byName.get(vasteNaam.toLowerCase()) || null);
  }

  for (const [sleutel, account] of byName) {
    if (VASTE_MEDEWERKER_NAMEN.some((n) => n.toLowerCase() === sleutel)) continue;
    await canoniseerFinancieleNaam(account.name, account);
  }
}

async function canoniseerFinancieleNaam(naam, account) {
  const match = String(naam || "").trim();
  if (!match) return;
  const sleutel = match.toLowerCase();
  const userId = account?.id || null;
  const canon = account?.name || match;

  await query(
    `
    update financiele_posten set
      afgehandeld_door_user_id = case
        when $2::text is not null
          and (
            lower(btrim(coalesce(afgehandeld_door_naam, ''))) = $1
            or afgehandeld_door_user_id = $2
          )
          and (
            afgehandeld_door_user_id is null
            or btrim(afgehandeld_door_user_id) = ''
            or afgehandeld_door_user_id = $2
          )
        then $2
        else afgehandeld_door_user_id
      end,
      afgehandeld_door_naam = case
        when lower(btrim(coalesce(afgehandeld_door_naam, ''))) = $1
          or ($2::text is not null and afgehandeld_door_user_id = $2)
        then $3
        else afgehandeld_door_naam
      end,
      geld_bij_user_id = case
        when $2::text is not null
          and (
            lower(btrim(coalesce(geld_bij_naam, ''))) = $1
            or geld_bij_user_id = $2
          )
          and (
            geld_bij_user_id is null
            or btrim(geld_bij_user_id) = ''
            or geld_bij_user_id = $2
          )
        then $2
        else geld_bij_user_id
      end,
      geld_bij_naam = case
        when lower(btrim(coalesce(geld_bij_naam, ''))) = $1
          or ($2::text is not null and geld_bij_user_id = $2)
        then $3
        else geld_bij_naam
      end,
      geld_van_user_id = case
        when $2::text is not null
          and (
            lower(btrim(coalesce(geld_van_naam, ''))) = $1
            or geld_van_user_id = $2
          )
          and (
            geld_van_user_id is null
            or btrim(geld_van_user_id) = ''
            or geld_van_user_id = $2
          )
        then $2
        else geld_van_user_id
      end,
      geld_van_naam = case
        when lower(btrim(coalesce(geld_van_naam, ''))) = $1
          or ($2::text is not null and geld_van_user_id = $2)
        then $3
        else geld_van_naam
      end,
      updated_at = now()
    where
      lower(btrim(coalesce(afgehandeld_door_naam, ''))) = $1
      or lower(btrim(coalesce(geld_bij_naam, ''))) = $1
      or lower(btrim(coalesce(geld_van_naam, ''))) = $1
      or ($2::text is not null and afgehandeld_door_user_id = $2)
      or ($2::text is not null and geld_bij_user_id = $2)
      or ($2::text is not null and geld_van_user_id = $2)
    `,
    [sleutel, userId, canon]
  );

  await query(
    `
    update financiele_posten
    set
      gebruikingen = coalesce((
        select jsonb_agg(
          case
            when lower(btrim(coalesce(elem->>'medewerker', ''))) = $1
            then jsonb_set(elem, '{medewerker}', to_jsonb($2::text))
            else elem
          end
          order by ordinality
        )
        from jsonb_array_elements(gebruikingen) with ordinality as t(elem, ordinality)
      ), '[]'::jsonb),
      updated_at = now()
    where jsonb_typeof(gebruikingen) = 'array'
      and exists (
        select 1
        from jsonb_array_elements(gebruikingen) e
        where lower(btrim(coalesce(e->>'medewerker', ''))) = $1
      )
    `,
    [sleutel, canon]
  );

  await query(
    `
    update financiele_inzendingen set
      van_naam = case when lower(btrim(coalesce(van_naam, ''))) = $1 then $2 else van_naam end,
      geld_bij_naam = case when lower(btrim(coalesce(geld_bij_naam, ''))) = $1 then $2 else geld_bij_naam end,
      geld_van_naam = case when lower(btrim(coalesce(geld_van_naam, ''))) = $1 then $2 else geld_van_naam end
    where
      lower(btrim(coalesce(van_naam, ''))) = $1
      or lower(btrim(coalesce(geld_bij_naam, ''))) = $1
      or lower(btrim(coalesce(geld_van_naam, ''))) = $1
    `,
    [sleutel, canon]
  );
}

module.exports = {
  pool,
  query,
  migrate
};

