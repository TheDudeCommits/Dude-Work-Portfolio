# Dude.Work — Living Ink Portfolio

An original, responsive portfolio for Dude.Work. It preserves the interaction language of the Liam Bennet reference—full-canvas desktop previews, a compact project index, editorial work pages, a full-screen menu, masonry About page, and sparse Contact page—then redraws the entire experience in the established Dude.work Japanese sumi-e system.

## Included

- Ten supplied project artworks, optimized to WebP for delivery
- Desktop hover-to-preview index with image parallax and ink-wash reveals
- Mobile two-column project atlas
- Animated full-screen navigation
- Responsive project routes under `/work/:slug`
- Editorial About and Contact routes
- Kozo washi material, Living Ink font, monochrome pigment treatment, and restrained vermilion state marks
- Reduced-motion support, keyboard focus states, and semantic page structure

## Local development

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run lint
npm run build
```

## Notes

The contact form is intentionally backend-free: it prepares an email draft through `mailto:hello@dude.work`. Replace that address or wire a form provider before treating it as a server-delivered contact channel.

The project imagery and Living Ink assets are project-owned/user-supplied material. Shippori Mincho is provided through Fontsource.
