const { TemplateModel } = require("grizzy-deploy-shared/models");

class TemplatesGenerator {
    // used by the template engine, during the deployment process
    static async getTemplate(template_id, owner) {
        // ensure that this guy really has access to this template
        const template = await TemplateModel.findOne({
            _id: template_id,
            "$or": [
                // { owner },
                { is_public: true },
                { is_system_template: true }
            ]
        });


        return template;
    }
}

module.exports = { TemplatesGenerator };