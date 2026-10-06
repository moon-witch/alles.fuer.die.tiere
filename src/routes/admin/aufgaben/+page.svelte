<script lang="ts">
	let { data, form } = $props();
	const formatDate = (value: string | Date) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value));
</script>

<svelte:head><title>Aufgaben · Alles für die Tiere</title><meta name="robots" content="noindex, nofollow" /></svelte:head>

<main class="container page">
	<p class="eyebrow">Technische Verwaltung</p>
	<h1>Zur Prüfung</h1>
	<p>Hier stehen offene Konflikte und andere technische Hinweise. Eine Erledigung dokumentiert nur deine Prüfung; sie ändert keine öffentliche Seite.</p>
	{#if data.resolved}<p class="success" role="status">Der Eintrag wurde als erledigt markiert und im Verlauf dokumentiert.</p>{/if}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	{#if data.items.length}
		<div class="items">
			{#each data.items as item}
				<article class="panel">
					<p class="eyebrow">{item.kind} · {item.severity} · <time datetime={new Date(item.createdAt).toISOString()}>{formatDate(item.createdAt)}</time></p>
					<h2>{item.summary}</h2>
					{#if item.eventId}<p><a href={`/admin/verlauf/${item.eventId}`}>Zugehörigen Verlauf prüfen</a></p>{/if}
					<form method="POST" action="?/resolve">
						<input type="hidden" name="attentionItemId" value={item.id} />
						<input type="hidden" name="idempotencyKey" value={item.resolveKey} />
						<label>Ergebnis der Prüfung<textarea name="note" rows="3" maxlength="1000" required placeholder="Was wurde geprüft oder korrigiert?"></textarea></label>
						<button class="button" type="submit">Als erledigt markieren</button>
					</form>
				</article>
			{/each}
		</div>
	{:else}<p>Keine offenen Aufgaben.</p>{/if}
	<nav aria-label="Weitere Aufgaben"><a href="/admin/verlauf">Zum Verlauf</a>{#if data.page > 0} · <a href={`/admin/aufgaben?page=${data.page - 1}`}>Zurück</a>{/if}{#if data.hasMore} · <a href={`/admin/aufgaben?page=${data.page + 1}`}>Weitere</a>{/if}</nav>
</main>

<style>
	.page { max-width: 52rem; padding-top: clamp(2rem, 6vw, 5rem); }
	.page h1 { font-size: clamp(2rem, 5vw, 3.4rem); }
	.items { display: grid; gap: 1rem; margin: 2rem 0; }
	.panel { padding: clamp(1rem, 3vw, 2rem); border: 1px solid var(--color-line); background: var(--color-surface); }
	.panel h2 { font-size: 1.4rem; }
	.panel form, .panel label { display: grid; gap: .65rem; }
	.panel textarea { width: 100%; padding: .65rem; border: 1px solid var(--color-ink); border-radius: .25rem; background: white; }
	.panel button { justify-self: start; }
	.success, .error { padding: 1rem; background: var(--color-surface); }
	.success { border-left: .3rem solid var(--color-moss); }
	.error { border-left: .3rem solid var(--color-clay); }
	.page nav { margin: 2rem 0; }
</style>
