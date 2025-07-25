# exhibit.so & IIIF

## supported

- `metadata`: shown as popup (info icon) at the bottom
- collections
- manual deep zoom: only on slides
- predefined deep zoom: on kiosk, scroll

## not supported

- `accompanyingCanvas` limits functionality, preventing otherwise supported features:
  - zoom with audio: due to `accompanyingCanvas`
    - [ ] try cheating it by: remove accompanyingCanvas, add item in exhibit, set zoom, re-add accompanyingCanvas
  - multiple canvases per manifest: works without audio / `accompanyingCanvas`
- multiple items/images per canvas?
- `annotations`
  -- use metadata instead
- BG setting for text-area only
- mobile scroll
