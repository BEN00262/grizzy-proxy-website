// responsible for processing the jobs sent to it
require('dotenv').config({
    path: require('find-config')('.env')
});

const amqb = require('amqplib/callback_api');
const mongoose = require('mongoose');
// const socket = require('socket.io')();

const { TemplateExecutionEngine } = require('grizzy-deploy-shared/engine/templates');
const { DeploymentEngine } = require('grizzy-deploy-shared/engine');
const { 
    VersionModel, ProjectModel, SecretsModel
} = require('grizzy-deploy-shared/models');
const { GrizzySecretsManager } = require('grizzy-deploy-shared/engine/secrets');
const { GrizzyInternalDeploymentException } = require('grizzy-deploy-shared/utils');
const { TemplatesGenerator } = require('./utils');

// we create socket connections where someone can turn to and listen on
// we can actually do builds of react deployments --- yeeeay
// socket.listen(8888);

// start mongodb connection first
;(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI)

        amqb.connect(process.env.AMQP_SERVER_URI,function (error0, connection){
            console.log("Started the consumer");
        
            if (error0){ throw error0; }
        
            connection.createChannel((error1, channel) => {
                if (error1){ throw error1; }
        
                channel.assertQueue(process.env.DEPLOYMENT_QUEUE, { durable: true });
        
                channel.prefetch(1);
        
                channel.consume(process.env.DEPLOYMENT_QUEUE, async msg => {
                    try {
                        const { 
                            project, build_config, 
                            vault_key, version 
                        } = JSON.parse(msg.content.toString());

                        console.log({ 
                            project, build_config, 
                            vault_key, version 
                        })
        
                        let config = {
                            ...build_config,
                            template: async (folder) => TemplateExecutionEngine.execute_template(
                                await TemplatesGenerator.getTemplate(
                                    build_config.template_id, build_config.user
                                ), folder
                            ),
                        }
        
                        // get the project secrets
                        const secrets = await SecretsModel.find({ project }).lean();
        
                        const secrets_manager = new GrizzySecretsManager(
                            vault_key, secrets ?? []
                        );
        
                        try {
                            const { image_version_id, logs } = await DeploymentEngine.deploy(
                                build_config.unique_project_name, 
                                build_config.deployment_type, config, 
                                secrets_manager
                            );
        
                            await Promise.all([
                                VersionModel.findOneAndUpdate({ _id: version }, {
                                    $set: {
                                        status: 'deployed',
                                        image_version_id,
                                        logs
                                    }
                                }),
        
                                ProjectModel.findOneAndUpdate({ _id: project }, {
                                    $set: { status: 'running' }
                                })
                            ]);
            
                            // check if this is an active release
                            await ProjectModel.findOneAndUpdate(
                                { active_version: version }, 
                                { _id: project }
                            );
                        } catch (error) {
                            // check the type of error thrown --> is it a genuine Deployment failure for some reason
                            if (error instanceof GrizzyInternalDeploymentException) {
                                await VersionModel.findOneAndUpdate({ _id: version }, {
                                    $set: {
                                        status: 'failed'
                                    }
                                })
                            }
        
                            // rethrow the error for the other guys
                            throw error;
                        } finally  {
                            // kill the connection in socket io
                            socket.emit(version, { log: null, status: 'done' })
                        }
        
                        channel.ack(msg);
                    } catch (error) {
                        // if there is a crash, dont acknowledge the error rather let the job repeat
        
                        console.log(error);
                    }
                }, { noAck: false });
            })
        });

    } catch (error) {
        console.log(error);
    }
})();