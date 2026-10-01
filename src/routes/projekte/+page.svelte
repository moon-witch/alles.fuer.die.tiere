<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Projekte · Alles für die Tiere</title></svelte:head>

<section class="container page">
	<p class="eyebrow">Projekte</p>
	<h1>Arbeit, die weitergeht.</h1>
	<p class="lede">Jede Projektseite verbindet eine belegte Geschichte mit dem Stand heute und einer passenden Handlung.</p>
	{#if data.projects.length}
		<div class="project-grid">{#each data.projects as { project }}
			<article class="project-card">
				<p class="eyebrow">Belegte Projektgeschichte</p>
				<h2><a href={`/projekte/${project.slug}`}>{project.name}</a></h2>
				<p>{project.claims[0]?.statement}</p>
				<p class="meta">{project.claims.length} {project.claims.length === 1 ? 'belegter Eintrag' : 'belegte Einträge'}</p>
			</article>
		{/each}</div>
	{:else}<p>Die ersten belegten Projektgeschichten werden gerade vorbereitet.</p>{/if}
</section>

<style>
	.page { padding-top: clamp(3rem, 8vw, 7rem); }
	.lede { max-width: 42rem; font-size: 1.25rem; }
	.project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 1.5rem; margin-top: 3rem; }
	.project-card { padding: 1.5rem; border: 1px solid var(--color-ink); border-radius: var(--radius); background: var(--color-surface); }
	.project-card h2 { font-size: 2.25rem; }
	.meta { margin-bottom: 0; color: var(--color-muted); font-size: .9rem; }
</style>
