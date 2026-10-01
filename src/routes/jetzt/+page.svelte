<script lang="ts">
	import { launchState } from '$lib/content/seed';
</script>

<svelte:head><title>Jetzt helfen · Alles für die Tiere</title></svelte:head>

<section class="container page">
	<p class="eyebrow">Jetzt helfen</p>
	<h1>{launchState.currentAction.label}</h1>
	<p class="lede">{launchState.currentAction.message}</p>
	<div class="notice" role="status">
		<strong>Noch kein externer Aufruf.</strong>
		<p>Diese stabile Seite zeigt erst dann eine Aktion, wenn Empfänger, Zieladresse, Zeitraum und Fallback geprüft und veröffentlicht sind.</p>
	</div>
	<section aria-labelledby="what-next">
		<h2 id="what-next">Was hier transparent bleibt</h2>
		<ul>
			<li>wer die Hilfe erhält und wohin der Link führt,</li>
			<li>ob es sich um eine Spende, Petition, ein Ticket oder Informationen handelt,</li>
			<li>die Quelle und der Stand der Information.</li>
		</ul>
	</section>
</section>

<style>
	.page { max-width: var(--reading-width); padding-top: clamp(3rem, 8vw, 7rem); }
	.lede { font-size: 1.3rem; }
	.notice { margin: 2.5rem 0 4rem; padding: 1.5rem; border: 1px solid var(--color-line); border-left: .3rem solid var(--color-sun); background: var(--color-surface); }
	.notice p { margin-bottom: 0; }
	li { margin-bottom: .7rem; }
</style>
