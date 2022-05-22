const { reject } = require('bcrypt/promises');
const postgres = require ('pg');

const pool = new postgres.Pool({
    "user" : process.env.PBUSER,
    "host" : process.env.PBHOST,
    "port" : process.env.PGPORT,
    "database" : process.env.PBDATABASE,
    "password" : process.env.PGPASSWORD,
})

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