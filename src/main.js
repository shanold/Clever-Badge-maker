import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { BrowserQRCodeReader } from '@zxing/browser';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const pdfInput = document.querySelector('#pdfInput');
const logoInput = document.querySelector('#logoInput');
const classNameInput = document.querySelector('#className');
const schoolNameInput = document.querySelector('#schoolName');
const cardsPerRow = document.querySelector('#cardsPerRow');
const badgeGrid = document.querySelector('#badgeGrid');
const badgeTemplate = document.querySelector('#badgeTemplate');
const exportBtn = document.querySelector('#exportBtn');
const statusEl = document.querySelector('#status');
const countEl = document.querySelector('#count');

let badges = [];
let logoDataUrl = null;
const qrReader = new BrowserQRCodeReader();

pdfInput.addEventListener('change', async () => {
  const file = pdfInput.files?.[0];
  if (!file) return;
  badges = [];
  renderBadges();
  exportBtn.disabled = true;
  statusEl.textContent = 'Reading PDF locally…';

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    statusEl.textContent = `Found ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}. Processing…`;

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      statusEl.textContent = `Processing page ${pageNo} of ${pdf.numPages}…`;
      const pageBadges = await processPage(await pdf.getPage(pageNo), pageNo);
      badges.push(...pageBadges);
      renderBadges();
      await new Promise(requestAnimationFrame);
    }

    const failed = badges.filter(b => !b.qrDataUrl).length;
    statusEl.textContent = failed
      ? `Processed ${badges.length} badge(s). ${failed} QR code(s) need attention.`
      : `Processed ${badges.length} badge(s). All QR codes detected.`;
    exportBtn.disabled = badges.length === 0 || failed > 0;
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Could not process this PDF: ${err.message}`;
  }
});

logoInput.addEventListener('change', async () => {
  const file = logoInput.files?.[0];
  logoDataUrl = file ? await fileToDataUrl(file) : null;
  renderBadges();
});
classNameInput.addEventListener('input', renderBadges);
schoolNameInput.addEventListener('input', renderBadges);
exportBtn.addEventListener('click', exportPdf);

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
    console.warn(`No QR codes found on page ${pageNo}`);
    return [{
      pageNo,
      sourceIndex: 1,
      name: `Page ${pageNo} - QR not detected`,
      qrDataUrl: null,
      qrText: null
    }];
  }

  return detections.map((d, i) => ({
    pageNo,
    sourceIndex: i + 1,
    name: d.name || `Student ${pageNo}-${i + 1}`,
    qrDataUrl: d.qrDataUrl,
    qrText: d.qrText
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
  // Clever's printable sheets commonly contain up to 12 badges.  Rather than
  // decode the entire page as one QR image, inspect overlapping cells.  Trying
  // several grids also makes this work with partially-filled final pages.
  const gridCandidates = [
    [3, 4], [4, 3], [2, 6], [6, 2], [3, 3], [2, 4], [4, 2], [2, 3], [3, 2]
  ];
  const found = [];

  for (const [cols, rows] of gridCandidates) {
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;
    const overlapX = cellW * 0.10;
    const overlapY = cellH * 0.10;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const sx = Math.max(0, Math.floor(col * cellW - overlapX));
        const sy = Math.max(0, Math.floor(row * cellH - overlapY));
        const ex = Math.min(canvas.width, Math.ceil((col + 1) * cellW + overlapX));
        const ey = Math.min(canvas.height, Math.ceil((row + 1) * cellH + overlapY));
        const w = ex - sx;
        const h = ey - sy;
        if (w < 80 || h < 80) continue;

        const tile = document.createElement('canvas');
        tile.width = w;
        tile.height = h;
        tile.getContext('2d', { willReadFrequently: true }).drawImage(canvas, sx, sy, w, h, 0, 0, w, h);

        try {
          const result = await qrReader.decodeFromCanvas(tile);
          const qrText = result.getText();
          const points = result.getResultPoints?.() || [];
          const translated = points.map(p => ({
            x: (p.getX ? p.getX() : p.x) + sx,
            y: (p.getY ? p.getY() : p.y) + sy
          }));
          const box = qrBoundsFromPoints(translated, canvas);

          if (isDuplicateQr(found, qrText, box)) continue;

          const name = findNameForQr(textItems, box, { sx, sy, ex, ey });
          found.push({
            qrText,
            box,
            name,
            qrDataUrl: cropQrByBox(canvas, box)
          });
        } catch (_) {
          // Most tiles intentionally contain no QR code.
        }
      }
    }

    // A Clever sheet tops out at 12 badges, so there is no benefit to more scans.
    if (found.length >= 12) break;
  }

  found.sort((a, b) => {
    const rowTolerance = Math.max(a.box.h, b.box.h) * 0.55;
    if (Math.abs(a.box.cy - b.box.cy) > rowTolerance) return a.box.cy - b.box.cy;
    return a.box.cx - b.box.cx;
  });
  return found.slice(0, 12);
}

function qrBoundsFromPoints(points, canvas) {
  if (!points.length) {
    return { cx: canvas.width / 2, cy: canvas.height / 2, w: 180, h: 180 };
  }
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const measured = Math.max(maxX - minX, maxY - minY, 80);
  // Result points usually mark finder-pattern centers, not the full QR edges.
  const side = measured * 1.55;
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: side,
    h: side
  };
}

function isDuplicateQr(found, qrText, box) {
  return found.some(f => {
    if (qrText && f.qrText === qrText) return true;
    const distance = Math.hypot(f.box.cx - box.cx, f.box.cy - box.cy);
    return distance < Math.max(f.box.w, box.w) * 0.65;
  });
}

function findNameForQr(textItems, box, cell) {
  const left = Math.max(cell.sx, box.cx - box.w * 1.35);
  const right = Math.min(cell.ex, box.cx + box.w * 1.35);
  const top = box.cy + box.h * 0.20;
  const bottom = Math.min(cell.ey, box.cy + box.h * 1.65);

  let candidates = textItems.filter(i =>
    i.x >= left && i.x <= right && i.y >= top && i.y <= bottom
  );

  const nameLike = candidates.filter(i =>
    /^[\p{L}][\p{L}'’.-]+(?:\s+[\p{L}][\p{L}'’.-]+)+$/u.test(i.text)
  );
  if (nameLike.length) candidates = nameLike;

  if (!candidates.length) {
    // Fall back to any human-name-looking text in the same grid cell.
    candidates = textItems.filter(i =>
      i.x >= cell.sx && i.x <= cell.ex && i.y >= cell.sy && i.y <= cell.ey &&
      /^[\p{L}][\p{L}'’.-]+(?:\s+[\p{L}][\p{L}'’.-]+)+$/u.test(i.text)
    );
  }

  candidates.sort((a, b) => {
    const da = Math.abs(a.x - box.cx) + Math.max(0, a.y - box.cy) * 0.15;
    const db = Math.abs(b.x - box.cx) + Math.max(0, b.y - box.cy) * 0.15;
    return da - db || b.size - a.size;
  });
  return candidates[0]?.text || '';
}

function cropQrByBox(canvas, box) {
  const side = Math.min(Math.max(box.w, box.h) * 1.32, canvas.width, canvas.height);
  const sx = Math.max(0, Math.min(canvas.width - side, box.cx - side / 2));
  const sy = Math.max(0, Math.min(canvas.height - side, box.cy - side / 2));

  const out = document.createElement('canvas');
  out.width = Math.ceil(side);
  out.height = Math.ceil(side);
  const octx = out.getContext('2d');
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(canvas, sx, sy, side, side, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

function renderBadges() {
  badgeGrid.innerHTML = '';
  if (!badges.length) {
    badgeGrid.className = 'badge-grid empty';
    badgeGrid.textContent = 'Import a PDF to begin.';
    countEl.textContent = '';
    return;
  }
  badgeGrid.className = 'badge-grid';
  countEl.textContent = `${badges.length} badge${badges.length === 1 ? '' : 's'}`;

  badges.forEach((badge, index) => {
    const node = badgeTemplate.content.cloneNode(true);
    const card = node.querySelector('.badge-card');
    const qr = node.querySelector('.qr');
    const name = node.querySelector('.student-name');
    const school = node.querySelector('.school');
    const classLine = node.querySelector('.class-line');
    const logo = node.querySelector('.badge-logo');

    school.textContent = schoolNameInput.value.trim();
    classLine.textContent = classNameInput.value.trim();
    name.value = badge.name;
    name.addEventListener('input', () => { badges[index].name = name.value; });

    if (badge.qrDataUrl) {
      qr.src = badge.qrDataUrl;
      qr.title = badge.qrText ? 'QR detected successfully' : '';
    } else {
      qr.removeAttribute('src');
      qr.alt = 'QR code was not detected';
      card.style.borderColor = '#b42318';
    }

    if (logoDataUrl) {
      logo.src = logoDataUrl;
      logo.style.display = 'block';
    }
    badgeGrid.appendChild(node);
  });
}

async function exportPdf() {
  if (!badges.length || badges.some(b => !b.qrDataUrl)) return;
  statusEl.textContent = 'Building printable PDF locally…';

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageW = 612; // US Letter points
  const pageH = 792;
  const margin = 24;
  const cols = Number(cardsPerRow.value);
  const rows = cols === 3 ? 3 : 2;
  const gap = 12;
  const cardW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
  const cardH = (pageH - margin * 2 - gap * (rows - 1)) / rows;
  const perPage = cols * rows;

  let logoImage = null;
  if (logoDataUrl) logoImage = await embedDataUrl(pdf, logoDataUrl);

  for (let i = 0; i < badges.length; i++) {
    if (i % perPage === 0) pdf.addPage([pageW, pageH]);
    const page = pdf.getPages()[pdf.getPageCount() - 1];
    const pos = i % perPage;
    const col = pos % cols;
    const row = Math.floor(pos / cols);
    const x = margin + col * (cardW + gap);
    const y = pageH - margin - (row + 1) * cardH - row * gap;

    page.drawRectangle({ x, y, width: cardW, height: cardH, borderWidth: 1.2, borderColor: rgb(.14,.2,.28) });

    const school = schoolNameInput.value.trim();
    const classLine = classNameInput.value.trim();
    let top = y + cardH - 14;

    if (logoImage) {
      const maxW = cardW * .55, maxH = 28;
      const ratio = Math.min(maxW / logoImage.width, maxH / logoImage.height);
      const w = logoImage.width * ratio, h = logoImage.height * ratio;
      page.drawImage(logoImage, { x: x + (cardW - w) / 2, y: top - h, width: w, height: h });
      top -= h + 5;
    }

    if (school) {
      drawCentered(page, school, x, top - 10, cardW, 9, bold);
      top -= 17;
    }

    const qrImage = await embedDataUrl(pdf, badges[i].qrDataUrl);
    const qrSize = Math.min(cardW * .68, cardH * .48, 132);
    page.drawImage(qrImage, { x: x + (cardW - qrSize) / 2, y: top - qrSize, width: qrSize, height: qrSize });
    top -= qrSize + 16;

    drawCentered(page, fitText(badges[i].name, cardW - 16, 12, bold), x, top, cardW, 12, bold);
    top -= 18;
    if (classLine) drawCentered(page, fitText(classLine, cardW - 16, 9, font), x, top, cardW, 9, font);
  }

  const bytes = await pdf.save();
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'clever-badges-formatted.pdf');
  statusEl.textContent = `Exported ${badges.length} badge(s).`;
}

function drawCentered(page, text, x, y, width, size, font) {
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x + Math.max(5, (width - tw) / 2), y, size, font, color: rgb(.08,.12,.17) });
}

function fitText(text, maxWidth, size, font) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 3 && font.widthOfTextAtSize(t + '…', size) > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

async function embedDataUrl(pdf, dataUrl) {
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
  return dataUrl.startsWith('data:image/png') ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
