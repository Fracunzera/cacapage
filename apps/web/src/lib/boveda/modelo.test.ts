import { describe, expect, it } from 'vitest';
import { evaluarPremios, faltanParaLaProxima, generalVacia, mezclar, nombreMedalla, type PaginaMes, type Registro } from './modelo';

const reg = (id: string, actualizado_en: string, extra: Partial<Registro> = {}): Registro => ({
	id,
	ocurrido_en: '2026-10-29T10:00:00-03:00',
	tipo: 'casa',
	actualizado_en,
	...extra
});
const mes = (registros: Registro[]): PaginaMes => ({ v: 1, tipo: 'mes', mes: '2026-10', registros });

describe('mezclar', () => {
	it('junta registros de dos dispositivos y gana el cambio más nuevo', () => {
		const a = mes([reg('1', '2026-10-29T10:00:00Z'), reg('2', '2026-10-29T10:00:00Z', { comentario: 'viejo' })]);
		const b = mes([reg('2', '2026-10-29T11:00:00Z', { comentario: 'nuevo' }), reg('3', '2026-10-29T11:00:00Z')]);
		const m = mezclar(a, b);
		expect(m.registros.map((r) => r.id).sort()).toEqual(['1', '2', '3']);
		expect(m.registros.find((r) => r.id === '2')?.comentario).toBe('nuevo');
	});

	it('un borrado gana el empate', () => {
		const m = mezclar(mes([reg('1', 't')]), mes([reg('1', 't', { borrado: true })]));
		expect(m.registros[0].borrado).toBe(true);
	});

	it('las medallas se suman y queda la fecha más vieja', () => {
		const m = mezclar(
			{ ...generalVacia(), medallas: [{ numero: 1, obtenida_en: '2026-10-02' }] },
			{ ...generalVacia(), medallas: [{ numero: 1, obtenida_en: '2026-10-01' }, { numero: 2, obtenida_en: '2026-10-05' }] }
		);
		expect(m.medallas).toEqual([
			{ numero: 1, obtenida_en: '2026-10-01' },
			{ numero: 2, obtenida_en: '2026-10-05' }
		]);
	});
});

describe('premios', () => {
	it('el primer registro da "Bautismo de Porcelana"', () => {
		const r = evaluarPremios(generalVacia(), 1, 'hoy');
		expect(r.novedades).toEqual([expect.objectContaining({ tipo: 'logro', nombre: 'Bautismo de Porcelana' })]);
		expect(evaluarPremios(r.general, 2, 'hoy').novedades).toEqual([]);
	});

	it('una medalla cada 5 y se conserva al borrar', () => {
		const g = evaluarPremios(generalVacia(), 4, 'a').general;
		const cinco = evaluarPremios(g, 5, 'b');
		expect(cinco.novedades).toEqual([{ tipo: 'medalla', numero: 1, nombre: 'Debut en el Trono' }]);
		expect(evaluarPremios(cinco.general, 4, 'c').general.medallas).toHaveLength(1);
		expect(evaluarPremios(cinco.general, 5, 'c').novedades).toEqual([]);
	});

	it('si se ganan varias juntas, se anuncia la última', () => {
		const r = evaluarPremios({ ...generalVacia(), logros: [{ id: 'primer-registro', obtenido_en: 'x' }] }, 12, 'hoy');
		expect(r.general.medallas.map((m) => m.numero)).toEqual([1, 2]);
		expect(r.novedades).toEqual([{ tipo: 'medalla', numero: 2, nombre: 'Aprendizaje de Plomería' }]);
	});

	it('nombres después de 200 y especiales', () => {
		expect(nombreMedalla(40)).toBe('Trono de Oro');
		expect(nombreMedalla(41)).toBe('Inmortalidad Sanitaria, nivel 1');
		expect(nombreMedalla(60)).toBe('Trono de Platino');
		expect(faltanParaLaProxima(7)).toBe(3);
		expect(faltanParaLaProxima(10)).toBe(5);
	});
});
