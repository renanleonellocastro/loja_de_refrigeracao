const fs = require('fs');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);
const database = require('../database/postgres');

async function remove(filepath)
{
    await unlinkAsync(filepath);
}

getAllProductImages = async (productid) => {
    const query  = "SELECT * FROM productImages WHERE productid = $1;";
    const result = await database.execute(query, [productid]);
    const response = {
        images: result.rows.map(img => {
            return {
                imageid: img.imageid,
                productid: img.productid,
                path: img.path,
                url: process.env.URL_API + img.path
            };
        })
    };
    return response;
};

deleteSingleProductImage = async (imageid) => {
    const query = 'DELETE FROM productImages WHERE imageid = $1 RETURNING *;';
    const result = await database.execute(query, [imageid]);
    const response = {message: 'Imagem removida com sucesso'};
    await remove(result.rows[0].path);
    return response;
};

deleteAllProductImages = async (productid) => {
    const productImages = await getAllProductImages(productid);
    for (var i = 0; i < productImages.images.length; i++) {
        await deleteSingleProductImage(productImages.images[i].imageid);
    }
};

exports.getImages = async (req, res, next) => {
    try {
        const response = await getAllProductImages(req.params.productid);
        return res.status(200).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.uploadImage = async (req, res, next) => {
    try {
        const query = 'INSERT INTO productImages (productid, path) VALUES ($1, $2) RETURNING *;';
        const result = await database.execute(query, [req.params.productid, req.file.path]);

        const response = {
            message: 'Imagem inserida com sucesso',
            productid: result.rows[0].productid,
            path: result.rows[0].path
        };
        return res.status(201).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.deleteImage = async (req, res, next) => {
    try {
        const response = await deleteSingleProductImage(req.params.imageid);
        return res.status(202).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.getSingleProduct = async (productid) => {
    const query = 'SELECT * FROM products WHERE productid = $1;';
    const result = await database.execute(query, [productid]);
    let response = NaN;

    if (result.length === 0) {
        response = {found: false};
    } else {
        response = {
            found: true,
            productid: result.rows[0].productid,
            name: result.rows[0].name,
            price: result.rows[0].price,
            description: result.rows[0].description,
            state: result.rows[0].state,
            quantity: result.rows[0].quantity,
            categoryid: result.rows[0].fk_product_category
        };
    }
    return response;
}

exports.updateSingleProduct = async (productid, name, price, description, state, quantity) => {
    const query = 'UPDATE products SET name = $1, price = $2, description = $3, state = $4,\
    quantity = $5 WHERE productid = $6 RETURNING *;';

    const result = await database.execute(query, [name, price, description, state, quantity, productid]);

    return {
        message: 'Produto atualizado com sucesso',
        productid: result.rows[0].productid,
        name: result.rows[0].name,
        price: result.rows[0].price,
        description: result.rows[0].description,
        state: result.rows[0].state,
        quantity: result.rows[0].quantity
    };
}

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
            products: result.rows.map(prod => {
                return {
                    productid: prod.productid,
                    name: prod.name,
                    description: prod.description,
                    state: prod.state,
                    price: prod.price,
                    quantity: prod.quantity,
                    categoryid: prod.fk_product_category
                };
            })
        };
        return res.status(200).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.createProduct = async (req, res, next) => {
    try {
        const query = 'INSERT INTO products (name, price, description, state, quantity, fk_product_category)\
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;';
        const result = await database.execute(query, [req.body.name, req.body.price,
            req.body.description, req.body.state, req.body.quantity, req.body.categoryid]);

        const response = {
            message: 'Produto inserido com sucesso',
            productid: result.rows[0].productid,
            name: result.rows[0].name,
            price: result.rows[0].price,
            description: result.rows[0].description,
            state: result.rows[0].state,
            quantity: result.rows[0].quantity,
            categoryid: result.rows[0].fk_product_category
        };
        return res.status(201).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.getProductDetail = async (req, res, next) => {
    try {
        const response = await this.getSingleProduct(req.params.productid);

        if (response.found === false) {
            return res.status(404).send({message: 'Não foi encontrado produto com este ID'});
        }

        return res.status(200).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.updateProduct = async (req, res, next) => {
    try {
        const response = await this.updateSingleProduct(req.params.productid, req.body.name, req.body.price,
             req.body.description, req.body.state, req.body.quantity); 
        return res.status(202).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.deleteProduct = async (req, res, next) => {
    try {
        await deleteAllProductImages(req.params.productid);
        const query = 'DELETE FROM products WHERE productid = $1 RETURNING *;';
        const result = await database.execute(query, [req.params.productid]);

        const response = {
            message: 'Produto removido com sucesso',
            name: result.rows[0].name
        };
        return res.status(202).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};
