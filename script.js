// الرابط المباشر الذي استخرجته أنت بنجاح
const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQwkNE5KEmL1VnRhuA8QzmfYXrLL7-8NDhsyzflhqof7oLBUnMgqdH-TI2fUshYSeMi4IxYZLJWeO8f/pub?output=csv'; 

async function getCourses() {
    const container = document.getElementById('courses-container');
    try {
        // إضافة timestamp للرابط لمنع الكاش (التخزين المؤقت القديم)
        const response = await fetch(`${sheetUrl}&t=${new Date().getTime()}`);
        const data = await response.text();
        
        // تقسيم الأسطر مع دعم كامل للغة العربية
        const rows = data.split(/\r?\n/).filter(row => row.trim() !== '').slice(1);
        
        if (rows.length === 0) {
            container.innerHTML = "<div class='error'>لا توجد دروس مضافة حالياً في جدول البيانات.</div>";
            return;
        }

        container.innerHTML = ''; // مسح رسالة التحميل

        rows.forEach(row => {
            //Regex احترافي لتقسيم الأعمدة حتى لو احتوت النصوص على فواصل
            const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            
            if (cols.length >= 2) {
                const title = cols[0].replace(/"/g, "").trim();
                const desc = cols[1]?.replace(/"/g, "").trim() || "لا يوجد وصف متوفر لهذا الدرس.";
                const videoUrl = cols[cols.length - 1].replace(/"/g, "").trim(); // الرابط دائماً في الآخر
                
                const videoId = extractID(videoUrl);
                
                if (videoId) {
                    container.innerHTML += `
                        <div class="card">
                            <div class="video-container">
                                <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
                            </div>
                            <div class="card-info">
                                <h3>${title}</h3>
                                <p>${desc}</p>
                                <a href="${videoUrl}" target="_blank" class="btn-watch">شاهد الدرس على يوتيوب 📺</a>
                            </div>
                        </div>
                    `;
                }
            }
        });
    } catch (err) {
        container.innerHTML = "<div class='error'>عذراً، تعذر جلب البيانات. يرجى التأكد من اتصال الإنترنت وتحديث الصفحة.</div>";
    }
}

function extractID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// تشغيل الدالة فور تحميل النافذة
window.onload = getCourses;
