const { TemplateModel } = require("../../models");
const { massage_error, massage_response } = require("../../utils");

class TemplatesController {
    static async getTemplates(req, res) {
        try {
            const templates = await TemplateModel.find({
                "$or": [
                    { owner },
                    { is_public: true },
                    { is_system_template: true }
                ]
            });
    
    
            return massage_response({ templates }, res);
        }   catch(error) {
            return massage_error(error, res);
        }
    }

    static async createTemplate(req, res) {
        try {

            const {
                is_public, is_system_template, technologies_used,
                description, src
            } = req.body;

            // link it to someone incase if not a system template
            const template = await TemplateModel.create({
                is_public, version: '0.0.1',
                is_system_template /* this will not be passed in directly */, technologies_used,
                description, src
            });

            return massage_response({ template }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }

    static async deleteTemplate(req, res) {
        try {
            // you can only delete templates you own
            await TemplateModel.deleteOne({
                _id: req.params.template_id,
                owner: req.user._id
            })

            return massage_response({ status: true }, res);
        } catch(error) {
            return massage_error(error, res);
        }   
    }

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


        return template?.src;
    }
}

module.exports = { TemplatesController };