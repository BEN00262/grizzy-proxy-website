const { UserModel } = require("grizzy-deploy-shared/models");
const { massage_error, verifyJwtToken } = require("grizzy-deploy-shared/utils");

module.exports = {
    EnsureIsAuthenticated: async (req, res, next) => {
        try {
            // const { _id } = await verifyJwtToken(req.headers['x-access-token']);
    
            // const user = await UserModel.findById(_id);
            // req.user = user;

            return next();
        } catch(error) {
            return massage_error(error, res, 403);
        }
    }
}