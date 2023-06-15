const handlebars = require("handlebars");
const fs = require('fs');
const path = require('path');
const { GrizzyDeployException } = require("../../utils");

const template = `FROM node:18-alpine
	
WORKDIR /app

RUN npm install serve -g

COPY . .

CMD ["/bin/sh", "-c", "serve -l 3000"]`;

class StaticDeployment {
    static async generate_deployment_script(context, temp_folder) {
        // check the version | requirements to run a node app
        // read the package.json and check if there is a start command if not throw an Exception that will bubble up
        try {
            if (!(fs.existsSync(path.join(temp_folder, 'index.html')))) {
                // throw an exception for this
                throw new GrizzyDeployException("missing 'index.html' in root folder")
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

module.exports = StaticDeployment;