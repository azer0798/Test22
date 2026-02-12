require('dotenv').config();
const express = require('express');
const axios = require('axios');
const moment = require('moment-timezone');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// استدعاء الإعدادات من متغيرات البيئة
const SECRET_KEY = process.env.CHARGILY_SECRET_KEY;
const ADMIN_USER = process.env.ADMIN_EMAIL || "bou";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "abd";
const ALGIERS_TZ = process.env.TZ || 'Africa/Algiers';

let transactions = []; 

// واجهة المستخدم الأساسية
const layout = (content) => `
<div dir="rtl" style="font-family:Arial; background:#f0f2f5; min-height:100vh; padding:20px;">
    <div style="max-width:800px; margin:auto; background:white; padding:30px; border-radius:15px; box-shadow:0 4px 15px rgba(0,0,0,0.1);">
        <h1 style="text-align:center; color:#2c3e50;">⚡ فليكسي برو - نسخة المتغيرات</h1>
        <hr>
        ${content}
    </div>
</div>`;

// الصفحة الرئيسية لشحن الرصيد
app.get('/', (req, res) => {
    const content = `
    <div style="background:#e8f5e9; padding:15px; border-radius:10px; margin-bottom:20px; text-align:center;">
        <h3 style="margin:0; color:#2e7d32;">الرصيد المتاح: 850,00 د.ج</h3>
    </div>
    <form action="/checkout" method="POST">
        <label>المشغل:</label>
        <select name="operator" style="width:100%; padding:10px; margin:10px 0;">
            <option value="Mobilis">Mobilis (-4%)</option>
            <option value="Djezzy">Djezzy (-1%)</option>
            <option value="Ooredoo">Ooredoo (-1%)</option>
        </select>
        <input type="text" name="phone" placeholder="رقم الهاتف (06/07/05)" required style="width:97%; padding:10px; margin:10px 0;">
        <input type="number" name="amount" placeholder="المبلغ" required style="width:97%; padding:10px; margin:10px 0;">
        <button type="submit" style="width:100%; padding:15px; background:#27ae60; color:white; border:none; border-radius:5px; cursor:pointer;">دفع آمن عبر شارجيلي</button>
    </form>`;
    res.send(layout(content));
});

// إنشاء الفاتورة باستخدام API شارجيلي
app.post('/checkout', async (req, res) => {
    try {
        const { operator, phone, amount } = req.body;
        const invoiceId = "FLX-" + Date.now();
        // حل مشكلة التوقيت لضمان قبول الطلب
        const timeNow = moment().tz(ALGIERS_TZ).format('YYYY-MM-DD HH:mm:ss');

        const payload = {
            "client": "شحن " + operator + " للرقم " + phone,
            "invoice_number": invoiceId,
            "amount": parseFloat(amount),
            "discount": 0,
            "back_url": "https://" + req.get('host') + "/status",
            "webhook_url": "https://" + req.get('host') + "/webhook",
            "mode": "EDAHABIA",
            "comment": "تم الإنشاء: " + timeNow
        };

        const response = await axios.post('https://epay.chargily.com.dz/api/v1/invoice', payload, {
            headers: { 'X-Authorization': SECRET_KEY, 'Accept': 'application/json' }
        });

        transactions.push({ id: invoiceId, phone, amount, status: '⏳ قيد الانتظار', time: timeNow });
        res.redirect(response.data.checkout_url);

    } catch (e) {
        res.status(500).send("خطأ: تأكد من ضبط متغير CHARGILY_SECRET_KEY في إعدادات Render.");
    }
});

// لوحة الإدارة (Admin)
app.get('/admin-login', (req, res) => {
    res.send(layout(`
        <form action="/admin" method="POST">
            <h3>دخول المسؤول</h3>
            <input type="text" name="user" placeholder="البريد" required style="width:97%; padding:10px; margin:10px 0;">
            <input type="password" name="pass" placeholder="كلمة السر" required style="width:97%; padding:10px; margin:10px 0;">
            <button type="submit" style="width:100%; padding:10px; background:#2c3e50; color:white;">دخول</button>
        </form>
    `));
});

app.post('/admin', (req, res) => {
    if (req.body.user !== ADMIN_USER || req.body.pass !== ADMIN_PASS) return res.send("بيانات غير صحيحة");
    let rows = transactions.map(t => `<tr><td>${t.time}</td><td>${t.phone}</td><td>${t.amount}</td><td>${t.status}</td></tr>`).join('');
    res.send(layout(`<h3>سجل العمليات</h3><table border="1" style="width:100%;">${rows}</table>`));
});

app.get('/status', (req, res) => res.send(layout("<h2>تمت العملية بنجاح!</h2><a href='/'>رجوع</a>")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('السيرفر يعمل...'));
