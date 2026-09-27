import {test, expect} from '@playwright/test';
import {constraintAxis, resizeSnapshot, resizeFrameTree} from '../src/constraints.js';

const frame=(id='frame',extra={})=>({id,name:'Responsive card',x:100,y:100,width:400,height:300,fill:'#ffffff',...extra});
const rect=(id='button',extra={})=>({id,name:id,type:'rect',x:380,y:320,w:100,h:50,rotation:0,opacity:1,fill:'#2353e8',stroke:'none',strokeWidth:0,visible:true,locked:false,frameId:'frame',...extra});

test('all axis modes preserve their geometric invariant at growth and shrink',()=>{
  for(const newSize of [200,800]) {
    const delta=newSize-400;
    expect(constraintAxis(150,80,100,400,60,newSize,'start')).toEqual([110,80]);
    expect(constraintAxis(150,80,100,400,60,newSize,'end')).toEqual([110+delta,80]);
    expect(constraintAxis(150,80,100,400,60,newSize,'center')).toEqual([110+delta/2,80]);
    expect(constraintAxis(150,80,100,400,60,newSize,'stretch')).toEqual([110,Math.max(1,80+delta)]);
    expect(constraintAxis(150,80,100,400,60,newSize,'scale')).toEqual([60+50*newSize/400,80*newSize/400]);
  }
});

test('nested frames, hidden and locked descendants transform once; previews restore from baseline',()=>{
  const root=frame(), nested=frame('nested',{parentId:'frame',x:300,y:200,width:180,height:180,constraints:{horizontal:'end',vertical:'stretch'}});
  const child=rect('child',{frameId:'nested',x:400,y:310,w:60,h:50,visible:false,locked:true,constraints:{horizontal:'end',vertical:'end'}});
  const frames=[root,nested],objects=[child],snapshot=resizeSnapshot(frames,objects);
  resizeFrameTree(root,{x:50,y:70,width:600,height:500},frames,objects,snapshot);
  expect([nested.x,nested.y,nested.width,nested.height]).toEqual([450,170,180,380]);
  expect([child.x,child.y,child.w,child.h]).toEqual([550,480,60,50]);
  resizeFrameTree(root,{x:100,y:100,width:100,height:1},frames,objects,snapshot);
  resizeFrameTree(root,{x:100,y:100,width:400,height:300},frames,objects,snapshot);
  expect(frames).toEqual(snapshot.frames);expect(objects).toEqual(snapshot.objects);
  resizeFrameTree(root,{x:50,y:70,width:600,height:500},frames,objects,snapshot,true);
  expect(nested).toEqual(snapshot.frames[1]);expect(child).toEqual(snapshot.objects[0]);
});

async function load(page,frames=[frame()],objects=[rect()]) {
  page._constraintErrors=[];
  page.on('pageerror',error=>page._constraintErrors.push(error.message));
  const doc={version:1,title:'Responsive fixture',artboard:frames[0],artboards:frames,objects,swatches:['#2353e8'],canvasColor:'#090909',activePageId:'page',pages:[{id:'page',name:'Page 1',artboard:frames[0],artboards:frames,objects}]};
  await page.goto('/');
  await page.evaluate(doc=>localStorage.setItem('illigma.document.v1',JSON.stringify(doc)),doc);
  await page.reload();
  await expect(page.locator('[data-frame-id="frame"]')).toBeVisible();
}
test.afterEach(async({page})=>expect(page._constraintErrors || []).toEqual([]));
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('illigma.document.v1')));
async function dimension(page,label,value){const input=page.getByRole('spinbutton',{name:label,exact:true});await input.fill(String(value));await input.press('Tab');}
async function selectFrame(page){await page.locator('[data-frame-id="frame"]').click();}
async function undo(page,key='ControlOrMeta+z'){await page.locator('#canvas').focus();await page.keyboard.press(key);}

