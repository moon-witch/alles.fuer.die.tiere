<script lang="ts">
	let { data } = $props();
	const formatDate = (value: string | Date) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value));
</script>

<svelte:head><title>Verlaufseintrag · Alles für die Tiere</title><meta name="robots" content="noindex, nofollow" /></svelte:head>

<main class="container page">
	<p class="eyebrow">Verlauf · {data.event.eventType}</p>
	<h1>{data.event.summary}</h1>
	<p><time datetime={new Date(data.event.createdAt).toISOString()}>{formatDate(data.event.createdAt)}</time> · Auslöser: {data.event.origin}</p>
	{#if data.event.publicEffect}<p class="effect">Öffentliche Wirkung: {data.event.publicEffect}</p>{:else}<p>Keine unmittelbare öffentliche Wirkung.</p>{/if}
	{#if data.operation}
		<section aria-labelledby="operation-title" class="panel">
			<h2 id="operation-title">Zugehörige Änderung</h2>
			<p>Art: {data.operation.type} · Status: {data.operation.status}</p>
			{#if data.operation.instruction}<p>Auftrag: {data.operation.instruction}</p>{/if}
			<details><summary>Strukturierte Änderung ansehen</summary>
				<h3>Eingabe</h3><pre>{JSON.stringify(data.operation.input, null, 2)}</pre>
				<h3>Inhalt</h3><pre>{JSON.stringify(data.operation.entityDiff, null, 2)}</pre>
				<h3>Veröffentlichung</h3><pre>{JSON.stringify(data.operation.publicationDiff, null, 2)}</pre>
			</details>
		</section>
	{/if}
	{#if data.revision}<p>Veröffentlichungsrevision: <code>{data.revision.id}</code> · {data.revision.templateVersion}</p>{/if}
	<details><summary>Ereignisdaten ansehen</summary><pre>{JSON.stringify(data.event.payload, null, 2)}</pre></details>
	<p class="back"><a href="/admin/verlauf">Zurück zum Verlauf</a></p>
</main>

<style>
	.page { max-width: 50rem; padding-top: clamp(2rem, 6vw, 5rem); }
	.page h1 { font-size: clamp(2rem, 5vw, 3.4rem); }
	.effect { padding: 1rem; border-left: .3rem solid var(--color-moss); background: var(--color-surface); }
	.panel { margin: 2rem 0; padding: clamp(1rem, 3vw, 2rem); border: 1px solid var(--color-line); background: var(--color-surface); }
	.panel h2 { font-size: 1.6rem; }
	pre { overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 1rem; background: var(--color-paper); font-size: .85rem; }
	details { margin-top: 1rem; }
	summary { cursor: pointer; font-weight: 700; }
	.back { margin-top: 2rem; }
</style>
