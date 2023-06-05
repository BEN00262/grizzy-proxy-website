const { DomainsModel } = require('../../models');
const fs = require('fs');

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

// re-register previously registered domains
// TODO: properly implement this
;(async () => {
    const domains = await DomainsModel.find();

    for (const domain of (domains ?? [])) {
        if (domain.sub_domain && domain.port) {
            // register them
            proxy.register(`${domain.sub_domain}.grizzy-deploy.com`,  `http://127.0.0.1:${domain.port}`)
        }
    }
})()

// const docker = require('redbird').docker;
proxy.notFound(function (req, res){
    // render the 404 page here
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html');
    res.write(fs.readFileSync('./404.html', 'utf-8'));
    res.end();
});

module.exports = {
    ReverseProxy: proxy
}