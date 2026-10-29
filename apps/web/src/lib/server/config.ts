import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { ENTORNO, ES_PRUEBA } from './entorno';
import { OVERPASS_POR_DEFECTO } from './osm/servidores';

/**
 * Configuración del servidor (DESIGN.md §15.1). El dominio aparece solo en
 * ORIGEN_PUBLICO; todo lo demás se deriva de ahí. Si falta algo obligatorio, el
 * servidor no arranca.
 */
export interface Config {
	origen: string;
	/** RP ID de WebAuthn: el host de ORIGEN_PUBLICO. */
	rpId: string;
	rpNombre: string;
	databaseUrl: string;
	pimientaMail: string;
	mail: { modo: 'consola' } | { modo: 'desactivado' } | { modo: 'smtp'; url: string; remitente: string };
	passkeys: boolean;
	/** Importación semanal de baños desde OSM (solo lectura, ADR 0001). */
	osm: { importar: boolean; servidores: string[] };
	/** Carpeta con el mapa base (argentina.pmtiles). Ver docs/despliegue.md. */
	teselasDir: string;
}

function obligatoria(nombre: string): string {
	const v = env[nombre];
	if (!v) throw new Error(`Falta la variable de entorno ${nombre}`);
	return v;
}

function leer(): Config {
	const origen = obligatoria('ORIGEN_PUBLICO').replace(/\/+$/, '');
	const url = new URL(origen);
	const pimientaMail = obligatoria('PIMIENTA_MAIL');
	if (pimientaMail.length < 32) throw new Error('PIMIENTA_MAIL tiene que tener al menos 32 caracteres');

	const modo = env.MAIL_MODO ?? 'smtp';
	const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
	let mail: Config['mail'];
	if (modo === 'consola') {
		// Imprimir links de entrada en el log solo sirve para probar; en producción
		// sería dejar llaves de cuentas en un archivo.
		if (!ES_PRUEBA && !local) throw new Error('MAIL_MODO=consola solo se permite con ENTORNO=prueba o en localhost');
		mail = { modo: 'consola' };
	} else if (modo === 'desactivado') {
		// Para arrancar en producción sin proveedor de mail: solo passkeys.
		mail = { modo: 'desactivado' };
	} else if (modo === 'smtp') {
		mail = { modo: 'smtp', url: obligatoria('SMTP_URL'), remitente: `Dónde Cagué <no-responder@${url.hostname}>` };
	} else {
		throw new Error(`MAIL_MODO tiene que ser "smtp", "consola" o "desactivado" (recibido: ${JSON.stringify(modo)})`);
	}
	if (mail.modo === 'desactivado' && ENTORNO !== 'produccion')
		throw new Error('En el entorno de prueba no hay passkeys: hace falta MAIL_MODO=consola o smtp para poder entrar');

	const importar = env.OSM_IMPORTAR ?? 'si';
	if (importar !== 'si' && importar !== 'no') throw new Error('OSM_IMPORTAR tiene que ser "si" o "no"');
	const servidores = env.OVERPASS_URL ? env.OVERPASS_URL.split(',').map((u) => u.trim()).filter(Boolean) : OVERPASS_POR_DEFECTO;

	return {
		origen,
		rpId: url.hostname,
		rpNombre: 'Dónde Cagué',
		databaseUrl: obligatoria('DATABASE_URL'),
		pimientaMail,
		mail,
		// Las passkeys quedan atadas al dominio y no migran: en prueba no existen
		// y no hay variable para encenderlas (PRIVACY.md P-31).
		passkeys: ENTORNO === 'produccion',
		osm: { importar: importar === 'si', servidores },
		teselasDir: env.TESELAS_DIR || '/datos/teselas'
	};
}

let config: Config | null = null;
export function cfg(): Config {
	if (building) throw new Error('La configuración no existe durante el build');
	return (config ??= leer());
}
