import { validPublicUrl } from './action-policy';

export type PublicAction = {
	id: string;
	kind: string;
	label: string;
	recipientName: string;
	destinationUrl: string;
	destinationHost: string;
	evidenceUrl: string;
};

export type CurrentActionPublication = {
	type: 'current-action';
	version: 1;
	primary: PublicAction;
	fallback: PublicAction | null;
	startsAt: string;
	endsAt: string | null;
	publishedAt: string;
};

const isPublicAction = (value: unknown): value is PublicAction => {
	if (!value || typeof value !== 'object') return false;
	const action = value as Partial<PublicAction>;
	return typeof action.id === 'string' && typeof action.kind === 'string' && typeof action.label === 'string' && typeof action.recipientName === 'string' && typeof action.destinationUrl === 'string' && typeof action.destinationHost === 'string' && typeof action.evidenceUrl === 'string' && validPublicUrl(action.destinationUrl)?.hostname === action.destinationHost && Boolean(validPublicUrl(action.evidenceUrl));
};

export const parseCurrentActionPublication = (value: unknown): CurrentActionPublication | null => {
	if (!value || typeof value !== 'object') return null;
	const publication = value as Partial<CurrentActionPublication>;
	if (publication.type !== 'current-action' || publication.version !== 1 || !isPublicAction(publication.primary) || (publication.fallback !== null && !isPublicAction(publication.fallback))) return null;
	if (typeof publication.startsAt !== 'string' || !Number.isFinite(Date.parse(publication.startsAt)) || typeof publication.publishedAt !== 'string' || !Number.isFinite(Date.parse(publication.publishedAt))) return null;
	if (publication.endsAt !== null && (typeof publication.endsAt !== 'string' || !Number.isFinite(Date.parse(publication.endsAt)))) return null;
	return publication as CurrentActionPublication;
};

export const resolveCurrentAction = (publication: CurrentActionPublication | null, now = new Date()): PublicAction | null => {
	if (!publication || now < new Date(publication.startsAt)) return null;
	if (publication.endsAt && now >= new Date(publication.endsAt)) return publication.fallback;
	return publication.primary;
};
