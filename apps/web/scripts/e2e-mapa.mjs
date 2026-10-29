// Capa de baños de punta a punta: importación desde un Overpass falso con los
// datos de Río Gallegos, API del catálogo, teselas por rango y el mapa en Chromium.
// Uso: pnpm build && DATABASE_URL=postgres://… [E2E_PMTILES=rg.pmtiles] node scripts/e2e-mapa.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { setTimeout as esperar } from 'node:timers/promises';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL_DB = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/dondecague_test';
const sql = postgres(URL_DB, { onnotice: () => {} });
await sql.unsafe('drop schema if exists osm cascade; drop schema public cascade; create schema public;');

// Overpass falso: el primer servidor falla (prueba el respaldo), el segundo responde.
// E2E_OVERPASS_JSON: una respuesta real de Overpass (p. ej. toda la Argentina) en vez de Río Gallegos.
const fixture = JSON.parse(
	await readFile(process.env.E2E_OVERPASS_JSON ?? new URL('../src/lib/server/osm/rio-gallegos.fixture.json', import.meta.url))
);
if (!process.env.E2E_OVERPASS_JSON) for (const e of fixture.elements) e.timestamp = '2026-03-10T12:00:00Z';
let consultas = 0;
const overpass = createServer((req, res) => {
	let cuerpo = '';
	req.on('data', (d) => (cuerpo += d));
	req.on('end', () => {
		consultas++;
		if (req.url === '/caido') return res.writeHead(504).end();
		const ok = req.method === 'POST' && new URLSearchParams(cuerpo).get('data')?.includes('"ISO3166-1"="AR"');
		res.writeHead(ok ? 200 : 400, { 'content-type': 'application/json' }).end(ok ? JSON.stringify(fixture) : '');
	});
}).listen(4179);

const teselas = await mkdtemp(join(tmpdir(), 'teselas-'));
if (process.env.E2E_PMTILES) await copyFile(process.env.E2E_PMTILES, join(teselas, 'argentina.pmtiles'));

const BASE = 'http://localhost:4178';
const app = spawn('node', ['build'], {
	env: {
		...process.env,
		ENTORNO: 'produccion',
		PORT: '4178',
		ORIGIN: BASE,
		ORIGEN_PUBLICO: BASE,
		DATABASE_URL: URL_DB,
		PIMIENTA_MAIL: 'x'.repeat(40),
		MAIL_MODO: 'desactivado',
		OVERPASS_URL: 'http://localhost:4179/caido,http://localhost:4179/interpreter',
		TESELAS_DIR: teselas
	},
	stdio: ['ignore', 'pipe', 'pipe']
});
let log = '';
app.stdout.on('data', (d) => (log += d));
app.stderr.on('data', (d) => (log += d));

let fallas = 0;
const ok = (c, t) => {
	console.log(`${c ? 'ok  ' : 'FALLA'} ${t}`);
	if (!c) fallas++;
};

try {
	// La importación arranca 10 s después de levantar.
	let catalogo = { banios: [] };
	for (let i = 0; i < 40 && catalogo.banios.length === 0; i++) {
		await esperar(1000);
		catalogo = await fetch(BASE + '/api/v1/banios').then((r) => r.json(), () => ({ banios: [] }));
	}
	ok(catalogo.banios.length > 5, `importó ${catalogo.banios.length} baños`);
	ok(consultas === 2, 'el primer Overpass falló y se usó el segundo');
	ok(+new Date(catalogo.osm_base) === +new Date(fixture.osm3s.timestamp_osm_base) && /OpenStreetMap/.test(catalogo.atribucion), 'fecha de OSM y atribución');
	ok(!/"(user|uid|changeset)"/.test(JSON.stringify(catalogo)), 'no se guardan ni publican usuarios de OSM');
	ok(catalogo.banios.every((b) => !('procedencia' in b) || b.procedencia === 'osm'), 'nada que no venga de OSM');
	const [imp] = await sql`select estado, n_candidatos from osm.importaciones where estado = 'ok'`;
	ok(imp?.n_candidatos === catalogo.banios.length, 'importación registrada');
	const [p] = await sql`select count(*)::int n from osm.candidatos where procedencia <> 'osm'`;
	ok(p.n === 0, 'procedencia osm en todas las filas');

	const r1 = await fetch(BASE + '/api/v1/banios', { headers: { 'accept-encoding': 'gzip' } });
	ok(r1.headers.get('cache-control') === 'public, max-age=3600', 'catálogo cacheable');
	const r2 = await fetch(BASE + '/api/v1/banios', { headers: { 'if-none-match': r1.headers.get('etag') } });
	ok(r2.status === 304, 'ETag: 304');

	ok((await fetch(BASE + '/tiles/..%2Fetc%2Fpasswd')).status === 404, 'teselas: no sale de la carpeta');
	if (process.env.E2E_PMTILES) {
		const t = await fetch(BASE + '/tiles/argentina.pmtiles', { headers: { range: 'bytes=0-6' } });
		ok(t.status === 206 && (await t.text()) === 'PMTiles', 'teselas: pedido por rango');
	} else ok((await fetch(BASE + '/tiles/argentina.pmtiles')).status === 404, 'sin mapa base: 404');

	const navegador = await chromium.launch();
	const contexto = await navegador.newContext({
		geolocation: { latitude: -51.6193, longitude: -69.2241 },
		permissions: ['geolocation'],
		viewport: { width: 390, height: 780 }
	});
	const pagina = await contexto.newPage();
	const errores = [];
	pagina.on('console', (m) => {
		// Sin mapa base, el chequeo de /tiles da 404 a propósito.
		const esperado = !process.env.E2E_PMTILES && m.location().url.endsWith('/tiles/argentina.pmtiles');
		if (m.type() === 'error' && !esperado) errores.push(`${m.text()} (${m.location().url})`);
	});
	pagina.on('pageerror', (e) => errores.push(String(e)));
	await pagina.goto(BASE + '/mapa');
	await pagina.getByText(`${catalogo.banios.length.toLocaleString('es-AR')} baños`).waitFor({ timeout: 15000 });
	await pagina.waitForFunction(() => document.querySelector('canvas.maplibregl-canvas'));
	await esperar(2500);
	await pagina.screenshot({ path: join(process.env.E2E_CAPTURAS ?? teselas, 'mapa-pais.png') });
	await pagina.getByRole('button', { name: /Cerca mío/ }).click();
	await pagina.getByRole('heading', { name: 'Los más cercanos' }).waitFor();
	await esperar(2500);
	await pagina.screenshot({ path: join(process.env.E2E_CAPTURAS ?? teselas, 'mapa-cerca.png') });
	await pagina.locator('.cercanos li button').first().click();
	await pagina.locator('#ficha-titulo').waitFor();
	ok(/OpenStreetMap/.test(await pagina.locator('.ficha .fuente').innerText()), 'la ficha dice de dónde es el dato');
	await esperar(1500);
	await pagina.screenshot({ path: join(process.env.E2E_CAPTURAS ?? teselas, 'mapa-ficha.png') });
	await pagina.getByRole('button', { name: 'Gratis' }).click();
	ok((await pagina.getByRole('button', { name: 'Gratis' }).getAttribute('aria-pressed')) === 'true', 'filtro Gratis');
	ok(errores.length === 0, `sin errores de consola (CSP)${errores.length ? ': ' + errores.join(' | ') : ''}`);
	await navegador.close();
} finally {
	app.kill();
	overpass.close();
	await sql.end();
}
if (fallas) console.log(log);
console.log(fallas ? `${fallas} falla(s)` : 'Todo bien');
process.exit(fallas ? 1 : 0);
