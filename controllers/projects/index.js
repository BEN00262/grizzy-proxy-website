const { nanoid } = require('nanoid');

const ReverseProxy = require("../../services");
const { ProjectModel, SnapshotModel } = require("../../models");
const { massage_error, massage_response } = require("../../utils");

class ProjectController {
    static async createProject(req, res) {
        try {
            const { project_name } = req.body;

            const project = await ProjectModel.create({
               display_name: project_name,
               unique_name: nanoid(16),
            });

            return massage_response({ project }, res, 201)
        } catch(error) {
            return massage_error(error, res);
        }
    }

    static async deployProject(req, res) {
        // find a way to stream the reponse from the deployment stuff
        try {
            // find a way to pipe ws to this stuff :)
            // need to actually listen to and proxy the ws from the provisioning engine
            const { project_id } = req.params;
            const { deploy_template, repo_url } = req.body;

            await ProjectModel.findOneAndUpdate({ _id: project_id }, {
                deploy_template, repo_url,
            });

            // pass over to the provisioning engine ( passed in the next provisioning round )
            return massage_response({ status: true }, res);
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
            const { unique_name, port } = req.body;
    
            const assigned_url = `${unique_name}.${process.env.APP_DOMAIN}`;
    
            ReverseProxy.register(assigned_url, `http://localhost:${port}`);

            await ProjectModel.findOneAndUpdate({ unique_name, owner: req.user._id }, {
                public_uri: assigned_url
            });

            return massage_response({ assigned_url }, res, 201);
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