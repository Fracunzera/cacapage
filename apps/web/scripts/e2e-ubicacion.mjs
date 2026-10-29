// Cargar la ubicación a mano, sin GPS: coordenadas, link de un mapa y
// dirección (con un Nominatim falso). Uso: pnpm build && node scripts/e2e-ubicacion.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { setTimeout as esperar } from 'node:timers/promises';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL_DB = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/dondecague_test';
const sql = postgres(URL_DB, { onnotice: () => {} });
await sql.unsafe('drop schema if exists osm cascade; drop schema public cascade; create schema public;');

// Nominatim falso.
const pedidos = [];
const nominatim = createServer((req, res) => {
	const u = new URL(req.url, 'http://x');
	pedidos.push({ q: u.searchParams.get('q'), pais: u.searchParams.get('countrycodes'), ua: req.headers['user-agent'] });
	const hay = /zapiola/i.test(u.searchParams.get('q') ?? '');
	res.writeHead(200, { 'content-type': 'application/json' }).end(
		JSON.stringify(hay ? [{ display_name: 'Zapiola 50, Río Gallegos, Santa Cruz, Z9400, Argentina', lat: '-51.6202', lon: '-69.2201' }] : [])
	);
}).listen(4187);

const BASE = 'http://localhost:4186';
const app = spawn('node', ['build'], {
	env: {
		...process.env,
		ENTORNO: 'produccion',
		PORT: '4186',
		ORIGIN: BASE,
		ORIGEN_PUBLICO: BASE,
		DATABASE_URL: URL_DB,
		PIMIENTA_MAIL: 'x'.repeat(40),
		MAIL_MODO: 'desactivado',
		OSM_IMPORTAR: 'no',
		NOMINATIM_URL: 'http://localhost:4187/search'
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
const [{ id: imp }] = await sql`insert into osm.importaciones (fuente, estado) values ('e2e', 'ok') returning id`;
await sql`insert into osm.candidatos (id, procedencia, objetos, categoria, existencia, nombre, lat, lon, importacion_id)
	values ('n1', 'osm', '{n1}', 'estacion_servicio', 'confirmado', 'YPF Centro', -51.6200, -69.2200, ${imp})`;

let fallas = 0;
const ok = (c, t) => {
	console.log(`${c ? 'ok  ' : 'FALLA'} ${t}`);
	if (!c) fallas++;
};

const navegador = await chromium.launch();
try {
	ok((await fetch(BASE + '/api/v1/ubicacion/buscar?q=Zapiola')).status === 401, 'buscar direcciones pide sesión');
	const corto = await fetch(BASE + '/api/v1/ubicacion/corto', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ url: 'https://maps.app.goo.gl/x' })
	});
	ok(corto.status === 401, 'seguir links cortos pide sesión');

	// Un celular SIN permiso de ubicación: justo el caso de quien no quiere compartirla.
	const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
	const p = await contexto.newPage();
	const errores = [];
	p.on('console', (m) => m.type() === 'error' && !m.location().url.endsWith('/tiles/argentina.pmtiles') && errores.push(m.text()));
	await p.request.post(BASE + '/api/v1/auth/clave/alta', {
		data: { seudonimo: 'sin_gps', clave: 'una frase bastante larga', mayor_de_edad: true, acepta_terminos: true }
	});
	await p.goto(BASE + '/app');
	await p.getByRole('button', { name: '💩 Registrar' }).click();
	await p.getByRole('radio', { name: 'En la ruta' }).click();
	await p.getByRole('button', { name: /Usar mi ubicación/ }).click();
	await p.getByText('Podés escribir la dirección').waitFor();
	ok(true, 'sin permiso de GPS: sugiere escribirla');

	const campo = () => p.getByLabel('Dirección, coordenadas o link de un mapa');
	await p.getByRole('button', { name: /Escribirla/ }).click();

	// Coordenadas mal escritas.
	await campo().fill('-151.6, -69.2');
	await p.getByRole('button', { name: 'Buscar' }).click();
	await p.getByText('Esas coordenadas no se entienden').waitFor();
	ok(pedidos.length === 0, 'coordenadas inválidas: avisa y no busca como dirección');

	// Coordenadas.
	await campo().fill('-51.6201, -69.2203');
	await p.getByRole('button', { name: 'Buscar' }).click();
	await p.getByText('Ubicación cargada por coordenadas').waitFor();
	await p.getByText('YPF Centro').waitFor();
	ok(true, 'por coordenadas: aparecen los baños cercanos');
	ok(pedidos.length === 0, 'las coordenadas no salen del celular');

	// Link de Google Maps.
	await p.getByRole('button', { name: 'Cambiar' }).click();
	await campo().fill('https://www.google.com/maps/place/YPF/@-51.62,-69.22,17z/data=!4m6!3m5!8m2!3d-51.6201!4d-69.2201');
	await p.getByRole('button', { name: 'Buscar' }).click();
	await p.getByText('Ubicación cargada desde un link').waitFor();
	ok(pedidos.length === 0, 'un link largo se lee en el celular, sin el servidor');

	// Dirección: no encontrada y encontrada.
	await p.getByRole('button', { name: 'Cambiar' }).click();
	await campo().fill('Calle Que No Existe 123');
	await p.getByRole('button', { name: 'Buscar' }).click();
	await p.getByText('No encontramos esa dirección').waitFor();
	await campo().fill('Zapiola 50, Río Gallegos');
	await p.getByRole('button', { name: 'Buscar' }).click();
	await p.getByRole('button', { name: /Zapiola 50, Río Gallegos/ }).click();
	await p.getByText('Ubicación cargada en Zapiola 50').waitFor();
	ok(pedidos.at(-1).pais === 'ar' && /DondeCague/.test(pedidos.at(-1).ua), 'dirección: se busca en Nominatim, solo Argentina, identificándonos');
	ok(!log.includes('Zapiola') && !log.includes('Que No Existe'), 'lo buscado no queda en el log del servidor');
	await p.screenshot({ path: (process.env.E2E_CAPTURAS ?? '/tmp') + '/ubicacion-a-mano.png' });

	await p.getByRole('button', { name: 'Guardar' }).click();
	await p.locator('.historial li button.fila').first().waitFor();
	await p.getByRole('button', { name: '¡Grande!' }).click();
	await p.locator('.historial li button.fila').first().click();
	ok(await p.getByText('Ubicación cargada a mano').isVisible(), 'el registro queda con la ubicación cargada a mano');
	ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
} catch (e) {
	fallas++;
	console.log('FALLA', e);
} finally {
	await navegador.close();
	app.kill();
	nominatim.close();
	await sql.end();
}
if (fallas) console.log(log);
console.log(fallas ? `${fallas} falla(s)` : 'Todo bien');
process.exit(fallas ? 1 : 0);
