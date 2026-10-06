<script lang="ts">
	let { data, form } = $props();
	const formatDate = (value: string | Date) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value));
</script>

<svelte:head><title>Verlaufseintrag · Alles für die Tiere</title><meta name="robots" content="noindex, nofollow" /></svelte:head>

<main class="container page">
	<p class="eyebrow">Verlauf · {data.event.eventType}</p>
	<h1>{data.event.summary}</h1>
	{#if data.reverted}<p class="success" role="status">Die Änderung wurde rückgängig gemacht. Der Vorgang bleibt im Verlauf erhalten.</p>{/if}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	<p><time datetime={new Date(data.event.createdAt).toISOString()}>{formatDate(data.event.createdAt)}</time> · Auslöser: {data.event.origin}</p>
	{#if data.event.publicEffect}<p class="effect">Öffentliche Wirkung: {data.event.publicEffect}</p>{:else}<p>Keine unmittelbare öffentliche Wirkung.</p>{/if}
	{#if data.operation}
		<section aria-labelledby="operation-title" class="panel">
			<h2 id="operation-title">Zugehörige Änderung</h2>
			<p>Art: {data.operation.type} · Status: {data.operation.status}</p>
			{#if data.claimId}<p><a href={`/admin/inhalte/${data.claimId}`}>Faktenentwurf und genaue Belege prüfen</a></p>{/if}
			{#if data.operation.instruction}<p>Auftrag: {data.operation.instruction}</p>{/if}
			<details><summary>Strukturierte Änderung ansehen</summary>
				<h3>Eingabe</h3><pre>{JSON.stringify(data.operation.input, null, 2)}</pre>
				<h3>Inhalt</h3><pre>{JSON.stringify(data.operation.entityDiff, null, 2)}</pre>
				<h3>Veröffentlichung</h3><pre>{JSON.stringify(data.operation.publicationDiff, null, 2)}</pre>
			</details>
		</section>
	{/if}
	{#if data.revision}<p>Veröffentlichungsrevision: <code>{data.revision.id}</code> · {data.revision.templateVersion}</p>{/if}
	{#if data.revertPreview}
		<section aria-labelledby="revert-title" class="panel">
			<p class="eyebrow">Vorschau · noch keine Änderung</p>
			<h2 id="revert-title">Änderung rückgängig machen</h2>
			<p>Betroffen: <a href="/jetzt">Aktuelle Hilfe</a>. Die öffentliche Seite würde danach {data.revertPreview.restoredAction ? `wieder „${data.revertPreview.restoredAction.label}“ für ${data.revertPreview.restoredAction.recipientName} zeigen` : 'keine Aktion zeigen'}.</p>
			{#if data.revertPreview.reason}
				<p class="error">{data.revertPreview.reason}</p>
			{:else}
				<p>Die ursprüngliche Veröffentlichung bleibt im Verlauf. Das Rückgängigmachen erzeugt einen neuen Vorgang und {data.revertPreview.beforeRevisionId ? 'eine neue Veröffentlichungsrevision' : 'entfernt die erste Aktion'}.</p>
				<form method="POST" action="?/revert">
					<input type="hidden" name="targetOperationId" value={data.revertPreview.targetOperationId} />
					<input type="hidden" name="expectedRevisionId" value={data.revertPreview.expectedRevisionId} />
					<input type="hidden" name="idempotencyKey" value={data.revertKey} />
					<button class="button" type="submit">Rückgängigmachen bestätigen</button>
				</form>
			{/if}
		</section>
	{/if}
	{#if data.claimRevertPreview}
		<section aria-labelledby="claim-revert-title" class="panel">
			<p class="eyebrow">Vorschau · noch keine Änderung</p>
			<h2 id="claim-revert-title">Fakt zurücknehmen</h2>
			<p>Der Fakt „{data.claimRevertPreview.claimStatement}“ würde aus <a href={data.claimRevertPreview.route}>{data.claimRevertPreview.route}</a> entfernt. Danach {data.claimRevertPreview.remainingClaims ? `bleiben ${data.claimRevertPreview.remainingClaims} veröffentlichte Fakten auf der Projektseite` : 'wird die Projektseite nicht mehr öffentlich angezeigt'}.</p>
			{#if data.claimRevertPreview.reason}
				<p class="error">{data.claimRevertPreview.reason}</p>
			{:else}
				<p>Der Entwurf und seine Belege bleiben intern erhalten. Die ursprüngliche Veröffentlichung bleibt im Verlauf; das Rückgängigmachen wird als neuer Vorgang dokumentiert.</p>
				<form method="POST" action="?/revert">
					<input type="hidden" name="targetOperationId" value={data.claimRevertPreview.targetOperationId} />
					<input type="hidden" name="expectedRevisionId" value={data.claimRevertPreview.expectedRevisionId} />
					<input type="hidden" name="idempotencyKey" value={data.revertKey} />
					<button class="button" type="submit">Fakt zurücknehmen bestätigen</button>
				</form>
			{/if}
		</section>
	{/if}
	<details><summary>Ereignisdaten ansehen</summary><pre>{JSON.stringify(data.event.payload, null, 2)}</pre></details>
	<p class="back"><a href="/admin/verlauf">Zurück zum Verlauf</a></p>
</main>

<style>
	.page { max-width: 50rem; padding-top: clamp(2rem, 6vw, 5rem); }
	.page h1 { font-size: clamp(2rem, 5vw, 3.4rem); }
	.effect { padding: 1rem; border-left: .3rem solid var(--color-moss); background: var(--color-surface); }
	.success, .error { padding: 1rem; background: var(--color-surface); }
	.success { border-left: .3rem solid var(--color-moss); }
	.error { border-left: .3rem solid var(--color-clay); }
	.panel { margin: 2rem 0; padding: clamp(1rem, 3vw, 2rem); border: 1px solid var(--color-line); background: var(--color-surface); }
	.panel h2 { font-size: 1.6rem; }
	pre { overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 1rem; background: var(--color-paper); font-size: .85rem; }
	details { margin-top: 1rem; }
	summary { cursor: pointer; font-weight: 700; }
	.back { margin-top: 2rem; }
</style>
