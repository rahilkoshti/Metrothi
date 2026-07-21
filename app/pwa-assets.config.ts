import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

// The source favicon is a transparent purple glyph. Transparent-background
// icons look fine as a standard/any icon, but a maskable icon is cropped to a
// circle/squircle by the OS, so it needs a solid background and safe-zone
// padding or the glyph gets clipped and floats on nothing. We fill the
// maskable background with the app's light theme-color and pad generously.
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
  images: ['public/favicon.svg'],
})
