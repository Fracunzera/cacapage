// Puntajes y reportes de baños: API, umbral de 15 reportes (con reportes
// simultáneos) y la ficha del mapa en Chromium.
// Uso: pnpm build && DATABASE_URL=postgres://… node scripts/e2e-opiniones.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as esperar } from 'node:timers/promises';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL_DB = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/dondecague_test';
const sql = postgres(URL_DB, { onnotice: () => {} });
await sql.unsafe('drop schema if exists osm cascade; drop schema public cascade; create schema public;');

const BASE = 'http://localhost:4181';
const app = spawn('node', ['build'], {
	env: {
		...process.env,
		ENTORNO: 'produccion',
		PORT: '4181',
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

const [{ id: imp }] = await sql`insert into osm.importaciones (fuente, estado) values ('e2e', 'ok') returning id`;
await sql`insert into osm.candidatos (id, procedencia, objetos, categoria, existencia, nombre, lat, lon, importacion_id) values
	('n1', 'osm', '{n1}', 'banio', 'confirmado', 'Baño de la plaza', -51.6200, -69.2200, ${imp}),
	('n2', 'osm', '{n2}', 'estacion_servicio', 'confirmado', 'YPF Centro', -51.6230, -69.2200, ${imp})`;

let fallas = 0;
const ok = (c, t) => {
	console.log(`${c ? 'ok  ' : 'FALLA'} ${t}`);
	if (!c) fallas++;
};

/** Una cuenta con sesión, para pegarle a la API. */
async function cuenta(seudonimo) {
	const r = await fetch(BASE + '/api/v1/auth/clave/alta', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ seudonimo, clave: 'una frase bastante larga', mayor_de_edad: true, acepta_terminos: true })
	});
	const cookie = r.headers.get('set-cookie').split(';')[0];
	return async (ruta, metodo = 'GET', cuerpo) => {
		const x = await fetch(BASE + '/api/v1' + ruta, {
			method: metodo,
			headers: { 'Content-Type': 'application/json', cookie },
			body: cuerpo ? JSON.stringify(cuerpo) : undefined
		});
		return { estado: x.status, datos: x.status === 204 ? null : await x.json().catch(() => null) };
	};
}

