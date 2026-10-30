// Amigos de punta a punta: link de invitación, aceptarlo (con y sin cuenta),
// compartir solo con amigos, pasar a pública y de vuelta, sacar amigos, y lo
// que NO ven los que no son amigos. Uso: pnpm build && node scripts/e2e-amigos.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as esperar } from 'node:timers/promises';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL_DB = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/dondecague_test';
const sql = postgres(URL_DB, { onnotice: () => {} });
await sql.unsafe('drop schema if exists osm cascade; drop schema public cascade; create schema public;');

const BASE = 'http://localhost:4188';
const app = spawn('node', ['servidor.js'], {
	env: {
		...process.env,
		ENTORNO: 'produccion',
		PORT: '4188',
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

let fallas = 0;
const ok = (c, t) => {
	console.log(`${c ? 'ok  ' : 'FALLA'} ${t}`);
	if (!c) fallas++;
};

const navegador = await chromium.launch();
const errores = [];
async function persona(seudonimo, conCuenta = true) {
	const contexto = await navegador.newContext({
		geolocation: { latitude: -51.620123, longitude: -69.220456 },
		permissions: ['geolocation'],
		viewport: { width: 390, height: 844 }
	});
	const p = await contexto.newPage();
	p.on('console', (m) => {
		const url = m.location().url;
		if (m.type() === 'error' && !/\/tiles\/|\/api\/v1\/cuenta$/.test(url)) errores.push(`${m.text()} (${url})`);
	});
	p.on('pageerror', (e) => errores.push(String(e)));
	p.on('dialog', (d) => d.accept());
	if (conCuenta) await alta(p, seudonimo);
	return p;
}
const alta = (p, seudonimo) =>
	p.request.post(BASE + '/api/v1/auth/clave/alta', {
		data: { seudonimo, clave: 'una frase bastante larga', mayor_de_edad: true, acepta_terminos: true }
	});
const json = async (p, ruta) => (await p.request.get(BASE + '/api/v1' + ruta)).json();
const publicas = async () => (await (await fetch(BASE + '/api/v1/publicaciones')).json()).publicaciones;

try {
	const ana = await persona('ana_amigos');
	const beto = await persona('beto_amigos');
	const caro = await persona('caro_no_amiga');

	// Ana crea su link.
	await ana.goto(BASE + '/app/amigos');
	await ana.getByRole('button', { name: 'Crear link de invitación' }).click();
	const link = await ana.locator('.link').innerText();
	ok(/\/app\/amigos\/unirme#[A-Za-z0-9_-]{30,}$/.test(link), 'el link de invitación lleva el token en el #');
	const token = link.split('#')[1];
	const [inv] = await sql`select token_hash from invitaciones_amistad`;
	ok(!inv.token_hash.toString('latin1').includes(token), 'la base guarda solo el hash del token');
	ok((await ana.request.post(BASE + '/api/v1/amigos/aceptar', { data: { token } })).status() === 400, 'no podés aceptar tu propio link');

	// Beto lo abre con su cuenta.
	await beto.goto(link);
	await beto.getByRole('button', { name: 'Sumarme' }).click();
	await beto.getByText('¡Listo! Ahora sos amigo de @ana_amigos').waitFor();
	ok(!beto.url().includes('#'), 'el token no queda en la barra de direcciones');
	// Abrirlo de nuevo (desde WhatsApp abre otra pestaña).
	const otra = await beto.context().newPage();
	await otra.goto(link);
	await otra.getByRole('button', { name: 'Sumarme' }).click();
	await otra.getByText('Ya eras amigo de @ana_amigos').waitFor();
	await otra.close();
	ok(true, 'abrirlo de nuevo no duplica');

	// Dani lo abre sin cuenta: entra y queda como amiga.
	const dani = await persona('dani_amigos', false);
	await dani.goto(link);
	await dani.getByRole('button', { name: 'Entrar o crear cuenta' }).click();
	await dani.waitForURL(/\/app\/entrar/);
	await alta(dani, 'dani_amigos');
	await dani.goto(BASE + '/app');
	await dani.getByRole('button', { name: 'Sumarme' }).click();
	await dani.getByText('Ahora sos amigo de @ana_amigos').waitFor();
	ok(true, 'sin cuenta: después de entrar, retoma la invitación');
	ok((await json(ana, '/amigos')).amigos.map((a) => a.seudonimo).join() === 'beto_amigos,dani_amigos', 'Ana tiene 2 amigos');

	// Ana comparte una caca solo con amigos.
	await ana.goto(BASE + '/app');
	await ana.getByRole('button', { name: '💩 Registrar' }).click();
	await ana.getByRole('radio', { name: 'Al aire libre' }).click();
	ok(await ana.getByRole('radio', { name: /Mis amigos/ }).isDisabled(), 'sin ubicación no se puede compartir');
	await ana.getByRole('button', { name: /Usar mi ubicación/ }).click();
	await ana.getByText('Ubicación guardada').waitFor();
	await ana.getByPlaceholder(/./).last().fill('Con vista al río');
	await ana.getByRole('radio', { name: /Mis amigos/ }).click();
	await ana.getByRole('button', { name: 'Guardar' }).click();
	await ana.getByRole('heading', { name: '¿La compartís con tus amigos?' }).waitFor();
	ok((await ana.getByRole('alertdialog').innerText()).includes('Tus amigos (y nadie más)'), 'la advertencia dice que la ven solo los amigos');
	await ana.getByLabel(/Mostrar también mi anécdota/).check();
	await ana.getByRole('button', { name: 'Sí, compartirla' }).click();
	await ana.getByRole('button', { name: '¡Grande!' }).click(); // Bautismo de Porcelana
	await ana.getByText('Compartida con tus amigos').waitFor();
	ok(true, 'aviso: compartida con amigos');
	const [fila] = await sql`select alcance, numero, comentario from publicaciones`;
	ok(fila.alcance === 'amigos' && fila.numero === null && fila.comentario === 'Con vista al río', 'solo amigos: sin número del mapa público');
	const [punto] = await sql`select lat, lon from publicaciones`;
	ok(punto.lat === -51.620123 && punto.lon === -69.220456, 'a los amigos les llega el punto exacto');

	await sql`update publicaciones set visible_desde = now()`;
	ok((await publicas()).length === 0, 'no aparece en el mapa público');
	const deBeto = (await json(beto, '/amigos/cacas')).publicaciones;
	ok(deBeto.length === 1 && deBeto[0].seudonimo === 'ana_amigos' && deBeto[0].comentario === 'Con vista al río', 'Beto la ve, con la anécdota');
	ok((await json(caro, '/amigos/cacas')).publicaciones.length === 0, 'Caro, que no es amiga, no la ve');
	ok((await caro.request.get(BASE + '/api/v1/amigos/cacas')).ok() && (await fetch(BASE + '/api/v1/amigos/cacas')).status === 401, 'sin cuenta: 401');
	await beto.goto(BASE + '/app/amigos');
	await beto.getByText('@ana_amigos').first().waitFor();
	ok(await beto.getByText('👥 solo amigos').isVisible(), 'en Amigos de Beto aparece, marcada "solo amigos"');

	// Ana vuelve al mismo lugar y también lo comparte: Beto ve "2.ª vez".
	await ana.getByRole('button', { name: '💩 Registrar' }).click();
	await ana.getByRole('radio', { name: 'Al aire libre' }).click();
	await ana.getByRole('button', { name: /Usar mi ubicación/ }).click();
	await ana.getByText('Ubicación guardada').waitFor();
	await ana.getByRole('radio', { name: /Mis amigos/ }).click();
	await ana.getByRole('button', { name: 'Guardar' }).click();
	await ana.getByRole('button', { name: 'Sí, compartirla' }).click();
	await ana.getByText('Compartida con tus amigos').waitFor();
	ok(await ana.getByText('2.ª vez acá').isVisible(), 'en el historial de Ana: "2.ª vez acá"');
	await sql`update publicaciones set visible_desde = now()`;
	await beto.reload();
	await beto.getByText('2.ª vez de @ana_amigos acá').waitFor();
	ok(true, 'en Amigos de Beto: "2.ª vez de @ana_amigos acá"');
	// La segunda vuelve a privada, para seguir con una sola.
	await ana.locator('.historial li button.fila').first().click();
	await ana.getByRole('button', { name: '🔒 Hacerla privada' }).click();
	await ana.waitForFunction(() => [...document.querySelectorAll('.historial li small')].filter((e) => e.textContent.includes('👥 con amigos')).length === 1);

	// Ana la hace pública y después la vuelve a amigos: el número no se pierde.
	await ana.locator('.historial li', { hasText: '👥 con amigos' }).locator('button.fila').click();
	await ana.getByRole('button', { name: '🌎 Hacerla pública' }).click();
	await ana.getByRole('button', { name: 'Sí, hacerla pública' }).click();
	await ana.getByRole('heading', { name: 'Tu caca es la N.º 1 del mapa público' }).waitFor();
	await ana.getByRole('button', { name: '¡Grande!' }).click();
	await sql`update publicaciones set visible_desde = now()`;
	ok((await publicas()).length === 1, 'pasada a pública: aparece en el mapa de cacas');
	const [redondo] = await sql`select lat, lon from publicaciones`;
	ok(redondo.lat === -51.6201 && redondo.lon === -69.2205, 'al pasar a pública, el punto se redondea (~11 m)');
	await ana.getByRole('button', { name: '👥 Solo para amigos' }).click();
	await ana.getByRole('button', { name: 'Sí, compartirla' }).click();
	await ana.locator('.historial li', { hasText: '👥 con amigos' }).waitFor();
	const [vuelta] = await sql`select alcance, numero from publicaciones`;
	ok(vuelta.alcance === 'amigos' && Number(vuelta.numero) === 1 && (await publicas()).length === 0, 'de vuelta a amigos: sale del público y conserva su número');

	// Lo de amigos no vence.
	await sql`update publicaciones set dia = current_date - 400`;
	ok((await json(beto, '/amigos/cacas')).publicaciones.length === 1, 'lo de amigos no vence (una de hace más de un año)');
	await sql`update publicaciones set dia = current_date`;

	// Sacar amigos.
	await beto.goto(BASE + '/app/amigos');
	await beto.getByRole('button', { name: 'Sacar' }).click();
	await beto.getByText('Todavía no tenés amigos acá').waitFor();
	ok((await json(beto, '/amigos/cacas')).publicaciones.length === 0, 'sacado: Beto ya no ve lo de Ana');
	ok((await json(ana, '/amigos')).amigos.length === 1, 'y se saca de los dos lados');

	// Un link nuevo anula el anterior; los links vencen.
	await ana.goto(BASE + '/app/amigos');
	await ana.getByRole('button', { name: 'Crear link de invitación' }).click();
	const nuevo = (await ana.locator('.link').innerText()).split('#')[1];
	ok((await caro.request.post(BASE + '/api/v1/amigos/aceptar', { data: { token } })).status() === 400, 'el link viejo deja de andar');
	await sql`update invitaciones_amistad set vence_en = now() - interval '1 minute'`;
	ok((await caro.request.post(BASE + '/api/v1/amigos/aceptar', { data: { token: nuevo } })).status() === 400, 'un link vencido no sirve');

	// Borrar la cuenta borra sus amistades.
	await sql`delete from cuentas where seudonimo = 'ana_amigos'`;
	ok((await sql`select 1 from amistades`).length === 0, 'borrar la cuenta borra sus amistades');
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
