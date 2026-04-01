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
Recolor all visible (non-transparent) pixels to pure white. Use `--preserve-alpha` for smooth anti-aliased edges.

### `/logo to-black`
Recolor all visible (non-transparent) pixels to pure black. Use `--preserve-alpha` for smooth anti-aliased edges.

### `/logo to-color`
Recolor all visible pixels to any hex color. Use `--preserve-alpha` for smooth anti-aliased edges.

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

## Common Parameters

All recolor commands (`to-white`, `to-black`, `to-color`) accept:
- `input` (required): Path to the image file
- `output`: Output path (auto-generated if omitted — saved next to the input file)
- `--preserve-alpha`: When set, maps the original pixel luminance into the alpha channel so anti-aliased edges blend smoothly against any background. **Always use this flag** unless the user explicitly asks for flat/hard-edged recoloring.

## Recommended Workflow by Target Background

**IMPORTANT:** The recolor direction depends on the background the logo will be placed on.

### Logo for a dark background (dark website, dark slide, dark UI)
1. `/logo remove-bg` — strip the white/light background
2. `/logo to-white --preserve-alpha` — recolor to white with smooth edges

The logo becomes white with anti-aliased transparency, so it looks clean on any dark surface.

### Logo for a light/white background (white website, light slide, print)
1. `/logo remove-bg` — strip the white/light background
2. `/logo to-black --preserve-alpha` — recolor to black with smooth edges

The logo becomes black with anti-aliased transparency, so it looks clean on any light surface.

### Logo for a colored background
1. `/logo remove-bg` — strip the white/light background
2. `/logo to-color --color <hex> --preserve-alpha` — recolor to a specific color with smooth edges

Pick a color that contrasts well with the target background. For example, white (`#FFFFFF`) on dark blue, or navy (`#102060`) on light gray.

### Transparent logo (keep original colors)
1. `/logo remove-bg` — that's it. The original colors are preserved, only the background is removed.

Use this when the logo already has the right colors and you just need the background gone.

## Tips
- Always run `remove-bg` first before `to-white`, `to-black`, or `to-color` — the recolor commands operate on non-transparent pixels, so removing the background first gives clean results.
- **Always use `--preserve-alpha`** on recolor commands unless the user specifically asks for flat/hard-edged output. Smooth edges look dramatically better.
- The `batch` command automatically chains `remove-bg` first when included, then generates variants from the transparent version.
- Output is always PNG to preserve transparency.
- Output files are saved next to the input file by default. Do not override with `/tmp/` or other locations — keep outputs in the same directory as the input so they stay in the working directory.
- When the user asks to "retouch a logo," always ask what background it will be placed on before choosing `to-white` vs `to-black` vs `to-color`.
