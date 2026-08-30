import QRCode from 'qrcode';
import type { ErrorCorrectionLevel, QrMatrix } from './types';

/**
 * Encode `text` as a QR symbol at the given error-correction level.
 *
 * The returned matrix contains no quiet zone; it is exactly the symbol.
 */
export function generateQrMatrix(text: string, level: ErrorCorrectionLevel): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: level });

  return {
    size: qr.modules.size,
    version: qr.version,
    level,
    // Copy so downstream carving never mutates the encoder's buffer.
    modules: Uint8Array.from(qr.modules.data),
  };
}
