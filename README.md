# ChatBots 🤖

Plataforma SaaS multi-tenant para criação e gestão de chatbots com IA para pequenas empresas. Integração com WhatsApp, widget embeddable e painel administrativo completo.

---

## Funcionalidades

- **Multi-tenant** — cada empresa tem seus dados isolados
- **Chatbot com IA** — respostas geradas pelo Claude (Anthropic)
- **Integração WhatsApp** — via Evolution API
- **Widget embeddable** — adicione o chat em qualquer site com uma linha de código
- **Painel administrativo** — crie e gerencie bots sem conhecimento técnico
- **Planos e assinaturas** — integração com Stripe (Starter, Pro, Business)
- **Histórico de conversas** — armazenado em Redis com persistência
- **Autenticação JWT** — com controle de papéis (owner, admin, viewer)

---

## Stack

| Camada | Tecnologias |
|--------|-------------|
| Backend | Node.js, Express, PostgreSQL, Redis |
| IA | Anthropic Claude (`claude-sonnet-4-6`) |
| Frontend | React 18, Vite, Tailwind CSS, React Router v6 |
| Pagamentos | Stripe |
| WhatsApp | Evolution API |
| Auth | JWT + bcrypt |

---

## Estrutura do Projeto

```
chatbots/
├── backend/          # API Gateway + serviços
│   ├── src/
│   │   ├── gateway/  # Middlewares e roteamento
│   │   ├── models/   # PostgreSQL e Redis
│   │   ├── services/ # Chat, Tenant, Billing
│   │   ├── webhooks/ # Stripe e WhatsApp
│   │   └── utils/    # Logger, AppError, response helpers
│   └── server.js
├── frontend/         # Painel administrativo React
│   └── src/
│       ├── pages/    # Login, Dashboard, Bots, Planos...
│       ├── components/
│       ├── hooks/
│       └── services/
└── widget/           # Widget embeddable (vanilla JS)
```

---

## Pré-requisitos

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Conta na [Anthropic](https://console.anthropic.com)
- Conta no [Stripe](https://stripe.com) (opcional para pagamentos)
- [Evolution API](https://doc.evolution-api.com) (opcional para WhatsApp)

---

## Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/chatbots.git
cd chatbots
```

### 2. Configure o backend

```bash
cd backend
npm install
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/chatbots
REDIS_URL=redis://localhost:6379
JWT_SECRET=sua-chave-secreta
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Configure o frontend

```bash
cd ../frontend
npm install
```

Crie um `.env` na pasta frontend:

```env
VITE_API_URL=http://localhost:3000/api
```

### 4. Crie o banco de dados

```bash
createdb chatbots
```

---

## Rodando o projeto

```bash
# Backend (porta 3000)
cd backend
npm run dev

# Frontend (porta 5173)
cd frontend
npm run dev
```

Acesse: [http://localhost:5173](http://localhost:5173)

---

## Widget

Adicione o chatbot em qualquer site:

```html
<script
  src="https://seu-dominio.com/widget.js"
  data-bot-id="SEU_BOT_ID"
  data-api-url="https://seu-dominio.com/api"
  data-color="#6366f1"
  data-position="right">
</script>
```

---

## Planos

| Plano | Preço | Bots | Mensagens/mês |
|-------|-------|------|----------------|
| Starter | R$ 97/mês | 1 | 1.000 |
| Pro | R$ 247/mês | 5 | 10.000 |
| Business | R$ 497/mês | Ilimitado | Ilimitado |

---

## Licença

MIT
