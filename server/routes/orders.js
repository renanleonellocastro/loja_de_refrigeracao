const express = require('express');
const router = express.Router();

router.get('/', (req, res, next) => {
    res.status(200).send({
        mensagem: 'Usando o GET dentro da rota de pedidos'
    });
});

router.get('/:order_id', (req, res, next) => {
    const id = req.params.order_id;
    msg = id !== 'especial' ? 'Você passou um ID' : 'Você descobriu o ID especial!'

    res.status(201).send({
        mensagem: msg,
        id: id
    });
});

router.post('/', (req, res, next) => {
    res.status(201).send({
        mensagem: 'Usando o POST dentro da rota de pedidos'
    });
});

router.patch('/', (req, res, next) => {
    res.status(200).send({
        mensagem: 'Usando o PATCH dentro da rota de pedidos'
    });
});

router.delete('/', (req, res, next) => {
    res.status(200).send({
        mensagem: 'Usando o DELETE dentro da rota de pedidos'
    });
});

module.exports = router;
