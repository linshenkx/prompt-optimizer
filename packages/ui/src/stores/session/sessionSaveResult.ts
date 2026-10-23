/** Only transient manager activity is eligible for automatic retry. */
export type SessionSaveResult = 'saved' | 'deferred' | 'blocked' | 'failed'
