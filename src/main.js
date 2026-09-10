import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { BrowserQRCodeReader } from '@zxing/browser';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const $ = (s) => document.querySelector(s);
const pdfInput = $('#pdfInput');
const logoInput = $('#logoInput');
const classNameInput = $('#className');
const schoolNameInput = $('#schoolName');
const badgeGrid = $('#badgeGrid');
const badgeTemplate = $('#badgeTemplate');
const exportBtn = $('#exportBtn');
const previewBtn = $('#previewBtn');
const statusEl = $('#status');
const countEl = $('#count');
const selectAllBtn = $('#selectAllBtn');
const selectNoneBtn = $('#selectNoneBtn');
const removeSelectedBtn = $('#removeSelectedBtn');
const cardPreset = $('#cardPreset');
const cardWidth = $('#cardWidth');
const cardHeight = $('#cardHeight');
const masterStage = $('#masterStage');
const guideVertical = $('#guideVertical');
const guideHorizontal = $('#guideHorizontal');
const elementSize = $('#elementSize');
const elementVisible = $('#elementVisible');
const selectedElementName = $('#selectedElementName');
const elementPopover = $('#elementPopover');
const resetLayoutBtn = $('#resetLayoutBtn');
const studentSearch = $('#studentSearch');
const clearSearchBtn = $('#clearSearchBtn');
const backgroundColorInput = $('#backgroundColor');
const backgroundImageInput = $('#backgroundImageInput');
const clearBackgroundImageBtn = $('#clearBackgroundImageBtn');
const textColorControls = $('#textColorControls');
const autoTextColor = $('#autoTextColor');
const manualTextColor = $('#manualTextColor');
const textShadowEnabled = $('#textShadowEnabled');
const textShadowColor = $('#textShadowColor');
const textShadowX = $('#textShadowX');
const textShadowY = $('#textShadowY');
const textShadowSize = $('#textShadowSize');
const textShadowBlur = $('#textShadowBlur');
const textShadowOpacity = $('#textShadowOpacity');
const textShadowXValue = $('#textShadowXValue');
const textShadowYValue = $('#textShadowYValue');
const textShadowSizeValue = $('#textShadowSizeValue');
const textShadowBlurValue = $('#textShadowBlurValue');
const textShadowOpacityValue = $('#textShadowOpacityValue');

let badges = [];
let logoDataUrl = null;
let backgroundImageDataUrl = null;
let backgroundImageAverage = null;
let selectedElement = 'qr';
let dragState = null;
const qrReader = new BrowserQRCodeReader();

const layoutPresets = {
  portrait: {
    qr:        { x: 50, y: 47, size: 48, visible: true },
    name:      { x: 50, y: 76, size: 10, visible: true },
    school:    { x: 50, y: 9,  size: 6,  visible: true },
    logo:      { x: 50, y: 20, size: 20, visible: true },
    classLine: { x: 50, y: 88, size: 5,  visible: true },
  },
  landscape: {
    qr:        { x: 27, y: 53, size: 55, visible: true },
    name:      { x: 68, y: 46, size: 11, visible: true },
    school:    { x: 68, y: 14, size: 6,  visible: true },
    logo:      { x: 68, y: 28, size: 19, visible: true },
    classLine: { x: 68, y: 72, size: 6,  visible: true },
  },
  wide: {
    qr:        { x: 19, y: 52, size: 54, visible: true },
    name:      { x: 61, y: 45, size: 12, visible: true },
    school:    { x: 61, y: 12, size: 6,  visible: true },
    logo:      { x: 85, y: 18, size: 16, visible: true },
    classLine: { x: 61, y: 72, size: 6,  visible: true },
  },
  square: {
    qr:        { x: 50, y: 47, size: 50, visible: true },
    name:      { x: 50, y: 77, size: 10, visible: true },
    school:    { x: 50, y: 10, size: 6,  visible: true },
    logo:      { x: 50, y: 22, size: 17, visible: true },
    classLine: { x: 50, y: 89, size: 5,  visible: true },
  },
};
const defaults = structuredClone(layoutPresets.portrait);
let layout = structuredClone(defaults);
const labels = { qr:'QR code', name:'Student name', school:'School name', logo:'Logo', classLine:'Teacher / Grade / Class' };
const textStyles = {
  school: { auto: true, color: '#17202a', shadow: false, shadowColor: '#000000', shadowX: 2, shadowY: 2, shadowSize: 2, shadowBlur: 3, shadowOpacity: 55 },
  name: { auto: true, color: '#17202a', shadow: false, shadowColor: '#000000', shadowX: 2, shadowY: 2, shadowSize: 2, shadowBlur: 3, shadowOpacity: 55 },
  classLine: { auto: true, color: '#17202a', shadow: false, shadowColor: '#000000', shadowX: 2, shadowY: 2, shadowSize: 2, shadowBlur: 3, shadowOpacity: 55 },
};

