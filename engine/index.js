const tmp = require('tmp-promise');
const path = require('path');
const fs = require('fs/promises');
const decompress = require('decompress');

const { SimpleHosterDocker } = require("./docker");
const { SimpleHosterGit } = require("./git");
const { ReverseProxy } = require('../services');
const { GrizzyDeployException } = require('../utils');
const { DomainsModel } = require('../models');
const { snakeCase } = require('snake-case');

class DeploymentEngine {
    constructor() {
        this.git = new SimpleHosterGit();
        this.docker = new SimpleHosterDocker();
    }

    async deploy(app_name, type /* git | zip | folder */, configs, secrets_manager, logs_handler) {
        let instance_results = {};
        
        const _app_name = snakeCase(app_name);

        switch (type) {
            case 'git':
                instance_results = await this.#deployFromGit(
                    _app_name, configs /*repo_url, template_to_use, version*/, 
                    secrets_manager, logs_handler
                );
                break;

            case 'zip':
                instance_results = await this.#deployFromZip(
                    _app_name, configs /* zip_file_buffer, template_to_use, version */, 
                    secrets_manager, logs_handler
                );
                break;

            case 'wordpress':
                instance_results = await this.#deployWordpress(
                    _app_name, configs, 
                    secrets_manager, logs_handler
                );
                break;
            default:
                throw new Error('Unsupported deployment type');
        }

        if (Array.isArray(instance_results?.ports) && instance_results?.ports.length) {
            // attach the url at this point
            // store a list of these in the db for reregistration on bootup
            for (const port of instance_results?.ports) {
                // ssh has been automatically catered for by AWS
                ReverseProxy.register(`${app_name}.grizzy-deploy.com`,  `http://127.0.0.1:${port}`);
            }

            // save the registration for rebootup
            await DomainsModel.create({ 
                sub_domain: app_name, 
                image_version_id: instance_results?.image_version_id
            });
        }

        return instance_results;
    }

    async #deployWordpress(app_name, configs, secrets_manager, logs_handler) {
        const { cleanup, path: directory_path } = await tmp.dir({
            keep: false,
            prefix:  'deploy-',
            unsafeCleanup: true
        });

        const { parsed_template, env } = await configs.template(directory_path);

        await fs.writeFile(
            path.join(directory_path, 'Dockerfile'),
            parsed_template
        );

        // deploy the code
        const {ports, image_version_id, logs } = await this.docker.createImage(
            app_name, // name of the app to be deployed
            directory_path, // the temp directoru holding our code while we are doing deployments
            [...env, ...secrets_manager.getProjectSecrets()], logs_handler,
            logs_handler, true, // run by default
        );

        // wipe the temp directory on exit
        await cleanup();

        return { ports, image_version_id, logs };
    }

    // deploy from git
    async #deployFromZip(app_name /* this is the name of the image too */, configs, secrets_manager, logs_handler) {
        const { cleanup, path: directory_path } = await tmp.dir({
            keep: false,
            prefix:  'deploy-',
            unsafeCleanup: true
        });

        if (!Buffer.isBuffer(configs.zip_file)) {
            throw new Error("Expected a file buffer")
        }

        await decompress(configs.zip_file, directory_path);

        const { parsed_template, env } = await configs.template(directory_path);

        await fs.writeFile(
            path.join(directory_path, 'Dockerfile'),
            parsed_template
        );

        // deploy the code
        const { ports, image_version_id, logs } = await this.docker.createImage(
            app_name, // name of the app to be deployed
            directory_path, // the temp directoru holding our code while we are doing deployments
            [...env, ...secrets_manager.getProjectSecrets()],
            logs_handler, true, // run by default
        );

        // pass the image name to redbird to assign it
        
        // wipe the temp directory on exit
        await cleanup();

        return { ports, image_version_id, logs };
    }

    // deploy from git
    async #deployFromGit(app_name /* this is the name of the image too */, configs, secrets_manager, logs_handler) {
        try {
            const { cleanup, path: directory_path } = await tmp.dir({
                keep: false,
                prefix:  'deploy-',
                unsafeCleanup: true
            });
    
            await this.git.pullRepo(directory_path, configs.repo_url);

            const { parsed_template, env } = await configs.template(directory_path);

            await fs.writeFile(
                path.join(directory_path, 'Dockerfile'),
                parsed_template
            );
    
            // deploy the code
            const {ports, image_version_id, logs } = await this.docker.createImage(
                app_name,
                directory_path,
                [...env, ...secrets_manager.getProjectSecrets()],
                logs_handler, true, // run by default
            );
            
            // wipe the temp directory on exit
            await cleanup();
    
            return { ports, image_version_id, logs };
        } catch(error) {
            console.log(error)
        }
    }
}

module.exports = {
    // this should just work
    DeploymentEngine: new DeploymentEngine()    
}