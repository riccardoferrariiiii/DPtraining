# Firestore schema

users/{uid}: email, role, subscriptionExpiresAt
  notifications/{notificationId}: title, message, type, link, readAt, createdAt
  prs/{prId}: name, normalizedName, kind(time|weight), timeValue, weightKg, reps, createdAt, updatedAt, recordedAt
  weeks/{weekId}: title, templateId, createdAt, updatedAt
    results/{resultId}: result, dayOrder, coachComment, updatedAt

athletePrograms/{athleteUid}/weeks/{weekId}
  days/{dayId}
    workouts/{workoutId}

results/{athleteUid}/entries/{entryId}
