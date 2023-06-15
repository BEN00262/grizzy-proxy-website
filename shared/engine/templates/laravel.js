const handlebars = require("handlebars");
const fs = require('fs/promises');
const path = require('path');
const { GrizzyDeployException } = require("../../utils");

const template = `FROM php:8.0.5
RUN apt-get update -y && apt-get install -y openssl zip unzip git
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN docker-php-ext-install pdo mbstring
WORKDIR /app
COPY . /app
RUN composer install

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=3000"]`;

class LaravelDeployment {
    static async generate_deployment_script(context, temp_folder) {
        // check the version | requirements to run a node app
        // read the package.json and check if there is a start command if not throw an Exception that will bubble up
        return handlebars.compile(template)(context)
        
        // try {
        //     // const package_json = JSON.parse(
        //     //     await fs.readFile(path.join(temp_folder, 'package.json'), 'utf8')
        //     // );

        //     // if (!package_json?.scripts?.start) {
        //     //     // throw an exception for this
        //     //     throw new GrizzyDeployException("missing 'start' command in scripts")
        //     // }

        //     return handlebars.compile(template)(context)
        // } catch (error) {
        //     if (error instanceof GrizzyDeployException) {
        //         throw error;
        //     }

        //     console.log(error);

        //     throw new GrizzyDeployException("Failed to deploy server")
        // }
    }
}

module.exports = LaravelDeployment;