import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const {assessmentHistory,historyTab,inHistoryDateRange}=require('../.web-test-build/lib/history.js');
const {AssessmentHistory}=require('../.web-test-build/app/components/assessment-history.js');
const row={sessionId:'session/slash',topic:'ohms-law',prePercent:67,postPercent:0,deltaPercent:-67};
test('history uses real comparison values, preserves zero/missing scores and never invents absent session details',()=>{
  const items=assessmentHistory([{id:row.sessionId,title:'Owned session',updatedAt:'2026-10-10T10:00:00Z'}],[row,
    {...row,sessionId:'older-session',prePercent:0,postPercent:null,deltaPercent:null},
    {...row,sessionId:'unassessed',prePercent:null,postPercent:null,deltaPercent:null}]);
  assert.equal(items.length,2);assert.equal(items[0].postPercent,0);assert.equal(items[0].deltaPercent,-67);
  assert.equal(items[1].title,null);assert.equal(items[1].updatedAt,null);assert.equal(items[1].prePercent,0);
});
test('history defaults to an owned session list and date ranges are inclusive without fabricated dates',()=>{
  for(const value of [null,'unknown','']) assert.equal(historyTab(value),'Chat');
  assert.equal(historyTab('Test Results'),'Test Results');
  assert.equal(inHistoryDateRange('2026-10-10T10:00:00Z','2026-10-10','2026-10-10'),true);
  assert.equal(inHistoryDateRange('2026-10-09T10:00:00Z','2026-10-10',''),false);
  assert.equal(inHistoryDateRange(null,'2026-10-10',''),false);assert.equal(inHistoryDateRange(null,'',''),true);
});
test('actual result cards render paired zero/negative outcomes, accessible bars and safe owned learning links',()=>{
  const html=renderToStaticMarkup(React.createElement(AssessmentHistory,{language:'th',items:[{...row,title:'ผลจริง',updatedAt:'2026-10-10T10:00:00Z'}]}));
  assert.match(html,/หลังเรียน: 0%/);assert.match(html,/aria-valuenow="0"/);assert.match(html,/-67 จุดเปอร์เซ็นต์/);
  assert.match(html,/href="\/Chat\/session%2Fslash"/);assert.match(html,/อัปเดต session:/);assert.doesNotMatch(html,/<img/);
});
test('empty and partially assessed histories explicitly distinguish absent results from zero',()=>{
  const empty=renderToStaticMarkup(React.createElement(AssessmentHistory,{language:'th',items:[]}));assert.match(empty,/ไม่พบผลการทดสอบ/);
  const partial=renderToStaticMarkup(React.createElement(AssessmentHistory,{language:'en',items:[{...row,title:null,updatedAt:null,prePercent:0,postPercent:null,deltaPercent:null}]}));
  assert.match(partial,/Pretest: 0%/);assert.match(partial,/Posttest: No result recorded/);assert.doesNotMatch(partial,/Session updated:|percentage points/);
});
