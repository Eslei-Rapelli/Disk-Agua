CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  items JSONB NOT NULL,
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'Novo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO products(id,name,price) VALUES
('agua10','Água mineral 10 litros',10),
('agua20','Água mineral 20 litros',15),
('gas','Botijão de gás',110),
('soda','Acquamix Soda 1,5 litro',9),
('morango','Dilute Premium - Morango',15),
('amora','Dilute Premium - Amora',15),
('tangerina','Dilute Premium - Tangerina',15),
('limao','Dilute Premium - Limão',15),
('maracuja','Dilute Premium - Maracujá',15),
('maca','Dilute Premium - Maçã Verde',15)
ON CONFLICT(id) DO NOTHING;
