<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>Alles für die Tiere</title><meta name="robots" content="noindex, nofollow" /></svelte:head>
<main class="gate">
	<section aria-labelledby="gate-title">
		<p class="eyebrow">Private Vorschau</p>
		<h1 id="gate-title">alles für die tiere</h1>
		<p>Diese Seite wird gerade vorbereitet.</p>
		<form method="POST">
			<input type="hidden" name="next" value={data.next} />
			<label for="password">Passwort</label>
			<input id="password" name="password" type="password" autocomplete="current-password" required aria-describedby={form?.invalid ? 'password-error' : undefined} />
			{#if form?.invalid}<p id="password-error" class="error">Das Passwort stimmt nicht.</p>{/if}
			<button class="button" type="submit">Vorschau öffnen</button>
		</form>
	</section>
</main>

<style>
	.gate { display: grid; min-height: 100vh; place-items: center; padding: 1rem; background: var(--color-paper); }
	section { width: min(100%, 29rem); padding: clamp(1.5rem, 7vw, 3rem); border: 1px solid var(--color-ink); border-radius: var(--radius); background: var(--color-surface); }
	form { display: grid; gap: .6rem; margin-top: 2rem; }
	input { min-height: 2.75rem; padding: .5rem .7rem; border: 1px solid var(--color-ink); border-radius: .25rem; background: white; }
	button { margin-top: .8rem; }
	.error { color: #982d22; font-weight: 700; }
</style>
