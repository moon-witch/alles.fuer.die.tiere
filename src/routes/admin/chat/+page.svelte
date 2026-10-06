<script lang="ts">let { form, data } = $props();</script>
<svelte:head><title>Chat · Alles für die Tiere</title><meta name="robots" content="noindex, nofollow" /></svelte:head>
<main class="chat">
	<header>
		<p class="eyebrow">Privater Inhaltschat</p>
		<h1>Was möchtest du teilen?</h1>
		<p>Ich mache daraus einen nachvollziehbaren Entwurf. Veröffentlicht wird erst nach deiner Vorschau und Bestätigung.</p>
		{#if data.isSteward}
			<nav aria-label="Technische Verwaltung"><a href="/admin/inhalte">Inhalte</a> · <a href="/admin/aktuelle-hilfe">Aktuelle Hilfe</a> · <a href="/admin/aufgaben">Aufgaben</a> · <a href="/admin/verlauf">Verlauf</a></nav>
		{/if}
	</header>
	<section class="status" aria-label="Status"><strong>Heute</strong><span>Der Inhaltschat bereitet nur private Entwürfe vor.</span></section>
	{#if form?.sent}<article class="message message--user"><strong>Du</strong><p>{form.sent}</p></article>{/if}
	{#if form?.message}<article class="message"><strong>Alles für die Tiere</strong><p>{form.message}</p></article>{/if}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	<form method="POST" class="composer"><label for="message">Deine Nachricht</label><textarea id="message" name="message" rows="5" placeholder="Ich möchte ein Update zu … teilen" required></textarea><button class="button" type="submit">Entwurf vorbereiten</button></form>
</main>
<style>.chat { width:min(calc(100% - 2rem),42rem); margin:0 auto; padding:clamp(2rem,7vw,6rem) 0; }.chat header p { font-size:1.1rem; }.status,.message,.composer { margin-top:2rem; padding:1rem; border:1px solid var(--color-line); border-radius:var(--radius); background:var(--color-surface); }.status { display:flex; gap:1rem; align-items:baseline; }.message--user { background:var(--color-sky); }.message p { margin:.5rem 0 0; white-space:pre-wrap; }.composer { display:grid; gap:.7rem; }.composer textarea { width:100%; resize:vertical; padding:.75rem; border:1px solid var(--color-ink); border-radius:.25rem; }.composer .button { justify-self:start; }.error { color:#982d22; font-weight:700; }</style>
