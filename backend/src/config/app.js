const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { loggerMiddleware } = require('../middleware/logger.middleware');
const { errorHandler } = require('../middleware/error.middleware');
const { applySecurityMiddleware } = require('../middleware/security.middleware');

// Routes
const authRoutes = require('../api/routes/auth.routes');
const userRoutes = require('../api/routes/user.routes');
const documentRoutes = require('../api/routes/document.routes');
const approvalRoutes = require('../api/routes/approval.routes');
const activityRoutes = require('../api/routes/activity.routes');
const adminRoutes = require('../api/routes/admin.routes');
const logsRoutes = require('../api/routes/logs.routes');

const app = express();

// Request gövdesini parse et
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Güvenlik middleware'lerini uygula
applySecurityMiddleware(app);

// Log middleware'i uygula
app.use(loggerMiddleware);

// Static dosyaları sunmak için middleware
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// API rotalarını tanımla
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/approval-flows', approvalRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/logs', logsRoutes);

// API durumu için basit endpoint
app.get('/api/status', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Hata yakalama middleware'i
app.use(errorHandler);

module.exports = app;
