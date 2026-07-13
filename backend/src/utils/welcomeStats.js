const supabase = require('../config/supabase');

// Fire-and-forget event logger for the public /welcome form.
// Events: 'visit' (page opened), 'success' (lead created),
//         'invalid' (validation/phone failed), 'blocked' (honeypot / rate limit)
// Never throws and never blocks the response.
function logWelcome(event, detail) {
  try {
    Promise.resolve(
      supabase
        .from('welcome_stats')
        .insert({ event, detail: detail || null, created_at: new Date().toISOString() })
        .select()
        .single()
    )
      .then(({ error }) => {
        if (error) console.error('[WELCOME STATS] insert error:', error.message);
      })
      .catch((err) => console.error('[WELCOME STATS] error:', err.message));
  } catch (err) {
    console.error('[WELCOME STATS] error:', err.message);
  }
}

module.exports = { logWelcome };
