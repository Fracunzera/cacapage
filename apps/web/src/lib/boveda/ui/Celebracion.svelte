<script lang="ts">
	import type { Novedad } from '../modelo';
	import { DEMORA_HORAS } from '$lib/publicaciones';

	/** Una medalla, un logro, o una caca que entra al mapa público con su número. */
	export type Festejo = Novedad | { tipo: 'publica'; numero: number };

	let { novedad, oncerrar }: { novedad: Festejo; oncerrar: () => void } = $props();
	const redondo = (n: number) => n >= 100 && /^[1-9]0+$/.test(String(n));
	let boton: HTMLButtonElement;
	$effect(() => boton.focus());
</script>

<div class="fondo" role="presentation">
	<div class="cartel" role="dialog" aria-modal="true" aria-labelledby="festejo">
		{#if novedad.tipo === 'publica'}
			<p class="emoji" aria-hidden="true">🌎</p>
			<p class="etiqueta">¡Al mapa público!</p>
			<h2 id="festejo">Tu caca es la N.º {novedad.numero.toLocaleString('es-AR')} del mapa público</h2>
			{#if novedad.numero === 1}
				<p>¡La primera de todas! Pasás a la historia.</p>
			{:else if redondo(novedad.numero)}
				<p>¡Número redondo! 🎉</p>
			{/if}
			<p>Aparece en unas {DEMORA_HORAS} horas.</p>
		{:else}
			<p class="emoji" aria-hidden="true">{novedad.tipo === 'medalla' ? '🏅' : '🚽'}</p>
			<p class="etiqueta">{novedad.tipo === 'medalla' ? `¡Nueva medalla! · N.º ${novedad.numero}` : '¡Logro desbloqueado!'}</p>
			<h2 id="festejo">{novedad.nombre}</h2>
			{#if novedad.tipo === 'logro'}<p>{novedad.descripcion}</p>{/if}
			{#if novedad.tipo === 'medalla'}<p>{novedad.numero * 5} visitas al trono. Solo la ves vos.</p>{/if}
		{/if}
		<button type="button" class="u-boton" bind:this={boton} onclick={oncerrar}>¡Grande!</button>
	</div>
</div>

<style>
	.fondo {
		position: fixed;
		z-index: 20;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 16px;
		background: rgba(59, 35, 20, 0.55);
	}
	.cartel {
		width: 100%;
		max-width: 22rem;
		padding: 22px 18px 18px;
		border: var(--borde);
		border-radius: var(--radio);
		background: var(--sol-claro);
		box-shadow: var(--sombra);
		text-align: center;
		animation: aparece 0.35s cubic-bezier(0.2, 1.4, 0.4, 1);
	}
	.emoji {
		margin: 0;
		font-size: 64px;
		line-height: 1;
	}
	.etiqueta {
		margin: 10px 0 2px;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	h2 {
		margin: 0 0 8px;
		font-size: 26px;
		line-height: 1.1;
	}
	p {
		margin: 0 0 6px;
	}
	@keyframes aparece {
		from {
			transform: scale(0.6) rotate(-6deg);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cartel {
			animation: none;
		}
	}
</style>
