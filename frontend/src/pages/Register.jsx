import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Building2, Loader, Zap, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const SEGMENTS = [
  { id: 'restaurant', label: 'Restaurante', emoji: '🍔' },
  { id: 'health', label: 'Saúde', emoji: '⚕️' },
  { id: 'ecommerce', label: 'E-commerce', emoji: '🛍️' },
  { id: 'services', label: 'Serviços', emoji: '🔧' },
  { id: 'other', label: 'Outro', emoji: '⚙️' },
];

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    segment: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateStep1 = () => {
    if (!form.name || !form.email || !form.password) {
      toast.error('Preencha todos os campos');
      return false;
    }
    if (form.password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!form.companyName || !form.segment) {
      toast.error('Preencha todos os campos');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;
    try {
      setLoading(true);
      await register(form);
      toast.success('Conta criada com sucesso!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8 space-y-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-brand-500 rounded-lg flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">ChatBots</h1>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 1 ? 'Criar conta' : 'Informações da empresa'}
            </h2>
            <p className="text-sm text-gray-500">
              {step === 1 ? 'Etapa 1 de 2' : 'Etapa 2 de 2'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              <>
                <div>
                  <label className="label">Nome completo</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Seu nome"
                      className="input pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">E-mail</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="seu@email.com"
                      className="input pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Senha</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="input pl-9"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Nome da empresa</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      name="companyName"
                      value={form.companyName}
                      onChange={handleChange}
                      placeholder="Sua empresa"
                      className="input pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Segmento</label>
                  <div className="grid grid-cols-2 gap-3">
                    {SEGMENTS.map((seg) => (
                      <label key={seg.id} className="relative flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="segment"
                          value={seg.id}
                          checked={form.segment === seg.id}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        <div className={`w-full p-3 rounded-lg border-2 text-center transition-all ${form.segment === seg.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                          <div className="text-lg">{seg.emoji}</div>
                          <div className="text-xs font-medium text-gray-700 mt-1">{seg.label}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-secondary flex-1"
                >
                  <ChevronLeft size={16} />
                  Voltar
                </button>
              )}

              {step === 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1()) setStep(2);
                  }}
                  className="btn-primary flex-1 ml-auto"
                >
                  Próximo <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1"
                >
                  {loading ? <Loader size={16} className="animate-spin" /> : 'Criar conta'}
                </button>
              )}
            </div>
          </form>

          <div className="border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-600 text-center">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-brand-600 font-medium hover:text-brand-700">
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
