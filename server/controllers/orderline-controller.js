const database = require('../database/postgres');

exports.getOrderlines = async () => {
    const query = "SELECT * from orderlines;"
    const result = await database.execute(query);
    const response = {
        orderlines: result.rows.map(orderline => {
            return {
                orderlineid: orderline.orderlineid,
                orderid: orderline.orderid,
                productid: orderline.productid,
                quantity: orderline.quantity
            };
        })
    };
    return response;
};

exports.createOrderline = async (orderid, productid, quantity) => {
    const query  = 'INSERT INTO orderlines (orderid, productid, quantity) VALUES ($1, $2, $3) RETURNING *;';
    const result = await database.execute(query, [orderid, productid, quantity]);

    const response = {
        message: 'Item do pedido inserido com sucesso',
        orderlineid: result.rows[0].orderlineid,
        orderid: result.rows[0].orderid,
        productid: result.rows[0].productid,
        quantity: result.rows[0].quantity
    };
    return response;
};

exports.getOrderline = async (orderlineid) => {
    const query = 'SELECT * FROM orderlines WHERE orderlineid = $1;';
    const result = await database.execute(query, [orderlineid]);

    const response = {
        orderlineid: result.rows[0].orderlineid,
        orderid: result.rows[0].orderid,
        productid: result.rows[0].productid,
        quantity: result.rows[0].quantity
    };
    return response;
};

exports.getOrderlinesByOrderid = async (orderid) => {
    const query = 'SELECT * FROM orderlines WHERE orderid = $1;';
    const result = await database.execute(query, [orderid]);

    const response = {
        orderlines: result.rows.map(orderline => {
            return {
                orderlineid: orderline.orderlineid,
                orderid: orderline.orderid,
                productid: orderline.productid,
                quantity: orderline.quantity
            };
        })
    };
    return response;
};

exports.deleteOrderline = async (orderlineid) => {
    const query = 'DELETE FROM orderlines WHERE orderlineid = $1 RETURNING *;';
    await database.execute(query, [orderlineid]);

    const response = {
        message: 'Item do pedido removido com sucesso',
        orderlineid: result.rows[0].orderlineid,
        orderid: result.rows[0].orderid,
        productid: result.rows[0].productid,
        quantity: result.rows[0].quantity
    };

    return response;
};
