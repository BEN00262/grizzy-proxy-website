const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
    // used to check if its a system managed template
    is_system_template: {
        type: Boolean,
        default: false
    },

    editable: {
        type: Boolean,
        default: true
    },

    template_type: {
        type: String,
        enum: ['wordpress', 'other' /* system does not provision a db for you */]
    },

    // only applies if the is_system_template is set to false, allows a local template to be exposed for others to use
    is_public: {
        type: Boolean,
        default: false
    },

    // if the is_system_template is false, this is required for custom templates
    owner: {
        type: mongoose.Types.ObjectId,
        ref: 'user'
    },

    // whats a template really?
    // a template is a combination of docker configs and 
    // validity checks
    version: {
        type: String,
        required: true
    },

    // used for displaying only
    technologies_used: [{
        type: String,
        required: true
    }],

    description: {
        type: String
    },

    // a link to logo url
    logo_url: {
        type: String
    },

    src: {
        type: String,
        required: true
    }

}, { timestamps: true });

module.exports = mongoose.model('template', templateSchema);