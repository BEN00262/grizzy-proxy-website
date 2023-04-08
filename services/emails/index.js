const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = async (email, template, template_vars = {}) => {
    try {
        await sgMail.send({
            to: email,
            from: process.env.FROM_EMAIL,
            templateId: template,
            dynamicTemplateData: template_vars
        });
    } catch(error) {
        console.log(error);
    }
}