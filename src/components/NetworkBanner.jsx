import { useNetworkStatus } from '../hooks/useNetworkStatus'

export default function NetworkBanner() {
  const connected = useNetworkStatus()
  if (connected) return null
  return (
    <div className="mx-auto max-w-2xl px-4 pt-4">
      <div role="status" className="rounded-2xl bg-amber-100 px-4 py-3 text-center text-sm font-medium text-amber-900">
        Đang offline — dữ liệu được lưu trên thiết bị và sẽ đồng bộ khi có mạng.
      </div>
    </div>
  )
}
