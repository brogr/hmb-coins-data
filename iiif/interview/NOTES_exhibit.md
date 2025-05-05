# exhibit.so & IIIF

## supported

- `metadata`: shown as popup (info icon) at the bottom
- collections
- manual deep zoom: only on slides
- predefined deep zoom: on kiosk, scroll

## not supported

- `accompanyingCanvas` limits functionality, preventing otherwise supported features:
  - zoom with audio: due to `accompanyingCanvas`
  - multiple canvases per manifest: works without audio / `accompanyingCanvas`
- multiple items/images per canvas?
- `annotations`
  -- use metadata instead
