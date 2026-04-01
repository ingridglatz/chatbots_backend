-- Migração: histórico de conversas e modo operador

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  phone VARCHAR(50) NOT NULL,
  contact_name VARCHAR(255) DEFAULT '',
  status VARCHAR(20) DEFAULT 'bot',
  -- 'bot'     → bot respondendo normalmente
  -- 'waiting' → cliente pediu atendente, aguardando operador
  -- 'human'   → operador assumiu o controle
  -- 'closed'  → conversa encerrada
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bot_id, phone)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  -- 'user'     → mensagem do cliente
  -- 'assistant'→ resposta do bot
  -- 'operator' → mensagem enviada pelo operador
  -- 'system'   → mensagem do sistema (ex: "transferindo para atendente")
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campos de configuração de atendimento humano nos bots
ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS human_transfer_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS human_transfer_phrases TEXT DEFAULT 'atendente,humano,pessoa,falar com alguem,falar com alguém,quero atendimento,suporte humano',
  ADD COLUMN IF NOT EXISTS human_transfer_message TEXT DEFAULT 'Entendido! 👋 Estou transferindo você para um atendente humano. Aguarde um momento, em breve alguém irá te atender.';

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_bot_id ON conversations(bot_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
