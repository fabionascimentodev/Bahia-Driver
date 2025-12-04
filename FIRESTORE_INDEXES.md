# Firestore Indexes / Reindexing Notes

This project queries rides with combinations of equality filters + range/orderBy on the `horaFim` field (ISO date string). Firestore may require composite indexes for such queries. If you see errors, `Range query failed` warnings, or empty lists where data exists, follow the steps below.

## Recommended composite index

For queries used in `DriverEarningsDayScreen` (searching rides for a driver within a day):

- Collection: `rides`
- Fields (order matters):
  - `motoristaId` ASC
  - `status` ASC
  - `horaFim` DESC

Go to Firebase Console → Firestore → Indexes → Add Index and configure the fields as above.

## Example `firestore.indexes.json` entry

If you use the Firebase CLI + `firebase deploy --only firestore:indexes`, add an entry like this in `firestore.indexes.json`:

{
  "indexes": [
    {
      "collectionGroup": "rides",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "motoristaId", "order": "ASCENDING"},
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "horaFim", "order": "DESCENDING"}
      ]
    }
  ]
}

Note: depending on other queries you run, you may also need alternate indexes (e.g. ordering ASC vs DESC for horaFim). Create indexes that match the exact fields and order used by your queries.

## Recommendations
- Consider storing `horaFim` as a Firestore `Timestamp` instead of an ISO string. Timestamps are more efficient and idiomatic for range queries and ordering.
- Add CI/infra configuration to manage Firestore indexes (`firestore.indexes.json`) for reproducible deployments.
- Keep the client-side fallback in `DriverEarningsDayScreen` (already implemented) so the UI remains functional if an index hasn't been created.

If you'd like, I can add the `firestore.indexes.json` snippet into your project or generate the exact Firebase Console link to add this index automatically — tell me which you'd prefer.