<script lang="ts">
	let { data, form } = $props();
	const labels: Record<string, string> = { spende: 'Spende', petition: 'Petition', ticket: 'Ticket', information: 'Information', merchandise: 'Merchandise' };
	let values = $derived(form && 'values' in form ? form.values : undefined);
</script>

<svelte:head><title>Aktuelle Hilfe verwalten · Alles für die Tiere</title><meta name="robots" content="noindex, nofollow" /></svelte:head>

<main class="container page">
	<p class="eyebrow">Technische Verwaltung</p>
	<h1>Aktuelle Hilfe</h1>
	<p>Hier legst du die Aktion fest, die auf <a href="/jetzt">/jetzt</a> erscheint. Prüfe die Quelle, den Empfänger und mögliche Weiterleitungen der Zieladresse vor der Freigabe.</p>
	{#if data.published}<p class="success" role="status">Die neue Aktion ist veröffentlicht.</p>{/if}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	<section aria-labelledby="current-title" class="panel">
		<h2 id="current-title">Gerade sichtbar</h2>
		{#if data.current.action}
			<p><strong>{data.current.action.label}</strong> · {data.current.action.recipientName}</p>
			<p class="meta">{data.current.action.destinationHost}</p>
		{:else}<p>Zurzeit ist keine Aktion veröffentlicht oder die letzte Aktion ist abgelaufen.</p>{/if}
	</section>
	<section aria-labelledby="new-title" class="panel">
		<h2 id="new-title">Neue Aktion vorbereiten</h2>
		<form method="POST" action="?/preview" class="fields">
			<label>Art
				<select name="kind" value={values?.kind ?? data.actionKinds[0]} required>{#each data.actionKinds as kind}<option value={kind}>{labels[kind]}</option>{/each}</select>
			</label>
			<label>Bezeichnung für Besucher <input name="label" value={values?.label ?? ''} maxlength="180" required placeholder="Zum Beispiel: MA-Forest unterstützen" /></label>
			<label>Empfängerorganisation <input name="recipientName" value={values?.recipientName ?? ''} required placeholder="Name der Organisation" /></label>
			<label>Zieladresse <input name="destinationUrl" value={values?.destinationUrl ?? ''} type="url" required placeholder="https://…" /></label>
			<label>Öffentliche Quelle für die Aktion <input name="evidenceUrl" value={values?.evidenceUrl ?? ''} type="url" required placeholder="https://…" /></label>
			<label>Ablauf (optional, UTC) <input name="endsAt" value={values?.endsAt ?? ''} type="datetime-local" />
				<span class="hint">Eine befristete Aktion braucht einen bereits veröffentlichten, unbefristeten Fallback. Die eingegebene Uhrzeit wird als UTC gelesen.</span>
			</label>
			<label>Fallback nach Ablauf
				<select name="fallbackActionId" value={values?.fallbackActionId ?? ''}><option value="">Keiner – nur für unbefristete Aktionen</option>{#each data.fallbacks as action}<option value={action.id}>{action.label} · {action.recipientName}</option>{/each}</select>
			</label>
			<button class="button" type="submit">Vorschau anzeigen</button>
		</form>
	</section>
	{#if form?.preview}
		<section aria-labelledby="preview-title" class="panel preview">
			<p class="eyebrow">Vorschau · noch nicht öffentlich</p>
			<h2 id="preview-title">{form.preview.label}</h2>
			<p><strong>Empfänger:</strong> {form.preview.recipientName}</p>
			<p><strong>Art:</strong> {labels[String(form.preview.kind)]}</p>
			<p><strong>Eingegebene Zieladresse:</strong> {form.preview.destinationUrl} ({form.preview.destinationHost})</p>
			<p><strong>Quelle:</strong> <a href={String(form.preview.evidenceUrl)} rel="external noreferrer">{form.preview.evidenceUrl}</a></p>
			<p><strong>Ablauf:</strong> {form.preview.endsAt ? `${form.preview.endsAt} UTC` : 'unbefristet'}</p>
			<p><strong>Fallback:</strong> {data.fallbacks.find((action) => action.id === form.preview.fallbackActionId)?.label ?? 'keiner'}</p>
			<form method="POST" action="?/publish">
				<input type="hidden" name="kind" value={form.preview.kind} />
				<input type="hidden" name="label" value={form.preview.label} />
				<input type="hidden" name="recipientName" value={form.preview.recipientName} />
				<input type="hidden" name="destinationUrl" value={form.preview.destinationUrl} />
				<input type="hidden" name="evidenceUrl" value={form.preview.evidenceUrl} />
				<input type="hidden" name="endsAt" value={form.preview.endsAt} />
				<input type="hidden" name="fallbackActionId" value={form.preview.fallbackActionId} />
				<input type="hidden" name="expectedRevisionId" value={form.preview.expectedRevisionId ?? ''} />
				<input type="hidden" name="idempotencyKey" value={form.preview.idempotencyKey} />
				<button class="button" type="submit">Jetzt veröffentlichen</button>
			</form>
		</section>
	{/if}
	<p><a href="/admin/chat">Zurück zum Inhaltschat</a></p>
</main>

<style>
	.page { max-width: 50rem; padding-top: clamp(2rem, 6vw, 5rem); }
	.page > p { max-width: 42rem; }
	.panel { margin: 2rem 0; padding: clamp(1rem, 3vw, 2rem); border: 1px solid var(--color-line); border-radius: var(--radius); background: var(--color-surface); }
	.panel h2 { font-size: clamp(1.5rem, 3vw, 2rem); }
	.fields { display: grid; gap: 1.1rem; }
	.fields label { display: grid; gap: .35rem; font-weight: 700; }
	.fields input, .fields select { width: 100%; padding: .65rem; border: 1px solid var(--color-ink); border-radius: .25rem; background: white; }
	.fields button { justify-self: start; margin-top: .5rem; }
	.hint, .meta { color: var(--color-muted); font-size: .9rem; font-weight: 400; }
	.preview { border-color: var(--color-moss); }
	.preview p { overflow-wrap: anywhere; }
	.success { padding: 1rem; border-left: .3rem solid var(--color-moss); background: var(--color-surface); }
	.error { padding: 1rem; border-left: .3rem solid var(--color-clay); background: var(--color-surface); }
</style>
