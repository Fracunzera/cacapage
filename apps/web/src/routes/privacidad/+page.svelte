<script lang="ts">
	import Legal from '$lib/ui/Legal.svelte';
	import { VERSION_PRIVACIDAD } from '$lib/cuentas/validacion';
</script>

<Legal titulo="Privacidad" version={VERSION_PRIVACIDAD}>
	<p>
		Dónde Cagué está hecho para saber lo menos posible de vos. Esto es lo que guardamos, para qué, y qué podés hacer
		con eso. Se rige por la Ley 25.326 de Protección de Datos Personales.
	</p>

	<h2>Qué guardamos</h2>
	<ul>
		<li><strong>Tu seudónimo</strong>, que elegís vos. No pedimos nombre real, teléfono ni fecha de nacimiento.</li>
		<li><strong>Que declaraste ser mayor de 18</strong> y qué versión de estos textos aceptaste, con la fecha (sin hora).</li>
		<li>
			<strong>Si entrás con passkey:</strong> la clave pública de la passkey. La parte privada nunca sale de tu celular.
		</li>
		<li>
			<strong>Si entrás con mail:</strong> no guardamos tu mail. Guardamos una huella (un código que se calcula a partir
			del mail y no se puede revertir) para reconocerlo la próxima vez. El mail en sí solo se usa para mandarte el link.
		</li>
		<li><strong>Tu sesión:</strong> un identificador para que no tengas que entrar cada vez. Vence a los 30 días.</li>
	</ul>

	<h2>Qué no guardamos</h2>
	<ul>
		<li>Tu ubicación. El servidor nunca recibe tus coordenadas.</li>
		<li>Tu dirección IP ni datos de tu navegador asociados a tu cuenta.</li>
		<li>Nada sobre tu cuerpo o tu salud.</li>
	</ul>

	<h2>Con quién lo compartimos</h2>
	<p>
		Con nadie. No vendemos datos ni usamos publicidad ni analytics de terceros. Si entrás con mail, el link te lo manda
		un proveedor de envío de mails, que ve la dirección solo para entregarlo. [Proveedor a definir antes del
		lanzamiento.]
	</p>

	<h2>Tus derechos</h2>
	<ul>
		<li><strong>Borrar tu cuenta</strong> cuando quieras, desde "Mi cuenta": se borra todo en el acto.</li>
		<li><strong>Acceder</strong> a lo que tenemos de vos y <strong>corregirlo</strong>, escribiéndonos.</li>
		<li>
			Si creés que no cumplimos con la ley, podés reclamar ante la Agencia de Acceso a la Información Pública (AAIP),
			que es el órgano de control de la Ley 25.326.
		</li>
	</ul>

	<h2>Quién es responsable</h2>
	<p>[Responsable y contacto a definir antes del lanzamiento.]</p>
</Legal>
