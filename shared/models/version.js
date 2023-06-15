const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
    image_version_id: {
        type: String
    },

    status: {
        type: String,
        default: 'deploying',
        enum: ['deploying', 'failed', 'deployed']
    },

    // deploy logs
    logs: {
        type: String
    },

    project: {
        type: mongoose.Types.ObjectId,
        ref: 'project',
        required: true
    }

}, { timestamps: true });

module.exports = mongoose.model('version', versionSchema);