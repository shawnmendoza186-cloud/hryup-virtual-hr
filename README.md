# HRyUp Full-Stack Website Prototype

A working feasibility-study prototype for **HRyUp — Virtual Human Resource Support Service for MSMEs in Las Piñas City**.

## Included
- Responsive public landing page
- Services and package sections
- Client registration and login
- Password hashing using Node's built-in `crypto.scrypt`
- Persistent JSON backend database (`data/db.json`)
- REST API for authentication, client profile, HR requests, and dashboard statistics
- Client dashboard with request submission and request history
- No external framework required

## Run locally
1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run `npm start`.
4. Open `http://localhost:3000`.

The first account you create is a normal client account. The backend is intentionally lightweight for a school feasibility-study prototype. For a production deployment, replace the JSON database with PostgreSQL/MySQL, add role-based admin accounts, HTTPS, secure cookies, CSRF protection, audit logs, file encryption, backups, and a proper cloud deployment.

## Main files
- `server.js` — backend/API
- `public/index.html` — public website
- `public/dashboard.html` — client portal
- `public/style.css` — design
- `public/app.js` — frontend logic
- `data/db.json` — local persistent data
