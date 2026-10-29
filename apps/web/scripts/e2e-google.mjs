// Entrar con Google de punta a punta contra un Google falso (OIDC con PKCE,
// state y nonce): crear cuenta, entrar, asociar a una cuenta existente, quitar,
// y los casos de error. Uso: pnpm build && DATABASE_URL=postgres://… node scripts/e2e-google.mjs
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { setTimeout as esperar } from 'node:timers/promises';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL_DB = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/dondecague_test';
const sql = postgres(URL_DB, { onnotice: () => {} });
await sql.unsafe('drop schema if exists osm cascade; drop schema public cascade; create schema public;');

const BASE = 'http://localhost:4182';
const CLIENTE = 'cliente-de-prueba.apps.googleusercontent.com';
const SECRETO = 'secreto-de-prueba';

// ---------- Google falso ----------
let proximoSub = 'sub-google-111';
let nonceTrucho = false;
const codigos = new Map();
const pedidos = [];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const google = createServer((req, res) => {
	const u = new URL(req.url, 'http://localhost:4183');
	if (u.pathname === '/auth') {
		const q = Object.fromEntries(u.searchParams);
		pedidos.push(q);
		const codigo = 'codigo-' + Math.random().toString(36).slice(2);
		codigos.set(codigo, { desafio: q.code_challenge, nonce: q.nonce, sub: proximoSub, redirect: q.redirect_uri });
		const vuelta = new URL(q.redirect_uri);
		vuelta.search = new URLSearchParams({ code: codigo, state: q.state }).toString();
		return res.writeHead(302, { location: vuelta.toString() }).end();
	}
	if (u.pathname === '/token' && req.method === 'POST') {
		let cuerpo = '';
		req.on('data', (d) => (cuerpo += d));
		req.on('end', () => {
			const f = new URLSearchParams(cuerpo);
			const c = codigos.get(f.get('code'));
			codigos.delete(f.get('code'));
			const verificado =
				c &&
				f.get('client_secret') === SECRETO &&
				f.get('client_id') === CLIENTE &&
				f.get('redirect_uri') === c.redirect &&
				createHash('sha256').update(f.get('code_verifier') ?? '').digest('base64url') === c.desafio;
			if (!verificado) return res.writeHead(400, { 'content-type': 'application/json' }).end('{"error":"invalid_grant"}');
			const id_token = [
				b64({ alg: 'RS256' }),
				b64({ iss: 'https://accounts.google.com', aud: CLIENTE, sub: c.sub, nonce: nonceTrucho ? 'otro' : c.nonce, exp: Math.floor(Date.now() / 1000) + 3600 }),
				'firma'
			].join('.');
			res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id_token, access_token: 'x' }));
		});
		return;
	}
	res.writeHead(404).end();
}).listen(4183);

