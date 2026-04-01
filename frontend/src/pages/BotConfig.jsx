import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, Code, Eye, Loader, ArrowLeft, Save } from 'lucide-react';
import { botService } from '../services/api';
import toast from 'react-hot-toast';

export default function BotConfig() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('settings');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bot, setBot] = useState(null);
  const [form, setForm] = useState({
    name: '',
    systemPrompt: '',
    welcomeMessage: '',
    tone: 'friendly',
  });

  useEffect(() => {
    const fetchBot = async () => {
      try {
        const res = await botService.getById(id);
        const botData = res.data.data.bot;
        setBot(botData);
        setForm({
          name: botData.name,
          systemPrompt: botData.system_prompt || '',
          welcomeMessage: botData.welcome_message || '',
          tone: botData.tone || 'friendly',
        });
      } catch (err) {
        toast.error('Erro ao carregar bot');
        navigate('/bots');
      } finally {
        setLoading(false);
      }
    };
    fetchBot();
  }, [id, navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await botService.update(id, {
        name: form.name,
        systemPrompt: form.systemPrompt,
        welcomeMessage: form.welcomeMessage,
        tone: form.tone,
      });
      toast.success('Bot atualizado com sucesso!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao atualizar bot');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }

  const embedCode = `<script src="${window.location.origin}/widget.js" data-bot-id="${id}"></script>`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/bots')} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{form.name}</h1>
      </div>

      <div className="card">
        <div className="flex border-b border-gray-100">
          {[
            { id: 'settings', label: 'Configurações', icon: Settings },
            { id: 'install', label: 'Instalar Widget', icon: Code },
            { id: 'preview', label: 'Pré-visualizar', icon: Eye },
          ].map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === tabId ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'settings' && (
            <form onSubmit={handleUpdate} className="space-y-6 max-w-2xl">
              <div>
                <label className="label">Nome do bot</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Tom de conversa</label>
                <select
                  value={form.tone}
                  onChange={(e) => setForm({ ...form, tone: e.target.value })}
                  className="input"
                >
                  <option value="friendly">Amigável</option>
                  <option value="professional">Profissional</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                </select>
              </div>

              <div>
                <label className="label">Prompt do sistema</label>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  placeholder="Descreva como o bot deve se comportar..."
                  rows="5"
                  className="input resize-none"
                />
              </div>

              <div>
                <label className="label">Mensagem de boas-vindas</label>
                <textarea
                  value={form.welcomeMessage}
                  onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
                  placeholder="Mensagem exibida ao iniciar a conversa"
                  rows="3"
                  className="input resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? <Loader size={16} className="animate-spin" /> : <>
                  <Save size={16} />
                  Salvar alterações
                </>}
              </button>
            </form>
          )}

          {activeTab === 'install' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Código de instalação</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Copie o código abaixo e cole antes da tag de fechamento &lt;/body&gt; no seu website.
                </p>
                <div className="relative bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <code>{embedCode}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(embedCode);
                      toast.success('Código copiado!');
                    }}
                    className="absolute top-3 right-3 px-3 py-1 bg-brand-500 text-white text-xs rounded hover:bg-brand-600"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Instruções:</h4>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. Copie o código acima</li>
                  <li>2. Abra o HTML do seu website</li>
                  <li>3. Cole o código antes de &lt;/body&gt;</li>
                  <li>4. Salve e publique as alterações</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Pré-visualização do widget</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                  <p className="text-sm">A pré-visualização será exibida aqui quando integrado ao seu site</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  O widget aparecerá como um botão flutuante no canto inferior direito da sua página.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
