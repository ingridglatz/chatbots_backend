-- Migração: chave de API por tenant e suporte a múltiplos providers de IA

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50) DEFAULT 'platform',
  -- 'platform' → usa a chave da plataforma (cobrado no plano)
  -- 'custom'   → usa a própria chave do tenant

  ADD COLUMN IF NOT EXISTS anthropic_api_key_enc TEXT DEFAULT NULL,
  -- Chave Anthropic do tenant, armazenada criptografada

  ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100) DEFAULT 'claude-sonnet-4-6';
  -- Modelo de IA escolhido pelo tenant
