# Firestore schema

The Firebase Authentication user is the source of identity. The user's Firebase UID replaces the integer MySQL `user_id`. Authentication custom claims carry the role (`user` or `admin`); profile fields live in Firestore so they can be edited without changing claims.

| Collection | Document ID | Fields |
| --- | --- | --- |
| `users` | Firebase UID | `name`, `collegeName`, `email`, `role`, `createdAt` |
| `round1_questions` | migrated question ID as a string | `questionNo`, `language`, `code`, `correctLine`, `correctedLine`, `description`, `createdAt` |
| `round2_questions` | migrated question ID as a string | `questionNo`, `language`, `question`, `starterCode`, `expectedAnswer`, `testCases`, `createdAt` |
| `round1_answers` | `{uid}_{questionId}` | `userId`, `questionId`, `errorLine`, `correctedLine`, `description`, `score`, `submittedAt` |
| `round2_answers` | `{uid}_{questionId}` | `userId`, `questionId`, `answer`, `syntaxErrors`, `logicalErrors`, `syntaxPenalty`, `logicalPenalty`, `score`, `aiFeedback`, `evaluated`, `submittedAt`, `evaluatedAt` |
| `event_settings` | `current` | `round1Started`, `round2Started`, `round1Finished`, `round2Finished`, `updatedAt` |

Answer document IDs preserve the MySQL unique constraint on `(user_id, question_id)`: submissions overwrite the same user's previous answer for that question.

## Migration mapping

- `users` and `admins`: create Firebase Authentication accounts, then write a matching `users/{uid}` profile. Set the `admin` custom claim for migrated administrators and `user` for participants.
- `round1_questions` and `round2_questions`: copy rows into the collections above, converting snake_case fields to camelCase and timestamps to Firestore `Timestamp` values.
- `round1_answers` and `round2_answers`: replace integer `user_id` values with the mapped Firebase UID and use deterministic answer document IDs.
- `event_settings` row `id = 1`: write one `event_settings/current` document with boolean values.

The migration script will be added after the API routes so it can share the same typed model and Firebase initialization.