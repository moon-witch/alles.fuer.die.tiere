import { env } from '$env/dynamic/private';
import { getCurrentAction } from '$lib/server/actions/current';

export const load = async ({ setHeaders }) => {
	const current = await getCurrentAction();
	const gated = env.REVEAL_GATE_ENABLED === 'true';
	setHeaders({ 'cache-control': gated ? 'private, no-store' : 'public, max-age=0, must-revalidate', ...(!gated && current.revisionId ? { etag: `"${current.revisionId}-${current.action?.id ?? 'none'}"`, 'x-publication-revision': current.revisionId } : {}) });
	return { action: current.action, publishedAt: current.publishedAt };
};
