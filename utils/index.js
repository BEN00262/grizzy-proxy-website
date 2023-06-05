const consola = require('consola');
const jwt = require('jsonwebtoken');
const { uniqueNamesGenerator, adjectives, colors, animals } = require('unique-names-generator');

class GrizzyDeployException extends Error {
    constructor(message) {
        super(message);
    }
}

/**
 * @description return a massaged error response ( common in the app )
 * @param {Error} error
 * @param {Response} res
 */
const massage_error = (error, res, status_code = 400) => {
    consola.error(error);

    const isImpactRootException = error instanceof GrizzyDeployException;

    res.status(isImpactRootException ? status_code : 500).json({
        status: 'failed',
        data: {
            errors: [
                isImpactRootException ? error.message : "There was a problem. Please try again later."
            ]
        }
    })

    // if not impact rooms Exception send an email to oliver an myself :)
    // if (!isImpactRootException) {
    //     // we dont want to make the whole function async
    //     ;(async () => {
    //       const emails_to_send_to = (process.env.TYPEFORM_TELEMETRY_EMAIL || "").split(",").filter(u => u).map(x => x.trim())

    //       await sendTextEmail(
    //             emails_to_send_to[0], // the first guy
    //             `SERVER ERROR: ( ${process.env.MICROSERVICE_NAME} ) ==>  ${error.message}`,
    //             error.stack,
    //             emails_to_send_to.slice(1)
    //       )
    //     })()
    // }
}

/**
 * @description return a massaged error response ( common in the app )
 * @param {*} payload
 * @param {Response} res
 * @param {number} code
 */
const massage_response = (payload, res, code = 200) => {
    return res.status(code).json({
        status: 'success',
        data: { ...payload }
    })
}


/**
 *
 * @param {*} payload
 * @returns {string}
 */
const signJwtToken = payload => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: `${process.env.JWT_TOKEN_TIME}h`
    })
}

/**
 *
 * @param {string} jwtToken
 * @returns
 */
const verifyJwtToken = jwtToken => jwt.verify(jwtToken, process.env.JWT_SECRET);


module.exports = {
    GrizzyDeployException,
    massage_error,
    massage_response,
    signJwtToken,
    verifyJwtToken,
    getUniqueSubdomainName: () => {
        return uniqueNamesGenerator({
            dictionaries: [colors, adjectives, animals]
        }).replace("_", "-");
    }
}