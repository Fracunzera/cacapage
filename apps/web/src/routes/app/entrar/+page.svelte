<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
	import Logo from '$lib/ui/Logo.svelte';
	import { api, ErrorApi } from '$lib/cliente/api';
	import { mailValido, normalizarSeudonimo, problemaAlta, problemaSeudonimo } from '$lib/cuentas/validacion';

	type Modo = 'crear' | 'entrar';
	let modo = $state<Modo>('crear');
	let passkeys = $state<boolean | null>(null);
	let mailHabilitado = $state(true);
	let usarMail = $state(false);

	let seudonimo = $state('');
	let disponible = $state<boolean | null>(null);
	let mayor = $state(false);
	let acepta = $state(false);
	let mail = $state('');

	let ocupado = $state(false);
	let error = $state<string | null>(null);
	let mailEnviado = $state(false);

	const problemaSeud = $derived(seudonimo ? problemaSeudonimo(seudonimo) : null);
	const altaLista = $derived(problemaAlta({ seudonimo, mayor_de_edad: mayor, acepta_terminos: acepta }) === null && disponible !== false);

	let temporizador: ReturnType<typeof setTimeout> | undefined;
	function revisarSeudonimo() {
		disponible = null;
		clearTimeout(temporizador);
		if (!seudonimo || problemaSeudonimo(seudonimo)) return;
		const pedido = normalizarSeudonimo(seudonimo);
		temporizador = setTimeout(async () => {
			try {
				const r = await api<{ disponible: boolean }>(`/seudonimos/${encodeURIComponent(pedido)}`);
				if (normalizarSeudonimo(seudonimo) === pedido) disponible = r.disponible;
			} catch {
				disponible = null;
			}
		}, 350);
	}

	function cambiarModo(m: Modo) {
		modo = m;
		error = null;
		mailEnviado = false;
		usarMail = passkeys === false;
	}

	function mensaje(e: unknown): string {
		if (e instanceof ErrorApi) return e.message;
		const nombre = (e as { name?: string })?.name;
		if (nombre === 'NotAllowedError') return 'Se canceló o venció el pedido de la passkey. Probá de nuevo.';
		if (nombre === 'InvalidStateError') return 'Este dispositivo ya tiene una passkey para esta cuenta.';
		return 'Algo salió mal. Probá de nuevo.';
	}

	async function crearConPasskey() {
		ocupado = true;
		error = null;
		try {
			const { desafio_id, opciones } = await api<{ desafio_id: string; opciones: never }>('/auth/passkey/alta/opciones', {
				cuerpo: { seudonimo, mayor_de_edad: mayor, acepta_terminos: acepta }
			});
			const respuesta = await startRegistration({ optionsJSON: opciones });
			await api('/auth/passkey/alta/verificar', { cuerpo: { desafio_id, respuesta } });
			await goto('/app/cuenta');
		} catch (e) {
			error = mensaje(e);
		} finally {
			ocupado = false;
		}
	}

	async function entrarConPasskey() {
		ocupado = true;
		error = null;
		try {
			const { desafio_id, opciones } = await api<{ desafio_id: string; opciones: never }>('/auth/passkey/entrada/opciones', {
				cuerpo: {}
			});
			const respuesta = await startAuthentication({ optionsJSON: opciones });
			await api('/auth/passkey/entrada/verificar', { cuerpo: { desafio_id, respuesta } });
			await goto('/app/cuenta');
		} catch (e) {
			error = mensaje(e);
		} finally {
			ocupado = false;
		}
	}

	async function pedirLink() {
		ocupado = true;
		error = null;
		try {
			await api('/auth/mail/solicitar', {
				cuerpo:
					modo === 'crear'
						? { mail, alta: { seudonimo, mayor_de_edad: mayor, acepta_terminos: acepta } }
						: { mail }
			});
			mailEnviado = true;
		} catch (e) {
			error = mensaje(e);
		} finally {
			ocupado = false;
		}
	}

	onMount(async () => {
		if (new URLSearchParams(location.search).get('modo') === 'entrar') modo = 'entrar';
		try {
			await api('/cuenta');
			await goto('/app/cuenta');
			return;
		} catch {
			// Sin sesión: se queda acá.
		}
		try {
			const c = await api<{ passkeys: boolean; mail: boolean }>('/config');
			passkeys = c.passkeys;
			mailHabilitado = c.mail;
		} catch (e) {
			passkeys = false;
			error = mensaje(e);
		}
		usarMail = passkeys === false;
	});
</script>

<svelte:head>
	<title>{modo === 'crear' ? 'Crear cuenta' : 'Entrar'} · Dónde Cagué</title>
</svelte:head>

<header class="u-tope">
	<a href="/" aria-label="Inicio"><Logo tamanio={32} conNombre={false} /></a>
	<h1>{modo === 'crear' ? 'Crear cuenta' : 'Entrar'}</h1>
</header>

