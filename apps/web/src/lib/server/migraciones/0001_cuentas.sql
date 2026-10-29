-- Cuentas y autenticación (DESIGN.md §6.3). Sin nombre, mail en claro, IP ni
-- user agent. Fechas con precisión de día salvo los vencimientos.

create table cuentas (
	id uuid primary key,
	seudonimo text not null,
	creada_en date not null default current_date,
	mayor_de_edad boolean not null,
	estado text not null default 'activa' check (estado in ('activa', 'suspendida')),
	dias_activos smallint not null default 0,
	ultimo_dia_activo date
);
create unique index cuentas_seudonimo_unico on cuentas (lower(seudonimo));

create table credenciales_passkey (
	id uuid primary key,
	cuenta_id uuid not null references cuentas (id) on delete cascade,
	credencial_id text not null unique,
	clave_publica bytea not null,
	contador_firma bigint not null default 0,
	transportes text[] not null default '{}',
	soporta_prf boolean not null default false,
	creada_en date not null default current_date
);
create index credenciales_passkey_cuenta on credenciales_passkey (cuenta_id);

-- El mail nunca se guarda: solo HMAC-SHA256(pimienta, mail normalizado).
create table logins_mail (
	cuenta_id uuid primary key references cuentas (id) on delete cascade,
	mail_hmac bytea not null unique,
	creado_en date not null default current_date
);

create table tokens_mail (
	token_hash bytea primary key,
	mail_hmac bytea not null,
	-- Datos del alta si el link es para crear una cuenta (seudónimo, consentimientos).
	alta jsonb,
	vence_en timestamptz not null,
	usado boolean not null default false
);

create table desafios_webauthn (
	id uuid primary key,
	desafio text not null,
	tipo text not null check (tipo in ('alta', 'entrada')),
	alta jsonb,
	vence_en timestamptz not null
);

create table sesiones (
	id_hash bytea primary key,
	cuenta_id uuid not null references cuentas (id) on delete cascade,
	tipo text not null default 'cookie' check (tipo in ('cookie', 'bearer')),
	vence_en timestamptz not null,
	-- Hasta cuándo vale para acciones delicadas (borrar la cuenta).
	reautenticada_hasta timestamptz not null
);
create index sesiones_cuenta on sesiones (cuenta_id);

create table consentimientos (
	cuenta_id uuid not null references cuentas (id) on delete cascade,
	tipo text not null,
	version_texto text not null,
	otorgado_en date not null default current_date,
	revocado_en date,
	primary key (cuenta_id, tipo, version_texto)
);
