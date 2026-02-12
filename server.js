require('dotenv').config();
const express = require('express');
const axios = require('axios');
const moment = require('moment-timezone');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// الثوابت من متغيرات البيئة (Environment Variables)
const SECRET_KEY = process.env.CHARGILY_SECRET_KEY;
const ADMIN_USER = process.env.ADMIN_EMAIL || "bou";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "abd";
const ALGIERS_TZ = 'Africa/Algiers';

let transactions = []; // سجل مؤقت (سيتم تصفيره عند إعادة تشغيل السيرفر في Render)

// واجهة التصميم
const layout = (content) => `
<div dir="rtl" style="font-family:Arial; background:#f4f7f6; min-height:100vh; padding:20px;">
    <div style="max-width:600px; margin:auto; background:white; padding:25px; border-radius:15px; box-shadow:0 10px 25px rgba(0,0,0,0.05);">
        <header style="text-align:center; margin-bottom:20px;">
            <h1 style="color:#27ae60; margin:0;">فليكسي برو ⚡</h1>
            <p style="color:#7f8c8d;">شحن رصيد الهاتف تلقائياً</p>
        </header>
        <hr style="border:0; border-top:1px solid #eee; margin-bottom:20px;">
        ${content}
    </div>
</div>`;

// الصفحة الرئيسية
app.get('/', (req, res) => {
    const content = `
    <form action="/checkout" method="POST">
        <label>اختر الشبكة:</label>
        <select name="operator" style="width:100%; padding:12px; margin:10px 0; border-radius:8px; border:1px solid #ddd;">
            <option value="Mobilis">Mobilis (تخفيض 4%)</option>
            <option value="Djezzy">Djezzy (تخفيض 1%)</option>
            <option value="Ooredoo">Ooredoo (تخفيض 1%)</option>
        </select>
        <label>رقم الهاتف:</label>
        <input type="text" name="phone" placeholder="06XXXXXXXX" required style="width:95%; padding:12px; margin:10px 0; border-radius:8px; border:1px solid #ddd;">
        <label>المبلغ المراد شحنه (دج):</label>
        <input type="number" name="amount" placeholder="مثلاً 500" required style="width:95%; padding:12px; margin:10px 0; border-radius:8px; border:1px solid #ddd;">
        <button type="submit" style="width:100%; padding:15px; background:#27ae60; color:white; border:none; border-radius:8px; cursor:pointer; font-size:16px; font-weight:bold; margin-top:10px;">دفع عبر شارجيلي</button>
    </form>`;
    res.send(layout(content));
});

// إرسال الطلب لشارجيلي
app.post('/checkout', async (req, res) => {
    try {
        const { operator, phone, amount } = req.body;
        const invoiceId = "INV-" + Date.now();
        const timeNow = moment().tz(ALGIERS_TZ).format('YYYY-MM-DD HH:mm:ss');

        const payload = {
            "client": "رقم الهاتف: " + phone,
            "invoice_number": invoiceId,
            "amount": parseFloat(amount),
            "discount": 0,
            "back_url": "https://" + req.get('host') + "/success",
            "webhook_url": "https://" + req.get('host') + "/webhook",
            "mode": "EDAHABIA",
            "comment": "شحن " + operator
        };

        const response = await axios.post('https://epay.chargily.com.dz/api/v1/invoice', payload, {
            headers: { 'X-Authorization': SECRET_KEY, 'Accept': 'application/json' }
        });

        transactions.push({ id: invoiceId, phone, amount, operator, status: '⏳ بانتظار الدفع', time: timeNow });
        res.redirect(response.data.checkout_url);

    } catch (e) {
        res.status(500).send(layout("<h3 style='color:red;'>خطأ في الاتصال بالـ API. تأكد من إعدادات المفتاح السري في Render.</h3>"));
    }
});

// استقبال تأكيد الدفع (Webhook)
app.post('/webhook', (req, res) => {
    const { invoice_number, status } = req.body;
    const order = transactions.find(t => t.id === invoice_number);
    if (order && status === 'paid') {
        order.status = '✅ تم الدفع والشحن';
    }
    res.sendStatus(200);
});

// لوحة التحكم (Admin)
app.get('/admin-login', (req, res) => {
    res.send(layout(`
        <h2 style="text-align:center;">دخول الإدارة</h2>
        <form action="/admin" method="POST">
            <input type="text" name="user" placeholder="البريد (bou)" required style="width:95%; padding:12px; margin:10px 0;">
            <input type="password" name="pass" placeholder="كلمة السر (abd)" required style="width:95%; padding:12px; margin:10px 0;">
            <button type="submit" style="width:100%; padding:12px; background:#2c3e50; color:white; border:none; cursor:pointer;">دخول</button>
        </form>
    `));
});

app.post('/admin', (req, res) => {
    if (req.body.user !== ADMIN_USER || req.body.pass !== ADMIN_PASS) return res.send("بيانات الدخول غير صحيحة!");
    
    let rows = transactions.map(t => `<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">${t.time}</td><td style="padding:10px;">${t.phone}</td><td style="padding:10px;">${t.amount} دج</td><td style="padding:10px;">${t.status}</td></tr>`).join('');
    
    res.send(layout(`
        <h2 style="text-align:center;">سجل العمليات</h2>
        <table style="width:100%; border-collapse:collapse; text-align:center;">
            <thead><tr style="background:#f8f9fa;"><th>الوقت</th><th>الهاتف</th><th>المبلغ</th><th>الحالة</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4">لا توجد عمليات حالياً</td></tr>'}</tbody>
        </table>
        <br><a href="/" style="display:block; text-align:center;">العودة للموقع</a>
    `));
});

app.get('/success', (req, res) => res.send(layout("<h2 style='text-align:center; color:#27ae60;'>تمت العملية بنجاح!</h2><center><a href='/'>العودة للرئيسية</a></center>")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server is running...'));
