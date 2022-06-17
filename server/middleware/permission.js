const roles = require('../utils/roles').roles;

exports.client = (req, res, next) => {
    if (req.user.role <= roles.CLIENT) {
        next();
    } else {
        return res.status(401).send({ mensagem: 'Usuário não autorizado' });
    }
};

exports.onlyclient = (req, res, next) => {
    if (req.user.role === roles.CLIENT) {
        next();
    } else {
        return res.status(401).send({ mensagem: 'Usuário não autorizado' });
    }
};

exports.employee = (req, res, next) => {
    if (req.user.role <= roles.EMPLOYEE) {
        next();
    } else {
        return res.status(401).send({ mensagem: 'Usuário não autorizado' });
    }
};

exports.onlyemployee = (req, res, next) => {
    if (req.user.role === roles.EMPLOYEE) {
        next();
    } else {
        return res.status(401).send({ mensagem: 'Usuário não autorizado' });
    }
};

exports.manager = (req, res, next) => {
    if (req.user.role <= roles.MANAGER) {
        next();
    } else {
        return res.status(401).send({ mensagem: 'Usuário não autorizado' });
    }
};

exports.onlymanager = (req, res, next) => {
    if (req.user.role === roles.MANAGER) {
        next();
    } else {
        return res.status(401).send({ mensagem: 'Usuário não autorizado' });
    }
};

exports.admin = (req, res, next) => {
    if (req.user.role === roles.ADMIN) {
        next();
    } else {
        return res.status(401).send({ mensagem: 'Usuário não autorizado' });
    }
};
