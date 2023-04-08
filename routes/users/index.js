const { UserController } = require('../../controllers');
const { EnsureIsAuthenticated } = require('../../middlewares');

const router = require('express').Router();

router.post('/signup', UserController.create);
router.post('/signin', UserController.login);
router.post('/password-rest', UserController.password_reset);

router.use([EnsureIsAuthenticated]);

router.put('/', UserController.update);
router.post('/verify-account/:verification_code', UserController.verify_account);
router.post('/resend-verification-token', UserController.resend_verification);


module.exports = router;