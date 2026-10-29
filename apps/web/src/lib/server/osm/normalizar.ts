// REGLA: IMPORTACIÓN DE UNA SOLA VÍA (ADR 0001, docs/adr/0001-osm-importacion-una-via.md).
// Este módulo solo LEE datos de OpenStreetMap. Nada de lo que hagan nuestros
// usuarios se escribe en OSM de forma automática; si alguna vez se devuelve algo,
// lo hace una persona, a mano, con revisión. Acá no hay ni puede haber
// credenciales ni llamadas de escritura a la API de OSM.

import type { Atributos, Banio, Categoria } from '$lib/banios/tipos';

/** Elemento tal como lo devuelve Overpass con `out tags center meta`. */
export interface ElementoOsm {
	type: 'node' | 'way' | 'relation';
	id: number;
	lat?: number;
	lon?: number;
	center?: { lat: number; lon: number };
	tags?: Record<string, string>;
	timestamp?: string;
}

/** Fusión baño ↔ lugar (DESIGN.md §11.4). */
export const RADIO_FUSION_M = 50;

const GASTRONOMIA = /^(restaurant|cafe|bar|fast_food|pub|ice_cream|food_court|biergarten)$/;
const NO = /^(no|private)$/;

function categoria(t: Record<string, string>): Categoria {
	if (t.amenity === 'toilets') return 'banio';
	if (t.amenity === 'fuel') return 'estacion_servicio';
	if (t.amenity === 'bus_station') return 'terminal';
	if (t.aeroway === 'aerodrome') return 'aeropuerto';
	if (t.shop === 'mall') return 'shopping';
	if (t.shop || GASTRONOMIA.test(t.amenity ?? '')) return 'comercio';
	return 'otro';
}

const siNo = (v: string | undefined): boolean | undefined => (v === 'yes' ? true : v === 'no' ? false : undefined);

function acceso(v: string | undefined): Atributos['acceso'] {
	if (v === 'yes' || v === 'permissive' || v === 'public') return 'libre';
	if (v === 'customers') return 'clientes';
	return undefined;
}

const FECHA = /^\d{4}-\d{2}-\d{2}/;
const fecha = (v: string | undefined) => (v && FECHA.test(v) ? v.slice(0, 10) : null);
const masNueva = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : (a ?? b));

function limpiar(a: Atributos): Atributos {
	return Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined && v !== '')) as Atributos;
}

/**
 * Atributos del baño. En un lugar (estación, shopping…) se leen primero los
 * tags `toilets:*`, que describen el baño y no el lugar.
 */
function atributos(t: Record<string, string>, esBanio: boolean): Atributos {
	const de = (k: string) => (esBanio ? t[k] : t[`toilets:${k}`]);
	const silla = de('wheelchair');
	const calle = t['addr:street'];
	return limpiar({
		acceso: acceso(esBanio ? t.access : t['toilets:access']),
		cobra: siNo(de('fee')),
		accesible: silla === 'limited' ? 'limitado' : siNo(silla),
		cambiador: siNo(t.changing_table ?? t['toilets:changing_table']),
		horario: t.opening_hours,
		direccion: calle ? `${calle}${t['addr:housenumber'] ? ' ' + t['addr:housenumber'] : ''}` : undefined,
		localidad: t['addr:city'],
		operador: t.operator
	});
}

