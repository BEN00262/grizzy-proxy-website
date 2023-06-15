const tmp = require('tmp-promise');
const path = require('path');
const fs = require('fs/promises');
const decompress = require('decompress');

const { SimpleHosterDocker } = require("./docker");
const { SimpleHosterGit } = require("./git");
// const { DomainsModel } = require('../models');
const { GrizzyInternalDeploymentException } = require('../utils');

class DeploymentEngine {
    constructor() {
        this.git = new SimpleHosterGit();
        this.docker = new SimpleHosterDocker();
    }

    async change_status(status, image_version_id) {
        try {
            switch (status) {
                case 'pause':
                    await this.docker.pauseApplication(image_version_id);
                    break;
                case 'unpause':
                    await this.docker.unpauseApplication(image_version_id);
                    break;
                default:
                    throw new GrizzyDeployException("Invalid status change")
            }
        } catch (error) {
            if (error instanceof GrizzyDeployException) {
                throw error;
            }

            throw new GrizzyInternalDeploymentException(error.message);
        }
    }

    async deploy(
        app_name, type /* git | zip | folder */, 
        configs, secrets_manager
    ) {
        let instance_results = {};
        
        // const _app_name = snakeCase(app_name);

        switch (type) {
            case 'git':
                instance_results = await this.#deployFromGit(
                    app_name, configs /*repo_url, template_to_use, version*/, 
                    secrets_manager
                );
                break;

            case 'zip':
                instance_results = await this.#deployFromZip(
                    app_name, configs /* zip_file_buffer, template_to_use, version */, 
                    secrets_manager
                );
                break;

            case 'wordpress':
                instance_results = await this.#deployWordpress(
                    app_name, configs, 
                    secrets_manager
                );
                break;
            default:
                throw new Error('Unsupported deployment type');
        }

        return instance_results;
    }

    async #deployWordpress(
        app_name, configs, 
        secrets_manager
    ) {
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
        const {image_version_id, logs } = await this.docker.createImage(
            app_name, // name of the app to be deployed
            directory_path, // the temp directoru holding our code while we are doing deployments
            [...env, ...secrets_manager.getProjectSecrets()], 
            true, // run by default
        );

        // wipe the temp directory on exit
        await cleanup();

        return { image_version_id, logs };
    }

    // deploy from git
    async #deployFromZip(
        app_name /* this is the name of the image too */, configs, 
        secrets_manager
    ) {
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
        const { image_version_id, logs } = await this.docker.createImage(
            app_name, // name of the app to be deployed
            directory_path, // the temp directoru holding our code while we are doing deployments
            [...env, ...secrets_manager.getProjectSecrets()],
            true, // run by default
        );

        // pass the image name to redbird to assign it
        
        // wipe the temp directory on exit
        await cleanup();

        return { image_version_id, logs };
    }

    // deploy from git
    async #deployFromGit(
        app_name /* this is the name of the image too */, configs, 
        secrets_manager
    ) {
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
            const { image_version_id, logs } = await this.docker.createImage(
                app_name,
                directory_path,
                [...env, ...secrets_manager.getProjectSecrets()],
                true, // run by default
            );
            
            // wipe the temp directory on exit
            await cleanup();
    
            return { image_version_id, logs };
        } catch(error) {
            console.log(error)
        }
    }
}

module.exports = {
    // this should just work
    DeploymentEngine: new DeploymentEngine()    
}