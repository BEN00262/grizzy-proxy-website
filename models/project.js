const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    // local_uri: [
    //     {
    //         type: String,
    //         unique: true
    //     }
    // ],

    // public_uri: {
    //     type: String,
    //     unique: true
    // },

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
    }

}, { timestamps: true });

module.exports = mongoose.model('project', projectSchema);

