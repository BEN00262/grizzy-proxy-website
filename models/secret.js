const mongoose = require('mongoose');

const secretSchema = new mongoose.Schema({
    project: {
        type: mongoose.Types.ObjectId,
        ref: 'project',
        required: true
    },

    key: {
        type: String,
        required: true
    },

    value: {
        type: String,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('secret', secretSchema);