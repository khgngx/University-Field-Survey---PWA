import { parseRoomQr } from '../utils/roomQr'

// Resolves to { building, floor, room }, or null when the user dismisses the scanner.
// Rejects when the scanned code is not a room QR. Web: html5-qrcode; APK: native scanner.
export async function scanRoomQr() {
  // Loaded on demand: the web build bundles html5-qrcode, which most sessions never need.
  const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner')
  let result
  try {
    result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: 'Hướng camera vào mã QR dán ở phòng',
    })
  } catch (err) {
    if (/cancel/i.test(err?.message ?? '')) return null
    throw err
  }
  if (!result?.ScanResult) return null
  return parseRoomQr(result.ScanResult)
}
