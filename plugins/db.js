const mysql = require('mysql2/promise');

const MYSQL_CONFIG = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

async function getConnection() {
    return await mysql.createConnection(MYSQL_CONFIG);
}

module.exports = { getConnection };