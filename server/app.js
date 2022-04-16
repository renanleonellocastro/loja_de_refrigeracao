const express = require('express');
const app = express();
const morgan = require('morgan');

const produtsRoute = require('./routes/products');
const ordersRoute = require('./routes/orders');

app.use(morgan('dev'));
app.use('/produtos', produtsRoute);
app.use('/pedidos', ordersRoute);

// Tratamento de erro
app.use((req, res, next) => {
    const erro = new Error('Não encontrado');
    erro.status = 404;
    next(erro);
});

app.use((error, req, res, next) => {
    res.status(error.status || 500);
    return res.send({
        erro: {
            mensagem: error.message
        }
    });
});

module.exports = app;
