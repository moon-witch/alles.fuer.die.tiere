<script lang="ts">
	import { launchState } from '$lib/content/seed';
</script>

<svelte:head><title>Projekte · Alles für die Tiere</title></svelte:head>

<section class="container page">
	<p class="eyebrow">Projekte</p>
	<h1>Arbeit, die weitergeht.</h1>
	<p class="lede">Jede Projektseite verbindet eine belegte Geschichte mit dem Stand heute und einer passenden Handlung.</p>
	<article class="project-card">
		<p class="eyebrow">Projektentwurf</p>
		<h2><a href={`/projekte/${launchState.project.slug}`}>{launchState.project.title}</a></h2>
		<p>{launchState.project.intro}</p>
		<p class="meta">Noch nicht veröffentlicht · Quelle vor Veröffentlichung prüfen</p>
	</article>
</section>

<style>
	.page { padding-top: clamp(3rem, 8vw, 7rem); }
	.lede { max-width: 42rem; font-size: 1.25rem; }
	.project-card { max-width: 34rem; margin-top: 3rem; padding: 1.5rem; border: 1px solid var(--color-ink); border-radius: var(--radius); background: var(--color-surface); }
	.project-card h2 { font-size: 2.25rem; }
	.meta { margin-bottom: 0; color: var(--color-muted); font-size: .9rem; }
</style>
