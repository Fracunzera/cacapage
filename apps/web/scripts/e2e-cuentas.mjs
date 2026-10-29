// Prueba de punta a punta de las cuentas contra el build real y un Postgres de
// prueba, en Chromium con un autenticador de passkeys virtual.
// Uso: pnpm build && DATABASE_URL=postgres://… node scripts/e2e-cuentas.mjs
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as esperar } from 'node:timers/promises';
import { createRequire } from 'node:module';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PUERTO = 4175;
const BASE = `http://localhost:${PUERTO}`;
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/dondecague_test';
const MAIL = 'alguien.de.prueba@ejemplo.com';

let fallas = 0;
function verificar(condicion, texto) {
	console.log(`${condicion ? 'ok  ' : 'FALLA'} ${texto}`);
	if (!condicion) fallas++;
}

const sql = postgres(DATABASE_URL, { onnotice: () => {} });
await sql.unsafe('drop schema if exists osm cascade; drop schema public cascade; create schema public;');

async function levantar(entorno, extra = {}) {
	const proceso = spawn('node', ['servidor.js'], {
		env: {
			...process.env,
			ENTORNO: entorno,
			PORT: String(PUERTO),
			ORIGIN: BASE,
			ORIGEN_PUBLICO: BASE,
			DATABASE_URL,
			PIMIENTA_MAIL: 'pimienta-de-prueba-solo-para-tests-0123456789',
			MAIL_MODO: 'consola',
			OSM_IMPORTAR: 'no',
			...extra
		},
		stdio: ['ignore', 'pipe', 'pipe']
	});
	const s = { proceso, salida: '' };
	proceso.stdout.on('data', (d) => (s.salida += d));
	proceso.stderr.on('data', (d) => (s.salida += d));
	for (let i = 0; i < 80; i++) {
		try {
			if ((await fetch(BASE + '/robots.txt')).ok) return s;
		} catch {
			if (proceso.exitCode !== null) throw new Error('El servidor no levantó:\n' + s.salida);
		}
		await esperar(100);
	}
	throw new Error('El servidor no levantó:\n' + s.salida);
}
async function bajar(s) {
	s.proceso.kill();
	await new Promise((ok) => (s.proceso.exitCode !== null ? ok() : s.proceso.once('exit', ok)));
}
async function esperarLink(s, tipo) {
	const patron = new RegExp(`\\[mail:${tipo}\\] (\\S+)`);
	for (let i = 0; i < 50; i++) {
		const m = s.salida.match(patron);
		if (m) {
			s.salida = s.salida.replace(m[0], '');
			return m[1];
		}
		await esperar(100);
	}
	return null;
}

const navegador = await chromium.launch();
const errores = [];

