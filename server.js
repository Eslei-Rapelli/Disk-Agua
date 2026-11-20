const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes("render.com") ? { rejectUnauthorized: false } : undefined });

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function requireRole(role) {
  return (req, res, next) => {
    const expected = role === "admin" ? process.env.ADMIN_TOKEN : process.env.DRIVER_TOKEN;
    if (!expected) return res.status(503).json({ error: `Configure ${role.toUpperCase()}_TOKEN no servidor.` });
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token || token !== expected) return res.status(401).json({ error: "Acesso não autorizado." });
    next();
  };
}

app.get("/api/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.json({ ok: true, database: "connected" }); }
  catch { res.status(503).json({ ok: false, database: "unavailable" }); }
});

app.get("/api/products", async (_req, res) => {
  try { const q = await pool.query("SELECT id,name,price FROM products ORDER BY id"); res.json(q.rows); }
  catch { res.status(500).json({ error: "Não foi possível carregar produtos." }); }
});

app.put("/api/products", requireRole("admin"), async (req, res) => {
  const items = req.body?.products;
  if (!Array.isArray(items)) return res.status(400).json({ error: "Envie products como lista." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const p of items) {
      if (!p.id || !p.name || !Number.isFinite(Number(p.price)) || Number(p.price) < 0) throw new Error("Produto inválido.");
      await client.query(
        `INSERT INTO products(id,name,price) VALUES($1,$2,$3)
         ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price`,
        [String(p.id), String(p.name), Number(p.price)]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) { await client.query("ROLLBACK"); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

app.post("/api/orders", async (req, res) => {
  const { name, phone, email, state, city, address, items } = req.body || {};
  if (![name, phone, email, state, city, address].every(v => typeof v === "string" && v.trim()) || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: "Preencha os dados do cliente e inclua produtos." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let total = 0, normalized = [];
    for (const item of items) {
      const product = await client.query("SELECT id,name,price FROM products WHERE id=$1", [item.id]);
      if (!product.rowCount) throw new Error(`Produto não encontrado: ${item.id}`);
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) throw new Error("Quantidade inválida.");
      const p = product.rows[0], subtotal = Number(p.price) * qty;
      total += subtotal;
      normalized.push({ id: p.id, name: p.name, quantity: qty, unitPrice: Number(p.price), subtotal });
    }
    const customer = await client.query(
      `INSERT INTO customers(name,phone,email,state,city,address)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(phone) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,state=EXCLUDED.state,city=EXCLUDED.city,address=EXCLUDED.address
       RETURNING id`,
      [name.trim(), phone.trim(), email.trim(), state.trim(), city.trim(), address.trim()]
    );
    const order = await client.query(
      `INSERT INTO orders(customer_id,items,total,status) VALUES($1,$2,$3,'Novo') RETURNING id,created_at`,
      [customer.rows[0].id, JSON.stringify(normalized), total]
    );
    await client.query("COMMIT");
    res.status(201).json({ ok: true, orderId: order.rows[0].id, total, createdAt: order.rows[0].created_at });
  } catch (e) { await client.query("ROLLBACK"); res.status(400).json({ error: e.message }); }
  finally { client.release(); }
});

app.get("/api/orders", requireRole("admin"), async (_req, res) => {
  try {
    const q = await pool.query(
      `SELECT o.id,o.items,o.total,o.status,o.created_at,o.updated_at,
       c.name,c.phone,c.email,c.state,c.city,c.address
       FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC`
    );
    res.json(q.rows);
  } catch { res.status(500).json({ error: "Não foi possível carregar pedidos." }); }
});

app.get("/api/customers", requireRole("admin"), async (_req, res) => {
  try {
    const q = await pool.query(
      `SELECT c.*, COUNT(o.id)::int AS order_count
       FROM customers c LEFT JOIN orders o ON o.customer_id=c.id
       GROUP BY c.id ORDER BY c.created_at DESC`
    );
    res.json(q.rows);
  } catch { res.status(500).json({ error: "Não foi possível carregar clientes." }); }
});

app.patch("/api/orders/:id/status", (req, res, next) => {
  const role = req.body?.status === "Entregue" || req.body?.status === "Saiu para entrega" || req.body?.status === "Aceito" ? "driver" : "admin";
  requireRole(role)(req, res, next);
}, async (req, res) => {
  const allowed = ["Novo","Aceito","Em separação","Saiu para entrega","Entregue","Cancelado"];
  if (!allowed.includes(req.body?.status)) return res.status(400).json({ error: "Status inválido." });
  try {
    const q = await pool.query("UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id,status,updated_at", [req.body.status, req.params.id]);
    if (!q.rowCount) return res.status(404).json({ error: "Pedido não encontrado." });
    res.json({ ok: true, ...q.rows[0] });
  } catch { res.status(500).json({ error: "Não foi possível atualizar o pedido." }); }
});

app.get("/api/driver/orders", requireRole("driver"), async (_req, res) => {
  try {
    const q = await pool.query(
      `SELECT o.id,o.items,o.total,o.status,o.created_at,c.name,c.phone,c.state,c.city,c.address
       FROM orders o JOIN customers c ON c.id=o.customer_id
       WHERE o.status NOT IN ('Entregue','Cancelado') ORDER BY o.created_at`
    );
    res.json(q.rows);
  } catch { res.status(500).json({ error: "Não foi possível carregar entregas." }); }
});

app.listen(port, () => console.log(`Aquamix API ouvindo na porta ${port}`));
