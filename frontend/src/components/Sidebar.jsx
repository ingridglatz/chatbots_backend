import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Bot, Users, CreditCard, LogOut, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/bots', icon: Bot, label: 'Meus Bots' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/planos', icon: CreditCard, label: 'Planos' },
];

const PLAN_COLORS = {
  starter: 'bg-gray-100 text-gray-600',
  pro: 'bg-brand-100 text-brand-700',
  business: 'bg-purple-100 text-purple-700',
};

export default function Sidebar() {
  const { tenant, user, logout } = useAuth();
  return (
    <aside className="flex flex-col w-60 min-h-screen bg-white border-r border-gray-100">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-100">
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <span className="font-bold text-gray-900 text-lg tracking-tight">ChatBots</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => clsx('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors', isActive ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
            <Icon size={18} />{label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-100">
        {tenant && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-gray-900 truncate">{tenant.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            <span className={clsx('badge mt-1.5 capitalize', PLAN_COLORS[tenant.plan] || PLAN_COLORS.starter)}>{tenant.plan}</span>
          </div>
        )}
        <button onClick={logout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
          <LogOut size={18} />Sair
        </button>
      </div>
    </aside>
  );
}
