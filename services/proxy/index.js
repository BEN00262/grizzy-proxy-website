const proxy = require('redbird')({
    port: process.env.PROXY_PORT || 3001,
    ssl: {
        http2: true,
        port: 443
    }
});

// const docker = require('redbird').docker;

module.exports = {
    ReverseProxy: proxy
}