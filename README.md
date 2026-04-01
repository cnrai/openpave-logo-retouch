# openpave-logo-retouch

A PAVE executable skill for retouching logos — remove backgrounds, recolor to white/black/any color, resize, pad, and batch-process.

Powered by [sharp](https://sharp.pixelplumbing.com/). Runs entirely locally — no external APIs.

## Commands

| Command | Description |
|---------|-------------|
| `/logo remove-bg` | Remove white/light background → transparent |
| `/logo to-white` | Recolor all visible pixels to white |
| `/logo to-black` | Recolor all visible pixels to black |
| `/logo to-color` | Recolor to any hex color |
| `/logo resize` | Resize by width, height, or scale factor |
| `/logo pad` | Add padding around the logo |
| `/logo info` | Show image metadata |
| `/logo batch` | Run multiple operations at once |

## Install

```bash
pave install cnrai/openpave-logo-retouch
```

## Examples

```bash
# Remove white background
/logo remove-bg --input ./logo.png

# Make a white version for dark backgrounds
/logo to-white --input ./logo-transparent.png

# Batch: remove bg + create white + black + resize to 200px wide
/logo batch --input ./logo.png --operations remove-bg,to-white,to-black,resize:200
```

## License

MIT
