import { useNetworkStatus } from '../hooks/useNetworkStatus'

export default function NetworkBanner() {
  const connected = useNetworkStatus()
  if (connected) return null
  return (
    <div role="status" className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
      Đang offline — dữ liệu được lưu trên thiết bị và sẽ đồng bộ khi có mạng.
    </div>
  )
}
