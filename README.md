# Clever Badge Maker v0.3

A self-hosted, browser-local tool for importing Clever badge PDFs and creating custom printable badge layouts.

## Privacy
Imported student PDFs are processed locally in the user's browser. The app has no upload endpoint, database, analytics, or cloud processing.

## v0.3 features
- Multi-badge Clever PDF detection (up to 12 per page)
- Reuses the QR image extracted from Clever rather than regenerating it
- Student list with editable names
- Select all / select none / remove selected badges
- Master card designer
- Portrait, landscape, wide, square, or custom card dimensions
- Drag QR, student name, school name, logo, and class line around the master card
- Per-element size and visibility controls
- Master layout is used by the exported PDF
- Automatic packing onto US Letter sheets

## Docker
```bash
docker compose up -d --build
```

Default port: `8089`

Open `http://YOUR-SERVER-IP:8089`


## v0.5 additions

- Search/filter imported students by name.
- Drag any master-card element to reposition it.
- Resize every master-card element with its lower-right corner handle.
- Portrait, landscape, wide, and square shapes now load shape-specific default layouts.
- Choose a solid card background color.
- Add a local PNG/JPEG/WebP background image.
- Background color/image and master layout are reproduced in the exported PDF.
- Image processing remains local in the browser.


## v0.5
- Vertical and horizontal center snap guides in the master-card editor.
- Tightened QR cropping so the printed Clever student name beneath the QR is not included in the QR image.


## v0.5.1
- Shifted the existing QR crop upward by 2.5% of the crop size without changing its dimensions, to remove the last visible tops of student-name letters.

## v0.5.4
- Automatic readable complementary text colors based on the card background.
- Background images are sampled locally for an approximate brightness/color reference.
- School name, student name, and class line each support their own manual text-color override.


## v0.5.4 polish
- Subtle rounded corners on QR crops in the student list, master card, and exported PDF.
- Preview PDF button beside Export Printable PDF. Preview uses the exact same PDF generation path as export.


## v0.5.4
- Per-text-element drop shadows with enable/disable, color, and size controls.
- Shadows appear in the master-card editor and are rendered into PDF preview/export.
