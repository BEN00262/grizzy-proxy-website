// const ReverseProxy = require("../../services");
const humanTime = require('human-time');
const { 
    ProjectModel, VersionModel, SecretsModel 
} = require("grizzy-deploy-shared/models");

const { 
    massage_error, massage_response, 
    GrizzyDeployException, getUniqueSubdomainName, 
    check_if_objects_are_similar: check_if_objects_are_not_similar 
} = require("grizzy-deploy-shared/utils");

const { GrizzySecretsManager } = require('grizzy-deploy-shared/engine/secrets');
// move this to the shared package
const {sendToDeploymentQueue} = require('grizzy-deploy-shared/queues/client');
const { DeploymentEngine } = require("grizzy-deploy-shared/engine");

// during deployments --> we should get an archive of the container then store it in s3
// create versions

class ProjectController {
    // create and deploy a project at the same time
    static async getMyProjects(req, res) {
        try {
            let { status } = req.query;

            if (status && !["paused", "running", "all"].includes(status)) {
                throw new GrizzyDeployException("Invalid status")
            }

            status = status === "all" ? null : status;
            
            const projects = await ProjectModel.find({
                // owner: req.user._id
                ...(status ? { status }: {})
            }).select("_id unique_name createdAt").lean();


            return massage_response({ 
                projects: (projects ?? []).map(({ unique_name, _id, createdAt }) => {
                    return {
                        reference: _id,
                        unique_name,
                        url: `https://${unique_name}.grizzy-deploy.com`,
                        createdAt: humanTime(new Date(createdAt))
                    }
                })
            }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }

    static async changeProjectStatus(req, res) {
        try {
            // get the status change we want and then execute that
            const { status, application_reference } = req.params;

            // get the application to update its status after the pausing has happened
            const project = await ProjectModel.findOne({ 
                _id: application_reference 
            }).populate('active_version');

            // ensure the active version has an actual image id
            if (["pause", "unpause"].includes(status) && project?.active_version?.image_version_id) {
                await DeploymentEngine.change_status(
                    status,
                    project?.active_version?.image_version_id
                );

                await ProjectModel.findByIdAndUpdate({ _id: project._id }, {
                    $set: {
                        status: status === 'pause' ? 'paused' : 'running'
                    }
                })
            }

            return massage_response({ status: true }, res);
        } catch (error) {
            return massage_error(error, res);
        }
    }

    static async createProject(req, res) {
        try {
            const { 
                project_name, deployment_type, 
                repo_url, template, env_keys /* a blob of text matching ENV_KEY=ENV_VALUE format */
            } = req.body;

            // check if the project name already exists if so this is a redeployment
            let project = await ProjectModel.findOne({ unique_name: project_name });
            let is_clean_deployment = false;

            let vault_key = project?.vault_key;
            let unique_project_name = project?.unique_name;

            if (!project) {
                unique_project_name = `${project_name}-${getUniqueSubdomainName()}`.toLowerCase();
                is_clean_deployment = true;

                vault_key = GrizzySecretsManager.generateVaultKey();

                // save the versions for this for later
                project = await ProjectModel.create({
                    unique_name: unique_project_name,
                    repo_url, deployment_type, template,
                    vault_key: vault_key.encrypted_key
                    //    owner: req.user._id
                });
            } else {
                // update anything incase of a change
                if (
                    check_if_objects_are_not_similar(
                        { repo_url, deployment_type, template },
                        { 
                            repo_url: project.repo_url, 
                            deployment_type: project.deployment_type, 
                            template: project.template 
                        }
                    )
                ) {
                    project = await ProjectModel.findOneAndUpdate({ _id: project._id }, {
                        $set: { repo_url, deployment_type, template }
                    }, { $new: true });
                }
            }

            // generate a config
            let config = { 
                template_id: template, 
                unique_project_name, 
                deployment_type 
            };

            switch(deployment_type) {
                case 'git':
                    config = { ...config, repo_url };
                    break;

                case 'zip':
                    config = { ...config, zip_file_buffer: req.file.buffer };
                    break;

                case 'wordpress':
                    break;

                case 'folder':
                    // config = {};
                    break;

                default:
                    throw new GrizzyDeployException("Invalid deployment type. Should either be zip, folder or git")
            }

            // we need to get any project keys present for this project
            // if its not a clean deployment we might be overwritting some keys --> take this into consideration
            let previous_secrets = []; // if its a redeployment

            if (!is_clean_deployment) {
                // redeployment
                previous_secrets = await SecretsModel.find({ project: project._id }).lean();
            }

            const secrets_manager = new GrizzySecretsManager(
                is_clean_deployment ? vault_key.raw_key : vault_key, previous_secrets, 
                is_clean_deployment /* this is a fresh key */
            );

            secrets_manager.generate_secrets_from_env_blob(env_keys ?? "");

            const secrets = secrets_manager.saveSecrets() ?? [];

            if (secrets?.length) {
                await SecretsModel.insertMany(
                    secrets.map(x => ({ ...x, project: project._id })),
                    {
                        upsert: true, // Perform an upsert operation
                        setDefaultsOnInsert: true, // Set default values for new documents
                    }
                );
            }

            let build_config = {
                user: { _id: req?.user?._id },
                ...config,
            }

            const _version = await VersionModel.create({ project });

            // pass the job to the rabbitmq service
            await sendToDeploymentQueue({ 
                project: project._id,
                build_config, 
                vault_key: is_clean_deployment ? vault_key.encrypted_key : vault_key,
                version: _version._id
            });

            return massage_response({ 
                state: 'deploying',
                version: _version._id // used to track the deployment we are doing 
            }, res, 202 /* accepted but awaiting processing */);
        } catch(error) {
            console.log(error)
            return massage_error(error, res);
        }
    }

    static async getProjectVersions(req, res) {
        try {
            // max of 5 versions
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

            // if (project) {
            //     // delete all the versions
            //     await VersionModel.deleteMany({
            //         _id: { '$in': project.versions }
            //     });

            //     // get any running containers for this and delete them

            //     for (const local_uri of project?.local_uri) {
            //         // find a way to properly do this
            //         ReverseProxy.unregister(project?.public_uri, local_uri)
            //     }

            //     // send a delete message to the provisioning engine

            //     // wipe the record
            //     await ProjectModel.deleteOne({  _id: project_id })
            // }
    
            return massage_response({ status: true }, res);
        } catch(error) {
    
        }
    }
}


module.exports = { ProjectController }