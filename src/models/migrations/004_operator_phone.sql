-- Migração: telefone do operador para notificações WhatsApp
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS operator_whatsapp VARCHAR(20) DEFAULT NULL;
-- Ex: 5511999998888 (DDI + DDD + número, sem + ou espaços)
