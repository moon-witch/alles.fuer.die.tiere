import { validPublicUrl } from '$lib/domain/action-policy';

export const MA_FOREST_PAGE_URL = 'https://en.wilderness-international.org/ma';
export const MA_FOREST_CAMPAIGN_ID = '80718821-5f98-4802-a61c-d6398933d8b8';
export const MA_FOREST_STATS_URL = `https://en.wilderness-international.org/api/statistics/v1/campaigns/independent?ids=${MA_FOREST_CAMPAIGN_ID}`;
export const MA_FOREST_ADAPTER_VERSION = 'ma-forest-v1';

export class MaForestExtractionError extends Error {
	constructor(readonly code: string) { super(code); }
}

export type MaForestExtract = {
	type: 'ma-forest-counter';
	version: typeof MA_FOREST_ADAPTER_VERSION;
	campaignId: typeof MA_FOREST_CAMPAIGN_ID;
	protectedAreaM2: number;
	donations: number;
	protectedKgCo2: number;
	goalM2: number;
	donationUrl: string;
	pageUrl: typeof MA_FOREST_PAGE_URL;
	statisticsUrl: typeof MA_FOREST_STATS_URL;
};

const integerInRange = (value: unknown, maximum: number) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum;

export const extractMaForestStatistics = (body: Uint8Array): Pick<MaForestExtract, 'protectedAreaM2' | 'donations' | 'protectedKgCo2'> => {
	let data: unknown;
	try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
	catch { throw new MaForestExtractionError('ma_statistics_invalid'); }
	if (!data || typeof data !== 'object' || !('result' in data) || !Array.isArray(data.result) || data.result.length !== 1) throw new MaForestExtractionError('ma_statistics_invalid');
	const result = data.result[0];
	if (!result || typeof result !== 'object' || result.uuid !== MA_FOREST_CAMPAIGN_ID || result.code !== 'MA' ||
		!integerInRange(result.protected_size, 100_000_000) || !integerInRange(result.no_donations, 100_000_000) || !integerInRange(result.protected_kg_co2, 100_000_000_000)) throw new MaForestExtractionError('ma_statistics_invalid');
	return { protectedAreaM2: result.protected_size, donations: result.no_donations, protectedKgCo2: result.protected_kg_co2 };
};

const attribute = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1];

/** Read campaign identity and donation destination; the static HTML counter is only a placeholder. */
export const extractMaForestPage = (body: Uint8Array): Pick<MaForestExtract, 'goalM2' | 'donationUrl'> => {
	const html = new TextDecoder('utf-8').decode(body);
	const section = html.indexOf('id="advance-statistic"');
	if (section < 0) throw new MaForestExtractionError('ma_section_missing');
	const opening = html.slice(section, section + 1500).match(/<div\b[^>]*class="[^"]*block_statis_realtime[^"]*"[^>]*>/i)?.[0];
	if (!opening || attribute(opening, 'data-src-id') !== MA_FOREST_CAMPAIGN_ID) throw new MaForestExtractionError('ma_section_missing');
	const goal = Number(attribute(opening, 'data-goal'));
	if (!integerInRange(goal, 100_000_000) || goal === 0) throw new MaForestExtractionError('ma_goal_invalid');
	const fragment = html.slice(section, section + 8000);
	const donationTag = [...fragment.matchAll(/<a\b[^>]*>/gi)].map((match) => match[0]).find((tag) => /\baw_btn\b/.test(attribute(tag, 'class') ?? ''));
	const rawHref = donationTag && attribute(donationTag, 'href');
	const destination = rawHref ? validPublicUrl(rawHref.replaceAll('&amp;', '&')) : null;
	if (!destination) throw new MaForestExtractionError('ma_destination_invalid');
	return { goalM2: goal, donationUrl: destination.toString() };
};

export const classifyMaForestChange = (current: MaForestExtract, previous: MaForestExtract | null): string[] => {
	if (!previous) return ['first_observation'];
	const changes: string[] = [];
	if (current.donationUrl !== previous.donationUrl) changes.push('destination_changed');
	if (current.goalM2 !== previous.goalM2) changes.push('goal_changed');
	if (current.donations !== previous.donations) changes.push('donations_changed');
	if (current.protectedKgCo2 !== previous.protectedKgCo2) changes.push('co2_changed');
	if (current.protectedAreaM2 !== previous.protectedAreaM2) {
		const ratio = previous.protectedAreaM2 === 0 ? 1 : Math.abs(current.protectedAreaM2 - previous.protectedAreaM2) / previous.protectedAreaM2;
		changes.push(ratio > 0.2 ? 'large_counter_change' : 'counter_changed');
	}
	return changes;
};
