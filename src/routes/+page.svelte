<script lang="ts">
	import { launchState } from '$lib/content/seed';
</script>

<svelte:head><title>Alles für die Tiere</title></svelte:head>

<section class="intro">
	<div class="container intro__grid">
		<div>
			<p class="eyebrow">Belegte Geschichten · konkrete Hilfe</p>
			<h1>Alles für die Tiere.</h1>
			<p class="lede">Geschichten, die bleiben. Quellen, die sichtbar sind. Und ein klarer nächster Schritt, wenn Hilfe gebraucht wird.</p>
			<a class="button" href="/jetzt">Aktuelle Hilfe ansehen</a>
		</div>
		<aside class="action" aria-labelledby="action-title">
			<p class="eyebrow">Jetzt helfen</p>
			<h2 id="action-title">{launchState.currentAction.label}</h2>
			<p>{launchState.currentAction.message}</p>
			<p class="status">Status: {launchState.currentAction.status}</p>
		</aside>
	</div>
</section>

<section class="container story">
	<p class="eyebrow">Im Aufbau</p>
	<h2>Eine Geschichte mit Herkunft.</h2>
	<div class="story__grid">
		<p>{launchState.project.intro}</p>
		<div class="source"><strong>Geplante Quelle</strong><br /><a href={launchState.project.source.url} rel="external noreferrer">{launchState.project.source.publisher}</a><br />Beobachtet am {launchState.project.source.observedAt}</div>
	</div>
	<a href={`/projekte/${launchState.project.slug}`}>Projektentwurf ansehen</a>
</section>

<style>
	.intro { padding: clamp(3rem, 9vw, 8rem) 0; border-bottom: 1px solid var(--color-line); }
	.intro__grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(18rem, .85fr); gap: clamp(2rem, 7vw, 8rem); align-items: end; }
	.lede { max-width: 37rem; font-size: clamp(1.15rem, 2.5vw, 1.5rem); }
	.action { padding: 1.5rem; border: 1px solid var(--color-ink); border-radius: var(--radius); background: var(--color-sun); }
	.action h2 { font-size: 2rem; }
	.status { margin-bottom: 0; color: var(--color-muted); font-size: .9rem; }
	.story { padding-top: clamp(4rem, 9vw, 8rem); }
	.story h2 { max-width: 34rem; }
	.story__grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, .6fr); gap: 3rem; max-width: 60rem; font-size: 1.1rem; }
	.source { padding: 1rem; border-left: 3px solid var(--color-moss); background: var(--color-surface); font-size: .95rem; }
	@media (max-width: 45rem) { .intro__grid, .story__grid { grid-template-columns: 1fr; } }
</style>
