-- Amigos (PRIVACY.md P-43): una caca se puede compartir solo con amigos, además
-- de privada o pública. La amistad se hace con un link de invitación.

-- Alcance de cada caca compartida. Las de amigos no gastan número del mapa
-- público: el número se asigna recién al hacerla pública.
alter table publicaciones add column alcance text not null default 'publico' check (alcance in ('publico', 'amigos'));
alter table publicaciones alter column numero drop default;
alter table publicaciones alter column numero drop not null;
alter table publicaciones add constraint publicaciones_numero_publico check (alcance = 'amigos' or numero is not null);

-- Amistad mutua, una fila por par (cuenta_a < cuenta_b).
create table amistades (
	cuenta_a uuid not null references cuentas (id) on delete cascade,
	cuenta_b uuid not null references cuentas (id) on delete cascade,
	desde date not null default current_date,
	primary key (cuenta_a, cuenta_b),
	check (cuenta_a < cuenta_b)
);
create index amistades_b on amistades (cuenta_b);

-- Un link de invitación vigente por cuenta: generar uno nuevo invalida el anterior.
create table invitaciones_amistad (
	cuenta_id uuid primary key references cuentas (id) on delete cascade,
	token_hash bytea not null unique,
	vence_en timestamptz not null
);
