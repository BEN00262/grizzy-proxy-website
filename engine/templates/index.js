// engine used to run the market templates used for deployments
const { NodeVM } = require('vm2');
const { GrizzyDeployException } = require('../../utils');
const { GrizzyDatabaseEngine } = require('../database');

class TemplateExecutionEngine {
    static async execute_template(template, folder) {
        // pass the folder into the context

        const vm = new NodeVM({
            timeout: 2000,
            allowAsync: true,
            console: "off",
            sandbox: { folder },
            require: {
                external: false,
                builtin: [
                    "fs", "fs/promises", "path"
                ],

                import: ["fs", "fs/promises", "path"],
                root: folder,
            }
        });

        // expect the return value to be a string or else we dont care about it
        const generated_tpl = vm.run(
            `${template?.src}
            
            module.exports = () => generate_deployment_script(folder);`, {
            wrapper: "commonjs"
        });

        const parsed_template = await generated_tpl();

        if (typeof parsed_template !== 'string') {
            throw new GrizzyDeployException("Invalid deployment script");
        }

        // check the type of the template
        if (template?.template_type === 'wordpress') {
            // generate a db and bind it
            const { DB_NAME, DB_USER, DB_PASSWORD } = await GrizzyDatabaseEngine.provision_database();

            return {
                parsed_template,
                env: [
                    `WORDPRESS_DB_HOST=${process.env.MASTER_DB_URI}`,
                    `WORDPRESS_DB_USER=${DB_USER}`,
                    `WORDPRESS_DB_PASSWORD=${DB_PASSWORD}`,
                    `WORDPRESS_DB_NAME=${DB_NAME}`
                ]
            }
        }

        // force the generated tpl to match a docker script
        return { parsed_template, env: [] };
    }
}

module.exports = {TemplateExecutionEngine}
