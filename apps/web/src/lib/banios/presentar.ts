import { NOMBRE_CATEGORIA, type Atributos, type Banio } from './tipos';

/** Vida útil por atributo, en meses (DESIGN.md §10.2). */
export const VIDA_MESES: Record<keyof Atributos | 'existencia', number> = {
	horario: 4,
	acceso: 6,
	cobra: 6,
	cambiador: 12,
	existencia: 12,
	accesible: 24,
	operador: 12,
	direccion: 120,
	localidad: 120
};

export type Frescura = 'vigente' | 'dudoso' | 'vencido';

/** DESIGN.md §10.3: vigente < T ≤ dudoso < 2T ≤ vencido. Sin fecha, vencido. */
export function frescura(modificado: string | null, meses: number, hoy = new Date()): Frescura {
	if (!modificado) return 'vencido';
	const d = new Date(modificado + 'T00:00:00Z');
	const transcurridos = (hoy.getUTCFullYear() - d.getUTCFullYear()) * 12 + hoy.getUTCMonth() - d.getUTCMonth();
	if (transcurridos < meses) return 'vigente';
	if (transcurridos < 2 * meses) return 'dudoso';
	return 'vencido';
}

const COMERCIOS = new Set(['comercio', 'shopping', 'estacion_servicio']);

export function titulo(b: Banio): string {
	return b.nombre ?? NOMBRE_CATEGORIA[b.categoria];
}

export interface Linea {
	clave: keyof Atributos;
	icono: string;
	texto: string;
	frescura: Frescura;
}

/**
 * Lo que dice la ficha. Un comercio nunca figura como "libre" aunque OSM lo
 * diga: sin adhesión a "Baño amigo" dice "consultá" (PRIVACY.md P-32).
 */
export function lineas(b: Banio, hoy = new Date()): Linea[] {
	const a = b.atributos;
	const f = (k: keyof Atributos) => frescura(b.modificado, VIDA_MESES[k], hoy);
	const out: Linea[] = [];
	const comercio = COMERCIOS.has(b.categoria);
	if (a.acceso === 'clientes' || (comercio && a.acceso === 'libre'))
		out.push({ clave: 'acceso', icono: '🧾', texto: 'Para clientes: consultá', frescura: f('acceso') });
	else if (a.acceso === 'libre') out.push({ clave: 'acceso', icono: '🚪', texto: 'Acceso libre', frescura: f('acceso') });
	if (a.cobra !== undefined)
		out.push({ clave: 'cobra', icono: '🪙', texto: a.cobra ? 'Cobra' : 'Gratis', frescura: f('cobra') });
	if (a.accesible !== undefined)
		out.push({
			clave: 'accesible',
			icono: '♿',
			texto: a.accesible === 'limitado' ? 'Accesible con limitaciones' : a.accesible ? 'Accesible' : 'No accesible',
			frescura: f('accesible')
		});
	if (a.cambiador !== undefined)
		out.push({
			clave: 'cambiador',
			icono: '🚼',
			texto: a.cambiador ? 'Tiene cambiador' : 'Sin cambiador',
			frescura: f('cambiador')
		});
	if (a.horario)
		out.push({
			clave: 'horario',
			icono: '🕒',
			texto: a.horario === '24/7' ? 'Abierto las 24 horas' : `Horario: ${a.horario}`,
			frescura: f('horario')
		});
	return out;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function mesAnio(iso: string): string {
	const d = new Date(iso + 'T00:00:00Z');
	return `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Ej.: "Dato de OpenStreetMap, de marzo 2019". */
export function procedencia(b: Banio): string {
	return b.modificado ? `Dato de OpenStreetMap, de ${mesAnio(b.modificado)}` : 'Dato de OpenStreetMap, sin fecha';
}

/** Para filtrar: un dato vencido nunca cuenta (DESIGN.md §10.3). */
export function cumple(b: Banio, filtro: 'gratis' | 'accesible' | 'cambiador', hoy = new Date()): boolean {
	const k = filtro === 'gratis' ? 'cobra' : filtro;
	const v = b.atributos[k];
	if (v === undefined || frescura(b.modificado, VIDA_MESES[k], hoy) === 'vencido') return false;
	return filtro === 'gratis' ? v === false : v === true;
}
