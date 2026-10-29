-- Puntajes y reportes de baños (DESIGN.md §0, iteración 5, punto 17). Sin FK a
-- osm.candidatos: esa tabla se reemplaza en cada importación semanal.
create table banio_puntajes (
	banio_id text not null,
	cuenta_id uuid not null references cuentas (id) on delete cascade,
	puntaje smallint not null check (puntaje between 1 and 5),
	primary key (banio_id, cuenta_id)
);

create table banio_reportes (
	banio_id text not null,
	cuenta_id uuid not null references cuentas (id) on delete cascade,
	motivo text not null check (motivo in ('no_existe', 'no_publico', 'mal_ubicado', 'otro')),
	creado_en date not null default current_date,
	primary key (banio_id, cuenta_id)
);

-- Baños sacados del mapa por reportes. Sobrevive a las importaciones de OSM.
create table banios_ocultos (
	banio_id text primary key,
	ocultado_en timestamptz not null default now(),
	reportes integer not null
);
