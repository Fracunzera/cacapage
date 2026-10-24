import { building } from '$app/environment';
import { env } from '$env/dynamic/private';

export type Entorno = 'prueba' | 'produccion';

/**
 * ENTORNO decide qué existe en cada despliegue (DESIGN.md §15). Si falta o no es
 * un valor conocido, el servidor no arranca: adivinar acá es peor que fallar.
 */
function leerEntorno(): Entorno {
	const valor = env.ENTORNO;
	if (valor === 'prueba' || valor === 'produccion') return valor;
	throw new Error(`ENTORNO tiene que ser "prueba" o "produccion" (recibido: ${JSON.stringify(valor)})`);
}

// Durante el build no hay entorno todavía (y no se prerenderiza nada que dependa
// de él): se valida al arrancar el servidor.
export const ENTORNO: Entorno = building ? 'produccion' : leerEntorno();
export const ES_PRUEBA = ENTORNO === 'prueba';
