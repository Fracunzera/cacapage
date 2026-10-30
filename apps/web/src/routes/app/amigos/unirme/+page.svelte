<script lang="ts">
	// Abrir un link de invitación de amigos. El token viene en el fragmento (#):
	// no viaja al servidor al abrir el link. Sin cuenta, se guarda en el
	// navegador hasta entrar (lo retoma "Mi trono").
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Logo from '$lib/ui/Logo.svelte';
	import { api, ErrorApi } from '$lib/cliente/api';

	let token = $state('');
	let conCuenta = $state<boolean | null>(null);
	let amigo = $state<string | null>(null);
	let yaEran = $state(false);
	let ocupado = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		token = location.hash.slice(1);
		history.replaceState(null, '', location.pathname);
		try {
			await api('/cuenta');
			conCuenta = true;
		} catch {
			conCuenta = false;
			try {
				if (token) sessionStorage.setItem('invitacion', token);
			} catch {
				// Sin almacenamiento: habrá que abrir el link de nuevo después de entrar.
			}
		}
	});

	async function sumarme() {
		ocupado = true;
		error = null;
		try {
			const r = await api<{ seudonimo: string; ya_eran: boolean }>('/amigos/aceptar', { cuerpo: { token } });
			amigo = r.seudonimo;
			yaEran = r.ya_eran;
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo. Probá de nuevo.';
		} finally {
			ocupado = false;
		}
	}
</script>

<svelte:head>
	<title>Te invitaron · Dónde Cagué</title>
</svelte:head>

<header class="u-tope">
	<a href="/" aria-label="Inicio"><Logo tamanio={32} conNombre={false} /></a>
	<h1>Te invitaron</h1>
</header>

<main class="u-pagina">
	<section class="u-tarjeta">
		{#if !token}
			<h2>Este link no sirve</h2>
			<p>Pedile a quien te invitó que te lo mande de nuevo.</p>
		{:else if amigo}
			<h2>{yaEran ? `Ya eras amigo de @${amigo}` : `¡Listo! Ahora sos amigo de @${amigo}`}</h2>
			<p>Van a ver lo que se compartan con "👥 Mis amigos".</p>
			<a class="u-boton" href="/app/amigos">Ver mis amigos</a>
		{:else if conCuenta}
			<h2>Sumate a sus amigos</h2>
			<p>Van a poder ver lo que se compartan entre ustedes. Nada de lo que tengas privado.</p>
			<button type="button" class="u-boton" disabled={ocupado} onclick={sumarme}>{ocupado ? 'Un momento…' : 'Sumarme'}</button>
		{:else if conCuenta === false}
			<h2>Te invitaron a Dónde Cagué</h2>
			<p>Entrá o creá tu cuenta y quedás como amigo de quien te invitó.</p>
			<button type="button" class="u-boton" onclick={() => goto('/app/entrar')}>Entrar o crear cuenta</button>
		{:else}
			<p>Cargando…</p>
		{/if}
		{#if error}<p class="u-error" role="alert">{error}</p>{/if}
	</section>
</main>

<style>
	h2 {
		margin: 0 0 8px;
		font-size: 22px;
	}
	p {
		margin: 0 0 10px;
	}
</style>
