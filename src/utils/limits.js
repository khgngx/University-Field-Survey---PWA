// Pure module (no Vite-only globals) shared by the client and the Vercel API, so the two
// can never disagree about what the server will accept.
export const MAX_LOCATION_LENGTH = 50
export const MAX_NOTES_LENGTH = 2000
