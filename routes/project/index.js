const { ProjectController } = require('../../controllers/projects');
const { TemplatesController } = require('../../controllers/templates');
const { EnsureIsAuthenticated } = require('../../middlewares/auth');

const router = require('express').Router();

router.use([EnsureIsAuthenticated]);

router.get(
    '/templates',
    TemplatesController.getTemplates
);

router.post(
    '/templates',
    TemplatesController.createTemplate
);

router.delete(
    '/templates',
    TemplatesController.deleteTemplate
);

router.get('/all', ProjectController.getProjects);
// router.get('/is-project-name-taken/:project_name', ProjectController.checkIfProjectNameAvailable);
router.post('/create', ProjectController.createProject);
router.post('/deploy', ProjectController.deployProject);
router.get('/versions/:unique_project_name', ProjectController.getProjectVersions);
router.delete('/:unique_project_name', ProjectController.deleteProject);

module.exports = router;