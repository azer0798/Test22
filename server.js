require('dotenv').config();
const express = require('express');
const axios = require('axios');
const moment = require('moment-timezone');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// المتغيرات الأساسية (تأكد من وضعها في Render)
const SECRET_KEY = process.env.CHARGILY_SECRET_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "bou";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "abd";
const ALGIERS_TZ = 'Africa/Algiers';

// مصفوفة لتخزين العمليات (سيتم عرضها في لوحة التحكم)
let transactions = [];

// واجهة المستخدم (Index)
app.get('/', (req, res) => {
    res.send(`
        <div dir="rtl" style="font-family: Arial; padding: 20px; text-align: center; background: #f0f2f5; min-height: 100vh;">
            <div style="background: white; padding: 30px; border-radius: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(0,0,0,0.1); width: 350px;">
                <h2 style="color: #27ae60;">شحن فليكسي (تلقائي) ⚡</h2>
                <div style="background: #e8f5e9; padding: 10px; border-radius: 8px; margin-bottom: 20px;">
                    <small>الدفع عبر البطاقة الذهبية / CIB</small><br>
                    <strong>اقتطاع مباشر من المحفظة</strong>
                </div>
                <form action="/pay" method="POST">
                    <select name="operator" style="width: 100%; padding: 10px; margin-bottom: 10px; border-radius: 5px; border: 1px solid #ddd;">
                        <option value="Mobilis">Mobilis</option>
                        <option value="Djezzy">Djezzy</option>
                        <option value="Ooredoo">Ooredoo</option>
                    </select>
                    <input type="text" name="phone" placeholder="رقم الهاتف" required style="width: 93%; padding: 10px; margin-bottom: 10px; border-radius: 5px; border: 1px solid #ddd;">
                    <input type="number" name="amount" placeholder="المبلغ (دج)" required style="width: 93%; padding: 10px; margin-bottom: 20px; border-radius: 5px; border: 1px solid #ddd;">
                    <button type="submit" style="width: 100%; padding: 12px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">تأكيد وطلب الشحن</button>
                </form>
            </div>
            <p><a href="/admin-login" style="color: #7f8c8d; text-decoration: none; font-size: 13px;">🔐 دخول الإدارة</a></p>
        </div>
    `);
});

// إرسال الطلب لشارجيلي (V1)
app.post('/pay', async (req, res) => {
    try {
        const { phone, amount, operator } = req.body;
        const invoiceId = "FLX-" + Date.now();
        const createdAt = moment().tz(ALGIERS_TZ).format('YYYY-MM-DD HH:mm:ss');

        const payload = {
            "client": "شحن " + operator + " (" + phone + ")",
            "invoice_number": invoiceId,
            "amount": parseFloat(amount),
            "discount": 0,
            "back_url": "https://" + req.get('host') + "/success",
            "webhook_url": "https://" + req.get('host') + "/webhook",
            "mode": "EDAHABIA", // أو CIB حسب المتاح في محفظتك
            "comment": "تم طلب الشحن من الرصيد المتاح"
        };

        const response = await axios.post('https://epay.chargily.com.dz/api/v1/invoice', payload, {
            headers: { 
                'X-Authorization': SECRET_KEY, 
                'Accept': 'application/json' 
            }
        });

        // إضافة للعمليات بانتظار التأكيد
        transactions.push({ id: invoiceId, phone, amount, operator, status: '⏳ في انتظار الدفع', time: createdAt });
        
        // التوجيه لصفحة الدفع
        res.redirect(response.data.checkout_url);
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
        res.status(500).send("خطأ في الاتصال بالمنصة. تأكد من إعدادات المحفظة.");
    }
});

// الـ Webhook لتحديث الحالة تلقائياً عند نجاح العملية من المحفظة
app.post('/webhook', (req, res) => {
    const { invoice_number, status } = req.body;
    const order = transactions.find(t => t.id === invoice_number);
    if (order && status === 'paid') {
        order.status = '✅ تم الشحن بنجاح';
        // هنا يمكنك إضافة كود API الشحن الفعلي (Flexy API)
    }
    res.sendStatus(200);
});

// لوحة التحكم المحمية (bou / abd)
app.get('/admin-login', (req, res) => {
    res.send(`
        <div dir="rtl" style="text-align: center; padding-top: 100px; font-family: Arial;">
            <form action="/admin" method="POST" style="display: inline-block; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h3>تسجيل دخول الإدارة</h3>
                <input type="text" name="user" placeholder="البريد (bou)" required style="padding: 8px; margin-bottom: 10px;"><br>
                <input type="password" name="pass" placeholder="كلمة السر (abd)" required style="padding: 8px; margin-bottom: 10px;"><br>
                <button type="submit" style="padding: 8px 20px; background: #2c3e50; color: white; border: none; cursor: pointer;">دخول</button>
            </form>
        </div>
    `);
});

app.post('/admin', (req, res) => {
    if (req.body.user !== ADMIN_EMAIL || req.body.pass !== ADMIN_PASS) {
        return res.send("بيانات الدخول غير صحيحة!");
    }
    
    let rows = transactions.map(t => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px;">${t.time}</td>
            <td style="padding: 10px;">${t.phone}</td>
            <td style="padding: 10px;">${t.amount} دج</td>
            <td style="padding: 10px; font-weight: bold;">${t.status}</td>
        </tr>
    `).join('');

    res.send(`
        <div dir="rtl" style="font-family: Arial; padding: 20px;">
            <h2>سجل العمليات (المحفظة)</h2>
            <table border="1" style="width: 100%; text-align: center; border-collapse: collapse;">
                <tr style="background: #f4f4f4;"><th>التوقيت</th><th>الهاتف</th><th>المبلغ</th><th>الحالة</th></tr>
                ${rows || '<tr><td colspan="4">لا توجد عمليات حالياً</td></tr>'}
            </table>
            <br><a href="/">العودة للرئيسية</a>
        </div>
    `);
});

app.get('/success', (req, res) => res.send("<h2 dir='rtl' style='text-align: center; color: green;'>تم استلام طلب الشحن بنجاح!</h2><center><a href='/'>العودة</a></center>"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server is running...'));
