import test from 'node:test';
import assert from 'node:assert/strict';
import { requireSecurityFixture } from '../scripts/verify-phase-a-security.mjs';

const safe = {
  DATABASE_URL: 'postgresql://postgres:fixture-secret@127.0.0.1:55434/learnly_activation_executor_phase_a_security_20261017',
  PHASE_A_SECURITY_CONFIRM: 'ALTER_ISOLATED_PHASE_A_SECURITY_FIXTURE',
  LEARNLY_SUPABASE_CATALOG_PROFILE: 'gotrue-pop6-v6.1.1',
};

test('security mutation runner accepts only its explicitly confirmed isolated clone', () => {
  assert.equal(requireSecurityFixture(safe).pathname, '/learnly_activation_executor_phase_a_security_20261017');
  for (const DATABASE_URL of [
    safe.DATABASE_URL.replace('127.0.0.1', 'hosted.example'),
    safe.DATABASE_URL.replace('55434', '5432'),
    safe.DATABASE_URL.replace('learnly_activation_executor_phase_a_security_20261017', 'postgres'),
    `${safe.DATABASE_URL}?host=hosted.example`,
    safe.DATABASE_URL.replace('postgres:fixture-secret', 'authenticated:fixture-secret'),
  ]) assert.throws(() => requireSecurityFixture({ ...safe, DATABASE_URL }), /^Error: SECURITY_FIXTURE_TARGET_REFUSED$/u);
  assert.throws(() => requireSecurityFixture({ ...safe, PHASE_A_SECURITY_CONFIRM: '' }), /SECURITY_FIXTURE_TARGET_REFUSED/u);
  assert.throws(() => requireSecurityFixture({ ...safe, LEARNLY_SUPABASE_CATALOG_PROFILE: '' }), /SECURITY_FIXTURE_TARGET_REFUSED/u);
  assert.throws(() => requireSecurityFixture({ ...safe, LEARNLY_SUPABASE_CATALOG_PROFILE: 'unreviewed-profile' }), /SECURITY_FIXTURE_TARGET_REFUSED/u);
  assert.throws(() => requireSecurityFixture({}), /SECURITY_FIXTURE_URL_REQUIRED/u);
});
