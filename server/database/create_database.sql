CREATE TABLE IF NOT EXISTS categories (
    categoryid INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS users (
    userid INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
    quantity INT NOT NULL DEFAULT 0,
    fk_product_category INT NOT NULL,
    FOREIGN KEY (fk_product_category) REFERENCES categories (categoryid)
);

CREATE TABLE IF NOT EXISTS productImages (
    imageid INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    productid INT,
    path VARCHAR(255),
    FOREIGN KEY (productid) REFERENCES products (productid)
);

CREATE TABLE IF NOT EXISTS orders (
    orderid INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    userid INT NOT NULL,
    creationdate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    laststatechangedate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    state VARCHAR(10) NOT NULL,
    FOREIGN KEY (userid) REFERENCES users (userid)
);

CREATE TABLE IF NOT EXISTS orderlines (
    orderlineid INT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orderid INT NOT NULL,
    productid INT,
    quantity INT,
    FOREIGN KEY (productid) REFERENCES products (productid),
    FOREIGN KEY (orderid) REFERENCES orders (orderid)
);
