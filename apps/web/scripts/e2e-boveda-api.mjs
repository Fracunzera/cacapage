// API de la bóveda (historial cifrado) contra el build y un Postgres de prueba.
// Uso: pnpm build && DATABASE_URL=postgres://… node scripts/e2e-boveda-api.mjs
import { spawn } from 'node:child_process';
import postgres from 'postgres';
const URL_DB = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/dondecague_test';
const sql = postgres(URL_DB, { onnotice: () => {} });
await sql.unsafe('drop schema if exists osm cascade; drop schema public cascade; create schema public;');
const BASE = 'http://localhost:4177';
const p = spawn('node', ['build'], { env: { ...process.env, ENTORNO: 'prueba', PORT: '4177', ORIGIN: BASE, ORIGEN_PUBLICO: BASE, DATABASE_URL: URL_DB, PIMIENTA_MAIL: 'x'.repeat(40), MAIL_MODO: 'consola', OSM_IMPORTAR: 'no' } });
await new Promise((r) => setTimeout(r, 2500));
let fallas = 0;
const ok = (c, t) => { console.log(`${c ? 'ok  ' : 'FALLA'} ${t}`); if (!c) fallas++; };
let cookie = '';
async function api(ruta, metodo = 'GET', cuerpo) {
	const r = await fetch(BASE + '/api/v1' + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', cookie }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
	const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
	return { estado: r.status, datos: r.status === 204 ? null : await r.json().catch(() => null) };
}
try {
	ok((await api('/boveda')).estado === 401, 'sin sesión: 401');
	ok((await api('/auth/clave/alta', 'POST', { seudonimo: 'boveda_test', clave: 'una frase larga ok', mayor_de_edad: true, acepta_terminos: true })).estado === 200, 'alta con contraseña');
	const env = Buffer.alloc(60, 7).toString('base64url');
	ok((await api('/boveda/llaves', 'PUT', { metodo: 'recuperacion', envuelta: env, parametros: { kdf: 'PBKDF2', it: 600000 }, crear: true })).estado === 200, 'crear llave');
	ok((await api('/boveda/llaves', 'PUT', { metodo: 'recuperacion', envuelta: env, parametros: {}, crear: true })).estado === 409, 'segunda creación: 409 (no dos bóvedas)');
	const ll = await api('/boveda/llaves');
	ok(ll.datos.llaves.length === 1 && ll.datos.llaves[0].envuelta === env, 'leer llave envuelta');
	const pid = 'aaaaaaaaaaaaaaaaaaaaaa';
	const pag = { nonce: Buffer.alloc(12, 1).toString('base64url'), cifrado: Buffer.alloc(4096, 2).toString('base64url') };
	const r1 = await api(`/boveda/paginas/${pid}`, 'PUT', { ...pag, version_esperada: 0 });
	ok(r1.estado === 200 && r1.datos.version === 1, 'página nueva: versión 1');
	const r2 = await api(`/boveda/paginas/${pid}`, 'PUT', { ...pag, version_esperada: 0 });
	ok(r2.estado === 409 && r2.datos.version === 1, 'versión vieja: 409 con la versión actual');
	const r3 = await api(`/boveda/paginas/${pid}`, 'PUT', { ...pag, version_esperada: 1 });
	ok(r3.estado === 200 && r3.datos.version === 2 && r3.datos.seq > r1.datos.seq, 'actualizar: versión 2 y seq nueva');
	const g = await api(`/boveda?desde=${r1.datos.seq}`);
	ok(g.datos.paginas.length === 1 && g.datos.paginas[0].cifrado === pag.cifrado, 'leer desde seq devuelve la página');
	ok((await api(`/boveda?desde=${r3.datos.seq}`)).datos.paginas.length === 0, 'desde la última seq: nada nuevo');
	ok((await api('/boveda/paginas/corto', 'PUT', { ...pag, version_esperada: 0 })).estado === 400, 'id de página inválido: 400');
	// Tope por cuenta: 10 MB en total y 500 páginas.
	ok((await api('/boveda/paginas/demasiado_grande_0', 'PUT', { nonce: pag.nonce, cifrado: Buffer.alloc(256 * 1024 + 1).toString('base64url'), version_esperada: 0 })).estado === 400, 'una página de más de 256 KB: 400');
	const grande = { nonce: pag.nonce, cifrado: Buffer.alloc(256 * 1024, 3).toString('base64url') };
	const ids = Array.from({ length: 40 }, (_, i) => `grande${String(i).padStart(10, '0')}`);
	let estados = [];
	for (const id of ids.slice(0, 39)) estados.push((await api(`/boveda/paginas/${id}`, 'PUT', { ...grande, version_esperada: 0 })).estado);
	ok(estados.every((e) => e === 200), '39 páginas de 256 KB entran (casi 10 MB)');
	const lleno = await api(`/boveda/paginas/${ids[39]}`, 'PUT', { ...grande, version_esperada: 0 });
	ok(lleno.estado === 413 && /10 MB/.test(lleno.datos?.message), 'pasar los 10 MB: 413 con mensaje claro');
	const reemplazo = await api(`/boveda/paginas/${ids[0]}`, 'PUT', { ...grande, version_esperada: 1 });
	ok(reemplazo.estado === 200, 'reemplazar una página existente no cuenta doble');
	for (const id of ids.slice(0, 39)) await api(`/boveda/paginas/${id}`, 'DELETE');
	const chicas = await Promise.all(
		Array.from({ length: 505 }, (_, i) => api(`/boveda/paginas/chica${String(i).padStart(11, '0')}`, 'PUT', { ...pag, version_esperada: 0 }))
	);
	// Ya hay 1 página: de 505 en paralelo entran 499 y el resto choca con el tope (sin carreras).
	const cuenta = {};
	for (const r of chicas) cuenta[r.estado] = (cuenta[r.estado] ?? 0) + 1;
	ok(cuenta[200] === 499 && cuenta[413] === 6, `505 en paralelo: entran justo hasta 500 (${JSON.stringify(cuenta)})`);
	const otra = await api('/boveda/paginas/chica_de_mas_00000', 'PUT', { ...pag, version_esperada: 0 });
	ok(otra.estado === 413 && /500 páginas/.test(otra.datos?.message), 'la 501: 413 con mensaje claro');
	const [{ n }] = await sql`select count(*)::int n from boveda_paginas`;
	ok(n === 500, 'en la base quedaron exactamente 500');

	const [c] = await sql`select dias_activos from cuentas`;
	ok(c.dias_activos === 1, 'días activos: 1 (una vez por día)');
	await sql`update sesiones set reautenticada_hasta = now() + interval '5 minutes'`;
	ok((await api('/cuenta', 'DELETE')).estado === 204, 'borrar cuenta');
	const [t] = await sql`select (select count(*) from boveda_paginas)::int a, (select count(*) from boveda_llaves)::int b`;
	ok(t.a === 0 && t.b === 0, 'borrar la cuenta borra páginas y llaves');
} finally { p.kill(); await sql.end(); }
console.log(fallas ? `${fallas} falla(s)` : 'Todo bien'); process.exit(fallas ? 1 : 0);
