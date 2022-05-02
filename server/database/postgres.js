const postgres = require ('pg');

const pool = new postgres.Pool({
    "user" : process.env.PBUSER,
    "host" : process.env.PBHOST,
    "port" : process.env.PGPORT,
    "database" : process.env.PBDATABASE,
    "password" : process.env.PGPASSWORD,
})

exports.pool = pool;
