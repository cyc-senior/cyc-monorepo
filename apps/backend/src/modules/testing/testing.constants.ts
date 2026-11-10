/** Version of the notice below; bump it whenever the text changes. */
export const DEFAULT_CONSENT_VERSION = 'pdpa-2026-01'

/**
 * PDPA notice shown to a participant when a designer does not provide their
 * own. It states purpose, data, retention and rights; consent is recorded per
 * session against this version and the hash of the exact text shown.
 */
export const DEFAULT_CONSENT_TEXT = `You are invited to take part in a usability test of a design prototype.

What we collect: your email address (to identify you in this session only), your answers and comments, how you interact with the prototype (clicks, navigation, task times). We do not record audio, video or your screen, and we do not collect any other personal data.

Why: to find out where the design is hard to use and to improve it. Your comments may be summarised with the help of an AI service; your email address is never sent to it.

Who sees it: the design team of this project. Stakeholders only see aggregated findings, never your identity or your individual answers.

Keeping it: results are kept as research data for the project. You may withdraw at any time during the session; contact the design team to ask for your data to be deleted.

Taking part is voluntary. Consent given for this session does not apply to any other session.`

/** Invitations and participant tokens never outlive the session, and a session never lasts longer than this. */
export const MAX_SESSION_DAYS = 60

/** Prototypes compared in one session. */
export const MAX_SESSION_VARIANTS = 4

export const MAX_TASKS_PER_SESSION = 30

export const MAX_PARTICIPANTS_PER_REQUEST = 50

export const MAX_PARTICIPANTS_PER_SESSION = 500

/** Interaction events accepted per request / per metadata object (bytes). */
export const MAX_EVENTS_PER_BATCH = 100
export const MAX_EVENT_METADATA_BYTES = 2048

/** Raw feedback loaded into one AI analysis. */
export const MAX_FEEDBACK_PER_ANALYSIS = 300
