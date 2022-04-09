const express = require('express');
const app = express();

const produtsRoute = require('./routes/products');
const ordersRoute = require('./routes/orders');

app.use('/produtos', produtsRoute);
app.use('/pedidos', ordersRoute);

module.exports = app;
