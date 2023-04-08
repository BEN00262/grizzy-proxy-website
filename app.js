require('dotenv').config({
    path: require('find-config')('.env')
});

const express = require('express');
const mongoose = require('mongoose'); 


const { ProjectRouter, UserRouter } = require('./routes');
const { ForwardProxy } = require('./services');

const app = express();
const server = require('http').createServer(app);

app.use(express.json())
app.use(express.urlencoded({ extended: true }));

// Proxy websockets
server.on('upgrade', function (req, socket, head) {
    console.log("proxying upgrade request", req.originalUrl);
    ForwardProxy.ws(req, socket, head);
});

app.use('/project', ProjectRouter);
app.use('/user', UserRouter);


;(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI)

        server.listen(process.env.PORT || 3002, () => {
            console.log('server started')
        });
    } catch(error) {
        console.log(error);
    }
})();