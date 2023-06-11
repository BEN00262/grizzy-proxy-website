const Docker = require('dockerode');
const portfinder = require('portfinder');
const tar = require('tar-fs');
const { nanoid } = require('nanoid');
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
        if (not_sure_exists_locally) {
            // check if the image exists locally
            const local_image = (await this.docker.getImage(app_name).inspect())?.Id;

            if (!local_image) {
                const pull_stream = await this.docker.pull(`${process.env.DOCKERHUB_USERNAME}/${app_name}:latest`, {
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
        
        const generated_port = await portfinder.getPortPromise();

        const container = await this.docker.createContainer({
            Image: app_name, // image to spin up

            ExposedPorts: {
                "3000/tcp": {}
            },

            // we can also pass env keys pretty easily
            // find a way to store env keys securely and load them to the container
            // resolve the project secrets somehow
            Env: secrets_manager,

            HostConfig: {
                AutoRemove: true,
                Privileged: false,
                CpuCount: 1,
                // Isolation: "process",
                Memory: mbs_to_bytes(512),
                PortBindings: {
                    "3000/tcp": [{
                        "HostIP":"0.0.0.0",
                        "HostPort": `${generated_port}`
                    }]
                },
                // RestartPolicy: {
                //     Name: 'always'
                // }
            }
        });

        // start the container
        await container.start();

        return generated_port;
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
            const tar_stream = tar.pack(application_temp_directory);
            
            const build_stream = await this.docker.buildImage(
                tar_stream, { 
                    t: app_name, 
                    forcerm: true,
                    dockerfile: "Dockerfile",
                    cpuperiod: 120000, // 2 mins max per build
                    // remote: `${process.env.DOCKERHUB_USERNAME}/${app_name}:latest`,
                    // authconfig: {
                    //     username: process.env.DOCKERHUB_USERNAME,
                    //     password: process.env.DOCKERHUB_PASSWORD,
                    // }
                },
            );
    
            // figure wtf the stream is
            await new Promise((resolve, reject) => {
                this.docker.modem.followProgress(build_stream, (err, res) => {
                    if (err) {
                        // throw an error on the logs, this marks the deployment as a failure
                        logs_handler(err?.message)
                            .finally(_ => {
                                // yes
                                reject(new GrizzyInternalDeploymentException(err?.message));
                            })
                    }

                    // this is the place we call our stuff
                    logs_handler(res?.stream)
                });
            });
    
            // show the build logs here ( attach a version build here )
            // for debugging
            console.log(results)

            // get the image sha and return it
            const image = this.docker.getImage(app_name);

            if (!image) {
                throw new GrizzyDeployException("Failed to get the deployment id");
            }

            const image_version_id = (await image.inspect())?.Id;
    
            // check if we have to run immediately
            if (run_immediately) {
                // how many instances to spin -- use that
                const selfThis = this;

                const ports = (await Promise.allSettled(
                    // create the instances in parallel
                    (new Array(instances).fill(1)).map(
                        async _ => selfThis.createContainerAndStart(app_name, secrets_manager)
                    )
                )).map(({ value }) => value).filter(port => port /* a valid port */);

                return {
                    ports, 
                    image_version_id
                }
            }

            // for scheduled deploys
            return {
                ports: null,
                image_version_id
            };
        } catch (error) {
            // TODO: check the error if its a rethrowable as a GrizzyInternal one or just a regular error
            console.log(error);
            
            throw new GrizzyInternalDeploymentException(error.message);
        }
    }
}

module.exports = { SimpleHosterDocker }