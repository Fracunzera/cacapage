// Prueba de punta a punta del relevamiento contra el build real (node build),
// en un Chromium con GPS simulado. Uso: pnpm build && pnpm e2e
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as esperar } from 'node:timers/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PUERTO = 4173;
const BASE = `http://localhost:${PUERTO}`;
const RIO_GALLEGOS = { latitude: -51.6193, longitude: -69.2241 };

let fallas = 0;
function verificar(condicion, texto) {
	console.log(`${condicion ? 'ok  ' : 'FALLA'} ${texto}`);
	if (!condicion) fallas++;
}

async function levantar(env) {
	const proceso = spawn('node', ['build'], {
		env: { ...process.env, PORT: String(PUERTO), ORIGIN: BASE, ...env },
		stdio: ['ignore', 'pipe', 'pipe']
	});
	let salida = '';
	proceso.stdout.on('data', (d) => (salida += d));
	proceso.stderr.on('data', (d) => (salida += d));
	for (let i = 0; i < 50; i++) {
		try {
			await fetch(BASE + '/robots.txt');
			return { proceso, salida: () => salida };
		} catch {
			if (proceso.exitCode !== null) return { proceso, salida: () => salida };
			await esperar(100);
		}
	}
	throw new Error('El servidor no levantó:\n' + salida);
}

async function bajar(s) {
	s.proceso.kill();
	await new Promise((ok) => (s.proceso.exitCode !== null ? ok() : s.proceso.once('exit', ok)));
}

// 1. Sin ENTORNO el servidor no arranca.
{
	const env = { ...process.env };
	delete env.ENTORNO;
	const p = spawn('node', ['build'], { env: { ...env, PORT: String(PUERTO) }, stdio: ['ignore', 'pipe', 'pipe'] });
	let err = '';
	p.stderr.on('data', (d) => (err += d));
	const codigo = await new Promise((ok) => p.once('exit', ok));
	verificar(codigo !== 0 && err.includes('ENTORNO'), 'sin ENTORNO, el servidor se niega a arrancar');
}

// 2. Con ENTORNO=produccion, el relevamiento no existe.
{
	const s = await levantar({ ENTORNO: 'produccion' });
	const r = await fetch(BASE + '/app/relevamiento');
	verificar(r.status === 404, 'producción: /app/relevamiento da 404');
	const inicio = await fetch(BASE + '/');
	const html = await inicio.text();
	verificar(!inicio.headers.get('x-robots-tag'), 'producción: sin X-Robots-Tag');
	verificar(!html.includes('banner-prueba') && !html.includes('/app/relevamiento'), 'producción: sin banner ni link');
	await bajar(s);
}

// 3. Con ENTORNO=prueba, el flujo completo en un celular simulado.
const s = await levantar({ ENTORNO: 'prueba' });
const navegador = await chromium.launch();
const contexto = await navegador.newContext({
	viewport: { width: 390, height: 844 },
	isMobile: true,
	hasTouch: true,
	locale: 'es-AR',
	timezoneId: 'America/Argentina/Rio_Gallegos',
	permissions: ['geolocation'],
	geolocation: { ...RIO_GALLEGOS, accuracy: 60 },
	acceptDownloads: true
});
const pagina = await contexto.newPage();
const erroresConsola = [];
pagina.on('console', (m) => m.type() === 'error' && erroresConsola.push(m.text()));
pagina.on('pageerror', (e) => erroresConsola.push(String(e)));

