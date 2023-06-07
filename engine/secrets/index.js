const crypto = require('crypto');
const fs = require('fs');
const CryptoJS = require("crypto-js");
const dotenv = require('dotenv')
const cryptoRandomString = require('crypto-random-string');

class GrizzySecretsManager {
    constructor(vaultKey, secrets = [], fresh = false) {
        this.vaultKey = fresh ? vaultKey : this.#decryptVaultKey(vaultKey);
        this.fresh = fresh;
        this.secrets = secrets;
    }

    static generateVaultKey() {
        const publicKey = fs.readFileSync('../../public_key.pem', 'utf8');

        const generated_key = cryptoRandomString({ length: 50 });

        return {
            raw_key: generated_key,
            encrypted_key: generated_key /*crypto.publicEncrypt(
                { key: publicKey },
                generated_key
            ).toString('utf8')*/
        }
    }

    #decryptVaultKey(vaultKey) {
        // const privateKey = fs.readFileSync('../../private_key.pem', 'utf8');

        // return crypto.privateDecrypt(
        //     {
        //       key: privateKey,
        //       passphrase: process.env.MASTER_PRIVATE_KEY_PASSWORD, // If the private key is encrypted with a passphrase
        //     },
        //     Buffer.from(vaultKey)
        // ).toString('utf8');

        return vaultKey;
    }

    generate_secrets_from_env_blob(env_blob) {
        const parsed = dotenv.parse(
            Buffer.from(env_blob)
        );

        this.secrets = Object.entries(parsed).map(([key, value]) => {
            return { key, value }
        });
    }

    // decrypt the vault key and use
    getProjectSecrets() {
        // get the secrets somehow --> i guess

        return this.secrets.map(
            ({ key, value }) => {
                return `${key}=${this.fresh ? value : CryptoJS.AES.decrypt(
                    value, this.vaultKey,
                ).toString(CryptoJS.enc.Utf8)}`
            }
        )
    }

    addProjectSecret(key, value) {
        const existsIndex = this.secrets.findIndex(({ key: _key }) => _key === key);

        value = CryptoJS.AES.encrypt(
            value, this.vaultKey
        );

        if (existsIndex > -1) {
            this.secrets[existsIndex].value = value;
            return;
        }

        this.secrets.push({ key, value })
    }

    // returns a formatted list of values that can be added to mongodb
    saveSecrets() {
        return this.fresh ? this.secrets.map(({ key, value }) => {
            return {
                key,
                value: CryptoJS.AES.encrypt(
                    value, this.vaultKey
                )
            }
        }) : this.secrets;
    }
}

module.exports = { GrizzySecretsManager }