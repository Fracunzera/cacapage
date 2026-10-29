-- Esquema osm (ADR 0002 §5): copia regenerable de lo importado de
-- OpenStreetMap, de una sola vía (ADR 0001). Los usuarios nunca escriben acá.
-- Sin PostGIS por ahora: lat/lon alcanzan para servir el mapa.

create schema osm;

create table osm.candidatos (
	-- Objeto principal de OSM: n123 (nodo), w123 (way), r123 (relación). Estable
	-- entre importaciones mientras OSM no lo reemplace.
	id text primary key check (id ~ '^[nwr][0-9]+$'),
	procedencia text not null check (procedencia = 'osm'),
	-- Objetos fusionados (p. ej. el baño mapeado aparte de su estación de servicio).
	objetos text[] not null,
	categoria text not null,
	existencia text not null check (existencia in ('confirmado', 'probable')),
	nombre text,
	marca text,
	lat double precision not null,
	lon double precision not null,
	-- Solo los tags relevantes: access, fee, wheelchair, changing_table, opening_hours…
	atributos jsonb not null default '{}',
	-- Última modificación del objeto en OSM (frescura, DESIGN.md §10.3).
	osm_modificado date,
	importacion_id integer not null
);
create index candidatos_importacion on osm.candidatos (importacion_id);

create table osm.importaciones (
	id serial primary key,
	empezada_en timestamptz not null default now(),
	fuente text not null,
	osm_base timestamptz,
	n_candidatos integer,
	estado text not null default 'en_curso' check (estado in ('en_curso', 'ok', 'fallida'))
);
