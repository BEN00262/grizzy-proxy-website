const Docker = require('dockerode');
const portfinder = require('portfinder');
const tar = require('tar-fs')

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
    async createContainerAndStart(app_name) {
        const generated_port = await portfinder.getPortPromise();

        const container = await this.docker.createContainer({
            Image: app_name, // image to spin up
            ExposedPorts: {
                "3000/tcp": {}
            },

            // we can also pass env keys pretty easily
            Env: [
                // load this secrets dynamically during deployment of a container
                // "DBHOST=" + dbHost,
            ],

            HostConfig: {
                AutoRemove: true,
                Privileged: false,
                CpuCount: 1,
                Memory: mbs_to_bytes(512),
                PortBindings: {
                    "3000/tcp": [{
                        "HostIP":"0.0.0.0",
                        "HostPort": `${generated_port}`
                    }]
                },
                RestartPolicy: {
                    Name: 'always'
                }
            }
        });

        // start the container
        await container.start();

        return generated_port;
    }

    // we want to check if there are any containers running for a given image if not recreate and then return the port of the container
    async unpauseApplication(app_name) {
        // try to find the image first
        // FIXME: proper error handling later
        // const image = this.docker.getImage(app_name);
        const containers = await this.docker.listContainers({
            filters: {
                "ancestor": app_name
            }
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

    async pauseApplication(app_name) {
        // try to find the image first
        // FIXME: proper error handling later
        // const image = this.docker.getImage(app_name);
        const containers = await this.docker.listContainers({
            filters: {
                "ancestor": app_name
            }
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
        this.docker.getImage(app_name)?.remove()
    }

    // steps
    /**
        1. get the code 
        2. get the associated template 
        3. fill the required templates
        4. Build the image
     */
    async createImage(app_name /* nanoid */, application_temp_directory, run_immediately = true) {
        try {
            const tar_stream = tar.pack(application_temp_directory);
            
            const build_stream = await this.docker.buildImage(
                tar_stream, { 
                    t: app_name, 
                    forcerm: true,
                    dockerfile: "Dockerfile" 
                },
            );
    
            // figure wtf the stream is
            const results = await new Promise((resolve, reject) => {
                this.docker.modem.followProgress(build_stream, (err, res) => {
                    if (err) {
                        reject(err);
                    }

                    resolve(res);
                });
            });
    
            // show the build logs here ( attach a version build here )
            console.log(results)
    
            // check if we have to run immediately
            if (run_immediately) {
                return await this.createContainerAndStart(app_name)
            }

            return null;
        } catch (error) {
            console.log(error);
        }
    }
}

module.exports = { SimpleHosterDocker }