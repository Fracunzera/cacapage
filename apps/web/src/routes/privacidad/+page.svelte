<script lang="ts">
	import Legal from '$lib/ui/Legal.svelte';
	import { VERSION_PRIVACIDAD } from '$lib/cuentas/validacion';
</script>

<Legal
	titulo="Privacidad"
	descripcion="Qué datos guarda Dónde Cagué, para qué, con quién se comparten y cómo borrarlos. Ley 25.326."
	ruta="/privacidad"
	version={VERSION_PRIVACIDAD}
>
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
			<strong>Si entrás con contraseña:</strong> no guardamos la contraseña, solo una huella (un cálculo lento y
			con sal que no se puede revertir) para verificarla cuando entrás.
		</li>
		<li>
			<strong>Si entrás con mail:</strong> no guardamos tu mail. Guardamos una huella (un código que se calcula a partir
			del mail y no se puede revertir) para reconocerlo la próxima vez. El mail en sí solo se usa para mandarte el link.
		</li>
		<li>
			<strong>Si entrás con Google:</strong> a Google le pedimos solo un identificador de tu cuenta, no tu mail ni tu
			nombre, y guardamos una huella de ese identificador (no se puede revertir). Google sí se entera de que entraste
			a Dónde Cagué, y cuándo: si no querés eso, usá otro método.
		</li>
		<li><strong>Tu sesión:</strong> un identificador para que no tengas que entrar cada vez. Vence a los 30 días.</li>
		<li>
			<strong>Tu historial</strong> (dónde y cuándo hiciste, tus anécdotas, tus medallas): se cifra en tu celular antes
			de subirlo, y no sabemos cuántos registros tenés. Para que vuelva solo cuando entrás desde otro celular,
			guardamos también la llave, cifrada con una clave que está fuera de la base de datos. Por eso, quien tuviera
			solo una copia de la base no lo podría leer; nosotros, con acceso al servidor completo, técnicamente sí. No lo
			miramos ni lo usamos para nada. Al borrar la cuenta se borra la llave y el historial deja de poder leerse.
		</li>
		<li>
			<strong>Tus amigos en Dónde Cagué</strong>, si los tenés: quién es amigo de quién y desde qué día. Se hacen solo
			con un link de invitación que mandás vos. Lo que compartís con "Mis amigos" lo ven solo ellos, mientras sean amigos, con
			los mismos datos que una caca pública, pero con el punto exacto (no redondeado). Con ellos también podés compartir
			lo de casa, el laburo o lo de alguien: en ese caso ven dónde es.
		</li>
		<li>
			<strong>Lo que vos elegís hacer público.</strong> Si marcás una caca como pública, guardamos y mostramos a
			cualquiera, en el mapa de cacas: tu seudónimo, el día (no la hora), el tipo de lugar, y el baño o el punto
			donde estabas (redondeado a unos 10 metros), en cualquier país. Los demás la ven 30 minutos después (vos, enseguida). Tu anécdota no se publica, salvo que marques "Mostrar también mi anécdota": en ese caso se guarda y se muestra junto a tu seudónimo. Lo de casa, el laburo o lo de alguien
			no se puede hacer público. La podés volver a poner privada cuando quieras y se borra en el acto.
		</li>
	</ul>

	<h2>Qué no guardamos</h2>
	<ul>
		<li>Tu ubicación, salvo la de las cacas que vos hacés públicas, una por una.</li>
		<li>Tu dirección IP ni datos de tu navegador asociados a tu cuenta.</li>
		<li>Nada sobre tu cuerpo o tu salud.</li>
	</ul>

	<h2>Con quién lo compartimos</h2>
	<p>
		Con nadie. No vendemos datos ni usamos publicidad ni analytics de terceros. Si entrás con mail, el link te lo manda
		<strong>Brevo</strong> (Sendinblue SAS, Francia), un servicio de envío de mails que ve la dirección solo para
		entregarlo. Francia está en la Unión Europea, que la Argentina reconoce con protección adecuada para transferir
		datos personales. Si elegís entrar con Google, <strong>Google</strong> (Google LLC, Estados Unidos) ve que
		entrás acá, según su propia política de privacidad.
	</p>

	<h2>Tus derechos</h2>
	<ul>
		<li><strong>Borrar tu cuenta</strong> cuando quieras, desde "Mi cuenta": se borra todo en el acto.</li>
		<li>
			<strong>Acceder</strong> a lo que tenemos de vos y <strong>corregirlo</strong>, escribiendo a
			<a href="mailto:dondecague@gmail.com">dondecague@gmail.com</a>. Te respondemos en los plazos de la ley: 10 días
			corridos para el acceso y 5 días hábiles para corregir o suprimir.
		</li>
		<li>
			Si creés que no cumplimos con la ley, podés reclamar ante la Agencia de Acceso a la Información Pública (AAIP),
			que es el órgano de control de la Ley 25.326.
		</li>
	</ul>

	<h2>Quién es responsable</h2>
	<p>
		El responsable de los datos es <strong>Facundo Aro</strong>. Para cualquier consulta sobre tus datos o para ejercer
		tus derechos: <a href="mailto:dondecague@gmail.com">dondecague@gmail.com</a>.
	</p>
</Legal>

<style>
	a {
		color: var(--tinta);
		font-weight: 600;
	}
</style>
