<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>{data.project.title} · Alles für die Tiere</title></svelte:head>

<article class="container page">
	<p class="eyebrow">Projektentwurf · nicht veröffentlicht</p>
	<h1>{data.project.title}</h1>
	<p class="lede">{data.project.intro}</p>
	<section aria-labelledby="why"><h2 id="why">Warum es begann</h2><p>Die veröffentlichungsreife, belegte Geschichte wird über die Inhalts- und Evidenzabläufe ergänzt.</p></section>
	<section aria-labelledby="history"><h2 id="history">Was passiert ist</h2><p>Es gibt noch keine veröffentlichten, datierten Aussagen in dieser Timeline.</p></section>
	<section aria-labelledby="today"><h2 id="today">Stand heute</h2><p>Aktuelle Aussagen erscheinen erst nach der redaktionellen Prüfung mit sichtbarer Quelle und Datum.</p></section>
	<section aria-labelledby="then"><h2 id="then">Und dann?</h2><p>Dieser Bereich bewahrt spätere, belegte Ergebnisse neben der ursprünglichen Geschichte.</p></section>
	<aside class="source"><strong>Vorgesehene Primärquelle</strong><br /><a href={data.project.source.url} rel="external noreferrer">{data.project.source.publisher}</a><br /><span>Beobachtet am {data.project.source.observedAt}</span></aside>
</article>

<style>
	.page { max-width: var(--reading-width); padding-top: clamp(3rem, 8vw, 7rem); }
	.lede { font-size: 1.3rem; }
	section { margin-top: 4rem; }
	section h2 { font-size: 2.2rem; }
	.source { margin-top: 4rem; padding: 1rem; border-left: .3rem solid var(--color-moss); background: var(--color-surface); }
	.source span { color: var(--color-muted); font-size: .9rem; }
</style>
