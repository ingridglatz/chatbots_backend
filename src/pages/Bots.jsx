import { useState } from 'react';
import { Plus, Loader } from 'lucide-react';
import BotCard from '../components/BotCard';
import Modal from '../components/Modal';
import { useBots } from '../hooks/useBots';
import toast from 'react-hot-toast';

export default function Bots() {
  const { bots, loading, createBot, updateBot, deleteBot } = useBots();
  const [openModal, setOpenModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    systemPrompt: '',
    welcomeMessage: '',
    tone: 'friendly',
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Nome do bot é obrigatório'); return; }
    try {
      setSubmitting(true);
      await createBot(form);
      setForm({ name: '', systemPrompt: '', welcomeMessage: '', tone: 'friendly' });
      setOpenModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao criar bot');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSubmitting(true);
      await deleteBot(selectedBotId);
      setDeleteModal(false);
      setSelectedBotId(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao deletar bot');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (botId, active) => {
    try {
      await updateBot(botId, { active });
    } catch (err) {
      toast.error('Erro ao atualizar bot');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Meus Bots</h2>
          <p className="text-sm text-gray-500 mt-1">{bots.length} bot(s) criado(s)</p>
        </div>
        <button onClick={() => setOpenModal(true)} className="btn-primary">
          <Plus size={18} />
          Novo Bot
        </button>
      </div>

      {bots.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Nenhum bot criado</h3>
          <p className="text-sm text-gray-500 mt-2 mb-6">Comece criando seu primeiro chatbot</p>
          <button onClick={() => setOpenModal(true)} className="btn-primary inline-flex">
            <Plus size={18} />
            Criar Bot
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onDelete={(id) => { setSelectedBotId(id); setDeleteModal(true); }}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Criar novo bot" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Nome do bot</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Assistente de Vendas"
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
            <label className="label">Prompt do sistema (opcional)</label>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              placeholder="Descreva como o bot deve se comportar..."
              rows="3"
              className="input resize-none"
            />
          </div>

          <div>
            <label className="label">Mensagem de boas-vindas (opcional)</label>
            <textarea
              value={form.welcomeMessage}
              onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
              placeholder="Ex: Olá! Como posso ajudá-lo?"
              rows="2"
              className="input resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setOpenModal(false)}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !form.name}
              className="btn-primary flex-1"
            >
              {submitting ? <Loader size={16} className="animate-spin" /> : 'Criar Bot'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Confirmar exclusão" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tem certeza que deseja deletar este bot? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteModal(false)}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={submitting}
              className="btn-danger flex-1"
            >
              {submitting ? <Loader size={16} className="animate-spin" /> : 'Deletar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
