<script lang="ts">
	let { data } = $props();
	const sections = $derived([
		{ id: 'why', title: 'Warum es begann', items: data.project.claims.filter((claim) => claim.kind === 'context') },
		{ id: 'history', title: 'Was passiert ist', items: data.project.claims.filter((claim) => claim.kind === 'milestone') },
		{ id: 'today', title: 'Stand heute', items: data.project.claims.filter((claim) => claim.kind === 'status') },
		{ id: 'then', title: 'Und dann?', items: data.project.claims.filter((claim) => claim.kind === 'outcome') }
	].filter((section) => section.items.length));
	const formatDate = (value: string) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeZone: 'Europe/Berlin' }).format(new Date(value));
</script>

<svelte:head><title>{data.project.name} · Alles für die Tiere</title><meta name="description" content={`Belegte Projektgeschichte: ${data.project.name}`} /></svelte:head>

<article class="container page">
	<p class="eyebrow">Projektgeschichte · mit Quellen</p>
	<h1>{data.project.name}</h1>
	<p class="lede">Belegte Stationen, sichtbar mit Quelle und Datum. Neue Aussagen erscheinen erst nach redaktioneller Prüfung.</p>
	{#each sections as section}
		<section aria-labelledby={section.id}>
			<h2 id={section.id}>{section.title}</h2>
			<ol class="timeline">{#each section.items as claim}
				<li>
					<p class="date">{claim.occurredAt ? formatDate(claim.occurredAt) : `Beobachtet am ${formatDate(claim.evidence[0].observedAt)}`}</p>
					<p class="statement">{claim.statement}</p>
					<p class="sources">Quelle: {#each claim.evidence as source, index}{#if index > 0}, {/if}<a href={source.url} rel="external noreferrer">{source.publisher}</a> <span>({formatDate(source.observedAt)})</span>{/each}</p>
				</li>
			{/each}</ol>
		</section>
	{/each}
	<p class="help"><a href="/jetzt">Aktuelle Hilfe ansehen</a></p>
</article>

<style>
	.page { max-width: var(--reading-width); padding-top: clamp(3rem, 8vw, 7rem); }
	.lede { font-size: 1.3rem; }
	section { margin-top: 4rem; }
	section h2 { font-size: 2.2rem; }
	.timeline { list-style: none; padding: 0; }
	.timeline li { padding: 1.25rem 0 1.25rem 1.25rem; border-left: .2rem solid var(--color-moss); border-bottom: 1px solid var(--color-line); }
	.date, .sources { color: var(--color-muted); font-size: .9rem; }
	.statement { font-size: 1.15rem; }
	.sources { margin-bottom: 0; }
	.help { margin-top: 3rem; }
</style>
