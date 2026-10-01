<script lang="ts">
	let { data, form } = $props();
	const kindLabels: Record<string, string> = { milestone: 'Meilenstein', status: 'Stand', outcome: 'Ergebnis', context: 'Hintergrund' };
</script>

<svelte:head><title>Inhalte verwalten · Alles für die Tiere</title><meta name="robots" content="noindex, nofollow" /></svelte:head>

<main class="container page">
	<p class="eyebrow">Technische Verwaltung</p>
	<h1>Inhalte</h1>
	<p>Lege zuerst ein privates Projekt an. Ein Faktenentwurf braucht anschließend eine konkrete Aussage und den genauen Beleg. Erst die Vorschau kann ihn veröffentlichen.</p>
	{#if data.created}<p class="notice" role="status">Das Projekt wurde privat angelegt.</p>{/if}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	<section class="panel" aria-labelledby="projects-title">
		<h2 id="projects-title">Projekte</h2>
		{#if data.projects.length}<ul>{#each data.projects as project}<li>{project.name} <span class="meta">({project.slug} · {project.visibility === 'public' ? 'öffentlich' : 'privat'})</span></li>{/each}</ul>{:else}<p>Noch keine Projekte angelegt.</p>{/if}
		<form method="POST" action="?/createProject" class="fields">
			<input type="hidden" name="idempotencyKey" value={data.projectKey} />
			<label>Projektname <input name="name" maxlength="160" required placeholder="Zum Beispiel: MA-Forest" /></label>
			<label>URL-Name <input name="slug" maxlength="120" pattern="[a-z0-9]+(-[a-z0-9]+)*" required placeholder="ma-forest" /></label>
			<button class="button" type="submit">Privates Projekt anlegen</button>
		</form>
	</section>
	<section class="panel" aria-labelledby="claim-title">
		<h2 id="claim-title">Faktenentwurf mit Beleg</h2>
		{#if data.projects.length}
			<form method="POST" action="?/createClaim" class="fields">
				<input type="hidden" name="idempotencyKey" value={data.claimKey} />
				<label>Projekt <select name="projectId" required>{#each data.projects as project}<option value={project.id}>{project.name}</option>{/each}</select></label>
				<label>Art <select name="kind" required>{#each data.kinds as kind}<option value={kind}>{kindLabels[kind]}</option>{/each}</select></label>
				<label>Aussage <textarea name="statement" rows="3" maxlength="1000" required placeholder="Eine genaue, öffentlich verständliche Aussage"></textarea></label>
				<label>Datum des Ereignisses (falls bekannt) <input name="occurredAt" type="date" /></label>
				<label>Öffentliche HTTPS-Quelle <input name="sourceUrl" type="url" required placeholder="https://…" /></label>
				<label>Genaue stützende Stelle aus der Quelle <textarea name="passage" rows="3" maxlength="4000" required></textarea></label>
				<button class="button" type="submit">Privaten Entwurf speichern</button>
			</form>
		{:else}<p>Lege zuerst ein Projekt an.</p>{/if}
	</section>
	<section class="panel" aria-labelledby="drafts-title">
		<h2 id="drafts-title">Zur Prüfung</h2>
		{#if data.drafts.length}<ul>{#each data.drafts as draft}<li><a href={`/admin/inhalte/${draft.id}`}>{draft.statement}</a> <span class="meta">· {draft.projectName}</span></li>{/each}</ul>{:else}<p>Keine offenen Faktenentwürfe.</p>{/if}
	</section>
	<p><a href="/admin/chat">Zurück zum Inhaltschat</a></p>
</main>

<style>
	.page { max-width: 52rem; padding-top: clamp(2rem, 6vw, 5rem); }
	.page > p { max-width: 42rem; }
	.panel { margin: 2rem 0; padding: clamp(1rem, 3vw, 2rem); border: 1px solid var(--color-line); border-radius: var(--radius); background: var(--color-surface); }
	.panel h2 { font-size: clamp(1.5rem, 3vw, 2rem); }
	.fields { display: grid; gap: 1rem; margin-top: 1.5rem; }
	.fields label { display: grid; gap: .35rem; font-weight: 700; }
	.fields input, .fields select, .fields textarea { width: 100%; padding: .65rem; border: 1px solid var(--color-ink); border-radius: .25rem; background: white; font-weight: 400; }
	.fields button { justify-self: start; }
	.meta { color: var(--color-muted); font-size: .9rem; }
	.notice, .error { padding: 1rem; background: var(--color-surface); }
	.notice { border-left: .3rem solid var(--color-moss); }
	.error { border-left: .3rem solid var(--color-clay); }
	li { margin: .65rem 0; overflow-wrap: anywhere; }
</style>
