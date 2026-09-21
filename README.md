<div align="center">

<img
  width="100%"
  src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:050505,45:191106,100:F5B301&text=Sistema%20de%20Gest%C3%A3o%20do%20Z%C3%A9&fontColor=FFFFFF&fontSize=38&fontAlignY=38&desc=Do%20pedido%20do%20cliente%20%C3%A0%20gest%C3%A3o%20da%20opera%C3%A7%C3%A3o.&descAlignY=58&animation=fadeIn"
/>

<img
  src="https://readme-typing-svg.demolab.com?font=Montserrat&weight=700&size=20&duration=2600&pause=800&color=F5B301&center=true&vCenter=true&width=950&lines=Cat%C3%A1logo+%E2%86%92+Carrinho+%E2%86%92+Checkout+%E2%86%92+Gest%C3%A3o;Cliente+e+opera%C3%A7%C3%A3o+conectados+em+um+%C3%BAnico+sistema;Tecnologia+aplicada+a+um+neg%C3%B3cio+real"
  alt="Sistema de Gestão do Zé"
/>

<br>

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)

</div>

---

## 🍺 Sobre o projeto

O **Sistema de Gestão do Zé** foi desenvolvido para digitalizar a experiência de compra e apoiar a operação do **Depósito do Zé**.

A aplicação conecta dois lados do negócio:

<table>
<tr>
<td width="50%" valign="top">

### 👤 Cliente

Navega pelo catálogo, encontra promoções, monta o carrinho, informa os dados de entrega, escolhe a forma de pagamento e finaliza o pedido.

</td>

<td width="50%" valign="top">

### 🧑‍💼 Administração

Centraliza pedidos, produtos, categorias, estoque, clientes e informações importantes para a operação do estabelecimento.

</td>
</tr>
</table>

> **Mais do que um catálogo online: uma solução criada para um negócio real.**

---

# 📱 Experiência do cliente

<div align="center">

<img src="./public/readme/cliente-home.png" width="205" alt="Página inicial" />
<img src="./public/readme/cliente-catalogo.png" width="205" alt="Catálogo" />
<img src="./public/readme/cliente-carrinho.png" width="205" alt="Carrinho" />
<img src="./public/readme/cliente-checkout.png" width="205" alt="Checkout" />

</div>

<br>

A jornada foi construída com foco principalmente em **dispositivos móveis**, utilizando uma identidade visual própria para tornar a experiência de compra simples e direta.

### ✨ Recursos para o cliente

`🔎 Busca de produtos`
&nbsp;
`🔥 Promoções`
&nbsp;
`🛒 Carrinho`

`📍 Entrega`
&nbsp;
`💳 Pagamento`
&nbsp;
`✅ Finalização`

O checkout permite trabalhar com diferentes formas de pagamento, endereço de entrega e regras específicas do negócio.

---

# 🖥️ Painel administrativo

O sistema também possui uma área exclusiva para a operação do Depósito do Zé.

## 🔐 Área administrativa

<div align="center">

<img
  src="./public/readme/admin-login.png"
  width="850"
  alt="Tela de acesso ao painel administrativo"
/>

</div>

<br>

O acesso administrativo possui uma interface separada da experiência do cliente, mantendo a operação centralizada em um ambiente próprio.

---

## ⚡ Central de gestão

<div align="center">

<img
  src="./public/readme/admin-dashboard.png"
  width="100%"
  alt="Dashboard administrativo do Depósito do Zé"
/>

</div>

<br>

O painel reúne os principais setores da operação:

| Área | Objetivo |
|---|---|
| 📊 **Dashboard** | visão geral da operação |
| 📦 **Pedidos** | acompanhamento dos pedidos |
| 🏷️ **Produtos** | gerenciamento do catálogo |
| 🗂️ **Categorias** | organização dos produtos |
| 📦 **Estoque** | acompanhamento de disponibilidade |
| 👥 **Clientes** | organização da base de clientes |