test('pin controls, numeric resize, undo/redo, reload, duplicate and clean SVG',async({page})=>{
  await load(page);
  await page.locator('[data-layer="button"]').click();
  await expect(page.getByLabel('Horizontal constraints',{exact:true})).toHaveValue('start');
  await page.getByRole('button',{name:'Pin right',exact:true}).click();
  await page.getByRole('button',{name:'Pin bottom',exact:true}).click();
  await expect(page.getByLabel('Horizontal constraints',{exact:true})).toHaveValue('end');
  await expect(page.locator('[data-constraint-guide]')).toHaveCount(2);
  await selectFrame(page);await dimension(page,'Width',600);await dimension(page,'Height',400);
  let doc=await saved(page);expect([doc.objects[0].x,doc.objects[0].y,doc.objects[0].w]).toEqual([580,420,100]);
  await undo(page);doc=await saved(page);expect(doc.objects[0].y).toBe(320);
  await undo(page,'ControlOrMeta+Shift+z');doc=await saved(page);expect(doc.objects[0].y).toBe(420);
  await page.reload();await page.locator('[data-layer="button"]').click();
  await expect(page.getByLabel('Vertical constraints',{exact:true})).toHaveValue('end');
  await page.locator('#duplicate').click();
  doc=await saved(page);expect(doc.objects[1].constraints).toEqual({horizontal:'end',vertical:'end'});
  const svg=await page.evaluate(async()=>{const {exportSvg}=await import('/src/main.js');return exportSvg();});
  expect(svg).not.toContain('data-constraint-guide');expect(svg).not.toContain('constraint-diagram');
  expect(svg).toContain('580');
});

test('mixed selection changes only chosen axis and Shift pins both edges',async({page})=>{
  await load(page,[frame()],[rect('first'),rect('second',{x:120,y:130,constraints:{horizontal:'end',vertical:'center'}})]);
  await page.locator('[data-layer="first"]').click();
  await page.locator('[data-layer="second"]').click({modifiers:['Shift']});
  await expect(page.getByLabel('Horizontal constraints',{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:'Pin left',exact:true}).click();
  await page.getByRole('button',{name:'Pin right',exact:true}).click({modifiers:['Shift']});
  await expect(page.getByLabel('Horizontal constraints',{exact:true})).toHaveValue('stretch');
  const doc=await saved(page);
  expect(doc.objects.map(o=>o.constraints.horizontal)).toEqual(['stretch','stretch']);
  expect(doc.objects[1].constraints.vertical).toBe('center');
  await page.screenshot({path:'/tmp/illigma-constraints.png'});
});

test('pointer preview supports bypass, temporary capture loss, reversal and one undo',async({page})=>{
  await load(page,[frame()],[rect('button',{constraints:{horizontal:'end',vertical:'end'}})]);
  await selectFrame(page);
  const handle=await page.locator('[data-frame-handle="se"]').boundingBox();
  const scale=await page.locator('#viewport').evaluate(node=>node.transform.baseVal.consolidate().matrix.a);
  const x=handle.x+handle.width/2,y=handle.y+handle.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+80*scale,y+30*scale,{steps:5});
  const geometry=()=>page.locator('#objects [data-object="button"] > g').getAttribute('transform');
  expect(await geometry()).toContain('460');
  await page.keyboard.down('Control');await page.mouse.move(x+100*scale,y+40*scale);
  expect(await geometry()).toContain('380');
  await page.keyboard.up('Control');
  await page.locator('#canvas').dispatchEvent('lostpointercapture',{pointerId:1});
  await page.mouse.move(x+80*scale,y+30*scale);expect(await geometry()).toContain('460');
  await page.mouse.up();
  expect((await saved(page)).objects[0].x).toBeCloseTo(460,0);
  await undo(page);expect((await saved(page)).objects[0].x).toBe(380);
});

