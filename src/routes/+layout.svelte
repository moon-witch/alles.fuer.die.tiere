<script lang="ts">
	import '$lib/styles/base.css';
	let { children } = $props();
</script>

<svelte:head>
	<meta name="theme-color" content="#f7f3ec" />
	<meta name="description" content="Alles für die Tiere verbindet belegte Geschichten mit einer klaren Möglichkeit zu helfen." />
</svelte:head>

<a class="skip-link" href="#main">Zum Inhalt springen</a>
<header class="header">
	<div class="container header__inner">
		<a class="wordmark" href="/" aria-label="Alles für die Tiere – Startseite">alles für die tiere</a>
		<nav aria-label="Hauptnavigation">
			<a href="/projekte">Projekte</a>
			<a href="/helfen">Helfen</a>
			<a href="/termine">Termine</a>
		</nav>
		<a class="button header__action" href="/jetzt">Jetzt helfen</a>
	</div>
</header>
<main id="main">{@render children()}</main>
<footer class="footer">
	<div class="container footer__inner">
		<p>Alles für die Tiere</p>
		<nav aria-label="Rechtliches"><a href="/ueber-uns">Über uns</a><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a></nav>
	</div>
</footer>

<style>
	.skip-link { position: absolute; left: 1rem; top: -4rem; z-index: 10; padding: .5rem .75rem; background: var(--color-ink); color: white; }
	.skip-link:focus { top: 1rem; }
	.header { border-bottom: 1px solid var(--color-line); background: var(--color-paper); }
	.header__inner, .footer__inner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 5rem; }
	.wordmark { font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; text-decoration: none; }
	nav { display: flex; align-items: center; gap: clamp(.65rem, 2vw, 1.5rem); }
	nav a { font-weight: 650; text-decoration: none; }
	.header__action { white-space: nowrap; }
	.footer { margin-top: 6rem; border-top: 1px solid var(--color-line); }
	.footer p { margin: 0; font-family: var(--font-display); font-size: 1.25rem; }
	@media (max-width: 42rem) { .header__inner { min-height: auto; flex-wrap: wrap; padding-block: 1rem; } .header nav { order: 3; width: 100%; justify-content: space-between; } .header__action { margin-left: auto; } .footer__inner { align-items: flex-start; flex-direction: column; padding-block: 2rem; } }
</style>
