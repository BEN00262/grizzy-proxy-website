const amqp = require('amqplib/callback_api');

const sendToDeploymentQueue = ({ 
    project, build_config, 
    vault_key, version
}) => new Promise((resolve,reject) => {
    amqp.connect(process.env.AMQP_SERVER_URI, (error0, connection) => {
        if (error0) { reject(error0); }

        connection.createChannel((error1, channel) => {
            if (error1){ reject(error1); }

            channel.assertQueue(process.env.DEPLOYMENT_QUEUE, { durable: true });

            channel.sendToQueue(
                process.env.DEPLOYMENT_QUEUE,
                Buffer.from(
                    JSON.stringify({ 
                        project, build_config, 
                        vault_key, version
                    })
                ), 
                { persistent: true }
            );

            resolve(true);
        });
    })
});

module.exports = sendToDeploymentQueue;