<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Logo from '$lib/ui/Logo.svelte';
	import { api, ErrorApi } from '$lib/cliente/api';
	import { Boveda } from '$lib/boveda/boveda';
	import { mailValido } from '$lib/cuentas/validacion';

	interface Cuenta {
		seudonimo: string;
		creada_en: string;
		metodos: { passkeys: number; mail: boolean; clave: boolean; google: boolean };
		reautenticada: boolean;
	}

	let cuenta = $state<Cuenta | null>(null);
	let error = $state<string | null>(null);
	let borrando = $state(false);
	let confirmacion = $state('');
	let pidiendoBorrar = $state(false);
	let mailDisponible = $state(false);
	let mail = $state('');
	let mandando = $state(false);
	let mailMandado = $state(false);
	let mailAsociado = $state(false);
	let cambiandoMail = $state(false);
	let googleDisponible = $state(false);
	let avisoGoogle = $state<string | null>(null);
	const AVISOS_GOOGLE: Record<string, string> = {
		asociado: '¡Listo! Ya podés entrar con Google.',
		ya_usado: 'Esa cuenta de Google ya se usa para entrar con otro seudónimo.',
		error: 'No se pudo asociar Google. Probá de nuevo.'
	};

	async function cargar() {
		cuenta = await api<Cuenta>('/cuenta');
	}

	onMount(async () => {
		const params = new URL(location.href).searchParams;
		mailAsociado = params.get('mail') === 'asociado';
		const g = params.get('google');
		if (g) avisoGoogle = AVISOS_GOOGLE[g] ?? AVISOS_GOOGLE.error;
		if (mailAsociado || g) history.replaceState(null, '', location.pathname);
		api<{ mail: boolean; google: boolean }>('/config').then(
			(c) => {
				mailDisponible = c.mail;
				googleDisponible = c.google;
			},
			() => {}
		);
		try {
			await cargar();
		} catch (e) {
			if (e instanceof ErrorApi && e.estado === 401) await goto('/app/entrar?modo=entrar');
			else error = e instanceof ErrorApi ? e.message : 'No se pudo cargar la cuenta.';
		}
	});

	async function salir() {
		await api('/auth/salir', { cuerpo: {} }).catch(() => {});
		// La copia local del historial no queda en el celular (P-03).
		await Boveda.olvidar();
		await goto('/');
	}

	async function asociarMail() {
		mandando = true;
		error = null;
		error = null;
		try {
			await api('/cuenta/mail', { cuerpo: { mail } });
			mailMandado = true;
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo mandar el mail.';
		} finally {
			mandando = false;
		}
	}

	async function asociarGoogle() {
		error = null;
		try {
			const { url } = await api<{ url: string }>('/auth/google/inicio', { cuerpo: { modo: 'vincular' } });
			location.href = url;
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo ir a Google.';
		}
	}

	async function quitarGoogle() {
		if (!confirm('¿Quitar Google? Vas a entrar con tus otros métodos.')) return;
		error = null;
		try {
			await api('/cuenta/google', { metodo: 'DELETE' });
			await cargar();
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo quitar Google.';
		}
	}

	async function quitarMail() {
		if (!confirm('¿Quitar el mail? Vas a poder entrar solo con tu passkey o tu contraseña.')) return;
		error = null;
		try {
			await api('/cuenta/mail', { metodo: 'DELETE' });
			await cargar();
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo quitar el mail.';
		}
	}

	async function borrar() {
		borrando = true;
		error = null;
		try {
			await api('/cuenta', { metodo: 'DELETE' });
			await Boveda.olvidar();
			await goto('/?cuenta=borrada');
		} catch (e) {
			error = e instanceof ErrorApi ? e.message : 'No se pudo borrar la cuenta.';
		} finally {
			borrando = false;
		}
	}

	const fecha = (iso: string) =>
		new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
</script>

<svelte:head>
	<title>Mi cuenta · Dónde Cagué</title>
</svelte:head>

<header class="u-tope">
	<a href="/" aria-label="Inicio"><Logo tamanio={32} conNombre={false} /></a>
	<h1>Mi cuenta</h1>
</header>

