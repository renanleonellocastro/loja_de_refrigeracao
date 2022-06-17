const database = require('../database/postgres');

exports.getProducts = async (req, res, next) => {
    try {
        let name = req.query.name ? req.query.name : '';
        let category = req.query.categoryid ? req.query.categoryid : '';
        let query = 'SELECT * FROM products;';
        let result = '';

        if (name !== '' && category !== '') {
            query = 'SELECT * FROM products WHERE fk_product_category = $1 AND (name LIKE $2);';
            result = await database.execute(query, [category, name]);
        } else if (name === '' && category !== '') {
            query = 'SELECT * FROM products WHERE fk_product_category = $1;';
            result = await database.execute(query, [category]);
        } else if (name !== '' && category === '') {
            query = 'SELECT * FROM products WHERE name = $1;';
            result = await database.execute(query, [name]);
        } else {
            result = await database.execute(query);
        }

        const response = {
            length: result.length,
            products: result.rows.map(prod => {
                return {
                    productid: prod.productid,
                    name: prod.name,
                    description: prod.description,
                    state: prod.state,
                    price: prod.price,
                    request: {
                        type: 'GET',
                        description: 'Retorna os detalhes de um produto específico',
                        url: process.env.URL_API + 'products/' + prod.productid
                    }
                };
            })
        };
        return res.status(200).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.postProduct = async (req, res, next) => {
    try {
        const query = 'INSERT INTO products (name, price, description, state, fk_product_category)\
            VALUES ($1, $2, $3, $4, $5) RETURNING *;';
        const result = await database.execute(query, [req.body.name, req.body.price,
            req.body.description, req.body.state, req.body.categoryid]);

        const response = {
            message: 'Produto inserido com sucesso',
            createdProduct: {
                productid: result.rows[0].productid,
                name: result.rows[0].name,
                price: result.rows[0].price,
                description: result.rows[0].description,
                state: result.rows[0].state,
                categoryid: result.rows[0].fk_product_category,
                request: {
                    type: 'GET',
                    description: 'Retorna todos os produtos',
                    url: process.env.URL_API + 'products'
                }
            }
        };
        return res.status(201).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.getProductDetail = async (req, res, next) => {
    try {
        const query = 'SELECT * FROM products WHERE productid = $1;';
        const result = await database.execute(query, [req.params.productid]);

        if (result.length === 0) {
            return res.status(404).send({
                message: 'Não foi encontrado produto com este ID'
            });
        }
        const response = {
            product: {
                productid: result.rows[0].productid,
                name: result.rows[0].name,
                price: result.rows[0].price,
                description: result.rows[0].description,
                state: result.rows[0].state,
                categoryid: result.rows[0].fk_product_category,
                request: {
                    type: 'GET',
                    description: 'Retorna todos os produtos',
                    url: process.env.URL_API + 'products'
                }
            }
        };
        return res.status(200).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.updateProduct = async (req, res, next) => {
    try {
        const query = 'UPDATE products SET name = $1, price = $2, description = $3, state = $4 \
            WHERE productid = $5 RETURNING *;';
        const result = await database.execute(query, [req.body.name, req.body.price,
            req.body.description, req.body.state, req.params.productid]);
        const response = {
            message: 'Produto atualizado com sucesso',
            upatedProduct: {
                productid: result.rows[0].productid,
                name: result.rows[0].name,
                price: result.rows[0].price,
                description: result.rows[0].description,
                state: result.rows[0].state,
                request: {
                    type: 'GET',
                    description: 'Retorna os detalhes de um produto específico',
                    url: process.env.URL_API + 'products/' + result.rows[0].productid
                }
            }
        };
        return res.status(202).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.deleteProduct = async (req, res, next) => {
    try {
        const query = 'DELETE FROM products WHERE productid = $1;';
        await database.execute(query, [req.params.productid]);

        const response = {
            message: 'Produto removido com sucesso',
            request: {
                type: 'POST',
                description: 'Insere um produto',
                url: process.env.URL_API + 'products',
                body: {
                    name: 'String',
                    price: 'Number'
                }
            }
        };
        return res.status(202).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.postImage = async (req, res, next) => {
    try {
        const query = 'INSERT INTO productImages (productid, path) \
            VALUES ($1, $2) RETURNING *;';
        const result = await database.execute(query, [req.params.productid,
            req.file.path]);

        const response = {
            message: 'Imagem inserida com sucesso',
            createdImage: {
                productid: result.rows[0].productid,
                path: result.rows[0].path,
                request: {
                    type: 'GET',
                    description: 'Retorna todas as imagens',
                    url: process.env.URL_API + 'products/' +
                        result.rows[0].productid + '/imagens'
                }
            }
        };
        return res.status(201).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.getImages = async (req, res, next) => {
    try {
        const query  = "SELECT * FROM productImages WHERE productid = $1;";
        const result = await database.execute(query, [req.params.productid]);
        const response = {
            length: result.length,
            images: result.rows.map(img => {
                return {
                    productid: req.params.productid,
                    imageId: img.imageId,
                    path: process.env.URL_API + img.path
                }
            })
        };
        return res.status(200).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};
