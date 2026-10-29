<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
	import Logo from '$lib/ui/Logo.svelte';
	import { api, ErrorApi } from '$lib/cliente/api';
	import {
		CLAVE_MIN,
		mailValido,
		normalizarSeudonimo,
		problemaAlta,
		problemaClave,
		problemaSeudonimo
	} from '$lib/cuentas/validacion';

	type Modo = 'crear' | 'entrar';
	type Metodo = 'passkey' | 'clave' | 'mail' | 'google';

	let modo = $state<Modo>('crear');
	let metodos = $state<Metodo[]>([]);
	let metodo = $state<Metodo>('clave');

	let seudonimo = $state('');
	let disponible = $state<boolean | null>(null);
	let mayor = $state(false);
	let acepta = $state(false);
	let clave = $state('');
	let verClave = $state(false);
	let mail = $state('');

	let ocupado = $state(false);
	let error = $state<string | null>(null);
	let mailEnviado = $state(false);

	const NOMBRES: Record<Metodo, string> = { passkey: 'Passkey', clave: 'Contraseña', mail: 'Mail', google: 'Google' };

	// Lo que vuelve de Google cuando algo no salió (api/v1/auth/google/vuelta).
	const ERRORES_GOOGLE: Record<string, string> = {
		sin_cuenta: 'Esa cuenta de Google no tiene cuenta acá. Creala en "Crear cuenta".',
		seudonimo_tomado: 'Ese seudónimo lo tomaron mientras tanto. Elegí otro.',
		error: 'No se pudo entrar con Google. Probá de nuevo.'
	};

	const problemaSeud = $derived(seudonimo ? problemaSeudonimo(seudonimo) : null);
	const datosAltaOk = $derived(
		problemaAlta({ seudonimo, mayor_de_edad: mayor, acepta_terminos: acepta }) === null && disponible !== false
	);
	const problemaDeClave = $derived(clave ? problemaClave(clave, seudonimo) : null);

	let temporizador: ReturnType<typeof setTimeout> | undefined;
	function revisarSeudonimo() {
		disponible = null;
		clearTimeout(temporizador);
		if (modo !== 'crear' || !seudonimo || problemaSeudonimo(seudonimo)) return;
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
		disponible = null;
		if (m === 'crear') revisarSeudonimo();
	}

	function cambiarMetodo(m: Metodo) {
		metodo = m;
		error = null;
	}

	function mensaje(e: unknown): string {
		if (e instanceof ErrorApi) return e.message;
		const nombre = (e as { name?: string })?.name;
		if (nombre === 'NotAllowedError') return 'Se canceló o venció el pedido de la passkey. Probá de nuevo.';
		if (nombre === 'InvalidStateError') return 'Este dispositivo ya tiene una passkey para esta cuenta.';
		return 'Algo salió mal. Probá de nuevo.';
	}

	async function ejecutar(tarea: () => Promise<void>) {
		ocupado = true;
		error = null;
		try {
			await tarea();
		} catch (e) {
			error = mensaje(e);
		} finally {
			ocupado = false;
		}
	}

	const alta = () => ({ seudonimo, mayor_de_edad: mayor, acepta_terminos: acepta });

	const crearConPasskey = () =>
		ejecutar(async () => {
			const { desafio_id, opciones } = await api<{ desafio_id: string; opciones: never }>('/auth/passkey/alta/opciones', {
				cuerpo: alta()
			});
			const respuesta = await startRegistration({ optionsJSON: opciones });
			await api('/auth/passkey/alta/verificar', { cuerpo: { desafio_id, respuesta } });
			await goto('/app');
		});

	const entrarConPasskey = () =>
		ejecutar(async () => {
			const { desafio_id, opciones } = await api<{ desafio_id: string; opciones: never }>('/auth/passkey/entrada/opciones', {
				cuerpo: {}
			});
			const respuesta = await startAuthentication({ optionsJSON: opciones });
			await api('/auth/passkey/entrada/verificar', { cuerpo: { desafio_id, respuesta } });
			await goto('/app');
		});

	const crearConClave = () =>
		ejecutar(async () => {
			await api('/auth/clave/alta', { cuerpo: { ...alta(), clave } });
			await goto('/app');
		});

	const entrarConClave = () =>
		ejecutar(async () => {
			await api('/auth/clave/entrada', { cuerpo: { seudonimo, clave } });
			await goto('/app');
		});

	const conGoogle = () =>
		ejecutar(async () => {
			const { url } = await api<{ url: string }>('/auth/google/inicio', {
				cuerpo: modo === 'crear' ? { modo: 'alta', alta: alta() } : { modo: 'entrar' }
			});
			location.href = url;
		});

	const pedirLink = () =>
		ejecutar(async () => {
			await api('/auth/mail/solicitar', { cuerpo: modo === 'crear' ? { mail, alta: alta() } : { mail } });
			mailEnviado = true;
		});

	onMount(async () => {
		const params = new URLSearchParams(location.search);
		if (params.get('modo') === 'entrar') modo = 'entrar';
		const errorGoogle = params.get('google');
		if (errorGoogle) {
			if (errorGoogle === 'sin_cuenta') modo = 'crear';
			error = ERRORES_GOOGLE[errorGoogle] ?? ERRORES_GOOGLE.error;
			history.replaceState(null, '', location.pathname + (modo === 'entrar' ? '?modo=entrar' : ''));
		}
		try {
			await api('/cuenta');
			await goto('/app');
			return;
		} catch {
			// Sin sesión: se queda acá.
		}
		try {
			const c = await api<{ passkeys: boolean; mail: boolean; google: boolean }>('/config');
			metodos = [
				...(c.passkeys ? (['passkey'] as const) : []),
				...(c.google ? (['google'] as const) : []),
				'clave',
				...(c.mail ? (['mail'] as const) : [])
			];
		} catch (e) {
			metodos = ['clave'];
			error = mensaje(e);
		}
		// Si volvió de Google con un error, se queda en Google.
		metodo = errorGoogle && metodos.includes('google') ? 'google' : metodos[0];
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
	{:else if metodos.length}
		<section class="u-tarjeta">
			{#if metodos.length > 1}
				<div class="metodos" role="radiogroup" aria-label="Cómo querés entrar">
					{#each metodos as m (m)}
						<button type="button" role="radio" aria-checked={metodo === m} class:elegido={metodo === m} onclick={() => cambiarMetodo(m)}>
							{NOMBRES[m]}
						</button>
					{/each}
				</div>
			{/if}

			{#if modo === 'crear' || metodo === 'clave'}
				<label class="u-campo">
					<span>{modo === 'crear' ? 'Elegí un seudónimo' : 'Tu seudónimo'}</span>
					<input
						type="text"
						bind:value={seudonimo}
						oninput={revisarSeudonimo}
						autocomplete="username"
						autocapitalize="none"
						spellcheck="false"
						maxlength="24"
						placeholder="ej.: trono_patagonico"
					/>
				</label>
				{#if modo === 'crear'}
					{#if problemaSeud}
						<p class="u-ayuda aviso">{problemaSeud}</p>
					{:else if disponible === false}
						<p class="u-ayuda aviso">Ese ya está tomado.</p>
					{:else if disponible === true}
						<p class="u-ayuda bien">✓ Está libre.</p>
					{:else}
						<p class="u-ayuda">Nada de tu nombre real: es lo único que se ve de vos.</p>
					{/if}
				{/if}
			{/if}

			{#if metodo === 'clave'}
				<label class="u-campo con-margen">
					<span>{modo === 'crear' ? 'Elegí una contraseña' : 'Tu contraseña'}</span>
					<div class="clave">
						<input
							type={verClave ? 'text' : 'password'}
							bind:value={clave}
							autocomplete={modo === 'crear' ? 'new-password' : 'current-password'}
							maxlength="200"
						/>
						<button type="button" class="ver" onclick={() => (verClave = !verClave)}>{verClave ? 'Ocultar' : 'Ver'}</button>
					</div>
				</label>
				{#if modo === 'crear'}
					{#if problemaDeClave}
						<p class="u-ayuda aviso">{problemaDeClave}</p>
					{:else}
						<p class="u-ayuda">Al menos {CLAVE_MIN} caracteres. Una frase corta es más fácil de recordar.</p>
					{/if}
				{/if}
			{/if}

			{#if metodo === 'mail'}
				<label class="u-campo con-margen">
					<span>Tu mail</span>
					<input type="email" bind:value={mail} autocomplete="email" inputmode="email" placeholder="vos@ejemplo.com" />
				</label>
				<p class="u-ayuda">Lo usamos solo para mandarte el link. No lo guardamos.</p>
			{/if}

			{#if modo === 'crear'}
				<div class="checks">
					<label class="u-check"><input type="checkbox" bind:checked={mayor} /> Tengo 18 años o más.</label>
					<label class="u-check">
						<input type="checkbox" bind:checked={acepta} />
						<span>Acepto los <a href="/terminos" target="_blank">términos</a> y la
							<a href="/privacidad" target="_blank">política de privacidad</a>.</span>
					</label>
				</div>
			{/if}

			{#if modo === 'crear'}
				{#if metodo === 'passkey'}
					<button type="button" class="u-boton" disabled={!datosAltaOk || ocupado} onclick={crearConPasskey}>
						{ocupado ? 'Creando…' : 'Crear con passkey'}
					</button>
					<p class="u-ayuda">Entrás con la huella, la cara o el PIN del celular. Sin contraseña.</p>
				{:else if metodo === 'google'}
					<button type="button" class="u-boton" disabled={!datosAltaOk || ocupado} onclick={conGoogle}>
						{ocupado ? 'Yendo a Google…' : 'Crear con Google'}
					</button>
					<p class="u-ayuda">
						A Google le pedimos solo un identificador: ni tu mail ni tu nombre. Eso sí, Google se entera de que entraste a
						Dónde Cagué.
					</p>
				{:else if metodo === 'clave'}
					<button
						type="button"
						class="u-boton"
						disabled={!datosAltaOk || !clave || problemaDeClave !== null || ocupado}
						onclick={crearConClave}>{ocupado ? 'Creando…' : 'Crear con contraseña'}</button
					>
					<p class="u-ayuda">
						Ojo: no tenemos tu mail, así que si te olvidás la contraseña no hay forma de recuperarla. Guardala en tu
						gestor de contraseñas.
					</p>
				{:else}
					<button type="button" class="u-boton" disabled={!datosAltaOk || !mailValido(mail) || ocupado} onclick={pedirLink}>
						{ocupado ? 'Mandando…' : 'Mandarme el link'}
					</button>
				{/if}
			{:else if metodo === 'passkey'}
				<button type="button" class="u-boton" disabled={ocupado} onclick={entrarConPasskey}>
					{ocupado ? 'Entrando…' : 'Entrar con passkey'}
				</button>
			{:else if metodo === 'google'}
				<button type="button" class="u-boton" disabled={ocupado} onclick={conGoogle}>
					{ocupado ? 'Yendo a Google…' : 'Entrar con Google'}
				</button>
			{:else if metodo === 'clave'}
				<button type="button" class="u-boton" disabled={!seudonimo || !clave || ocupado} onclick={entrarConClave}>
					{ocupado ? 'Entrando…' : 'Entrar'}
				</button>
			{:else}
				<button type="button" class="u-boton" disabled={!mailValido(mail) || ocupado} onclick={pedirLink}>
					{ocupado ? 'Mandando…' : 'Mandarme el link'}
				</button>
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
	.metodos {
		display: flex;
		gap: 6px;
		margin: 0 0 16px;
	}
	.metodos button {
		flex: 1;
		min-height: 44px;
		border: 2px solid var(--tinta);
		border-radius: 999px;
		background: var(--papel);
		color: var(--tinta);
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
	}
	.metodos button.elegido {
		background: var(--celeste-claro);
		box-shadow: 2px 2px 0 var(--tinta);
	}
	.clave {
		display: flex;
		gap: 6px;
	}
	.clave input {
		flex: 1;
		min-width: 0;
	}
	.ver {
		min-width: 76px;
		border: var(--borde);
		border-radius: 12px;
		background: var(--papel);
		color: var(--tinta);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}
	.con-margen {
		margin-top: 14px;
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
