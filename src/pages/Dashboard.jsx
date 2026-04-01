import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MessageSquare, Bot, TrendingUp, AlertCircle } from 'lucide-react';
import StatCard from '../components/StatCard';
import { useAuth } from '../hooks/useAuth';
import { billingService } from '../services/api';
import toast from 'react-hot-toast';

const chartData = [
  { day: 'Seg', messages: 120 },
  { day: 'Ter', messages: 210 },
  { day: 'Qua', messages: 150 },
  { day: 'Qui', messages: 280 },
  { day: 'Sex', messages: 190 },
  { day: 'Sab', messages: 90 },
  { day: 'Dom', messages: 50 },
];

export default function Dashboard() {
  const { tenant } = useAuth();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await billingService.getUsage();
        setUsage(res.data.data);
      } catch (err) {
        toast.error('Erro ao carregar dados de uso');
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
  }, []);

  const botsUsage = usage ? (usage.botsUsed / (usage.botLimit || 10)) * 100 : 0;
  const messagesUsage = usage ? (usage.messagesUsed / (usage.messageLimit || 500)) * 100 : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 h-24 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Bots criados"
          value={usage?.botsUsed || 0}
          subtitle={`de ${usage?.botLimit || 'ilimitados'}`}
          icon={Bot}
          color="brand"
          trend={15}
        />
        <StatCard
          title="Mensagens este mês"
          value={usage?.messagesUsed || 0}
          subtitle={`de ${usage?.messageLimit || 'ilimitadas'}`}
          icon={MessageSquare}
          color="green"
          trend={32}
        />
        <StatCard
          title="Plano atual"
          value={tenant?.plan?.charAt(0).toUpperCase() + tenant?.plan?.slice(1)}
          subtitle={tenant?.plan === 'starter' ? 'Plano básico' : tenant?.plan === 'pro' ? 'Plano profissional' : 'Plano empresarial'}
          icon={TrendingUp}
          color="yellow"
        />
      </div>

      {messagesUsage >= 80 && (
        <div className="card p-4 bg-yellow-50 border-l-4 border-yellow-400 flex items-start gap-3">
          <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-800">Aproximando do limite</h3>
            <p className="text-sm text-yellow-700">Você está usando {messagesUsage.toFixed(0)}% do seu limite mensal de mensagens.</p>
          </div>
        </div>
      )}

      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Atividade da semana</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="day" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }} />
            <Line type="monotone" dataKey="messages" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Uso de bots</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{usage?.botsUsed} de {usage?.botLimit || 'ilimitado'}</span>
              <span className="text-brand-600 font-medium">{botsUsage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-brand-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(botsUsage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Uso de mensagens</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{usage?.messagesUsed} de {usage?.messageLimit || 'ilimitado'}</span>
              <span className={`font-medium ${messagesUsage >= 80 ? 'text-red-600' : 'text-green-600'}`}>
                {messagesUsage.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${messagesUsage >= 80 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(messagesUsage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
