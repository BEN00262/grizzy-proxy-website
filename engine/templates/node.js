const handlebars = require("handlebars");
const fs = require('fs/promises');
const path = require('path');
const { GrizzyDeployException } = require("../../utils");

const template = `FROM node:18-alpine
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY ["package.json", "package-lock.json*", "./"]

RUN npm install --production

RUN npm install pm2 -g

COPY . .

CMD ["/bin/sh", "-c", "pm2-runtime 'npm start'"]`;

class NodeJsDeployment {
    static async generate_deployment_script(context, temp_folder) {
        // check the version | requirements to run a node app
        // read the package.json and check if there is a start command if not throw an Exception that will bubble up
        try {
            const package_json = JSON.parse(
                await fs.readFile(path.join(temp_folder, 'package.json'), 'utf8')
            );

            if (!package_json?.scripts?.start) {
                // throw an exception for this
                throw new GrizzyDeployException("missing 'start' command in scripts")
            }

            return handlebars.compile(template)(context)
        } catch (error) {
            if (error instanceof GrizzyDeployException) {
                throw error;
            }

            console.log(error);

            throw new GrizzyDeployException("Failed to deploy server")
        }
    }
}

module.exports = NodeJsDeployment;