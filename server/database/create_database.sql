CREATE TABLE IF NOT EXISTS categories (
    categoryid INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS users (
    userId INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cpf VARCHAR(11) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(150),
    city VARCHAR(50),
    password VARCHAR(100),
    role INT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    productid INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(45) NOT NULL,
    price FLOAT,
    description text,
    state VARCHAR(10) NOT NULL,
    fk_product_category INT NOT NULL,
    FOREIGN KEY (fk_product_category) REFERENCES categories (categoryid)
);

CREATE TABLE IF NOT EXISTS productImages (
    imageId INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    productid INT,
    path VARCHAR(255),
    FOREIGN KEY (productid) REFERENCES products (productid)
);

CREATE TABLE IF NOT EXISTS orders (
    orderId INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    productid INT,
    quantity INT,
    FOREIGN KEY (productid) REFERENCES products (productid)
);

INSERT INTO categories (name) VALUES ('Geladeira');
