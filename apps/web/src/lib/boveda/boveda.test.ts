import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { Boveda } from './boveda';
import { generarSecreto } from './cripto';
import type { Registro } from './modelo';

/** Servidor en memoria con la misma regla de versiones que /api/v1/boveda. */
function servidor() {
	const paginas = new Map<string, { seq: number; version: number; nonce: string; cifrado: string }>();
	let seq = 0;
	const fetch = vi.fn(async (url: string, init?: RequestInit) => {
		const u = new URL(url, 'http://x');
		if (init?.method === 'PUT') {
			const id = u.pathname.split('/').pop()!;
			const c = JSON.parse(String(init.body));
			const v = paginas.get(id)?.version ?? 0;
			if (v !== c.version_esperada) return new Response(JSON.stringify({ message: 'conflicto', version: v }), { status: 409 });
			paginas.set(id, { seq: ++seq, version: v + 1, nonce: c.nonce, cifrado: c.cifrado });
			return Response.json({ version: v + 1, seq });
		}
		const desde = Number(u.searchParams.get('desde'));
		return Response.json({
			paginas: [...paginas].filter(([, p]) => p.seq > desde).map(([pagina_id, p]) => ({ pagina_id, ...p }))
		});
	});
	return { fetch, paginas };
}

const reg = (id: string, ocurrido_en = '2026-10-29T10:00:00-03:00'): Registro => ({
	id,
	ocurrido_en,
	tipo: 'casa',
	actualizado_en: new Date().toISOString()
});

afterEach(() => vi.unstubAllGlobals());

describe('Boveda', () => {
	it('dos celulares escriben a la vez y no se pierde nada', async () => {
		const s = servidor();
		vi.stubGlobal('fetch', s.fetch);
		const secreto = generarSecreto();
		const a = await Boveda.abrir('lu', new IDBFactory());
		const b = await Boveda.abrir('lu', new IDBFactory());
		await a.instalar(secreto);
		await b.instalar(secreto);

		const premios = await a.guardar(reg('1'));
		expect(premios.map((p) => p.tipo)).toEqual(['logro']);
		// b no bajó todavía: su página del mes tiene versión 0 y choca (409).
		await b.guardar(reg('2'));
		await a.sincronizar();
		expect(a.registros().map((r) => r.id).sort()).toEqual(['1', '2']);
		expect(b.registros().map((r) => r.id).sort()).toEqual(['1', '2']);
		expect(a.pendientes + b.pendientes).toBe(0);
		// El servidor no ve meses ni cantidades: 2 páginas (el mes y "general"), ids opacos.
		expect(s.paginas.size).toBe(2);
		for (const id of s.paginas.keys()) expect(id).not.toMatch(/2026|general/);
	});

	it('sin conexión guarda igual y sube después', async () => {
		const s = servidor();
		const b = await Boveda.abrir('lu', new IDBFactory());
		await b.instalar(generarSecreto());
		vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
		await b.guardar(reg('1'));
		expect(b.registros()).toHaveLength(1);
		expect(b.pendientes).toBeGreaterThan(0);
		vi.stubGlobal('fetch', s.fetch);
		expect(await b.sincronizar()).toBe(true);
		expect(b.pendientes).toBe(0);
	});

	it('borrar un registro lo saca en todos los celulares', async () => {
		const s = servidor();
		vi.stubGlobal('fetch', s.fetch);
		const secreto = generarSecreto();
		const a = await Boveda.abrir('lu', new IDBFactory());
		await a.instalar(secreto);
		await a.guardar(reg('1'));
		await a.borrar(a.registros()[0]);
		const b = await Boveda.abrir('lu', new IDBFactory());
		await b.instalar(secreto);
		await b.sincronizar();
		expect(b.registros()).toEqual([]);
		// El logro se conserva aunque se borre el registro (§17.2).
		expect(b.general().logros.map((l) => l.id)).toEqual(['primer-registro']);
	});

	it('si la copia local era de otra cuenta, se descarta', async () => {
		const f = new IDBFactory();
		const a = await Boveda.abrir('lu', f);
		await a.instalar(generarSecreto());
		a.cerrar();
		const otra = await Boveda.abrir('pepe', f);
		expect(otra.tieneLlaves).toBe(false);
	});
});