pdfInput.addEventListener('change', importPdf);
logoInput.addEventListener('change', async () => {
  const file = logoInput.files?.[0];
  logoDataUrl = file ? await fileToPngDataUrl(file) : null;
  updateMasterStage();
});
classNameInput.addEventListener('input', updateMasterStage);
schoolNameInput.addEventListener('input', updateMasterStage);
exportBtn.addEventListener('click', exportPdf);
previewBtn.addEventListener('click', previewPdf);
selectAllBtn.addEventListener('click', () => setAllSelected(true));
selectNoneBtn.addEventListener('click', () => setAllSelected(false));
removeSelectedBtn.addEventListener('click', removeSelected);
cardPreset.addEventListener('change', applyPreset);
cardWidth.addEventListener('input', onCustomSize);
cardHeight.addEventListener('input', onCustomSize);
elementSize.addEventListener('input', () => {
  layout[selectedElement].size = Number(elementSize.value);
  updateMasterStage();
});
elementVisible.addEventListener('change', () => {
  layout[selectedElement].visible = elementVisible.checked;
  updateMasterStage();
});
autoTextColor.addEventListener('change', () => {
  if(!textStyles[selectedElement]) return;
  textStyles[selectedElement].auto = autoTextColor.checked;
  updateMasterStage();
});
manualTextColor.addEventListener('input', () => {
  if(!textStyles[selectedElement]) return;
  textStyles[selectedElement].color = manualTextColor.value;
  if(!textStyles[selectedElement].auto) updateMasterStage();
});
textShadowEnabled.addEventListener('change', () => {
  if(!textStyles[selectedElement]) return;
  textStyles[selectedElement].shadow = textShadowEnabled.checked;
  textShadowColor.disabled=!textShadowEnabled.checked;
  [textShadowX,textShadowY,textShadowSize,textShadowBlur,textShadowOpacity].forEach(i=>i.disabled=!textShadowEnabled.checked);
  updateMasterStage();
});
textShadowColor.addEventListener('input', () => {
  if(!textStyles[selectedElement]) return;
  textStyles[selectedElement].shadowColor = textShadowColor.value;
  updateMasterStage();
});
for(const [input,key,out,fmt] of [
  [textShadowX,'shadowX',textShadowXValue,v=>v],
  [textShadowY,'shadowY',textShadowYValue,v=>v],
  [textShadowSize,'shadowSize',textShadowSizeValue,v=>v],
  [textShadowBlur,'shadowBlur',textShadowBlurValue,v=>v],
  [textShadowOpacity,'shadowOpacity',textShadowOpacityValue,v=>`${v}%`],
]){
  input.addEventListener('input',()=>{
    if(!textStyles[selectedElement]) return;
    textStyles[selectedElement][key]=Number(input.value);
    out.textContent=fmt(input.value);
    updateMasterStage();
  });
}
studentSearch.addEventListener('input', renderBadges);
clearSearchBtn.addEventListener('click', () => { studentSearch.value = ''; renderBadges(); studentSearch.focus(); });
backgroundColorInput.addEventListener('input', updateMasterStage);
backgroundImageInput.addEventListener('change', async () => {
  const file = backgroundImageInput.files?.[0];
  backgroundImageDataUrl = file ? await fileToPngDataUrl(file) : null;
  backgroundImageAverage = backgroundImageDataUrl ? await averageColorFromDataUrl(backgroundImageDataUrl) : null;
  updateMasterStage();
});
clearBackgroundImageBtn.addEventListener('click', () => {
  backgroundImageDataUrl = null;
  backgroundImageAverage = null;
  backgroundImageInput.value = '';
  updateMasterStage();
});

resetLayoutBtn.addEventListener('click', () => {
  const key = cardPreset.value in layoutPresets ? cardPreset.value : 'portrait';
  layout = structuredClone(layoutPresets[key]);
  selectedElement = 'qr';
  selectMasterElement('qr');
  updateMasterStage();
});

masterStage.querySelectorAll('.master-element').forEach(el => {
  el.addEventListener('pointerdown', beginInteraction);
  el.addEventListener('click', () => selectMasterElement(el.dataset.element));
  el.addEventListener('keydown', (e) => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const key = el.dataset.element;
    const step = e.shiftKey ? 2 : .5;
    if (e.key === 'ArrowLeft') layout[key].x -= step;
    if (e.key === 'ArrowRight') layout[key].x += step;
    if (e.key === 'ArrowUp') layout[key].y -= step;
    if (e.key === 'ArrowDown') layout[key].y += step;
    clampLayout(key);
    updateMasterStage();
  });
});
window.addEventListener('pointermove', moveDrag);
window.addEventListener('pointerup', endDrag);

applyPreset();
selectMasterElement('qr');
updateMasterStage();
hideElementPopover();

