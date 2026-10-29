// Registrar, historial cifrado y medallas, de punta a punta en Chromium:
// el historial se crea y vuelve solo con la sesión (custodia, P-40), 5
// registros (logro + medalla), un segundo celular, salir y volver, público y
// privado, y los historiales viejos creados con código.
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

async function entrar(p, alta = false, seudonimo = SEUDONIMO) {
	const r = await p.request.post(BASE + `/api/v1/auth/clave/${alta ? 'alta' : 'entrada'}`, {
		data: alta ? { seudonimo, clave: CLAVE, mayor_de_edad: true, acepta_terminos: true } : { seudonimo, clave: CLAVE }
	});
	if (!r.ok()) throw new Error(`entrar: ${r.status()} ${await r.text()}`);
}

async function registrar(p, tipo, { ubicacion = false, anecdota = '' } = {}) {
	await p.getByRole('button', { name: '💩 Registrar' }).click();
	await p.getByRole('radio', { name: tipo }).click();
	if (ubicacion) {
		await p.getByRole('button', { name: /Usar mi ubicación/ }).click();
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
	await a.getByRole('button', { name: '💩 Registrar' }).waitFor();
	ok(true, 'sin código: el historial se crea solo');
	const llaves = await sql`select metodo, octet_length(envuelta) n from boveda_llaves`;
	ok(llaves.length === 1 && llaves[0].metodo === 'servidor' && llaves[0].n === 60, 'la llave queda en custodia, sellada (no en claro)');
	ok((await fetch(BASE + '/api/v1/boveda/custodia')).status === 401, 'sin sesión no se puede pedir la llave');

	// Primer registro: con ubicación, sugiere la YPF a 20 m (de día) y da el logro.
	await a.getByRole('button', { name: '💩 Registrar' }).click();
	await a.getByRole('radio', { name: 'Baño público' }).click();
	await a.getByRole('button', { name: /Usar mi ubicación/ }).click();
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

	// Segundo celular: con solo entrar ve el historial, registra, y el primero lo ve.
	const b = await celular();
	await entrar(b);
	await b.goto(BASE + '/app');
	await b.getByRole('button', { name: '💩 Registrar' }).waitFor();
	await b.waitForFunction(() => document.querySelector('.numero strong')?.textContent === '4');
	ok(true, 'otro celular: con solo entrar ve las 4');
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
	await b.getByRole('button', { name: /Usar mi ubicación/ }).click();
	await b.getByText('Ubicación guardada').waitFor();
	await b.getByRole('radio', { name: 'Ninguno de estos' }).check();
	await b.getByLabel(/Sumarla al mapa público/).check();
	await b.getByRole('button', { name: 'Guardar' }).click();
	await b.getByRole('alertdialog').waitFor();
	const aviso = await b.getByRole('alertdialog').innerText();
	ok(aviso.includes('@trono_e2e') && /no se ve la hora/i.test(aviso), 'la advertencia dice qué se publica (seudónimo, lugar, día; sin hora)');
	await b.screenshot({ path: join(CAPTURAS, 'publico-aviso.png') });
	await b.getByRole('button', { name: 'Sí, hacerla pública' }).click();
	await b.getByRole('heading', { name: 'Tu caca es la N.º 1 del mapa público' }).waitFor();
	ok((await b.getByRole('dialog').innerText()).includes('¡La primera de todas!'), 'festejo: "tu caca es la N.º 1 del mapa público"');
	await b.screenshot({ path: join(CAPTURAS, 'publico-numero.png') });
	await b.getByRole('button', { name: '¡Grande!' }).click();
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
	await b.getByRole('heading', { name: 'Tu caca es la N.º 2 del mapa público' }).waitFor();
	await b.getByRole('button', { name: '¡Grande!' }).click();
	await b.locator('.historial li', { hasText: 'YPF Centro' }).getByText('pública N.º 2').waitFor();
	ok(true, 'la segunda es la N.º 2 y el historial lo muestra');
	const [enBanio] = await sql`select banio_id, lat from publicaciones where banio_id is not null`;
	ok(enBanio?.banio_id === 'n1' && enBanio.lat === null, 'en un baño se publica el baño, sin la posición del usuario');

	await sql`update publicaciones set visible_desde = now()`;
	api = await (await fetch(BASE + '/api/v1/publicaciones')).json();
	ok(api.publicaciones.length === 2 && api.publicaciones.every((p) => p.seudonimo === 'trono_e2e' && !('hora' in p)), 'el mapa público muestra las 2, con seudónimo y sin hora');
	const ypf = api.publicaciones.find((p) => p.banio_id === 'n1');
	ok(ypf?.banio_nombre === 'YPF Centro' && ypf.lat === -51.62, 'la del baño se ubica en el baño');
	ok(api.publicaciones.map((p) => p.numero).sort().join() === '1,2', 'el mapa público trae el número de cada una');
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
	// Volver a publicarla: número nuevo (los números no se reutilizan).
	await b.locator('.historial li', { hasText: 'YPF Centro' }).locator('button.fila').click();
	await b.getByRole('button', { name: '🌎 Hacerla pública' }).click();
	await b.getByRole('button', { name: 'Sí, hacerla pública' }).click();
	await b.getByRole('heading', { name: 'Tu caca es la N.º 3 del mapa público' }).waitFor();
	ok(true, 'despublicar y volver a publicar da un número nuevo; no se reutilizan');
	await b.getByRole('button', { name: '¡Grande!' }).click();
	await b.locator('.historial li', { hasText: 'YPF Centro' }).getByText('pública').waitFor();

	// Salir borra la copia local; al volver a entrar, el historial vuelve solo.
	await a.goto(BASE + '/app/cuenta');
	await a.getByRole('button', { name: 'Salir' }).click();
	await a.waitForURL(BASE + '/');
	const bases = await a.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
	ok(!bases.includes('dondecague-boveda'), 'al salir se borra el historial del celular');
	await entrar(a);
	await a.goto(BASE + '/app');
	const vuelve = await a
		.waitForFunction(() => document.querySelector('.numero strong')?.textContent === '5', null, { timeout: 10000 })
		.then(() => true, () => false);
	ok(vuelve, 'al volver a entrar, el historial vuelve solo (sin código)');

	// ---------- Historiales viejos, creados con código de recuperación ----------
	async function cuentaVieja(p, seudonimo) {
		await p.request.post(BASE + '/api/v1/auth/clave/alta', {
			data: { seudonimo, clave: CLAVE, mayor_de_edad: true, acepta_terminos: true }
		});
		const letras = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
		const crudo = Array.from(crypto.getRandomValues(new Uint8Array(26)), (x) => letras[x % 32]).join('');
		const codigo = crudo.match(/.{1,4}/g).join('-');
		const t = new TextEncoder();
		const sal = crypto.getRandomValues(new Uint8Array(16));
		const nonce = crypto.getRandomValues(new Uint8Array(12));
		const base = await crypto.subtle.importKey('raw', t.encode(codigo), 'PBKDF2', false, ['deriveKey']);
		const llave = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 1000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
		const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: t.encode('dondecague-boveda-v1') }, llave, crypto.getRandomValues(new Uint8Array(32))));
		const envuelta = Buffer.concat([nonce, c]).toString('base64url');
		const r = await p.request.put(BASE + '/api/v1/boveda/llaves', {
			data: { metodo: 'recuperacion', envuelta, parametros: { v: 1, kdf: 'PBKDF2-SHA256', it: 1000, sal: Buffer.from(sal).toString('base64url') }, crear: true }
		});
		if (!r.ok()) throw new Error('llave vieja: ' + r.status());
		return codigo;
	}
	const v = await celular();
	const codigoViejo = await cuentaVieja(v, 'viejo_e2e');
	await v.goto(BASE + '/app');
	await v.getByRole('heading', { name: 'Abrí tu historial' }).waitFor();
	await v.getByLabel('Código').fill('AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AA');
	await v.getByRole('button', { name: 'Abrir mi historial' }).click();
	await v.getByText('Ese código no es').waitFor();
	ok(true, 'historial viejo: con el código equivocado no abre');
	await v.getByLabel('Código').fill(codigoViejo.toLowerCase().replace(/-/g, ' '));
	await v.getByRole('button', { name: 'Abrir mi historial' }).click();
	await v.getByRole('button', { name: '💩 Registrar' }).waitFor();
	const metodos = (await sql`select metodo from boveda_llaves l join cuentas c on c.id = l.cuenta_id where c.seudonimo = 'viejo_e2e' order by metodo`).map((x) => x.metodo);
	ok(metodos.join() === 'recuperacion,servidor', 'historial viejo: el código se pide una última vez y la llave pasa a custodia');
	await v.request.post(BASE + '/api/v1/auth/salir', { data: {} });
	await v.goto(BASE + '/');
	await v.evaluate(() => new Promise((ok) => { const r = indexedDB.deleteDatabase('dondecague-boveda'); r.onsuccess = r.onerror = ok; }));
	await entrar(v, false, 'viejo_e2e');
	await v.goto(BASE + '/app');
	await v.getByRole('button', { name: '💩 Registrar' }).waitFor();
	ok(true, 'historial viejo: la vez siguiente abre solo');

	// Perdí el código: empezar de cero (borra también sus cacas públicas).
	const w = await celular();
	await cuentaVieja(w, 'perdido_e2e');
	await sql`insert into publicaciones (id, cuenta_id, tipo, lat, lon, dia, visible_desde)
		select gen_random_uuid(), id, 'naturaleza', -51.6, -69.2, current_date, now() from cuentas where seudonimo = 'perdido_e2e'`;
	await w.goto(BASE + '/app');
	await w.getByRole('button', { name: 'Perdí el código' }).click();
	await w.getByRole('button', { name: 'Borrar y empezar de cero' }).click();
	await w.getByRole('button', { name: '💩 Registrar' }).waitFor();
	const [restos] = await sql`select
		(select count(*) from publicaciones p join cuentas c on c.id = p.cuenta_id where c.seudonimo = 'perdido_e2e')::int pub,
		(select string_agg(metodo, ',') from boveda_llaves l join cuentas c on c.id = l.cuenta_id where c.seudonimo = 'perdido_e2e') llaves`;
	ok(restos.pub === 0 && restos.llaves === 'servidor', 'empezar de cero: borra el historial viejo y sus cacas públicas, y arranca uno nuevo');

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
