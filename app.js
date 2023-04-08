require('dotenv').config({
    path: require('find-config')('.env')
});

const express = require('express');
const { ProjectRouter, UserRouter } = require('./routes');

const app = express();

app.use(express.json())
app.use(express.urlencoded({ extended: true }));


app.use('/project', ProjectRouter);
app.use('/user', UserRouter);


app.listen(process.env.PORT || 3002, () => {
    console.log('server started')
})