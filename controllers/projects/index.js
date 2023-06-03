const { nanoid } = require('nanoid');
const { snakeCase } = require("snake-case");

const ReverseProxy = require("../../services");
const { ProjectModel } = require("../../models");
const { massage_error, massage_response, GrizzyDeployException } = require("../../utils");
const { DeploymentEngine } = require('../../engine');

class ProjectController {
    // create and deploy a project at the same time

    static async createProject(req, res) {
        try {
            const { 
                project_name, deployment_type, 
                repo_url, template_to_use, version
            } = req.body;

            const unique_project_name = snakeCase(`${project_name}_${nanoid(8)}`);

            await ProjectModel.create({
               unique_name: unique_project_name,
               repo_url, deployment_type,
               template: { template_name: template_to_use, version }
            });

            // generate a config
            let config = {
                template_to_use,
                template_version: version
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
            await DeploymentEngine.deploy(
                unique_project_name, deployment_type, config
            );

            // pass over to the provisioning engine ( passed in the next provisioning round )
            return massage_response({ 
                status: true,
                deployment_url: `https://${unique_project_name}.grizzy-deploy.com`
            }, res, 201);
        } catch(error) {
            return massage_error(error, res);
        }
    }

    // check if there is a project with the suggested name already exisiting
    static async checkIfProjectNameAvailable(req, res) {
        try {
            // check if the passed name already exists
            const project_name = req.params.project_name;

            const already_existing_project_with_name = await ProjectModel.count({
                display_name: project_name
            });

            return massage_response({
                is_project_name_already_taken: already_existing_project_with_name > 0
            }, res);
        } catch (error) {
            return massage_error(error, res);
        }
    }

    // get the zip file using multer
    // used for updates later
    static async deployProject(req, res) {
        // find a way to stream the reponse from the deployment stuff
        try {
            // find a way to pipe ws to this stuff :)
            // need to actually listen to and proxy the ws from the provisioning engine
            const { project_id } = req.params;
            const { 
                deployment_type, deploy_template, repo_url,
                template_to_use, version
            } = req.body;

            await ProjectModel.findOneAndUpdate({ _id: project_id }, {
                template: deploy_template, repo_url,
                deployment_type
            });

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

            await DeploymentEngine.deploy(
                project_id, deployment_type, config
            );

            // pass over to the provisioning engine ( passed in the next provisioning round )
            return massage_response({ 
                status: true,
                deployment_url: `${project_id}.grizzy-deploy.com`
            }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }

    static async getProjectBackups(req, res) {
        try {
            // fetch snapshots attached to a given project
            const project = await ProjectModel.find({
                project: req.params.project_id,
                owner: req.user._id
            }).populate('snapshots');


            return massage_response({ 
                snapshots: project?.snapshots ?? [] 
            }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }

    static async registerSubdomain(req, res) {
        try {
            // const { unique_name, port } = req.body;
    
            // const assigned_url = `${unique_name}.${process.env.APP_DOMAIN}`;
    
            // ReverseProxy.register(assigned_url, `http://localhost:${port}`);

            // await ProjectModel.findOneAndUpdate({ unique_name, owner: req.user._id }, {
            //     public_uri: assigned_url
            // });

            // return massage_response({ assigned_url }, res, 201);
        } catch(error) {
            return massage_error(error, res);
        }
    }


    static async deleteProject(req, res) {
        try {
            const { project_id } = req.params;

            const project = await ProjectModel.findOne({ _id: project_id });

            if (project) {
                for (const local_uri of project?.local_uri) {
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