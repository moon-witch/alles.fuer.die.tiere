import { describe, expect, it } from 'vitest';
import { classifyMaForestChange, extractMaForestPage, extractMaForestStatistics, MA_FOREST_CAMPAIGN_ID, MA_FOREST_PAGE_URL, MA_FOREST_STATS_URL, MA_FOREST_ADAPTER_VERSION, type MaForestExtract } from './ma-forest';

const bytes = (value: string) => new TextEncoder().encode(value);
const page = (destination = 'https://donate.wilderness-international.org?campaign=MA', id = MA_FOREST_CAMPAIGN_ID) => bytes(`<section id="advance-statistic"><div class="block_statis_realtime" data-type="campaign" data-src-id="${id}" data-goal="2000000"><div class="aw_stat">1.000</div><a class="aw_btn aw_special_white" href="${destination}">Protect forest</a></div></section>`);
const stats = (protectedSize: number) => bytes(JSON.stringify({ result: [{ uuid: MA_FOREST_CAMPAIGN_ID, code: 'MA', no_donations: 96925, protected_size: protectedSize, protected_kg_co2: 128412634 }], errorMessage: null }));
const observation = (protectedAreaM2: number, donationUrl = 'https://donate.wilderness-international.org/?campaign=MA'): MaForestExtract => ({ type: 'ma-forest-counter', version: MA_FOREST_ADAPTER_VERSION, campaignId: MA_FOREST_CAMPAIGN_ID, protectedAreaM2, donations: 96925, protectedKgCo2: 128412634, goalM2: 2_000_000, donationUrl, pageUrl: MA_FOREST_PAGE_URL, statisticsUrl: MA_FOREST_STATS_URL });

describe('MA-Forest narrow extraction', () => {
	it('reads the first-party JSON metric instead of the static HTML placeholder', () => {
		expect(extractMaForestStatistics(stats(2_140_219)).protectedAreaM2).toBe(2_140_219);
		expect(extractMaForestPage(page())).toEqual({ goalM2: 2_000_000, donationUrl: 'https://donate.wilderness-international.org/?campaign=MA' });
	});
	it('rejects a different campaign, a missing section, and malformed metrics', () => {
		expect(() => extractMaForestPage(page(undefined, 'other'))).toThrow('ma_section_missing');
		expect(() => extractMaForestPage(bytes('<p>MA-Forest</p>'))).toThrow('ma_section_missing');
		expect(() => extractMaForestPage(page('http://127.0.0.1/private'))).toThrow('ma_destination_invalid');
		expect(() => extractMaForestStatistics(bytes('{broken'))).toThrow('ma_statistics_invalid');
		expect(() => extractMaForestStatistics(bytes(JSON.stringify({ result: [{ uuid: MA_FOREST_CAMPAIGN_ID, code: 'MA', protected_size: '2,140,219' }] })))).toThrow('ma_statistics_invalid');
	});
	it('accepts downward corrections while flagging changed destinations and large movements', () => {
		expect(classifyMaForestChange(observation(2_140_219), observation(2_140_219))).toEqual([]);
		expect(classifyMaForestChange(observation(2_150_000), observation(2_140_219))).toEqual(['counter_changed']);
		expect(classifyMaForestChange(observation(2_000_000), observation(2_140_219))).toEqual(['counter_changed']);
		expect(classifyMaForestChange(observation(1_000_000), observation(2_140_219))).toEqual(['large_counter_change']);
		expect(classifyMaForestChange(observation(2_140_219, 'https://donate.example.org/?campaign=MA'), observation(2_140_219))).toEqual(['destination_changed']);
	});
});
