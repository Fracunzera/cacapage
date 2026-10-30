<script lang="ts">
	// Con quién se comparte una caca, y los botones para cambiarlo (P-38, P-43).
	// Lo usan el historial y Mi mapa.
	import { compartidaCon, sePuedePublicar, type Compartir } from '../publicar';
	import type { Registro } from '../modelo';
	import ConfirmarPublico from './ConfirmarPublico.svelte';

	let {
		registro,
		seudonimo,
		ocupado = false,
		oncambiar
	}: {
		registro: Registro;
		seudonimo: string;
		ocupado?: boolean;
		oncambiar: (r: Registro, con: Compartir, conComentario: boolean) => void;
	} = $props();

	let confirmando = $state<'amigos' | 'publico' | null>(null);
	const actual = $derived(compartidaCon(registro));
	const numero = $derived(registro.numero_publico ? ` (N.º ${registro.numero_publico.toLocaleString('es-AR')})` : '');
</script>

{#if actual === 'publico'}
	<p class="u-ayuda">🌎 Pública: está en el mapa de cacas{numero}.</p>
{:else if actual === 'amigos'}
	<p class="u-ayuda">👥 Compartida con tus amigos.</p>
{/if}

{#if sePuedePublicar(registro, 'amigos')}
	<div class="botones">
		{#if actual !== 'amigos'}
			<button type="button" class="u-enlace" disabled={ocupado} onclick={() => (confirmando = 'amigos')}
				>{actual === 'publico' ? '👥 Solo para amigos' : '👥 Compartir con amigos'}</button
			>
		{/if}
		{#if actual !== 'publico' && sePuedePublicar(registro)}
			<button type="button" class="u-enlace" disabled={ocupado} onclick={() => (confirmando = 'publico')}>🌎 Hacerla pública</button>
		{/if}
		{#if actual !== 'privada'}
			<button type="button" class="u-enlace" disabled={ocupado} onclick={() => oncambiar(registro, 'privada', false)}>🔒 Hacerla privada</button>
		{/if}
	</div>
{:else if actual === 'privada'}
	<p class="u-ayuda">Sin ubicación no se puede compartir.</p>
{/if}

{#if confirmando}
	<ConfirmarPublico
		{registro}
		alcance={confirmando}
		{seudonimo}
		onsi={(c) => {
			// Se lee antes de cerrar: después de cerrar, `confirmando` ya es null.
			const con = confirmando;
			confirmando = null;
			if (con) oncambiar(registro, con, c);
		}}
		onno={() => (confirmando = null)}
	/>
{/if}

<style>
	.botones {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 16px;
		margin: 2px 0 4px;
	}
</style>
