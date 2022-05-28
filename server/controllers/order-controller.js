const database = require('../database/postgres');

exports.getOrders = async (req, res, next) => {
    try {
        const query = "SELECT orders.orderId, orders.quantity, products.productId,\
            products.name, products.price FROM orders INNER JOIN products ON \
            products.productId = orders.productId;"
        const result = await database.execute(query);
        const response = {
            orders: result.rows.map(order => {
                return {
                    orderId: order.orderId,
                    quantity: order.quantity,
                    product: {
                        productId: order.productId,
                        name: order.name,
                        price: order.price
                    },
                    request: {
                        type: 'GET',
                        description: 'Retorna os detalhes de um pedido específico',
                        url: process.env.URL_API + 'orders/' + order.orderId
                    }
                }
            })
        };
        return res.status(200).send(response);
        
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.postOrder = async (req, res, next) => {
    try {
        const queryProduct = 'SELECT * FROM products WHERE productId = $1;';
        const resultProduct = await database.execute(queryProduct, [req.body.productId]);

        if (resultProduct.length == 0) {
            return res.status(404).send({ message: 'Produto não encontrado'});
        }

        const queryOrder  = 'INSERT INTO orders (productId, quantity) VALUES ($1, $2) RETURNING *;';
        const resultOrder = await database.execute(queryOrder, [req.body.productId, req.body.quantity]);

        const response = {
            message: 'Pedido inserido com sucesso',
            createdOrder: {
                orderId: resultOrder.rows[0].orderId,
                productId: resultOrder.rows[0].productId,
                quantity: resultOrder.rows[0].quantity,
                request: {
                    type: 'GET',
                    description: 'Retorna todos os pedidos',
                    url: process.env.URL_API + 'orders'
                }
            }
        };
        return res.status(201).send(response);

    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.getOrderDetail = async (req, res, next) => {
    try {
        const query = 'SELECT * FROM orders WHERE orderId = $1;';
        const result = await database.execute(query, [req.params.orderId]);

        if (result.length == 0) {
            return res.status(404).send({
                message: 'Não foi encontrado pedido com este ID'
            });
        }
        const response = {
            order: {
                orderId: result.rows[0].orderId,
                productId: result.rows[0].productId,
                quantity: result.rows[0].quantity,
                request: {
                    type: 'GET',
                    description: 'Retorna todos os pedidos',
                    url: process.env.URL_API + 'orders'
                }
            }
        };
        return res.status(200).send(response);

    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.deleteOrder = async (req, res, next) => {
    try {
        const query = 'DELETE FROM orders WHERE orderId = $1;';
        await database.execute(query, [req.params.orderId]);

        const response = {
            message: 'Pedido removido com sucesso',
            request: {
                type: 'POST',
                description: 'Insere um pedido',
                url: process.env.URL_API + 'orders',
                body: {
                    productId: 'Number',
                    quantity: 'Number'
                }
            }
        };
        return res.status(202).send(response);

    } catch (error) {
        return res.status(500).send({ error: error });
    }
};
