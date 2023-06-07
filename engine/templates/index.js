// engine used to run the market templates used for deployments
const { NodeVM } = require('vm2');
const { GrizzyDeployException } = require('../../utils');

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
            `${template}
            
            module.exports = () => generate_deployment_script(folder);`, {
            wrapper: "commonjs"
        });

        const parsed_template = await generated_tpl();

        if (typeof parsed_template !== 'string') {
            throw new GrizzyDeployException("Invalid deployment script");
        }

        // force the generated tpl to match a docker script
        return parsed_template;
    }
}

module.exports = {TemplateExecutionEngine}
