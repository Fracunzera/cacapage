import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { abrirAlmacen } from './almacen';
import { aRelevado, nuevoBorrador } from './modelo';

const fix = { lat: -51.62, lon: -69.21, precision_m: 9, fix_en: '2026-10-25T12:00:00.000Z' };

describe('almacén del relevamiento', () => {
	it('el borrador sobrevive a cerrar y volver a abrir', async () => {
		const fabrica = new IDBFactory();
		const a = await abrirAlmacen(fabrica);
		const b = nuevoBorrador(new Date(), 'x');
		b.nombre = 'Terminal';
		b.cobra = 'si';
		await a.guardarBorrador(b);
		a.cerrar();

		const otra = await abrirAlmacen(fabrica);
		expect(await otra.leerBorrador()).toEqual(b);
	});

	it('confirmar guarda el baño y descarta el borrador', async () => {
		const a = await abrirAlmacen(new IDBFactory());
		const b = { ...nuevoBorrador(new Date(), 'y'), geom: fix };
		await a.guardarBorrador(b);
		await a.confirmar(aRelevado(b));
		expect(await a.leerBorrador()).toBeUndefined();
		const lista = await a.listar();
		expect(lista).toHaveLength(1);
		expect(lista[0].id).toBe('y');
	});

	it('lista lo más reciente primero y borra de a uno', async () => {
		const a = await abrirAlmacen(new IDBFactory());
		for (const [id, hora] of [
			['1', '10:00'],
			['2', '11:00'],
			['3', '09:00']
		]) {
			await a.confirmar(aRelevado({ ...nuevoBorrador(new Date(), id), geom: fix }, new Date(`2026-10-25T${hora}:00Z`)));
		}
		expect((await a.listar()).map((r) => r.id)).toEqual(['2', '1', '3']);
		await a.borrar('1');
		expect((await a.listar()).map((r) => r.id)).toEqual(['2', '3']);
	});
});
