// KMITL tenant on the 2026 ED22 portal.
export const INSTITUTION_ID = "5232957";
export const COMMUNITY_VERSION = "136";
export const CANONICAL_DOMAIN = "ed22.engdis.com/thai";
export const DEFAULT_API_URL = "https://edwebservices2.engdis.com/api/";

// Local age cap for a saved token. The server may expire it sooner; a 401 on
// the first request also clears it.
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
