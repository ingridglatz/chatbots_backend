import clsx from 'clsx';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'brand', trend }) {
  const colorMap = {
    brand: { bg: 'bg-brand-50', icon: 'text-brand-500', ring: 'ring-brand-100' },
    green: { bg: 'bg-green-50', icon: 'text-green-500', ring: 'ring-green-100' },
    yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-500', ring: 'ring-yellow-100' },
    red: { bg: 'bg-red-50', icon: 'text-red-500', ring: 'ring-red-100' },
  };
  const c = colorMap[color] || colorMap.brand;
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={clsx('p-3 rounded-xl ring-1', c.bg, c.ring)}>
        <Icon size={20} className={c.icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value ?? '—'}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        {trend !== undefined && <p className={clsx('text-xs font-medium mt-1', trend >= 0 ? 'text-green-600' : 'text-red-500')}>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs mês anterior</p>}
      </div>
    </div>
  );
}
