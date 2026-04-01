import { useState, useEffect, useCallback } from 'react';
import { botService } from '../services/api';
import toast from 'react-hot-toast';

export const useBots = () => {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBots = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res = await botService.list();
      setBots(res.data.data.bots || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao carregar bots');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  const createBot = useCallback(async (data) => {
    const res = await botService.create(data);
    toast.success('Bot criado com sucesso!');
    await fetchBots();
    return res.data.data;
  }, [fetchBots]);

  const updateBot = useCallback(async (id, data) => {
    await botService.update(id, data);
    toast.success('Bot atualizado!');
    await fetchBots();
  }, [fetchBots]);

  const deleteBot = useCallback(async (id) => {
    await botService.delete(id);
    toast.success('Bot removido.');
    await fetchBots();
  }, [fetchBots]);

  return { bots, loading, error, refetch: fetchBots, createBot, updateBot, deleteBot };
};
