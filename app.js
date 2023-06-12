require('dotenv').config({
    path: require('find-config')('.env')
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const { ProjectRouter, UserRouter } = require('./routes');
// const { rehydrate_domains } = require('./services');

const PORT = process.env.PORT || 3002;

const app = express();
const server = require('http').createServer(app);

app.use(cors());
app.use(express.json())
app.use(express.urlencoded({ extended: false }));

app.use('/project', ProjectRouter);
app.use('/user', UserRouter);

/* 
    switch to using traefik as the reverse proxy
    figure out how to use s3 as the registry for storing images and stuff
*/

;(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        server.listen(PORT, () => {
            console.log('server started')
        });
    } catch(error) {
        console.log(error);
    }
})();