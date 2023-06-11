// // DEPRACTED: this will be wiped --> we dont need redbird anymore -- switch to using traefik

// const { DomainsModel } = require('../../models');
// const fs = require('fs');
// const path = require('path');
// const Docker = require('dockerode');

// // TODO: switch to using traefik instead of this
// const proxy = require('redbird')({
//     port: process.env.PROXY_PORT || 3001,


//     ssl: {
//         http2: true,
//         port: 443
//     },

//     // cluster: 2
// });

// // re-register previously registered domains
// // TODO: properly implement this
// async function rehydrate_domains() {
//     try {
//         const docker = new Docker();
//         const domains = await DomainsModel.find();

//         for (const domain of (domains ?? [])) {
//             if (domain.sub_domain && domain.image_version_id) {
//                 // we know the image stuff here i think
//                 // register them

//                 // check if the image has a running container ( if not do not register this domain and delete the association )
//                 const containers = await docker.listContainers({
//                     // from the docs
//                     filters: JSON.stringify({
//                         // this works i think ( we need the version number )
//                         "ancestor": [domain.image_version_id]
//                     })
//                 });

//                 // and atleast one of the containers is running bind it
//                 if (containers.length) {
//                     let ports_for_domain = [];

//                     for (const container of containers) {
//                         if (container.State === 'running') {
//                             // mark them as running :)
//                             // get the container ports and stuff --> we can actually do load balancing here
//                             // running multiple instances i guess
//                             ports_for_domain.push(
//                                 ...container.Ports.map(({ PublicPort }) => PublicPort)
//                             );
//                         }
//                     }

//                     if (ports_for_domain.length) {
//                         // create a simple round robin load balancer
//                         for (const port of ports_for_domain) {
//                             // ssl is handled by aws automatically
//                             proxy.register(
//                                 `${domain.sub_domain}.grizzy-deploy.com`,
//                                 `http://127.0.0.1:${port}`
//                             )
//                         }
//                     }
//                 }
//             }
//         }
//     } catch (error) {

//     }
// }

// // const docker = require('redbird').docker;
// proxy.notFound(function (req, res){
//     // render the 404 page here
//     res.statusCode = 404;
//     res.setHeader('Content-Type', 'text/html');
//     res.write(fs.readFileSync(path.join(__dirname, '404.html'), 'utf-8'));
//     res.end();
// });

// module.exports = {
//     ReverseProxy: proxy,
//     rehydrate_domains
// }