// ---------- Producción: passkeys ----------
{
	const s = await levantar('produccion');
	const migradas = await sql`select nombre from schema_migraciones`;
	verificar(migradas.some((m) => m.nombre === '0001_cuentas.sql'), 'al arrancar se aplicó la migración de cuentas');

	const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	const p = await contexto.newPage();
	p.on('pageerror', (e) => errores.push(String(e)));
	p.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errores.push(m.text()));
	const cdp = await contexto.newCDPSession(p);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			ctap2Version: 'ctap2_1',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true,
			hasPrf: true
		}
	});

	await p.goto(BASE + '/');
	verificar(await p.getByRole('link', { name: 'Crear mi cuenta' }).isVisible(), 'la portada ofrece crear cuenta');
	await p.getByRole('link', { name: 'Crear mi cuenta' }).click();
	await p.getByRole('button', { name: 'Crear con passkey' }).waitFor();
	await p.getByLabel('Elegí un seudónimo').fill('Trono_Test');
	await p.getByText('✓ Está libre.').waitFor();
	verificar(await p.getByRole('button', { name: 'Crear con passkey' }).isDisabled(), 'sin aceptar términos no deja crear');
	await p.getByLabel('Tengo 18 años o más.').check();
	await p.getByRole('checkbox').nth(1).check();
	await p.getByRole('button', { name: 'Crear con passkey' }).click();
	// Al entrar se va a "Mi trono"; los datos de la cuenta están en /app/cuenta.
	await p.waitForURL(BASE + '/app');
	await p.goto(BASE + '/app/cuenta');
	await p.getByText('@trono_test').waitFor();
	verificar(true, 'alta con passkey: entra a "Mi cuenta" con el seudónimo en minúsculas');

	const [c] = await sql`select count(*)::int n from cuentas`;
	const [cr] = await sql`select count(*)::int n, bool_and(soporta_prf) prf from credenciales_passkey`;
	const [co] = await sql`select count(*)::int n from consentimientos`;
	verificar(c.n === 1 && cr.n === 1 && co.n === 2, 'en la base: 1 cuenta, 1 passkey, 2 consentimientos');
	verificar(cr.prf === true, 'la passkey quedó marcada con soporte de PRF (para la bóveda)');

	const libre = await (await fetch(BASE + '/api/v1/seudonimos/trono_test')).json();
	verificar(libre.disponible === false, 'el seudónimo ya no figura como libre');

	await p.getByRole('button', { name: 'Salir' }).click();
	await p.waitForURL(BASE + '/');
	await p.goto(BASE + '/app/cuenta');
	await p.waitForURL(/\/app\/entrar/);
	verificar(true, 'después de salir, "Mi cuenta" manda a entrar');

	await p.getByRole('button', { name: 'Entrar con passkey' }).click();
	// Al entrar se va a "Mi trono"; los datos de la cuenta están en /app/cuenta.
	await p.waitForURL(BASE + '/app');
	await p.goto(BASE + '/app/cuenta');
	await p.getByText('@trono_test').waitFor();
	verificar(true, 'entrar con passkey funciona');

	// Borrar exige haber entrado hace menos de 5 minutos.
	await sql`update sesiones set reautenticada_hasta = now() - interval '1 minute'`;
	const cookies = (await contexto.cookies()).map((k) => `${k.name}=${k.value}`).join('; ');
	const r403 = await fetch(BASE + '/api/v1/cuenta', { method: 'DELETE', headers: { cookie: cookies } });
	verificar(r403.status === 403, 'borrar con una sesión vieja pide volver a entrar (403)');
	await sql`update sesiones set reautenticada_hasta = now() + interval '5 minutes'`;

	await p.getByRole('button', { name: 'Borrar mi cuenta' }).click();
	await p.getByLabel(/para confirmar/).fill('trono_test');
	await p.getByRole('button', { name: 'Borrar para siempre' }).click();
	await p.waitForURL(BASE + '/?cuenta=borrada');
	const [c2] = await sql`select (select count(*) from cuentas)::int a, (select count(*) from credenciales_passkey)::int b,
		(select count(*) from sesiones)::int c, (select count(*) from consentimientos)::int d`;
	verificar(c2.a + c2.b + c2.c + c2.d === 0, 'borrar la cuenta deja la base vacía (cuenta, passkey, sesión, consentimientos)');

	await contexto.close();
	await bajar(s);
}

