import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const PAGE_TITLES = { '/dashboard': 'Dashboard', '/bots': 'Meus Bots', '/clientes': 'Clientes', '/planos': 'Planos & Assinatura' };

export default function Header() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const title = PAGE_TITLES[pathname] || (pathname.startsWith('/bots/') ? 'Configurar Bot' : 'ChatBots');
  const initials = user?.email?.slice(0, 2).toUpperCase() || 'CB';
  return (
    <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-100">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full" />
        </button>
        <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center">
          <span className="text-xs font-bold text-white">{initials}</span>
        </div>
      </div>
    </header>
  );
}
