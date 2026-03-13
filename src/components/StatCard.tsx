interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  color?: string
  icon?: string
}

export default function StatCard({ title, value, subtitle, color = "blue", icon }: StatCardProps) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-500 bg-blue-50",
    green: "border-green-500 bg-green-50",
    red: "border-red-500 bg-red-50",
    yellow: "border-yellow-500 bg-yellow-50",
    purple: "border-purple-500 bg-purple-50",
  }

  return (
    <div className={`rounded-lg border-l-4 p-4 shadow-sm ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase font-semibold">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {icon && <span className="text-3xl opacity-50">{icon}</span>}
      </div>
    </div>
  )
}