test('nested freeform card inside auto layout resizes its constrained content',async({page})=>{
  const outer=frame('frame',{autoLayout:{enabled:true,direction:'horizontal',widthSizing:'fixed',heightSizing:'fixed',paddingX:10,paddingY:10,gap:10}});
  const card=frame('card',{parentId:'frame',x:110,y:110,width:380,height:280,widthSizing:'fill',heightSizing:'fill'});
  await load(page,[outer,card],[rect('button',{frameId:'card',x:370,y:320,constraints:{horizontal:'end',vertical:'end'}})]);
  await page.locator('[data-frame-id="card"]').click();await expect(page.locator('#inspector-constraints')).toBeHidden();
  await selectFrame(page);await dimension(page,'Width',600);
  const doc=await saved(page);expect(doc.artboards.find(f=>f.id==='card').width).toBe(580);expect(doc.objects[0].x).toBe(570);
});

test('resizing multiple root frames applies each child constraint once',async({page})=>{
  await load(page,[frame(),frame('second-frame',{x:600})],[
    rect('first',{constraints:{horizontal:'end',vertical:'end'}}),
    rect('second',{frameId:'second-frame',x:880,constraints:{horizontal:'end',vertical:'end'}}),
  ]);
  // Initial fit targets the active frame; bring both frames into the viewport.
  for(let step=0;step<4;step++)await page.locator('#zoom-out').click();
  await page.locator('#canvas').focus();await page.keyboard.press('ControlOrMeta+a');
  await expect(page.locator('[data-frame-id].selected')).toHaveCount(2);
  const handle=await page.locator('[data-handle="se"]').boundingBox();
  const scale=await page.locator('#viewport').evaluate(node=>node.transform.baseVal.consolidate().matrix.a);
  const x=handle.x+handle.width/2,y=handle.y+handle.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x-90*scale,y-30*scale,{steps:8});await page.mouse.up();
  const doc=await saved(page);
  expect(doc.artboards[0].width).toBeCloseTo(360,0);
  expect(doc.artboards[1].x).toBeCloseTo(550,0);
  expect(doc.objects[0].x).toBeCloseTo(340,0);
  expect(doc.objects[1].x).toBeCloseTo(790,0);
  expect(doc.objects.map(o=>[o.w,o.h])).toEqual([[100,50],[100,50]]);
  await undo(page);expect((await saved(page)).objects.map(o=>o.x)).toEqual([380,880]);
});

test('stretched text wraps without distorting glyphs; constraint schema rejects malformed values',async({page})=>{
  await load(page,[frame()],[rect('text',{type:'text',x:120,y:120,w:360,h:100,baseW:360,baseH:100,text:'A responsive card with enough words to wrap into several lines',fontSize:20,fontFamily:'Inter',fontWeight:400,constraints:{horizontal:'stretch'}})]);
  await selectFrame(page);await dimension(page,'Width',220);
  await expect(page.locator('#objects text')).toHaveAttribute('transform','scale(1 1)');
  expect(await page.locator('#objects tspan').count()).toBeGreaterThan(2);
  await page.locator('#objects [data-text-hit="text"]').dblclick();
  const editor=page.getByRole('textbox',{name:'Edit canvas text'});
  await editor.fill('Edited responsive text keeps its fixed box and continues wrapping correctly');
  await editor.press('ControlOrMeta+Enter');
  let text=(await saved(page)).objects[0];expect([text.w,text.h]).toEqual([180,100]);
  await page.getByLabel('Horizontal constraints',{exact:true}).selectOption('scale');
  await page.getByLabel('Vertical constraints',{exact:true}).selectOption('scale');
  await selectFrame(page);await dimension(page,'Width',440);await dimension(page,'Height',600);
  await expect(page.locator('#objects text')).toHaveAttribute('transform','scale(2 2)');
  const result=await page.evaluate(async()=>{
    const {validDocument}=await import('/src/store.js');
    const good=JSON.parse(localStorage.getItem('illigma.document.v1'));
    const valid=validDocument(good);
    good.pages[0].objects[0].constraints.horizontal='bogus';
    return [valid,validDocument(good)];
  });
  expect(result).toEqual([true,false]);
});
