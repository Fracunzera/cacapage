-- Registros que su dueño eligió hacer públicos (PRIVACY.md P-38). Es la única
-- tabla con coordenadas de usuarios, y solo con consentimiento explícito por
-- registro. Sin hora: solo el día. Se ven recién desde `visible_desde`.
create table publicaciones (
	-- El mismo id del registro en la bóveda: así el dueño puede despublicarlo.
	id uuid primary key,
	cuenta_id uuid not null references cuentas (id) on delete cascade,
	tipo text not null check (tipo in ('banio_publico', 'ruta', 'naturaleza', 'otro')),
	-- En un baño del catálogo se publica el baño, no la posición del usuario.
	banio_id text,
	lat double precision,
	lon double precision,
	dia date not null,
	sin_papel boolean not null default false,
	visible_desde timestamptz not null,
	check ((banio_id is not null) or (lat is not null and lon is not null))
);
create index publicaciones_visibles on publicaciones (visible_desde);
create index publicaciones_cuenta on publicaciones (cuenta_id);
