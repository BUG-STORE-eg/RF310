const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// تفعيل استلام ومعالجة بيانات JSON و Form-data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// دعم تقديم الملفات الاستاتيكية من مجلد dashboard والمجلد الرئيسي
app.use(express.static(path.join(__dirname, 'dashboard')));
app.use(express.static(__dirname));

// قاعدة بيانات حية بالذاكرة (مفاتيح بدون شرطات)
let keys = [
    { 
        id: "PK8921X109", 
        client: "شركة الأمل", 
        active: true, 
        days: 30, 
        maxDevices: 2, 
        createdAt: "2026-09-01" 
    }
];

// 1. API فحص الترخيص لبرنامج C# (يستقبل JSON)
app.post('/api/licenses/check', (req, res) => {
    // التقاط كود المفتاح من JSON بأي اسم محتمل
    const keyId = req.body?.Key || req.body?.key || req.body?.licenseKey || req.body?.code;

    if (!keyId) {
        return res.json({ 
            valid: false, 
            status: "invalid", 
            message: "لم يتم إرسال كود المفتاح داخل الـ JSON" 
        });
    }

    const foundKey = keys.find(k => k.id === String(keyId).trim());

    if (!foundKey) {
        return res.json({ 
            valid: false, 
            status: "not_found", 
            message: "المفتاح غير موجود" 
        });
    }

    if (!foundKey.active) {
        return res.json({ 
            valid: false, 
            status: "disabled", 
            message: "المفتاح معطل" 
        });
    }

    // حساب مدة الصلاحية
    const createdDate = new Date(foundKey.createdAt);
    const expireDate = new Date(createdDate);
    expireDate.setDate(createdDate.getDate() + (parseInt(foundKey.days) || 30));
    const today = new Date();

    if (today > expireDate) {
        return res.json({ 
            valid: false, 
            status: "expired", 
            message: "المفتاح منتهي الصلاحية" 
        });
    }

    // الرد الناجح لـ C#
    res.json({
        valid: true,
        status: "active",
        client: foundKey.client || "عميل",
        daysLeft: Math.max(0, Math.ceil((expireDate - today) / (1000 * 3600 * 24))),
        maxDevices: foundKey.maxDevices || 1
    });
});

// 2. APIs لوحة التحكم (Dashboard)
app.get('/api/keys', (req, res) => {
    res.json({ success: true, keys });
});

// إنشاء مفتاح جديد بدون شرطات (-)
app.post('/api/keys/create', (req, res) => {
    try {
        const client = req.body?.client ? String(req.body.client).trim() : "عميل جديد";
        const days = parseInt(req.body?.days) || 30;
        const maxDevices = parseInt(req.body?.maxDevices) || 1;

        // توليد كود متصل بدون شرطات (مثل PK48927192)
        const part1 = Math.floor(1000 + Math.random() * 9000);
        const part2 = Math.floor(1000 + Math.random() * 9000);
        const generatedId = `PK${part1}${part2}`;

        const newKey = {
            id: generatedId,
            client: client,
            days: days,
            maxDevices: maxDevices,
            active: true,
            createdAt: new Date().toISOString().split('T')[0]
        };

        keys.unshift(newKey);
        res.json({ success: true, key: newKey });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/keys/toggle', (req, res) => {
    const key = keys.find(k => k.id === req.body?.keyId);
    if (key) key.active = !key.active;
    res.json({ success: true });
});

app.post('/api/keys/disable-all', (req, res) => {
    keys.forEach(k => k.active = false);
    res.json({ success: true });
});

app.delete('/api/keys/delete/:id', (req, res) => {
    keys = keys.filter(k => k.id !== req.params.id);
    res.json({ success: true });
});

// عرض الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

// التشغيل على البورت 0.0.0.0 لدعم الاستضافة الخارجية
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
