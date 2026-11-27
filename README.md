# 📦 Sistema de Gestão de Inventário

Sistema completo para gestão de estoque, produtos, movimentações e relatórios, desenvolvido com **Spring Boot**, **React** e **MySQL**. A aplicação foi expandida para atender operações mais completas de controle operacional, com autenticação, dashboard, cadastros e auditoria.

---

## 🎯 Visão Geral

O projeto centraliza as principais operações da área de inventário em uma plataforma web moderna, permitindo:

- ✅ Controle em tempo real do estoque
- ✅ Dashboard com indicadores operacionais
- ✅ Gestão de produtos, categorias, fornecedores e localizações
- ✅ Registro de entradas, saídas, ajustes e transferências
- ✅ Relatórios e visualização de movimentações
- ✅ Configurações de organização, usuários, permissões e preferências
- ✅ Autenticação por usuário com roles e acesso baseado em permissões
- ✅ Arquitetura pronta para uso local e em ambiente de produção

**Objetivo:** reduzir a dependência de planilhas e processos manuais, oferecendo uma solução centralizada para gestão de estoque e operações da empresa.

---

## 🔓 Acesso da aplicação

### Ambiente de demonstração

- URL: https://gestao-inventario-dsmachado.netlify.app/
- Usuário: `inventario`
- Senha: `inventario123`

---

## 📦 Estrutura do projeto

```text
gestaoInventario/
├── backend/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/gestaoInvetario/
│   │   │   │   ├── application/
│   │   │   │   ├── config/
│   │   │   │   ├── controllers/
│   │   │   │   ├── dtos/
│   │   │   │   ├── exception/
│   │   │   │   ├── model/
│   │   │   │   ├── repositories/
│   │   │   │   ├── security/
│   │   │   │   └── service/
│   │   │   └── resources/
│   │   └── test/
│   ├── pom.xml
│   └── mvnw
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── dashboard/
│   │   │   ├── inventory/
│   │   │   ├── movements/
│   │   │   ├── products/
│   │   │   ├── catalog/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── lib/
│   │   ├── routes/
│   │   └── styles.css
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── database/
│   └── init/
│       ├── GestaoInventario.sql
│       └── script_inventario.sql
├── docker-compose.yml
├── mysql-compose.yml
├── render.yaml
├── README.md
└── skills-lock.json
```

---

## 🧩 Funcionalidades atuais

### Dashboard operacional
- Indicadores de produtos ativos, unidades em estoque, valor estimado e alertas
- Gráficos de entradas e saídas por período
- Comparativo de movimentações e evolução do valor do inventário
- Produtos mais movimentados e atividades recentes
- Acesso rápido para ações de estoque e movimentação

### Inventário
- Consulta do saldo atual dos produtos
- Filtros por categoria, status, localizações e busca por texto
- Visualização de produtos com baixo estoque e sem estoque
- Controle de posições de estoque por item e por local

### Movimentações
- Registro de entradas, saídas, ajustes e transferências
- Histórico completo de movimentações
- Atualização automática do saldo do produto
- Visualização por período e por tipo de operação

### Produtos
- Cadastro de produtos com código, nome, categoria, custo, estoque e valor de referência
- Edição e exclusão de registros
- Pesquisa por produto e filtros de visualização
- Detalhamento do item e acesso a ações de movimentação

### Catálogo e cadastros auxiliares
- Categorias
- Fornecedores
- Localizações/armazéns
- Organização dos cadastros para manter o inventário consistente

### Relatórios e análise
- Visão geral do desempenho do estoque
- Acompanhamento do valor do inventário
- Comparativo de séries temporais
- Exportação útil para acompanhamento e análise

### Configurações e governança
- Organização: nome da empresa, moeda, timezone, unidades e estoque mínimo padrão
- Preferências: tema, idioma e aparência da aplicação
- Notificações e conta do usuário
- Gestão de usuários e perfis
- Permissões por papel
- Auditoria de eventos e ações no sistema

### Segurança e acesso
- Login com autenticação via API
- Controle de acesso baseado em permissões
- Fluxo protegido por rota privada e sessão autenticada

### Integração com marketplaces (Mercado Livre e Shopee)
- Vendas pagas nos marketplaces dão baixa automática no estoque, de forma **assíncrona**
- O SKU do anúncio é associado ao código (SKU) do produto no sistema
- Baixa registrada como movimentação de saída, com referência do pedido (ex.: `Mercado Livre #2000001234`)
- Retirada primeiro da localização padrão do produto e, se faltar, das demais localizações
- Pedido nunca é baixado duas vezes, mesmo com notificações repetidas ou simultâneas
- Tudo ou nada: SKU desconhecido ou saldo insuficiente deixam o pedido em falha, sem baixa parcial
- Novas tentativas automáticas com intervalo crescente e reprocessamento manual por gerentes
- Modo de simulação para testar sem conta nem anúncio ativo

