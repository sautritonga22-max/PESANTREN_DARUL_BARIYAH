Pesantren Modern Darul Bariyah - Deploy-ready (Node.js + SQLite)

Cara pakai lokal:
1. Install Node.js (v16+).
2. Extract folder and run in terminal:
   npm install
   npm start
3. Buka http://localhost:5000

Admin login:
- username: admin
- password: admin123
(You can set ADMIN_USER and ADMIN_PASS environment variables before deploy.)

Deploy ke Render:
1. Buat repository git, commit project, push ke GitHub.
2. Di Render, buat new Web Service, hubungkan GitHub repo.
3. Build Command: npm install
   Start Command: npm start
4. Set environment variables (optional): ADMIN_USER, ADMIN_PASS, SESSION_SECRET
5. Deploy — Render will run the app and serve static frontend & API.

Uploads:
- Uploaded images are stored in /public/uploads (persist on service if configured).
- For production, consider storing uploads on S3 or similar and secure sessions properly.

Database:
- SQLite database file is `database.db` in project root.
- For production, consider migrating to managed DB (MySQL/Postgres).
