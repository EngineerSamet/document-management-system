/**
 * Tüm modelleri tek bir dosyadan export eder
 */
const User = require('./User');
const Document = require('./Document');
const ApprovalFlow = require('./ApprovalFlow');
const ApprovalTemplate = require('./ApprovalTemplate');
const Log = require('./Log');
const Setting = require('./Setting');
const Activity = require('./Activity');
const Comment = require('./Comment');
const Notification = require('./Notification');
const Role = require('./Role');

module.exports = {
  User,
  Document,
  ApprovalFlow,
  ApprovalTemplate,
  Log,
  Setting,
  Activity,
  Comment,
  Notification,
  Role
}; 