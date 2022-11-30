const database = require('../database/postgres');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const roles = require('../utils/roles').roles;

var createUser = async (req, res, next) => {
    try {
        const cpf = req.body.cpf;
        const email = req.body.email;
        const name = req.body.name;
        const phone = req.body.phone;
        const address = req.body.address;
        const city = req.body.city;
        const password = bcrypt.hashSync(req.body.password, 10);
        const role = req.role;
        query = 'INSERT INTO users (cpf, email, name, phone, address, city, password, role)\
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;';
        const results = await database.execute(query, [cpf, email, name, phone, address, city, password, role]);

        const response = {
            message: 'Usuário criado com sucesso',
            createdUsers: { email: results.rows[0].email }
        }
        return res.status(201).send(response);

    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

var updateUser = async (id, name, email, phone, address, city) => {
    const query = 'UPDATE users SET name = $1, email = $2, phone = $3, address = $4,\
    city = $5 WHERE userid = $6 RETURNING *;';
    const result = await database.execute(query, [name, email, phone, address, city, id]);

    const response = {
        name: result.rows[0].name,
        email: result.rows[0].email,
        phone: result.rows[0].phone,
        address: result.rows[0].address,
        city: result.rows[0].city
    }
    return response;
};

var deleteUser = async (req, res, next) => {
    try {
        const cpf = req.body.cpf;
        const email = req.body.email;
        query = 'DELETE FROM users where cpf=$1 AND email=$2 RETURNING *;';
        const results = await database.execute(query, [cpf, email]);

        const response = {
            message: 'Usuário removido com sucesso',
            deletedUser: { email: results.rows[0].email }
        }
        return res.status(201).send(response);

    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

var getUserRole = async (req) => {
    try {
        const cpf = req.body.cpf;
        const email = req.body.email;
        query = 'SELECT role FROM users where cpf=$1 AND email=$2;';
        const results = await database.execute(query, [cpf, email]);
        return results.rows[0].role;
    } catch (error) {
        return false;
    }
};

exports.getUsers = async (req, res, next) => {
    try {
        let query = 'SELECT * FROM users;';
        let result = await database.execute(query);

        const response = {
            length: result.length,
            users: result.rows.map(user => {
                return {
                    userid: user.userid,
                    cpf: user.cpf,
                    name: user.name,
                    city: user.city,
                    phone: user.phone,
                    email: user.email,
                    address: user.address,
                    role: user.role
                };
            })
        };
        return res.status(200).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.getUserDetails = async (req, res, next) => {
    try {
        if ((req.params.id !== String(req.user['userId'])) && (req.user['role'] > 2)) {
            return res.status(401).send({ mensagem: 'Usuário não autorizado' });
        }

        let query = 'SELECT * FROM users where userid = $1;';
        let result = await database.execute(query, [req.params.id]);

        const response = {
            userid: result.rows[0].userid,
            cpf: result.rows[0].cpf,
            name: result.rows[0].name,
            city: result.rows[0].city,
            phone: result.rows[0].phone,
            email: result.rows[0].email,
            address: result.rows[0].address
        };

        return res.status(200).send(response);
    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.createClient = async (req, res, next) => {
    req.role = roles.CLIENT;
    return await createUser(req, res, next);
};

exports.createEmployee = async (req, res, next) => {
    req.role = roles.EMPLOYEE;
    return await createUser(req, res, next);
};

exports.createManager = async (req, res, next) => {
    req.role = roles.MANAGER;
    return await createUser(req, res, next);
};

exports.updateUser = async (req, res, next) => {
    try {
        if ((req.params.id !== String(req.user['userId'])) && (req.user['role'] > 2)) {
            return res.status(401).send({ mensagem: 'Usuário não autorizado' });
        }
        const response = await updateUser(req.params.id, req.body.name, req.body.email, req.body.phone, req.body.address, req.body.city);
        return res.status(201).send(response);

    } catch (error) {
        return res.status(500).send({ error: error });
    }
};

exports.deleteClient = async (req, res, next) => {
    if (await getUserRole(req) === roles.CLIENT) {
        return await deleteUser(req, res, next);
    } else {
        return res.status(500).send({ error: 'User is not a client!' });
    }

};

exports.deleteEmployee = async (req, res, next) => {
    if (await getUserRole(req) === roles.EMPLOYEE) {
        return await deleteUser(req, res, next);
    } else {
        return res.status(500).send({ error: 'User is not an employee!' });
    }
};

exports.deleteManager = async (req, res, next) => {
    if (await getUserRole(req) === roles.MANAGER) {
        return await deleteUser(req, res, next);
    } else {
        return res.status(500).send({ error: 'User is not a manager!' });
    }
};

exports.Login = async (req, res, next) => {
    try {
        const query = 'SELECT * FROM users WHERE email = $1;';
        var results = await database.execute(query, [req.body.email]);

        if (results.length < 1) {
            return res.status(401).send({ message: 'Falha na autenticação' })
        }

        if (await bcrypt.compareSync(req.body.password, results.rows[0].password)) {
            const token = jwt.sign({
                    userId: results.rows[0].userid,
                    email: results.rows[0].email,
                    cpf: results.rows[0].cpf,
                    role: results.rows[0].role
                }, process.env.JWT_KEY, {expiresIn: "1h"}
            );
            return res.status(200).send({
                message: 'Autenticado com sucesso',
                userid: results.rows[0].userid,
                name: results.rows[0].name,
                role: results.rows[0].role,
                token: token
            });
        }
        return res.status(401).send({ message: 'Falha na autenticação' })

    } catch (error) {
        return res.status(500).send({ message: 'Exceção na autenticação' });
    }
};
