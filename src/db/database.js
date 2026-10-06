import Dexie from 'dexie'

export const db = new Dexie('vku_field_survey')

db.version(1).stores({
  // id is a UUID; only the listed fields are indexed.
  surveys: 'id, status, [building+floor+room], createdAt, nextRetryAt',
  syncLog: '++id, surveyId, timestamp',
})
