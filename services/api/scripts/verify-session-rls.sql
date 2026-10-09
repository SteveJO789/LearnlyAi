BEGIN;
SET LOCAL statement_timeout = '10s';
INSERT INTO public."User" ("id","authUserId","displayName","updatedAt")
VALUES ('11111111-1111-4111-8111-11111111ab01','11111111-1111-4111-8111-11111111ab01','MVP RLS fixture A',now()),
('11111111-1111-4111-8111-11111111ab02','11111111-1111-4111-8111-11111111ab02','MVP RLS fixture B',now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-11111111ab01","role":"authenticated"}',true);
INSERT INTO public."LearningSession" ("id","userId","title","state","lifecycleState","stage","progressPercent","version","createdAt","updatedAt")
VALUES ('11111111-1111-4111-8111-11111111ac01','11111111-1111-4111-8111-11111111ab01','MVP rollback fixture','INPUT','ACTIVE','EXPLAIN',0,0,now(),now());
INSERT INTO public."Message" ("id","learningSessionId","role","content","createdAt")
VALUES ('11111111-1111-4111-8111-11111111ad01','11111111-1111-4111-8111-11111111ac01','USER','"synthetic test input"',now());
DO $verify$
DECLARE n integer;
BEGIN
SELECT count(*) INTO n FROM public."LearningSession" WHERE id='11111111-1111-4111-8111-11111111ac01';
IF n <> 1 THEN RAISE EXCEPTION 'owner cannot read fixture'; END IF;
UPDATE public."LearningSession" SET "progressPercent"=25 WHERE id='11111111-1111-4111-8111-11111111ac01';
GET DIAGNOSTICS n = ROW_COUNT;
IF n <> 1 THEN RAISE EXCEPTION 'owner cannot update fixture'; END IF;
BEGIN
UPDATE public."LearningSession" SET "userId"='11111111-1111-4111-8111-11111111ab02' WHERE id='11111111-1111-4111-8111-11111111ac01';
RAISE EXCEPTION 'cross-owner reassignment allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $verify$;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-11111111ab02","role":"authenticated"}',true);
DO $verify$
DECLARE n integer;
BEGIN
SELECT count(*) INTO n FROM public."LearningSession" WHERE id='11111111-1111-4111-8111-11111111ac01';
IF n <> 0 THEN RAISE EXCEPTION 'cross-user session read allowed'; END IF;
SELECT count(*) INTO n FROM public."Message" WHERE id='11111111-1111-4111-8111-11111111ad01';
IF n <> 0 THEN RAISE EXCEPTION 'cross-user message read allowed'; END IF;
UPDATE public."LearningSession" SET title='unauthorized' WHERE id='11111111-1111-4111-8111-11111111ac01';
GET DIAGNOSTICS n = ROW_COUNT;
IF n <> 0 THEN RAISE EXCEPTION 'cross-user session update allowed'; END IF;
BEGIN
INSERT INTO public."Message" ("id","learningSessionId","role","content","createdAt")
VALUES ('11111111-1111-4111-8111-11111111ad02','11111111-1111-4111-8111-11111111ac01','USER','"unauthorized"',now());
RAISE EXCEPTION 'cross-user message insert allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END;
BEGIN
INSERT INTO public."LearningSession" ("id","userId","title","state","lifecycleState","stage","progressPercent","version","createdAt","updatedAt")
VALUES ('11111111-1111-4111-8111-11111111ac02','11111111-1111-4111-8111-11111111ab01','unauthorized','INPUT','ACTIVE','EXPLAIN',0,0,now(),now());
RAISE EXCEPTION 'cross-user session insert allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $verify$;
RESET ROLE;
ROLLBACK;
SELECT 'owner read/write, cross-user read/update/insert and reassignment checks passed; rolled back' AS verification,
(SELECT count(*) FROM public."User" WHERE id IN ('11111111-1111-4111-8111-11111111ab01','11111111-1111-4111-8111-11111111ab02')) AS remaining_fixture_users;
