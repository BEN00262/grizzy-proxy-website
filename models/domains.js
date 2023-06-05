const mongoose = require('mongoose');

const domainSchema = new mongoose.Schema({
    sub_domain: {
        type: String,
        required: true
    },

    // add an image id --> used to check if the image has a running container
    image_version_id: {
        type: String,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('domain', domainSchema);