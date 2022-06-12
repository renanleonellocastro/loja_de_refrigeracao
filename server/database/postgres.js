const { reject } = require('bcrypt/promises');
const postgres = require ('pg');
const config = require('../config');

const cfg = config.config;

const pool = new postgres.Pool({
    "user" : cfg.getDbUser(),
    "host" : cfg.getDbHost(),
    "port" : cfg.getDbPort(),
    "database" : cfg.getDbName(),
    "password" : cfg.getDbPassword(),
});

exports.execute = (query, params=[]) => {
    return new Promise((resolve,reject) => {
        pool.query(query, params, (error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}

exports.pool = pool;