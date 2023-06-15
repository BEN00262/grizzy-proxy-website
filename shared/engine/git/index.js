const path = require('path')
const Git = require('isomorphic-git')
const http = require('isomorphic-git/http/node')
const fs = require('fs')

class SimpleHosterGit {
    async pullRepo(directory_path, repo_url) {
        await Git.clone({ 
            fs, http, dir: directory_path, 
            url: repo_url
        });
    }
}

module.exports = { SimpleHosterGit }