import { validPublicUrl } from './action-policy';

export type PublishedEvidence = { url: string; publisher: string; observedAt: string };
export type PublishedClaim = { id: string; kind: string; statement: string; occurredAt: string | null; evidence: PublishedEvidence[] };
export type ProjectPublication = { type: 'project'; version: 1; slug: string; name: string; claims: PublishedClaim[]; publishedAt: string };

export const parseProjectPublication = (value: unknown): ProjectPublication | null => {
	if (!value || typeof value !== 'object') return null;
	const project = value as Partial<ProjectPublication>;
	if (project.type !== 'project' || project.version !== 1 || typeof project.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug) || typeof project.name !== 'string' || !project.name.trim() || !Array.isArray(project.claims) || project.claims.length === 0 || typeof project.publishedAt !== 'string' || !Number.isFinite(Date.parse(project.publishedAt))) return null;
	for (const claim of project.claims) {
		if (!claim || typeof claim.id !== 'string' || !['milestone', 'status', 'outcome', 'context'].includes(claim.kind) || typeof claim.statement !== 'string' || !claim.statement.trim() || (claim.occurredAt !== null && (typeof claim.occurredAt !== 'string' || !Number.isFinite(Date.parse(claim.occurredAt)))) || !Array.isArray(claim.evidence) || claim.evidence.length === 0) return null;
		for (const evidence of claim.evidence) {
			if (!evidence || typeof evidence.url !== 'string' || !validPublicUrl(evidence.url) || typeof evidence.publisher !== 'string' || !evidence.publisher.trim() || typeof evidence.observedAt !== 'string' || !Number.isFinite(Date.parse(evidence.observedAt))) return null;
		}
	}
	return project as ProjectPublication;
};
