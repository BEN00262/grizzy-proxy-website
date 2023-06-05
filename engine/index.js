const tmp = require('tmp-promise');
const path = require('path');
const fs = require('fs/promises');
const decompress = require('decompress');

const { SimpleHosterDocker } = require("./docker");
const { SimpleHosterGit } = require("./git");
const { ReverseProxy } = require('../services');
const { GrizzyDeployException } = require('../utils');
const { DomainsModel } = require('../models');

class DeploymentEngine {
    constructor() {
        this.git = new SimpleHosterGit();
        this.docker = new SimpleHosterDocker();
    }

    async deploy(app_name, type /* git | zip | folder */, configs = {}) {
        let port = null;
        
        switch (type) {
            case 'git':
                port = await this.#deployFromGit(app_name, configs /*repo_url, template_to_use, version*/);
                break;
            case 'zip':
                port = await this.#deployFromZip(app_name, configs /* zip_file_buffer, template_to_use, version */);
                break;
            default:
                throw new Error('Unsupported deployment type');
        }

        if (port) {
            // attach the url at this point
            // store a list of these in the db for reregistration on bootup
            ReverseProxy.register(`${app_name}.grizzy-deploy.com`,  `http://127.0.0.1:${port}`, {
                // check if they want ssl enabled, if so anable

                // implement later when we actually get a domain
                // ssl: {
                //     letsencrypt: {
                //         email: "johnnesta2018@gmail.com", // process.env.LETSENCRYPT_EMAIL,
                //         production: true
                //     }
                // }
            })

            // save the registration for rebootup
            await DomainsModel.create({
                sub_domain: app_name,
                port
            });
        } else {
            throw new GrizzyDeployException("Failed to generate port");
        }
    }

    // deploy from git
    async #deployFromZip(app_name /* this is the name of the image too */, configs = {}) {
        const { cleanup, path: directory_path } = await tmp.dir({
            keep: false,
            prefix:  'deploy-',
            unsafeCleanup: true
        });

        if (!Buffer.isBuffer(configs.zip_file)) {
            throw new Error("Expected a file buffer")
        }

        await decompress(configs.zip_file, directory_path);

        await fs.writeFile(
            path.join(directory_path, 'Dockerfile'),

            // generate deployment scripts
            await this.#loadDeploymentTemplate(
                configs.template_to_use, 
                directory_path, 
                { version: configs.version }
            )
        );

        // deploy the code
        const port = await this.docker.createImage(
            app_name, // name of the app to be deployed
            directory_path, // the temp directoru holding our code while we are doing deployments
            true // run by default
        );

        // pass the image name to redbird to assign it
        
        // wipe the temp directory on exit
        await cleanup();

        return port;
    }

    // deploy from git
    async #deployFromGit(app_name /* this is the name of the image too */, configs = {}) {
        try {
            const { cleanup, path: directory_path } = await tmp.dir({
                keep: false,
                prefix:  'deploy-',
                unsafeCleanup: true
            });
    
            await this.git.pullRepo(directory_path, configs.repo_url);
    
            await fs.writeFile(
                path.join(directory_path, 'Dockerfile'),
    
                // generate the deployment scripts
                await this.#loadDeploymentTemplate(
                    configs.template_to_use, 
                    directory_path, 
                    { version: configs.version }
                )
            );
    
            // deploy the code
            const port = await this.docker.createImage(
                app_name, // name of the app to be deployed
                directory_path, // the temp directoru holding our code while we are doing deployments
                true // run by default
            );
            
            // wipe the temp directory on exit
            await cleanup();
    
            return port;
        } catch(error) {
            console.log(error)
        }
    }

    async #loadDeploymentTemplate(runtime, tmp_folder, context = {}) {
        const template = require(
            // go to the directory where we have the templates
            path.join(__dirname, 'templates', `${runtime}.js`)
        );

        return template.generate_deployment_script(context, tmp_folder)
    }
}

module.exports = {
    // this should just work
    DeploymentEngine: new DeploymentEngine()    
}