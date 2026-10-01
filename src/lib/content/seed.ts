/**
 * Temporary fixture for the first public rendering slice.
 * It intentionally contains no public factual claim. Production content is
 * introduced through the evidence-backed publication flow.
 */
export const launchState = {
	currentAction: {
		label: 'Aktuelle Hilfe wird vorbereitet',
		message: 'Sobald eine Aktion mit Quelle, Empfänger und Ziel geprüft ist, steht sie hier.',
		status: 'Entwurf'
	},
	project: {
		slug: 'ma-forest',
		title: 'MA-Forest',
		intro: 'Eine Projektseite wird gerade mit belegter Geschichte, aktuellem Stand und Quellen aufgebaut.',
		source: {
			publisher: 'Wilderness International',
			url: 'https://en.wilderness-international.org/ma',
			observedAt: '28. September 2026'
		}
	}
} as const;