async function importPdf() {
  const file = pdfInput.files?.[0];
  if (!file) return;
  badges = [];
  renderBadges();
  exportBtn.disabled = true;
  previewBtn.disabled = true;
  statusEl.textContent = 'Reading PDF locally…';

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    statusEl.textContent = `Found ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}. Processing…`;

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      statusEl.textContent = `Processing page ${pageNo} of ${pdf.numPages}…`;
      const pageBadges = await processPage(await pdf.getPage(pageNo), pageNo);
      badges.push(...pageBadges.map(b => ({...b, selected:false})));
      renderBadges();
      await new Promise(requestAnimationFrame);
    }

    const failed = badges.filter(b => !b.qrDataUrl).length;
    statusEl.textContent = failed
      ? `Processed ${badges.length} badge(s). ${failed} QR code(s) need attention.`
      : `Processed ${badges.length} badge(s). All QR codes detected.`;
    updateButtons();
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Could not process this PDF: ${err.message}`;
  }
}

async function processPage(page, pageNo) {
  const scale = 2.6;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  await page.render({ canvasContext: ctx, viewport }).promise;

  const textItems = await extractTextItems(page, viewport);
  const detections = await detectBadgesOnSheet(canvas, textItems);

  if (!detections.length) {
    return [{ pageNo, sourceIndex:1, name:`Page ${pageNo} - QR not detected`, qrDataUrl:null, qrText:null }];
  }

  return detections.map((d, i) => ({
    pageNo,
    sourceIndex:i + 1,
    name:d.name || `Student ${pageNo}-${i + 1}`,
    qrDataUrl:d.qrDataUrl,
    qrText:d.qrText
  }));
}

async function extractTextItems(page, viewport) {
  const content = await page.getTextContent();
  return content.items
    .filter(i => typeof i.str === 'string' && i.str.trim())
    .map(i => {
      const text = i.str.trim();
      const tx = i.transform?.[4] ?? 0;
      const ty = i.transform?.[5] ?? 0;
      const [x, y] = viewport.convertToViewportPoint(tx, ty);
      const size = Math.max(1, Math.abs((i.transform?.[0] ?? 8) * viewport.scale));
      const width = Math.max(1, (i.width ?? text.length * 5) * viewport.scale);
      return { text, x, y, width, size };
    })
    .filter(i => !/^clever$/i.test(i.text));
}

async function detectBadgesOnSheet(canvas, textItems) {
  const gridCandidates = [[3,4],[4,3],[2,6],[6,2],[3,3],[2,4],[4,2],[2,3],[3,2]];
  const found = [];

  for (const [cols, rows] of gridCandidates) {
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;
    const overlapX = cellW * .10;
    const overlapY = cellH * .10;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const sx = Math.max(0, Math.floor(col * cellW - overlapX));
        const sy = Math.max(0, Math.floor(row * cellH - overlapY));
        const ex = Math.min(canvas.width, Math.ceil((col + 1) * cellW + overlapX));
        const ey = Math.min(canvas.height, Math.ceil((row + 1) * cellH + overlapY));
        const w = ex - sx, h = ey - sy;
        if (w < 80 || h < 80) continue;

        const tile = document.createElement('canvas');
        tile.width = w; tile.height = h;
        tile.getContext('2d', { willReadFrequently:true }).drawImage(canvas, sx, sy, w, h, 0, 0, w, h);

        try {
          const result = await qrReader.decodeFromCanvas(tile);
          const qrText = result.getText();
          const points = result.getResultPoints?.() || [];
          const translated = points.map(p => ({ x:(p.getX ? p.getX() : p.x)+sx, y:(p.getY ? p.getY() : p.y)+sy }));
          const box = qrBoundsFromPoints(translated, canvas);
          if (isDuplicateQr(found, qrText, box)) continue;
          const name = findNameForQr(textItems, box, {sx,sy,ex,ey});
          found.push({ qrText, box, name, qrDataUrl:cropQrByBox(canvas, box) });
        } catch (_) {}
      }
    }
    if (found.length >= 12) break;
  }

  found.sort((a,b) => {
    const tol = Math.max(a.box.h,b.box.h)*.55;
    if (Math.abs(a.box.cy-b.box.cy)>tol) return a.box.cy-b.box.cy;
    return a.box.cx-b.box.cx;
  });
  return found.slice(0,12);
}

function qrBoundsFromPoints(points, canvas) {
  if (!points.length) return {cx:canvas.width/2,cy:canvas.height/2,w:180,h:180};
  const xs = points.map(p=>p.x), ys = points.map(p=>p.y);
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  const measured=Math.max(maxX-minX,maxY-minY,80), side=measured*1.55;
  return {cx:(minX+maxX)/2,cy:(minY+maxY)/2,w:side,h:side};
}

function isDuplicateQr(found, qrText, box) {
  return found.some(f => qrText && f.qrText===qrText || Math.hypot(f.box.cx-box.cx,f.box.cy-box.cy)<Math.max(f.box.w,box.w)*.65);
}

function findNameForQr(textItems, box, cell) {
  const left=Math.max(cell.sx,box.cx-box.w*1.35), right=Math.min(cell.ex,box.cx+box.w*1.35);
  const top=box.cy+box.h*.20, bottom=Math.min(cell.ey,box.cy+box.h*1.65);
  let candidates=textItems.filter(i=>i.x>=left&&i.x<=right&&i.y>=top&&i.y<=bottom);
  const nameLike=candidates.filter(i=>/^[\p{L}][\p{L}'’.-]+(?:\s+[\p{L}][\p{L}'’.-]+)+$/u.test(i.text));
  if(nameLike.length)candidates=nameLike;
  if(!candidates.length)candidates=textItems.filter(i=>i.x>=cell.sx&&i.x<=cell.ex&&i.y>=cell.sy&&i.y<=cell.ey&&/^[\p{L}][\p{L}'’.-]+(?:\s+[\p{L}][\p{L}'’.-]+)+$/u.test(i.text));
  candidates.sort((a,b)=>Math.abs(a.x-box.cx)-Math.abs(b.x-box.cx)||b.size-a.size);
  return candidates[0]?.text||'';
}

function cropQrByBox(canvas, box) {
  // box.w/box.h already include a quiet-zone margin around the detected QR.
  // Keep this crop tight so Clever's printed student name below the QR is not captured.
  const side=Math.min(Math.max(box.w,box.h)*1.02,canvas.width,canvas.height);
  const sx=Math.max(0,Math.min(canvas.width-side,box.cx-side/2));
  // Keep the crop the same size, but bias it upward slightly so the printed name below the QR stays out of frame.
  const upwardShift=side*0.025;
  const sy=Math.max(0,Math.min(canvas.height-side,box.cy-side/2-upwardShift));
  const out=document.createElement('canvas');
  out.width=Math.ceil(side); out.height=Math.ceil(side);
  const octx=out.getContext('2d');
  octx.fillStyle='#fff'; octx.fillRect(0,0,out.width,out.height);
  octx.drawImage(canvas,sx,sy,side,side,0,0,out.width,out.height);
  return out.toDataURL('image/png');
}

function renderBadges() {
  badgeGrid.innerHTML='';
  if(!badges.length){ badgeGrid.className='badge-grid empty'; badgeGrid.textContent='Import a PDF to begin.'; countEl.textContent=''; updateButtons(); return; }
  badgeGrid.className='badge-grid';
  const selectedCount=badges.filter(b=>b.selected).length;
  const query=studentSearch.value.trim().toLocaleLowerCase();
  const visibleIndexes=badges.map((b,i)=>({b,i})).filter(({b})=>!query||b.name.toLocaleLowerCase().includes(query));
  countEl.textContent=query
    ? `${visibleIndexes.length} shown of ${badges.length} • ${selectedCount} selected`
    : `${badges.length} badge${badges.length===1?'':'s'} • ${selectedCount} selected`;

  if(!visibleIndexes.length){ badgeGrid.className='badge-grid empty'; badgeGrid.textContent='No students match that search.'; updateButtons(); return; }

  visibleIndexes.forEach(({b:badge,i:index})=>{
    const node=badgeTemplate.content.cloneNode(true);
    const row=node.querySelector('.student-row');
    const checkbox=node.querySelector('.badge-select');
    const qr=node.querySelector('.qr-thumb');
    const name=node.querySelector('.student-name');
    const info=node.querySelector('.source-info');
    checkbox.checked=badge.selected;
    row.classList.toggle('is-selected',badge.selected);
    checkbox.addEventListener('change',()=>{ badges[index].selected=checkbox.checked; renderBadges(); });
    name.value=badge.name;
    name.addEventListener('input',()=>{ badges[index].name=name.value; });
    info.textContent=`Page ${badge.pageNo} • Badge ${badge.sourceIndex}`;
    if(badge.qrDataUrl) qr.src=badge.qrDataUrl; else { qr.alt='QR not detected'; row.style.borderColor='#b42318'; }
    badgeGrid.appendChild(node);
  });
  updateButtons();
}

function setAllSelected(value){ badges.forEach(b=>b.selected=value); renderBadges(); }
function removeSelected(){ badges=badges.filter(b=>!b.selected); renderBadges(); statusEl.textContent=`${badges.length} badge(s) remain after removal.`; }
function updateButtons(){
  const selected=badges.some(b=>b.selected);
  removeSelectedBtn.disabled=!selected;
  exportBtn.disabled=!badges.length||badges.some(b=>!b.qrDataUrl);
  previewBtn.disabled=exportBtn.disabled;
}

function applyPreset(){
  const presets={ portrait:[2.3,3.3], landscape:[3.5,2.5], wide:[4,2.25], square:[3,3] };
  if(presets[cardPreset.value]){
    [cardWidth.value,cardHeight.value]=presets[cardPreset.value];
    layout=structuredClone(layoutPresets[cardPreset.value]);
    selectedElement='qr';
  }
  resizeStage();
  selectMasterElement(selectedElement);
}
function onCustomSize(){ cardPreset.value='custom'; resizeStage(); }
function resizeStage(){
  const w=Math.max(1.5,Number(cardWidth.value)||2.3), h=Math.max(1.5,Number(cardHeight.value)||3.3);
  const maxW=480,maxH=430;
  const scale=Math.min(maxW/w,maxH/h);
  masterStage.style.width=`${Math.round(w*scale)}px`;
  masterStage.style.height=`${Math.round(h*scale)}px`;
  updateMasterStage();
}

function selectMasterElement(key){
  selectedElement=key;
  masterStage.querySelectorAll('.master-element').forEach(el=>el.classList.toggle('selected',el.dataset.element===key));
  selectedElementName.textContent=labels[key];
  elementSize.value=layout[key].size;
  elementVisible.checked=layout[key].visible;
  const isText=!!textStyles[key];
  textColorControls.style.display=isText?'grid':'none';
  showElementPopover(key);
  if(isText){
    autoTextColor.checked=textStyles[key].auto;
    manualTextColor.value=textStyles[key].color;
    manualTextColor.disabled=textStyles[key].auto;
    textShadowEnabled.checked=!!textStyles[key].shadow;
    textShadowColor.value=textStyles[key].shadowColor||'#000000';
    textShadowX.value=textStyles[key].shadowX ?? 2;
    textShadowY.value=textStyles[key].shadowY ?? 2;
    textShadowSize.value=textStyles[key].shadowSize ?? 2;
    textShadowBlur.value=textStyles[key].shadowBlur ?? 3;
    textShadowOpacity.value=textStyles[key].shadowOpacity ?? 55;
    textShadowXValue.textContent=textShadowX.value;
    textShadowYValue.textContent=textShadowY.value;
    textShadowSizeValue.textContent=textShadowSize.value;
    textShadowBlurValue.textContent=textShadowBlur.value;
    textShadowOpacityValue.textContent=`${textShadowOpacity.value}%`;
    textShadowColor.disabled=!textStyles[key].shadow;
    [textShadowX,textShadowY,textShadowSize,textShadowBlur,textShadowOpacity].forEach(i=>i.disabled=!textStyles[key].shadow);
  }
}

function showElementPopover(key){
  const target=masterStage.querySelector(`[data-element="${key}"]`);
  if(!target || !layout[key]?.visible) return;
  elementPopover.hidden=false;
  requestAnimationFrame(()=>positionElementPopover(target));
}

function positionElementPopover(target){
  if(elementPopover.hidden || !target) return;
  const wrap=masterStage.parentElement.getBoundingClientRect();
  const r=target.getBoundingClientRect();
  const popW=elementPopover.offsetWidth || 380;
  const popH=elementPopover.offsetHeight || 240;
  const gap=16;

  // Default: centered beneath the selected element with breathing room.
  let left=r.left-wrap.left + r.width/2 - popW/2;
  let top=r.bottom-wrap.top + gap;
  let placement='below';

  // Keep the bubble inside the browser viewport horizontally.
  const viewportPad=12;
  const screenLeft=wrap.left+left;
  if(screenLeft < viewportPad) left += viewportPad-screenLeft;
  const screenRight=wrap.left+left+popW;
  if(screenRight > window.innerWidth-viewportPad) left -= screenRight-(window.innerWidth-viewportPad);

  // Only flip above if the browser viewport genuinely has no room below.
  const screenBottom=wrap.top+top+popH;
  if(screenBottom > window.innerHeight-viewportPad){
    const aboveTop=r.top-wrap.top-popH-gap;
    const screenAboveTop=wrap.top+aboveTop;
    if(screenAboveTop >= viewportPad){
      top=aboveTop;
      placement='above';
    }
  }

  elementPopover.dataset.placement=placement;
  elementPopover.style.left=`${left}px`;
  elementPopover.style.top=`${top}px`;
}

function hideElementPopover(){ elementPopover.hidden=true; }

document.addEventListener('pointerdown',(e)=>{
  if(elementPopover.hidden) return;
  if(elementPopover.contains(e.target)) return;
  if(e.target.closest('.master-element')) return;
  hideElementPopover();
});
window.addEventListener('resize',()=>{
  const target=masterStage.querySelector(`[data-element="${selectedElement}"]`);
  if(target && !elementPopover.hidden) positionElementPopover(target);
});

function updateMasterStage(){
  const school=masterStage.querySelector('[data-element="school"] .element-content');
  const classLine=masterStage.querySelector('[data-element="classLine"] .element-content');
  const logo=masterStage.querySelector('[data-element="logo"]');
  school.textContent=schoolNameInput.value.trim()||'School Name';
  classLine.textContent=classNameInput.value.trim()||'Teacher • Grade • Class';
  const img=logo.querySelector('img'), span=logo.querySelector('.placeholder');
  if(logoDataUrl){ img.src=logoDataUrl; img.style.display='block'; span.style.display='none'; }
  else { img.style.display='none'; span.style.display='block'; }

  masterStage.style.backgroundColor=backgroundColorInput.value||'#ffffff';
  masterStage.style.backgroundImage=backgroundImageDataUrl ? `url(${backgroundImageDataUrl})` : 'none';
  masterStage.classList.toggle('has-background-image',!!backgroundImageDataUrl);

  masterStage.querySelectorAll('.master-element').forEach(el=>{
    const key=el.dataset.element, cfg=layout[key];
    el.style.left=`${cfg.x}%`; el.style.top=`${cfg.y}%`;
    el.style.display=cfg.visible?'flex':'none';
    if(key==='qr'||key==='logo'){
      el.style.width=`${cfg.size}%`;
      el.style.height=key==='qr'?`${cfg.size * (masterStage.clientWidth/masterStage.clientHeight)}%`:`${Math.max(8,cfg.size*.42)}%`;
    } else {
      el.style.fontSize=`${Math.max(9,cfg.size*2.0)}px`;
      el.style.maxWidth='92%';
      el.style.color=resolvedTextColor(key);
      const ts=textStyles[key];
      if(ts?.shadow){
        const layers = shadowLayers(ts, 1);
        el.style.textShadow = layers.map(l => `${l.x}px ${l.y}px 0 ${hexToRgba(ts.shadowColor||'#000000', l.opacity)}`).join(', ');
      }else{
        el.style.textShadow='none';
      }
    }
  });
  selectMasterElement(selectedElement);
  const activeTarget=masterStage.querySelector(`[data-element="${selectedElement}"]`);
  if(activeTarget && !elementPopover.hidden) positionElementPopover(activeTarget);
}

function beginInteraction(e){
  e.preventDefault();
  const el=e.currentTarget;
  const key=el.dataset.element;
  selectMasterElement(key);
  const stageRect=masterStage.getBoundingClientRect();
  const mode=e.target.closest('.resize-handle')?'resize':'move';
  const centerX=stageRect.left+stageRect.width*(layout[key].x/100);
  const centerY=stageRect.top+stageRect.height*(layout[key].y/100);
  dragState={
    key,
    mode,
    pointerId:e.pointerId,
    centerX,
    centerY,
    startSize:layout[key].size,
    startDistance:Math.max(12,Math.hypot(e.clientX-centerX,e.clientY-centerY))
  };
  el.setPointerCapture?.(e.pointerId);
}
function moveDrag(e){
  if(!dragState)return;
  if(dragState.mode==='resize'){
    const distance=Math.max(4,Math.hypot(e.clientX-dragState.centerX,e.clientY-dragState.centerY));
    layout[dragState.key].size=Math.max(4,Math.min(90,dragState.startSize*(distance/dragState.startDistance)));
    elementSize.value=Math.round(layout[dragState.key].size);
  }else{
    const r=masterStage.getBoundingClientRect();
    let x=(e.clientX-r.left)/r.width*100;
    let y=(e.clientY-r.top)/r.height*100;

    // Center snapping. The threshold is in screen pixels so it feels consistent
    // regardless of the selected card dimensions.
    const snapPx=8;
    const snapXPercent=snapPx/r.width*100;
    const snapYPercent=snapPx/r.height*100;
    const snapX=Math.abs(x-50)<=snapXPercent;
    const snapY=Math.abs(y-50)<=snapYPercent;
    if(snapX)x=50;
    if(snapY)y=50;
    layout[dragState.key].x=x;
    layout[dragState.key].y=y;
    setAlignmentGuides(snapX,snapY);
    clampLayout(dragState.key);
  }
  updateMasterStage();
}
function endDrag(){
  dragState=null;
  setAlignmentGuides(false,false);
}

function setAlignmentGuides(vertical,horizontal){
  if(guideVertical) guideVertical.classList.toggle('show',!!vertical);
  if(guideHorizontal) guideHorizontal.classList.toggle('show',!!horizontal);
}

function clampLayout(key){
  layout[key].x=Math.max(3,Math.min(97,layout[key].x));
  layout[key].y=Math.max(3,Math.min(97,layout[key].y));
}

async function buildPdfBytes(){
  if(!badges.length||badges.some(b=>!b.qrDataUrl)) throw new Error('All badges need a detected QR code before creating the PDF.');
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageW=612,pageH=792,margin=18,gap=8;
  const cardW=Number(cardWidth.value)*72, cardH=Number(cardHeight.value)*72;
  const cols=Math.max(1,Math.floor((pageW-margin*2+gap)/(cardW+gap)));
  const rows=Math.max(1,Math.floor((pageH-margin*2+gap)/(cardH+gap)));
  if(cardW>pageW-margin*2||cardH>pageH-margin*2) throw new Error('Card dimensions are too large for a US Letter page.');
  const perPage=cols*rows;
  let logoImage=null;
  let backgroundImage=null;
  if(logoDataUrl) logoImage=await embedDataUrl(pdf,logoDataUrl);
  if(backgroundImageDataUrl) backgroundImage=await embedDataUrl(pdf,backgroundImageDataUrl);

  for(let i=0;i<badges.length;i++){
    if(i%perPage===0)pdf.addPage([pageW,pageH]);
    const page=pdf.getPages()[pdf.getPageCount()-1];
    const pos=i%perPage,col=pos%cols,row=Math.floor(pos/cols);
    const x=margin+col*(cardW+gap);
    const y=pageH-margin-cardH-row*(cardH+gap);
    const bg=hexToRgb(backgroundColorInput.value||'#ffffff');
    page.drawRectangle({x,y,width:cardW,height:cardH,color:rgb(bg.r,bg.g,bg.b)});
    if(backgroundImage) page.drawImage(backgroundImage,{x,y,width:cardW,height:cardH});
    page.drawRectangle({x,y,width:cardW,height:cardH,borderWidth:1,borderColor:rgb(.14,.2,.28)});
    await drawCard(page,pdf,badges[i],x,y,cardW,cardH,font,bold,logoImage);
  }
  return await pdf.save();
}

async function previewPdf(){
  if(previewBtn.disabled)return;
  statusEl.textContent='Building PDF preview locally…';
  try{
    const bytes=await buildPdfBytes();
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    const previewWindow=window.open(url,'_blank','noopener,noreferrer');
    if(!previewWindow){
      URL.revokeObjectURL(url);
      throw new Error('The browser blocked the preview window. Allow pop-ups for this site and try again.');
    }
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    statusEl.textContent=`Opened a preview of ${badges.length} badge(s).`;
  }catch(err){ console.error(err); statusEl.textContent=`Could not preview PDF: ${err.message}`; }
}

async function exportPdf(){
  if(exportBtn.disabled)return;
  statusEl.textContent='Building printable PDF locally…';
  try{
    const bytes=await buildPdfBytes();
    downloadBlob(new Blob([bytes],{type:'application/pdf'}),'clever-badges-formatted.pdf');
    statusEl.textContent=`Exported ${badges.length} badge(s) using a ${cardWidth.value} × ${cardHeight.value} inch master card.`;
  }catch(err){ console.error(err); statusEl.textContent=`Could not export PDF: ${err.message}`; }
}

async function drawCard(page,pdf,badge,x,y,w,h,font,bold,logoImage){
  for(const key of ['school','logo','qr','name','classLine']){
    const cfg=layout[key];
    if(!cfg.visible)continue;
    const cx=x+w*(cfg.x/100);
    const cy=y+h*(1-cfg.y/100);

    if(key==='qr'){
      const roundedQr=await roundedQrDataUrl(badge.qrDataUrl);
      const image=await embedDataUrl(pdf,roundedQr);
      const side=Math.min(w,h)*(cfg.size/100);
      page.drawImage(image,{x:cx-side/2,y:cy-side/2,width:side,height:side});
    }else if(key==='logo'&&logoImage){
      const maxW=w*(cfg.size/100), maxH=h*Math.max(.08,cfg.size*.0042);
      const ratio=Math.min(maxW/logoImage.width,maxH/logoImage.height);
      const iw=logoImage.width*ratio, ih=logoImage.height*ratio;
      page.drawImage(logoImage,{x:cx-iw/2,y:cy-ih/2,width:iw,height:ih});
    }else if(key==='school'){
      drawCenteredAt(page,schoolNameInput.value.trim(),cx,cy,w*.9,Math.max(6,cfg.size*.85),bold,resolvedTextColor('school'),textStyles.school);
    }else if(key==='name'){
      drawCenteredAt(page,badge.name,cx,cy,w*.92,Math.max(7,cfg.size*.95),bold,resolvedTextColor('name'),textStyles.name);
    }else if(key==='classLine'){
      drawCenteredAt(page,classNameInput.value.trim(),cx,cy,w*.92,Math.max(6,cfg.size*.9),font,resolvedTextColor('classLine'),textStyles.classLine);
    }
  }
}

function shadowLayers(style, scale=1){
  const ox=Number(style.shadowX ?? 2)*scale;
  const oy=Number(style.shadowY ?? 2)*scale;
  const sizeAmt=Math.max(0,Number(style.shadowSize ?? 2))*scale;
  const blurAmt=Math.max(0,Number(style.shadowBlur ?? 3))*scale;
  const opacity=Math.max(.1,Math.min(1,Number(style.shadowOpacity ?? 55)/100));
  const pts=[];
  const add=(x,y,w)=>pts.push({x:ox+x,y:oy+y,opacity:Math.min(.88,opacity*w)});

  // Solid shadow core. Size increases thickness without softening the edge.
  add(0,0,1);
  if(sizeAmt>0){
    const coreR=Math.max(.35,sizeAmt*.5);
    const coreSteps=Math.max(1,Math.min(3,Math.ceil(sizeAmt/2)));
    for(let ring=1; ring<=coreSteps; ring++){
      const r=coreR*(ring/coreSteps);
      for(let i=0;i<8;i++){
        const a=Math.PI*2*i/8;
        add(Math.cos(a)*r,Math.sin(a)*r,.62);
      }
    }
  }

  // Soft falloff outside the core. Blur changes softness/radius only.
  if(blurAmt>0){
    const coreR=sizeAmt>0 ? Math.max(.35,sizeAmt*.5) : 0;
    const blurR=Math.max(.5,blurAmt*.72);
    const rings=Math.max(2,Math.min(6,Math.ceil(blurAmt/2)+1));
    for(let ring=1; ring<=rings; ring++){
      const t=ring/rings;
      const r=coreR+blurR*t;
      const weight=.28*(1-t)+.05;
      const points=12;
      for(let i=0;i<points;i++){
        const a=Math.PI*2*i/points;
        add(Math.cos(a)*r,Math.sin(a)*r,weight);
      }
    }
  }
  return pts;
}

function drawCenteredAt(page,text,cx,cy,maxWidth,size,font,colorHex,style=null){
  if(!text)return;
  const fitted=fitText(text,maxWidth,size,font);
  const tw=font.widthOfTextAtSize(fitted,size);
  const tx=cx-tw/2, ty=cy-size*.35;
  if(style?.shadow){
    const sc=hexToRgb(style.shadowColor||'#000000');
    const scale=size/18;
    for(const layer of shadowLayers(style, scale)){
      page.drawText(fitted,{
        x:tx+layer.x,
        y:ty-layer.y,
        size,
        font,
        color:rgb(sc.r,sc.g,sc.b),
        opacity:layer.opacity
      });
    }
  }
  const c=hexToRgb(colorHex||'#17202a');
  page.drawText(fitted,{x:tx,y:ty,size,font,color:rgb(c.r,c.g,c.b)});
}

function resolvedTextColor(key){
  const style=textStyles[key];
  if(!style) return '#17202a';
  if(!style.auto) return style.color;
  const bg=backgroundImageAverage || backgroundColorInput.value || '#ffffff';
  return adaptiveComplement(bg);
}

function adaptiveComplement(hex){
  const {r,g,b}=hexToRgb255(hex);
  const comp={r:255-r,g:255-g,b:255-b};
  const bg={r,g,b};
  if(contrastRatio(bg,comp)>=4.5) return rgb255ToHex(comp);
  const black={r:23,g:32,b:42}, white={r:255,g:255,b:255};
  return contrastRatio(bg,white)>=contrastRatio(bg,black) ? '#ffffff' : '#17202a';
}
function hexToRgb255(hex){
  const clean=(hex||'#ffffff').replace('#','');
  const full=clean.length===3?clean.split('').map(c=>c+c).join(''):clean;
  return {r:parseInt(full.slice(0,2),16),g:parseInt(full.slice(2,4),16),b:parseInt(full.slice(4,6),16)};
}
function rgb255ToHex(c){ return '#'+[c.r,c.g,c.b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
function relativeLuminance(c){
  const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
  return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);
}
function contrastRatio(a,b){
  const l1=relativeLuminance(a),l2=relativeLuminance(b);
  return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
}
async function averageColorFromDataUrl(dataUrl){
  return new Promise((resolve)=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas'); c.width=32; c.height=32;
      const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,32,32);
      const data=ctx.getImageData(0,0,32,32).data;
      let r=0,g=0,b=0,n=0;
      for(let i=0;i<data.length;i+=16){ const a=data[i+3]/255; if(a<.15)continue; r+=data[i];g+=data[i+1];b+=data[i+2];n++; }
      resolve(n?rgb255ToHex({r:r/n,g:g/n,b:b/n}):backgroundColorInput.value||'#ffffff');
    };
    img.onerror=()=>resolve(backgroundColorInput.value||'#ffffff');
    img.src=dataUrl;
  });
}
function fitText(text,maxWidth,size,font){
  if(font.widthOfTextAtSize(text,size)<=maxWidth)return text;
  let t=text;
  while(t.length>3&&font.widthOfTextAtSize(t+'…',size)>maxWidth)t=t.slice(0,-1);
  return t+'…';
}
const roundedQrCache=new Map();
async function roundedQrDataUrl(dataUrl){
  if(roundedQrCache.has(dataUrl)) return roundedQrCache.get(dataUrl);
  const result=await new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      const size=Math.max(img.naturalWidth,img.naturalHeight);
      const c=document.createElement('canvas'); c.width=size; c.height=size;
      const ctx=c.getContext('2d');
      const radius=Math.max(3,size*.035);
      ctx.clearRect(0,0,size,size);
      ctx.beginPath();
      ctx.moveTo(radius,0); ctx.lineTo(size-radius,0); ctx.quadraticCurveTo(size,0,size,radius);
      ctx.lineTo(size,size-radius); ctx.quadraticCurveTo(size,size,size-radius,size);
      ctx.lineTo(radius,size); ctx.quadraticCurveTo(0,size,0,size-radius);
      ctx.lineTo(0,radius); ctx.quadraticCurveTo(0,0,radius,0); ctx.closePath();
      ctx.clip();
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,size,size);
      ctx.drawImage(img,0,0,size,size);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror=reject; img.src=dataUrl;
  });
  roundedQrCache.set(dataUrl,result);
  return result;
}

async function embedDataUrl(pdf,dataUrl){
  const bytes=Uint8Array.from(atob(dataUrl.split(',')[1]),c=>c.charCodeAt(0));
  return dataUrl.startsWith('data:image/png')?pdf.embedPng(bytes):pdf.embedJpg(bytes);
}
function fileToDataUrl(file){ return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);}); }
async function fileToPngDataUrl(file){
  const src=await fileToDataUrl(file);
  if(file.type==='image/png') return src;
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
      c.getContext('2d').drawImage(img,0,0); resolve(c.toDataURL('image/png'));
    };
    img.onerror=reject; img.src=src;
  });
}
function hexToRgb(hex){
  const clean=hex.replace('#','');
  const n=parseInt(clean.length===3?clean.split('').map(c=>c+c).join(''):clean,16);
  return {r:((n>>16)&255)/255,g:((n>>8)&255)/255,b:(n&255)/255};
}

function hexToRgba(hex,alpha=1){
  const c=hexToRgb(hex);
  return `rgba(${Math.round(c.r*255)}, ${Math.round(c.g*255)}, ${Math.round(c.b*255)}, ${alpha})`;
}
function downloadBlob(blob,filename){ const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