const navegador = await chromium.launch();
try {
	const ana = await cuenta('ana_banios');
	const beto = await cuenta('beto_banios');
	const anonimo = await fetch(BASE + '/api/v1/banios/n1/puntaje', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"puntaje":5}' });
	ok(anonimo.status === 401, 'sin cuenta no se puede puntuar');
	ok((await ana('/banios/n1/puntaje', 'PUT', { puntaje: 6 })).estado === 400, 'puntaje fuera de 1 a 5: 400');
	ok((await ana('/banios/n9/puntaje', 'PUT', { puntaje: 3 })).estado === 404, 'baño que no existe: 404');
	await ana('/banios/n1/puntaje', 'PUT', { puntaje: 2 });
	await ana('/banios/n1/puntaje', 'PUT', { puntaje: 5 });
	await beto('/banios/n1/puntaje', 'PUT', { puntaje: 2 });
	const op = (await ana('/banios/n1/opiniones')).datos;
	ok(op.promedio === 3.5 && op.cantidad === 2 && op.mio === 5, 'promedio 3,5 de 2 votos (cambiar el voto no suma otro)');
	const publico = await (await fetch(BASE + '/api/v1/banios/n1/opiniones')).json();
	ok(publico.mio === null && !JSON.stringify(publico).includes('ana'), 'sin cuenta: solo promedio y cantidad, sin quién');

	// Reportes: uno por cuenta; solo cuentan cuentas elegibles; a los 15, "en revisión".
	ok((await ana('/banios/n2/reporte', 'POST', { motivo: 'cualquiera' })).estado === 400, 'motivo inválido: 400');
	await ana('/banios/n2/reporte', 'POST', { motivo: 'no_existe' });
	await ana('/banios/n2/reporte', 'POST', { motivo: 'otro' });
	let [{ n }] = await sql`select count(*)::int n from banio_reportes where banio_id = 'n2'`;
	ok(n === 1, 'la misma cuenta reporta una sola vez');
	// 13 cuentas viejas que registraron algo y ya reportaron (directo en la base).
	for (let i = 0; i < 13; i++) {
		const [{ id }] = await sql`insert into cuentas (id, seudonimo, mayor_de_edad, creada_en, dias_activos)
			values (gen_random_uuid(), ${'rep_' + i}, true, current_date - 30, 3) returning id`;
		await sql`insert into banio_reportes (banio_id, cuenta_id, motivo) values ('n2', ${id}, 'no_existe')`;
	}
	// Una cuenta nueva (ana) no cuenta: 13 elegibles + ana = todavía no.
	const [c14, c15] = await Promise.all([cuenta('carla_banios'), cuenta('dani_banios')]);
	await sql`update cuentas set creada_en = current_date - 10, dias_activos = 1 where seudonimo in ('carla_banios', 'dani_banios')`;
	const nueva = await cuenta('nuevita_banios');
	ok((await nueva('/banios/n2/reporte', 'POST', { motivo: 'no_existe' })).datos.en_revision === false, 'el reporte de una cuenta nueva no cuenta');
	const [r14, r15] = await Promise.all([c14('/banios/n2/reporte', 'POST', { motivo: 'no_existe' }), c15('/banios/n2/reporte', 'POST', { motivo: 'no_publico' })]);
	ok(r14.estado === 200 && r15.estado === 200 && [r14.datos.en_revision, r15.datos.en_revision].filter(Boolean).length === 1, 'dos reportes juntos: exactamente uno llega a 15 elegibles');
	let cat = await (await fetch(BASE + '/api/v1/banios')).json();
	ok(cat.banios.some((b) => b.id === 'n2'), 'en revisión no se oculta: sigue en el catálogo');
	ok((await ana('/banios/n2/opiniones')).datos.en_revision === 'no_existe', 'la ficha dice que está en revisión y el motivo más reportado');

	// Ocultar y des-ocultar a mano (docs/despliegue.md).
	await sql`insert into banios_ocultos (banio_id, motivo) values ('n2', 'revisado'); delete from banios_en_revision where banio_id = 'n2'`.simple();
	cat = await (await fetch(BASE + '/api/v1/banios')).json();
	ok(!cat.banios.some((b) => b.id === 'n2'), 'oculto a mano: sale del catálogo');
	ok((await ana('/banios/n2/opiniones')).estado === 404, 'oculto: no se puede opinar');
	await sql`delete from osm.candidatos where id = 'n2'`;
	await sql`insert into osm.candidatos (id, procedencia, objetos, categoria, existencia, nombre, lat, lon, importacion_id)
		values ('n2', 'osm', '{n2}', 'estacion_servicio', 'confirmado', 'YPF Centro', -51.6230, -69.2200, ${imp})`;
	cat = await (await fetch(BASE + '/api/v1/banios')).json();
	ok(!cat.banios.some((b) => b.id === 'n2'), 'si OSM lo vuelve a traer, sigue oculto');
	await sql`delete from banios_ocultos where banio_id = 'n2'`;
	cat = await (await fetch(BASE + '/api/v1/banios')).json();
	ok(cat.banios.some((b) => b.id === 'n2'), 'des-ocultar a mano lo devuelve al mapa');

	// n1 en revisión, para ver el aviso en la ficha.
	const [{ id: vieja }] = await sql`select id from cuentas where seudonimo = 'rep_0'`;
	await sql`insert into banio_reportes (banio_id, cuenta_id, motivo) values ('n1', ${vieja}, 'mal_ubicado')`;
	await sql`insert into banios_en_revision (banio_id, reportes) values ('n1', 15)`;

	// La ficha en el mapa.
	const contexto = await navegador.newContext({
		geolocation: { latitude: -51.62005, longitude: -69.22 },
		permissions: ['geolocation'],
		viewport: { width: 390, height: 844 }
	});
	const p = await contexto.newPage();
	const errores = [];
	p.on('console', (m) => m.type() === 'error' && !m.location().url.endsWith('/tiles/argentina.pmtiles') && errores.push(m.text()));
	await p.request.post(BASE + '/api/v1/auth/clave/alta', {
		data: { seudonimo: 'eva_banios', clave: 'una frase bastante larga', mayor_de_edad: true, acepta_terminos: true }
	});
	await p.goto(BASE + '/mapa');
	await p.getByRole('button', { name: /Cerca mío/ }).click();
	await p.locator('.cercanos li button').first().click();
	await p.getByText('de 5 · 2 votos').waitFor();
	await p.locator('.revision').waitFor();
	ok(true, 'la ficha muestra el promedio');
	await p.getByRole('button', { name: '4 rollos' }).click();
	await p.getByText('Le pusiste 4 rollos').waitFor();
	ok((await p.locator('.promedio').innerText()).includes('3,7'), 'al puntuar se actualiza el promedio (3,7 de 3)');
	await p.getByRole('button', { name: /Reportar un problema/ }).click();
	await p.getByLabel('Está mal ubicado').check();
	await p.getByRole('button', { name: 'Reportar', exact: true }).click();
	await p.getByText('Gracias. Cuando varias personas reportan lo mismo').waitFor();
	ok(true, 'reportar desde la ficha');
	ok(/En revisión.*está mal ubicado/s.test(await p.locator('.revision').innerText()), 'la ficha muestra el aviso de revisión');
	await p.screenshot({ path: join(process.env.E2E_CAPTURAS ?? tmpdir(), 'opiniones-ficha.png') });
	ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);

	// Borrar la cuenta borra sus votos y reportes.
	await sql`delete from cuentas where seudonimo = 'eva_banios'`;
	const [v] = await sql`select (select count(*) from banio_puntajes)::int p, (select count(*) from banio_reportes where banio_id = 'n1')::int r`;
	ok(v.p === 2 && v.r === 1, 'borrar la cuenta borra sus votos y reportes');
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
