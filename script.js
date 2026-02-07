// الرابط الخاص بك الذي يعمل بصيغة CSV
const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQwkNE5KEmL1VnRhuA8QzmfYXrLL7-8NDhsyzflhqof7oLBUnMgqdH-TI2fUshYSeMi4IxYZLJWeO8f/pub?output=csv'; 

async function getCourses() {
    const container = document.getElementById('courses-container');
    try {
        const response = await fetch(sheetUrl);
        if (!response.ok) throw new Error('فشل في جلب البيانات من جوجل');
        
        const data = await response.text();
        console.log("البيانات المستلمة:", data); // للمعاينة في وحدة التحكم

        // تقسيم الأسطر بشكل يدعم اللغة العربية
        const rows = data.split(/\r?\n/).filter(row => row.trim() !== '').slice(1);
        
        if (rows.length === 0) {
            container.innerHTML = "<p>لا توجد بيانات في الجدول حالياً.</p>";
            return;
        }

        container.innerHTML = '';

        rows.forEach((row, index) => {
            // تقسيم الأعمدة مع مراعاة وجود فواصل داخل النصوص
            const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            
            if (cols.length >= 2) {
                const title = cols[0]?.replace(/"/g, "").trim() || "بدون عنوان";
                const desc = cols[1]?.replace(/"/g, "").trim() || "";
                const videoUrl = cols[cols.length - 1]?.replace(/"/g, "").trim() || ""; // الرابط غالباً يكون الأخير
                
                const videoId = extractID(videoUrl);
                
                if (videoId) {
                    const cardHtml = `
                        <div class="card" style="animation-delay: ${index * 0.1}s">
                            <div class="video-container">
                                <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
                            </div>
                            <div class="card-info">
                                <h3>${title}</h3>
                                <p>${desc}</p>
                                <a href="${videoUrl}" target="_blank" class="btn-watch">فتح في يوتيوب 📺</a>
                            </div>
                        </div>
                    `;
                    container.innerHTML += cardHtml;
                }
            }
        });
    } catch (err) {
        console.error(err);
        container.innerHTML = `<p style="color:red">عذراً، حدث خطأ أثناء تحميل الدروس. تأكد من تحديث الصفحة.</p>`;
    }
}

function extractID(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// تنفيذ الدالة عند تحميل الصفحة
window.onload = getCourses;
