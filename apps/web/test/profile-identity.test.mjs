import assert from 'node:assert/strict';
import {afterEach,test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const supabase=require('../.web-test-build/lib/supabase.js');
const profile=require('../.web-test-build/lib/user-profile.js');
const original=supabase.getSupabaseClient;
afterEach(()=>{supabase.getSupabaseClient=original;});

function fixture(existing=true){
  const auth={id:'auth-user-fixture',email:'fixture@example.invalid',user_metadata:{full_name:'OAuth display name'}};
  let row=existing?{id:'legacy-app-primary-key',authUserId:auth.id,email:auth.email,displayName:'Saved custom name',avatarUrl:'https://example.invalid/custom.png'}:null;
  const filters=[];let inserts=0;
  supabase.getSupabaseClient=()=>({auth:{getUser:async()=>({data:{user:auth},error:null}),updateUser:async()=>({error:null})},
    from:table=>{
      assert.equal(table,'User');let filter,updates,insert;
      const query={select:()=>query,eq:(key,value)=>{filter={key,value};filters.push(filter);return query;},
        update:value=>{updates=value;return query;},insert:value=>{insert=value;return query;},
        maybeSingle:async()=>({data:row&&row[filter.key]===filter.value?{...row}:null,error:null}),
        single:async()=>{
          if(insert){assert.equal(row,null,'A legacy profile must not trigger duplicate insertion');row={...insert};inserts++;}
          else {assert.ok(row&&row[filter.key]===filter.value,'Update must select the verified owned profile');row={...row,...updates};}
          return {data:{...row},error:null};
        }};
      return query;
    }});
  return {auth,filters,row:()=>row,inserts:()=>inserts};
}
test('profile sync/read/edit use verified auth identity while preserving a legacy app primary key and avatar',async()=>{
  const f=fixture();
  const synced=await profile.syncCurrentUserProfile();
  assert.equal(synced.id,'legacy-app-primary-key');assert.equal(synced.displayName,'Saved custom name');
  assert.equal(synced.avatarUrl,'https://example.invalid/custom.png');assert.equal(f.inserts(),0);
  assert.equal((await profile.getCurrentUserProfile()).id,'legacy-app-primary-key');
  const edited=await profile.updateCurrentUserProfile({displayName:'  Updated name  '});
  assert.equal(edited.displayName,'Updated name');assert.equal(edited.id,'legacy-app-primary-key');
  assert.equal(edited.avatarUrl,'https://example.invalid/custom.png');
  await profile.getCurrentUserThemePreferences();
  assert.ok(f.filters.length>=5);assert.ok(f.filters.every(filter=>filter.key==='authUserId'&&filter.value===f.auth.id));
});
test('new account profile creation retains the existing canonical auth-id primary key convention',async()=>{
  const f=fixture(false);const created=await profile.syncCurrentUserProfile();
  assert.equal(created.id,f.auth.id);assert.equal(f.row().authUserId,f.auth.id);assert.equal(f.inserts(),1);
});
test('unauthenticated profile reads return null and writes never call the data API',async()=>{
  let calls=0;
  supabase.getSupabaseClient=()=>({auth:{getUser:async()=>({data:{user:null},error:null})},from:()=>{calls++;throw new Error('Unexpected DB call');}});
  assert.equal(await profile.getCurrentUserProfile(),null);
  await assert.rejects(profile.syncCurrentUserProfile(),/authenticated/);await assert.rejects(profile.updateCurrentUserProfile({displayName:'name'}),/authenticated/);
  assert.equal(calls,0);
});
