<script lang="ts">
	let { data, form } = $props();
	const formatDate = (value: string | Date) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value));
</script>

<svelte:head><title>Quellen erfassen · Alles für die Tiere</title><meta name="robots" content="noindex, nofollow" /></svelte:head>

<main class="container page">
	<p class="eyebrow">Technische Verwaltung</p>
	<h1>Quelle erfassen</h1>
	<p>Erfasse eine öffentliche Quelle und ihre genaue Belegstelle. Die Originalantwort wird privat gesichert; daraus entsteht nur ein privater Faktenentwurf. Prüfe Aussage, Rechte und mögliche sensible Angaben selbst vor der Veröffentlichung.</p>
	{#if !data.storageReady}<p class="warning" role="status">Die private S3-Speicherung ist noch nicht konfiguriert. Für neue Quellensnapshots werden S3-Endpunkt, Bucket und Zugangsdaten benötigt.</p>{/if}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	{#if form?.storageCheck === 'ready'}<p class="success" role="status">Der Bucket „raw“ ist erreichbar. Der Test hat keine Datei geschrieben.</p>{/if}
	{#if form?.storageCheck === 'missing'}<p class="error" role="alert">Der Bucket „raw“ wurde nicht gefunden. Lege ihn in SeaweedFS an.</p>{/if}
	{#if form?.storageCheck === 'forbidden'}<p class="error" role="alert">Der S3-Zugriff wurde verweigert. Prüfe Gateway-Zugangsdaten und Bucket-Rechte; der Bucket könnte trotzdem existieren.</p>{/if}
	{#if form?.storageCheck === 'connection_refused'}<p class="error" role="alert">Der S3-Hostname ist erreichbar, aber Port 8333 weist die Verbindung ab. Prüfe, ob das Gateway läuft und auf der gemeinsamen Docker-Netzwerkadresse lauscht.</p>{/if}
	{#if form?.storageCheck === 'name_not_found'}<p class="error" role="alert">Der interne S3-Hostname konnte nicht aufgelöst werden. Prüfe den Endpunkt und das gemeinsame Coolify-Netzwerk.</p>{/if}
	{#if form?.storageCheck === 'unavailable'}<p class="error" role="alert">Die S3-Verbindung konnte nicht geprüft werden. Prüfe Endpunkt und SeaweedFS-Status.</p>{/if}
	<form method="POST" action="?/checkStorage"><button class="button" type="submit" disabled={!data.storageReady}>Raw-Bucket prüfen</button></form>
	{#if data.projects.length}
		<section class="panel" aria-labelledby="new-title">
			<h2 id="new-title">Neuer Quellenbeleg</h2>
			<form method="POST" action="?/observe" class="fields">
				<input type="hidden" name="idempotencyKey" value={data.observationKey} />
				<label>Projekt <select name="projectId" required>{#each data.projects as project}<option value={project.id}>{project.name}</option>{/each}</select></label>
				<label>Quellenart <select name="sourceType"><option value="official_page">Offizielle Seite</option><option value="official_statement">Offizielle Mitteilung</option><option value="partner_message">Partnernachricht mit öffentlicher URL</option><option value="press">Presse</option><option value="event">Veranstaltung</option></select></label>
				<label>Autorität <select name="authority"><option value="official">Offizielle Quelle</option><option value="partner">Partner</option><option value="press">Presse</option><option value="reference">Kontext/Verweis</option></select></label>
				<label>Name der Quelle <input name="name" maxlength="160" required placeholder="Zum Beispiel: Wilderness International – MA-Forest" /></label>
				<label>Herausgeber <input name="owner" maxlength="160" required placeholder="Organisation oder Verlag" /></label>
				<label>Öffentliche HTTPS-Adresse <input name="url" type="url" required placeholder="https://…" /></label>
				<label>Quelldatum (falls bekannt) <input name="sourcePublishedAt" type="date" /></label>
				<label>Faktenart <select name="kind"><option value="milestone">Meilenstein</option><option value="status">Stand</option><option value="outcome">Ergebnis</option><option value="context">Hintergrund</option></select></label>
				<label>Vorgeschlagene Aussage <textarea name="statement" rows="3" maxlength="1000" required></textarea></label>
				<label>Genaue Belegstelle <textarea name="passage" rows="4" maxlength="4000" required></textarea></label>
				<label>Rechte und Quellenhinweis <textarea name="rightsNote" rows="2" maxlength="1000" required placeholder="Zum Beispiel: öffentlicher Link; keine Medien übernehmen"></textarea></label>
				<label>Sensibilität <select name="sensitivity"><option value="none">Keine erkennbare</option><option value="review">Vor Veröffentlichung besonders prüfen</option></select></label>
				<button class="button" type="submit" disabled={!data.storageReady}>Quelle privat sichern und Entwurf anlegen</button>
			</form>
		</section>
	{:else}<p>Lege unter <a href="/admin/inhalte">Inhalte</a> zuerst ein Projekt an.</p>{/if}
	<section class="panel" aria-labelledby="registry-title">
		<h2 id="registry-title">Quellenübersicht</h2>
		{#if data.registry.length}<ul>{#each data.registry as source}<li>
			<strong><a href={`/admin/quellen/${source.id}`}>{source.name}</a></strong> · {source.health === 'healthy' ? 'erreichbar' : source.health === 'paused' ? 'pausiert' : source.health === 'error' ? 'Fehler' : 'noch nicht geprüft'}
			<br /><span>{source.owner} · zuletzt erfolgreich: {source.lastSuccessfulAt ? formatDate(source.lastSuccessfulAt) : 'noch nie'}</span>
		</li>{/each}</ul>{:else}<p>Noch keine Quellen erfasst.</p>{/if}
	</section>
	<section class="panel" aria-labelledby="recent-title">
		<h2 id="recent-title">Letzte Erfassungen</h2>
		{#if data.recent.length}<ul>{#each data.recent as run}<li><strong><a href={`/admin/quellen/${run.sourceId}`}>{run.name}</a></strong> · {run.outcome} {run.statusCode ? `(HTTP ${run.statusCode})` : ''} · <time datetime={new Date(run.fetchedAt).toISOString()}>{formatDate(run.fetchedAt)}</time><br /><a href={run.url} rel="external noreferrer">{run.url}</a></li>{/each}</ul>{:else}<p>Noch keine Quellen erfasst.</p>{/if}
	</section>
	<p><a href="/admin/chat">Zurück zum Inhaltschat</a></p>
</main>

<style>
	.page { max-width: 54rem; padding-top: clamp(2rem, 6vw, 5rem); }
	.page h1 { font-size: clamp(2rem, 5vw, 3.4rem); }
	.panel { margin: 2rem 0; padding: clamp(1rem, 3vw, 2rem); border: 1px solid var(--color-line); background: var(--color-surface); }
	.panel h2 { font-size: 1.6rem; }
	.fields, .fields label { display: grid; gap: .6rem; }
	.fields { gap: 1rem; }
	.fields input, .fields select, .fields textarea { width: 100%; padding: .65rem; border: 1px solid var(--color-ink); border-radius: .25rem; background: white; }
	.fields button { justify-self: start; }
	.warning, .error { padding: 1rem; background: var(--color-surface); border-left: .3rem solid var(--color-clay); }
	.success { padding: 1rem; background: var(--color-surface); border-left: .3rem solid var(--color-moss); }
	li { margin: .7rem 0; overflow-wrap: anywhere; }
</style>
