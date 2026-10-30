<script lang="ts">
	import { TIPOS, type Registro } from '../modelo';
	import type { Compartir as Con } from '../publicar';
	import Compartir from './Compartir.svelte';
	import { vecesPorVisita } from '$lib/lugares';

	let {
		registros,
		seudonimo,
		onborrar,
		onpublico
	}: {
		registros: Registro[];
		seudonimo: string;
		onborrar: (r: Registro) => void;
		onpublico: (r: Registro, con: Con, conComentario: boolean) => Promise<void>;
	} = $props();
	let cambiando = $state<string | null>(null);

	async function cambiar(r: Registro, con: Con, conComentario: boolean) {
		cambiando = r.id;
		try {
			await onpublico(r, con, conComentario);
		} finally {
			cambiando = null;
		}
	}

	const TIPO = Object.fromEntries(TIPOS.map((t) => [t.id, t]));
	/** "3.ª vez acá": mismo baño, o a menos de 40 m. */
	const veces = $derived(vecesPorVisita(registros, (r) => r.ocurrido_en));
	const mes = (iso: string) => {
		const t = new Date(iso).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
		return t.charAt(0).toUpperCase() + t.slice(1);
	};
	const dia = (iso: string) =>
		new Date(iso).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

	const grupos = $derived.by(() => {
		const g: { mes: string; registros: Registro[] }[] = [];
		for (const r of registros) {
			const m = mes(r.ocurrido_en);
			if (g.at(-1)?.mes !== m) g.push({ mes: m, registros: [] });
			g.at(-1)!.registros.push(r);
		}
		return g;
	});

	let abierto = $state<string | null>(null);
</script>

{#each grupos as g (g.mes)}
	<h3>{g.mes} <span>· {g.registros.length}</span></h3>
	<ul>
		{#each g.registros as r (r.id)}
			<li>
				<button type="button" class="fila" aria-expanded={abierto === r.id} onclick={() => (abierto = abierto === r.id ? null : r.id)}>
					<span class="icono" aria-hidden="true">{TIPO[r.tipo]?.icono}</span>
					<span class="que">
						<strong>{r.lugar_nombre ?? r.banio_nombre ?? TIPO[r.tipo]?.texto}</strong>
						<small
							>{dia(r.ocurrido_en)}{r.sin_papel ? ' · sin papel' : ''}{r.comentario ? ' · 📝' : ''}{(veces.get(r.id)?.total ?? 1) > 1 ? ` · ${veces.get(r.id)?.vez}.ª vez acá` : ''}{r.publico ? ` · 🌎 pública${r.numero_publico ? ` N.º ${r.numero_publico.toLocaleString('es-AR')}` : ''}` : ''}{r.amigos ? ' · 👥 con amigos' : ''}{(r.publico || r.amigos) && r.comentario_publico ? ' con anécdota' : ''}</small
						>
					</span>
				</button>
				{#if abierto === r.id}
					<div class="detalle">
						{#if r.comentario}<p class="comentario">“{r.comentario}”</p>{/if}
						{#if r.lat !== undefined}
							<p class="u-ayuda">
								📍 {r.fuente_ubicacion === 'manual' ? 'Ubicación cargada a mano' : `Con ubicación (±${r.precision_m} m)`}
							</p>
						{/if}
						<Compartir registro={r} {seudonimo} ocupado={cambiando === r.id} oncambiar={cambiar} />
						<button
							type="button"
							class="u-enlace borrar"
							onclick={() => confirm('¿Borrar este registro? Las medallas que ya ganaste se quedan.') && onborrar(r)}
						>
							Borrar
						</button>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="vacio">Todavía no registraste nada. El trono te espera.</p>
{/each}


<style>
	h3 {
		margin: 18px 0 8px;
		font-size: 17px;
	}
	h3 span {
		color: var(--tinta-suave);
		font-weight: 500;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		margin-bottom: 8px;
		border: 2px solid var(--tinta);
		border-radius: 12px;
		background: var(--papel);
	}
	.fila {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 52px;
		padding: 8px 12px;
		border: 0;
		border-radius: 12px;
		background: none;
		color: var(--tinta);
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}
	.icono {
		font-size: 22px;
	}
	.que {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.que strong {
		overflow-wrap: anywhere;
	}
	small {
		color: var(--tinta-suave);
		font-size: 14px;
	}
	.detalle {
		padding: 0 12px 10px 46px;
	}
	.comentario {
		margin: 0 0 6px;
		font-style: italic;
	}
	.detalle .u-enlace {
		margin-right: 16px;
	}
	.borrar {
		color: var(--rojo);
		text-decoration-color: var(--rojo-claro);
	}
	.vacio {
		color: var(--tinta-suave);
	}
</style>
