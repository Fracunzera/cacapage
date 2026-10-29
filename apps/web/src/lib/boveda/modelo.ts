// Historial privado (DESIGN.md §6.1). Todo esto vive cifrado en la bóveda;
// el servidor no ve ni registros, ni cantidades, ni medallas.
import medallasJson from '../../../../../data/curated/medallas.json';
import logrosJson from '../../../../../data/curated/logros.json';

export type Tipo = 'casa' | 'laburo' | 'casa_ajena' | 'banio_publico' | 'ruta' | 'naturaleza' | 'otro';

export const TIPOS: { id: Tipo; icono: string; texto: string }[] = [
	{ id: 'casa', icono: '🏠', texto: 'En casa' },
	{ id: 'laburo', icono: '💼', texto: 'En el laburo' },
	{ id: 'casa_ajena', icono: '🛋️', texto: 'En lo de alguien' },
	{ id: 'banio_publico', icono: '🚻', texto: 'Baño público' },
	{ id: 'ruta', icono: '🛣️', texto: 'En la ruta' },
	{ id: 'naturaleza', icono: '🌳', texto: 'Al aire libre' },
	{ id: 'otro', icono: '❓', texto: 'Otro' }
];

export interface Registro {
	id: string;
	/** ISO con zona. Exacto: solo lo ve el dueño. */
	ocurrido_en: string;
	tipo: Tipo;
	lat?: number;
	lon?: number;
	precision_m?: number;
	/** Baño del catálogo, solo si el usuario lo eligió (P-05). */
	banio_id?: string;
	banio_nombre?: string;
	sin_papel?: boolean;
	/** "¿Alguna anécdota?" (§8.1), hasta 500 caracteres. */
	comentario?: string;
	/** Publicado en el mapa público por decisión del dueño (P-38). */
	publico?: true;
	/** Su número en el mapa público (mientras sea pública). */
	numero_publico?: number;
	actualizado_en: string;
	/** Marca de borrado, para que el borrado gane al mezclar dos dispositivos. */
	borrado?: true;
}

export interface PaginaMes {
	v: 1;
	tipo: 'mes';
	mes: string;
	registros: Registro[];
}

export interface Premio {
	id: string;
	obtenido_en: string;
}

export interface PaginaGeneral {
	v: 1;
	tipo: 'general';
	/** Medalla n = registro 5·n. Se conservan aunque se borren registros (§17.3). */
	medallas: { numero: number; obtenida_en: string }[];
	logros: Premio[];
}

export type Pagina = PaginaMes | PaginaGeneral;

export const COMENTARIO_MAX = 500;

export const generalVacia = (): PaginaGeneral => ({ v: 1, tipo: 'general', medallas: [], logros: [] });

/** "2026-10" en la hora local del celular. */
export function mesDe(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Mezcla dos versiones de una página: por registro gana el último cambio; los borrados ganan los empates. */
export function mezclar<P extends Pagina>(a: P, b: P): P {
	if (a.tipo === 'general' && b.tipo === 'general') {
		const medallas = new Map<number, string>();
		for (const m of [...a.medallas, ...b.medallas]) {
			const prev = medallas.get(m.numero);
			if (!prev || m.obtenida_en < prev) medallas.set(m.numero, m.obtenida_en);
		}
		const logros = new Map<string, string>();
		for (const l of [...a.logros, ...b.logros]) {
			const prev = logros.get(l.id);
			if (!prev || l.obtenido_en < prev) logros.set(l.id, l.obtenido_en);
		}
		return {
			...a,
			medallas: [...medallas].map(([numero, obtenida_en]) => ({ numero, obtenida_en })).sort((x, y) => x.numero - y.numero),
			logros: [...logros].map(([id, obtenido_en]) => ({ id, obtenido_en }))
		} as P;
	}
	if (a.tipo === 'mes' && b.tipo === 'mes') {
		const porId = new Map<string, Registro>();
		for (const r of [...a.registros, ...b.registros]) {
			const prev = porId.get(r.id);
			if (!prev || r.actualizado_en > prev.actualizado_en || (r.actualizado_en === prev.actualizado_en && r.borrado)) porId.set(r.id, r);
		}
		return { ...a, registros: [...porId.values()].sort((x, y) => (x.ocurrido_en < y.ocurrido_en ? -1 : 1)) } as P;
	}
	throw new Error('No se pueden mezclar páginas de distinto tipo');
}

// Medallas y logros (DESIGN.md §17).
const CADA = medallasJson.cada;

export function nombreMedalla(numero: number): string {
	const registros = numero * CADA;
	const especial = medallasJson.especiales.find((e) => e.registros === registros);
	if (especial) return especial.nombre;
	const conNombre = medallasJson.medallas.find((m) => m.numero === numero);
	if (conNombre) return conNombre.nombre;
	return medallasJson.despues_de_200.plantilla.replace('{nivel}', String((registros - 200) / CADA));
}

export interface Logro {
	id: string;
	nombre: string;
	descripcion: string;
}
export const LOGROS: Logro[] = logrosJson.logros.map((l) => ({ id: l.id, nombre: l.nombre, descripcion: l.descripcion }));

export type Novedad = { tipo: 'medalla'; numero: number; nombre: string } | { tipo: 'logro'; id: string; nombre: string; descripcion: string };

/**
 * Lo que se gana con `cantidad` registros vivos. Las medallas ya ganadas se
 * conservan; solo se suman las nuevas.
 */
export function evaluarPremios(general: PaginaGeneral, cantidad: number, ahora: string): { general: PaginaGeneral; novedades: Novedad[] } {
	const novedades: Novedad[] = [];
	const medallas = [...general.medallas];
	const tiene = new Set(medallas.map((m) => m.numero));
	for (let n = 1; n <= Math.floor(cantidad / CADA); n++) {
		if (tiene.has(n)) continue;
		medallas.push({ numero: n, obtenida_en: ahora });
		novedades.push({ tipo: 'medalla', numero: n, nombre: nombreMedalla(n) });
	}
	const logros = [...general.logros];
	for (const l of logrosJson.logros) {
		if (logros.some((x) => x.id === l.id)) continue;
		if (l.condicion.tipo === 'cantidad_registros' && cantidad >= l.condicion.minimo) {
			logros.push({ id: l.id, obtenido_en: ahora });
			novedades.push({ tipo: 'logro', id: l.id, nombre: l.nombre, descripcion: l.descripcion });
		}
	}
	// Si se ganan varias de golpe (carga vieja), se anuncia solo la última medalla.
	const ultima = novedades.filter((n) => n.tipo === 'medalla').pop();
	return {
		general: { ...general, medallas: medallas.sort((a, b) => a.numero - b.numero), logros },
		novedades: [...novedades.filter((n) => n.tipo === 'logro'), ...(ultima ? [ultima] : [])]
	};
}

/** "Te faltan 3 para la próxima" (sin revelar el nombre, §17.5). */
export const faltanParaLaProxima = (cantidad: number) => CADA - (cantidad % CADA);
