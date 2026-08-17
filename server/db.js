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
      status text not null check (status in ('NIEUW','AFWACHTING','IN_BEHANDELING','AFGEROND')),
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

  // Bestaande databases: status-check uitbreiden met AFWACHTING
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
        and pg_get_constraintdef(con.oid) ilike '%status%';
      if cname is not null then
        execute format('alter table opdrachten drop constraint %I', cname);
      end if;
      alter table opdrachten
        add constraint opdrachten_status_check
        check (status in ('NIEUW','AFWACHTING','IN_BEHANDELING','AFGEROND'));
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
    do $$
    begin
      alter table financiele_posten
        add constraint financiele_posten_betalingswijze_check
        check (
          betalingswijze is null
          or betalingswijze in ('OPGEHAALD', 'OVERGEMAAKT', 'GESTORT')
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
}

module.exports = {
  pool,
  query,
  migrate
};

