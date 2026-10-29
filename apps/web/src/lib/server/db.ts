import postgres from 'postgres';
import { cfg } from './config';

let cliente: postgres.Sql | null = null;

export function db(): postgres.Sql {
	return (cliente ??= postgres(cfg().databaseUrl, { max: 10, idle_timeout: 30, onnotice: () => {} }));
}

// Migraciones SQL planas, en orden por nombre, empaquetadas en el build.
const MIGRACIONES = import.meta.glob('./migraciones/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<
	string,
	string
>;

export async function migrar(): Promise<string[]> {
	const sql = db();
	const aplicadas: string[] = [];
	await sql.begin(async (tx) => {
		// Un solo proceso migra a la vez.
		await tx`select pg_advisory_xact_lock(4207011)`;
		await tx`create table if not exists schema_migraciones (nombre text primary key, aplicada_en date not null default current_date)`;
		const hechas = new Set((await tx`select nombre from schema_migraciones`).map((r) => r.nombre as string));
		for (const ruta of Object.keys(MIGRACIONES).sort()) {
			const nombre = ruta.split('/').pop()!;
			if (hechas.has(nombre)) continue;
			await tx.unsafe(MIGRACIONES[ruta]);
			await tx`insert into schema_migraciones (nombre) values (${nombre})`;
			aplicadas.push(nombre);
		}
	});
	return aplicadas;
}
