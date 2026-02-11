// server.js
const express = require('express');
const session = require('express-session');
const dotenv = require('dotenv');

dotenv.config();

// ============ KEEP AWAKE ============
const https = require('https');
setInterval(() => {
  const url = process.env.RENDER_URL || 'https://test-1dba.onrender.com';
  https.get(url, () => {});
}, 5 * 60 * 1000);
// ====================================

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.set('view engine', 'ejs');

// ============ الصفحة الرئيسية ============
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>وسيط DZ</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Cairo', sans-serif;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          text-align: center;
          padding: 2rem;
        }
        h1 {
          font-size: 4rem;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        p {
          font-size: 1.2rem;
          color: #94a3b8;
          margin-bottom: 2rem;
        }
        .btn {
          display: inline-block;
          padding: 0.8rem 2rem;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          text-decoration: none;
          border-radius: 50px;
          font-weight: 600;
          margin: 0.5rem;
          transition: all 0.3s;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(59,130,246,0.4);
        }
        .admin-btn {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        }
        .status {
          margin-top: 2rem;
          padding: 1rem;
          background: rgba(16,185,129,0.2);
          border-radius: 12px;
          color: #a7f3d0;
        }
      </style>
    </head>
    <body>
      <h1>وسيط DZ</h1>
      <p>منصة وساطة حسابات PES في الجزائر</p>
      <div>
        <a href="/admin/login" class="btn admin-btn">🔐 لوحة التحكم</a>
      </div>
      <div class="status">
        ✅ الموقع شغال 24/7
      </div>
    </body>
    </html>
  `);
});

// ============ تسجيل الدخول ============
app.get('/admin/login', (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.send(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>تسجيل الدخول | وسيط DZ</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Cairo', sans-serif;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .login-box {
          background: rgba(15,23,42,0.95);
          padding: 3rem;
          border-radius: 20px;
          width: 100%;
          max-width: 400px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        h1 {
          text-align: center;
          margin-bottom: 2rem;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        input {
          width: 100%;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: white;
          font-size: 1rem;
        }
        button {
          width: 100%;
          padding: 0.75rem;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }
        .error {
          background: rgba(239,68,68,0.2);
          color: #fecaca;
          padding: 0.75rem;
          border-radius: 10px;
          margin-bottom: 1rem;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="login-box">
        <h1>وسيط DZ</h1>
        ${req.session.error ? `<div class="error">${req.session.error}</div>` : ''}
        <form action="/admin/login" method="POST">
          <input type="text" name="username" placeholder="اسم المستخدم" required>
          <input type="password" name="password" placeholder="كلمة المرور" required>
          <button type="submit">دخول</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'wassitdz2026') {
    req.session.user = { username, role: 'admin' };
    req.session.error = null;
    res.redirect('/admin');
  } else {
    req.session.error = 'بيانات غير صحيحة';
    res.redirect('/admin/login');
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

app.get('/admin', (req, res) => {
  if (!req.session.user) return res.redirect('/admin/login');
  res.send(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>لوحة التحكم | وسيط DZ</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Cairo', sans-serif;
          background: #0f172a;
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 2rem;
        }
        .dashboard {
          background: rgba(30,41,59,0.8);
          padding: 2rem;
          border-radius: 20px;
          max-width: 600px;
          width: 100%;
        }
        h1 {
          margin-bottom: 2rem;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .menu {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .btn {
          padding: 1rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: white;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s;
        }
        .btn:hover {
          background: rgba(59,130,246,0.2);
          border-color: #3b82f6;
        }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <h1>مرحباً ${req.session.user.username}</h1>
        <div class="menu">
          <a href="/admin/products" class="btn">📦 إدارة المنتجات</a>
          <a href="/admin/orders" class="btn">🛒 الطلبات</a>
          <a href="/admin/logout" class="btn" style="background: rgba(239,68,68,0.1);">🚪 تسجيل خروج</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// صفحات بسيطة مؤقتة
app.get('/admin/products', (req, res) => {
  if (!req.session.user) return res.redirect('/admin/login');
  res.send('صفحة المنتجات - قيد التطوير');
});

app.get('/admin/orders', (req, res) => {
  if (!req.session.user) return res.redirect('/admin/login');
  res.send('صفحة الطلبات - قيد التطوير');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