<main class="u-pagina">
	{#if cuenta}
		<section class="u-tarjeta saludo">
			<p class="hola">Hola,</p>
			<p class="seudonimo">@{cuenta.seudonimo}</p>
			<p class="u-ayuda">En el trono desde el {fecha(cuenta.creada_en)}.</p>
		</section>

		<section class="u-tarjeta">
			<h2>Cómo entrás</h2>
			<ul>
				{#if cuenta.metodos.passkeys}<li>🔑 Passkey ({cuenta.metodos.passkeys})</li>{/if}
				{#if cuenta.metodos.clave}<li>🔒 Contraseña</li>{/if}
				{#if cuenta.metodos.google}<li>🌐 Google (solo un identificador: ni tu mail ni tu nombre)</li>{/if}
				{#if cuenta.metodos.mail}<li>✉️ Link por mail (tu mail no se guarda: solo una huella para reconocerlo)</li>{/if}
			</ul>
			<button type="button" class="u-boton sec" onclick={salir}>Salir</button>
			<p class="u-ayuda">Al salir se borra la copia del historial de este celular. Vuelve sola cuando entrás de nuevo.</p>
		</section>

		<a class="u-boton volver" href="/app">💩 Ir a mi trono</a>

		{#if googleDisponible}
			<section class="u-tarjeta">
				<h2>Entrar con Google</h2>
				{#if avisoGoogle}<p class={avisoGoogle.startsWith('¡') ? 'u-ok' : 'u-error'} role="status">{avisoGoogle}</p>{/if}
				{#if cuenta.metodos.google}
					<p>Podés entrar con tu cuenta de Google.</p>
					{#if cuenta.metodos.passkeys || cuenta.metodos.clave || cuenta.metodos.mail}
						<button type="button" class="u-enlace quitar" onclick={quitarGoogle}>Quitar Google</button>
					{/if}
				{:else}
					<p>Asociá tu cuenta de Google para entrar con un toque.</p>
					<button type="button" class="u-boton sec" onclick={asociarGoogle}>Asociar Google</button>
					<p class="u-ayuda">Le pedimos solo un identificador: ni tu mail ni tu nombre. Google sí se entera de que entrás acá.</p>
				{/if}
			</section>
		{/if}

		{#if mailDisponible}
			<section class="u-tarjeta">
				<h2>Entrar con mail</h2>
				{#if mailAsociado}<p class="u-ok" role="status">¡Listo! Ya podés entrar con un link a tu mail.</p>{/if}
				{#if cuenta.metodos.mail && !cambiandoMail}
					<p>✉️ Tenés un mail asociado: podés pedir un link para entrar desde cualquier celular.</p>
					<p class="u-ayuda">No lo guardamos: solo una huella para reconocerlo. Por eso no te lo podemos mostrar.</p>
					<div class="acciones-mail">
						<button type="button" class="u-enlace" onclick={() => (cambiandoMail = true)}>Cambiar mail</button>
						{#if cuenta.metodos.passkeys || cuenta.metodos.clave || cuenta.metodos.google}
							<button type="button" class="u-enlace quitar" onclick={quitarMail}>Quitar</button>
						{/if}
					</div>
				{:else if mailMandado}
					<p class="u-ok" role="status">Te mandamos un link a <strong>{mail}</strong>. Abrilo para confirmar (vale 15 minutos).</p>
					<button type="button" class="u-enlace" onclick={() => (mailMandado = false)}>Usar otro mail</button>
				{:else}
					<p>Asociá un mail para poder entrar también con un link, por ejemplo desde un celular nuevo.</p>
					<label class="u-campo">
						<span>Tu mail</span>
						<input type="email" bind:value={mail} autocomplete="email" inputmode="email" autocapitalize="none" />
					</label>
					<button type="button" class="u-boton sec" disabled={!mailValido(mail) || mandando} onclick={asociarMail}>
						{mandando ? 'Mandando…' : 'Mandarme el link'}
					</button>
					<p class="u-ayuda">No guardamos tu mail: solo una huella para reconocerlo cuando pidas un link.</p>
				{/if}
			</section>
		{/if}

		<section class="u-tarjeta">
			<h2>Borrar la cuenta</h2>
			{#if !pidiendoBorrar}
				<p>Se borra todo, en el acto y para siempre.</p>
				<button type="button" class="u-boton peligro" onclick={() => (pidiendoBorrar = true)}>Borrar mi cuenta</button>
			{:else}
				<label class="u-campo">
					<span>Escribí <strong>{cuenta.seudonimo}</strong> para confirmar</span>
					<input type="text" bind:value={confirmacion} autocomplete="off" autocapitalize="none" />
				</label>
				<button
					type="button"
					class="u-boton peligro"
					disabled={confirmacion.trim().toLowerCase() !== cuenta.seudonimo || borrando}
					onclick={borrar}>{borrando ? 'Borrando…' : 'Borrar para siempre'}</button
				>
				{#if !cuenta.reautenticada}
					<p class="u-ayuda">
						Por seguridad hay que haber entrado hace menos de 5 minutos.
						<a href="/app/entrar?modo=entrar">Volver a entrar</a>.
					</p>
				{/if}
				<button type="button" class="u-enlace" onclick={() => (pidiendoBorrar = false)}>Mejor no</button>
			{/if}
		</section>
	{:else if !error}
		<p>Cargando…</p>
	{/if}
	{#if error}
		<p class="u-error" role="alert">
			{error}
			{#if error.includes('volvé a entrar')}<a href="/app/entrar?modo=entrar">Volver a entrar</a>{/if}
		</p>
	{/if}
</main>

<style>
	h2 {
		margin: 0 0 10px;
		font-size: 20px;
	}
	p {
		margin: 0 0 8px;
	}
	.saludo {
		background: var(--celeste-claro);
	}
	.hola {
		margin: 0;
		font-size: 18px;
	}
	.seudonimo {
		margin: 0 0 4px;
		font-size: 32px;
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	ul {
		margin: 0 0 4px;
		padding-left: 0;
		list-style: none;
	}
	li {
		margin-bottom: 6px;
	}
	.acciones-mail {
		display: flex;
		gap: 18px;
	}
	.quitar {
		color: var(--rojo);
	}
	.volver {
		margin: 0 0 18px;
	}
	a {
		color: var(--tinta);
		font-weight: 600;
	}
</style>
