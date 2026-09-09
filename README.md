# Clever Badge Maker

Self-hosted browser application for importing Clever badge PDFs and reformatting the badges into custom printable cards.

## Privacy design

The imported PDF is processed by JavaScript in the user's browser. The application has no upload endpoint and no database. Student badge data is not intentionally sent to the server after the page itself loads.

## Start with Docker Compose

```bash
docker compose up -d --build
```

Open:

```text
http://YOUR-SERVER-IP:8088
```

## Current assumptions

Version 0.1 expects one Clever badge per PDF page with:
- QR code in the upper/middle portion
- student name beneath it

PDF text is extracted directly when available. The QR is cropped from the rendered page rather than regenerated.

## Next likely improvements

- automatic support for several badges per PDF page
- template editor
- class/group assignment
- CSV roster import
- Avery/card-stock templates
- saved local templates
