'use strict';
const PAPER_MM = { A4: [210,297], A5: [148,210], Letter: [215.9,279.4], Legal: [215.9,355.6] };
const clamp = (v,min,max,fallback) => Math.min(max,Math.max(min,Number(v)||fallback));
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function pageRangeIndices(total,ranges) {
  const n=Math.max(0,Number(total)||0);
  if(!Array.isArray(ranges)||ranges.length===0) return Array.from({length:n},(_,i)=>i);
  const valid=ranges.filter(r=>r&&Number.isFinite(Number(r.from))&&Number.isFinite(Number(r.to)))
    .map(r=>[Math.max(0,Math.floor(Number(r.from))),Math.min(n-1,Math.floor(Number(r.to)))])
    .filter(pair=>pair[1]>=pair[0]);
  return Array.from({length:n},(_,i)=>i).filter(i=>valid.some(r=>i>=r[0]&&i<=r[1]));
}
function selectPageRanges(total,settings) {
  const n=Math.max(0,Number(total)||0), mode=settings&&settings.range;
  if(mode==='current') {
    if(!n) return [];
    const index=Math.max(0,Math.min(n-1,Math.floor(Number(settings.currentPage)||0)));
    return [{from:index,to:index}];
  }
  if(mode==='odd'||mode==='even') {
    const wantOdd=mode==='odd', ranges=[];
    for(let i=0;i<n;i++) if(((i+1)%2===1)===wantOdd) ranges.push({from:i,to:i});
    return ranges;
  }
  if(mode!=='custom') return undefined;
  return String(settings.customRange||'').split(',').flatMap(part=>{
    const match=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if(!match) return [];
    const first=Number(match[1]), last=Number(match[2]||match[1]);
    if(!Number.isInteger(first)||!Number.isInteger(last)||first<1||last<first||first>n) return [];
    return [{from:first-1,to:Math.min(n,last)-1}];
  });
}
function gridOrder(count,order) {
  const n=Math.max(1,Math.min(16,Math.floor(Number(count)||1))), cols=Math.ceil(Math.sqrt(n)), rows=Math.ceil(n/cols), positions=[];
  for(let i=0;i<n;i++) {
    if(order==='vertical'||order==='vertical-reversed') {
      const row=i%rows, col=Math.floor(i/rows);
      positions.push({row:order==='vertical-reversed'?rows-1-row:row,col});
    } else {
      const row=Math.floor(i/cols), col=i%cols;
      positions.push({row,col:order==='horizontal-reversed'?cols-1-col:col});
    }
  }
  return {cols,rows,positions};
}
function bookletSheets(images,subset,from,to,binding) {
  const count=Math.ceil(images.length/4);
  if(!count) return [];
  const requestedFrom=Math.floor(Number(from)||1), requestedTo=Math.floor(Number(to)||count);
  if(requestedTo<requestedFrom) return [];
  const first=Math.max(1,Math.min(count,requestedFrom)), last=Math.max(first,Math.min(count,requestedTo));
  const padded=Array.from({length:count*4},(_,i)=>images[i]||null), result=[];
  for(let s=first-1;s<last;s++) {
    const front=[padded[padded.length-1-2*s],padded[2*s]], back=[padded[2*s+1],padded[padded.length-2-2*s]];
    if(binding==='right'){front.reverse();back.reverse();}
    if(subset!=='back') result.push({side:'front',pages:front});
    if(subset!=='front') result.push({side:'back',pages:back});
  }
  return result;
}
function buildPrintHtml(options,images) {
  const size=PAPER_MM[options.paperSize]||PAPER_MM.A4, pw=size[0], ph=size[1];
  const W=options.landscape?ph:pw, H=options.landscape?pw:ph;
  // Captured pages already match the selected physical paper size. Keep the
  // generated sheet full-bleed so actual/custom sizing cannot clip its edges.
  const margin=0;
  const pageW=W, pageH=H;
  const pageName=options.paperSize==='A5'?'A5':options.paperSize==='Letter'?'letter':options.paperSize==='Legal'?'legal':'A4';
  const pageOrientation=options.landscape?'landscape':'portrait';
  const src=Array.isArray(options.sourceSize)?options.sourceSize.map(Number):PAPER_MM.A4;
  const sw=Math.max(1,Number.isFinite(src[0])?src[0]:210), sh=Math.max(1,Number.isFinite(src[1])?src[1]:297);
  const mode=['size','poster','multiple','booklet'].includes(options.mode)?options.mode:'size';
  const rotate=options.autoRotate!==false, gray=Boolean(options.gray);
  const sizing=['fit','actual','custom','shrink'].includes(options.sizing)?options.sizing:'fit';
  const center=options.autoCenter!==false || sizing==='fit', scale=clamp(options.scaleFactor,10,400,100)/100;
  function pageBox(srcImg,label,bw,bh) {
    if(!srcImg) return '<div class="blank"></div>';
    const turn=rotate&&((sw>sh)!==(bw>bh)), fit=sizing==='fit'||sizing==='shrink', k=sizing==='custom'?scale:1;
    const fitMargin=fit&&mode==='size'?(options.paperSize==='A5'?4:5):0;
    const fitW=Math.max(1,bw-2*fitMargin), fitH=Math.max(1,bh-2*fitMargin);
    const iw=fit?(turn?fitH:fitW)+'mm':(sw*k)+'mm';
    const ih=fit?(turn?fitW:fitH)+'mm':(sh*k)+'mm';
    return '<div class="pagebox" style="--bw:'+bw+'mm;--bh:'+bh+'mm"><img class="'+(fit?'fit ':'')+(turn?'rotated ':'')+(center?'centered':'')+'" src="'+esc(srcImg)+'" alt="" style="width:'+iw+';height:'+ih+';'+(gray?'filter:grayscale(1);':'')+'">'+(mode==='size'?'':'<span>'+esc(label)+'</span>')+'</div>';
  }
  let body='';
  if(mode==='multiple') {
    const n=Math.max(1,Math.min(16,Math.floor(Number(options.pagesPerSheet)||1))), spec=gridOrder(n,options.multiplePageOrder);
    for(let start=0;start<images.length;start+=n) {
      let cells='';
      for(let slot=0;slot<n;slot++) {
        const pos=spec.positions[slot], im=images[start+slot];
        cells+='<div class="cell" style="grid-row:'+(pos.row+1)+';grid-column:'+(pos.col+1)+'">'+pageBox(im,im?'Page '+(start+slot+1):'',pageW/spec.cols,pageH/spec.rows)+'</div>';
      }
      body+='<section class="sheet grid" style="--cols:'+spec.cols+';--rows:'+spec.rows+'">'+cells+'</section>';
    }
  } else if(mode==='booklet') {
    const imposed=bookletSheets(images,options.bookletSubset,options.bookletFrom,options.bookletTo,options.bookletBinding);
    imposed.forEach(sheet=>{
      body+='<section class="sheet spread"><div>'+sheet.pages.map((im,i)=>pageBox(im,im?'Page '+(images.indexOf(im)+1):'',pageW/2,pageH)).join('')+'</div><small>'+sheet.side+'</small></section>';
    });
  } else if(mode==='poster') {
    const factor=clamp(options.posterScale,100,400,100)/100, overlap=clamp(options.posterOverlap,0,Math.min(50,Math.min(pageW,pageH)-1),0);
    const stepX=Math.max(1,pageW-overlap),stepY=Math.max(1,pageH-overlap);
    images.forEach((im,page)=>{
      const turn=rotate&&((sw>sh)!==(pageW>pageH)), rawW=sw*factor, rawH=sh*factor, iw=turn?rawH:rawW, ih=turn?rawW:rawH;
      const cols=Math.max(1,Math.ceil(Math.max(0,iw-overlap)/stepX)), rows=Math.max(1,Math.ceil(Math.max(0,ih-overlap)/stepY));
      const offsetX=center?Math.max(0,(cols*pageW-(cols-1)*overlap-iw)/2):0;
      const offsetY=center?Math.max(0,(rows*pageH-(rows-1)*overlap-ih)/2):0;
      for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
        const imgLeft=offsetX-col*stepX+(turn?(rawH-rawW)/2:0), imgTop=offsetY-row*stepY+(turn?(rawW-rawH)/2:0);
        body+='<section class="sheet tile"><div class="clip"><img src="'+esc(im)+'" alt="" style="width:'+rawW+'mm;height:'+rawH+'mm;left:'+imgLeft+'mm;top:'+imgTop+'mm;'+(turn?'transform:rotate(90deg);transform-origin:center;':'')+(gray?'filter:grayscale(1);':'')+'"></div>';
        if(options.posterCutMarks) body+='<i class="marks"></i>';
        if(options.posterLabels) body+='<small class="label">Page '+(page+1)+' · '+(row+1)+','+(col+1)+' / '+rows+','+cols+'</small>';
        body+='</section>';
      }
    });
  } else {
    images.forEach((im,i)=>{body+='<section class="sheet single">'+pageBox(im,'Page '+(i+1),pageW,pageH)+'</section>';});
  }
  const css='@page{size:'+pageName+' '+pageOrientation+';margin:'+margin+'mm}*{box-sizing:border-box}html,body{display:block!important;width:'+pageW+'mm!important;min-width:'+pageW+'mm!important;height:auto!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;overflow:visible!important;background:#fff}.sheet{position:relative;display:block;box-sizing:border-box;width:'+pageW+'mm;min-width:'+pageW+'mm;height:'+pageH+'mm;min-height:'+pageH+'mm;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;overflow:hidden;page-break-after:always;break-after:page;background:#fff}.sheet:last-child{page-break-after:auto;break-after:auto}.pagebox{position:relative;display:block;width:var(--bw);height:var(--bh);max-width:100%;max-height:100%;margin:0;padding:0;overflow:hidden}.pagebox img{display:block;max-width:none;max-height:none;object-fit:contain;flex:none}.pagebox img.centered{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);transform-origin:center center}.pagebox img.centered.rotated{transform:translate(-50%,-50%) rotate(90deg)}.pagebox img.fit{object-fit:contain}.pagebox img.rotated{transform:rotate(90deg) translateY(-100%);transform-origin:top left;max-width:none!important;max-height:none!important}.pagebox span{position:absolute;right:1mm;bottom:1mm;font:6pt Arial;color:#555}.grid{display:grid;grid-template-columns:repeat(var(--cols),1fr);grid-template-rows:repeat(var(--rows),1fr);padding:0;gap:0}.cell{min-width:0;min-height:0;overflow:hidden;display:block;margin:0;padding:0}.cell .pagebox{width:100%;height:100%}.spread{padding:0}.spread>div{width:100%;height:100%;display:grid;grid-template-columns:1fr 1fr}.spread .pagebox{width:100%;height:100%}.spread small{position:absolute;right:2mm;bottom:2mm}.clip{position:absolute;inset:0;overflow:hidden}.clip img{position:absolute;max-width:none;max-height:none;object-fit:fill}.marks{position:absolute;inset:3mm;border:.2mm solid #111;pointer-events:none}.label{position:absolute;left:5mm;bottom:5mm;background:#fff;padding:1mm 2mm;font:8pt Arial}';
  return '<!doctype html><html><head><meta charset="utf-8"><style>'+css+'</style></head><body>'+body+'</body></html>';
}
export { PAPER_MM, pageRangeIndices, selectPageRanges, gridOrder, bookletSheets, buildPrintHtml };
