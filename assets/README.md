# Asset Icons

This folder contains the tray icons for Zwift Voice Control.

## Icon Files

- `icon.svg` - Inactive state (gray microphone)
- `icon-listening.svg` - Active/listening state (orange microphone with sound waves)

## Converting to PNG

For the Electron tray, you need PNG versions of these icons. On macOS, you can convert using:

```bash
# Using sips (built into macOS)
sips -s format png icon.svg --out icon.png
sips -s format png icon-listening.svg --out icon-listening.png

# Or using ImageMagick if installed
convert icon.svg -resize 64x64 icon.png
convert icon-listening.svg -resize 64x64 icon-listening.png

# For @2x Retina versions (recommended)
convert icon.svg -resize 128x128 icon@2x.png
convert icon-listening.svg -resize 128x128 icon-listening@2x.png
```

## macOS App Icon (icns)

For distribution, create an `.icns` file:

```bash
# Create iconset folder
mkdir icon.iconset

# Generate all required sizes
sips -z 16 16     icon.svg --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.svg --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.svg --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.svg --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.svg --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.svg --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.svg --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.svg --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.svg --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.svg --out icon.iconset/icon_512x512@2x.png

# Convert to icns
iconutil -c icns icon.iconset
```

## Tray Icon Guidelines

- macOS tray icons should be 16x16 or 18x18 (with @2x versions)
- Use template images (monochrome) for automatic dark/light mode support
- The app will mark icons as template images for proper menu bar appearance

## Color Palette

- Inactive: Gray (#666666)
- Active: Zwift Orange (#fc6719)
- Background: Dark (#1a1a2e)
- Border: (#3d3d5c)
- Success/Listening indicator: Green (#4ade80)
