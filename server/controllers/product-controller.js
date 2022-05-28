const database = require('../database/postgres');

exports.getProducts = async (req, res, next) => {
    try {
        let name = req.query.name ? req.query.name : '';
        let category = req.query.categoryId ? req.query.categoryId : '';
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
                    productId: prod.productId,
                    name: prod.name,
                    price: prod.price,
                    request: {
                        type: 'GET',
                        description: 'Retorna os detalhes de um produto específico',
                        url: process.env.URL_API + 'produtos/' + prod.productId
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
        const query = 'INSERT INTO products (name, price, fk_product_category)\
            VALUES ($1, $2, $3) RETURNING *;';
        const result = await database.execute(query, [req.body.name, req.body.price,
             req.body.categoryId]);

        const response = {
            message: 'Produto inserido com sucesso',
            createdProduct: {
                productId: result.rows[0].productid,
                name: result.rows[0].name,
                price: result.rows[0].price,
                categoryId: result.rows[0].fk_product_category,
                request: {
                    type: 'GET',
                    description: 'Retorna todos os produtos',
                    url: process.env.URL_API + 'produtos'
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
        const query = 'SELECT * FROM products WHERE productId = $1;';
        const result = await database.execute(query, [req.params.productId]);

        if (result.length === 0) {
            return res.status(404).send({
                message: 'Não foi encontrado produto com este ID'
            });
        }
        const response = {
            product: {
                productId: result.rows[0].productId,
                name: result.rows[0].name,
                price: result.rows[0].price,
                request: {
                    type: 'GET',
                    description: 'Retorna todos os produtos',
                    url: process.env.URL_API + 'produtos'
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
        const query = 'UPDATE products SET name = $1, price = $2 \
            WHERE productId = $3 RETURNING *;';
        const result = await database.execute(query, [req.body.name,
            req.body.price, req.params.productId]);
        const response = {
            message: 'Produto atualizado com sucesso',
            upatedProduct: {
                productId: result.rows[0].productId,
                name: result.rows[0].name,
                price: result.rows[0].price,
                request: {
                    type: 'GET',
                    description: 'Retorna os detalhes de um produto específico',
                    url: process.env.URL_API + 'produtos/' + result.rows[0].productId
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
        const query = 'DELETE FROM products WHERE productId = $1;';
        await database.execute(query, [req.params.productId]);

        const response = {
            message: 'Produto removido com sucesso',
            request: {
                type: 'POST',
                description: 'Insere um produto',
                url: process.env.URL_API + 'produtos',
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
        const query = 'INSERT INTO productImages (productId, path) \
            VALUES ($1, $2) RETURNING *;';
        const result = await database.execute(query, [req.params.productId,
            req.file.path]);

        const response = {
            message: 'Imagem inserida com sucesso',
            createdImage: {
                productId: result.rows[0].productId,
                path: result.rows[0].path,
                request: {
                    type: 'GET',
                    description: 'Retorna todas as imagens',
                    url: process.env.URL_API + 'produtos/' +
                        result.rows[0].productId + '/imagens'
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
        const query  = "SELECT * FROM productImages WHERE productId = $1;";
        const result = await database.execute(query, [req.params.productId]);
        const response = {
            length: result.length,
            images: result.rows.map(img => {
                return {
                    productId: req.params.productId,
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
