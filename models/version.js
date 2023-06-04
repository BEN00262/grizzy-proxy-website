const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
    // use it later
    version_sha512: {
        type: String,
        required: true
    },

    container_archive_url: {
        type: String,
        required: true
    },

    // deployment logs
    logs: [{
        type: String,
    }],

    project: {
        type: mongoose.Types.ObjectId,
        ref: 'project'
    }

}, { timestamps: true });

module.exports = mongoose.model('version', versionSchema);