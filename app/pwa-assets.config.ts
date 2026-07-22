import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

// Rasters are generated from icon-source.svg, not favicon.svg: the brand glyph
// is monochrome near-black, so on a transparent icon it disappears against a
// dark launcher or a dark browser tab strip. icon-source.svg carries its own
// opaque background. (Note a `background` in resizeOptions can't fix this — it
// only fills padding, it doesn't flatten the source's alpha.)
//
// favicon.svg stays transparent and flips to a light glyph via a
// prefers-color-scheme rule, which browsers honour and rasterisers ignore.
//
// The maskable icon is additionally cropped to a circle/squircle by the OS, so
// it needs generous safe-zone padding or the glyph gets clipped.
const preset = minimal2023Preset

preset.maskable.padding = 0.4
preset.maskable.resizeOptions = {
  ...preset.maskable.resizeOptions,
  background: '#f4f4f5',
  fit: 'contain',
}
preset.apple.padding = 0.35
preset.apple.resizeOptions = {
  ...preset.apple.resizeOptions,
  background: '#f4f4f5',
  fit: 'contain',
}

export default defineConfig({
  preset,
  images: ['public/icon-source.svg'],
})
