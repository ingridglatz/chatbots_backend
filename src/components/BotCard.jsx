import { useNavigate } from 'react-router-dom';
import { Settings, Trash2, ToggleLeft, ToggleRight, Bot, Copy, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const TONE_LABELS = {
  friendly: { label: 'Amigável', color: 'bg-green-100 text-green-700' },
  professional: { label: 'Profissional', color: 'bg-blue-100 text-blue-700' },
  casual: { label: 'Casual', color: 'bg-yellow-100 text-yellow-700' },
  formal: { label: 'Formal', color: 'bg-gray-100 text-gray-700' },
};

export default function BotCard({ bot, onDelete, onToggle }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const tone = TONE_LABELS[bot.tone] || TONE_LABELS.friendly;
  const embedCode = `<script src="${window.location.origin}/widget.js" data-bot-id="${bot.id}"></script>`;
  const copyEmbed = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className={clsx('card p-5 flex flex-col gap-4 transition-opacity', !bot.active && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bot size={20} className="text-brand-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">{bot.name}</h3>
            <span className={clsx('badge mt-1', tone.color)}>{tone.label}</span>
          </div>
        </div>
        <button onClick={() => onToggle(bot.id, !bot.active)} className="text-gray-400 hover:text-brand-500 transition-colors mt-0.5" title={bot.active ? 'Desativar' : 'Ativar'}>
          {bot.active ? <ToggleRight size={24} className="text-brand-500" /> : <ToggleLeft size={24} />}
        </button>
      </div>
      <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2 overflow-hidden">
        <code className="text-xs text-gray-500 truncate flex-1 select-all">{embedCode}</code>
        <button onClick={copyEmbed} className="text-gray-400 hover:text-brand-500 flex-shrink-0 transition-colors">
          {copied ? <CheckCheck size={15} className="text-green-500" /> : <Copy size={15} />}
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => navigate(`/bots/${bot.id}`)} className="btn-secondary flex-1 text-xs py-1.5"><Settings size={14} />Configurar</button>
        <button onClick={() => onDelete(bot.id)} className="btn-danger text-xs py-1.5 px-3" title="Excluir bot"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
