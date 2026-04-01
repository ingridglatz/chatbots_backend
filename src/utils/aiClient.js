const Anthropic = require("@anthropic-ai/sdk");
const { decrypt } = require("./crypto");
const logger = require("./logger");

const clientCache = new Map();

const getAIClient = (tenant) => {
  const useCustom =
    tenant.ai_provider === "custom" && tenant.anthropic_api_key_enc;

  if (useCustom) {
    const cacheKey = `custom:${tenant.id}`;
    if (!clientCache.has(cacheKey)) {
      const apiKey = decrypt(tenant.anthropic_api_key_enc);
      if (!apiKey) {
        logger.warn(
          "Falha ao descriptografar chave do tenant, usando chave da plataforma",
          { tenantId: tenant.id },
        );
        return getPlatformClient(tenant);
      }
      clientCache.set(cacheKey, new Anthropic({ apiKey }));
      setTimeout(() => clientCache.delete(cacheKey), 60 * 60 * 1000);
    }
    return {
      client: clientCache.get(cacheKey),
      model: tenant.ai_model || "claude-sonnet-4-6",
      usingCustomKey: true,
    };
  }

  return getPlatformClient(tenant);
};

const getPlatformClient = (tenant) => {
  if (!clientCache.has("platform")) {
    clientCache.set(
      "platform",
      new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    );
  }
  return {
    client: clientCache.get("platform"),
    model: tenant.ai_model || "claude-sonnet-4-6",
    usingCustomKey: false,
  };
};

const invalidateTenantCache = (tenantId) => {
  clientCache.delete(`custom:${tenantId}`);
};

module.exports = { getAIClient, invalidateTenantCache };
