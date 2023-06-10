// responsible for processing the jobs sent to it
require('dotenv').config({
    path: require('find-config')('.env')
});

const amqb = require('amqplib/callback_api');
const socket = require('socket.io')();

const { TemplateExecutionEngine } = require('../engine/templates');
const { TemplatesController } = require('../controllers/templates');
const { DeploymentEngine } = require('../engine');
const { VersionModel, ProjectModel, SecretsModel, VersionLogModel } = require('../models');

// we create socket connections where someone can turn to and listen on
// we can actually do builds of react deployments --- yeeeay
socket.listen(8888);

amqb.connect(process.env.AMQP_SERVER_URI,function (error0, connection){
    console.log("Started the consumer");
    
    if (error0){ throw error0; }

    connection.createChannel((error1, channel) => {
        if (error1){ throw error1; }

        channel.assertQueue(process.env.DEPLOYMENT_QUEUE, { durable: true });

        channel.prefetch(1);

        channel.consume(process.env.DEPLOYMENT_QUEUE, async msg => {
            try {
                const { project, build_config, vault_key } = JSON.parse(msg.content.toString());

                let config = {
                    ...build_config,
                    template: async (folder) => TemplateExecutionEngine.execute_template(
                        await TemplatesController.getTemplate(
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
                    const { ports, image_version_id } = await DeploymentEngine.deploy(
                        build_config.unique_project_name, 
                        build_config.deployment_type, config, 
                        secrets_manager, async (log) => {
                            await VersionLogModel.create({ log, version });
                            socket.emit(version, { log, status: 'continue' });
                        }
                    );

                    await VersionModel.findOneAndUpdate({ _id: version }, {
                        $set: {
                            status: 'deployed',
                            image_version_id
                        }
                    })
    
                    // check if this is an active release
                    if (Array.isArray(ports) && ports.length /* active release */) {
                        await ProjectModel.findOneAndUpdate({ active_version: _version._id }, {
                            _id: project
                        });
                    }

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