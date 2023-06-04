const proxy = require('redbird')({
    port: process.env.PROXY_PORT || 3001,

    // letsencrypt: {
    //     path: __dirname + '/certs',
    //     port: 9999 // LetsEncrypt minimal web server port for handling challenges. Routed 80->9999, no need to open 9999 in firewall. Default 3000 if not defined.
    // },

    // ssl: {
    //     http2: true,
    //     port: 443
    // },

    // cluster: 4
});

// const docker = require('redbird').docker;

module.exports = {
    ReverseProxy: proxy
}