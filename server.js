require('dotenv').config();
const express = require('express');
const axios = require('axios');
const moment = require('moment-timezone');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// الثوابت والمنطقة الزمنية
const ALGIERS_TZ = 'Africa/Algiers';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "123456"; // كلمة السر من Render
let ordersDB = []; // تخزين مؤقت للعمليات

// --- [1] الواجهة الأمامية (طلب الشحن) ---
app.get('/', (req, res) => {
    res.send(`
        <div dir="rtl" style="font-family: Arial; padding: 40px; text-align: center; background: #fdfdfd;">
            <div style="border: 1px solid #ddd; display: inline-block; padding: 30px; border-radius: 15px; background: white; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
                <h2 style="color: #2ecc71;">خدمة فليكسي التلقائية ⚡</h2>
                <form action="/pay" method="POST">
                    <input type="text" name="phone" placeholder="رقم الهاتف (06..)" required style="width: 250px; padding: 12px; margin-bottom: 10px; border-radius: 5px; border: 1px solid #ccc;"><br>
                    <input type="number" name="amount" placeholder="المبلغ بالدينار" required style="width: 250px; padding: 12px; margin-bottom: 15px; border-radius: 5px; border: 1px solid #ccc;"><br>
                    <button type="submit" style="background: #2ecc71; color: white; border: none; padding: 12px 40px; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold;">دفع وشحن الآن</button>
                </form>
            </div>
            <p style="margin-top: 20px;"><a href="/admin-login" style="color: #95a5a6; text-decoration: none; font-size: 14px;">🔐 لوحة الإدارة</a></p>
        </div>
    `);
});

// --- [2] إرسال الفاتورة لشارجيلي ---
app.post('/pay', async (req, res) => {
    try {
        const { phone, amount } = req.body;
        const invoiceId = "FLX-" + Date.now();
        // تنسيق الوقت المطلوب في Chargily V1
        const createdAt = moment().tz(ALGIERS_TZ).format('YYYY-MM-DD HH:mm:ss');

        const response = await axios.post('https://epay.chargily.com.dz/api/v1/invoice', {
            "client": `رقم الهاتف: ${phone}`,
            "client_email": "customer@flexy.dz",
            "invoice_number": invoiceId,
            "amount": parseFloat(amount),
            "discount": 0,
            "back_url": `https://${req.get('host')}/success`,
            "webhook_url": `https://${req.get('host')}/webhook-receiver`, // رابط التنبيه التلقائي
            "mode": "EDAHABIA"
        }, {
            headers: { 
                'X-Authorization': process.env.CHARGILY_SECRET_KEY, 
                'Accept': 'application/json' 
            }
        });

        // حفظ العملية في المصفوفة
        ordersDB.push({ id: invoiceId, phone, amount, status: '⏳ بانتظار الدفع', time: createdAt });
        
        res.redirect(response.data.checkout_url);
    } catch (e) {
        console.error("Error creating invoice:", e.message);
        res.status(500).send("خطأ في إنشاء طلب الدفع. يرجى مراجعة المفاتيح.");
    }
});

// --- [3] الـ Webhook (محرك الأتمتة التلقائي) ---
app.post('/webhook-receiver', (req, res) => {
    const { invoice_number, status } = req.body;
    const order = ordersDB.find(o => o.id === invoice_number);
    
    if (order && status === 'paid') {
        order.status = '✅ تم الدفع والشحن تلقائياً';
        console.log(`[Automatic] Order ${invoice_number} has been fulfilled.`);
    }
    res.sendStatus(200);
});

// --- [4] لوحة التحكم المحمية بكلمة سر ---
app.get('/admin-login', (req, res) => {
    res.send(`
        <div dir="rtl" style="text-align: center; margin-top: 100px; font-family: Arial;">
            <form action="/admin-dashboard" method="POST">
                <h3>أدخل كلمة سر الإدارة للوصول للسجل</h3>
                <input type="password" name="password" style="padding:10px; border-radius:5px;"><br><br>
                <button type="submit" style="padding:10px 30px; cursor:pointer;">دخول 🔐</button>
            </form>
        </div>
    `);
});

app.post('/admin-dashboard', (req, res) => {
    if (req.body.password !== ADMIN_PASS) return res.send("عذراً، كلمة السر غير صحيحة!");
    
    let rows = ordersDB.map(o => `
        <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding:12px;">${o.id}</td>
            <td style="padding:12px;">${o.phone}</td>
            <td style="padding:12px;">${o.amount} دج</td>
            <td style="padding:12px; font-weight:bold;">${o.status}</td>
            <td style="padding:12px;">${o.time}</td>
        </tr>
    `).join('');

    res.send(`
        <div dir="rtl" style="font-family: Arial; padding: 20px;">
            <h2>سجل العمليات (إدارة)</h2>
            <table style="width: 100%; border-collapse: collapse; text-align: right; background: white;">
                <thead style="background: #f8f9fa;">
                    <tr><th>رقم الطلب</th><th>الهاتف</th><th>المبلغ</th><th>الحالة</th><th>التوقيت</th></tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="5">لا توجد سجلات بعد.</td></tr>'}</tbody>
            </table>
            <br><a href="/">العودة للرئيسية</a>
        </div>
    `);
});

app.get('/success', (req, res) => res.send("<h2 dir='rtl' style='text-align:center;'>شكراً لك! تم استلام الدفع وسيبدأ الشحن الآن.</h2><div style='text-align:center;'><a href='/'>العودة للمتجر</a></div>"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Automation server is live on port ${PORT}`));
