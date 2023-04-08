const httpProxy = require('http-proxy');
const proxy = require('redbird')({
    port: process.env.PROXY_PORT || 3001
});

module.exports = {
    ReverseProxy: proxy,
    ForwardProxy: httpProxy.createProxyServer({ 
        target: process.env.PROVISIONING_ENGINE_ENDPOINT, ws 
    }).on("error", (e) => { console.log(e) })
}