---

## 🛒 Integração com marketplaces

### Como funciona

```text
Mercado Livre / Shopee
        │  webhook (POST)
        ▼
/integrations/webhooks/{mercadolivre|shopee}  ──► grava o pedido na fila (tabela pedido_marketplace)
        │                                         e responde 200 imediatamente
        ▼  (assíncrono, após o commit)
Worker ──► consulta o pedido na API do marketplace
        ├─ pago ...................... baixa o estoque e marca DONE (na mesma transação)
        ├─ aguardando pagamento ...... IGNORED (reabre quando chegar nova notificação)
        ├─ cancelado ................. IGNORED
        └─ erro (SKU, saldo, API) .... FAILED, com nova tentativa agendada
```

- **Mercado Livre:** a notificação (tópico `orders_v2`) traz só o id do pedido. O pedido completo é sempre lido na API autenticada, então uma notificação forjada não consegue baixar estoque. Notificações de outro vendedor são descartadas.
- **Shopee:** o push é validado pela assinatura HMAC-SHA256 (`Authorization`) com a partner key.
- **Tokens OAuth** são renovados automaticamente e salvos no banco (tabela `token_marketplace`), pois o refresh token é de uso único nas duas plataformas.
- Uma varredura periódica (a cada 30 s) refaz as tentativas que falharam e retoma pedidos interrompidos por reinício do servidor.

### Status do pedido

| Status | Significado |
|---|---|
| `PENDING` | Recebido, aguardando o worker |
| `PROCESSING` | Em processamento |
| `DONE` | Estoque baixado |
| `FAILED` | Falhou; nova tentativa agendada ou reprocessamento manual |
| `IGNORED` | Não pago ou cancelado; nada a baixar |

### Endpoints

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/integrations/webhooks/mercadolivre` | público | Notificações do Mercado Livre |
| `POST` | `/integrations/webhooks/shopee` | público (assinado) | Push da Shopee |
| `GET` | `/integrations/orders?status=FAILED` | Gerente/Admin | Lista os pedidos recebidos |
| `POST` | `/integrations/orders/{id}/retry` | Gerente/Admin | Reprocessa um pedido com falha |
| `POST` | `/integrations/simulate/{mercadolivre\|shopee}` | Gerente/Admin | Simula uma venda (só com simulação ligada) |

### Configuração

Cada marketplace vem **desligado** por padrão. As variáveis já são repassadas ao backend pelo `docker-compose.yml`:

| Variável | Descrição |
|---|---|
| `ML_ENABLED` | `true` para ativar o Mercado Livre |
| `ML_CLIENT_ID` / `ML_CLIENT_SECRET` | Credenciais do aplicativo no Mercado Livre |
| `ML_REFRESH_TOKEN` | Refresh token inicial obtido no fluxo OAuth (depois é renovado e salvo no banco) |
| `ML_SELLER_ID` | Id do vendedor; notificações de outros vendedores são ignoradas |
| `SHOPEE_ENABLED` | `true` para ativar a Shopee |
| `SHOPEE_API_URL` | Padrão `https://partner.shopeemobile.com` (sandbox: `https://partner.test-stable.shopeemobile.com`) |
| `SHOPEE_PARTNER_ID` / `SHOPEE_PARTNER_KEY` | Credenciais do Shopee Open Platform |
| `SHOPEE_SHOP_ID` | Id da loja |
| `SHOPEE_REFRESH_TOKEN` | Refresh token inicial da loja |
| `SHOPEE_PUSH_URL` | URL pública **exata** cadastrada para o push (faz parte da assinatura) |
| `MARKETPLACE_SIMULATION` | `true` liga o modo de simulação (somente desenvolvimento) |

Também é preciso:
1. Cadastrar o **SKU do anúncio** igual ao código do produto no sistema (`seller_sku` no Mercado Livre; `model_sku` ou `item_sku` na Shopee). A comparação ignora maiúsculas/minúsculas.
2. Cadastrar a URL pública dos webhooks no painel de cada marketplace (no Mercado Livre, ativar o tópico `orders_v2`). Para testar localmente, use um túnel como ngrok ou Cloudflare Tunnel apontando para a porta `8080`.

### Testando sem conta nem anúncio (modo de simulação)

