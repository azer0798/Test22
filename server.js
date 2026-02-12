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

// --- الصفحة الرئيسية ---
app.get('/', (req, res) => {
    res.send(`
        <div dir="rtl" style="font-family: Arial; padding: 20px; text-align: center; background: #f4f7f6; min-height: 100vh;">
            <div style="background: white; padding: 30px; border-radius: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #27ae60;">شحن رصيد الهاتف ⚡</h2>
                <form action="/pay" method="POST">
                    <select name="operator" style="width: 100%; padding: 10px; margin-bottom: 10px;">
                        <option value="Mobilis">Mobilis (-4%)</option>
                        <option value="Djezzy">Djezzy (-1%)</option>
                        <option value="Ooredoo">Ooredoo (-1%)</option>
                    </select>
                    <input type="text" name="phone" placeholder="رقم الهاتف" required style="width: 93%; padding: 10px; margin-bottom: 10px;">
                    <input type="number" name="amount" placeholder="المبلغ (دج)" required style="width: 93%; padding: 10px; margin-bottom: 20px;">
                    <button type="submit" style="width: 100%; padding: 12px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer;">دفع الآن</button>
                </form>
            </div>
            <p><a href="/admin-login" style="color: #7f8c8d; text-decoration: none;">🔐 لوحة التحكم</a></p>
        </div>
    `);
});

// --- معالجة الدفع ---
app.post('/pay', async (req, res) => {
    try {
        const { phone, amount, operator } = req.body;
        const invoiceId = "FLX-" + Date.now();
        const createdAt = moment().tz(ALGIERS_TZ).format('YYYY-MM-DD HH:mm:ss');

        const response = await axios.post('https://epay.chargily.com.dz/api/v1/invoice', {
            "client": "رقم: " + phone,
            "invoice_number": invoiceId,
            "amount": parseFloat(amount),
            "discount": 0,
            "back_url": "https://" + req.get('host') + "/success",
            "webhook_url": "https://" + req.get('host') + "/webhook",
            "mode": "EDAHABIA",
            "comment": "شحن " + operator
        }, {
            headers: { 
                'X-Authorization': process.env.CHARGILY_SECRET_KEY, 
                'Accept': 'application/json' 
            }
        });

        historyDB.push({ id: invoiceId, phone, amount, operator, status: '⏳ بانتظار الدفع', time: createdAt });
        res.redirect(response.data.checkout_url);
    } catch (e) {
        console.error("API Error:", e.response ? e.response.data : e.message);
        res.status(500).send("خطأ في الاتصال: " + (e.response ? JSON.stringify(e.response.data) : e.message));
    }
});

// --- الـ Webhook ---
app.post('/webhook', (req, res) => {
    const { invoice_number, status } = req.body;
    const order = historyDB.find(o => o.id === invoice_number);
    if (order && status === 'paid') {
        order.status = '✅ تم الشحن';
    }
    res.sendStatus(200);
});

// --- لوحة الإدارة ---
app.get('/admin-login', (req, res) => {
    res.send('<div dir="rtl" style="text-align:center; padding-top:100px;"><form action="/admin" method="POST"><h3>كلمة السر</h3><input type="password" name="pw"><button type="submit">دخول</button></form></div>');
});

app.post('/admin', (req, res) => {
    if (req.body.pw !== ADMIN_PASS) return res.send("خطأ!");
    let rows = historyDB.map(o => `<tr><td>${o.id}</td><td>${o.phone}</td><td>${o.amount}</td><td>${o.status}</td><td>${o.time}</td></tr>`).join('');
    res.send(`
        <div dir="rtl" style="font-family: Arial; padding: 20px;">
            <h2>سجل العمليات (رصيدك: 850 دج)</h2>
            <table border="1" style="width:100%; text-align:center; border-collapse:collapse;">
                <tr style="background:#eee;"><th>ID</th><th>الهاتف</th><th>المبلغ</th><th>الحالة</th><th>التوقيت</th></tr>
                ${rows || '<tr><td colspan="5">لا يوجد عمليات</td></tr>'}
            </table>
            <br><a href="/">العودة</a>
        </div>
    `);
});

app.get('/success', (req, res) => res.send("<h2 dir='rtl' style='text-align:center;'>تم الدفع بنجاح!</h2>"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server is running on port ' + PORT));
