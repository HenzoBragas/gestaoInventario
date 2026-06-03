# 📦 Sistema de Gestão de Inventário

Um sistema completo de controle de inventario desenvolvido com **Spring Boot**, **React** e **MySQL**, containerizado com Docker para fácil deployment e desenvolvimento.

---

## 🎯 Visão Geral

O **Sistema de Gestão de Inventário** centraliza o cadastro de produtos e categorias, oferecendo:

- ✅ Controle total de estoque em tempo real
- ✅ Painel com indicadores e estatísticas
- ✅ Interface intuitiva com dialogs para CRUD
- ✅ Banco de dados relacional com integridade referencial
- ✅ Arquitetura moderna e escalável

**Objetivo:** Eliminar a necessidade de planilhas ou scripts manuais, fornecendo uma plataforma centralizada para gerenciar produtos e seus estoques.

---
## 🔓 ** Acesso ao provedor da aplicação - Render
https://gestao-inventario-frontend.onrender.com/

### Usuário e senha

**Usuario: inventario**

**Senha: inventario123**

## 📦 Estrutura do Projeto
```
gestaoInventario/
│
├── backend/
│   ├── src/main/java/com/gestaoInvetario/
│   │   ├── application/
│   │   │   ├── controllers/
│   │   │   │   └── ProductController.java
│   │   │   ├── service/
│   │   │   │   └── ProductService.java
│   │   │   ├── model/
│   │   │   │   ├── Product.java       
│   │   │   │   └── Category.java
│   │   │   ├── repositories/
│   │   │   │   └── ProductRepository.java
│   │   │   └── dtos/
│   │   │       ├── ProductRequestDto.java
│   │   │       └── ProductResponseDto.java
│   │   └── application.properties
│   └── pom.xml
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── App.tsx
│   └── package.json
│
├── database/
│   └── init/
│       ├── 01-GestaoInventario.sql    # Criação de tabelas
│       └── 02-script_inventario.sql   # Dados iniciais
│
├── docker-compose.yml
└── README.md

```
---

## 🏗️ Arquitetura do Sistema
```
Fluxo Principal
┌─────────────────────────────────────────────────────────┐
│                   CLIENTE (Browser)                     │
│              React 19 + TanStack Router                 │
│               http://localhost:3000                     │     │                                                         │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ HTTP/REST
                        │ Axios
                        ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND - Spring Boot 3.4.5                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Controller Layer (ProductController)              │ │
│  │  Endpoints: GET, POST, PUT, DELETE                 │ │
│  └────────────────────────────────────────────────────┘ │
│                        ▲                                │
│                        │                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Service Layer (ProductService)                    │ │
│  │  - Lógica de negócio                               │ │
│  │  - Validações                                      │ │
│  │  - Conversão de DTOs                               │ │
│  └────────────────────────────────────────────────────┘ │
│                        ▲                                │
│                        │                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Repository Layer (ProductRepository)              │ │
│  │  - Spring Data JPA                                 │ │
│  │  - Operações CRUD                                  │ │
│  └────────────────────────────────────────────────────┘ │
│                         ▲                               │
│               http://localhost:8080                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ SQL/JDBC
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│         DATABASE - MySQL 8.0                            │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Tabela: produto                                   │ │
│  │  Tabela: categoria                                 │ │
│  │  Relacionamento: produto FK -> categoria           │ │
│  └────────────────────────────────────────────────────┘ │
│  localhost:3306                                         │
└─────────────────────────────────────────────────────────┘
```

## 📋 Modelo de Dados - Entidade Product

### Classe Product (Java)

```java
@Entity
@Table(name = "produto")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;                    // PK - Identificador único
    
    @Column(length = 20, nullable = false)
    private String code;                   // Código/SKU do produto
    
    @Column(length = 30, nullable = false)
    private String name;                   // Nome do produto
    
    @Column(length = 30, nullable = false)
    private String model;                  // Modelo/Variação
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "Categoria")        // FK para tabela categoria
    private Category category;              // Relacionamento com Categoria
    
    @Column(nullable = false)
    private Integer stock;                 // Quantidade em estoque
    
    @UpdateTimestamp
    @Column(nullable = false)
    private Date updatedAt;                // Data última atualização
}
```

