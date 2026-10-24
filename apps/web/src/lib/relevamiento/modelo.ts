// Modelo de la herramienta de relevamiento (DESIGN.md §15.6, SEEDING.md §5).
// Todo lo que se exporta de acá sale con procedencia 'gps_campo': nada se
// rellena con datos de OSM (ADR 0002 §5).

export const PRECISION_MAXIMA_M = 30;

export const DESCONOCIDO = 'desconocido';
export type Desconocido = typeof DESCONOCIDO;

/** Categorías de DESIGN.md §6.7 (`propio.banios.categoria`). */
export const CATEGORIAS = [
	['banio_publico', 'Baño público'],
	['estacion_servicio', 'Estación de servicio'],
	['gastronomia', 'Bar / resto / café'],
	['supermercado', 'Supermercado'],
	['shopping', 'Shopping / galería'],
	['terminal', 'Terminal'],
	['aeropuerto', 'Aeropuerto'],
	['hospital', 'Hospital'],
	['oficina_publica', 'Oficina pública'],
	['educacion_superior', 'Universidad'],
	['parque', 'Parque / plaza'],
	['museo', 'Museo'],
	['estadio', 'Estadio'],
	['otro', 'Otro']
] as const;
export type Categoria = (typeof CATEGORIAS)[number][0];

/** Valores de `acceso` (DESIGN.md §6.7). */
export const ACCESOS = [
	['libre', 'Libre'],
	['clientes', 'Solo clientes'],
	['pedir_llave', 'Pedir llave'],
	['con_costo', 'Con costo']
] as const;
export type Acceso = (typeof ACCESOS)[number][0];

export type SiNo = 'si' | 'no' | Desconocido;

export const DIAS = [
	['habil', 'Lun a vie'],
	['sabado', 'Sábado'],
	['domingo_feriado', 'Dom y feriados']
] as const;
export type Dia = (typeof DIAS)[number][0];

/** Horario de un tipo de día: igual que DESIGN.md §6.7, más "desconocido". */
export type HorarioDia = Desconocido | '24h' | 'cerrado' | { abre: string; cierra: string };
export type Horario = Record<Dia, HorarioDia>;

export interface Geom {
	lat: number;
	lon: number;
	precision_m: number;
	/** Momento del fix de GPS (ISO 8601). */
	fix_en: string;
}

export interface Borrador {
	id: string;
	iniciado_en: string;
	geom: Geom | null;
	nombre: string;
	categoria: Categoria | Desconocido;
	acceso: Acceso | Desconocido;
	cobra: SiNo;
	horario: Horario;
	accesible: SiNo;
	cambiador: SiNo;
}

export interface BanioRelevado {
	id: string;
	procedencia: 'gps_campo';
	relevado_en: string;
	geom: Geom & { geom_procedencia: 'gps_campo' };
	nombre: string | null;
	categoria: Categoria | Desconocido;
	atributos: {
		acceso: Acceso | Desconocido;
		cobra: SiNo;
		horario: Horario;
		accesible: SiNo;
		cambiador: SiNo;
	};
}

export interface Exportacion {
	formato: 'cacapage-recorrida';
	version: 1;
	exportado_en: string;
	procedencia: 'gps_campo';
	cantidad: number;
	banios: BanioRelevado[];
}

export function nuevoBorrador(ahora: Date = new Date(), id: string = crypto.randomUUID()): Borrador {
	return {
		id,
		iniciado_en: ahora.toISOString(),
		geom: null,
		nombre: '',
		categoria: DESCONOCIDO,
		acceso: DESCONOCIDO,
		cobra: DESCONOCIDO,
		horario: { habil: DESCONOCIDO, sabado: DESCONOCIDO, domingo_feriado: DESCONOCIDO },
		accesible: DESCONOCIDO,
		cambiador: DESCONOCIDO
	};
}

/** Un fix sirve solo si cumple la precisión exigida. */
export function fixAceptable(precision_m: number): boolean {
	return Number.isFinite(precision_m) && precision_m <= PRECISION_MAXIMA_M;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Motivos por los que todavía no se puede guardar. Vacío = se puede. */
export function problemas(b: Borrador): string[] {
	const p: string[] = [];
	if (!b.geom) p.push('Falta fijar la ubicación: tocá "Fijar ubicación acá".');
	else if (!fixAceptable(b.geom.precision_m)) p.push(`La ubicación tiene que tener precisión de ${PRECISION_MAXIMA_M} m o mejor.`);
	for (const [dia, etiqueta] of DIAS) {
		const h = b.horario[dia];
		if (typeof h === 'object' && (!HORA.test(h.abre) || !HORA.test(h.cierra))) {
			p.push(`Horario de ${etiqueta.toLowerCase()}: completá apertura y cierre, o elegí otra opción.`);
		}
	}
	return p;
}

/** Convierte un borrador completo en el registro que se guarda y se exporta. */
export function aRelevado(b: Borrador, ahora: Date = new Date()): BanioRelevado {
	const faltan = problemas(b);
	if (faltan.length) throw new Error(faltan.join(' '));
	const geom = b.geom as Geom;
	const nombre = b.nombre.trim();
	return {
		id: b.id,
		procedencia: 'gps_campo',
		relevado_en: ahora.toISOString(),
		geom: { ...geom, geom_procedencia: 'gps_campo' },
		nombre: nombre === '' ? null : nombre,
		categoria: b.categoria,
		atributos: {
			acceso: b.acceso,
			cobra: b.cobra,
			horario: structuredClone(b.horario),
			accesible: b.accesible,
			cambiador: b.cambiador
		}
	};
}

export function armarExportacion(banios: BanioRelevado[], ahora: Date = new Date()): Exportacion {
	const ordenados = [...banios].sort((a, b) => a.relevado_en.localeCompare(b.relevado_en));
	return {
		formato: 'cacapage-recorrida',
		version: 1,
		exportado_en: ahora.toISOString(),
		procedencia: 'gps_campo',
		cantidad: ordenados.length,
		banios: ordenados
	};
}

/** recorrida-YYYY-MM-DD.json con la fecha local del dispositivo. */
export function nombreArchivo(ahora: Date = new Date()): string {
	const dd = (n: number) => String(n).padStart(2, '0');
	return `recorrida-${ahora.getFullYear()}-${dd(ahora.getMonth() + 1)}-${dd(ahora.getDate())}.json`;
}
