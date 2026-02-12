require('dotenv').config();
const express = require('express');
const axios = require('axios');
const moment = require('moment-timezone');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ALGIERS_TZ = 'Africa/Algiers';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "123456";
let historyDB = [];

// عروض الفليكسي المتوفرة وعمولاتها (بناءً على صورك)
const flexyOffers = {
    "mobilis": { name: "Mobilis", commission: 0.04, color: "#2ecc71" },
    "djezzy": { name: "Djezzy", commission: 0.01, color: "#e74c3c" },
    "ooredoo": { name: "Ooredoo", commission: 0.01, color: "#f1c40f" }
};

// --- الواجهة الرئيسية (صفحة العروض) ---
app.get('/', (req, res) => {
    let cards = Object.keys(flexyOffers).map(key => {
        const op = flexyOffers[key];
        return `
            <div style="border:1px solid #eee; padding:20px; border-radius:15px; width:250px; background:#fff; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="color:${op.color}">${op.name}</h3>
                <div style="background:#f9f9f9; padding:5px; border-radius:5px; color:#666; font-size:12px;">تخفيض: ${op.commission * 100}%</div>
                <form action="/checkout" method="POST">
                    <input type="hidden" name="operator" value="${key}">
                    <input type="text" name="phone" placeholder="06 / 07 / 05" required style="width:90%; padding:8px; margin:10px 0;">
                    <input type="number" name="amount" placeholder="المبلغ (دج)" required style="width:90%; padding:8px; margin-bottom:10px;">
                    <button type="submit" style="background:${op.color}; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; width:100%;">اشحن الآن</button>
                </form>
            </div>
        `;
    }).join('');

    res.send(`
        <div dir="rtl" style="font-family:Arial; background:#f4f7f6; min-height:100vh; padding:20px; text-align:center;">
            <header style="background:#fff; padding:20px; border-radius:10px; margin-bottom:30px;">
                <h1>لوحة شحن الرصيد ⚡</h1>
                <p>الرصيد المتاح: <b>850,00 د.ج</b> | المكافآت: <span style="color:green;">179,00 د.ج</span></p>
            </header>
            <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:center;">${cards}</div>
            <p style="margin-top:40px;"><a href="/admin-login" style="color:#7f8c8d; text-decoration:none;">🔐 الإدارة</a></p>
        </div>
    `);
});

// --- معالجة الدفع والربط مع Chargily V1 ---
app.post('/checkout', async (req, res) => {
    try {
        const { operator, phone, amount } = req.body;
        const opData = flexyOffers[operator];
        
        // حساب الصافي بعد العمولات (اختياري للعرض فقط)
        const finalAmount = parseFloat(amount);
        const invoiceId = "FLX-" + Date.now();
        
        // إصلاح التوقيت (الجزائر UTC+1) لضمان قبول الطلب
        const createdAt = moment().tz(ALGIERS_TZ).format('YYYY-MM-DD HH:mm:ss');

        const payload = {
            "client": `شحن ${opData.name} (${phone})`,
            "client_email": "flexy@pro.dz",
            "invoice_number": invoiceId,
            "amount": finalAmount,
            "discount": 0,
            "back_url": `https://${req.get('host')}/status`,
            "webhook_url": `https://${req.get('host')}/webhook-api`,
            "mode": "EDAHABIA",
            "comment": `طلب فليكسي ${opData.name} للرقم ${phone}`
        };

        const response = await axios.post('https://epay.chargily.com.dz/api/v1/invoice', payload, {
            headers: { 
                'X-Authorization': process.env.CHARGILY_SECRET_KEY, 
                'Accept': 'application/json' 
            }
        });

        historyDB.push({ id: invoiceId, phone, amount, operator: opData.name, status: '⏳ قيد الدفع', time: createdAt });
        res.redirect(response.data.checkout_url);

    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
        res.status(500).send("خطأ في إنشاء طلب الدفع. راجع مفتاح API والتوقيت.");
    }
});

// --- الـ Webhook (الأتمتة التلقائية) ---
app.post('/webhook-api', (req, res) => {
    const { invoice_number, status } = req.body;
    const order = historyDB.find(o => o.id === invoice_number);
    if (order && status === 'paid') {
        order.status = '✅ تم الشحن تلقائياً';
        console.log(`[OK] تم شحن ${order.amount} للرقم ${order.phone}`);
    }
    res.sendStatus(200);
});

// --- حماية الأدمن والسجل ---
app.get('/admin-login', (req, res) => {
    res.send(`<div dir="rtl" style="text-align:center; padding:50px;"><form action="/admin" method="POST"><h3>كلمة سر الأدمن</h3><input type="password" name="pass"><button type="submit">دخول</button></form></div>`);
});

app.post('/admin', (req, res) => {
    if (req.body.pass !== ADMIN_PASS) return res.send("خطأ!");
    let rows = historyDB.map(o => `<tr><td>${o.id}</td><td>${o.phone}</td><td>${o.amount}</td><td>${o.operator}</td><td>${o.status}</td></tr>`).join('');
    res.send(`
        <div dir="rtl" style="font-family:Arial; padding:20px;">
            <h2>سجل عمليات الشحن</h2>
            <table border="1" style="width:100%; text-align:center; border-collapse:collapse;">
                <tr style="background:#eee;"><th>ID</th><th>الهاتف</th><th>المبلغ</th><th>المشغل</th><th>الحالة</th></tr>
                ${rows || '<tr><td colspan="5">لا يوجد عمليات</td></tr>'}
            </table><br><a href="/">خروج</a>
        </div>
    `);
});

app.get('/status', (req, res) => res.send("<h2 dir='rtl' style='text-align:center;'>تمت العملية! جاري الشحن التلقائي...</h2><center><a href='/'>العودة</a></center>"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Flexy Server running...`));
