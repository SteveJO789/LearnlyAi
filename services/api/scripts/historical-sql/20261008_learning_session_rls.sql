-- Historical manual patch, retained as evidence. New changes use canonical Prisma migrations.
-- Apply with a privileged migration role, ONLY after the matching backend change
-- passes CI. Never enable BYPASSRLS for the application login role.
BEGIN;

GRANT INSERT, UPDATE ON TABLE public."LearningSession" TO authenticated;
GRANT INSERT ON TABLE public."Message" TO authenticated;

CREATE POLICY learning_session_insert_own_e2e
  ON public."LearningSession"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."User" u
      WHERE u.id = "LearningSession"."userId"
        AND u."authUserId" = (SELECT auth.uid())::text
    )
  );

CREATE POLICY learning_session_update_own_e2e
  ON public."LearningSession"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."User" u
      WHERE u.id = "LearningSession"."userId"
        AND u."authUserId" = (SELECT auth.uid())::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."User" u
      WHERE u.id = "LearningSession"."userId"
        AND u."authUserId" = (SELECT auth.uid())::text
    )
  );

CREATE POLICY message_insert_own_e2e
  ON public."Message"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."LearningSession" ls
      JOIN public."User" u ON u.id = ls."userId"
      WHERE ls.id = "Message"."learningSessionId"
        AND u."authUserId" = (SELECT auth.uid())::text
    )
  );
COMMIT;
