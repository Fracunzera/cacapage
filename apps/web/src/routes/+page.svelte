<script lang="ts">
	import Logo from '$lib/ui/Logo.svelte';
	let { data } = $props();

	const PASOS = [
		{
			n: '01',
			titulo: 'Registrá',
			texto: 'Dos toques y listo. Tu ubicación y tu historial no salen de tu celular: solo los ves vos.',
			enlace: '/app',
			textoEnlace: 'Registrar →'
		},
		{
			n: '02',
			titulo: 'Juntá medallas',
			texto: 'Una cada 5 visitas al trono. "Sommelier de Papel Higiénico", "Resistencia al Viento Patagónico" y 38 más.',
			enlace: '/app',
			textoEnlace: 'Ver mis medallas →'
		},
		{
			n: '03',
			titulo: 'Encontrá baño',
			texto: '¿Qué baño está abierto el domingo? ¿Cuál cobra? ¿Cuál tiene cambiador? El mapa lo armamos entre todos.',
			enlace: '/mapa',
			textoEnlace: 'Ver el mapa →'
		}
	];
	const MEDALLAS = ['Debut en el Trono', 'Bodas de Plata con el Inodoro', 'Pingüino Emperador', 'Trono de Oro'];
</script>

<svelte:head>
	<title>Dónde Cagué · ¿Dónde cagaste hoy?</title>
	<meta name="description" content="Registrá dónde cagaste, juntá medallas y encontrá baños abiertos en toda la Argentina." />
</svelte:head>

<header class="barra">
	<Logo tamanio={36} />
	<span class="pastilla">Argentina · beta</span>
</header>