try {
	const respuesta = await pagina.goto(BASE + '/app/relevamiento');
	verificar(respuesta.headers()['x-robots-tag'] === 'noindex, nofollow', 'prueba: cabecera X-Robots-Tag noindex');
	verificar(
		(await pagina.locator('meta[name=robots]').getAttribute('content')) === 'noindex, nofollow',
		'prueba: meta robots noindex'
	);
	verificar(await pagina.getByText('Entorno de prueba').isVisible(), 'prueba: banner visible');
	verificar((await (await fetch(BASE + '/robots.txt')).text()).includes('Allow: /'), 'robots.txt sin Disallow');

	await pagina.getByText('Ahora ±60 m').waitFor({ timeout: 10000 });
	verificar(await pagina.locator('button.fijar').isDisabled(), 'con ±60 m no deja fijar la ubicación');
	verificar(await pagina.getByRole('button', { name: 'Guardar baño' }).isDisabled(), 'con ±60 m no deja guardar');

	await contexto.setGeolocation({ ...RIO_GALLEGOS, accuracy: 12 });
	await pagina.getByRole('button', { name: /Fijar ubicación acá \(±12 m\)/ }).click({ timeout: 10000 });
	await pagina.getByText('Ubicación fijada · ±12 m').waitFor({ timeout: 10000 });
	verificar(true, 'con ±12 m deja fijar la ubicación');

	// Carga parcial y cierre del navegador a mitad de camino.
	await pagina.getByLabel('Nombre').fill('YPF Av. San Martín');
	await pagina.getByRole('radio', { name: 'Estación de servicio' }).click();
	await pagina.getByRole('radiogroup', { name: '¿Cobra?' }).getByRole('radio', { name: 'No', exact: true }).click();
	await pagina.getByRole('radiogroup', { name: 'Horario Lun a vie' }).getByRole('radio', { name: '24 h' }).click();
	await pagina.getByRole('radiogroup', { name: 'Horario Sábado' }).getByRole('radio', { name: 'Horario', exact: true }).click();
	verificar(await pagina.getByRole('button', { name: 'Guardar baño' }).isDisabled(), 'horario incompleto no deja guardar');
	const sabado = pagina.locator('.dia').nth(1);
	await sabado.getByLabel('Abre').fill('08:00');
	await sabado.getByLabel('Cierra').fill('22:00');
	await pagina.waitForTimeout(300);

	await pagina.evaluate(() => navigator.serviceWorker.ready);
	await pagina.close();
	const pagina2 = await contexto.newPage();
	pagina2.on('pageerror', (e) => erroresConsola.push(String(e)));
	await pagina2.goto(BASE + '/app/relevamiento');
	await pagina2.getByText('Ubicación fijada · ±12 m').waitFor({ timeout: 10000 });
	verificar((await pagina2.getByLabel('Nombre').inputValue()) === 'YPF Av. San Martín', 'después de cerrar: el nombre sigue');
	verificar(
		(await pagina2.getByRole('radio', { name: 'Estación de servicio' }).getAttribute('aria-checked')) === 'true',
		'después de cerrar: la categoría sigue'
	);
	verificar((await pagina2.locator('.dia').nth(1).getByLabel('Cierra').inputValue()) === '22:00', 'después de cerrar: el horario sigue');

	// Sin conexión: la página abre igual y guarda.
	await contexto.setOffline(true);
	const pagina3 = await contexto.newPage();
	pagina3.on('pageerror', (e) => erroresConsola.push(String(e)));
	await pagina2.close();
	await pagina3.goto(BASE + '/app/relevamiento');
	await pagina3.getByText('Sin conexión').waitFor({ timeout: 10000 });
	verificar(true, 'sin conexión: la página abre desde la caché');
	await pagina3.getByText('Ubicación fijada · ±12 m').waitFor({ timeout: 10000 });
	await pagina3.getByRole('button', { name: 'Guardar baño' }).click();
	await pagina3.getByText('Guardado. Llevás 1.').waitFor();
	verificar(true, 'sin conexión: guarda el primer baño');
	verificar((await pagina3.getByLabel('Nombre').inputValue()) === '', 'después de guardar, el formulario queda limpio');
	verificar(
		!(await pagina3.getByText('Ubicación fijada').isVisible()) &&
			(await pagina3.getByRole('button', { name: 'Guardar baño' }).isDisabled()),
		'el baño siguiente NO hereda la ubicación del anterior'
	);

	// Segundo baño: caminar, fijar en el lugar nuevo, todo desconocido.
	await contexto.setGeolocation({ latitude: -51.6337, longitude: -69.2119, accuracy: 25 });
	await pagina3.getByRole('button', { name: /Fijar ubicación acá \(±25 m\)/ }).click({ timeout: 10000 });
	await pagina3.getByText('Ubicación fijada · ±25 m').waitFor({ timeout: 10000 });
	await pagina3.getByRole('button', { name: 'Guardar baño' }).click();
	await pagina3.getByText('Guardado. Llevás 2.').waitFor();

	const [descarga] = await Promise.all([
		pagina3.waitForEvent('download'),
		pagina3.getByRole('button', { name: 'Descargar todo (2)' }).click()
	]);
	verificar(/^recorrida-\d{4}-\d{2}-\d{2}\.json$/.test(descarga.suggestedFilename()), `nombre del archivo: ${descarga.suggestedFilename()}`);
	const datos = JSON.parse(await readFile(await descarga.path(), 'utf8'));
	verificar(datos.cantidad === 2 && datos.banios.length === 2, 'el archivo tiene los 2 baños');
	verificar(datos.procedencia === 'gps_campo' && datos.banios.every((b) => b.procedencia === 'gps_campo' && b.geom.geom_procedencia === 'gps_campo'), 'todo con procedencia gps_campo');
	const ypf = datos.banios[0];
	verificar(
		ypf.nombre === 'YPF Av. San Martín' &&
			ypf.categoria === 'estacion_servicio' &&
			ypf.atributos.cobra === 'no' &&
			ypf.atributos.horario.habil === '24h' &&
			ypf.atributos.horario.sabado.abre === '08:00' &&
			ypf.atributos.horario.domingo_feriado === 'desconocido' &&
			ypf.atributos.accesible === 'desconocido' &&
			ypf.geom.precision_m === 12,
		'el primer baño tiene lo cargado'
	);
	const segundo = datos.banios[1];
	verificar(segundo.nombre === null && segundo.categoria === 'desconocido' && segundo.geom.precision_m === 25, 'el segundo baño quedó con todo desconocido');
	verificar(segundo.geom.lat === -51.6337 && ypf.geom.lat === RIO_GALLEGOS.latitude, 'cada baño tiene su propia ubicación');

	await pagina3.screenshot({ path: 'test-results/relevamiento.png', fullPage: false });
	verificar(erroresConsola.length === 0, `sin errores en consola${erroresConsola.length ? ': ' + erroresConsola.join(' | ') : ''}`);
} finally {
	await navegador.close();
	await bajar(s);
}

console.log(fallas ? `\n${fallas} falla(s)` : '\nTodo bien');
process.exit(fallas ? 1 : 0);
