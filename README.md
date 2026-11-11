# 🍪 Cookie's Top — Controle de vendas e lucro

Painel da loja de cookies **Cookie's Top** para registrar vendas, controlar o estoque e acompanhar o lucro. Feito em HTML, CSS e JavaScript puro — não precisa instalar nada.

## Como usar

1. Abra o arquivo **`index.html`** com duas cliques (ou arraste para o navegador).
2. No primeiro acesso, informe o **preço de venda** e o **custo** dos 4 sabores de cookie e do **sorvete (por bola)**. Se preferir, clique em **Configurar depois** e preencha em **Ajustes**.
3. Pronto: use a aba **Vendas** para registrar pedidos.

> Dica: no Chrome, use o menu do navegador → *Mais ferramentas* → *Criar atalho* para abrir o painel como um aplicativo.

## Instalar no celular (PWA)

O painel é um **PWA**: pode ser instalado com ícone próprio, abrir em tela cheia e funcionar **sem internet** depois do primeiro acesso.

**Requisito:** para instalar, o site precisa estar publicado em **HTTPS** (ou aberto em `localhost`). Abrir o `index.html` direto pelo `file://` funciona para usar o painel, mas não habilita a instalação nem o modo offline.

- **Android (Chrome):** abra o site e toque no botão **Instalar app** (ou no menu **⋮** → *Instalar app*).
- **iPhone/iPad (Safari):** toque em **Compartilhar** → *Adicionar à Tela de Início* → *Adicionar*.
- O próprio painel mostra um botão flutuante **Instalar app** quando a instalação está disponível.

### Testar no computador

Na pasta do projeto, rode um servidor local e abra `http://localhost:8000`:

```bash
python3 -m http.server 8000
```

Depois de instalar, os arquivos ficam em cache e o app abre normalmente **offline**. Quando você alterar o projeto e recarregar com internet, o app baixa a versão nova; se houver atualização disponível, aparece o botão **Atualizar app**.

## O que o site faz

| Aba | Função |
| --- | --- |
| **Início** | Estoque total, vendas/faturamento/lucro do dia e do mês, gráfico dos últimos 7 dias, ranking de sabores e alertas de estoque baixo. |
| **Vendas** | Monta o pedido com vários sabores, adiciona o **sorvete por bola** sem limite por cookie, aplica desconto, escolhe a forma de pagamento e finaliza a venda. Em **Dinheiro**, a calculadora de troco soma as notas recebidas e mostra o troco (ou quanto falta). Baixa o estoque automaticamente. |
| **Estoque** | Mostra preço, custo, margem, status e unidades de cada sabor. Permite registrar **entrada** de mercadoria e **ajustar** a contagem (perdas/quebras). |
| **Histórico** | Todas as vendas com filtros por período e sabor, cancelamento (devolve ao estoque) e exportação em **CSV**. |
| **Relatórios** | Resumo mensal de faturamento, custo, lucro, ticket médio, margem, participação por sabor, formas de pagamento e melhor dia. |
| **Ajustes** | Nome da loja, sabores, preços, custos, estoque mínimo, **exportar planilha (Excel)**, backup em JSON e restauração dos dados. |

## Regras

- Estoque inicial: **16 unidades de cada cookie (4 sabores = 64 no total)** e **16 bolas de sorvete**. O "Estoque total" conta só os cookies; o estoque do sorvete aparece separado.
- O **sorvete é vendido por bola**: pode ser adicionado em qualquer quantidade (respeitando o estoque) e também vendido sozinho, sem precisar de cookie. Ele tem preço, custo e estoque próprios, e o lucro dele entra normalmente nos relatórios.
- O lucro é calculado como `(preço de venda − custo) × quantidade − desconto` e fica **gravado no momento da venda**. Mudar preços depois não altera o histórico.
- Cada sabor tem estoque mínimo (padrão **4 un.**) para gerar alerta.
- Vendas sem estoque são bloqueadas.

## Onde os dados ficam

Tudo é salvo no **`localStorage` do navegador** (chave `cookiestop:v1`). Isso significa:

- os dados valem para **aquele navegador e aquele computador**;
- limpar os dados do navegador apaga tudo;
- use **Ajustes → Exportar planilha (Excel)** para abrir tudo no Excel ou no Google Planilhas (abas *Vendas*, *Itens vendidos*, *Estoque*, *Movimentações* e *Resumo*). A planilha é só para consulta: não dá para importá-la de volta;
- use **Ajustes → Exportar backup** regularmente e guarde o arquivo `.json` (é ele que restaura o painel);
- para restaurar, use **Ajustes → Importar backup**.

## Estrutura

```
index.html              painel (abas e estrutura)
manifest.webmanifest    manifesto do PWA (nome, ícones, atalhos)
sw.js                   service worker (cache e modo offline)
css/style.css           identidade visual bordo + marrom cookie
js/store.js             dados, cálculos, vendas, estoque e backup
js/app.js               telas, gráficos, modais e eventos
js/pwa.js               registro do service worker e botão de instalação
assets/logo.svg         logo do cookie
assets/icons/           ícones do app (192, 512, maskable e Apple)
```

## Paleta

| Cor | Uso |
| --- | --- |
| `#5C1A2B` | bordo principal |
| `#3E0F1C` | bordo escuro |
| `#8B5E3C` | marrom cookie |
| `#C08552` | caramelo |
| `#FFF6EC` | creme de fundo |
| `#2E1B12` | chocolate (texto) |

---

Feito para a Cookie's Top. Bom apetite e boas vendas! 🍪
