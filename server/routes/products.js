const express = require('express');
const router = express.Router();
const database = require('../database/postgres').pool;

router.get('/', (req, res, next) => {
    let query = 'SELECT * from products';
    database.query(query, (error, result) => {
        console.log("Error: ", error, "Result: ", result);

        if (error) {
            return res.status(500).send({
                error: error,
                response: null
            });
        }

        res.status(200).send({
            mensagem: "Produtos consultados com sucesso!",
            produtos: result.rows
        });
    });
});

router.get('/:product_id', (req, res, next) => {
    let query = 'SELECT * from products where id = $1';
    let params = [req.params.product_id];
    database.query(query, params, (error, result) => {
        console.log("Error: ", error, "Result: ", result);

        if (error) {
            return res.status(500).send({
                error: error,
                response: null
            });
        }

        if (result.rows.length == 0) {
            return res.status(500).send({
                mensagem: 'Produto com ID:' + req.params.product_id + ' não existe no banco de dados!'
            });
        }

        res.status(200).send({
            mensagem: "Produto consultado com sucesso!",
            produtos: result.rows
        });
    });
});

router.post('/', (req, res, next) => {
    let query = 'INSERT INTO products (name, price) VALUES ($1, $2) RETURNING id';
    let params =[req.body.nome, req.body.preco];

    database.query(query, params, (error, result) => {
        console.log("Error: ", error, "Result: ", result);

        if (error) {
            return res.status(500).send({
                error: error,
                response: null
            });
        }

        res.status(201).send({
            mensagem: "Produto inserido com sucesso!",
            id_produto: result.rows[0].id
        });
    });
});

router.patch('/', (req, res, next) => {
    res.status(200).send({
        mensagem: 'Usando o PATCH dentro da rota de produtos'
    });
});

router.delete('/', (req, res, next) => {
    res.status(200).send({
        mensagem: 'Usando o DELETE dentro da rota de produtos'
    });
});

module.exports = router;
