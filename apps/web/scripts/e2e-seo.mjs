// SEO y vista previa al compartir: robots.txt, sitemap.xml, noindex en /app,
// canonical, Open Graph y Twitter Card en las páginas públicas, y la imagen.
// Uso: pnpm build && DATABASE_URL=postgres://… node scripts/e2e-seo.mjs
import { spawn } from 'node:child_process';
import { setTimeout as esperar } from 'node:timers/promises';
import postgres from 'postgres';

const URL_DB = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/dondecague_test';
const sql = postgres(URL_DB, { onnotice: () => {} });
await sql.unsafe('drop schema if exists osm cascade; drop schema public cascade; create schema public;');
await sql.end();

let fallas = 0;
const ok = (c, t) => {
	console.log(`${c ? 'ok  ' : 'FALLA'} ${t}`);
	if (!c) fallas++;
};

async function levantar(entorno, puerto) {
	const base = `http://localhost:${puerto}`;
	const p = spawn('node', ['build'], {
		env: {
			...process.env,
			ENTORNO: entorno,
			PORT: String(puerto),
			ORIGIN: base,
			ORIGEN_PUBLICO: base,
			DATABASE_URL: URL_DB,
			PIMIENTA_MAIL: 'x'.repeat(40),
			MAIL_MODO: entorno === 'prueba' ? 'consola' : 'desactivado',
			OSM_IMPORTAR: 'no'
		},
		stdio: 'ignore'
	});
	for (let i = 0; i < 50; i++) {
		try {
			await fetch(base + '/robots.txt');
			break;
		} catch {
			await esperar(200);
		}
	}
	return { p, base };
}

const meta = (html, atributo, nombre) =>
	new RegExp(`<meta ${atributo}="${nombre}" content="([^"]*)"`).exec(html)?.[1] ?? null;

const { p, base: BASE } = await levantar('produccion', 4184);
try {
	const robots = await (await fetch(BASE + '/robots.txt')).text();
	ok(robots.includes('Disallow: /api/') && robots.includes(`Sitemap: ${BASE}/sitemap.xml`) && !robots.includes('Disallow: /app'), 'robots.txt: Disallow /api/, Sitemap, y /app/ sin Disallow (va con noindex)');

	const sm = await fetch(BASE + '/sitemap.xml');
	const xml = await sm.text();
	const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1].replace(BASE, ''), m[2]]);
	ok(sm.headers.get('content-type').startsWith('application/xml') && xml.startsWith('<?xml'), 'sitemap.xml es XML');
	ok(urls.map((u) => u[0]).join() === '/,/mapa,/cacas,/privacidad,/terminos', 'sitemap: las 5 páginas públicas');
	ok(urls.every(([, f]) => /^\d{4}-\d{2}(-\d{2})?$/.test(f)), `sitemap: lastmod válido (${urls.map((u) => u[1]).join(', ')})`);

	for (const [ruta] of urls) {
		const r = await fetch(BASE + ruta, { headers: { 'user-agent': 'WhatsApp/2.24.1.0 A' } });
		const html = await r.text();
		const cabeza = html.slice(0, html.indexOf('</head>'));
		const campos = {
			robots: meta(cabeza, 'name', 'robots'),
			description: meta(cabeza, 'name', 'description'),
			'og:title': meta(cabeza, 'property', 'og:title'),
			'og:description': meta(cabeza, 'property', 'og:description'),
			'og:url': meta(cabeza, 'property', 'og:url'),
			'og:image': meta(cabeza, 'property', 'og:image'),
			'og:locale': meta(cabeza, 'property', 'og:locale'),
			'og:site_name': meta(cabeza, 'property', 'og:site_name'),
			'twitter:card': meta(cabeza, 'name', 'twitter:card')
		};
		const canonical = /<link rel="canonical" href="([^"]+)"/.exec(cabeza)?.[1];
		const faltan = Object.entries(campos).filter(([, v]) => !v).map(([k]) => k);
		ok(r.ok && !r.headers.get('x-robots-tag') && campos.robots === 'index, follow', `${ruta}: se indexa`);
		ok(faltan.length === 0, `${ruta}: tiene ${Object.keys(campos).join(', ')}${faltan.length ? ' — faltan: ' + faltan.join(', ') : ''}`);
		ok(canonical === BASE + ruta && campos['og:url'] === BASE + ruta, `${ruta}: canonical y og:url absolutos`);
		ok(campos['og:image'] === BASE + '/og.png' && campos['og:locale'] === 'es_AR', `${ruta}: og:image absoluta y og:locale es_AR`);
		// WhatsApp lee solo el principio del HTML: las etiquetas tienen que estar temprano.
		ok(html.indexOf('og:image') < 32 * 1024, `${ruta}: las etiquetas están en los primeros 32 KB`);
	}

	const img = await fetch(BASE + '/og.png');
	const bytes = Buffer.from(await img.arrayBuffer());
	ok(img.headers.get('content-type') === 'image/png' && bytes.readUInt32BE(16) === 1200 && bytes.readUInt32BE(20) === 630, '/og.png: PNG de 1200×630');
	ok(bytes.length < 300 * 1024, `/og.png pesa ${Math.round(bytes.length / 1024)} KB (WhatsApp descarta imágenes pesadas)`);

	for (const ruta of ['/app', '/app/entrar', '/app/cuenta', '/app/mapa']) {
		const r = await fetch(BASE + ruta);
		const html = await r.text();
		ok(r.headers.get('x-robots-tag') === 'noindex, nofollow' && meta(html, 'name', 'robots') === 'noindex, nofollow', `${ruta}: noindex (cabecera y meta)`);
	}
	const api = await fetch(BASE + '/api/v1/config');
	ok(api.headers.get('x-robots-tag') === 'noindex, nofollow', '/api/: noindex');
} finally {
	p.kill();
}

// En prueba: nada se indexa y robots.txt no bloquea (si no, Google no lee el noindex).
const prueba = await levantar('prueba', 4185);
try {
	const robots = await (await fetch(prueba.base + '/robots.txt')).text();
	ok(!robots.includes('Disallow') && !robots.includes('Sitemap'), 'prueba: robots.txt sin Disallow ni Sitemap');
	const r = await fetch(prueba.base + '/mapa');
	ok(r.headers.get('x-robots-tag') === 'noindex, nofollow' && meta(await r.text(), 'name', 'robots') === 'noindex, nofollow', 'prueba: /mapa noindex');
} finally {
	prueba.p.kill();
}
console.log(fallas ? `${fallas} falla(s)` : 'Todo bien');
process.exit(fallas ? 1 : 0);
