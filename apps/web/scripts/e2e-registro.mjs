// Registrar, historial cifrado y medallas, de punta a punta en Chromium:
// crear el historial, 5 registros (logro + medalla), salir, volver con el
// código, un segundo celular, y "empezar de cero".
// Uso: pnpm build && DATABASE_URL=postgres://… node scripts/e2e-registro.mjs
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { setTimeout as esperar } from 'node:timers/promises';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL_DB = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/dondecague_test';
const sql = postgres(URL_DB, { onnotice: () => {} });
await sql.unsafe('drop schema if exists osm cascade; drop schema public cascade; create schema public;');

const BASE = 'http://localhost:4180';
const CAPTURAS = process.env.E2E_CAPTURAS ?? tmpdir();
const app = spawn('node', ['build'], {
	env: {
		...process.env,
		ENTORNO: 'produccion',
		PORT: '4180',
		ORIGIN: BASE,
		ORIGEN_PUBLICO: BASE,
		DATABASE_URL: URL_DB,
		PIMIENTA_MAIL: 'x'.repeat(40),
		MAIL_MODO: 'desactivado',
		OSM_IMPORTAR: 'no'
	},
	stdio: ['ignore', 'pipe', 'pipe']
});
let log = '';
app.stdout.on('data', (d) => (log += d));
app.stderr.on('data', (d) => (log += d));
for (let i = 0; i < 50; i++) {
	try {
		await fetch(BASE + '/robots.txt');
		break;
	} catch {
		await esperar(200);
	}
}

// Un baño del catálogo a 20 m de donde va a estar el celular, para probar la sugerencia.
const [{ id: imp }] = await sql`insert into osm.importaciones (fuente, estado) values ('e2e', 'ok') returning id`;
await sql`insert into osm.candidatos (id, procedencia, objetos, categoria, existencia, nombre, lat, lon, importacion_id)
	values ('n1', 'osm', '{n1}', 'estacion_servicio', 'confirmado', 'YPF Centro', -51.6200, -69.2200, ${imp})`;

let fallas = 0;
const ok = (c, t) => {
	console.log(`${c ? 'ok  ' : 'FALLA'} ${t}`);
	if (!c) fallas++;
};

const SEUDONIMO = 'trono_e2e';
const CLAVE = 'una frase bastante larga';
const navegador = await chromium.launch();
const errores = [];

async function celular() {
	const contexto = await navegador.newContext({
		geolocation: { latitude: -51.62018, longitude: -69.2200 },
		permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
		viewport: { width: 390, height: 844 },
		acceptDownloads: true
	});
	const p = await contexto.newPage();
	// Sin mapa base en esta prueba: el chequeo de /tiles da 404 a propósito.
	p.on('console', (m) => m.type() === 'error' && !m.location().url.endsWith('/tiles/argentina.pmtiles') && errores.push(`${m.text()} (${m.location().url})`));
	p.on('pageerror', (e) => errores.push(String(e)));
	p.on('dialog', (d) => d.accept());
	return p;
}

async function entrar(p, alta = false) {
	const r = await p.request.post(BASE + `/api/v1/auth/clave/${alta ? 'alta' : 'entrada'}`, {
		data: alta ? { seudonimo: SEUDONIMO, clave: CLAVE, mayor_de_edad: true, acepta_terminos: true } : { seudonimo: SEUDONIMO, clave: CLAVE }
	});
	if (!r.ok()) throw new Error(`entrar: ${r.status()} ${await r.text()}`);
}

async function registrar(p, tipo, { ubicacion = false, anecdota = '' } = {}) {
	await p.getByRole('button', { name: '💩 Registrar' }).click();
	await p.getByRole('radio', { name: tipo }).click();
	if (ubicacion) {
		await p.getByRole('button', { name: /Agregar ubicación/ }).click();
		await p.getByText('Ubicación guardada').waitFor();
	}
	if (anecdota) await p.getByPlaceholder(/./).fill(anecdota);
	await p.getByRole('button', { name: 'Guardar' }).click();
}

const visitas = (p) => p.locator('.numero strong').innerText().then(Number);

