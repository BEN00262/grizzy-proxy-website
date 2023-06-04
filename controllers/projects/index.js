const { nanoid } = require('nanoid');
const { snakeCase } = require("snake-case");

const ReverseProxy = require("../../services");
const { ProjectModel, VersionModel } = require("../../models");
const { massage_error, massage_response, GrizzyDeployException } = require("../../utils");
const { DeploymentEngine } = require('../../engine');

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
                repo_url, template_to_use, version
            } = req.body;

            const unique_project_name = snakeCase(`${project_name}_${nanoid(8)}`);

            // save the versions for this for later
            const project = await ProjectModel.create({
               unique_name: unique_project_name,
               repo_url, deployment_type,
               template: { template_name: template_to_use, version },
               owner: req.user._id
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
            // get the archive of the project
            const container_archive = await DeploymentEngine.deploy(
                unique_project_name, deployment_type, config
            );

            // pass over to the provisioning engine ( passed in the next provisioning round )
            return massage_response({ 
                status: true,
                deployment_url: `http://${unique_project_name}.grizzy-deploy.com`
            }, res, 201);
        } catch(error) {
            console.log(error)
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

            await ProjectModel.findOneAndUpdate({ _id: project_id, owner: req.user._id }, {
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