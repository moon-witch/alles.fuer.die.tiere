<script lang="ts">
	let { data } = $props();
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
			<h2 id="action-title">{data.action?.label ?? 'Aktuelle Hilfe wird vorbereitet'}</h2>
			<p>{data.action ? `Für ${data.action.recipientName}. Ziel: ${data.action.destinationHost}` : 'Sobald eine Aktion mit Quelle, Empfänger und Ziel geprüft ist, steht sie hier.'}</p>
			<p class="status">{data.action ? 'Veröffentlichte Aktion' : 'Noch kein externer Aufruf'}</p>
		</aside>
	</div>
</section>

<section class="container story">
	<p class="eyebrow">Projekte</p>
	{#if data.featuredProject}
		<h2>{data.featuredProject.name}</h2>
		<p class="lede">{data.featuredProject.claims[0]?.statement}</p>
		<a href={`/projekte/${data.featuredProject.slug}`}>Belegte Geschichte ansehen</a>
	{:else}
		<h2>Eine Geschichte mit Herkunft.</h2>
		<p>Die ersten belegten Projektgeschichten werden gerade vorbereitet.</p>
		<a href="/projekte">Projekte ansehen</a>
	{/if}
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
	@media (max-width: 45rem) { .intro__grid { grid-template-columns: 1fr; } }
</style>
