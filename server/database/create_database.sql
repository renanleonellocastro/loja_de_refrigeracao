CREATE TABLE IF NOT EXISTS categories (
    categoryId INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS users (
    userId INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(100),
    password VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS products (
    productId INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(45),
    price FLOAT,
    fk_product_category INT NOT NULL,
    FOREIGN KEY (fk_product_category) REFERENCES categories (categoryId)
);

CREATE TABLE IF NOT EXISTS productImages (
    imageId INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    productId INT,
    path VARCHAR(255),
    FOREIGN KEY (productId) REFERENCES products (productId)
);

CREATE TABLE IF NOT EXISTS orders (
    orderId INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    productId INT,
    quantity INT,
    FOREIGN KEY (productId) REFERENCES products (productId)
);

INSERT INTO categories (name) VALUES ('Geladeira');
