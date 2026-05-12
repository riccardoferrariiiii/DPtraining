export const paths = {
  user: (uid: string) => `users/${uid}`,
  weeks: (athleteUid: string) => `athletePrograms/${athleteUid}/weeks`,
  week: (athleteUid: string, weekId: string) => `athletePrograms/${athleteUid}/weeks/${weekId}`,
  days: (athleteUid: string, weekId: string) => `athletePrograms/${athleteUid}/weeks/${weekId}/days`,
  workouts: (athleteUid: string, weekId: string, dayId: string) =>
    `athletePrograms/${athleteUid}/weeks/${weekId}/days/${dayId}/workouts`,
  results: (athleteUid: string) => `results/${athleteUid}/entries`,
};
