const mongoose = require('mongoose');

const snapshotSchema = new mongoose.Schema({
    snapshot_url: {
        type: String,
        unique: true
    },

    project: {
        type: mongoose.Types.ObjectId,
        ref: 'project'
    }
}, { timestamps: true });

module.exports = mongoose.model('snapshot', snapshotSchema);

