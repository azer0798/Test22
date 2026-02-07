const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQwkNE5KEmL1VnRhuA8QzmfYXrLL7-8NDhsyzflhqof7oLBUnMgqdH-TI2fUshYSeMi4IxYZLJWeO8f/pub?output=csv'; 

async function getCourses() {
    try {
        const response = await fetch(sheetUrl);
        const data = await response.text();
        
        // تقسيم الأسطر مع تجنب الأسطر الفارغة
        const rows = data.split('\n').filter(row => row.trim() !== '').slice(1);
        
        const container = document.getElementById('courses-container');
        container.innerHTML = '';

        rows.forEach(row => {
            // التعامل مع الفواصل داخل النصوص بشكل احترافي
            const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            
            if (cols.length >= 3) {
                const title = cols[0].replace(/"/g, "").trim();
                const desc = cols[1].replace(/"/g, "").trim();
                const videoUrl = cols[2].replace(/"/g, "").trim();
                
                const videoId = extractID(videoUrl);
                
                const cardHtml = `
                    <div class="card">
                        <div class="video-container">
                            <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
                        </div>
                        <div class="card-info">
                            <h3>${title}</h3>
                            <p>${desc}</p>
                            <a href="${videoUrl}" target="_blank" class="btn-watch">شاهد على يوتيوب</a>
                        </div>
                    </div>
                `;
                container.innerHTML += cardHtml;
            }
        });
    } catch (err) {
        document.getElementById('courses-container').innerHTML = "حدث خطأ في جلب البيانات. تأكد من رابط CSV.";
    }
}

function extractID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

getCourses();
csv
