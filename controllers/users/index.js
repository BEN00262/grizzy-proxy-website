const { OAuth2Client } = require('google-auth-library');
const { UserModel } = require("../../models");
const { massage_error, massage_response, signJwtToken } = require("../../utils");

class UserController {
    static async login(req, res) {
        try {
            const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

            const ticket = await client.verifyIdToken({
                idToken: req.body.jwtToken,
                audience: process.env.GOOGLE_CLIENT_ID
            });

            const { email, name, email_verified } = ticket.getPayload();

            let user = await UserModel.findOne({ email });

            if (!user) {
                user = await UserModel.create({
                    email, name, email_verified
                });
            }

            return massage_response({
                authToken: signJwtToken({ _id: user?._id })
            }, res);
        } catch(error) {
            return massage_error(error, res);
        }
    }
}


module.exports = { UserController }