const express = require('express');
const axios = require('axios');
const moment = require('moment-timezone');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SECRET_KEY = process.env.CHARGILY_SECRET_KEY;
const ALGIERS_TZ = 'Africa/Algiers';

app.post('/pay', async (req, res) => {
    try {
        const { op, phone, amount } = req.body;
        // تصحيح صياغة النص هنا لتفادي أخطاء الصور السابقة
        const clientName = "شحن " + op + " للرقم " + phone;
        
        const response = await axios.post('https://epay.chargily.com.dz/api/v1/invoice', {
            "client": clientName,
            "invoice_number": "INV-" + Date.now(),
            "amount": parseFloat(amount),
            "discount": 0,
            "back_url": "https://" + req.get('host') + "/success",
            "webhook_url": "https://" + req.get('host') + "/webhook",
            "mode": "EDAHABIA"
        }, { 
            headers: { 'X-Authorization': SECRET_KEY, 'Accept': 'application/json' } 
        });

        res.redirect(response.data.checkout_url);
    } catch (e) {
        res.status(500).send("خطأ في الاتصال: " + (e.response ? JSON.stringify(e.response.data) : e.message));
    }
});

app.listen(process.env.PORT || 3000, () => console.log("Server Started"));
