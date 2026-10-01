<script lang="ts">
	let { data } = $props();
	const formatDate = (value: string | Date) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value));
</script>

<svelte:head><title>Verlauf · Alles für die Tiere</title><meta name="robots" content="noindex, nofollow" /></svelte:head>

<main class="container page">
	<p class="eyebrow">Technische Verwaltung</p>
	<h1>Verlauf</h1>
	<p>Hier siehst du, welche Entwürfe und Veröffentlichungen eine Operation ausgelöst hat. Technische Details stehen jeweils hinter dem Eintrag.</p>
	<nav aria-label="Verlauf filtern"><a href="/admin/verlauf" aria-current={!data.publicOnly ? 'page' : undefined}>Alle</a><a href="/admin/verlauf?filter=public" aria-current={data.publicOnly ? 'page' : undefined}>Mit öffentlicher Wirkung</a></nav>
	{#if data.events.length}
		<ol class="events">{#each data.events as event}<li>
			<p class="meta"><time datetime={new Date(event.createdAt).toISOString()}>{formatDate(event.createdAt)}</time> · {event.origin}</p>
			<h2><a href={`/admin/verlauf/${event.id}`}>{event.summary}</a></h2>
			{#if event.publicEffect}<p>Öffentliche Wirkung: {event.publicEffect}</p>{/if}
		</li>{/each}</ol>
	{:else}<p>Für diesen Filter gibt es noch keine Einträge.</p>{/if}
	<div class="pagination">
		{#if data.page > 0}<a href={`/admin/verlauf?page=${data.page - 1}${data.publicOnly ? '&filter=public' : ''}`}>Neuere Einträge</a>{/if}
		{#if data.hasMore}<a href={`/admin/verlauf?page=${data.page + 1}${data.publicOnly ? '&filter=public' : ''}`}>Ältere Einträge</a>{/if}
	</div>
	<p><a href="/admin/chat">Zurück zum Inhaltschat</a></p>
</main>

<style>
	.page { max-width: 54rem; padding-top: clamp(2rem, 6vw, 5rem); }
	.page > p { max-width: 42rem; }
	nav, .pagination { display: flex; gap: 1.5rem; flex-wrap: wrap; margin: 2rem 0; }
	nav a[aria-current="page"] { font-weight: 800; text-decoration-thickness: .18em; }
	.events { list-style: none; padding: 0; }
	.events li { padding: 1.25rem 0; border-top: 1px solid var(--color-line); }
	.events h2 { font-size: clamp(1.2rem, 3vw, 1.6rem); }
	.meta { color: var(--color-muted); font-size: .9rem; }
</style>
