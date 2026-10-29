import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sumas } from './migraciones/sumas.json';

// Regla: una migración aplicada no se edita nunca (ya corrió en producción y no
// vuelve a correr). Un cambio de esquema va siempre en una migración nueva.
const carpeta = join(import.meta.dirname, 'migraciones');
const archivos = readdirSync(carpeta)
	.filter((f) => f.endsWith('.sql'))
	.sort();
const huella = (f: string) => createHash('sha256').update(readFileSync(join(carpeta, f))).digest('hex');

describe('migraciones', () => {
	it.each(Object.keys(sumas))('%s no cambió', (f) => {
		expect(huella(f), `${f} ya se aplicó en producción: no se edita. Hacé una migración nueva.`).toBe(
			sumas[f as keyof typeof sumas]
		);
	});

	it('toda migración tiene su huella anotada en sumas.json', () => {
		expect(archivos.filter((f) => !(f in sumas))).toEqual([]);
	});

	it('se numeran en orden, sin huecos ni repetidos', () => {
		expect(archivos.map((f) => Number(f.slice(0, 4)))).toEqual(archivos.map((_, i) => i + 1));
	});
});
