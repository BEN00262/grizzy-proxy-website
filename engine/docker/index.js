const Docker = require('dockerode');
const portfinder = require('portfinder');
const tar = require('tar-fs');
const { nanoid } = require('nanoid');
const { snakeCase } = require('snake-case');
const { GrizzyDeployException, GrizzyInternalDeploymentException } = require('../../utils');

portfinder.setBasePort(3001);

function mbs_to_bytes(mb) {
    return mb * (1024 ** 2)
}

class SimpleHosterDocker {
    constructor() {
      this.docker = new Docker();
    }

    // missing functionalities
    // snapshoting and storing the snapshot in s3 | replay the snapshot later
    // TODO: implement this later on

    // returns the port the container is running in
    async createContainerAndStart(app_name, secrets_manager, not_sure_exists_locally = false) {
        // we can check if the image does exist locally if not pull it from the private repo
        const _app_name = snakeCase(app_name);

        if (not_sure_exists_locally) {
            // check if the image exists locally
            const local_image = (await this.docker.getImage(_app_name).inspect())?.Id;

            if (!local_image) {
                const pull_stream = await this.docker.pull(`${process.env.DOCKERHUB_USERNAME}/${_app_name}:latest`, {
                    authconfig: {
                        username: process.env.DOCKERHUB_USERNAME,
                        password: process.env.DOCKERHUB_PASSWORD,
                    }
                });

                await new Promise((resolve, reject) => {
                    this.docker.modem.followProgress(pull_stream, (err, res) => {
                        if (err) {
                            reject(err);
                        }
    
                        resolve(res);
                    });
                });
            }
        }
        
        // const generated_port = await portfinder.getPortPromise();

        // start using traefik to automatically register containers with domains

        const container = await this.docker.createContainer({
            Image: _app_name, // image to spin up

            // HANDLED BY TRAEFIK
            // ExposedPorts: {
            //     "3000/tcp": {}
            // },

            // we can also pass env keys pretty easily
            // find a way to store env keys securely and load them to the container
            // resolve the project secrets somehow
            Env: secrets_manager,
            // fix the app name --> just pass it the way it is only 
            Labels: {
                'traefik.enable': 'true',
                [`traefik.http.routers.${app_name}.rule`]: `Host(\`${app_name}.grizzy-deploy.com\`)`,
                [`traefik.http.services.${app_name}.loadbalancer.server.port`]: '3000'
            },

            // NOTE: primitive way to always ensure container is up -- switch to using docker swarm
            RestartPolicy: {
                Name: 'always'
            },

            // bind the container to the traefik network and let it be
            NetworkingConfig: {
                EndpointsConfig: {
                  traefik: {
                    external: true
                  }
                }
            },

            HostConfig: {
                // use restart always --> check why it sucks

                // AutoRemove: true,
                Privileged: false,
                CpuCount: 1,

                // Isolation: "process",
                Memory: mbs_to_bytes(512),

                // HANDLED BY TRAEFIK -- this was redudant
                // PortBindings: {
                //     "3000/tcp": [{
                //         "HostIP":"0.0.0.0",
                //         "HostPort": `${generated_port}`
                //     }]
                // },
            }
        });

        // start the container
        await container.start();

        // return generated_port;
    }

    // we want to check if there are any containers running for a given image if not recreate and then return the port of the container
    async unpauseApplication(image_version) {
        const containers = await this.docker.listContainers({
            filters: JSON.stringify({
                "ancestor": [image_version]
            })
        })

        // this should be detected by redbird on the other side and retrigger the url
        await Promise.allSettled(
            containers.map(async container => {
                if (container.State === "paused") {
                    const lcontainer = this.docker.getContainer(container.id);
                    await lcontainer.start()
                }
            })
        )
    }

    async pauseApplication(image_version) {
        const containers = await this.docker.listContainers({
            filters: JSON.stringify({
                "ancestor": [image_version]
            })
        });

        await Promise.allSettled(
            containers.map(async container => {
                if (container.State === "running") {
                    const lcontainer = this.docker.getContainer(container.id);
                    await lcontainer.pause()
                }
            })
        );
    }

    async deleteApplication(app_name) {
        // try to find the image first
        // FIXME: proper error handling later
        // const image = this.docker.getImage(app_name);
        const containers = await this.docker.listContainers({
            filters: {
                "ancestor": app_name
            }
        });

        // this should be detected by redbird on the other side and retrigger the url
        await Promise.allSettled(
            containers.map(async container => {
                const lcontainer = this.docker.getContainer(container.id);
                await lcontainer.stop()
            })
        );

        // delete the associated image
        await this.docker.getImage(app_name)?.remove()
    }

    // steps
    /**
        1. get the code 
        2. get the associated template 
        3. fill the required templates
        4. Build the image
     */
    async createImage(
        app_name /* nanoid */, application_temp_directory, 
        secrets_manager, logs_handler, run_immediately = true, instances = 1
    ) {
        try {
            let _app_name = snakeCase(app_name)

            const tar_stream = tar.pack(application_temp_directory);
            
            const build_stream = await this.docker.buildImage(
                tar_stream, { 
                    t: _app_name, // ( we dont need the name we can use the image id )
                    forcerm: true,
                    dockerfile: "Dockerfile",
                    cpuperiod: 120000, // 2 mins max per build
                },
            );
    
            // figure wtf the stream is
            const logs = await new Promise((resolve, reject) => {
                this.docker.modem.followProgress(build_stream, (err, res) => {
                    if (err) {
                        // throw an error on the logs, this marks the deployment as a failure
                        reject(new GrizzyInternalDeploymentException(err?.message));
                    }

                    resolve(res);
                });
            });

            // get the image sha and return it
            const image = this.docker.getImage(_app_name);

            if (!image) {
                throw new GrizzyDeployException("Failed to get the deployment id");
            }

            const image_version_id = (await image.inspect())?.Id;

            // get the logs
            let parsed_logs = logs?.map(({ stream }) => stream)
                ?.filter(u => u || u !== '\n')?.join("\n");
    
            // check if we have to run immediately
            if (run_immediately) {
                // how many instances to spin -- use that
                const selfThis = this;

                // switch to docker swarm to handle this madness
                (await Promise.allSettled(
                    // create the instances in parallel
                    (new Array(instances).fill(1)).map(
                        async _ => selfThis.createContainerAndStart(app_name, secrets_manager)
                    )
                )).map(({ value }) => value).filter(port => port /* a valid port */);
            }

            // for scheduled deploys
            return { image_version_id, logs: parsed_logs };
        } catch (error) {
            // TODO: check the error if its a rethrowable as a GrizzyInternal one or just a regular error
            console.log(error);
            
            throw new GrizzyInternalDeploymentException(error.message);
        }
    }
}

module.exports = { SimpleHosterDocker }