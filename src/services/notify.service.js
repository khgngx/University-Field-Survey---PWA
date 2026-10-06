import { LocalNotifications } from '@capacitor/local-notifications'

const MAX_NOTIFICATION_ID = 2_147_483_647 // Android notification ids are int32

// Ask once from a user gesture (e.g. pressing Submit); browsers refuse prompts otherwise.
// Resolves to whether notifications are allowed.
export async function requestNotificationPermission() {
  const { display } = await LocalNotifications.checkPermissions()
  if (display === 'granted') return true
  if (display === 'denied') return false
  return (await LocalNotifications.requestPermissions()).display === 'granted'
}

// Shows "synced N surveys" if permission was already granted; never prompts. Resolves to whether it was shown.
export async function notifySynced(count) {
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') return false
  await LocalNotifications.schedule({
    notifications: [
      {
        id: Date.now() % MAX_NOTIFICATION_ID,
        title: 'VKU Field Survey',
        body: `Đã đồng bộ thành công ${count} khảo sát`,
      },
    ],
  })
  return true
}
