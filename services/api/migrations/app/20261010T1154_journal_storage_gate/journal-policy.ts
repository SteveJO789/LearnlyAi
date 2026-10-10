/** Immutable migration-owned predicate; API-created intent and Auth UID govern upload eligibility. */
export const JOURNAL_POLICY = "learnly_materials_pending_intent_guard";
export const JOURNAL_CHECK = `(bucket_id IS DISTINCT FROM 'learnly-materials' OR EXISTS (
  SELECT 1 FROM public."FileUpload" f
  JOIN public."LearningSession" s ON s.id = f."learningSessionId"
  JOIN public."User" u ON u.id = s."userId"
  WHERE f.state = 'PENDING' AND s."lifecycleState" = 'ACTIVE'
    AND u."authUserId" = (SELECT auth.uid())::text
    AND f."learningSessionId" = split_part(storage.objects.name, '/', 2)
    AND f.id = split_part(split_part(storage.objects.name, '/', 3), '.', 1)
    AND f.material->>'id' = f.id
    AND f.material->>'storageBucket' = storage.objects.bucket_id
    AND f.material->>'storageKey' = storage.objects.name
    AND f.material->'file'->>'extension' = split_part(storage.objects.name, '.', 2)
    AND ((f.material->'file'->>'type' = 'PDF' AND f.material->'file'->>'mimeType' = 'application/pdf'
      AND f.material->'file'->>'extension' = 'pdf')
      OR (f.material->'file'->>'type' = 'IMAGE' AND ((f.material->'file'->>'mimeType' = 'image/png'
        AND f.material->'file'->>'extension' = 'png') OR (f.material->'file'->>'mimeType' = 'image/jpeg'
        AND f.material->'file'->>'extension' = 'jpg'))))
    AND f.material->'file'->>'contentHash' ~ '^[a-f0-9]{64}$'
    AND CASE WHEN f.material->'file'->>'sizeBytes' ~ '^[1-9][0-9]{0,6}$'
      THEN (f.material->'file'->>'sizeBytes')::integer BETWEEN 1 AND 3145728 ELSE false END
    AND NOT EXISTS (SELECT 1 FROM public."SourceMaterial" m
      WHERE m.id = f.id AND m."learningSessionId" = f."learningSessionId")
))`;
