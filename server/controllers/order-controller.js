const database = require('../database/postgres');
const orderlinesController = require('../controllers/orderline-controller');
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
                    creationdate: order.creationdate,
                    laststatechangedate: order.laststatechangedate,
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
                    creationdate: order.creationdate,
                    laststatechangedate: order.laststatechangedate,
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
        const query  = 'INSERT INTO orders (userid, state) VALUES ($1, $2) RETURNING *;';
        const result = await database.execute(query, [req.user['userId'], orderState.NEW]);

        let orderline_responses = await Promise.all(req.body.orderlines.map(async line => {
            return await orderlinesController.createOrderline(result.rows[0].orderid, line.productid, line.quantity);
        }));

        const response = {
            message: 'Ordem criada com sucesso',
            orderid: result.rows[0].orderid,
            userid: result.rows[0].userid,
            creationdate: result.rows[0].creationdate,
            laststatechangedate: result.rows[0].laststatechangedate,
            state: result.rows[0].state,
            orderlines: orderline_responses.map(orderline => {
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
        const result_order = await database.execute(query, [req.params.orderid]);
        const result_orderlines = await orderlinesController.getOrderlinesByOrderid(req.params.orderid);
        
        const response = {
            orderid: result_order.rows[0].orderid,
            userid: result_order.rows[0].userid,
            creationdate: result_order.rows[0].creationdate,
            laststatechangedate: result_order.rows[0].laststatechangedate,
            state: result_order.rows[0].state,
            orderlines: result_orderlines.orderlines
        };
        return res.status(200).send(response);

    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.deleteOrder = async (req, res, next) => {
    try {
        const query = 'DELETE FROM orders WHERE orderid = $1 RETURNING *;';
        const orderlines = await orderlinesController.getOrderlinesByOrderid(req.params.orderid);

        let orderline_responses = await Promise.all(orderlines.orderlines.map(async line => {
            return await orderlinesController.deleteOrderline(line.orderlineid);
        }));

        const result = await database.execute(query, [req.params.orderid]);

        const response = {
            message: 'Ordem removida com sucesso',
            orderid: result.rows[0].orderid,
            userid: result.rows[0].userid,
            creationdate: result.rows[0].creationdate,
            laststatechangedate: result.rows[0].laststatechangedate,
            state: result.rows[0].state,
            orderlines: orderline_responses.map(orderline => {
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
        const current_timestamp = Date.now()/1000;
        const query = 'UPDATE orders SET state = $1, laststatechangedate = to_timestamp($2) WHERE orderid = $3 RETURNING *;';
        const result = await database.execute(query, [req.body.state, current_timestamp, req.params.orderid]);

        const response = {
            message: 'Estado da order atualizado com sucesso',
            orderid: result.rows[0].orderid,
            userid: result.rows[0].userid,
            creationdate: result.rows[0].creationdate,
            laststatechangedate: result.rows[0].laststatechangedate,
            state: result.rows[0].state
        };
        return res.status(201).send(response);

    } catch (error) {
        return res.status(500).send({ error: error });
    }
};
