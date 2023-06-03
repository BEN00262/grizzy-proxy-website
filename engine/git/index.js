const Git = require("nodegit");

class SimpleHosterGit {
    async pullRepo(directory_path, repo_url) {
        await Git.Clone(
            repo_url,
            directory_path
        );
    }
}

module.exports = { SimpleHosterGit }