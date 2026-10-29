-- Reportes: con 15 reportes de cuentas elegibles el baño queda "en revisión"
-- (sigue en el mapa, con aviso); ocultarlo es a mano y con motivo
-- (docs/despliegue.md, "Reportes de baños"). Reemplaza el ocultamiento
-- automático de 0007. En producción las dos tablas estaban vacías.
--
-- Con "if (not) exists": una base que recibió 0007 por primera vez desde los
-- commits f770577 o 39baa8d (cuando 0007 estuvo editada por error) ya tiene
-- banios_en_revision y motivo, y sin reportes. Así sirve para las dos historias.

create table if not exists banios_en_revision (
	banio_id text primary key,
	desde timestamptz not null default now(),
	reportes integer not null
);

alter table banios_ocultos add column if not exists motivo text not null default '';
alter table banios_ocultos drop column if exists reportes;
