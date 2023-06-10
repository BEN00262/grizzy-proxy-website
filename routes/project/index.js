const rateLimit = require('express-rate-limit');

const { ProjectController } = require('../../controllers/projects');
const { TemplatesController } = require('../../controllers/templates');
const { EnsureIsAuthenticated } = require('../../middlewares/auth');

const router = require('express').Router();

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

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

router.get('/all', ProjectController.getMyProjects);
router.post('/deploy', [limiter], ProjectController.createProject);
router.get('/versions/:unique_project_name', ProjectController.getProjectVersions);
router.delete('/:unique_project_name', ProjectController.deleteProject);

module.exports = router;