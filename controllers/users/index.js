const bcrypt = require('bcrypt');
const { nanoid, customAlphabet } = require('nanoid');
const { UserModel, VerificationModel } = require("../../models");
const { massage_error, GrizzyDeployException, massage_response, signJwtToken } = require("../../utils");
const { Email } = require('../../services');

const generate_random_numbers = customAlphabet('1234567890');

class UserController {
    static async create(req, res) {
        try {
            const { firstname, lastname, email, password } = req.body;

            // check if there is someone with the email already ... if so respond with an error
            const user_found = await UserModel.findOne({ email });

            if (user_found) {
                return massage_error(
                    new GrizzyDeployException("Email already taken"),
                    res, 400
                );
            }

            // create the user at this point
            const user = await UserModel.create({
                firstname, lastname, email,
                password: bcrypt.hashSync(
                    password, bcrypt.genSaltSync(14)
                )
            });

            const verification_code = generate_random_numbers(6)

            // save the verification code
            await VerificationModel.create({ email, verification_code: verification_code })


            await Email(email, process.env.ACCOUNT_VERIFICATION_TPL, {
                name: user.firstname,
                code: verification_code
            });

            return massage_response({
                authToken: signJwtToken({ _id: user?._id })
            }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }

    static async login(req, res) {
        try {
            const { email, password } = req.body;

            const user = await UserModel.findOne({ email });

            if (!user) {
                return massage_error(
                    new GrizzyDeployException("Account with the given credentials doesnt exist"),
                    res, 400
                );
            }

            if (!bcrypt.compareSync(password, user?.password)) {
                return massage_error(
                    new GrizzyDeployException("Invalid credentials"),
                    res, 400
                );
            }

            return massage_response({
                authToken: signJwtToken({ _id: user?._id })
            }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }

    // place this behind a login screen
    static async resend_verification(req, res) {
        try {
            // verify the account and auto login the user
            const verification = await VerificationModel.findOne({ verification_code });

            const verification_code = generate_random_numbers(6)

            if (!verification) {
                await VerificationModel.create({ email: req.user.email, verification_code: verification_code });
            } else {
                await VerificationModel.findOneAndUpdate({
                    email: req.user.email,
                }, { verification_code: verification_code });
            }

            // update the account to verified
            await Email(req.user.email, process.env.ACCOUNT_VERIFICATION_TPL, {
                name: req.user.firstname,
                code: verification_code
            });

            return massage_response({ status: true }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }

    // place this behind a login screen
    static async verify_account(req, res) {
        try {
            const { verification_code } = req.body;

            // verify the account and auto login the user
            const verification = await VerificationModel.findOne({ verification_code });

            if (!verification) {
                return massage_error(
                    new GrizzyDeployException("Invalid verification code"),
                    res, 400
                );
            }

            // update the account to verified
            if (req.user.email === verification.email) {
                await UserModel.update({ _id: req?.user?._id }, {
                    is_verified: true
                });
            }

            return massage_response({
                authToken: signJwtToken({ _id: req?.user?._id })
            }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }

    static async password_reset(req, res) {
        try {
            const { email } = req.body;

            const user = await UserModel.findOne({ email });

            if (!user) {
                return massage_error(
                    new GrizzyDeployException("User with the given email does not exist"),
                    400, res
                );
            }

            const generated_password = nanoid(8);

            // update the users password
            await UserModel.update({ _id: user._id }, { 
                password: bcrypt.hashSync(
                    generated_password, bcrypt.genSaltSync(14)
                )
            });

            // send an email with a default password
            await Email(email, process.env.PASSWORD_RESET_TPL, {
                name: user?.firstname,
                password: generated_password
            });
            

            return massage_response({ status: true }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }

    static async update(req, res) {
        try {
            const { firstname, lastname, email, old_password, password } = req.body;

            // check if the old password matches if not dont change the password
            if (old_password && password && !bcrypt.compareSync(old_password, req.user.password)) {
                return massage_error(
                    new GrizzyDeployException("password mismatch"),
                    res, 400
                );
            }

            await UserModel.findOneAndUpdate({ _id: req.user._id }, {
                firstname: firstname ?? req.user.firstname,
                lastname: lastname ?? req.user.lastname,

                // send a verification email at this point
                email: email ?? req.user.email,

                // update the password if the user has specified so
                ...(password ? {
                    password: bcrypt.hashSync(
                        password, bcrypt.genSaltSync(14)
                    )
                } : {})
            });

            return massage_response({ status: true }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }
}


module.exports = { UserController }