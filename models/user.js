const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstname: {
        type: String,
        required: true
    },

    lastname: {
        type: String,
        required: true
    },

    email: {
        type: String,
        unique: true,
        required: true
    },

    password: {
        type: String,
        required: true
    },

    is_verified: {
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