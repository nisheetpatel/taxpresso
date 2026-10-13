// PDF text, barcode decoders (eCH-0270, eCH-0196, salary certificate), document classifier and
// broker exports (SPEC.md section 5). So far: the salary certificate and e-tax statement barcodes
// (5.1 to 5.3), broker exports (5.7), and reading one document for Claude's review (5.5), text by
// page or page images.
export * from './broker/index.js';
export * from './barcode/index.js';
export { downscale, encodePng, toGray, type RawImage } from './png.js';
export {
  imageForClaude,
  layoutText,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_CALL,
  MAX_PAGES_PER_CALL,
  MAX_TEXT_CHARS,
  readForReview,
  SCAN_MAX_EDGE,
  sniff,
  type ReviewFormat,
  type ReviewImage,
  type ReviewPage,
  type ReviewProblem,
  type ReviewResult,
} from './review.js';
