<script lang="ts">
	import Legal from '$lib/ui/Legal.svelte';
	import { VERSION_TERMINOS } from '$lib/cuentas/validacion';
</script>

<Legal titulo="Términos" version={VERSION_TERMINOS}>
	<h2>Qué es esto</h2>
	<p>
		Dónde Cagué es un proyecto humorístico con una parte útil: registrar dónde fuiste al baño y armar entre todos un
		mapa de baños de la Argentina.
	</p>

	<h2>Quién puede usarlo</h2>
	<p>Por ahora, solo mayores de 18 años.</p>

	<h2>Tu cuenta</h2>
	<ul>
		<li>Elegí un seudónimo que no te identifique ni ofenda a nadie. Podemos pedirte que lo cambies.</li>
		<li>Cuidá tu passkey o tu mail: son la llave de tu cuenta.</li>
		<li>Podés borrar tu cuenta cuando quieras.</li>
	</ul>

	<h2>Lo que aportes al mapa de baños</h2>
	<p>
		Los datos sobre baños (si existe, horario, si cobra, si es accesible) son información sobre lugares, se publican
		sin tu seudónimo y pueden quedar aunque borres tu cuenta. Probablemente se publiquen bajo la licencia abierta ODbL,
		la misma de OpenStreetMap. [A confirmar con asesoramiento legal.]
	</p>

	<h2>Sin garantías</h2>
	<p>
		Los datos del mapa los cargan personas y pueden estar desactualizados. Antes de caminar varias cuadras, fijate la
		fecha de cada dato.
	</p>
</Legal>