<main>
	<section class="hero">
		<p class="etiqueta">Hecho en la Patagonia</p>
		<h1>¿Dónde<br />cagaste <span class="subrayado">hoy</span>?</h1>
		<p class="bajada">
			Registrá tus visitas al trono, juntá medallas absurdas y armemos entre todos el mapa de baños que la
			Argentina se merece.
		</p>

		<a class="boton principal" href="/app/entrar">Crear mi cuenta</a>
		<p class="aclaracion">¿Ya tenés? <a href="/app/entrar?modo=entrar">Entrá acá</a>.</p>
		<a class="boton secundario" href="/mapa">🧻 Buscar un baño cerca</a>
		{#if data.esPrueba}
			<a class="boton secundario" href="/app/relevamiento">Relevar baños en la calle</a>
		{/if}

		<div class="postal" aria-hidden="true">
			<div class="postal-cabeza">
				<Logo tamanio={28} conNombre={false} />
				<span>Mis medallas</span>
			</div>
			<ul>
				{#each MEDALLAS as m, i (m)}
					<li class:ganada={i < 3}><span class="medalla">{i < 3 ? '🏅' : '🔒'}</span>{m}</li>
				{/each}
			</ul>
			<span class="sticker">¡Nueva medalla!</span>
		</div>
	</section>

	<div class="cinta" aria-hidden="true">
		<span>Registrá</span><span>★</span><span>Juntá medallas</span><span>★</span><span>Encontrá baño</span><span>★</span
		><span>Registrá</span>
	</div>

	<section class="pasos">
		<p class="etiqueta">Un proceso muy serio, en tres pasos</p>
		<h2>Del inodoro al mapa.</h2>
		<ol>
			{#each PASOS as p (p.n)}
				<li class="tarjeta">
					<span class="numero">{p.n}</span>
					<h3>{p.titulo}</h3>
					<p>{p.texto}</p>
					{#if p.enlace}
						<a class="pronto ya" href={p.enlace}>{p.textoEnlace}</a>
					{:else}
						<span class="pronto">Próximamente</span>
					{/if}
				</li>
			{/each}
		</ol>
	</section>

	<section class="privacidad">
		<h2>Lo tuyo es tuyo.</h2>
		<p>
			Así lo diseñamos: lo que registres queda cifrado en tu celular. Al mapa público solo van los baños, nunca
			tus horarios ni tu casa.
		</p>
	</section>
</main>

<footer class="pie">
	<Logo tamanio={28} />
	<p>Hecho en Río Gallegos, para todo el país. <a href="/privacidad">Privacidad</a> · <a href="/terminos">Términos</a></p>
</footer>

<style>
	.barra {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
		background: var(--sol);
		border-bottom: var(--borde);
	}
	:global(.banner-prueba + .raiz) .barra {
		padding-top: 12px;
	}
	.pastilla {
		padding: 4px 10px;
		border: 2px solid var(--tinta);
		border-radius: 999px;
		background: var(--crema);
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
	}
	main {
		overflow-x: hidden;
	}
	.hero {
		position: relative;
		padding: 28px 16px 40px;
		background: var(--celeste-claro);
		background-image: radial-gradient(rgba(59, 35, 20, 0.12) 1.2px, transparent 1.2px);
		background-size: 18px 18px;
		border-bottom: var(--borde);
	}
	.etiqueta {
		display: inline-block;
		margin: 0 0 14px;
		padding: 6px 12px;
		border: 2px solid var(--tinta);
		border-radius: 999px;
		background: var(--papel);
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	h1 {
		margin: 0 0 16px;
		font-size: clamp(52px, 15vw, 96px);
		font-weight: 700;
		line-height: 0.95;
		letter-spacing: -0.03em;
	}
	.subrayado {
		background: linear-gradient(transparent 62%, var(--sol) 62%, var(--sol) 92%, transparent 92%);
	}
	.bajada {
		max-width: 34rem;
		margin: 0 0 22px;
		font-size: 19px;
	}
	.boton {
		display: block;
		max-width: 26rem;
		padding: 16px 20px;
		border: var(--borde);
		border-radius: var(--radio);
		box-shadow: var(--sombra);
		font-size: 19px;
		font-weight: 700;
		text-align: center;
		text-decoration: none;
	}
	.principal {
		background: var(--tinta);
		color: var(--sol);
	}
	.principal:active {
		transform: translate(3px, 3px);
		box-shadow: 1px 1px 0 var(--tinta);
	}
	.secundario {
		margin-top: 18px;
		background: var(--papel);
		color: var(--tinta);
		box-shadow: var(--sombra-chica);
		font-size: 17px;
	}
	.aclaracion a {
		color: var(--tinta);
		font-weight: 700;
	}
	.aclaracion {
		max-width: 26rem;
		margin: 12px 0 0;
		color: var(--tinta-suave);
		font-size: 15px;
	}
	.postal {
		position: relative;
		max-width: 22rem;
		margin: 34px 0 0 auto;
		padding: 14px;
		border: var(--borde);
		border-radius: var(--radio);
		background: var(--papel);
		box-shadow: 6px 6px 0 var(--tinta);
		transform: rotate(-2deg);
	}
	.postal-cabeza {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-bottom: 8px;
		border-bottom: 2px solid var(--tinta);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 14px;
	}
	.postal ul {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
	}
	.postal li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 0;
		color: var(--tinta-suave);
		font-size: 15px;
	}
	.postal li.ganada {
		color: var(--tinta);
		font-weight: 600;
	}
	.medalla {
		font-size: 18px;
	}
	.sticker {
		position: absolute;
		top: -18px;
		right: -10px;
		padding: 8px 12px;
		border: var(--borde);
		border-radius: 999px;
		background: var(--sol);
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		transform: rotate(8deg);
	}
	.cinta {
		display: flex;
		gap: 18px;
		padding: 12px 16px;
		overflow: hidden;
		background: var(--tinta);
		color: var(--sol);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		white-space: nowrap;
	}
	.pasos {
		padding: 36px 16px;
	}
	h2 {
		margin: 0 0 20px;
		font-size: clamp(36px, 10vw, 56px);
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.02em;
	}
	ol {
		display: grid;
		gap: 18px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	@media (min-width: 760px) {
		ol {
			grid-template-columns: repeat(3, 1fr);
		}
		.hero,
		.pasos,
		.privacidad {
			padding-left: max(16px, calc((100vw - 1000px) / 2));
			padding-right: max(16px, calc((100vw - 1000px) / 2));
		}
		.postal {
			position: absolute;
			right: max(16px, calc((100vw - 1000px) / 2));
			bottom: 40px;
			width: 22rem;
		}
	}
	.tarjeta {
		position: relative;
		padding: 18px;
		border: var(--borde);
		border-radius: var(--radio);
		background: var(--papel);
		box-shadow: var(--sombra);
	}
	.numero {
		display: inline-block;
		padding: 2px 10px;
		border: 2px solid var(--tinta);
		border-radius: 999px;
		background: var(--celeste-claro);
		font-weight: 700;
	}
	h3 {
		margin: 10px 0 6px;
		font-size: 24px;
	}
	.tarjeta p {
		margin: 0 0 12px;
	}
	.pronto {
		font-size: 13px;
		font-weight: 600;
		color: var(--tinta-suave);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.pronto.ya {
		color: var(--tinta);
		text-decoration: underline;
		text-decoration-color: var(--sol);
		text-decoration-thickness: 3px;
	}
	.privacidad {
		padding: 32px 16px 40px;
		background: var(--sol-claro);
		border-top: var(--borde);
		border-bottom: var(--borde);
	}
	.privacidad p {
		max-width: 36rem;
		margin: 0;
		font-size: 19px;
	}
	.pie {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 18px 16px 28px;
	}
	.pie p {
		margin: 0;
		color: var(--tinta-suave);
		font-size: 14px;
	}
	.pie a {
		color: var(--tinta);
	}
</style>
