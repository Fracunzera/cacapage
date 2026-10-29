<script lang="ts">
	// La advertencia antes de publicar (PRIVACY.md P-38): qué se va a ver, dicho claro.
	import { DEMORA_MINUTOS } from '$lib/publicaciones';
	import { TIPOS, type Registro } from '../modelo';

	let {
		registro,
		seudonimo,
		onsi,
		onno
	}: { registro: Pick<Registro, 'tipo' | 'banio_nombre' | 'ocurrido_en' | 'banio_id'>; seudonimo: string; onsi: () => void; onno: () => void } =
		$props();
	const tipo = $derived(TIPOS.find((t) => t.id === registro.tipo));
	const dia = $derived(new Date(registro.ocurrido_en).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }));
	let boton: HTMLButtonElement;
	$effect(() => boton.focus());
</script>

<div class="fondo" role="presentation">
	<div class="cartel" role="alertdialog" aria-modal="true" aria-labelledby="titulo-publico" aria-describedby="detalle-publico">
		<h2 id="titulo-publico">¿Querés que esta caca sea pública?</h2>
		<div id="detalle-publico">
			<p>Cualquiera va a poder ver en el mapa público de cacas:</p>
			<ul>
				<li>👤 Tu seudónimo, <strong>@{seudonimo}</strong></li>
				<li>
					📍
					{#if registro.banio_id}El baño: <strong>{registro.banio_nombre}</strong>
					{:else}<strong>El lugar donde estabas</strong> ({tipo?.texto.toLowerCase()}), con unos 10 m de precisión{/if}
				</li>
				<li>📅 El día: {dia}</li>
			</ul>
			<p class="u-ayuda">
				No se ve la hora ni tu anécdota. Vos la ves enseguida; los demás, en unos {DEMORA_MINUTOS} minutos, para que nadie sepa dónde estás en este momento. La
				podés volver a poner privada cuando quieras.
			</p>
		</div>
		<button type="button" class="u-boton" bind:this={boton} onclick={onsi}>Sí, hacerla pública</button>
		<button type="button" class="u-enlace" onclick={onno}>Mejor no</button>
	</div>
</div>

<style>
	.fondo {
		position: fixed;
		z-index: 30;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 16px;
		background: rgba(59, 35, 20, 0.55);
	}
	.cartel {
		width: 100%;
		max-width: 24rem;
		max-height: 90dvh;
		overflow-y: auto;
		padding: 20px 18px 14px;
		border: var(--borde);
		border-radius: var(--radio);
		background: var(--papel);
		box-shadow: var(--sombra);
	}
	h2 {
		margin: 0 0 10px;
		font-size: 22px;
		line-height: 1.15;
	}
	p {
		margin: 0 0 8px;
	}
	ul {
		margin: 0 0 10px;
		padding: 0;
		list-style: none;
	}
	li {
		margin-bottom: 6px;
		overflow-wrap: anywhere;
	}
</style>