```bash
MARKETPLACE_SIMULATION=true docker compose up -d --build
```

Com login de Gerente/Admin:

```http
POST /integrations/simulate/mercadolivre
Authorization: Bearer <token>
Content-Type: application/json

{ "orderId": "PED123", "state": "PAID", "items": [ { "sku": "5950", "quantity": 2 } ] }
```

- `state`: `PAID` (padrão), `AWAITING_PAYMENT` ou `CANCELLED`. Para simular a mudança de status, envie de novo o mesmo `orderId`.
- `"notify": false` só registra o pedido; o processamento é disparado pelo webhook real, como o marketplace faria.
- O pedido passa pela mesma fila, worker e baixa das vendas reais; só a consulta à API do marketplace é substituída. Os pedidos simulados ficam em memória e somem ao reiniciar o backend.
- Em produção (`MARKETPLACE_SIMULATION` desligado) o endpoint responde `404`.

### Testes automatizados

```bash
cd backend
./mvnw clean test
```

`MarketplaceIntegrationTest` cobre o fluxo completo (webhook → fila → worker → baixa), incluindo idempotência, notificações simultâneas, SKU desconhecido, saldo insuficiente, assinatura da Shopee e retirada entre localizações. `MarketplaceParsingTest` cobre a leitura das respostas das APIs.

---

## 🏗️ Arquitetura do sistema

```text
Cliente (React + Vite)
        │
        │ HTTP/REST
        ▼
Backend (Spring Boot + Java 17) ◄── webhooks ── Mercado Livre / Shopee
        │                       └── worker assíncrono ──► APIs dos marketplaces
        │ JPA / Repository / Service
        ▼
Banco de dados (PostgreSQL 16)
```

A aplicação usa uma arquitetura em camadas:

- Frontend com interface moderna e navegação por rotas
- Backend com controllers, serviços e repositórios
- Persistência com PostgreSQL e relacionamento entre entidades de negócio
- Autenticação e autorização para garantir acesso por perfil
- Integração com marketplaces por webhooks e processamento assíncrono com fila no banco

---

## 🚀 Como executar localmente

### Primeira vez

```bash
# 1. Entrar na pasta do projeto
cd gestaoInventario

# 2. Subir os containers
docker compose up -d --build

# 3. Verificar se os serviços iniciaram
docker ps

# 4. Acessar a aplicação no navegador
http://localhost:3000
```

### Próximas vezes

```bash
docker compose up -d
```

### Para parar os serviços

```bash
docker compose down
```

> O frontend fica disponível na porta `3000`, o backend em `8080` e o banco PostgreSQL em `5432`.

---

## 🛠️ Stack tecnológico

### Backend
- **Java 17**
- **Spring Boot 3.4.5**
- **Spring Data JPA**
- **Hibernate**
- **Maven**
- **Spring Security**

### Frontend
- **React 19**
- **TypeScript**
- **Vite**
- **TanStack Router**
- **React Hook Form**
- **Zod**
- **Tailwind CSS**
- **Axios**
- **Shadcn UI / Componentes reutilizáveis**

### Banco de dados
- **PostgreSQL 16**

### Infraestrutura
- **Docker**
- **Docker Compose**
- **Render** (deploy da aplicação de demonstração)

---

## 🔮 Futuras implementações

### Autenticação e segurança
- Melhorias no fluxo de login com autenticação mais robusta e tokens com expiração controlada
- Controle granular de permissões por módulo e perfil de usuário
- Recuperação de senha, autenticação multifator e logs de acesso
- Expansão da camada de segurança para ambientes de produção

### Integração com marketplaces (próximos passos)
- Tela no frontend para acompanhar e reprocessar os pedidos recebidos
- Devolução automática ao estoque quando um pedido já baixado for cancelado ou devolvido
- Fluxo OAuth pela própria aplicação para conectar as contas (hoje o refresh token inicial é configurado por variável)
- Suporte a várias contas/lojas por marketplace e criptografia dos tokens armazenados
- Envio do saldo do sistema para os anúncios (sincronização no sentido inverso)
- Centralização de pedidos, faturamento e estoque entre canais de venda

### Visão estratégica
- Conexão da plataforma com ERP e canais de e-commerce
- Padronização de integrações para escalar a gestão de inventário com múltiplos marketplaces
- Dashboard específico para performance de vendas e logística

---

## 👥 Colaboradores

- Bruno Araujo
- Giovanny Lino
- Guilherme Carmo
- Henrique Biciato
- Henzo Bragas
- Kaue Righetti

---

