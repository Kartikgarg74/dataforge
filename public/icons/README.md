# App Icons

## Source
The master icon is `icon.svg`. Generate PNG icons at all required sizes from this SVG.

## Required Sizes
Generate these PNG files from `icon.svg`:

```bash
# Using ImageMagick (brew install imagemagick)
for size in 72 96 128 144 152 192 384 512; do
  convert icon.svg -resize ${size}x${size} icon-${size}x${size}.png
done

# Apple Touch Icon
convert icon.svg -resize 180x180 apple-touch-icon.png

# Favicon
convert icon.svg -resize 32x32 favicon-32x32.png
convert icon.svg -resize 16x16 favicon-16x16.png
```

## Files Needed
- `icon-72x72.png` — Android small
- `icon-96x96.png` — Android medium
- `icon-128x128.png` — Android large
- `icon-144x144.png` — Android x-large
- `icon-152x152.png` — iPad
- `icon-192x192.png` — PWA standard
- `icon-384x384.png` — PWA large
- `icon-512x512.png` — PWA splash / App Store
- `apple-touch-icon.png` — iOS home screen (180x180)

## Splash Screens (for Capacitor)
Generate splash images for iOS device sizes:
- `splash-2048x2732.png` — iPad Pro 12.9"
- `splash-1668x2388.png` — iPad Pro 11"
- `splash-1290x2796.png` — iPhone 15 Pro Max
- `splash-1179x2556.png` — iPhone 15 Pro
- `splash-1170x2532.png` — iPhone 15
