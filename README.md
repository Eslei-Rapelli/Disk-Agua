# Aquamix - base do servidor (versão inicial)

Este pacote é a primeira base do servidor central. Ele cria API Node.js + PostgreSQL para produtos, clientes, pedidos e status.

## Importante
O HTML enviado foi analisado. Ele ainda grava preços, clientes e pedidos em `localStorage`, ou seja, apenas no navegador onde o pedido foi feito. Esta API é a base para substituir esse armazenamento. **Ela ainda não está conectada ao HTML atual nem publicada no Render.** Não use em produção antes de concluir a integração da interface e os testes.

## Publicar no Render
1. Crie um repositório GitHub e envie os arquivos deste pacote.
2. No Render, crie um PostgreSQL e copie a Internal Database URL.
3. Crie um Web Service ligado ao repositório.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Configure as variáveis:
   - `DATABASE_URL`: URL interna do PostgreSQL
   - `ADMIN_TOKEN`: senha longa e aleatória para o painel administrativo
   - `DRIVER_TOKEN`: senha longa e aleatória para o painel do entregador
7. Execute `schema.sql` uma vez no banco (pelo cliente SQL do Render ou ferramenta PostgreSQL).

## Endpoints
- `GET /api/health`
- `GET /api/products`
- `POST /api/orders` (público; valida produtos e calcula valores no servidor)
- `GET /api/orders` (Bearer ADMIN_TOKEN)
- `GET /api/customers` (Bearer ADMIN_TOKEN)
- `PUT /api/products` (Bearer ADMIN_TOKEN)
- `GET /api/driver/orders` (Bearer DRIVER_TOKEN)
- `PATCH /api/orders/:id/status` (Bearer conforme status/ação)

## Próxima etapa
Integrar o HTML original a estes endpoints, criar telas de acesso separadas para escritório e entregador, adicionar atualização em tempo real e só então configurar notificações de WhatsApp com um provedor oficial.
