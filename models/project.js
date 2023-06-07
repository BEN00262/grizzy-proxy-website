const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    deployment_type: {
        type: String,
        enum: ['zip', 'git', 'folder']
    },

    // assigned by the system on creation
    unique_name: {
        type: String,
        required: true
    },

    // depends on if its a zip, repo, if the deployment type is not a git this is irrelevant
    repo_url: {
        type: String
    },

    // template used for the deployment
    // will be used to redeploy later on
    template: {
        type: mongoose.Types.ObjectId,
        ref: 'template'
    },

    // an rsa encrypted randomly generated aes 256 gcm key --> used for encrypting and decrypting secrets during deployments
    vault_key: {
        type: String,
        default: null
    },

    owner: {
        type: mongoose.Types.ObjectId,
        ref: 'user'
    },

    active_version: {
        type: mongoose.Types.ObjectId,
        ref: 'version'
    }
}, { timestamps: true });

module.exports = mongoose.model('project', projectSchema);

