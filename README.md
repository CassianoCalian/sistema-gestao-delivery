<div align="center">

<img
  src="./public/logo-deposito-ze.png"
  width="190"
  alt="Logo do Depósito do Zé"
/>

# 🍻 Sistema de Gestão do Zé

### Pedido rápido para o cliente. Controle completo para a operação.

<img
  src="https://readme-typing-svg.demolab.com?font=Montserrat&weight=800&size=22&duration=2300&pause=850&color=FFB800&center=true&vCenter=true&width=900&lines=ABRIU.+ESCOLHEU.+PEDIU.+CHEGOU.;CATALOGO+%E2%86%92+CARRINHO+%E2%86%92+CHECKOUT;PEDIDO+%E2%86%92+PAINEL+%E2%86%92+OPERACAO;TECNOLOGIA+NO+RITMO+DO+ZE"
  alt="Apresentação do Sistema de Gestão do Zé"
/>

<br><br>

![Cliente](https://img.shields.io/badge/CLIENTE-CATÁLOGO%20•%20CARRINHO%20•%20CHECKOUT-FFB800?style=for-the-badge&labelColor=111111)
![Operação](https://img.shields.io/badge/OPERAÇÃO-PEDIDOS%20•%20ESTOQUE%20•%20CLIENTES-22C55E?style=for-the-badge&labelColor=111111)
![Status](https://img.shields.io/badge/SISTEMA-ONLINE-00D084?style=for-the-badge&labelColor=111111)

<br><br>

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)

</div>

---

## 🍺 Sobre o projeto

O **Sistema de Gestão do Zé** foi desenvolvido para digitalizar a experiência de compra e apoiar a operação do **Depósito do Zé**.

A solução conecta duas pontas do negócio:

<table>
<tr>

<td width="50%" valign="top">

### 👤 Experiência do cliente

O cliente navega pelo catálogo, encontra promoções, adiciona produtos ao carrinho, informa seus dados, endereço e forma de pagamento até concluir o pedido.

</td>

<td width="50%" valign="top">

### 🧑‍💼 Gestão da operação

A equipe utiliza um painel administrativo próprio para acompanhar pedidos, produtos, categorias, estoque, clientes e indicadores importantes do negócio.

</td>

</tr>
</table>

> **Mais do que um catálogo online: uma solução digital criada para um negócio real.**

---

# 🍺 Vitrine digital

A experiência do cliente foi criada com foco em **mobile**, velocidade e facilidade na hora de comprar.

<div align="center">

<img
  src="./public/readme/home.png"
  width="245"
  alt="Página inicial do Depósito do Zé"
/>

<img
  src="./public/readme/catalogo.png"
  width="245"
  alt="Catálogo do Depósito do Zé"
/>

<img
  src="./public/readme/carrinho.png"
  width="245"
  alt="Carrinho de compras"
/>

</div>

<br>

### ⚡ Uma jornada simples

```text
🔎 ENCONTRAR
      ↓
🍺 ESCOLHER
      ↓
🛒 ADICIONAR
      ↓
📦 REVISAR
      ↓
💳 FINALIZAR
```

### O cliente encontra

`🔥 Promoções`
&nbsp;&nbsp;
`🔎 Busca`
&nbsp;&nbsp;
`🛒 Carrinho`
&nbsp;&nbsp;
`📱 Mobile First`

---

# 🧾 Checkout em etapas

O checkout foi dividido em etapas para deixar a finalização do pedido mais clara e reduzir atrito durante a compra.

<div align="center">

<img
  src="./public/readme/checkout-dados.png"
  width="245"
  alt="Dados do cliente"
/>

<img
  src="./public/readme/checkout-endereco.png"
  width="245"
  alt="Endereço de entrega"
/>

<img
  src="./public/readme/checkout-pagamento.png"
  width="245"
  alt="Forma de pagamento"
/>

</div>

<br>

```text
CARRINHO
   ↓
DADOS DO CLIENTE
   ↓
LOCAL DE ENTREGA
   ↓
FORMA DE PAGAMENTO
   ↓
RESUMO
   ↓
PEDIDO
```

### 💳 Formas de pagamento

- 🟢 **PIX**
- 💳 **Cartão na entrega**
- 💵 **Dinheiro na entrega**

O sistema também aplica regras específicas da operação, como **áreas de entrega, taxas e condições do pedido**.

---

# 🖥️ Balcão de controle

Enquanto o cliente compra pelo celular, a equipe acompanha a operação em uma interface completamente separada.

## 🔐 Área administrativa

<div align="center">

<img
  src="./public/readme/admin-login.png"
  width="900"
  alt="Login do painel administrativo do Depósito do Zé"
/>

</div>

<br>

O painel possui uma área de acesso própria, separando a experiência do cliente das ferramentas internas de gestão.

---

## ⚡ Central da operação

<div align="center">

<img
  src="./public/readme/admin-dashboard.png"
  width="100%"
  alt="Dashboard administrativo do Depósito do Zé"
/>

</div>

<br>

A central administrativa organiza os principais setores da operação:

| Área | Função |
|---|---|
| 📊 **Dashboard** | visão geral do negócio |
| 📦 **Pedidos** | acompanhamento da operação |
| 🏷️ **Produtos** | gerenciamento do catálogo |
| 🗂️ **Categorias** | organização dos produtos |
| 📦 **Estoque** | acompanhamento de disponibilidade |
| 👥 **Clientes** | base e relacionamento com clientes |

### 📡 Operação centralizada

O painel também foi estruturado para acompanhar:

`🔔 Novos pedidos`

`💰 Faturamento`

`📈 Ticket médio`

`🔄 Atualização automática`

`🟢 Status do sistema`

---

# ⚙️ Do pedido à operação

```mermaid
flowchart LR

    CLIENTE["👤 Cliente"]
    CATALOGO["🍺 Catálogo"]
    CARRINHO["🛒 Carrinho"]
    CHECKOUT["🧾 Checkout"]
    PAGAMENTO["💳 Pagamento"]
    API["⚙️ API"]
    BANCO[("☁️ Supabase")]
    PEDIDO["📥 Pedido"]
    ADMIN["🖥️ Painel Admin"]
    OPERACAO["🚚 Operação"]

    CLIENTE --> CATALOGO
    CATALOGO --> CARRINHO
    CARRINHO --> CHECKOUT
    CHECKOUT --> PAGAMENTO
    PAGAMENTO --> API
    API --> BANCO
    BANCO --> PEDIDO
    PEDIDO --> ADMIN
    ADMIN --> OPERACAO
```

---

# 🚀 Principais recursos

<table>
<tr>

<td width="50%" valign="top">

### 🍺 Para o cliente

- catálogo digital
- produtos em promoção
- busca de produtos
- carrinho interativo
- controle de quantidade
- checkout em etapas
- dados do cliente
- endereço de entrega
- seleção de bairro
- múltiplas formas de pagamento
- experiência responsiva

</td>

<td width="50%" valign="top">

### ⚙️ Para a gestão

- área administrativa
- dashboard operacional
- acompanhamento de pedidos
- atualização de status
- gerenciamento de produtos
- categorias
- estoque
- clientes
- indicadores do negócio
- alertas de novos pedidos

</td>

</tr>
</table>

---

# 🛠️ Tecnologias

<div align="center">

| Tecnologia | Uso no projeto |
|---|---|
| **Next.js** | aplicação, páginas, rotas e APIs |
| **React** | componentes e experiência de interface |
| **TypeScript** | tipagem e segurança |
| **Tailwind CSS** | design e responsividade |
| **Supabase** | banco de dados e persistência |
| **React Context** | gerenciamento do carrinho |
| **Git / GitHub** | versionamento |

</div>

---

# 🎯 Um projeto de cliente real

O sistema foi desenvolvido a partir das necessidades reais do **Depósito do Zé**.

O desafio não era apenas criar uma interface bonita.

Era necessário conectar:

```text
CLIENTE
   +
PEDIDO
   +
PAGAMENTO
   +
DADOS
   +
OPERAÇÃO
   +
GESTÃO
```

para tornar a experiência mais organizada tanto para quem compra quanto para quem administra.

### O projeto trabalha desafios como

- reduzir processos manuais;
- facilitar compras pelo celular;
- organizar pedidos;
- centralizar informações;
- melhorar a experiência do cliente;
- aplicar regras reais de negócio;
- apoiar a gestão do estabelecimento.

> **Código aplicado a um problema real.**

---

# 🚧 Evolução do sistema

```text
✅ Catálogo digital
✅ Promoções
✅ Carrinho
✅ Checkout
✅ Formas de pagamento
✅ Banco de dados
✅ Painel administrativo
✅ Gestão de pedidos
✅ Produtos
✅ Categorias
✅ Estoque
✅ Área de clientes

🔄 CRM e métricas de clientes
🔄 Histórico de compras
🔄 Fidelidade
🔄 Impressão térmica
🔄 Automações operacionais
🔄 Evolução dos relatórios
```

---

<div align="center">

## 🍻 Mais agilidade. Mais controle. Menos complicação.

**Sistema desenvolvido para o Depósito do Zé.**

<br>

### Da escolha da bebida à gestão do pedido.

**Uma solução digital aplicada a uma operação real.**

<br><br>

Desenvolvido por **Cassiano Calian**

<br><br>

[![GitHub](https://img.shields.io/badge/GitHub-CassianoCalian-181717?style=for-the-badge&logo=github)](https://github.com/CassianoCalian)

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Cassiano_Calian-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/cassianocalian/)

<br>

### 🍺 BEBIDA GELADA • PEDIDO RÁPIDO • GESTÃO ORGANIZADA

</div><div align="center">

<img
  src="./public/logo-deposito-ze.png"
  width="190"
  alt="Logo do Depósito do Zé"
/>

# 🍻 Sistema de Gestão do Zé

### Pedido rápido para o cliente. Controle completo para a operação.

<img
  src="https://readme-typing-svg.demolab.com?font=Montserrat&weight=800&size=22&duration=2300&pause=850&color=FFB800&center=true&vCenter=true&width=900&lines=ABRIU.+ESCOLHEU.+PEDIU.+CHEGOU.;CATALOGO+%E2%86%92+CARRINHO+%E2%86%92+CHECKOUT;PEDIDO+%E2%86%92+PAINEL+%E2%86%92+OPERACAO;TECNOLOGIA+NO+RITMO+DO+ZE"
  alt="Apresentação do Sistema de Gestão do Zé"
/>

<br><br>

![Cliente](https://img.shields.io/badge/CLIENTE-CATÁLOGO%20•%20CARRINHO%20•%20CHECKOUT-FFB800?style=for-the-badge&labelColor=111111)
![Operação](https://img.shields.io/badge/OPERAÇÃO-PEDIDOS%20•%20ESTOQUE%20•%20CLIENTES-22C55E?style=for-the-badge&labelColor=111111)
![Status](https://img.shields.io/badge/SISTEMA-ONLINE-00D084?style=for-the-badge&labelColor=111111)

<br><br>

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)

</div>

---

## 🍺 Sobre o projeto

O **Sistema de Gestão do Zé** foi desenvolvido para digitalizar a experiência de compra e apoiar a operação do **Depósito do Zé**.

A solução conecta duas pontas do negócio:

<table>
<tr>

<td width="50%" valign="top">

### 👤 Experiência do cliente

O cliente navega pelo catálogo, encontra promoções, adiciona produtos ao carrinho, informa seus dados, endereço e forma de pagamento até concluir o pedido.

</td>

<td width="50%" valign="top">

### 🧑‍💼 Gestão da operação

A equipe utiliza um painel administrativo próprio para acompanhar pedidos, produtos, categorias, estoque, clientes e indicadores importantes do negócio.

</td>

</tr>
</table>

> **Mais do que um catálogo online: uma solução digital criada para um negócio real.**

---

# 🍺 Vitrine digital

A experiência do cliente foi criada com foco em **mobile**, velocidade e facilidade na hora de comprar.

<div align="center">

<img
  src="./public/readme/home.png"
  width="245"
  alt="Página inicial do Depósito do Zé"
/>

<img
  src="./public/readme/catalogo.png"
  width="245"
  alt="Catálogo do Depósito do Zé"
/>

<img
  src="./public/readme/carrinho.png"
  width="245"
  alt="Carrinho de compras"
/>

</div>

<br>

### ⚡ Uma jornada simples

```text
🔎 ENCONTRAR
      ↓
🍺 ESCOLHER
      ↓
🛒 ADICIONAR
      ↓
📦 REVISAR
      ↓
💳 FINALIZAR
```

### O cliente encontra

`🔥 Promoções`
&nbsp;&nbsp;
`🔎 Busca`
&nbsp;&nbsp;
`🛒 Carrinho`
&nbsp;&nbsp;
`📱 Mobile First`

---

# 🧾 Checkout em etapas

O checkout foi dividido em etapas para deixar a finalização do pedido mais clara e reduzir atrito durante a compra.

<div align="center">

<img
  src="./public/readme/checkout-dados.png"
  width="245"
  alt="Dados do cliente"
/>

<img
  src="./public/readme/checkout-endereco.png"
  width="245"
  alt="Endereço de entrega"
/>

<img
  src="./public/readme/checkout-pagamento.png"
  width="245"
  alt="Forma de pagamento"
/>

</div>

<br>

```text
CARRINHO
   ↓
DADOS DO CLIENTE
   ↓
LOCAL DE ENTREGA
   ↓
FORMA DE PAGAMENTO
   ↓
RESUMO
   ↓
PEDIDO
```

### 💳 Formas de pagamento

- 🟢 **PIX**
- 💳 **Cartão na entrega**
- 💵 **Dinheiro na entrega**

O sistema também aplica regras específicas da operação, como **áreas de entrega, taxas e condições do pedido**.

---

# 🖥️ Balcão de controle

Enquanto o cliente compra pelo celular, a equipe acompanha a operação em uma interface completamente separada.

## 🔐 Área administrativa

<div align="center">

<img
  src="./public/readme/admin-login.png"
  width="900"
  alt="Login do painel administrativo do Depósito do Zé"
/>

</div>

<br>

O painel possui uma área de acesso própria, separando a experiência do cliente das ferramentas internas de gestão.

---

## ⚡ Central da operação

<div align="center">

<img
  src="./public/readme/admin-dashboard.png"
  width="100%"
  alt="Dashboard administrativo do Depósito do Zé"
/>

</div>

<br>

A central administrativa organiza os principais setores da operação:

| Área | Função |
|---|---|
| 📊 **Dashboard** | visão geral do negócio |
| 📦 **Pedidos** | acompanhamento da operação |
| 🏷️ **Produtos** | gerenciamento do catálogo |
| 🗂️ **Categorias** | organização dos produtos |
| 📦 **Estoque** | acompanhamento de disponibilidade |
| 👥 **Clientes** | base e relacionamento com clientes |

### 📡 Operação centralizada

O painel também foi estruturado para acompanhar:

`🔔 Novos pedidos`

`💰 Faturamento`

`📈 Ticket médio`

`🔄 Atualização automática`

`🟢 Status do sistema`

---

# ⚙️ Do pedido à operação

```mermaid
flowchart LR

    CLIENTE["👤 Cliente"]
    CATALOGO["🍺 Catálogo"]
    CARRINHO["🛒 Carrinho"]
    CHECKOUT["🧾 Checkout"]
    PAGAMENTO["💳 Pagamento"]
    API["⚙️ API"]
    BANCO[("☁️ Supabase")]
    PEDIDO["📥 Pedido"]
    ADMIN["🖥️ Painel Admin"]
    OPERACAO["🚚 Operação"]

    CLIENTE --> CATALOGO
    CATALOGO --> CARRINHO
    CARRINHO --> CHECKOUT
    CHECKOUT --> PAGAMENTO
    PAGAMENTO --> API
    API --> BANCO
    BANCO --> PEDIDO
    PEDIDO --> ADMIN
    ADMIN --> OPERACAO
```

---

# 🚀 Principais recursos

<table>
<tr>

<td width="50%" valign="top">

### 🍺 Para o cliente

- catálogo digital
- produtos em promoção
- busca de produtos
- carrinho interativo
- controle de quantidade
- checkout em etapas
- dados do cliente
- endereço de entrega
- seleção de bairro
- múltiplas formas de pagamento
- experiência responsiva

</td>

<td width="50%" valign="top">

### ⚙️ Para a gestão

- área administrativa
- dashboard operacional
- acompanhamento de pedidos
- atualização de status
- gerenciamento de produtos
- categorias
- estoque
- clientes
- indicadores do negócio
- alertas de novos pedidos

</td>

</tr>
</table>

---

# 🛠️ Tecnologias

<div align="center">

| Tecnologia | Uso no projeto |
|---|---|
| **Next.js** | aplicação, páginas, rotas e APIs |
| **React** | componentes e experiência de interface |
| **TypeScript** | tipagem e segurança |
| **Tailwind CSS** | design e responsividade |
| **Supabase** | banco de dados e persistência |
| **React Context** | gerenciamento do carrinho |
| **Git / GitHub** | versionamento |

</div>

---

# 🎯 Um projeto de cliente real

O sistema foi desenvolvido a partir das necessidades reais do **Depósito do Zé**.

O desafio não era apenas criar uma interface bonita.

Era necessário conectar:

```text
CLIENTE
   +
PEDIDO
   +
PAGAMENTO
   +
DADOS
   +
OPERAÇÃO
   +
GESTÃO
```

para tornar a experiência mais organizada tanto para quem compra quanto para quem administra.

### O projeto trabalha desafios como

- reduzir processos manuais;
- facilitar compras pelo celular;
- organizar pedidos;
- centralizar informações;
- melhorar a experiência do cliente;
- aplicar regras reais de negócio;
- apoiar a gestão do estabelecimento.

> **Código aplicado a um problema real.**

---

# 🚧 Evolução do sistema

```text
✅ Catálogo digital
✅ Promoções
✅ Carrinho
✅ Checkout
✅ Formas de pagamento
✅ Banco de dados
✅ Painel administrativo
✅ Gestão de pedidos
✅ Produtos
✅ Categorias
✅ Estoque
✅ Área de clientes

🔄 CRM e métricas de clientes
🔄 Histórico de compras
🔄 Fidelidade
🔄 Impressão térmica
🔄 Automações operacionais
🔄 Evolução dos relatórios
```

---

<div align="center">

## 🍻 Mais agilidade. Mais controle. Menos complicação.
<div align="center">

<img
  src="./public/logo-deposito-ze.png"
  width="190"
  alt="Logo do Depósito do Zé"
/>

# 🍻 Sistema de Gestão do Zé

### Pedido rápido para o cliente. Controle completo para a operação.

<img
  src="https://readme-typing-svg.demolab.com?font=Montserrat&weight=800&size=22&duration=2300&pause=850&color=FFB800&center=true&vCenter=true&width=900&lines=ABRIU.+ESCOLHEU.+PEDIU.+CHEGOU.;CATALOGO+%E2%86%92+CARRINHO+%E2%86%92+CHECKOUT;PEDIDO+%E2%86%92+PAINEL+%E2%86%92+OPERACAO;TECNOLOGIA+NO+RITMO+DO+ZE"
  alt="Apresentação do Sistema de Gestão do Zé"
/>

<br><br>

![Cliente](https://img.shields.io/badge/CLIENTE-CATÁLOGO%20•%20CARRINHO%20•%20CHECKOUT-FFB800?style=for-the-badge&labelColor=111111)
![Operação](https://img.shields.io/badge/OPERAÇÃO-PEDIDOS%20•%20ESTOQUE%20•%20CLIENTES-22C55E?style=for-the-badge&labelColor=111111)
![Status](https://img.shields.io/badge/SISTEMA-ONLINE-00D084?style=for-the-badge&labelColor=111111)

<br><br>

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)

</div>

---

## 🍺 Sobre o projeto

O **Sistema de Gestão do Zé** foi desenvolvido para digitalizar a experiência de compra e apoiar a operação do **Depósito do Zé**.

A solução conecta duas pontas do negócio:

<table>
<tr>

<td width="50%" valign="top">

### 👤 Experiência do cliente

O cliente navega pelo catálogo, encontra promoções, adiciona produtos ao carrinho, informa seus dados, endereço e forma de pagamento até concluir o pedido.

</td>

<td width="50%" valign="top">

### 🧑‍💼 Gestão da operação

A equipe utiliza um painel administrativo próprio para acompanhar pedidos, produtos, categorias, estoque, clientes e indicadores importantes do negócio.

</td>

</tr>
</table>

> **Mais do que um catálogo online: uma solução digital criada para um negócio real.**

---

# 🍺 Vitrine digital

A experiência do cliente foi criada com foco em **mobile**, velocidade e facilidade na hora de comprar.

<div align="center">

<img
  src="./public/readme/home.png"
  width="245"
  alt="Página inicial do Depósito do Zé"
/>

<img
  src="./public/readme/catalogo.png"
  width="245"
  alt="Catálogo do Depósito do Zé"
/>

<img
  src="./public/readme/carrinho.png"
  width="245"
  alt="Carrinho de compras"
/>

</div>

<br>

### ⚡ Uma jornada simples

```text
🔎 ENCONTRAR
      ↓
🍺 ESCOLHER
      ↓
🛒 ADICIONAR
      ↓
📦 REVISAR
      ↓
💳 FINALIZAR
```

### O cliente encontra

`🔥 Promoções`
&nbsp;&nbsp;
`🔎 Busca`
&nbsp;&nbsp;
`🛒 Carrinho`
&nbsp;&nbsp;
`📱 Mobile First`

---

# 🧾 Checkout em etapas

O checkout foi dividido em etapas para deixar a finalização do pedido mais clara e reduzir atrito durante a compra.

<div align="center">

<img
  src="./public/readme/checkout-dados.png"
  width="245"
  alt="Dados do cliente"
/>

<img
  src="./public/readme/checkout-endereco.png"
  width="245"
  alt="Endereço de entrega"
/>

<img
  src="./public/readme/checkout-pagamento.png"
  width="245"
  alt="Forma de pagamento"
/>

</div>

<br>

```text
CARRINHO
   ↓
DADOS DO CLIENTE
   ↓
LOCAL DE ENTREGA
   ↓
FORMA DE PAGAMENTO
   ↓
RESUMO
   ↓
PEDIDO
```

### 💳 Formas de pagamento

- 🟢 **PIX**
- 💳 **Cartão na entrega**
- 💵 **Dinheiro na entrega**

O sistema também aplica regras específicas da operação, como **áreas de entrega, taxas e condições do pedido**.

---

# 🖥️ Balcão de controle

Enquanto o cliente compra pelo celular, a equipe acompanha a operação em uma interface completamente separada.

## 🔐 Área administrativa

<div align="center">

<img
  src="./public/readme/admin-login.png"
  width="900"
  alt="Login do painel administrativo do Depósito do Zé"
/>

</div>

<br>

O painel possui uma área de acesso própria, separando a experiência do cliente das ferramentas internas de gestão.

---

## ⚡ Central da operação

<div align="center">

<img
  src="./public/readme/admin-dashboard.png"
  width="100%"
  alt="Dashboard administrativo do Depósito do Zé"
/>

</div>

<br>

A central administrativa organiza os principais setores da operação:

| Área | Função |
|---|---|
| 📊 **Dashboard** | visão geral do negócio |
| 📦 **Pedidos** | acompanhamento da operação |
| 🏷️ **Produtos** | gerenciamento do catálogo |
| 🗂️ **Categorias** | organização dos produtos |
| 📦 **Estoque** | acompanhamento de disponibilidade |
| 👥 **Clientes** | base e relacionamento com clientes |

### 📡 Operação centralizada

O painel também foi estruturado para acompanhar:

`🔔 Novos pedidos`

`💰 Faturamento`

`📈 Ticket médio`

`🔄 Atualização automática`

`🟢 Status do sistema`

---

# ⚙️ Do pedido à operação

```mermaid
flowchart LR

    CLIENTE["👤 Cliente"]
    CATALOGO["🍺 Catálogo"]
    CARRINHO["🛒 Carrinho"]
    CHECKOUT["🧾 Checkout"]
    PAGAMENTO["💳 Pagamento"]
    API["⚙️ API"]
    BANCO[("☁️ Supabase")]
    PEDIDO["📥 Pedido"]
    ADMIN["🖥️ Painel Admin"]
    OPERACAO["🚚 Operação"]

    CLIENTE --> CATALOGO
    CATALOGO --> CARRINHO
    CARRINHO --> CHECKOUT
    CHECKOUT --> PAGAMENTO
    PAGAMENTO --> API
    API --> BANCO
    BANCO --> PEDIDO
    PEDIDO --> ADMIN
    ADMIN --> OPERACAO
```

---

# 🚀 Principais recursos

<table>
<tr>

<td width="50%" valign="top">

### 🍺 Para o cliente

- catálogo digital
- produtos em promoção
- busca de produtos
- carrinho interativo
- controle de quantidade
- checkout em etapas
- dados do cliente
- endereço de entrega
- seleção de bairro
- múltiplas formas de pagamento
- experiência responsiva

</td>

<td width="50%" valign="top">

### ⚙️ Para a gestão

- área administrativa
- dashboard operacional
- acompanhamento de pedidos
- atualização de status
- gerenciamento de produtos
- categorias
- estoque
- clientes
- indicadores do negócio
- alertas de novos pedidos

</td>

</tr>
</table>

---

# 🛠️ Tecnologias

<div align="center">

| Tecnologia | Uso no projeto |
|---|---|
| **Next.js** | aplicação, páginas, rotas e APIs |
| **React** | componentes e experiência de interface |
| **TypeScript** | tipagem e segurança |
| **Tailwind CSS** | design e responsividade |
| **Supabase** | banco de dados e persistência |
| **React Context** | gerenciamento do carrinho |
| **Git / GitHub** | versionamento |

</div>

---

# 🎯 Um projeto de cliente real

O sistema foi desenvolvido a partir das necessidades reais do **Depósito do Zé**.

O desafio não era apenas criar uma interface bonita.

Era necessário conectar:

```text
CLIENTE
   +
PEDIDO
   +
PAGAMENTO
   +
DADOS
   +
OPERAÇÃO
   +
GESTÃO
```

para tornar a experiência mais organizada tanto para quem compra quanto para quem administra.

### O projeto trabalha desafios como

- reduzir processos manuais;
- facilitar compras pelo celular;
- organizar pedidos;
- centralizar informações;
- melhorar a experiência do cliente;
- aplicar regras reais de negócio;
- apoiar a gestão do estabelecimento.

> **Código aplicado a um problema real.**

---

# 🚧 Evolução do sistema

```text
✅ Catálogo digital
✅ Promoções
✅ Carrinho
✅ Checkout
✅ Formas de pagamento
✅ Banco de dados
✅ Painel administrativo
✅ Gestão de pedidos
✅ Produtos
✅ Categorias
✅ Estoque
✅ Área de clientes

🔄 CRM e métricas de clientes
🔄 Histórico de compras
🔄 Fidelidade
🔄 Impressão térmica
🔄 Automações operacionais
🔄 Evolução dos relatórios
```

---

<div align="center">

## 🍻 Mais agilidade. Mais controle. Menos complicação.

**Sistema desenvolvido para o Depósito do Zé.**

<br>

### Da escolha da bebida à gestão do pedido.

**Uma solução digital aplicada a uma operação real.**

<br><br>

Desenvolvido por **Cassiano Calian**

<br><br>

[![GitHub](https://img.shields.io/badge/GitHub-CassianoCalian-181717?style=for-the-badge&logo=github)](https://github.com/CassianoCalian)

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Cassiano_Calian-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/cassianocalian/)

<br>

### 🍺 BEBIDA GELADA • PEDIDO RÁPIDO • GESTÃO ORGANIZADA

</div>
**Sistema desenvolvido para o Depósito do Zé.**

<br>

### Da escolha da bebida à gestão do pedido.

**Uma solução digital aplicada a uma operação real.**

<br><br>

Desenvolvido por **Cassiano Calian**

<br><br>

[![GitHub](https://img.shields.io/badge/GitHub-CassianoCalian-181717?style=for-the-badge&logo=github)](https://github.com/CassianoCalian)

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Cassiano_Calian-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/cassianocalian/)

<br>

### 🍺 BEBIDA GELADA • PEDIDO RÁPIDO • GESTÃO ORGANIZADA

</div>
