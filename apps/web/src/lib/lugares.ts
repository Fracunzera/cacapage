// "Cuántas veces en un mismo lugar": agrupa visitas por baño del catálogo o,
// sin baño, por cercanía. Se calcula en el celular, sobre lo que cada uno ve.
import { distanciaM } from '$lib/banios/geo';

/** Dos visitas sin baño a menos de esto son el mismo lugar. */
export const RADIO_MISMO_LUGAR_M = 40;

export interface ConLugar {
	lat?: number;
	lon?: number;
	banio_id?: string | null;
}

export interface Lugar<T> {
	clave: string;
	lat: number;
	lon: number;
	visitas: T[];
}

/**
 * Agrupa en orden: cada visita va al lugar que ya existe (mismo baño, o a
 * menos de 40 m del primero que se vio), o arma uno nuevo. Las que no tienen
 * ubicación quedan afuera.
 */
export function agrupar<T extends ConLugar>(visitas: T[], radio = RADIO_MISMO_LUGAR_M): Lugar<T>[] {
	const lugares: Lugar<T>[] = [];
	const porBanio = new Map<string, Lugar<T>>();
	for (const v of visitas) {
		if (v.lat === undefined || v.lon === undefined) continue;
		if (v.banio_id) {
			const l = porBanio.get(v.banio_id);
			if (l) l.visitas.push(v);
			else {
				const nuevo = { clave: `b:${v.banio_id}`, lat: v.lat, lon: v.lon, visitas: [v] };
				porBanio.set(v.banio_id, nuevo);
				lugares.push(nuevo);
			}
			continue;
		}
		const cerca = lugares.find((l) => l.clave.startsWith('p:') && distanciaM(l, { lat: v.lat!, lon: v.lon! }) < radio);
		if (cerca) cerca.visitas.push(v);
		else lugares.push({ clave: `p:${lugares.length}`, lat: v.lat, lon: v.lon, visitas: [v] });
	}
	return lugares;
}

/** El nombre que le pusiste a un lugar: el de la visita más reciente que tenga uno. */
export function nombreDelLugar<T extends { lugar_nombre?: string; ocurrido_en: string }>(visitas: T[]): string | undefined {
	return [...visitas].sort((a, b) => (a.ocurrido_en < b.ocurrido_en ? 1 : -1)).find((v) => v.lugar_nombre)?.lugar_nombre;
}

/** Si ya le pusiste nombre a un lugar en este punto (mismo baño o a menos de 40 m), cuál. */
export function nombreCerca<T extends ConLugar & { lugar_nombre?: string; ocurrido_en: string }>(
	visitas: T[],
	punto: ConLugar
): string | undefined {
	if (punto.lat === undefined || punto.lon === undefined) return undefined;
	const ahi = visitas.filter(
		(v) =>
			v.lugar_nombre &&
			v.lat !== undefined &&
			v.lon !== undefined &&
			((punto.banio_id && v.banio_id === punto.banio_id) ||
				(!punto.banio_id && !v.banio_id && distanciaM({ lat: v.lat, lon: v.lon }, { lat: punto.lat!, lon: punto.lon! }) < RADIO_MISMO_LUGAR_M))
	);
	return nombreDelLugar(ahi);
}

/**
 * Para cada visita, qué número de vez es en su lugar, en orden cronológico
 * ("3.ª vez acá"), y cuántas hay en total ahí.
 */
export function vecesPorVisita<T extends ConLugar & { id: string }>(
	visitas: T[],
	fecha: (v: T) => string
): Map<string, { vez: number; total: number }> {
	const ordenadas = [...visitas].sort((a, b) => (fecha(a) < fecha(b) ? -1 : 1));
	const r = new Map<string, { vez: number; total: number }>();
	for (const l of agrupar(ordenadas)) l.visitas.forEach((v, i) => r.set(v.id, { vez: i + 1, total: l.visitas.length }));
	return r;
}
