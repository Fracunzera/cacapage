// REGLA: IMPORTACIÓN DE UNA SOLA VÍA (ADR 0001, docs/adr/0001-osm-importacion-una-via.md).
// Este módulo solo LEE de OpenStreetMap (consultas de lectura a Overpass) y
// escribe únicamente en nuestro esquema `osm`. Las correcciones de nuestros
// usuarios viven en nuestra base y NO se escriben de vuelta a OSM
// automáticamente. Si alguna vez se devuelven, es a mano y con revisión.

import type postgres from 'postgres';
import { db } from '../db';
import { normalizar, type ElementoOsm } from './normalizar';

export { OVERPASS_POR_DEFECTO } from './servidores';

/** Qué se trae de toda la Argentina (DESIGN.md §11.3, iteración 5). */
export const CONSULTA = `[out:json][timeout:600];
area["ISO3166-1"="AR"][admin_level=2]->.ar;
(
  nwr[amenity=toilets](area.ar);
  nwr[toilets=yes](area.ar);
  nwr["toilets:access"](area.ar);
  nwr[amenity=fuel](area.ar);
  nwr[amenity=bus_station](area.ar);
  nwr[aeroway=aerodrome][iata](area.ar);
  nwr[shop=mall](area.ar);
);
out tags center meta qt;`;

/** Cada cuánto se refresca. No hay recorrida garantizada: OSM es el piso. */
export const VIGENCIA_MS = 7 * 24 * 3600_000;
const REINTENTO_MS = 6 * 3600_000;
const LOCK = 4207012;

interface RespuestaOverpass {
	osm3s?: { timestamp_osm_base?: string };
	remark?: string;
	elements: ElementoOsm[];
}

async function descargar(servidores: string[]): Promise<{ fuente: string; datos: RespuestaOverpass }> {
	const errores: string[] = [];
	for (const url of servidores) {
		try {
			const r = await fetch(url, {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'dondecague.com.ar (importador de solo lectura)' },
				body: new URLSearchParams({ data: CONSULTA }),
				signal: AbortSignal.timeout(15 * 60_000)
			});
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			const datos = (await r.json()) as RespuestaOverpass;
			// Overpass devuelve 200 con `remark` cuando corta por tiempo o memoria.
			if (datos.remark && /error|timed out|out of memory/i.test(datos.remark)) throw new Error(datos.remark);
			if (!Array.isArray(datos.elements) || datos.elements.length === 0) throw new Error('respuesta vacía');
			return { fuente: url, datos };
		} catch (e) {
			errores.push(`${new URL(url).host}: ${e instanceof Error ? e.message : e}`);
		}
	}
	throw new Error(`Ningún servidor de Overpass respondió (${errores.join('; ')})`);
}

/** Reemplaza el contenido del esquema osm con una importación nueva, en una transacción. */
export async function guardar(sql: postgres.Sql, fuente: string, datos: RespuestaOverpass): Promise<number> {
	const candidatos = normalizar(datos.elements);
	const base = datos.osm3s?.timestamp_osm_base ?? null;
	await sql.begin(async (tx) => {
		const [{ id }] = await tx`insert into osm.importaciones (fuente, osm_base) values (${fuente}, ${base}) returning id`;
		await tx`delete from osm.candidatos`;
		for (let i = 0; i < candidatos.length; i += 1000) {
			const filas = candidatos.slice(i, i + 1000).map((c) => ({
				id: c.id,
				procedencia: 'osm',
				objetos: c.objetos,
				categoria: c.categoria,
				existencia: c.existencia,
				nombre: c.nombre,
				marca: c.marca,
				lat: c.lat,
				lon: c.lon,
				atributos: tx.json(c.atributos as postgres.JSONValue),
				osm_modificado: c.modificado,
				importacion_id: id
			}));
			await tx`insert into osm.candidatos ${tx(filas)}`;
		}
		await tx`update osm.importaciones set estado = 'ok', n_candidatos = ${candidatos.length} where id = ${id}`;
	});
	return candidatos.length;
}

/** Importa si hace falta. Nunca tira: un fallo se registra y se reintenta más tarde. */
export async function importarSiHaceFalta(servidores: string[], forzar = false): Promise<void> {
	const sql = db();
	const reservada = await sql.reserve();
	try {
		const [{ ok }] = await reservada`select pg_try_advisory_lock(${LOCK}) as ok`;
		if (!ok) return;
		try {
			const [ultima] = await reservada`
				select
					max(empezada_en) filter (where estado = 'ok') as ok,
					max(empezada_en) as intento
				from osm.importaciones`;
			const ahora = Date.now();
			const ok = ultima.ok ? +new Date(ultima.ok) : 0;
			const intento = ultima.intento ? +new Date(ultima.intento) : 0;
			const vieja = ahora - ok > VIGENCIA_MS;
			const fallaReciente = intento > ok && ahora - intento < REINTENTO_MS;
			if (!forzar && (!vieja || fallaReciente)) return;

			console.log('OSM: importando baños de toda la Argentina…');
			try {
				const { fuente, datos } = await descargar(servidores);
				const n = await guardar(sql, fuente, datos);
				console.log(`OSM: ${n} baños importados desde ${new URL(fuente).host}`);
			} catch (e) {
				const motivo = e instanceof Error ? e.message : String(e);
				await sql`insert into osm.importaciones (fuente, estado) values (${motivo.slice(0, 500)}, 'fallida')`;
				console.error(`OSM: la importación falló: ${motivo}`);
			}
		} finally {
			await reservada`select pg_advisory_unlock(${LOCK})`;
		}
	} catch (e) {
		console.error(`OSM: ${e instanceof Error ? e.message : e}`);
	} finally {
		reservada.release();
	}
}

let reloj: ReturnType<typeof setInterval> | null = null;

/**
 * Revisa al arrancar y cada hora; importa una vez por semana. `demoraMs` separa
 * al sitio de prueba del real para no pedirle dos consultas juntas a Overpass.
 */
export function programarImportacion(servidores: string[], demoraMs = 10_000): void {
	if (reloj) return;
	setTimeout(() => void importarSiHaceFalta(servidores), demoraMs).unref();
	reloj = setInterval(() => void importarSiHaceFalta(servidores), 3600_000);
	reloj.unref();
}
