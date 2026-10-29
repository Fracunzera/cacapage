import { describe, expect, it } from 'vitest';
import {
	BLOQUE,
	cifrarPagina,
	codigoCompleto,
	derivarLlaves,
	descifrarPagina,
	deB64,
	desenvolver,
	envolver,
	generarCodigo,
	generarSecreto,
	idPagina,
	normalizarCodigo
} from './cripto';

describe('código de recuperación', () => {
	it('tiene 26 caracteres en grupos de 4 y se normaliza', () => {
		const c = generarCodigo();
		expect(c).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){6}[0-9A-HJKMNP-TV-Z]{2}$/);
		expect(codigoCompleto(c)).toBe(true);
		expect(normalizarCodigo(c.toLowerCase().replace(/-/g, ' '))).toBe(c);
		expect(normalizarCodigo('o1l-i')).toBe('0111');
	});

	it('envuelve y desenvuelve; con otro código, null', async () => {
		const secreto = generarSecreto();
		const codigo = generarCodigo();
		const e = await envolver(secreto, codigo, 1000);
		expect(e.envuelta.length).toBeGreaterThanOrEqual(40);
		expect(await desenvolver(e, codigo.toLowerCase())).toEqual(secreto);
		expect(await desenvolver(e, generarCodigo())).toBeNull();
	});
});

describe('páginas', () => {
	it('cifra, rellena a 4 KB y descifra', async () => {
		const llaves = await derivarLlaves(generarSecreto());
		const corta = await cifrarPagina(llaves, { a: 1 });
		const larga = await cifrarPagina(llaves, { a: 'x'.repeat(3000) });
		// Mismo tamaño cifrado: el largo del contenido no se nota (P-04).
		expect(deB64(corta.cifrado).length).toBe(deB64(larga.cifrado).length);
		expect(deB64(corta.cifrado).length).toBe(BLOQUE + 16);
		expect(await descifrarPagina(llaves, larga.nonce, larga.cifrado)).toEqual({ a: 'x'.repeat(3000) });
	});

	it('el id de página es opaco, estable y distinto por cuenta', async () => {
		const a = await derivarLlaves(generarSecreto());
		const b = await derivarLlaves(generarSecreto());
		const id = await idPagina(a, '2026-10');
		expect(id).toMatch(/^[A-Za-z0-9_-]{24}$/);
		expect(await idPagina(a, '2026-10')).toBe(id);
		expect(await idPagina(b, '2026-10')).not.toBe(id);
	});

	it('con otra llave no se descifra', async () => {
		const a = await derivarLlaves(generarSecreto());
		const b = await derivarLlaves(generarSecreto());
		const p = await cifrarPagina(a, { x: 1 });
		await expect(descifrarPagina(b, p.nonce, p.cifrado)).rejects.toThrow();
	});
});