// ---------- Prueba: sin passkeys, link por mail ----------
{
	const s = await levantar('prueba');
	const r404 = await fetch(BASE + '/api/v1/auth/passkey/entrada/opciones', { method: 'POST' });
	verificar(r404.status === 404, 'prueba: las rutas de passkeys no existen (404)');

	const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	const p = await contexto.newPage();
	p.on('pageerror', (e) => errores.push(String(e)));
	p.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errores.push(m.text()));

	await p.goto(BASE + '/app/entrar');
	await p.getByRole('radio', { name: 'Contraseña' }).waitFor();
	verificar(
		!(await p.getByRole('radio', { name: 'Passkey' }).count()) && !(await p.getByRole('button', { name: /passkey/ }).count()),
		'prueba: no se ofrece passkey'
	);

	// Contraseña: alta, salir, error genérico, entrar.
	const CLAVE = 'mi trono patagonico';
	await p.getByLabel('Elegí un seudónimo').fill('clave_test');
	await p.getByText('✓ Está libre.').waitFor();
	await p.getByLabel('Elegí una contraseña').fill('corta');
	verificar(await p.getByText(/al menos 10 caracteres/).isVisible(), 'contraseña corta: avisa');
	await p.getByLabel('Elegí una contraseña').fill(CLAVE);
	await p.getByLabel('Tengo 18 años o más.').check();
	await p.getByRole('checkbox').nth(1).check();
	await p.getByRole('button', { name: 'Crear con contraseña' }).click();
	// Al entrar se va a "Mi trono"; los datos de la cuenta están en /app/cuenta.
	await p.waitForURL(BASE + '/app');
	await p.goto(BASE + '/app/cuenta');
	await p.getByText('@clave_test').waitFor();
	verificar(await p.getByText('🔒 Contraseña').isVisible(), 'alta con contraseña: entra y figura el método');
	const [huella] = await sql`select huella from claves`;
	verificar(huella.huella.startsWith('scrypt$') && !huella.huella.includes('trono'), 'en la base solo hay una huella scrypt, no la contraseña');
	await p.getByRole('button', { name: 'Salir' }).click();
	await p.waitForURL(BASE + '/');
	await p.goto(BASE + '/app/entrar?modo=entrar');
	await p.getByLabel('Tu seudónimo').fill('clave_test');
	await p.getByLabel('Tu contraseña').fill('otra cosa distinta');
	await p.getByRole('button', { name: 'Entrar', exact: true }).click();
	await p.getByText('Seudónimo o contraseña incorrectos.').waitFor();
	await p.getByLabel('Tu seudónimo').fill('no_existe_nadie');
	await p.getByLabel('Tu contraseña').fill(CLAVE);
	await p.getByRole('button', { name: 'Entrar', exact: true }).click();
	await p.getByText('Seudónimo o contraseña incorrectos.').waitFor();
	verificar(true, 'contraseña mal o seudónimo inexistente: el mismo mensaje');
	await p.getByLabel('Tu seudónimo').fill('Clave_Test');
	await p.getByLabel('Tu contraseña').fill(CLAVE);
	await p.getByRole('button', { name: 'Entrar', exact: true }).click();
	// Al entrar se va a "Mi trono"; los datos de la cuenta están en /app/cuenta.
	await p.waitForURL(BASE + '/app');
	await p.goto(BASE + '/app/cuenta');
	await p.getByText('@clave_test').waitFor();
	verificar(true, 'entrar con seudónimo y contraseña funciona');
	await p.getByRole('button', { name: 'Salir' }).click();
	await p.waitForURL(BASE + '/');

	await p.goto(BASE + '/app/entrar');
	await p.getByRole('radio', { name: 'Mail' }).click();
	await p.getByLabel('Tu mail').waitFor();
	await p.getByLabel('Elegí un seudónimo').fill('cagon_de_prueba');
	await p.getByLabel('Tengo 18 años o más.').check();
	await p.getByRole('checkbox').nth(1).check();
	await p.getByLabel('Tu mail').fill(MAIL);
	await p.getByRole('button', { name: 'Mandarme el link' }).click();
	await p.getByText('Revisá tu mail').waitFor();
	const linkAlta = await esperarLink(s, 'alta');
	verificar(Boolean(linkAlta) && linkAlta.includes('/app/entrar/mail#'), 'se generó el link de alta (con el token en el #)');
	verificar(!s.salida.includes(MAIL) && !s.salida.includes('ejemplo.com'), 'el mail no aparece en el log del servidor');

	await p.goto(linkAlta);
	await p.getByRole('button', { name: 'Continuar' }).click();
	// Al entrar se va a "Mi trono"; los datos de la cuenta están en /app/cuenta.
	await p.waitForURL(BASE + '/app');
	await p.goto(BASE + '/app/cuenta');
	await p.getByText('@cagon_de_prueba').waitFor();
	verificar(true, 'alta por mail: entra a "Mi cuenta"');
	verificar(!p.url().includes('#'), 'el token no queda en la barra de direcciones');

	await p.goto(linkAlta);
	await p.getByRole('button', { name: 'Continuar' }).click();
	await p.getByText('venció o ya se usó').waitFor();
	verificar(true, 'el link no se puede usar dos veces');

	const volcado = execFileSync('/usr/lib/postgresql/16/bin/pg_dump', ['--data-only', DATABASE_URL]).toString();
	verificar(!volcado.includes('ejemplo.com') && !volcado.includes('alguien.de.prueba'), 'el mail no está guardado en ninguna tabla (pg_dump)');
	verificar(!volcado.includes('trono patagonico'), 'la contraseña no está guardada en ninguna tabla (pg_dump)');

	await p.goto(BASE + '/app/cuenta');
	await p.getByRole('button', { name: 'Salir' }).click();
	await p.waitForURL(BASE + '/');
	await p.goto(BASE + '/app/entrar?modo=entrar');
	await p.getByRole('radio', { name: 'Mail' }).click();
	await p.getByLabel('Tu mail').fill(MAIL.toUpperCase());
	await p.getByRole('button', { name: 'Mandarme el link' }).click();
	await p.getByText('Revisá tu mail').waitFor();
	const linkEntrada = await esperarLink(s, 'entrada');
	verificar(Boolean(linkEntrada), 'entrar por mail (con mayúsculas) genera link de entrada');
	await p.goto(linkEntrada);
	await p.getByRole('button', { name: 'Continuar' }).click();
	// Al entrar se va a "Mi trono"; los datos de la cuenta están en /app/cuenta.
	await p.waitForURL(BASE + '/app');
	await p.goto(BASE + '/app/cuenta');
	await p.getByText('@cagon_de_prueba').waitFor();
	verificar(true, 'entrar con el link de mail funciona');

	const r = await fetch(BASE + '/api/v1/auth/mail/solicitar', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ mail: 'nadie@ejemplo.com' })
	});
	const linkSinCuenta = await esperarLink(s, 'sin_cuenta');
	verificar(r.status === 202 && Boolean(linkSinCuenta), 'mail sin cuenta: misma respuesta (202) y aviso al dueño del mail');

	const dup = await fetch(BASE + '/api/v1/auth/mail/solicitar', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ mail: 'otra@ejemplo.com', alta: { seudonimo: 'CAGON_DE_PRUEBA', mayor_de_edad: true, acepta_terminos: true } })
	});
	verificar(dup.status === 409, 'no deja crear otra cuenta con el mismo seudónimo');

	const menor = await fetch(BASE + '/api/v1/auth/mail/solicitar', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ mail: 'otra@ejemplo.com', alta: { seudonimo: 'nuevo_user', mayor_de_edad: false, acepta_terminos: true } })
	});
	verificar(menor.status === 400, 'sin declarar mayoría de edad no deja crear');

	for (const ruta of ['/terminos', '/privacidad']) {
		const t = await fetch(BASE + ruta);
		verificar(t.ok && (await t.text()).includes('Borrador'), `${ruta} existe y está marcado como borrador`);
	}

	// Asociar un mail a una cuenta creada sin mail (con contraseña; con passkey es igual).
	{
		const MAIL2 = 'segundo.mail@ejemplo.com';
		const alta = await p.request.post(BASE + '/api/v1/auth/clave/alta', {
			data: { seudonimo: 'sin_mail', clave: 'otra frase bastante larga', mayor_de_edad: true, acepta_terminos: true }
		});
		verificar(alta.ok(), 'cuenta sin mail creada');
		await p.goto(BASE + '/app/cuenta');
		await p.getByRole('heading', { name: 'Entrar con mail' }).waitFor();
		await p.getByLabel('Tu mail').fill(MAIL2);
		await p.getByRole('button', { name: 'Mandarme el link' }).click();
		await p.getByText('Te mandamos un link').waitFor();
		const linkVincular = await esperarLink(s, 'vincular');
		verificar(Boolean(linkVincular), 'asociar mail: manda un link para confirmar');
		const [antes] = await sql`select count(*)::int n from logins_mail l join cuentas c on c.id = l.cuenta_id where c.seudonimo = 'sin_mail'`;
		verificar(antes.n === 0, 'hasta abrir el link no se asocia nada');
		await p.goto(linkVincular);
		await p.getByRole('button', { name: 'Continuar' }).click();
		await p.getByText('¡Listo! Ya podés entrar con un link a tu mail.').waitFor();
		verificar(await p.getByText('Tenés un mail asociado').isVisible(), 'asociar mail: queda asociado');

		// Cambiar o quitar el mail pide haber entrado hace menos de 5 minutos.
		await sql`update sesiones set reautenticada_hasta = now() - interval '1 minute'`;
		const sinReauth = await p.request.post(BASE + '/api/v1/cuenta/mail', { data: { mail: 'otro.mail@ejemplo.com' } });
		const quitarSinReauth = await p.request.delete(BASE + '/api/v1/cuenta/mail');
		verificar(sinReauth.status() === 403 && quitarSinReauth.status() === 403, 'cambiar o quitar el mail sin reautenticación: 403');
		await p.goto(BASE + '/app/cuenta');
		await p.getByRole('button', { name: 'Cambiar mail' }).click();
		await p.getByLabel('Tu mail').fill('otro.mail@ejemplo.com');
		await p.getByRole('button', { name: 'Mandarme el link' }).click();
		await p.getByRole('link', { name: 'Volver a entrar' }).waitFor();
		verificar(true, 'en "Mi cuenta" pide volver a entrar, con el link');
		await sql`update sesiones set reautenticada_hasta = now() + interval '5 minutes'`;
		await p.goto(BASE + '/app/cuenta');

		// Un mail que ya es de otra cuenta: misma respuesta, el aviso va al mail.
		await p.request.delete(BASE + '/api/v1/cuenta/mail');
		const ajeno = await p.request.post(BASE + '/api/v1/cuenta/mail', { data: { mail: MAIL } });
		verificar(ajeno.status() === 202 && Boolean(await esperarLink(s, 'ya_asociado')), 'mail de otra cuenta: 202 y aviso solo al dueño del mail');
		const [dueno] = await sql`select c.seudonimo from logins_mail l join cuentas c on c.id = l.cuenta_id where c.seudonimo in ('sin_mail', 'cagon_de_prueba')`;
		verificar(dueno?.seudonimo === 'cagon_de_prueba', 'el mail ajeno sigue siendo de su cuenta');

		// Volver a asociar MAIL2 y entrar con él desde otro navegador.
		await p.request.post(BASE + '/api/v1/cuenta/mail', { data: { mail: MAIL2 } });
		const otraVez = await esperarLink(s, 'vincular');
		const canje = await fetch(BASE + '/api/v1/auth/mail/canjear', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token: otraVez.split('#')[1] })
		});
		verificar((await canje.json()).vinculado === true, 'el canje informa que se asoció');
		await fetch(BASE + '/api/v1/auth/mail/solicitar', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mail: MAIL2 })
		});
		const entrada = await esperarLink(s, 'entrada');
		const r2 = await fetch(BASE + '/api/v1/auth/mail/canjear', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token: entrada.split('#')[1] })
		});
		verificar((await r2.json()).seudonimo === 'sin_mail', 'después se puede entrar con ese mail');

		await p.goto(BASE + '/app/cuenta');
		p.once('dialog', (d) => d.accept());
		await p.getByRole('button', { name: 'Quitar' }).click();
		await p.getByLabel('Tu mail').waitFor();
		verificar(true, 'quitar el mail (queda la contraseña)');
		const volcado2 = execFileSync('/usr/lib/postgresql/16/bin/pg_dump', ['--data-only', DATABASE_URL]).toString();
		verificar(!volcado2.includes('segundo.mail'), 'el mail asociado tampoco se guarda en claro');
	}

	await contexto.close();
	await bajar(s);
}

