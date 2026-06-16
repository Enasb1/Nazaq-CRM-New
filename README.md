# Nazaq CRM — مركز الناصرة للتأهيل

A bilingual (Hebrew/Arabic) CRM system for Nazareth Rehabilitation Center.

## Project Structure

```
├── frontend/        # HTML/CSS/JS frontend (RTL, Hebrew + Arabic)
│   ├── index.html   # Main CRM app
│   └── android.html # Mobile-optimized version
├── backend/         # Node.js/Express API
│   ├── src/
│   │   ├── routes/  # students, calls, auth, other
│   │   ├── middleware/
│   │   ├── config/
│   │   └── utils/
│   └── schema.sql   # Supabase DB schema
└── docs/
    └── SETUP.md     # Setup instructions
```

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS, RTL support, bilingual UI
- **Backend**: Node.js, Express, Supabase
- **Auth**: JWT + bcrypt
