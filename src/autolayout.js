// Layout geometry is independent of SVG rendering and pointer state.
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sizeKey = axis => axis === 'width' ? 'w' : 'h';
export function layoutPadding(al) {
  return {left:Math.max(0,num(al.paddingLeft,al.paddingX??16)),right:Math.max(0,num(al.paddingRight,al.paddingX??16)),top:Math.max(0,num(al.paddingTop,al.paddingY??16)),bottom:Math.max(0,num(al.paddingBottom,al.paddingY??16))};
}
function limit(item, axis, value, floor=1) {
  const min=Math.max(1,floor,num(item[`min${axis[0].toUpperCase()+axis.slice(1)}`],floor));
  const max=Math.max(min,num(item[`max${axis[0].toUpperCase()+axis.slice(1)}`],50000));
  return Math.max(min,Math.min(max,value));
}
const mode = (item,axis) => item[`${axis}Sizing`] || 'fixed';
function contentInsets(item, axis) {
  if (!item.autoLayout?.enabled) return 0;
  const p=layoutPadding(item.autoLayout);
  return axis==='width'?p.left+p.right:p.top+p.bottom;
}
function allocateFill(items,axis,available) {
  const key=sizeKey(axis), fillers=items.filter(i=>mode(i,axis)==='fill');
  const remaining=available-items.filter(i=>mode(i,axis)!=='fill').reduce((sum,i)=>sum+i[key],0);
  // Equal content areas, with each nested frame's own padding included in its outer box.
  const outer=(item,content)=>limit(item,axis,content+contentInsets(item,axis),Math.max(1,contentInsets(item,axis)));
  let lo=0,hi=Math.max(0,remaining);
  for(let step=0;step<60;step++) {
    const mid=(lo+hi)/2;
    if(fillers.reduce((sum,i)=>sum+outer(i,mid),0)>remaining)hi=mid;else lo=mid;
  }
  fillers.forEach(i=>i[key]=outer(i,lo));
}
function alignment(al) {
  const align=al.align || 'top-left';
  return {x:align.includes('left')?0:align.includes('right')?1:.5,y:align.includes('top')?0:align.includes('bottom')?1:.5};
}
function distribution(kind,free,count,fixedGap,align) {
  const room=Math.max(0,free);
  if(kind==='between') return {start:0,gap:count>1?room/(count-1):0};
  if(kind==='around') return {start:count?room/count/2:0,gap:count?room/count:0};
  if(kind==='evenly') return {start:room/(count+1),gap:room/(count+1)};
  return {start:free*align,gap:fixedGap};
}
export function computeLayout(frame, input) {
  const al=frame.autoLayout || {}, padding=layoutPadding(al), align=alignment(al);
  const items=input.filter(i=>i.visible!==false&&!i.layoutAbsolute).map(i=>({...i,w:limit(i,'width',i.w),h:limit(i,'height',i.h)}));
  const hugW=(al.widthSizing||al.sizing||'hug')==='hug', hugH=(al.heightSizing||al.sizing||'hug')==='hug';
  let width=limit(frame,'width',frame.width,padding.left+padding.right),height=limit(frame,'height',frame.height,padding.top+padding.bottom);
  const gap=num(al.gap,16), crossGap=Math.max(0,num(al.crossGap,Math.max(0,gap))), spacing=al.spacingMode||'packed';
  if(al.direction==='grid') return gridLayout(frame,items,{padding,align,hugW,hugH,width,height,gap:Math.max(0,gap),crossGap});
  const horizontal=al.direction!=='vertical', main=horizontal?'w':'h',cross=horizontal?'h':'w';
  const mainAxis=horizontal?'width':'height',crossAxis=horizontal?'height':'width';
  const startPad=horizontal?padding.left:padding.top,endPad=horizontal?padding.right:padding.bottom;
  const crossStart=horizontal?padding.top:padding.left,crossEnd=horizontal?padding.bottom:padding.right;
  const hugMain=horizontal?hugW:hugH,hugCross=horizontal?hugH:hugW;
  let mainSize=horizontal?width:height,crossSize=horizontal?height:width;
  const wrap=!!al.wrap&&!hugMain, fixedGap=spacing==='packed'?gap:0;
  const lines=[[]];let used=0;
  for(const item of items) {
    const line=lines.at(-1), proposed=used+(line.length?fixedGap:0)+item[main];
    if(wrap&&line.length&&proposed>mainSize-startPad-endPad+1e-6){lines.push([item]);used=item[main];}
    else {line.push(item);used=proposed;}
  }
  if(hugMain) mainSize=limit(frame,mainAxis,Math.max(0,...lines.map(line=>line.reduce((s,i)=>s+i[main],0)+Math.max(0,line.length-1)*fixedGap))+startPad+endPad,startPad+endPad);
  for(const line of lines) {
    if(!hugMain) allocateFill(line,mainAxis,mainSize-startPad-endPad-Math.max(0,line.length-1)*fixedGap);
  }
  const lineSizes=lines.map(line=>Math.max(0,...line.map(i=>i[cross])));
  if(hugCross) crossSize=limit(frame,crossAxis,lineSizes.reduce((a,b)=>a+b,0)+Math.max(0,lines.length-1)*crossGap+crossStart+crossEnd,crossStart+crossEnd);
  if(!wrap) lineSizes[0]=Math.max(0,crossSize-crossStart-crossEnd);
  const totalCross=lineSizes.reduce((a,b)=>a+b,0)+Math.max(0,lines.length-1)*crossGap;
  let lineCursor=crossStart+(crossSize-crossStart-crossEnd-totalCross)*(horizontal?align.y:align.x);
  const output=[];
  lines.forEach((line,lineIndex)=>{
    const extent=lineSizes[lineIndex];
    const free=mainSize-startPad-endPad-line.reduce((sum,i)=>sum+i[main],0)-(spacing==='packed'?Math.max(0,line.length-1)*gap:0);
    const dist=distribution(spacing,free,line.length,gap,horizontal?align.x:align.y);
    let cursor=startPad+dist.start;
    line.forEach(item=>{
      if(mode(item,crossAxis)==='fill')item[cross]=limit(item,crossAxis,extent);
      const across=lineCursor+(extent-item[cross])*(horizontal?align.y:align.x);
      output.push({...item,x:frame.x+(horizontal?cursor:across),y:frame.y+(horizontal?across:cursor)});
      cursor+=item[main]+dist.gap;
    });
    lineCursor+=extent+crossGap;
  });
  if(horizontal){width=mainSize;height=crossSize;}else{width=crossSize;height=mainSize;}
  return {width,height,items:output};
}
function tracks(spec,count) {
  const values=typeof spec==='string'?spec.trim().split(/\s+/):[];
  return Array.from({length:count},(_,i)=>{
    const value=values[i]||values.at(-1)||'1fr';
    if(value==='hug'||value==='auto')return {kind:'hug',value:1};
    if(/^\d+(\.\d+)?fr$/.test(value))return {kind:'fill',value:Math.max(.01,parseFloat(value))};
    if(/^\d+(\.\d+)?(px)?$/.test(value))return {kind:'fixed',value:Math.max(1,parseFloat(value))};
    return {kind:'fill',value:1};
  });
}
function resolveTracks(defs,items,axis,available,gap,hug) {
  const coordinate=axis==='width'?'column':'row',spanKey=axis==='width'?'columnSpan':'rowSpan',key=sizeKey(axis);
  const sizes=defs.map(t=>t.kind==='fixed'?t.value:0);
  items.forEach(item=>{
    const start=item[coordinate],span=item[spanKey];
    const total=sizes.slice(start,start+span).reduce((a,b)=>a+b,0)+gap*(span-1);
    const flexible=Array.from({length:span},(_,i)=>start+i).filter(i=>defs[i].kind!=='fixed');
    if(item[key]>total&&flexible.length)flexible.forEach(i=>sizes[i]+=(item[key]-total)/flexible.length);
  });
  if(!hug) {
    const free=Math.max(0,available-gap*Math.max(0,defs.length-1)-defs.reduce((sum,t,i)=>sum+(t.kind==='fill'?0:sizes[i]),0));
    const weight=defs.reduce((sum,t)=>sum+(t.kind==='fill'?t.value:0),0);
    defs.forEach((t,i)=>{if(t.kind==='fill')sizes[i]=free*t.value/weight;});
  }
  return sizes.map(n=>Math.max(1,n));
}
function gridLayout(frame,items,{padding,align,hugW,hugH,width,height,gap,crossGap}) {
  const al=frame.autoLayout, columns=Math.max(1,Math.min(24,Math.round(num(al.columns,2))));
  const occupied=new Set(),placed=[];
  for(const item of items) {
    const columnSpan=Math.max(1,Math.min(columns,Math.round(num(item.columnSpan,1)))),rowSpan=Math.max(1,Math.min(100,Math.round(num(item.rowSpan,1))));
    let cell=0;
    const fits=(row,col)=>col+columnSpan<=columns&&Array.from({length:rowSpan},(_,y)=>Array.from({length:columnSpan},(_,x)=>!occupied.has(`${row+y}:${col+x}`))).flat().every(Boolean);
    while(!fits(Math.floor(cell/columns),cell%columns))cell++;
    const row=Math.floor(cell/columns),column=cell%columns;
    for(let y=0;y<rowSpan;y++)for(let x=0;x<columnSpan;x++)occupied.add(`${row+y}:${column+x}`);
    placed.push({...item,row,column,columnSpan,rowSpan});
  }
  const rows=Math.max(1,...placed.map(i=>i.row+i.rowSpan));
  const widths=resolveTracks(tracks(al.columnTracks,columns),placed,'width',width-padding.left-padding.right,gap,hugW);
  const heights=resolveTracks(tracks(al.rowTracks || "hug",rows),placed,'height',height-padding.top-padding.bottom,crossGap,hugH);
  if(hugW)width=limit(frame,'width',widths.reduce((a,b)=>a+b,0)+gap*(columns-1)+padding.left+padding.right,padding.left+padding.right);
  if(hugH)height=limit(frame,'height',heights.reduce((a,b)=>a+b,0)+crossGap*(rows-1)+padding.top+padding.bottom,padding.top+padding.bottom);
  return {width,height,items:placed.map(item=>{
    const cellW=widths.slice(item.column,item.column+item.columnSpan).reduce((a,b)=>a+b,0)+gap*(item.columnSpan-1);
    const cellH=heights.slice(item.row,item.row+item.rowSpan).reduce((a,b)=>a+b,0)+crossGap*(item.rowSpan-1);
    const w=mode(item,'width')==='fill'?limit(item,'width',cellW):item.w,h=mode(item,'height')==='fill'?limit(item,'height',cellH):item.h;
    return {...item,w,h,x:frame.x+padding.left+widths.slice(0,item.column).reduce((a,b)=>a+b,0)+gap*item.column+(cellW-w)*align.x,y:frame.y+padding.top+heights.slice(0,item.row).reduce((a,b)=>a+b,0)+crossGap*item.row+(cellH-h)*align.y};
  })};
}