O dashboard também concentra informações operacionais como **pedidos recebidos, faturamento, ticket médio e status do sistema**, além da estrutura para alertas de novos pedidos.

---

# ⚙️ Como o sistema funciona

```mermaid
flowchart LR
    A["👤 Cliente"] --> B["📱 Catálogo"]
    B --> C["🛒 Carrinho"]
    C --> D["📍 Checkout"]
    D --> E["💳 Pagamento"]
    E --> F["⚙️ API"]
    F --> G[("☁️ Supabase")]
    G --> H["📥 Pedido"]
    H --> I["🖥️ Painel Admin"]
    I --> J["🔄 Gestão"]
    J --> K["🚚 Operação"]
```

---

# 🚀 Principais funcionalidades

<table>
<tr>

<td width="50%" valign="top">

### 👤 Cliente

- catálogo digital
- busca de produtos
- promoções e destaques
- carrinho interativo
- controle de quantidade
- checkout em etapas
- dados do cliente
- endereço de entrega
- seleção de bairro
- PIX
- cartão na entrega
- dinheiro na entrega
- experiência responsiva

</td>

<td width="50%" valign="top">

### 🧑‍💼 Administração

- área administrativa
- dashboard operacional
- acompanhamento de pedidos
- atualização de status
- gerenciamento de produtos
- categorias
- controle de estoque
- área de clientes
- indicadores operacionais
- alertas de novos pedidos

</td>

</tr>
</table>

---

# 🧾 Jornada do pedido

```text
PRODUTO
   ↓
CARRINHO
   ↓
DADOS DO CLIENTE
   ↓
LOCAL DE ENTREGA
   ↓
FORMA DE PAGAMENTO
   ↓
RESUMO DO PEDIDO
   ↓
PEDIDO REGISTRADO
   ↓
PAINEL ADMINISTRATIVO
```

---

# 🛠️ Tecnologias

<div align="center">

| Tecnologia | Utilização |
|---|---|
| **Next.js** | aplicação, páginas, rotas e APIs |
| **React** | componentes e interface |
| **TypeScript** | tipagem e segurança |
| **Tailwind CSS** | design e responsividade |
| **Supabase** | banco de dados e persistência |
| **React Context** | gerenciamento do carrinho |
| **Git & GitHub** | versionamento |

</div>

---

# 🧠 O desafio

O projeto não foi criado apenas como exercício de desenvolvimento.

Ele nasceu para trabalhar problemas reais de uma operação comercial:

- reduzir processos manuais;
- organizar pedidos;
- facilitar compras pelo celular;
- centralizar informações;
- melhorar a experiência do cliente;
- apoiar a gestão do estabelecimento.

> **Software como ferramenta para melhorar um negócio real.**

---

# 🚧 Em evolução

```text
✅ Catálogo digital
✅ Promoções
✅ Carrinho
✅ Checkout
✅ Formas de pagamento
✅ Integração com banco de dados
✅ Painel administrativo
✅ Gestão de pedidos
✅ Produtos
✅ Categorias
✅ Estoque

🔄 CRM e métricas de clientes
🔄 Histórico de compras
🔄 Fidelidade
🔄 Impressão térmica
🔄 Automações operacionais
🔄 Evolução dos relatórios
```

---

# ▶️ Executando localmente

```bash
git clone https://github.com/CassianoCalian/sistema-gestao-delivery.git

cd sistema-gestao-delivery

npm install

npm run dev
```

---

<div align="center">

<img
  width="100%"
  src="https://capsule-render.vercel.app/api?type=waving&height=110&section=footer&color=0:F5B301,60:171007,100:050505"
/>

### 🍻 Mais agilidade. Mais controle. Mais experiência.

Desenvolvido por **Cassiano Calian**

[![GitHub](https://img.shields.io/badge/GitHub-CassianoCalian-181717?style=for-the-badge&logo=github)](https://github.com/CassianoCalian)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Cassiano_Calian-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/cassianocalian/)

</div>
