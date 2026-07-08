const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');

const router = express.Router();

// Rate limit: max 5 lead submissions per 15 min per IP (prevents spam/abuse)
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'יותר מדי בקשות, נסה שוב מאוחר יותר' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Israeli phone validation: mobile 05X, landline 02/03/04/08/09, VoIP 072-079; accepts +972 prefix
function normalizeIsraeliPhone(raw) {
  let s = String(raw || '').replace(/[\s\-().]/g, '');
  if (s.startsWith('+972')) s = '0' + s.slice(4);
  else if (s.startsWith('972')) s = '0' + s.slice(3);
  return s;
}
function isValidIsraeliPhone(raw) {
  const s = normalizeIsraeliPhone(raw);
  return /^05\d{8}$/.test(s) || /^0[23489]\d{7}$/.test(s) || /^07[2-9]\d{7}$/.test(s);
}

// PUBLIC: create a new lead (student with status "new")
router.post('/lead',
  leadLimiter,
  body('fname').trim().notEmpty().isLength({ max: 100 }),
  body('phone1').trim().notEmpty().isLength({ min: 7, max: 20 }),
  body('email').optional({ checkFalsy: true }).trim().isEmail(),
  body('lname').optional().trim().isLength({ max: 100 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'נא למלא את השדות הנדרשים' });

    // Israeli phone number required
    if (!isValidIsraeliPhone(req.body.phone1)) {
      return res.status(400).json({ error: 'رقم الهاتف غير صحيح — يرجى إدخال رقم إسرائيلي صالح' });
    }

    // Honeypot: bots fill the hidden "website" field; humans don't
    if (req.body.website) return res.status(201).json({ success: true });

    try {
      const student = {
        fname: String(req.body.fname || '').trim().slice(0, 100),
        lname: String(req.body.lname || '').trim().slice(0, 100) || null,
        phone1: normalizeIsraeliPhone(req.body.phone1),
        email: String(req.body.email || '').trim().slice(0, 150) || null,
        status: 'new',
        source: 'whatsapp',
        how_heard: 'social_media',
        notes: 'נוצר אוטומטית מטופס וואטסאפ',
        lead_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('students').insert(student).select('id').single();
      if (error) {
        console.error('[PUBLIC LEAD] insert error:', error.message);
        return res.status(500).json({ error: 'שגיאה בשמירה' });
      }
      console.log(`[PUBLIC LEAD] Created lead ${data.id}`);
      res.status(201).json({ success: true });
    } catch (err) {
      console.error('[PUBLIC LEAD] error:', err.message);
      res.status(500).json({ error: 'שגיאה בשמירה' });
    }
  }
);

module.exports = router;
