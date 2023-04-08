const mongoose = require('mongoose');

const verificationcodeSchema = new mongoose.Schema({
    email: {
        type: String, 
        required: true
    },

    verification_code: {
        type: String,
        required: true
    }
}, { timestamps: true });

verificationcodeSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7200 /* 2 hrs */ })

module.exports = mongoose.model('verifcation_codes', verificationcodeSchema);