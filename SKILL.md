# Logo Retouch Skill

Retouch and process logo images locally using sharp. No external APIs — everything runs on your machine.

## Commands

### `/logo remove-bg`
Remove white/light background from a logo, making it transparent. Useful for logos saved with white backgrounds that need to work on colored surfaces.

**Parameters:**
- `input` (required): Path to the image file
- `output`: Output path (default: `<name>-transparent.png`)
- `threshold`: Whiteness threshold 0–255 (default: 230). Pixels where R, G, and B all exceed this value are made transparent. Use a lower value (e.g. 200) for off-white backgrounds.

### `/logo to-white`
Recolor all visible (non-transparent) pixels to pure white. Perfect for placing logos on dark backgrounds.

### `/logo to-black`
Recolor all visible (non-transparent) pixels to pure black. Perfect for placing logos on light backgrounds.

### `/logo to-color`
Recolor all visible pixels to any hex color. Useful for brand-color variants.

**Parameters:**
- `color` (required): Hex color like `#FF5500` or `FF5500`

### `/logo resize`
Resize a logo while preserving aspect ratio. Specify width, height, or a scale factor.

### `/logo pad`
Add padding around a logo. Padding is transparent by default, or set a background color.

### `/logo info`
Display image metadata: dimensions, format, channels, file size, whether it has an alpha channel.

### `/logo batch`
Run multiple operations in one go and output all variants. Example:
```
/logo batch --input logo.png --operations remove-bg,to-white,to-black,resize:200
```

## Tips
- Always run `remove-bg` first before `to-white` or `to-black` — the recolor commands operate on non-transparent pixels, so removing the background first gives clean results.
- The `batch` command automatically chains `remove-bg` first when included, then generates variants from the transparent version.
- Output is always PNG to preserve transparency.
