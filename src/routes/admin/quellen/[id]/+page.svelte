<script lang="ts">
	let { data, form } = $props();
	const formatDate = (value: string | Date) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value));
	const healthLabel = (health: string) => ({ healthy: 'Erreichbar', paused: 'Pausiert', error: 'Fehler', unknown: 'Noch nicht geprüft' })[health as 'healthy' | 'paused' | 'error' | 'unknown'] ?? health;
	const outcomeLabel = (outcome: string) => ({ success: 'Erfolgreich', failed: 'Fehlgeschlagen', not_modified: 'Unverändert' })[outcome as 'success' | 'failed' | 'not_modified'] ?? outcome;
</script>

<svelte:head><title>{data.source.name} · Quellen · Alles für die Tiere</title><meta name="robots" content="noindex, nofollow" /></svelte:head>

<main class="container page">
	<p class="eyebrow">Technische Verwaltung · Quelle</p>
	<h1>{data.source.name}</h1>
	<p><a href={data.source.canonicalUrl} rel="external noreferrer">Originalquelle öffnen</a> · {data.source.owner}</p>
	<dl class="facts">
		<div><dt>Zustand</dt><dd>{healthLabel(data.source.health)}</dd></div>
		<div><dt>Letzte erfolgreiche Erfassung</dt><dd>{data.source.lastSuccessfulAt ? formatDate(data.source.lastSuccessfulAt) : 'Noch keine'}</dd></div>
		<div><dt>Freigaberegel</dt><dd>{data.source.publicationPolicy === 'review_only' ? 'Nur nach manueller Prüfung' : data.source.publicationPolicy}</dd></div>
	</dl>
	<p>Gespeicherte Antworten und Entwürfe bleiben privat. Prüfe den Wortlaut immer auf der Originalseite, bevor du einen Fakt veröffentlichst.</p>
	{#if data.resumed}<p class="success" role="status">Die MA-Forest-Beobachtung wurde nach deiner Prüfung fortgesetzt.</p>{/if}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	{#if data.source.adapterKey === 'wilderness-ma-counter' && data.source.health === 'paused'}<section class="panel" aria-labelledby="resume-title">
		<h2 id="resume-title">Beobachtung pausiert</h2>
		<p>Prüfe die Originalseite und den Fehler im letzten Quelllauf. Erst danach kann die automatische Beobachtung fortgesetzt werden.</p>
		<form method="POST" action="?/resume"><input type="hidden" name="idempotencyKey" value={data.resumeKey} /><label>Prüfvermerk<textarea name="note" rows="3" maxlength="1000" required></textarea></label><button class="button" type="submit">Beobachtung fortsetzen</button></form>
	</section>{/if}
	{#if data.maForestLatest}<section class="panel" aria-labelledby="ma-title">
		<h2 id="ma-title">MA-Forest · nur Beobachtung</h2>
		<p><strong>{new Intl.NumberFormat('de-DE').format(data.maForestLatest.protectedAreaM2)} m²</strong> geschützte Fläche von {new Intl.NumberFormat('de-DE').format(data.maForestLatest.goalM2)} m² Ziel · {new Intl.NumberFormat('de-DE').format(data.maForestLatest.donations)} Spenden · beobachtet am {formatDate(data.maForestLatest.observedAt)}.</p>
		<p>Diese Werte stammen vom offiziellen Statistik-Endpunkt; im Seiten-HTML stehen nur Platzhalter. Vergleiche sie mit der live dargestellten <a href={data.source.canonicalUrl} rel="external noreferrer">MA-Forest-Seite</a>. Keine Zahl wird automatisch veröffentlicht.</p>
		<p>Beobachtetes Spendenziel: <code>{data.maForestLatest.donationUrl}</code></p>
	</section>{/if}

	<section class="panel" aria-labelledby="evidence-title">
		<h2 id="evidence-title">Verknüpfte Faktenentwürfe</h2>
		{#if data.evidence.length}
			<ul>{#each data.evidence as item}<li>
				<strong><a href={`/admin/inhalte/${item.claimId}`}>{item.statement}</a></strong>
				<p>{item.projectName} · {item.editorialStatus === 'published' ? 'veröffentlicht' : 'privat'} · beobachtet am {formatDate(item.observedAt)}</p>
				<blockquote>{item.passage}</blockquote>
			</li>{/each}</ul>
		{:else}<p>Für diese Quelle gibt es noch keinen verknüpften Faktenentwurf.</p>{/if}
	</section>

	<section class="panel" aria-labelledby="runs-title">
		<h2 id="runs-title">Letzte Quellläufe</h2>
		{#if data.runs.length}
			<ol>{#each data.runs as run}<li>
				<strong>{outcomeLabel(run.outcome)}</strong> · <time datetime={new Date(run.fetchedAt).toISOString()}>{formatDate(run.fetchedAt)}</time>{run.statusCode ? ` · HTTP ${run.statusCode}` : ''}
				{#if data.snapshots.filter((snapshot) => snapshot.sourceRunId === run.id).length}
					<details><summary>Privaten Snapshot prüfen</summary>
						{#each data.snapshots.filter((snapshot) => snapshot.sourceRunId === run.id) as snapshot}
							<p>SHA-256 der Originalantwort: <code>{snapshot.bodySha256}</code></p>
							<p>Extrakt:</p><pre>{JSON.stringify(snapshot.normalizedExtract, null, 2)}</pre>
						{/each}
					</details>
				{/if}
				{#if run.errorCode}<details><summary>Fehlercode</summary><code>{run.errorCode}</code></details>{/if}
			</li>{/each}</ol>
		{:else}<p>Für diese Quelle wurde noch kein Lauf gespeichert.</p>{/if}
	</section>
	<details><summary>Technische Quelldaten</summary>
		<p>Autorität: {data.source.authority} · Adapter: {data.source.adapterKey ?? 'manuelle Erfassung'} · Version: {data.source.adapterVersion ?? '–'}</p>
		<p>Aufbewahrung und Nutzungsnotiz: {data.source.termsNotes ?? 'Nicht hinterlegt'}</p>
		<p>Kanonische URL: <code>{data.source.canonicalUrl}</code></p>
	</details>
	<p class="back"><a href="/admin/quellen">Zurück zu Quellen</a></p>
</main>

<style>
	.page { max-width: 54rem; padding-top: clamp(2rem, 6vw, 5rem); }
	.page h1 { font-size: clamp(2rem, 5vw, 3.4rem); }
	.facts { display: flex; flex-wrap: wrap; gap: 1rem 2rem; }
	.facts div { min-width: 10rem; }
	dt { color: var(--color-muted); font-size: .9rem; }
	dd { margin: .3rem 0 0; font-weight: 700; }
	.panel { margin: 2rem 0; padding: clamp(1rem, 3vw, 2rem); border: 1px solid var(--color-line); background: var(--color-surface); }
	.panel h2 { font-size: 1.6rem; }
	ul, ol { padding-left: 1.3rem; }
	li { margin: 1rem 0; overflow-wrap: anywhere; }
	li + li { border-top: 1px solid var(--color-line); padding-top: 1rem; }
	li p { margin: .4rem 0; }
	blockquote { margin: .7rem 0; padding-left: 1rem; border-left: .2rem solid var(--color-moss); }
	details { margin-top: .6rem; }
	pre { max-height: 22rem; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
	.back { margin-top: 2rem; }
	.panel form, .panel label { display: grid; gap: .65rem; }
	.panel textarea { width: 100%; padding: .65rem; border: 1px solid var(--color-line); border-radius: .25rem; }
	.success, .error { padding: 1rem; background: var(--color-surface); }
	.success { border-left: .3rem solid var(--color-moss); }
	.error { border-left: .3rem solid var(--color-clay); }
</style>
