<script lang="ts">
	let { data } = $props();
	const kindLabels: Record<string, string> = { spende: 'Spende', petition: 'Petition', ticket: 'Ticket', information: 'Information', merchandise: 'Merchandise' };
</script>

<svelte:head><title>Jetzt helfen · Alles für die Tiere</title></svelte:head>

<section class="container page">
	<p class="eyebrow">Jetzt helfen</p>
	{#if data.action}
		<h1>{data.action.label}</h1>
		<p class="lede">Diese Hilfe geht an <strong>{data.action.recipientName}</strong>.</p>
		<div class="notice">
			<p><strong>Art:</strong> {kindLabels[data.action.kind] ?? data.action.kind}</p>
			<p><strong>Ziel:</strong> {data.action.destinationHost}</p>
			<p><strong>Quelle:</strong> <a href={data.action.evidenceUrl} rel="external noreferrer">Angaben zur Aktion prüfen</a></p>
			{#if data.publishedAt}<p class="meta">Veröffentlicht am {new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeZone: 'Europe/Berlin' }).format(new Date(data.publishedAt))}</p>{/if}
			<a class="button" href={data.action.destinationUrl} rel="external noopener noreferrer">Weiter zu {data.action.recipientName}</a>
		</div>
	{:else}
		<h1>Aktuelle Hilfe wird vorbereitet</h1>
		<p class="lede">Sobald eine Aktion mit Quelle, Empfänger und Ziel geprüft ist, steht sie hier.</p>
		<div class="notice" role="status"><strong>Gerade kein externer Aufruf.</strong><p>Hier erscheint nur eine veröffentlichte, noch gültige Aktion oder ihr geprüfter Fallback.</p></div>
	{/if}
	<section aria-labelledby="what-next">
		<h2 id="what-next">Was hier transparent bleibt</h2>
		<ul>
			<li>wer die Hilfe erhält und wohin der Link führt,</li>
			<li>ob es sich um eine Spende, Petition, ein Ticket oder Informationen handelt,</li>
			<li>die Quelle und der Stand der Information.</li>
		</ul>
	</section>
</section>

<style>
	.page { max-width: var(--reading-width); padding-top: clamp(3rem, 8vw, 7rem); }
	.lede { font-size: 1.3rem; }
	.notice { margin: 2.5rem 0 4rem; padding: 1.5rem; border: 1px solid var(--color-line); border-left: .3rem solid var(--color-sun); background: var(--color-surface); }
	.notice p { margin-bottom: 0; }
	.notice .button { margin-top: 1.25rem; }
	.meta { color: var(--color-muted); font-size: .9rem; }
	li { margin-bottom: .7rem; }
</style>
