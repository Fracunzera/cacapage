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
	const q = u.searchParams.get('q') ?? `${u.searchParams.get('street')} | ${u.searchParams.get('city')}`;
	pedidos.push({ q, pais: u.searchParams.get('countrycodes'), ua: req.headers['user-agent'] });
	const calle = (road, house_number, lat) => ({
		display_name: `${road}, Río Gallegos, Argentina`,
		lat,
		lon: '-69.2201',
		address: { road, house_number, city: 'Río Gallegos', state: 'Santa Cruz', country: 'Argentina' }
	});
	// Como el de verdad: Zapiola tiene alturas; Santa Fe, solo los tramos de la calle.
	const datos = /zapiola/i.test(q)
		? [calle('Zapiola', '50', '-51.6202')]
		: /santa fe/i.test(q)
			? [calle('Santa Fe', undefined, '-51.6280'), calle('Santa Fe', undefined, '-51.6241')]
			: [];
	res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(datos));
}).listen(4187);

const BASE = 'http://localhost:4186';
const app = spawn('node', ['servidor.js'], {
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
	p.on('console', (m) => m.type() === 'error' && !/\/tiles\/(argentina|mundo)\.pmtiles$/.test(m.location().url) && errores.push(m.text()));
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
	await p.getByRole('button', { name: /Zapiola 50 · Río Gallegos, Santa Cruz/ }).click();
	ok(pedidos.at(-1).q === '50 Zapiola | Río Gallegos', 'calle y ciudad se buscan por separado');
	// Se confirma en el mapa, que arranca acercado en la dirección.
	await p.getByText('Fijate que el pin quede justo').waitFor();
	await p.getByRole('button', { name: 'Usar este punto' }).click();
	await p.getByText('Ubicación cargada en Zapiola 50').waitFor();
	await p.getByText('YPF Centro').waitFor();
	ok(pedidos.at(-1).pais === null && /DondeCague/.test(pedidos.at(-1).ua), 'dirección: se busca en Nominatim, en todo el mundo, identificándonos');

	// Una calle sin alturas en el mapa: se marca el punto moviendo el mapa.
	await p.getByRole('button', { name: 'Cambiar' }).click();
	await campo().fill('Santa Fe 848, Río Gallegos');
	await p.getByRole('button', { name: 'Buscar' }).click();
	await p.getByRole('button', { name: /^Santa Fe · Río Gallegos/ }).first().waitFor();
	ok((await p.getByRole('button', { name: /^Santa Fe · Río Gallegos/ }).count()) === 1, 'los tramos de la misma calle salen una sola vez');
	await p.getByRole('button', { name: /^Santa Fe · Río Gallegos/ }).click();
	await p.getByText('Esa calle no tiene las alturas en el mapa').waitFor();
	await p.screenshot({ path: (process.env.E2E_CAPTURAS ?? '/tmp') + '/ubicacion-en-mapa.png' });
	const lienzo = p.locator('.elegir .lienzo');
	const caja = await lienzo.boundingBox();
	await p.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
	await p.mouse.down();
	await p.mouse.move(caja.x + caja.width / 2 - 80, caja.y + caja.height / 2 - 40, { steps: 8 });
	await p.mouse.up();
	await esperar(300);
	await p.getByRole('button', { name: 'Usar este punto' }).click();
	await p.getByText('Ubicación cargada en Santa Fe').waitFor();
	ok(true, 'calle sin alturas: se ajusta en el mapa');

	// Un link de Google que trae la dirección y no las coordenadas: se busca la dirección.
	await p.getByRole('button', { name: 'Cambiar' }).click();
	await campo().fill('https://maps.google.com/?q=Zapiola+50,+R%C3%ADo+Gallegos&ftid=0x1:0x2');
	await p.getByRole('button', { name: 'Buscar' }).click();
	await p.getByRole('button', { name: /Zapiola 50 · Río Gallegos/ }).waitFor();
	ok(pedidos.at(-1).q === '50 Zapiola | Río Gallegos', 'link con la dirección: se busca esa dirección');

	// Marcarla directo en el mapa.
	await p.getByRole('button', { name: /Marcarla en el mapa/ }).click();
	await p.getByText('Acercate más').waitFor();
	ok(await p.getByRole('button', { name: 'Usar este punto' }).isDisabled(), 'con el país entero a la vista no se puede marcar');
	await p.locator('.elegir').getByRole('button', { name: 'Cancelar' }).click();
	await campo().fill('Zapiola 50, Río Gallegos');
	await p.getByRole('button', { name: 'Buscar' }).click();
	await p.getByRole('button', { name: /Zapiola 50 · Río Gallegos/ }).click();
	await p.getByRole('button', { name: 'Usar este punto' }).click();
	await p.getByText('Ubicación cargada en Zapiola 50').waitFor();
	ok(!log.includes('Zapiola') && !log.includes('Que No Existe'), 'lo buscado no queda en el log del servidor');
	await p.screenshot({ path: (process.env.E2E_CAPTURAS ?? '/tmp') + '/ubicacion-a-mano.png' });

	await p.getByRole('button', { name: 'Guardar' }).click();
	await p.locator('.historial li button.fila').first().waitFor();
	await p.getByRole('button', { name: '¡Grande!' }).click();
	await p.locator('.historial li button.fila').first().click();
	ok(await p.getByText('Ubicación cargada a mano').isVisible(), 'el registro queda con la ubicación cargada a mano');

	// Fuera de la Argentina: se registra y se publica igual; no se sugieren baños.
	await p.getByRole('button', { name: '💩 Registrar' }).click();
	await p.getByRole('radio', { name: 'Al aire libre' }).click();
	await p.getByRole('button', { name: /Escribirla/ }).click();
	await campo().fill('40.4168, -3.7038');
	await p.getByRole('button', { name: 'Buscar' }).click();
	await p.getByText('Fuera de la Argentina').waitFor();
	ok((await p.getByText('¿En cuál?').count()) === 0, 'fuera de la Argentina no se sugieren baños');
	// Una anécdota con un link no se puede mostrar.
	await p.locator('.anecdota textarea').fill('Mirá www.algo.com');
	await p.getByRole('radio', { name: /Todo el mundo/ }).click();
	await p.getByRole('button', { name: 'Guardar' }).click();
	await p.getByRole('alertdialog').waitFor();
	ok(await p.getByLabel(/Mostrar también mi anécdota/).isDisabled(), 'una anécdota con links no se puede mostrar');
	ok(await p.getByText('sacale los links').isVisible(), 'y dice por qué');
	await p.getByRole('button', { name: 'Mejor no' }).click();
	// Con una anécdota limpia, sí (marcándolo; viene sin marcar).
	await p.locator('.anecdota textarea').fill('Parque del Retiro, divino');
	await p.getByRole('radio', { name: /Todo el mundo/ }).click();
	await p.getByRole('button', { name: 'Guardar' }).click();
	ok(!(await p.getByLabel(/Mostrar también mi anécdota/).isChecked()), 'mostrar la anécdota viene sin marcar');
	await p.getByLabel(/Mostrar también mi anécdota/).check();
	await p.getByRole('button', { name: 'Sí, hacerla pública' }).click();
	await p.getByRole('heading', { name: /Tu caca es la N.º 1 del mapa público/ }).waitFor();
	await p.getByRole('button', { name: '¡Grande!' }).click();
	const [madrid] = await sql`select id, lat, lon, comentario from publicaciones`;
	ok(madrid?.lat === 40.4168 && madrid?.lon === -3.7038, 'se publica desde cualquier país (Madrid)');
	ok(madrid?.comentario === 'Parque del Retiro, divino', 'con la anécdota, porque se eligió mostrarla');

	// En el mapa público aparece, y con 3 reportes de cuentas elegibles se oculta el texto.
	await sql`update publicaciones set visible_desde = now()`;
	const publico = async () => (await (await fetch(BASE + '/api/v1/publicaciones')).json()).publicaciones;
	ok((await publico())[0]?.comentario === 'Parque del Retiro, divino', 'el mapa de cacas muestra la anécdota');
	const propio = await p.request.post(BASE + `/api/v1/publicaciones/${madrid.id}/reporte`);
	ok(propio.status() === 400, 'no se puede reportar el comentario propio');
	const reportes = [];
	for (const s of ['rep_uno', 'rep_dos', 'rep_tres']) {
		const alta = await fetch(BASE + '/api/v1/auth/clave/alta', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ seudonimo: s, clave: 'una frase bastante larga', mayor_de_edad: true, acepta_terminos: true })
		});
		const cookie = alta.headers.get('set-cookie').split(';')[0];
		if (s !== 'rep_tres') await sql`update cuentas set creada_en = current_date - 30, dias_activos = 2 where seudonimo = ${s}`;
		reportes.push(async () => (await (await fetch(BASE + `/api/v1/publicaciones/${madrid.id}/reporte`, { method: 'POST', headers: { cookie } })).json()).oculto);
	}
	ok((await reportes[0]()) === false && (await reportes[2]()) === false, 'dos reportes (uno de una cuenta nueva, que no cuenta): sigue visible');
	await sql`update cuentas set creada_en = current_date - 30, dias_activos = 2 where seudonimo = 'rep_tres'`;
	ok((await reportes[2]()) === false, 'la misma cuenta no suma dos veces (ahora elegible: 2 de 3)');
	ok((await reportes[1]()) === true, 'el tercer reporte elegible oculta el texto');
	const [{ n }] = await sql`select count(*)::int n from comentario_reportes`;
	ok(n === 3, 'tres reportes guardados, uno por cuenta');
	const [ocultado] = await sql`select comentario_oculto from publicaciones`;
	ok(ocultado.comentario_oculto === true, 'con 3 reportes elegibles se oculta el texto');
	const despues = await publico();
	ok(despues.length === 1 && !despues[0].comentario, 'el punto sigue en el mapa, sin el texto');
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
