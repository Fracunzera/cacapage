import { describe, expect, it } from 'vitest';
import { aCandidato, normalizar, type ElementoOsm } from './normalizar';
import rg from './rio-gallegos.fixture.json';

const nodo = (id: number, tags: Record<string, string>, lat = -51.62, lon = -69.22): ElementoOsm => ({
	type: 'node',
	id,
	lat,
	lon,
	tags
});

describe('aCandidato', () => {
	it('un amenity=toilets es un baño confirmado', () => {
		const c = aCandidato(nodo(1, { amenity: 'toilets', fee: 'no', wheelchair: 'limited', access: 'yes' }))!;
		expect(c).toMatchObject({ id: 'n1', categoria: 'banio', existencia: 'confirmado', nombre: null });
		expect(c.atributos).toEqual({ acceso: 'libre', cobra: false, accesible: 'limitado' });
	});

	it('descarta lo privado, lo cerrado y los lugares con toilets=no', () => {
		expect(aCandidato(nodo(1, { amenity: 'toilets', access: 'private' }))).toBeNull();
		expect(aCandidato(nodo(2, { amenity: 'toilets', 'disused:shop': 'yes' }))).toBeNull();
		expect(aCandidato(nodo(3, { amenity: 'fuel', toilets: 'no' }))).toBeNull();
		expect(aCandidato(nodo(4, { amenity: 'fuel', 'toilets:access': 'no' }))).toBeNull();
		expect(aCandidato({ type: 'way', id: 5, tags: { amenity: 'toilets' } })).toBeNull();
	});

	it('una estación de servicio sin dato es probable; con toilets=yes, confirmada', () => {
		expect(aCandidato(nodo(1, { amenity: 'fuel', brand: 'YPF' }))).toMatchObject({
			categoria: 'estacion_servicio',
			existencia: 'probable',
			nombre: 'YPF'
		});
		expect(aCandidato(nodo(2, { amenity: 'fuel', toilets: 'yes' }))?.existencia).toBe('confirmado');
	});

	it('en un lugar, los atributos salen de toilets:* y no del lugar', () => {
		const c = aCandidato(
			nodo(1, { amenity: 'fuel', toilets: 'yes', wheelchair: 'yes', 'toilets:wheelchair': 'no', 'toilets:access': 'customers' })
		)!;
		expect(c.atributos).toEqual({ acceso: 'clientes', accesible: false });
	});

	it('un comercio solo entra si dice que tiene baño', () => {
		expect(aCandidato(nodo(1, { amenity: 'restaurant' }))).toBeNull();
		expect(aCandidato(nodo(2, { amenity: 'cafe', toilets: 'yes' }))?.categoria).toBe('comercio');
		expect(aCandidato(nodo(3, { leisure: 'park', toilets: 'yes' }))?.categoria).toBe('otro');
	});

	it('usa el centro de un way y la fecha más nueva', () => {
		const c = aCandidato({
			type: 'way',
			id: 9,
			center: { lat: -34.6, lon: -58.4 },
			timestamp: '2019-05-01T10:00:00Z',
			tags: { amenity: 'toilets', check_date: '2025-02-03' }
		})!;
		expect(c).toMatchObject({ id: 'w9', lat: -34.6, lon: -58.4, modificado: '2025-02-03' });
	});
});

describe('normalizar', () => {
	it('fusiona un baño con el lugar a menos de 50 m y deja suelto el que está lejos', () => {
		const r = normalizar([
			nodo(10, { amenity: 'fuel', name: 'YPF Centro', opening_hours: '24/7' }, -51.62, -69.22),
			nodo(11, { amenity: 'toilets', fee: 'yes' }, -51.6202, -69.22), // ~22 m
			nodo(12, { amenity: 'toilets' }, -51.63, -69.22) // ~1 km
		]);
		expect(r).toHaveLength(2);
		const ypf = r.find((b) => b.id === 'n10')!;
		expect(ypf).toMatchObject({
			existencia: 'confirmado',
			nombre: 'YPF Centro',
			objetos: ['n10', 'n11'],
			lat: -51.6202,
			atributos: { cobra: true, horario: '24/7' }
		});
		expect(r.find((b) => b.id === 'n12')?.objetos).toEqual(['n12']);
	});

	it('no repite objetos que Overpass devuelve dos veces', () => {
		const e = nodo(1, { amenity: 'toilets', toilets: 'yes' });
		expect(normalizar([e, e])).toHaveLength(1);
	});

	it('Río Gallegos: los 5 baños de OSM quedan fusionados con su lugar (SEEDING.md)', () => {
		const r = normalizar(rg.elements as unknown as ElementoOsm[]);
		const confirmados = r.filter((b) => b.existencia === 'confirmado');
		expect(confirmados.length).toBeGreaterThanOrEqual(5);
		// Ninguno de los cinco quedó como baño suelto.
		expect(r.filter((b) => b.categoria === 'banio')).toHaveLength(0);
		for (const b of r) expect(b.lat).toBeLessThan(-51.5);
	});
});
