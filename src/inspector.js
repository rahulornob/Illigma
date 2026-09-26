// Build the contextual inspector once. Existing controls retain their listeners.
export function setupInspector(api) {
  const $=id=>document.getElementById(id);
  const root=document.querySelector('.properties-panel');
  if (root.inspectorController) return root.inspectorController;
  root.classList.add('contextual-properties');
  const section=(id,title)=>{
    const node=document.createElement('section');node.id=id;node.className='inspector-section';
    node.innerHTML=`<div class="inspector-section-heading"><h2>${title}</h2></div><div class="inspector-section-body"></div>`;
    root.append(node);return node;
  };
  const body=node=>node.querySelector('.inspector-section-body');
  const oldGrid=root.querySelector(':scope > .field-grid');
  const fields={};for(const key of ['x','y','w','h','rotation','opacity'])fields[key]=$(`prop-${key}`).closest('label');
  const alignment=root.querySelector('.align-row');
  const fillLabel=$('fill-title').closest('.property-label'), fillRow=$('fill-preview').closest('.paint-row');
  const strokeRow=$('stroke-preview').closest('.paint-row'),strokeLabel=strokeRow.previousElementSibling;
  const header=root.querySelector(':scope > .panel-heading');header.className='inspector-selection-heading';
  header.querySelector('h2').remove();
  header.append($('selection-summary'));
  const position=section('inspector-position','Position');
  body(position).append(alignment);
  const positionGrid=document.createElement('div');positionGrid.className='field-grid';
  positionGrid.append(fields.x,fields.y,fields.rotation);body(position).append(positionGrid);
  body(position).append($('layout-ignore-row'));
  const layout=section('inspector-layout','Layout');
  const dimensions=document.createElement('div');dimensions.className='field-grid';dimensions.append(fields.w,fields.h);body(layout).append(dimensions);
  body(layout).append($('child-layout-sizing'));
  const al=$('autolayout-panel');al.classList.remove('panel');
  layout.querySelector('.inspector-section-heading').append($('add-autolayout'),$('remove-autolayout'));
  al.querySelector('.panel-heading').hidden=true;
  body(layout).append(al,$('frame-properties'),$('selection-spacing'));
  const limits=$('layout-item-options');
  const details=document.createElement('details');details.className='size-limits';details.innerHTML='<summary>Size limits</summary>';
  const limitGrid=limits.querySelector('.al-axis-sizing');details.append(limitGrid);limits.prepend(details);body(layout).append(limits);
  const appearance=section('inspector-appearance','Appearance');
  const appearanceGrid=document.createElement('div');appearanceGrid.className='field-grid';appearanceGrid.append(fields.opacity);
  appearanceGrid.insertAdjacentHTML('beforeend','<label class="field" title="Corner radius"><span>⌜</span><input id="prop-radius" type="number" min="0" aria-label="Corner radius"><span class="unit">px</span></label>');body(appearance).append(appearanceGrid);
  const typography=section('inspector-typography','Typography');body(typography).append($('text-properties'));
  $('text-properties').insertAdjacentHTML('beforeend','<div class="field-grid typography-extra"><label class="field" title="Line height"><span>↕</span><input id="prop-line-height" type="number" min="0.1" step="0.1" aria-label="Line height"><span class="unit">×</span></label><label class="field" title="Letter spacing"><span>↔</span><input id="prop-letter-spacing" type="number" step="0.1" aria-label="Letter spacing"><span class="unit">px</span></label></div>');
  const fill=section('inspector-fill','Fill');fill.querySelector('.inspector-section-heading').replaceWith(fillLabel);body(fill).append(fillRow);
  const stroke=section('inspector-stroke','Stroke');stroke.querySelector('.inspector-section-heading').replaceWith(strokeLabel);body(stroke).append(strokeRow);
  const effects=section('inspector-effects','Effects');effects.querySelector('.inspector-section-heading').remove();body(effects).append($('effects-section'));
  oldGrid.remove();
  const pathfinder=document.querySelector('[data-boolean]').closest('section');pathfinder.id='inspector-pathfinder';
  document.querySelector('.inspector-caption').remove();
  document.querySelector('.inspector-tabs > svg, .inspector-tabs > i')?.remove();
  const status=document.createElement('span');status.id='inspector-context-label';document.querySelector('.inspector-tabs').append(status);
  // Keep the existing gap/alignment controls together; advanced grid controls stay contextual.
  const controls=$('autolayout-controls'), advanced=controls.querySelector('.layout-advanced');
  const axis=controls.querySelector(':scope > .al-axis-sizing');
  controls.insertBefore(axis,advanced);
  controls.insertBefore(controls.querySelector('.al-direction-row'),axis);
  const flow=advanced.querySelector('.al-axis-sizing');flow.classList.add('flow-settings');
  $('al-cross-gap').closest('label').id='al-cross-gap-row';
  const grid=$('al-grid-options');grid.classList.add('grid-settings');
  const input=(id,value,mixed=false)=>{const node=$(id);if(document.activeElement!==node)node.value=mixed?'':value??'';node.placeholder=mixed?'Mixed':'';};
  for(const [id,key] of [['prop-radius','radius'],['prop-line-height','lineHeight'],['prop-letter-spacing','letterSpacing']]) {
    $(id).addEventListener('change',event=>{
      if(!event.target.value.trim()) {api.refresh();return;}
      const value=Number(event.target.value);if(Number.isFinite(value))api.change(key,value);
    });
  }
  // One resizable panel, one matching canvas boundary; never resize artwork.
  const aside=document.querySelector('.inspector');
  const resizer=document.createElement('div');resizer.className='inspector-resizer';resizer.tabIndex=0;resizer.setAttribute('role','separator');resizer.setAttribute('aria-label','Resize properties panel');resizer.setAttribute('aria-orientation','vertical');resizer.setAttribute('aria-valuemin','240');resizer.setAttribute('aria-valuemax','420');aside.prepend(resizer);
  const setWidth=value=>{const width=Math.round(Math.min(420,Math.max(240,value)));document.documentElement.style.setProperty('--inspector-width',`${width}px`);resizer.setAttribute('aria-valuenow',String(width));api.resize();return width;};
  const stored=Number(localStorage.getItem('illigma.inspector-width'));if(stored>=240&&stored<=420)setWidth(stored);
  else resizer.setAttribute('aria-valuenow','268');
  let resize=null;
  resizer.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();resize={id:event.pointerId,start:event.clientX,width:aside.getBoundingClientRect().width};resizer.setPointerCapture(event.pointerId);});
  resizer.addEventListener('pointermove',event=>{if(resize?.id===event.pointerId)setWidth(resize.width+resize.start-event.clientX);});
  const finish=event=>{if(resize?.id!==event.pointerId)return;resize=null;localStorage.setItem('illigma.inspector-width',String(aside.getBoundingClientRect().width));};
  resizer.addEventListener('pointerup',finish);resizer.addEventListener('pointercancel',finish);
  resizer.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;event.preventDefault();event.stopPropagation();const width=setWidth(event.key==='Home'?268:aside.getBoundingClientRect().width+(event.key==='ArrowLeft'?1:-1)*(event.shiftKey?32:8));localStorage.setItem('illigma.inspector-width',String(width));});
  let lastSelection='';
  return root.inspectorController = {update(context) {
    const {objects,frames,frame,ids}=context;
    const selected=objects.length+frames.length>0, page=!selected, allText=objects.length>0&&!frames.length&&objects.every(o=>o.type==='text');
    header.hidden=page;position.hidden=page;layout.hidden=page;appearance.hidden=page;typography.hidden=!allText;
    stroke.hidden=page || (!!frames.length&&!objects.length);effects.hidden=page || $('effects-section').hidden;
    pathfinder.hidden=objects.length<2 || objects.some(o=>o.type==='text') || !!frames.length;
    $('inspector-context-label').textContent=page?'Page':$('selection-type').textContent==='Group'?'Group':frame?.autoLayout?.enabled?'Auto layout':frame?'Frame':allText?'Text':ids.length>1?`${ids.length} selected`:'';
    layout.querySelector('h2').textContent=frame?.autoLayout?.enabled?'Auto layout':'Layout';
    $('add-autolayout').hidden=!selected||!!frame?.autoLayout?.enabled;
    $('remove-autolayout').hidden=!frame?.autoLayout?.enabled;
    $('al-cross-gap-row').hidden=!(frame?.autoLayout?.wrap||frame?.autoLayout?.direction==='grid');
    // Layout-controlled children cannot be manually positioned until ignored.
    const controlled=context.controlled;
    if(controlled){$('prop-x').disabled=true;$('prop-y').disabled=true;alignment.querySelectorAll('button').forEach(b=>b.disabled=true);}
    $('layout-ignore-row').hidden=!context.layoutParent;
    const rects=objects.length>0&&!frames.length&&objects.every(o=>o.type==='rect');
    $('prop-radius').disabled=!rects;
    input('prop-radius',rects?objects[0].radius||0:'',rects&&objects.some(o=>(o.radius||0)!==(objects[0].radius||0)));
    if(allText){
      $('text-properties').hidden=false;
      input('prop-line-height',objects[0].lineHeight||1.16,objects.some(o=>(o.lineHeight||1.16)!==(objects[0].lineHeight||1.16)));
      input('prop-letter-spacing',objects[0].letterSpacing||0,objects.some(o=>(o.letterSpacing||0)!==(objects[0].letterSpacing||0)));
      for(const [id,key] of [['font-size','fontSize'],['font-family','fontFamily'],['font-weight','fontWeight']])input(id,objects[0][key],objects.some(o=>o[key]!==objects[0][key]));
    }
    if(objects.length>1&&!frames.length){
      for(const key of ['rotation','opacity'])input(`prop-${key}`,key==='opacity'?Math.round(objects[0][key]*100):objects[0][key],objects.some(o=>o[key]!==objects[0][key]));
      for(const kind of ['fill','stroke'])if(objects.some(o=>o[kind]!==objects[0][kind])){input(`${kind}-hex`,'',true);$(`${kind}-preview`).classList.add('mixed-paint');}else $(`${kind}-preview`).classList.remove('mixed-paint');
    }else for(const kind of ['fill','stroke'])$(`${kind}-preview`).classList.remove('mixed-paint');
    const paints=[...objects,...frames];
    if(paints.length>1 && paints.some(item=>item.fill!==paints[0].fill)){input('fill-hex','',true);$('fill-preview').classList.add('mixed-paint');}
    const signature=ids.join('|');if(signature!==lastSelection){lastSelection=signature;document.querySelector('.inspector-scroll').scrollTop=0;api.selectionChanged();}
  }};
}
