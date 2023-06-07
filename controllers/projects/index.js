const dotenv = require('dotenv')

const ReverseProxy = require("../../services");
const { ProjectModel, VersionModel, SecretsModel } = require("../../models");
const { massage_error, massage_response, GrizzyDeployException, getUniqueSubdomainName } = require("../../utils");
const { DeploymentEngine } = require('../../engine');
const { GrizzySecretsManager } = require('../../engine/secrets');
const { TemplatesController } = require('../templates');
const { TemplateExecutionEngine } = require('../../engine/templates');

// during deployments --> we should get an archive of the container then store it in s3
// create versions

class ProjectController {
    // create and deploy a project at the same time
    static async getProjects(req, res) {
        try {

            const projects = await ProjectModel.find({
                owner: req.user._id
            });

            return massage_response({ projects }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }

    static async createProject(req, res) {
        try {
            const { 
                project_name, deployment_type, 
                repo_url, template, env_keys /* a blob of text matching ENV_KEY=ENV_VALUE format */
            } = req.body;

            const unique_project_name = `${project_name}-${getUniqueSubdomainName()}`.toLowerCase();

            const vault_key = GrizzySecretsManager.generateVaultKey();

            // save the versions for this for later
            const project = await ProjectModel.create({
               unique_name: unique_project_name,
               repo_url, deployment_type, template,
               vault_key: vault_key.encrypted_key
            //    owner: req.user._id
            });

            // generate a config
            let config = {
                // the template is execute through the templates engine 
                // the generated template is then used to generate the containers

                template: async (folder) => TemplateExecutionEngine.execute_template(
                    await TemplatesController.getTemplate(template, req.user), folder
                ),
            };

            switch(deployment_type) {
                case 'git':
                    config = { ...config, repo_url };
                    break;

                case 'zip':
                    config = { ...config, zip_file_buffer: req.file.buffer };
                    break;

                case 'folder':
                    // config = {};
                    break;

                default:
                    throw new GrizzyDeployException("Invalid deployment type. Should either be zip, folder or git")
            }

            // gets the logs -- we should save them i think
            // get the archive of the project
            // we need to get any project keys present for this project
            const secrets_manager = new GrizzySecretsManager(vault_key.raw_key, [], true /* this is a fresh key */);
            secrets_manager.generate_secrets_from_env_blob(env_keys ?? "");

            const secrets = secrets_manager.saveSecrets() ?? [];

            if (secrets?.length) {
                await SecretsModel.insertMany(
                    secrets.map(x => ({ ...x, project: project._id }))
                );
            }

            const { ports, image_version_id, logs } = await DeploymentEngine.deploy(
                unique_project_name, deployment_type, config, secrets_manager
            );

            // update the metadata
            // fix the logs streaming
            const _version = await VersionModel.create({ 
                image_version_id, logs, project: project._id 
            })

            // check if this is an active release
            if (Array.isArray(ports) && ports.length /* active release */) {
                await ProjectModel.findOneAndUpdate({ active_version: _version._id }, {
                    _id: project._id
                });
            }

            // pass over to the provisioning engine ( passed in the next provisioning round )
            return massage_response({ 
                status: true,
                deployment_url: `https://${unique_project_name}.grizzy-deploy.com`
            }, res, 201);
        } catch(error) {
            console.log(error)
            return massage_error(error, res);
        }
    }

    // check if there is a project with the suggested name already exisiting
    // static async checkIfProjectNameAvailable(req, res) {
    //     try {
    //         // check if the passed name already exists
    //         const project_name = req.params.project_name;

    //         const already_existing_project_with_name = await ProjectModel.count({
    //             display_name: project_name
    //         });

    //         return massage_response({
    //             is_project_name_already_taken: already_existing_project_with_name > 0
    //         }, res);
    //     } catch (error) {
    //         return massage_error(error, res);
    //     }
    // }

    // get the zip file using multer
    // used for updates later
    // TODO: refactor this to avoid Repeat
    static async deployProject(req, res) {
        // find a way to stream the reponse from the deployment stuff
        try {
            // find a way to pipe ws to this stuff :)
            // need to actually listen to and proxy the ws from the provisioning engine
            const { unique_project_name } = req.params;

            const { 
                deployment_type, deploy_template, repo_url,
                template_to_use, version
            } = req.body;

            await ProjectModel.findOneAndUpdate({ 
                unique_name: unique_project_name /*, owner: req.user._id*/ 
            }, {
                template: deploy_template, repo_url,
                deployment_type
            }, { $new: true });

            // generate a config
            let config = {
                template_to_use,
                template_version: version
            };

            switch(deployment_type) {
                case 'git':
                    config = { repo_url };
                    break;

                case 'zip':
                    config = { zip_file_buffer: req.file.buffer };
                    break;

                case 'folder':
                    config = {};
                    break;

                default:
                    throw new GrizzyDeployException("Invalid deployment type. Should either be zip, folder or git")
            }

            // gets the logs -- we should save them i think
            // get the archive of the project
            const { ports, image_version_id, logs } = await DeploymentEngine.deploy(
                unique_project_name, deployment_type, config
            );

            // update the metadata
            const _version = await VersionModel.create({ image_version_id, logs, project: project._id })

            // check if this is an active release
            if (Array.isArray(ports) && ports.length /* active release */) {
                await ProjectModel.findOneAndUpdate({ active_version: _version._id }, {
                    _id: project._id
                });
            }

            // pass over to the provisioning engine ( passed in the next provisioning round )
            return massage_response({ 
                status: true,
                deployment_url: `http://${unique_project_name}.grizzy-deploy.com`
            }, res, 201);
        } catch(error) {
            return massage_error(error, res);
        }
    }

    static async getProjectVersions(req, res) {
        try {
            const project = await ProjectModel.find({
                unique_name: req.params.unique_project_name,
                owner: req.user._id
            }).populate('versions');


            return massage_response({ 
                versions: project?.versions ?? [] 
            }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }


    // work on this guy
    static async deleteProject(req, res) {
        try {
            const { unique_project_name } = req.params;

            const project = await ProjectModel.findOne({ 
                unique_name: unique_project_name,
                owner: req.user._id
            });

            if (project) {
                // delete all the versions
                await VersionModel.deleteMany({
                    _id: { '$in': project.versions }
                });

                // get any running containers for this and delete them

                for (const local_uri of project?.local_uri) {
                    // find a way to properly do this
                    ReverseProxy.unregister(project?.public_uri, local_uri)
                }

                // send a delete message to the provisioning engine

                // wipe the record
                await ProjectModel.deleteOne({  _id: project_id })
            }
    
            return massage_response({ status: true }, res);
        } catch(error) {
    
        }
    }
}


module.exports = { ProjectController }