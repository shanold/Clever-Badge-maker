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