try {
	const a = await celular();
	await entrar(a, true);
	await a.goto(BASE + '/app');
	await a.getByRole('heading', { name: 'Tu código de recuperación' }).waitFor();
	const codigo = await a.locator('.codigo').innerText();
	ok(/^([0-9A-Z]{4}-){6}[0-9A-Z]{2}$/.test(codigo), 'muestra un código de recuperación');
	ok(await a.getByRole('button', { name: 'Listo, empezar' }).isDisabled(), 'no deja seguir sin confirmar que lo guardó');
	await a.screenshot({ path: join(CAPTURAS, 'registro-codigo.png') });
	await a.getByLabel('Ya lo guardé en un lugar seguro').check();
	await a.getByRole('button', { name: 'Listo, empezar' }).click();
	await a.getByRole('button', { name: '💩 Registrar' }).waitFor();

	// Primer registro: con ubicación, sugiere la YPF a 20 m (de día) y da el logro.
	await a.getByRole('button', { name: '💩 Registrar' }).click();
	await a.getByRole('radio', { name: 'Baño público' }).click();
	await a.getByRole('button', { name: /Agregar ubicación/ }).click();
	await a.getByText('YPF Centro').waitFor();
	// De noche no hay preselección (P-29): se elige a mano.
	await a.getByRole('radio', { name: /YPF Centro/ }).check();
	await a.screenshot({ path: join(CAPTURAS, 'registro-form.png') });
	await a.getByPlaceholder(/./).fill('Viento de 90 km/h para llegar');
	await a.getByRole('button', { name: 'Guardar' }).click();
	await a.getByRole('heading', { name: 'Bautismo de Porcelana' }).waitFor();
	ok(true, 'primer registro: logro "Bautismo de Porcelana"');
	await a.screenshot({ path: join(CAPTURAS, 'registro-logro.png') });
	await a.getByRole('button', { name: '¡Grande!' }).click();
	ok((await a.locator('.historial').innerText()).includes('YPF Centro'), 'el historial muestra el baño elegido');

	for (let i = 2; i <= 5; i++) await registrar(a, i % 2 ? 'En casa' : 'En el laburo');
	await a.getByRole('heading', { name: 'Debut en el Trono' }).waitFor();
	ok(true, 'quinto registro: medalla "Debut en el Trono"');
	await a.getByRole('button', { name: '¡Grande!' }).click();
	ok((await visitas(a)) === 5, '5 visitas');
	await esperar(500);
	await a.screenshot({ path: join(CAPTURAS, 'registro-inicio.png'), fullPage: true });

	// Lo que ve el servidor: dos páginas opacas de 4 KB, sin nada legible.
	const paginas = await sql`select pagina_id, cifrado from boveda_paginas`;
	ok(paginas.length === 2, 'el servidor tiene 2 páginas (el mes y "general"), no 5 registros');
	ok(paginas.every((p) => (p.cifrado.length - 16) % 4096 === 0), 'páginas rellenadas a múltiplos de 4 KB');
	const crudo = Buffer.concat(paginas.map((p) => p.cifrado)).toString('latin1');
	ok(!/casa|YPF|Viento|2026/.test(crudo) && !paginas.some((p) => /2026|general/.test(p.pagina_id)), 'nada legible en el servidor');

	// Recargar: sigue todo.
	await a.reload();
	await a.getByRole('button', { name: '💩 Registrar' }).waitFor();
	ok((await visitas(a)) === 5, 'al recargar siguen las 5');

	// Borrar uno: la medalla se queda.
	await a.locator('.historial li button.fila').first().click();
	await a.getByRole('button', { name: 'Borrar' }).click();
	await a.waitForFunction(() => document.querySelector('.numero strong')?.textContent === '4');
	ok((await a.locator('.vitrina').innerText()).includes('Debut en el Trono'), 'borrar un registro no quita la medalla');

	// Exportar.
	const [descarga] = await Promise.all([a.waitForEvent('download'), a.getByRole('button', { name: 'Descargar mi historial' }).click()]);
	const exportado = JSON.parse(await readFile(await descarga.path(), 'utf8'));
	ok(exportado.registros.length === 4 && exportado.registros.some((r) => r.comentario === 'Viento de 90 km/h para llegar'), 'exportar trae los registros y la anécdota');

	// Segundo celular: abre con el código, registra, y el primero lo ve.
	const b = await celular();
	await entrar(b);
	await b.goto(BASE + '/app');
	await b.getByRole('heading', { name: 'Abrí tu historial' }).waitFor();
	await b.getByLabel('Código').fill('AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AA');
	await b.getByRole('button', { name: 'Abrir mi historial' }).click();
	await b.getByText('Ese código no es').waitFor();
	ok(true, 'código equivocado: no abre');
	await b.getByLabel('Código').fill(codigo.toLowerCase().replace(/-/g, ' '));
	await b.getByRole('button', { name: 'Abrir mi historial' }).click();
	await b.getByRole('button', { name: '💩 Registrar' }).waitFor();
	ok((await visitas(b)) === 4, 'otro celular con el código: ve las 4');
	await registrar(b, 'Al aire libre');
	await b.waitForFunction(() => document.querySelector('.numero strong')?.textContent === '5');
	await a.reload();
	await a.waitForFunction(() => document.querySelector('.numero strong')?.textContent === '5');
	ok(true, 'lo registrado en el segundo celular aparece en el primero');

	// ---------- Público / privado ----------
	// En casa no se ofrece hacerla pública.
	await b.getByRole('button', { name: '💩 Registrar' }).click();
	await b.getByRole('radio', { name: 'En casa' }).click();
	ok((await b.getByText('Sumarla al mapa público').count()) === 0, 'en casa no se ofrece hacerla pública');
	await b.getByRole('button', { name: 'Cancelar' }).click();
	// Al aire libre, con ubicación y pública: pide confirmación y dice qué se ve.
	await b.getByRole('button', { name: '💩 Registrar' }).click();
	await b.getByRole('radio', { name: 'Al aire libre' }).click();
	ok(await b.getByLabel(/Sumarla al mapa público/).isDisabled(), 'sin ubicación no se puede hacer pública');
	await b.getByRole('button', { name: /Agregar ubicación/ }).click();
	await b.getByText('Ubicación guardada').waitFor();
	await b.getByRole('radio', { name: 'Ninguno de estos' }).check();
	await b.getByLabel(/Sumarla al mapa público/).check();
	await b.getByRole('button', { name: 'Guardar' }).click();
	await b.getByRole('alertdialog').waitFor();
	const aviso = await b.getByRole('alertdialog').innerText();
	ok(aviso.includes('@trono_e2e') && /no se ve la hora/i.test(aviso), 'la advertencia dice qué se publica (seudónimo, lugar, día; sin hora)');
	await b.screenshot({ path: join(CAPTURAS, 'publico-aviso.png') });
	await b.getByRole('button', { name: 'Sí, hacerla pública' }).click();
	await b.waitForFunction(() => document.querySelector('.numero strong')?.textContent === '6', null, { timeout: 10000 }).catch(async () => {
		await b.screenshot({ path: join(CAPTURAS, 'publico-falla.png') });
		throw new Error('no llegó a 6: ' + (await b.locator('main').innerText()).slice(0, 600));
	});
	let [pub] = await sql`select tipo, banio_id, lat, lon, dia, visible_desde > now() + interval '1 hour' as demorada from publicaciones`;
	ok(pub?.tipo === 'naturaleza' && pub.lat === -51.6202 && pub.lon === -69.22 && pub.demorada, 'se publica el punto redondeado, demorado unas horas');
	ok((await sql`select 1 from publicaciones`).length === 1, 'solo la que se eligió hacer pública');
	let api = await (await fetch(BASE + '/api/v1/publicaciones')).json();
	ok(api.publicaciones.length === 0, 'antes de la demora no aparece en el mapa público');

	// Una del historial (en la YPF) también pública: se publica el baño, no la posición.
	await b.locator('.historial li', { hasText: 'YPF Centro' }).locator('button.fila').click();
	await b.getByRole('button', { name: '🌎 Hacerla pública' }).click();
	await b.getByRole('button', { name: 'Sí, hacerla pública' }).click();
	await b.locator('.historial li', { hasText: 'YPF Centro' }).getByText('pública').waitFor();
	const [enBanio] = await sql`select banio_id, lat from publicaciones where banio_id is not null`;
	ok(enBanio?.banio_id === 'n1' && enBanio.lat === null, 'en un baño se publica el baño, sin la posición del usuario');

	await sql`update publicaciones set visible_desde = now()`;
	api = await (await fetch(BASE + '/api/v1/publicaciones')).json();
	ok(api.publicaciones.length === 2 && api.publicaciones.every((p) => p.seudonimo === 'trono_e2e' && !('hora' in p)), 'el mapa público muestra las 2, con seudónimo y sin hora');
	const ypf = api.publicaciones.find((p) => p.banio_id === 'n1');
	ok(ypf?.banio_nombre === 'YPF Centro' && ypf.lat === -51.62, 'la del baño se ubica en el baño');
	const casa = await b.request.put(BASE + '/api/v1/publicaciones/00000000-0000-4000-8000-000000000000', { data: { tipo: 'casa', dia: '2026-10-01', lat: -51.6, lon: -69.2 } });
	ok(casa.status() === 400, 'el servidor rechaza publicar algo de casa');

	const c = await celular();
	await c.goto(BASE + '/cacas');
	await c.getByText('2 cacas públicas').waitFor();
	ok(true, 'el mapa de cacas carga sin cuenta');
	await esperar(2500);
	await c.screenshot({ path: join(CAPTURAS, 'publico-cacas.png') });
	await b.goto(BASE + '/app/mapa');
	const enMiMapa = await b
		.waitForFunction(() => document.querySelector('.u-pie-mapa strong')?.textContent === '2', null, { timeout: 10000 })
		.then(() => true, () => false);
	ok(enMiMapa, 'Mi mapa muestra las cacas con ubicación');
	await esperar(2500);
	await b.screenshot({ path: join(CAPTURAS, 'publico-mi-mapa.png') });

	// Hacerla privada la saca en el acto; borrar una pública también.
	await b.goto(BASE + '/app');
	await b.locator('.historial li', { hasText: 'YPF Centro' }).locator('button.fila').click();
	await b.getByRole('button', { name: '🔒 Hacerla privada' }).click();
	await b.getByRole('button', { name: '🌎 Hacerla pública' }).waitFor();
	ok((await sql`select 1 from publicaciones where banio_id = 'n1'`).length === 0, 'hacerla privada la borra del servidor');
	await b.locator('.historial li', { hasText: 'Al aire libre' }).first().locator('button.fila').click();
	await b.getByRole('button', { name: 'Borrar' }).click();
	await b.waitForFunction(() => document.querySelector('.numero strong')?.textContent === '5');
	ok((await sql`select 1 from publicaciones`).length === 0, 'borrar una caca pública la saca del mapa');
	// Dejar una pública para probar "empezar de cero".
	await b.locator('.historial li', { hasText: 'YPF Centro' }).locator('button.fila').click();
	await b.getByRole('button', { name: '🌎 Hacerla pública' }).click();
	await b.getByRole('button', { name: 'Sí, hacerla pública' }).click();
	await b.locator('.historial li', { hasText: 'YPF Centro' }).getByText('pública').waitFor();

	// Salir borra la copia local; al volver, pide el código.
	await a.goto(BASE + '/app/cuenta');
	await a.getByRole('button', { name: 'Salir' }).click();
	await a.waitForURL(BASE + '/');
	const bases = await a.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
	ok(!bases.includes('dondecague-boveda'), 'al salir se borra el historial del celular');
	await entrar(a);
	await a.goto(BASE + '/app');
	await a.getByRole('heading', { name: 'Abrí tu historial' }).waitFor();
	ok(true, 'al volver a entrar pide el código');

	// Perdí el código: empezar de cero.
	await a.getByRole('button', { name: 'Perdí el código' }).click();
	await a.getByRole('button', { name: 'Borrar y empezar de cero' }).click();
	await a.getByRole('heading', { name: 'Tu código de recuperación' }).waitFor();
	const [{ n }] = await sql`select count(*)::int n from boveda_paginas`;
	ok(n === 0, 'empezar de cero borra el historial del servidor');
	ok((await sql`select 1 from publicaciones`).length === 0, 'y también sus cacas públicas');

	ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
} catch (e) {
	fallas++;
	console.log('FALLA', e);
} finally {
	await navegador.close();
	app.kill();
	await sql.end();
}
if (fallas) console.log(log);
console.log(fallas ? `${fallas} falla(s)` : 'Todo bien');
process.exit(fallas ? 1 : 0);
