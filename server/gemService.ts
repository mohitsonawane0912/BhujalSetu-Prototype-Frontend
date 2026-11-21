/**
 * Groundwater Ecological Merits (GEMs) & Water Credits — Proposed Feature Concept
 *
 * GEMs and Water Credits are strictly a proposed incentive concept to present to judges.
 * The token system is proposed for future development and will require formal community
 * and authority agreement before any implementation.
 *
 * No points, tokens, balances, or redemptions are calculated, awarded, or stored now.
 */

export const GEM_PROPOSED_DESCRIPTION =
  'GEMs and Water Credits are a proposed incentive framework for future exploration. Any implementation requires prior community consensus, Gram Panchayat resolution, and groundwater authority agreement. No points or tokens are awarded, tracked, or redeemable in the active prototype.';

export interface CommunityGemSummary {
  villageId: string;
  proposed: true;
  message: string;
}

export const GemService = {
  clearTestData(): void {
    // No-op: no tokens or points stored
  },

  async getCommunitySummary(villageId: string): Promise<CommunityGemSummary> {
    return {
      villageId,
      proposed: true,
      message: GEM_PROPOSED_DESCRIPTION,
    };
  },
};
