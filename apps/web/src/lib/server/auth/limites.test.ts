import { describe, expect, it } from 'vitest';
import { acierto, espera, fallo } from './limites';

const REGLA = { libres: 5, baseMs: 2000, topeMs: 15 * 60_000 };

describe('demora creciente', () => {
	it('los primeros fallos no esperan; después se duplica', () => {
		const t = 1_000_000;
		for (let i = 0; i < 5; i++) fallo('a', REGLA, t);
		expect(espera('a', t)).toBe(0);
		fallo('a', REGLA, t);
		expect(espera('a', t)).toBe(2000);
		fallo('a', REGLA, t);
		expect(espera('a', t)).toBe(4000);
		fallo('a', REGLA, t);
		expect(espera('a', t)).toBe(8000);
		expect(espera('a', t + 8000)).toBe(0);
	});

	it('tiene tope: nunca un bloqueo largo', () => {
		for (let i = 0; i < 100; i++) fallo('b', REGLA, 0);
		expect(espera('b', 0)).toBe(15 * 60_000);
	});

	it('un acierto la borra y un día sin fallos la olvida', () => {
		for (let i = 0; i < 8; i++) fallo('c', REGLA, 0);
		acierto('c');
		expect(espera('c', 0)).toBe(0);
		for (let i = 0; i < 8; i++) fallo('d', REGLA, 0);
		expect(espera('d', 24 * 3600_000 + 1)).toBe(0);
	});
});
