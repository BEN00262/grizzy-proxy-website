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

    // depends on if its a zip, repo
    repo_url: {
        type: String
    },

    // sha256 hash if its a zip else last commit hash
    last_commit_hash: {
        type: String
    },

    // template used for the deployment
    // will be used to redeploy later on
    template: {
        template_name: {
            type: String,
            required: true
        },

        version: {
            type: String,
            required: true
        }
    },

    owner: {
        type: mongoose.Types.ObjectId,
        ref: 'user'
    },

    // store the latest version ( running version )
    active_version: {
        type: mongoose.Types.ObjectId,
        ref: 'version'
    },

    versions: [{
        type: mongoose.Types.ObjectId,
        ref: 'version'
    }]

}, { timestamps: true });

module.exports = mongoose.model('project', projectSchema);

