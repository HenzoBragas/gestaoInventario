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

- URL: https://gestao-inventario-frontend.onrender.com/
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

---

## 🏗️ Arquitetura do sistema

```text
Cliente (React + Vite)
        │
        │ HTTP/REST
        ▼
Backend (Spring Boot + Java 17)
        │
        │ JPA / Repository / Service
        ▼
Banco de dados (MySQL 8)
```

A aplicação usa uma arquitetura em camadas:

- Frontend com interface moderna e navegação por rotas
- Backend com controllers, serviços e repositórios
- Persistência com MySQL e relacionamento entre entidades de negócio
- Autenticação e autorização para garantir acesso por perfil

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

> O frontend fica disponível na porta `3000`, o backend em `8080` e o banco MySQL em `3306`.

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
- **MySQL 8.0**

### Infraestrutura
- **Docker**
- **Docker Compose**
- **Render** (deploy da aplicação de demonstração)

---

## � Futuras implementações

### Autenticação e segurança
- Melhorias no fluxo de login com autenticação mais robusta e tokens com expiração controlada
- Controle granular de permissões por módulo e perfil de usuário
- Recuperação de senha, autenticação multifator e logs de acesso
- Expansão da camada de segurança para ambientes de produção

### Integração com marketplaces
- Webhooks do Mercado Livre para sincronização de vendas, estoque e status de pedidos
- Webhooks da Shopee para atualização automática de produtos e pedidos
- Processamento assíncrono de eventos com fila e retry para garantir confiabilidade
- Centralização de pedidos, faturamento e estoque entre canais de venda

### Visão estratégica
- Conexão da plataforma com ERP e canais de e-commerce
- Padronização de integrações para escalar a gestão de inventário com múltiplos marketplaces
- Dashboard específico para performance de vendas e logística

---

## �👥 Colaboradores

- Bruno Araujo
- Giovanny Lino
- Guilherme Carmo
- Henrique Biciato
- Henzo Bragas
- Kaue Righetti

---

