import { describe, expect, it } from 'vitest';
import { cumple, frescura, lineas, procedencia, titulo } from './presentar';
import type { Banio } from './tipos';

const HOY = new Date('2026-10-29T12:00:00Z');
const base: Banio = {
	id: 'n1',
	categoria: 'banio',
	existencia: 'confirmado',
	nombre: null,
	marca: null,
	lat: -34.6,
	lon: -58.4,
	atributos: {},
	modificado: '2026-06-01'
};

describe('frescura', () => {
	it('vigente, dudoso y vencido según la vida útil', () => {
		expect(frescura('2026-06-01', 6, HOY)).toBe('vigente');
		expect(frescura('2026-01-15', 6, HOY)).toBe('dudoso');
		expect(frescura('2019-03-01', 6, HOY)).toBe('vencido');
		expect(frescura(null, 24, HOY)).toBe('vencido');
	});
});

describe('ficha', () => {
	it('un baño sin nombre se llama por su categoría', () => {
		expect(titulo(base)).toBe('Baño público');
	});

	it('un comercio nunca dice "libre" (P-32)', () => {
		const ypf: Banio = { ...base, categoria: 'estacion_servicio', atributos: { acceso: 'libre' } };
		expect(lineas(ypf, HOY)[0].texto).toBe('Para clientes: consultá');
		expect(lineas({ ...base, atributos: { acceso: 'libre' } }, HOY)[0].texto).toBe('Acceso libre');
	});

	it('el horario vence antes que la accesibilidad', () => {
		const l = lineas({ ...base, modificado: '2026-05-15', atributos: { horario: '24/7', accesible: true } }, HOY);
		expect(l.find((x) => x.clave === 'horario')?.frescura).toBe('dudoso');
		expect(l.find((x) => x.clave === 'accesible')?.frescura).toBe('vigente');
	});

	it('dice de dónde y de cuándo es el dato', () => {
		expect(procedencia(base)).toBe('Dato de OpenStreetMap, de junio 2026');
	});
});

describe('filtros', () => {
	it('un dato vencido no cuenta para "Gratis"', () => {
		expect(cumple({ ...base, atributos: { cobra: false } }, 'gratis', HOY)).toBe(true);
		expect(cumple({ ...base, modificado: '2020-01-01', atributos: { cobra: false } }, 'gratis', HOY)).toBe(false);
		expect(cumple({ ...base, atributos: { cobra: true } }, 'gratis', HOY)).toBe(false);
	});
});