<main class="u-pagina">
	<div class="pestanias" role="tablist">
		<button type="button" role="tab" aria-selected={modo === 'crear'} class:activa={modo === 'crear'} onclick={() => cambiarModo('crear')}>
			Crear cuenta
		</button>
		<button type="button" role="tab" aria-selected={modo === 'entrar'} class:activa={modo === 'entrar'} onclick={() => cambiarModo('entrar')}>
			Ya tengo cuenta
		</button>
	</div>

	{#if mailEnviado}
		<section class="u-tarjeta">
			<h2>📬 Revisá tu mail</h2>
			<p>
				Si el mail es correcto, te llega un link en un minuto. Abrilo <strong>en este mismo celular</strong>. Vale 15
				minutos y una sola vez.
			</p>
			<p class="u-ayuda">¿No llega? Mirá en spam o promociones.</p>
			<button type="button" class="u-enlace" onclick={() => (mailEnviado = false)}>Usar otro mail</button>
		</section>
	{:else if modo === 'crear'}
		<section class="u-tarjeta">
			<label class="u-campo">
				<span>Elegí un seudónimo</span>
				<input
					type="text"
					bind:value={seudonimo}
					oninput={revisarSeudonimo}
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					maxlength="24"
					placeholder="ej.: trono_patagonico"
				/>
			</label>
			{#if problemaSeud}
				<p class="u-ayuda aviso">{problemaSeud}</p>
			{:else if disponible === false}
				<p class="u-ayuda aviso">Ese ya está tomado.</p>
			{:else if disponible === true}
				<p class="u-ayuda bien">✓ Está libre.</p>
			{:else}
				<p class="u-ayuda">Nada de tu nombre real: es lo único que se ve de vos.</p>
			{/if}

			<div class="checks">
				<label class="u-check"><input type="checkbox" bind:checked={mayor} /> Tengo 18 años o más.</label>
				<label class="u-check">
					<input type="checkbox" bind:checked={acepta} />
					<span>Acepto los <a href="/terminos" target="_blank">términos</a> y la
						<a href="/privacidad" target="_blank">política de privacidad</a>.</span>
				</label>
			</div>

			{#if passkeys && !usarMail}
				<button type="button" class="u-boton" disabled={!altaLista || ocupado} onclick={crearConPasskey}>
					{ocupado ? 'Creando…' : 'Crear con passkey'}
				</button>
				<p class="u-ayuda">Entrás con la huella, la cara o el PIN del celular. Sin contraseña.</p>
				{#if mailHabilitado}
					<button type="button" class="u-enlace" onclick={() => (usarMail = true)}>Prefiero usar mi mail</button>
				{/if}
			{:else if passkeys !== null}
				<label class="u-campo mail">
					<span>Tu mail</span>
					<input type="email" bind:value={mail} autocomplete="email" inputmode="email" placeholder="vos@ejemplo.com" />
				</label>
				<p class="u-ayuda">Lo usamos solo para mandarte el link. No lo guardamos.</p>
				<button type="button" class="u-boton" disabled={!altaLista || !mailValido(mail) || ocupado} onclick={pedirLink}>
					{ocupado ? 'Mandando…' : 'Mandarme el link'}
				</button>
				{#if passkeys}
					<button type="button" class="u-enlace" onclick={() => (usarMail = false)}>Mejor con passkey</button>
				{/if}
			{/if}
		</section>
	{:else}
		<section class="u-tarjeta">
			{#if passkeys && !usarMail}
				<button type="button" class="u-boton" disabled={ocupado} onclick={entrarConPasskey}>
					{ocupado ? 'Entrando…' : 'Entrar con passkey'}
				</button>
				{#if mailHabilitado}
					<button type="button" class="u-enlace" onclick={() => (usarMail = true)}>Entrar con mi mail</button>
				{/if}
			{:else if passkeys !== null}
				<label class="u-campo">
					<span>Tu mail</span>
					<input type="email" bind:value={mail} autocomplete="email" inputmode="email" placeholder="vos@ejemplo.com" />
				</label>
				<button type="button" class="u-boton" disabled={!mailValido(mail) || ocupado} onclick={pedirLink}>
					{ocupado ? 'Mandando…' : 'Mandarme el link'}
				</button>
				{#if passkeys}
					<button type="button" class="u-enlace" onclick={() => (usarMail = false)}>Mejor con passkey</button>
				{/if}
			{/if}
		</section>
	{/if}

	{#if error}<p class="u-error" role="alert">{error}</p>{/if}
</main>

<style>
	.pestanias {
		display: grid;
		grid-template-columns: 1fr 1fr;
		margin: 0 0 18px;
		border: var(--borde);
		border-radius: var(--radio);
		overflow: hidden;
		background: var(--papel);
	}
	.pestanias button {
		min-height: 50px;
		border: 0;
		background: transparent;
		color: var(--tinta);
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
	}
	.pestanias button.activa {
		background: var(--tinta);
		color: var(--sol);
	}
	h2 {
		margin: 0 0 8px;
		font-size: 22px;
	}
	p {
		margin: 0 0 8px;
	}
	.checks {
		margin: 16px 0 4px;
	}
	.mail {
		margin-top: 8px;
	}
	.aviso {
		color: var(--rojo);
		font-weight: 600;
	}
	.bien {
		color: var(--mate);
		font-weight: 600;
	}
	a {
		color: var(--tinta);
		font-weight: 600;
	}
</style>
