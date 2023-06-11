const mongoose = require('mongoose');

const versionlogSchema = new mongoose.Schema({
    log: String,
    timestamp: Date,

    version: {
        type: mongoose.Types.ObjectId,
        ref: 'version',
        required: true
    }
}, {
    timeseries: {
      timeField: 'timestamp',
      granularity: 'seconds'
    },
    // autoCreate: false,
    // expireAfterSeconds: 86400
});

versionlogSchema.pre('save', function (next) {
    this.timestamp = new Date();
    next();
});
  

module.exports = mongoose.model('version_log', versionlogSchema);