// ---------- Producción sin proveedor de mail: solo passkeys ----------
{
	const s = await levantar('produccion', { MAIL_MODO: 'desactivado' });
	const c = await (await fetch(BASE + '/api/v1/config')).json();
	verificar(c.passkeys === true && c.mail === false, 'MAIL_MODO=desactivado: config informa solo passkeys');
	const r = await fetch(BASE + '/api/v1/auth/mail/solicitar', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ mail: 'x@ejemplo.com' })
	});
	verificar(r.status === 503, 'MAIL_MODO=desactivado: pedir link por mail responde 503');
	const contexto = await navegador.newContext();
	const p = await contexto.newPage();
	await p.goto(BASE + '/app/entrar');
	await p.getByRole('button', { name: 'Crear con passkey' }).waitFor();
	verificar(
		(await p.getByRole('radio', { name: 'Mail' }).count()) === 0 && (await p.getByRole('radio', { name: 'Contraseña' }).count()) === 1,
		'MAIL_MODO=desactivado: se ofrecen passkey y contraseña, no mail'
	);
	await contexto.close();
	await bajar(s);
}

await navegador.close();
await sql.end();
verificar(errores.length === 0, `sin errores en consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
console.log(fallas ? `\n${fallas} falla(s)` : '\nTodo bien');
process.exit(fallas ? 1 : 0);
