const Docker = require('dockerode');
const tar = require('tar-fs');
const { snakeCase } = require('snake-case');
const { GrizzyDeployException, GrizzyInternalDeploymentException } = require('../../utils');

function mbs_to_bytes(mb) {
    return mb * (1024 ** 2)
}

// SWITCH TO USING DOCKER SWARM -> KUBERNETES WILL COME LATER
class SimpleHosterDocker {
    constructor() {
      this.docker = new Docker();
    }

    /**
     * @description responsible for creating a service and then starting the service from a service spec
     * @param {string} app_name 
     * @param {string[]} secrets_manager 
     */
    async createDeploymentService(
        app_name, secrets_manager, replicas = 2
    ) {
        await this.docker.createService({
            Name: app_name,
            Networks: [{ Target: 'traefik' }],
            Mode: {
                Replicated: {
                    Replicas: replicas // start with two replicas on launch
                }
            },

            UpdateConfig: {
                Parallelism: 1, // one at a time
                Delay: 10 * 1000000000, // in nanoseconds
                FailureAction: 'rollback', // other options -> continue, pause
                Monitor: 15 * 1000000000,
                MaxFailureRatio: 0.15,
                Order: 'stop-first'
            },

            RollbackConfig: {
                Parallelism: 1, // Number of tasks to rollback simultaneously
                Delay: 5 * 1000000000, // Delay in nanoseconds before rolling back the next task
                FailureAction: 'pause', // Action to take if a rollback fails (pause, continue)
                Monitor: 10 * 1000000000, // Interval in nanoseconds to monitor task rollbacks
            },

            TaskTemplate: {
                ContainerSpec: {
                    Image: `${snakeCase(app_name)}:latest`, // the string interpolation is not really required but meeh
                    Env: secrets_manager,
                    Labels: {
                        'traefik.enable': 'true',
                        [`traefik.http.routers.${app_name}.rule`]: `Host(\`${app_name}.grizzy-deploy.com\`)`,
                        [`traefik.http.services.${app_name}.loadbalancer.server.port`]: '3000'
                    },

                    // remove all privileges
                    Privileges: {
                        CredentialSpec: null
                    },

                    // limit a given container to only 512 of RAM at a go
                    Resources: {
                        Limits: {
                          MemoryBytes: mbs_to_bytes(512),
                        },
                    },
                }
            }
        });
    }
    
    // missing functionalities
    // snapshoting and storing the snapshot in s3 | replay the snapshot later
    // TODO: implement this later on

    // returns the port the container is running in
    async createContainerAndStart(app_name, secrets_manager, not_sure_exists_locally = false) {
        const _app_name = snakeCase(app_name);

        const container = await this.docker.createContainer({
            Image: _app_name,
            Env: secrets_manager,
            Labels: {
                'traefik.enable': 'true',
                [`traefik.http.routers.${app_name}.rule`]: `Host(\`${app_name}.grizzy-deploy.com\`)`,
                [`traefik.http.services.${app_name}.loadbalancer.server.port`]: '3000'
            },

            // NOTE: primitive way to always ensure container is up -- switch to using docker swarm
            RestartPolicy: {
                Name: 'always'
            },
             
            NetworkingConfig: {
                EndpointsConfig: {
                  traefik: {
                    external: true
                  }
                }
            },

            HostConfig: {
                Privileged: false,
                CpuCount: 1,
                Memory: mbs_to_bytes(512),
            }
        });

        await container.start();
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
        app_name, application_temp_directory, secrets_manager, 
        run_immediately = true, replicas = 2
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

            if (run_immediately) {
                await this.createDeploymentService(
                    app_name, secrets_manager,
                    replicas // replicas
                );
            } else {
                // scheduled deployments happen here
                // send the jobs to @hokify/Agenda
            }

            // for scheduled deploys
            return { 
                image_version_id: (await (this.docker.getImage(_app_name)).inspect())?.Id, 
                logs: logs?.map(({ stream }) => stream)?.filter(u => u || u !== '\n')?.join("\n") 
            };
        } catch (error) {
            // TODO: check the error if its a rethrowable as a GrizzyInternal one or just a regular error
            console.log(error);
            
            throw new GrizzyInternalDeploymentException(error.message);
        }
    }
}

module.exports = { SimpleHosterDocker }