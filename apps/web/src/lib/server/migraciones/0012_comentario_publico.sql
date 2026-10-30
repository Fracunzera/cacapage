-- La anécdota de una caca pública, si su dueño eligió mostrarla (PRIVACY.md
-- P-42). Con 3 reportes de cuentas elegibles se oculta el texto (no el punto)
-- hasta revisarlo a mano (docs/despliegue.md, "Comentarios públicos").
alter table publicaciones add column comentario text check (char_length(comentario) <= 500);
alter table publicaciones add column comentario_oculto boolean not null default false;

create table comentario_reportes (
	publicacion_id uuid not null references publicaciones (id) on delete cascade,
	cuenta_id uuid not null references cuentas (id) on delete cascade,
	creado_en date not null default current_date,
	primary key (publicacion_id, cuenta_id)
);
