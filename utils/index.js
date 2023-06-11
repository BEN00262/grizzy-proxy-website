const consola = require('consola');
const jwt = require('jsonwebtoken');
const { uniqueNamesGenerator, adjectives, colors, animals } = require('unique-names-generator');

class GrizzyDeployException extends Error {
    constructor(message) {
        super(message);
    }
}

class GrizzyInternalDeploymentException extends Error {
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
    });
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

function check_if_objects_are_similar(obj1, obj2) {
    const changes = {};
  
    // Iterate over all properties of obj2
    for (let key in obj2) {
      // Check if the property exists in obj1 and has a different value
      if (obj2.hasOwnProperty(key) && obj1.hasOwnProperty(key) && obj1[key] !== obj2[key]) {
        changes[key] = obj2[key]; // Add the changed value to the changes object
      }
    }
  
    return !!Object.keys(changes).length;
  }

module.exports = {
    GrizzyDeployException,
    GrizzyInternalDeploymentException,
    massage_error,
    massage_response,
    signJwtToken,
    verifyJwtToken,
    check_if_objects_are_similar,
    getUniqueSubdomainName: () => {
        return uniqueNamesGenerator({
            dictionaries: [colors, adjectives, animals],
            separator: '-',
        });
    }
}