import { test, expect } from '@playwright/test';
import { computeLayout } from '../src/autolayout.js';
const frame=(al={},more={})=>({x:10,y:20,width:400,height:200,autoLayout:{enabled:true,direction:'horizontal',widthSizing:'fixed',heightSizing:'fixed',paddingX:10,paddingY:10,gap:10,...al},...more});
const item=(id,more={})=>({id,x:0,y:0,w:50,h:30,...more});
test('2026 automatic spacing starts single Between child at start and never overlaps',()=>{
  expect(computeLayout(frame({spacingMode:'between'}),[item('a')]).items[0].x).toBe(20);
  for(const spacingMode of ['between','around','evenly']) {
    const result=computeLayout(frame({spacingMode}),[item('a',{w:250}),item('b',{w:250})]);
    expect(result.items[1].x-result.items[0].x).toBe(250);
  }
  const result=computeLayout(frame({spacingMode:'evenly'}),[item('a'),item('b')]);
  expect(result.items[0].x).toBeCloseTo(20+280/3);
});
test('fill redistributes at min/max and equalizes nested content areas',()=>{
  const result=computeLayout(frame(),[item('a',{widthSizing:'fill',minWidth:250}),item('b',{widthSizing:'fill',maxWidth:150})]);
  expect(result.items.map(i=>Math.round(i.w))).toEqual([250,120]);
  const padded=computeLayout(frame(),[item('a',{widthSizing:'fill',autoLayout:{enabled:true,paddingX:20}}),item('b',{widthSizing:'fill',autoLayout:{enabled:true,paddingX:10}})]);
  expect(padded.items[0].w-padded.items[1].w).toBeCloseTo(20);
});
test('padding floor wins over max size; absolute/hidden layers do not affect hug',()=>{
  const result=computeLayout(frame({widthSizing:'hug',heightSizing:'hug',paddingLeft:30,paddingRight:40},{maxWidth:20}),[item('a',{layoutAbsolute:true,w:900}),item('b',{visible:false})]);
  expect(result.width).toBe(70);
  expect(result.height).toBe(20);
  expect(result.items).toHaveLength(0);
});
test('horizontal and vertical wrap use independent cross gaps and hug cross size',()=>{
  const horizontal=computeLayout(frame({wrap:true,heightSizing:'hug',crossGap:15},{width:140}),[item('a'),item('b'),item('c')]);
  expect(horizontal.items.map(i=>[i.x,i.y])).toEqual([[20,30],[80,30],[20,75]]);
  expect(horizontal.height).toBe(95);
  const vertical=computeLayout(frame({direction:'vertical',wrap:true,widthSizing:'hug',crossGap:15},{height:100}),[item('a'),item('b'),item('c')]);
  expect(vertical.items.map(i=>[i.x,i.y])).toEqual([[20,30],[20,70],[85,30]]);
  expect(vertical.width).toBe(135);
});
test('grid auto placement respects spans, fractional tracks, fill and auto rows',()=>{
  const result=computeLayout(frame({direction:'grid',columns:3,columnTracks:'1fr 2fr 1fr',rowTracks:'hug',heightSizing:'hug',crossGap:12}),[item('a',{columnSpan:2,widthSizing:'fill'}),item('b',{widthSizing:'fill'}),item('c',{columnSpan:3,widthSizing:'fill',h:40})]);
  expect(result.items.map(i=>[i.column,i.row])).toEqual([[0,0],[2,0],[0,1]]);
  expect(result.items[0].w).toBe(280);
  expect(result.items[1].w).toBe(90);
  expect(result.items[2].w).toBe(380);
  expect(result.height).toBe(102);
});
test('explicit negative gaps permit deliberate overlap',()=>{
  const result=computeLayout(frame({gap:-10,widthSizing:'hug'}),[item('a'),item('b')]);
  expect(result.items[1].x-result.items[0].x).toBe(40);
  expect(result.width).toBe(110);
});
test('empty zero-padding frames retain a valid positive size',()=>{
  const result=computeLayout(frame({widthSizing:'hug',heightSizing:'hug',paddingX:0,paddingY:0}),[]);
  expect(result.width).toBe(1);expect(result.height).toBe(1);
});
