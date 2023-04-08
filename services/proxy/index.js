const proxy = require('redbird')({
    port: process.env.PROXY_PORT || 3001
});

module.exports = {
    ReverseProxy: proxy
}