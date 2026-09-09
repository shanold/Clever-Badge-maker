import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { BrowserQRCodeReader } from '@zxing/browser';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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
      const badge = await processPage(await pdf.getPage(pageNo), pageNo);
      badges.push(badge);
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
  const scale = 2.3;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  await page.render({ canvasContext: ctx, viewport }).promise;

  const name = await extractLikelyName(page);
  let qrDataUrl = null;
  let qrText = null;

  try {
    const result = await qrReader.decodeFromCanvas(canvas);
    qrText = result.getText();
    qrDataUrl = cropQr(canvas, result.getResultPoints?.() || []);
  } catch (err) {
    console.warn(`No QR found on page ${pageNo}`, err);
  }

  return { pageNo, name: name || `Student ${pageNo}`, qrDataUrl, qrText };
}

async function extractLikelyName(page) {
  const content = await page.getTextContent();
  const items = content.items
    .filter(i => typeof i.str === 'string' && i.str.trim())
    .map(i => ({ text: i.str.trim(), y: i.transform?.[5] ?? 0, size: Math.abs(i.transform?.[0] ?? 0) }))
    .filter(i => !/clever/i.test(i.text));

  if (!items.length) return '';

  // Clever badge pages generally contain little text; favor human-name-looking text,
  // then larger text, then text lower on the page.
  const candidates = items.filter(i => /^[\p{L}][\p{L}'’.-]+(?:\s+[\p{L}][\p{L}'’.-]+)+$/u.test(i.text));
  const pool = candidates.length ? candidates : items;
  pool.sort((a, b) => (b.size - a.size) || (a.y - b.y));
  return pool[0].text;
}

function cropQr(canvas, points) {
  let cx = canvas.width / 2;
  let cy = canvas.height / 2;
  let size = Math.min(canvas.width, canvas.height) * 0.45;

  if (points.length >= 2) {
    const xs = points.map(p => p.getX ? p.getX() : p.x);
    const ys = points.map(p => p.getY ? p.getY() : p.y);
    cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    let maxDist = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = xs[i] - xs[j];
        const dy = ys[i] - ys[j];
        maxDist = Math.max(maxDist, Math.hypot(dx, dy));
      }
    }
    size = Math.max(120, maxDist * 1.55);
  }

  const pad = size * 0.14;
  const side = Math.min(Math.ceil(size + pad * 2), canvas.width, canvas.height);
  const sx = Math.max(0, Math.min(canvas.width - side, Math.round(cx - side / 2)));
  const sy = Math.max(0, Math.min(canvas.height - side, Math.round(cy - side / 2)));

  const out = document.createElement('canvas');
  out.width = side;
  out.height = side;
  const octx = out.getContext('2d');
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, side, side);
  octx.drawImage(canvas, sx, sy, side, side, 0, 0, side, side);
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
