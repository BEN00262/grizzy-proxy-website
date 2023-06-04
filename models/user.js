const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        unique: true,
        required: true
    },

    // should we care?
    email_verified: {
        type: Boolean,
        default: false
    },

    projects: [
        {
            type: mongoose.Types.ObjectId,
            ref: 'project'
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('user', userSchema);