import { gzipSync } from 'node:zlib';
import { db } from '../db';
import { ATRIBUCION_OSM, type Banio, type Catalogo } from '$lib/banios/tipos';

interface Cache {
	importacion: number | null;
	etag: string;
	cuerpo: Buffer;
	gzip: Buffer;
}
let cache: Cache | null = null;

const red = (n: number) => Math.round(n * 1e6) / 1e6;

/** El catálogo entero en JSON (y en gzip), regenerado solo cuando hay una importación nueva. */
export async function catalogo(): Promise<Cache> {
	const sql = db();
	const [ultima] = await sql`
		select id, osm_base, empezada_en from osm.importaciones where estado = 'ok' order by id desc limit 1`;
	const id = (ultima?.id as number | undefined) ?? null;
	if (cache && cache.importacion === id) return cache;

	const filas = id
		? await sql`
			select id, categoria, existencia, nombre, marca, lat, lon, atributos, osm_modificado
			from osm.candidatos order by id`
		: [];
	const banios: Banio[] = filas.map((f) => ({
		id: f.id,
		categoria: f.categoria,
		existencia: f.existencia,
		nombre: f.nombre,
		marca: f.marca,
		lat: red(f.lat),
		lon: red(f.lon),
		atributos: f.atributos,
		modificado: f.osm_modificado ? (f.osm_modificado as Date).toISOString().slice(0, 10) : null
	}));
	const datos: Catalogo = {
		osm_base: ultima?.osm_base ? (ultima.osm_base as Date).toISOString() : null,
		importado_en: ultima ? (ultima.empezada_en as Date).toISOString() : null,
		atribucion: ATRIBUCION_OSM,
		banios
	};
	const cuerpo = Buffer.from(JSON.stringify(datos));
	cache = { importacion: id, etag: `"banios-${id ?? 0}"`, cuerpo, gzip: gzipSync(cuerpo, { level: 9 }) };
	return cache;
}
