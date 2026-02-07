const sheetUrl = 'https://docs.google.com/spreadsheets/d/1Zui1m8AETx6Icz0_L8Jwo--15F8sSN3QXv8MqlHKewM/edit?usp=drivesdk'; // ضع رابط CSV الخاص بك هنا

async function loadCourses() {
    try {
        const response = await fetch(sheetUrl);
        const data = await response.text();
        const rows = data.split('\n').slice(1);
        
        const container = document.getElementById('courses-container');
        container.innerHTML = '';

        rows.forEach(row => {
            // استخدام Regex للتعامل مع الفواصل داخل النصوص إن وجدت
            const columns = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            
            if (columns.length >= 3) {
                const title = columns[0].replace(/"/g, "");
                const desc = columns[1].replace(/"/g, "");
                const link = columns[2].trim().replace(/"/g, "");
                
                // وظيفة استخراج معرف اليوتيوب
                const videoId = getYoutubeId(link);
                const videoEmbed = videoId 
                    ? `<iframe width="100%" height="200" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`
                    : `<p>رابط غير صالح</p>`;

                const card = `
                    <div class="card">
                        <div class="video-wrapper">
                            ${videoEmbed}
                        </div>
                        <div class="card-content">
                            <h3>${title}</h3>
                            <p>${desc}</p>
                            <a href="${link}" target="_blank" class="learn-btn">فتح في يوتيوب 📺</a>
                        </div>
                    </div>
                `;
                container.innerHTML += card;
            }
        });
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// دالة سحرية لاستخراج الـ ID من أي رابط يوتيوب (مختصر أو كامل)
function getYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

loadCourses();
