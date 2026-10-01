<script lang="ts">let { data, form } = $props();</script>

<svelte:head><title>Faktenentwurf prüfen · Alles für die Tiere</title><meta name="robots" content="noindex, nofollow" /></svelte:head>

<main class="container page">
	<p class="eyebrow">Vorschau · {data.claim.editorialStatus === 'published' ? 'veröffentlicht' : 'privat'}</p>
	<h1>{data.claim.statement}</h1>
	<p>Projekt: <strong>{data.project.name}</strong> · Route: <code>/projekte/{data.project.slug}</code></p>
	<p>Art: {data.claim.kind} · {data.claim.occurredAt ? `Ereignis am ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeZone: 'Europe/Berlin' }).format(new Date(data.claim.occurredAt))}` : 'ohne Ereignisdatum; Quellen-Beobachtung wird angezeigt'}</p>
	<section class="panel" aria-labelledby="evidence-title">
		<h2 id="evidence-title">Beleg prüfen</h2>
		{#each data.evidence as evidence}
			<p><a href={evidence.sourceUrl} rel="external noreferrer">{evidence.sourceUrl}</a> · beobachtet am {new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeZone: 'Europe/Berlin' }).format(new Date(evidence.observedAt))}</p>
			<blockquote>{evidence.passage}</blockquote>
		{/each}
		<p class="hint">Prüfe Aussage und Beleg auf der Originalseite. Die Passage bleibt intern; öffentlich erscheint ein Link mit Beobachtungsdatum.</p>
	</section>
	{#if data.published}<p class="success" role="status">Der Fakt wurde veröffentlicht. <a href={`/projekte/${data.project.slug}`}>Öffentliche Seite ansehen</a>.</p>{/if}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	{#if data.claim.editorialStatus === 'draft'}
		<form method="POST" action="?/publish">
			<input type="hidden" name="expectedClaimRevision" value={data.claim.revision} />
			<input type="hidden" name="expectedPublicationRevisionId" value={data.expectedPublicationRevisionId ?? ''} />
			<input type="hidden" name="idempotencyKey" value={data.publishKey} />
			<button class="button" type="submit">Fakt und Projektseite veröffentlichen</button>
		</form>
	{/if}
	<p class="back"><a href="/admin/inhalte">Zurück zu Inhalte</a></p>
</main>

<style>
	.page { max-width: 48rem; padding-top: clamp(2rem, 6vw, 5rem); }
	.page h1 { font-size: clamp(2rem, 5vw, 3.4rem); }
	.panel { margin: 2rem 0; padding: clamp(1rem, 3vw, 2rem); border: 1px solid var(--color-line); background: var(--color-surface); }
	.panel h2 { font-size: 1.6rem; }
	.panel p, blockquote { overflow-wrap: anywhere; }
	blockquote { margin: 1rem 0; padding-left: 1rem; border-left: .2rem solid var(--color-moss); }
	.hint { color: var(--color-muted); font-size: .9rem; }
	.success, .error { padding: 1rem; background: var(--color-surface); }
	.success { border-left: .3rem solid var(--color-moss); }
	.error { border-left: .3rem solid var(--color-clay); }
	.back { margin-top: 2rem; }
</style>
