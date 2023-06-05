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
    },

    // the port its running
    port: {
        type: Number,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('domain', domainSchema);