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
            require: {
                external: false,
                builtin: [
                    "fs", "fs/promises"
                ],

                import: ["fs", "fs/promises"],
                root: folder,
            }
        });

        // expect the return value to be a string or else we dont care about it
        const generated_tpl = vm.run(
            `;(async () => {
                ${template}
                
                return await generate_deployment_script();
            })()`
        );

        if (typeof generated_tpl !== 'string') {
            throw new GrizzyDeployException("Invalid deployment script");
        }

        // force the generated tpl to match a docker script
        return generated_tpl;
    }
}

module.exports = {TemplateExecutionEngine}
