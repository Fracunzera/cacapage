-- Bóveda: el historial cifrado de cada cuenta (DESIGN.md §6.2, PRIVACY.md P-03
-- y P-04). El servidor guarda bytes que no puede leer. Las páginas no tienen
-- fechas: se sincronizan por número de secuencia.

create sequence boveda_seq;

create table boveda_paginas (
	cuenta_id uuid not null references cuentas (id) on delete cascade,
	-- Identificador opaco que elige el cliente (HMAC del mes): el servidor no
	-- sabe a qué mes corresponde cada página.
	pagina_id text not null check (pagina_id ~ '^[A-Za-z0-9_-]{16,64}$'),
	seq bigint not null default nextval('boveda_seq'),
	version integer not null,
	nonce bytea not null,
	cifrado bytea not null,
	primary key (cuenta_id, pagina_id)
);
create index boveda_paginas_seq on boveda_paginas (cuenta_id, seq);

-- La llave de la bóveda, envuelta. Sin una forma de desenvolverla, los bytes de
-- arriba no sirven: borrar esta fila es destruir el historial (crypto-shredding).
create table boveda_llaves (
	cuenta_id uuid not null references cuentas (id) on delete cascade,
	metodo text not null check (metodo in ('recuperacion', 'passkey_prf')),
	credencial_id text not null default '',
	envuelta bytea not null,
	parametros jsonb not null,
	primary key (cuenta_id, metodo, credencial_id)
);
