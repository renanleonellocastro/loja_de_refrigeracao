const database = require('../database/postgres');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.createUser = async (req, res, next) => {

    try {
        const email = req.body.email;
        const password = bcrypt.hashSync(req.body.password, 10);
        query = 'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *;';
        const results = await database.execute(query, [email, password]);

        const response = {
            message: 'Usuário criado com sucesso',
            createdUsers: { email: results.rows[0].email }
        }
        return res.status(201).send(response);

    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.Login = async (req, res, next) => {

    try {
        const query = `SELECT * FROM users WHERE email = $1;`;
        var results = await database.execute(query, [req.body.email]);

        if (results.length < 1) {
            return res.status(401).send({ message: 'Falha na autenticação' })
        }

        if (await bcrypt.compareSync(req.body.password, results.rows[0].password)) {
            const token = jwt.sign({
                userId: results.rows[0].userid,
                email: results.rows[0].email
            },
            process.env.JWT_KEY,
            {
                expiresIn: "1h"
            });
            return res.status(200).send({
                message: 'Autenticado com sucesso',
                token: token
            });
        }
        return res.status(401).send({ message: 'Falha na autenticação' })

    } catch (error) {
        return res.status(500).send({ message: 'Exceção na autenticação' });
    }
};