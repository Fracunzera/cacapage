// Genera static/og.png (1200×630), la imagen que se ve al compartir un link
// (Open Graph / WhatsApp). Uso: node scripts/generar-og.mjs
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const fuente = (await readFile(require.resolve('@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2'))).toString('base64');
const logo = `<svg viewBox="0 0 64 64" width="300" height="300">
	<g stroke="#3b2314" stroke-width="2.6" stroke-linejoin="round">
		<ellipse cx="32" cy="50" rx="24" ry="9.5" fill="#8a5632" /><ellipse cx="32" cy="38" rx="18" ry="8.5" fill="#9b6339" />
		<ellipse cx="32" cy="27" rx="12" ry="7" fill="#a86e42" /><path d="M31 9c7 5 6 12 1 14c-4-2-6-8-1-14z" fill="#a86e42" />
	</g>
	<circle cx="26" cy="37" r="3.6" fill="#fff" stroke="#3b2314" stroke-width="1.6" /><circle cx="38" cy="37" r="3.6" fill="#fff" stroke="#3b2314" stroke-width="1.6" />
	<circle cx="26.8" cy="37.6" r="1.7" fill="#3b2314" /><circle cx="38.8" cy="37.6" r="1.7" fill="#3b2314" />
	<path d="M26.5 45.5c3.5 3 7.5 3 11 0" fill="none" stroke="#3b2314" stroke-width="2.4" stroke-linecap="round" />
	<ellipse cx="21" cy="44" rx="2.6" ry="1.5" fill="#f08a7e" /><ellipse cx="43" cy="44" rx="2.6" ry="1.5" fill="#f08a7e" />
</svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Fredoka; src: url(data:font/woff2;base64,${fuente}) format('woff2'); font-weight: 300 700; }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; font-family: Fredoka; color: #3b2314; background: #f6b40e;
  background-image: radial-gradient(rgba(59,35,20,.14) 2px, transparent 2px); background-size: 28px 28px; }
.marco { position: absolute; inset: 28px; border: 6px solid #3b2314; border-radius: 36px; background: #fff8ec;
  box-shadow: 12px 12px 0 #3b2314; display: flex; align-items: center; gap: 36px; padding: 0 60px 0 40px; }
h1 { font-size: 92px; line-height: .95; font-weight: 700; letter-spacing: -2px; }
.sub { margin-top: 22px; font-size: 32px; line-height: 1.25; font-weight: 500; }
.url { display: inline-block; margin-top: 28px; padding: 10px 24px; border: 4px solid #3b2314; border-radius: 999px;
  background: #3b2314; color: #f6b40e; font-size: 30px; font-weight: 700; }
.hoy { background: linear-gradient(transparent 62%, #f6b40e 62%, #f6b40e 92%, transparent 92%); }
</style></head><body><div class="marco">${logo}<div>
<h1>¿Dónde cagaste <span class="hoy">hoy</span>?</h1>
<p class="sub">Registrá, juntá medallas y encontrá baños<br>en toda la Argentina.</p>
<span class="url">dondecague.com.ar</span></div></div></body></html>`;

const navegador = await chromium.launch();
const p = await navegador.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html);
await p.evaluate(() => document.fonts.ready);
const destino = new URL('../static/og.png', import.meta.url);
await p.screenshot({ path: destino.pathname, type: 'png' });
await navegador.close();
console.log(`static/og.png: ${Math.round((await stat(destino)).size / 1024)} KB`);
