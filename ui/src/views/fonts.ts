// Geist and Geist Mono for the view inside the conversation, from the same bundled files as the
// browser page (SPEC.md 11b), embedded in the view by scripts/build-views.mjs. They are handed to
// the browser as bytes (FontFace), so they load even where the host's CSP allows no font source.
import FONTS from 'virtual:taxpresso-fonts';

function bytes(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

export function loadFonts(): void {
  if (typeof FontFace === 'undefined') return;
  for (const font of FONTS) {
    try {
      const face = new FontFace(font.family, bytes(font.data), {
        style: font.style,
        weight: font.weight,
        unicodeRange: font.range,
        display: 'swap',
      });
      document.fonts.add(face);
      void face.load().catch(() => undefined);
    } catch {
      // The system font stands in.
    }
  }
}
