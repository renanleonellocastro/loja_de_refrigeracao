const database = require('../database/postgres');
const orderlinesController = require('orderline-controller');
const orderState = require('../utils/order-state').orderState;

exports.getOrders = async (req, res, next) => {
    try {
        const query = "SELECT * from orders;"
        const result = await database.execute(query);
        const response = {
            orders: result.rows.map(order => {
                return {
                    orderid: order.orderid,
                    userid: order.userid,
                    state: order.state
                };
            })
        };
        return res.status(200).send(response);
        
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.getOrdersByUser = async (req, res, next) => {
    try {
        const query = "SELECT * from orders where userid = $1;"
        const result = await database.execute(query, req.body.userid);
        const response = {
            orders: result.rows.map(order => {
                return {
                    orderid: order.orderid,
                    userid: order.userid,
                    state: order.state
                };
            })
        };
        return res.status(200).send(response);
        
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.createOrder = async (req, res, next) => {
    try {
        const query  = 'INSERT INTO order (userid, state) VALUES ($1, $2) RETURNING *;';
        const result = await database.execute(query, [req.body.userid, orderState.NEW]);
        let orderlineResponse = [];

        req.orderlines.map(line => {
            orderlineResponse.push(orderlinesController.createOrderline(line.orderid, line.productid, line.quantity));
        });

        const response = {
            message: 'Ordem criada com sucesso',
            orderid: result.rows[0].orderid,
            userid: result.rows[0].userid,
            state: result.rows[0].state,
            orderlines: orderlineResponse.map(orderline => {
                return {
                    orderlineid: orderline.orderlineid,
                    orderid: orderline.orderid,
                    productid: orderline.productid,
                    quantity: orderline.quantity
                };
            })
        };
        return res.status(201).send(response);

    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.getOrder = async (req, res, next) => {
    try {
        const query = 'SELECT * FROM orders WHERE orderid = $1;';
        const result = await database.execute(query, [req.params.orderid]);
        const orderlines = await orderlinesController.getOrderlinesByOrderid(req.params.orderid);
        
        const response = {
            orderid: result.rows[0].orderid,
            userid: result.rows[0].userid,
            state: result.rows[0].state,
            orderlines: result.rows.map(orderline => {
                return {
                    orderlineid: orderline.orderlineid,
                    orderid: orderline.orderid,
                    productid: orderline.productid,
                    quantity: orderline.quantity
                };
            })
        };
        return res.status(200).send(response);

    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.deleteOrder = async (req, res, next) => {
    try {
        const query = 'DELETE FROM orders WHERE orderid = $1 RETURNING *;';
        const orderlines = orderlinesController.getOrderlinesByOrderid(req.params.orderid);
        let orderlineResponse = [];

        orderlines.map(line => {
            orderlineResponse.push(orderlinesController.deleteOrderline(line.orderlineid));
        });

        const result = await database.execute(query, [req.params.orderid]);

        const response = {
            message: 'Ordem removida com sucesso',
            orderid: result.rows[0].orderid,
            userid: result.rows[0].userid,
            state: result.rows[0].state,
            orderlines: orderlineResponse.map(orderline => {
                return {
                    orderlineid: orderline.orderlineid,
                    orderid: orderline.orderid,
                    productid: orderline.productid,
                    quantity: orderline.quantity
                };
            })
        };

        return res.status(202).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.changeOrderState = async (req, res, next) => {
    try {
        const query = 'UPDATE orders SET state = $1 WHERE orderid = $2 RETURNING *;';
        const result = await database.execute(query, [req.body.state, req.params.orderid]);

        const response = {
            message: 'Estado da order atualizado com sucesso',
            orderid: result.rows[0].orderid,
            userid: result.rows[0].userid,
            state: result.rows[0].state
        };
        return res.status(201).send(response);

    } catch (error) {
        return res.status(500).send({ error: error });
    }
};