/** null si el elemento no aporta un baño (privado, cerrado, `toilets=no`, sin posición). */
export function aCandidato(e: ElementoOsm): Banio | null {
	const t = e.tags ?? {};
	const lat = e.lat ?? e.center?.lat;
	const lon = e.lon ?? e.center?.lon;
	if (lat === undefined || lon === undefined) return null;
	if (Object.keys(t).some((k) => k.startsWith('disused:') || k.startsWith('abandoned:')) || t.disused === 'yes')
		return null;

	const cat = categoria(t);
	const esBanio = cat === 'banio';
	if (esBanio && NO.test(t.access ?? '')) return null;
	if (!esBanio && (t.toilets === 'no' || NO.test(t['toilets:access'] ?? ''))) return null;

	const tieneBanio = esBanio || t.toilets === 'yes' || t['toilets:access'] !== undefined;
	// Un comercio sin toilets=yes no entra: no hay forma de saber si tiene baño.
	if (!tieneBanio && (cat === 'comercio' || cat === 'otro')) return null;

	const checkDate = fecha(t['check_date:toilets'] ?? t.check_date);
	return {
		id: `${e.type[0]}${e.id}`,
		categoria: cat,
		existencia: tieneBanio ? 'confirmado' : 'probable',
		nombre: t.name ?? (esBanio ? null : (t.brand ?? null)),
		marca: t.brand ?? null,
		lat,
		lon,
		atributos: atributos(t, esBanio),
		modificado: masNueva(fecha(e.timestamp), checkDate)
	};
}

function distanciaM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
	const r = Math.PI / 180;
	const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
	const y = (b.lat - a.lat) * r;
	return Math.sqrt(x * x + y * y) * 6_371_000;
}

export interface Fusionado extends Banio {
	/** Objetos de OSM que forman este baño: el principal primero. */
	objetos: string[];
}

/**
 * Normaliza y fusiona: un `amenity=toilets` a menos de 50 m de un lugar
 * (estación, terminal, shopping…) pasa a ser el baño de ese lugar, confirmado,
 * con el nombre del lugar y la posición del baño, que es más precisa.
 */
export function normalizar(elementos: ElementoOsm[]): Fusionado[] {
	const vistos = new Set<string>();
	const banios: Banio[] = [];
	const lugares: Fusionado[] = [];
	for (const e of elementos) {
		const c = aCandidato(e);
		if (!c || vistos.has(c.id)) continue;
		vistos.add(c.id);
		if (c.categoria === 'banio') banios.push(c);
		else lugares.push({ ...c, objetos: [c.id] });
	}

	// Grilla de ~1 km para no comparar todo contra todo.
	const celda = (lat: number, lon: number) => `${Math.floor(lat * 100)}:${Math.floor(lon * 100)}`;
	const grilla = new Map<string, Fusionado[]>();
	for (const l of lugares) {
		const k = celda(l.lat, l.lon);
		grilla.set(k, [...(grilla.get(k) ?? []), l]);
	}

	const sueltos: Fusionado[] = [];
	const absorbido = new Set<Fusionado>();
	for (const b of banios) {
		let mejor: Fusionado | null = null;
		let mejorD = RADIO_FUSION_M;
		const la = Math.floor(b.lat * 100);
		const lo = Math.floor(b.lon * 100);
		for (let i = -1; i <= 1; i++)
			for (let j = -1; j <= 1; j++)
				for (const l of grilla.get(`${la + i}:${lo + j}`) ?? []) {
					const d = distanciaM(b, l);
					if (d < mejorD) [mejor, mejorD] = [l, d];
				}
		if (!mejor) {
			sueltos.push({ ...b, objetos: [b.id] });
			continue;
		}
		const lugar: Fusionado = mejor;
		// La primera fusión mueve el punto al baño; si hay varios, queda el primero.
		if (!absorbido.has(lugar)) {
			lugar.lat = b.lat;
			lugar.lon = b.lon;
			absorbido.add(lugar);
		}
		lugar.objetos.push(b.id);
		lugar.existencia = 'confirmado';
		const { horario, ...delBanio } = b.atributos;
		lugar.atributos = limpiar({ ...lugar.atributos, ...delBanio, horario: horario ?? lugar.atributos.horario });
		lugar.modificado = masNueva(lugar.modificado, b.modificado);
	}

	return [...lugares, ...sueltos].sort((a, b) => (a.id < b.id ? -1 : 1));
}
