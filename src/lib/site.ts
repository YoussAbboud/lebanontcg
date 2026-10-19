/** The canonical origin. Used for canonical links, Open Graph URLs and
    structured data — never for fetching. */
export const SITE_URL = 'https://www.lebanontcg.com';
export const SITE_NAME = 'LebanonTCG';
export const DEFAULT_DESCRIPTION =
  "Lebanon's peer-to-peer trading card marketplace. List Pokémon, Magic, Yu-Gi-Oh! and One Piece cards, find deals, and arrange trades directly with other collectors.";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og.png`;

/**
 * Whether the listing cap is on, as far as a signed-out visitor can
 * tell. The database is the authority (listing_quota_enabled(), read
 * through my_entitlements() once signed in); this only decides which
 * copy the Plans page shows before that. Flip together with the SQL.
 */
export const LISTING_QUOTA_DEFAULT = false;

/**
 * Legal. Requests and appeals go through support tickets (/support), so
 * nothing depends on a mailbox. The effective date moves whenever the
 * Terms or the Privacy Policy change in substance.
 */
export const LEGAL_EFFECTIVE_DATE = '2026-10-19';
export const OPERATOR_NAME = 'LebanonTCG';
