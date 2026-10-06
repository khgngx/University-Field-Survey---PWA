import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { compressImage } from '../utils/image'

// Resolves to a compressed JPEG Blob, or null when the user dismisses the camera.
// Web: backed by @ionic/pwa-elements; APK: native camera.
export async function takePhoto() {
  let photo
  try {
    photo = await Camera.getPhoto({
      quality: 90,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      correctOrientation: true,
    })
  } catch (err) {
    if (/cancel/i.test(err?.message ?? '')) return null
    throw err
  }
  if (!photo.webPath) throw new Error('Camera returned no image path')
  const response = await fetch(photo.webPath)
  if (!response.ok) throw new Error(`Could not read captured photo (HTTP ${response.status})`)
  return compressImage(await response.blob())
}