const app = spawn('node', ['build'], {
	env: {
		...process.env,
		ENTORNO: 'produccion',
		PORT: '4182',
		ORIGIN: BASE,
		ORIGEN_PUBLICO: BASE,
		DATABASE_URL: URL_DB,
		PIMIENTA_MAIL: 'x'.repeat(40),
		MAIL_MODO: 'desactivado',
		OSM_IMPORTAR: 'no',
		GOOGLE_CLIENT_ID: CLIENTE,
		GOOGLE_CLIENT_SECRET: SECRETO,
		GOOGLE_URL_AUTORIZACION: 'http://localhost:4183/auth',
		GOOGLE_URL_TOKEN: 'http://localhost:4183/token'
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
try {
	ok((await (await fetch(BASE + '/api/v1/config')).json()).google === true, 'config: Google disponible');
	const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
	const p = await contexto.newPage();
	const errores = [];
	// /app/entrar pregunta si ya hay sesión: sin sesión, ese 401 es esperado.
	p.on('console', (m) => m.type() === 'error' && !m.location().url.endsWith('/api/v1/cuenta') && errores.push(`${m.text()} (${m.location().url})`));

	// Crear cuenta con Google.
	await p.goto(BASE + '/app/entrar');
	await p.getByRole('radio', { name: 'Google' }).click();
	await p.getByLabel('Elegí un seudónimo').fill('con_google');
	await p.getByText('✓ Está libre.').waitFor();
	await p.getByLabel('Tengo 18 años o más.').check();
	await p.getByRole('checkbox', { name: /Acepto los/ }).check();
	await p.getByRole('button', { name: 'Crear con Google' }).click();
	await p.waitForURL(BASE + '/app');
	await p.getByRole('button', { name: '💩 Registrar' }).waitFor();
	ok(true, 'crear cuenta con Google: entra a "Mi trono"');
	const q = pedidos.at(-1);
	ok(q.scope === 'openid' && q.code_challenge_method === 'S256' && q.state && q.nonce && !('login_hint' in q), 'a Google se le pide solo openid, con PKCE, state y nonce');
	const volcado = execFileSync('/usr/lib/postgresql/16/bin/pg_dump', ['--data-only', URL_DB]).toString();
	ok(!volcado.includes('sub-google-111'), 'el identificador de Google no se guarda en claro');
	ok((await sql`select 1 from logins_google`).length === 1, 'queda asociada a Google');

	// Salir y volver a entrar con Google.
	await p.request.post(BASE + '/api/v1/auth/salir', { data: {} });
	await p.goto(BASE + '/app/entrar?modo=entrar');
	await p.getByRole('radio', { name: 'Google' }).click();
	await p.getByRole('button', { name: 'Entrar con Google' }).click();
	await p.waitForURL(BASE + '/app');
	// Que "Mi trono" termine de cargar antes de salir (si no, sus pedidos dan 401).
	await p.getByRole('button', { name: '💩 Registrar' }).waitFor();
	ok((await (await p.request.get(BASE + '/api/v1/cuenta')).json()).seudonimo === 'con_google', 'entrar con Google');

	// Una cuenta de Google sin cuenta acá.
	await p.request.post(BASE + '/api/v1/auth/salir', { data: {} });
	proximoSub = 'sub-google-222';
	await p.goto(BASE + '/app/entrar?modo=entrar');
	await p.getByRole('radio', { name: 'Google' }).click();
	await p.getByRole('button', { name: 'Entrar con Google' }).click();
	await p.getByText('no tiene cuenta acá').waitFor();
	ok(!p.url().includes('google='), 'sin cuenta: avisa y limpia la URL');

	// state cambiado y nonce trucho: no entra.
	const r = await fetch(BASE + '/api/v1/auth/google/vuelta?code=x&state=malo', { redirect: 'manual' });
	ok(r.status === 303 && r.headers.get('location') === '/app/entrar?google=error', 'state que no coincide: error');
	nonceTrucho = true;
	// Después de "no tiene cuenta acá" la página pasa a "Crear cuenta": se vuelve a "Ya tengo cuenta".
	await p.getByRole('tab', { name: 'Ya tengo cuenta' }).click();
	await p.getByRole('radio', { name: 'Google' }).click();
	await p.getByRole('button', { name: 'Entrar con Google' }).click();
	await p.getByText('No se pudo entrar con Google').waitFor();
	ok((await p.request.get(BASE + '/api/v1/cuenta')).status() === 401, 'nonce que no coincide: no entra');
	nonceTrucho = false;

	// Asociar Google a una cuenta con contraseña.
	await p.request.post(BASE + '/api/v1/auth/clave/alta', {
		data: { seudonimo: 'con_clave', clave: 'una frase bastante larga', mayor_de_edad: true, acepta_terminos: true }
	});
	await p.goto(BASE + '/app/cuenta');
	await p.getByRole('button', { name: 'Asociar Google' }).click();
	await p.getByText('¡Listo! Ya podés entrar con Google.').waitFor();
	ok(await p.getByText('🌐 Google').isVisible(), 'asociar Google a una cuenta existente');
	await p.request.post(BASE + '/api/v1/auth/salir', { data: {} });
	await p.goto(BASE + '/app/entrar?modo=entrar');
	await p.getByRole('radio', { name: 'Google' }).click();
	await p.getByRole('button', { name: 'Entrar con Google' }).click();
	await p.waitForURL(BASE + '/app');
	await p.getByRole('button', { name: '💩 Registrar' }).waitFor();
	ok((await (await p.request.get(BASE + '/api/v1/cuenta')).json()).seudonimo === 'con_clave', 'después entra con Google a esa cuenta');

	// La cuenta de Google de otro seudónimo no se puede asociar.
	proximoSub = 'sub-google-111';
	await p.goto(BASE + '/app/cuenta');
	await p.getByRole('button', { name: 'Quitar Google' }).waitFor();
	await sql`delete from logins_google where cuenta_id = (select id from cuentas where seudonimo = 'con_clave')`;
	await p.reload();
	await p.getByRole('button', { name: 'Asociar Google' }).click();
	await p.getByText('ya se usa para entrar con otro seudónimo').waitFor();
	ok(true, 'una cuenta de Google ya usada por otro seudónimo: no se asocia');

	// Quitar Google: solo si queda otra forma de entrar.
	await sql`insert into logins_google (cuenta_id, sub_hmac) select id, '\\x00' from cuentas where seudonimo = 'con_clave'`;
	await p.reload();
	p.once('dialog', (d) => d.accept());
	await p.getByRole('button', { name: 'Quitar Google' }).click();
	await p.getByRole('button', { name: 'Asociar Google' }).waitFor();
	ok(true, 'quitar Google (queda la contraseña)');
	const solo = await sql`select id from cuentas where seudonimo = 'con_google'`;
	ok(solo.length === 1, 'la cuenta creada con Google existe');
	ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
} catch (e) {
	fallas++;
	console.log('FALLA', e);
} finally {
	await navegador.close();
	app.kill();
	google.close();
	await sql.end();
}
if (fallas) console.log(log);
console.log(fallas ? `${fallas} falla(s)` : 'Todo bien');
process.exit(fallas ? 1 : 0);
