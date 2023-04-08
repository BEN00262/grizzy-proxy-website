const { ProjectController } = require('../../controllers/projects');
const { EnsureIsAuthenticated } = require('../../middlewares/auth');

const router = require('express').Router();

router.use([EnsureIsAuthenticated]);

router.post('/create', ProjectController.createProject);
router.post('/deploy', ProjectController.deployProject);
router.get('/backups/:project_id', ProjectController.getProjectBackups);

router.put('/register-domain', ProjectController.registerSubdomain);
router.delete('/:project_id', ProjectController.deleteProject);

module.exports = router;