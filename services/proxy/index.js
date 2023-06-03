const proxy = require('redbird')({
    port: process.env.PROXY_PORT || 3001
});

// const docker = require('redbird').docker;

module.exports = {
    ReverseProxy: proxy
}