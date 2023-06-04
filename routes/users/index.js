const { UserController } = require('../../controllers');
const { EnsureIsAuthenticated } = require('../../middlewares');

const router = require('express').Router();

router.post('/signin', UserController.login);


module.exports = router;