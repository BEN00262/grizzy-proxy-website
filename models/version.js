const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
    image_version_id: {
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