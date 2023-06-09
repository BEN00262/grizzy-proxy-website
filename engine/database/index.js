require('dotenv').config({
    path: require('find-config')('.env')
});

const cryptoRandomString = require('crypto-random-string');
const mariadb = require('mariadb');

class GrizzyDatabaseEngine {
    // max size and everything in between
    static async provision_database() {
        const database_name = cryptoRandomString({ 
            length: 15,
            type: "distinguishable"
        });

        const random_password = cryptoRandomString({ length: 16 });

        const database_user = cryptoRandomString({ 
            length: 16,
            type: 'distinguishable',
        });

        const connection = await (mariadb.createPool({
            host: process.env.MASTER_DB_URI,
            // ssl: true,
            password: process.env.MASTER_DB_PASSWORD,
            user: process.env.MASTER_DB_USERNAME,
            connectionLimit: 1,
            port: 3306
        })).getConnection();

        

        await connection.query(
            `CREATE DATABASE IF NOT EXISTS ${database_name};`
        );

        await connection.query(
            `CREATE USER '${database_user}'@'%' IDENTIFIED BY '${random_password}';`
        );

        await connection.query(
            `GRANT ALL PRIVILEGES ON ${database_name}.* TO '${database_user}'@'%';`
        );

        await connection.query(
            `FLUSH PRIVILEGES;`
        );

        await connection.end();

        return {
            DB_NAME: database_name,
            DB_USER: database_user,
            DB_PASSWORD: random_password
        }
    }
}

// ;(async () => {
//     console.log(
//         await GrizzyDatabaseEngine.provision_database()
//     );

//     console.log("We are done")
// })();

module.exports = { GrizzyDatabaseEngine }