### 🔍 Explicação dos Campos

| Campo | Tipo | Restrição | Descrição |
|-------|------|-----------|-----------|
| **id** | Integer | PK, AI | Identificador único do produto (auto-incrementado) |
| **code** | String(20) | NOT NULL, UNIQUE | Código/SKU único para identificar o produto rapidamente |
| **name** | String(30) | NOT NULL | Nome descritivo do produto |
| **model** | String(30) | NOT NULL | Modelo ou variação do produto |
| **category** | Category | FK, NOT NULL | Referência à categoria (relacionamento ManyToOne) |
| **stock** | Integer | NOT NULL | Quantidade disponível em estoque |
| **updatedAt** | Date | NOT NULL | Timestamp automático da última atualização |

### 📌 Relacionamentos

#### ManyToOne: Produto → Categoria

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "Categoria", nullable = false)
private Category category;
```

**O que significa:**
- **Muitos** produtos podem pertencer a **Uma** categoria
- `@JoinColumn` cria a coluna `Categoria` como chave estrangeira
- `FetchType.LAZY` carrega a categoria apenas quando acessada (melhor performance)
- `nullable = false` garante que todo produto tenha uma categoria

**Exemplo de dados:**

| id | code | name | model | category_id | stock | updatedAt |
|:--:|:----:|:----:|:-----:|:-----------:|:-----:|:---------:|
| 1 | SKU001 | Mouse | Óptico | 2 | 50 | 2025-05-28 |
| 2 | SKU002 | Teclado | Mecânico | 2 | 30 | 2025-05-28 |
| 3 | SKU003 | Monitor | LED | 3 | 15 | 2025-05-28 |





## 📊 Funcionalidades

### Dashboard
- Total de produtos cadastrados
- Total de categorias
- Produtos com baixo estoque
- Últimas atualizações

### Produtos
- Criar novo produto
- Editar nome, categoria, modelo e estoque
- Deletar produto
- Listar todos com filtros

### Categorias
- Criar categoria
- Editar nome
- Deletar categoria

# 🚀 Usando a aplicação

### Primeira vez

```bash
# 1. Abrir terminal na pasta do projeto
cd gestaoInventario

# 2. Subir tudo
docker compose up -d --build

# 3 Aguarda o container ser criado

#4 Verificar se container foi criado
docker ps

# 4.1 Se for criado e inicializado so prosseguir para proximo passo e houve algum erro apague o container e repetida o processo 
# 5. Abrir navegador
http://localhost:3000

```

### Próximas vezes

```bash
# 1. Subir
docker compose up -d

# 2. Usar
http://localhost:3000

# 3. Parar
docker compose down
```



## 🛠️ Stack Tecnológico

### **Backend**
- **Java 17** - Linguagem principal
- **Spring Boot 3.4.5** - Framework web
- **Spring Data JPA** - ORM e persistência
- **Lombok** - Reduz boilerplate (getters, setters, construtores)
- **Hibernate** - Provider JPA
- **Maven** - Gerenciador de dependências

### **Frontend**
- **React 19** - Framework UI
- **TypeScript** - Tipagem estática
- **TanStack Router** - Roteamento client-side
- **TanStack Table** - Tabelas complexas
- **Tailwind CSS** - Estilização
- **React Hook Form** - Formulários
- **Zod** - Validação de schema
- **Axios** - Cliente HTTP
- **Vite** - Build tool

### **Banco de Dados**
- **MySQL 8.0** - SGBD relacional
- **InnoDB** - Engine com suporte a transações

### **DevOps**
- **Docker** - Containerização
- **Docker Compose** - Orquestração local

---

### 👥 **Colaboradores**
- Bruno Araujo 
- Giovanny Lino
- Guilherme Carmo
- Henrique Biciato
- Henzo Bragas
- Kaue Righetti
