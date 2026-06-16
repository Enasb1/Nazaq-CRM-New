const supabase = require('../config/supabase');

/**
 * Write an entry to the audit log table
 */
async function auditLog(userId, username, action, type, detail = '') {
  try {
    await supabase.from('audit_log').insert({
      user_id: userId || 'system',
      username: username || 'system',
      action,
      type,
      detail,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    // Never let audit log failure break the main operation
    console.error('Audit log error:', err.message);
  }
}

/**
 * Express middleware factory — logs the request after it completes
 */
function auditMiddleware(action, type, getDetail) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode < 400) {
        const detail = getDetail ? getDetail(req, data) : '';
        auditLog(req.user?.id, req.user?.username, action, type, detail);
      }
      return originalJson(data);
    };
    next();
  };
}

module.exports = { auditLog, auditMiddleware };
