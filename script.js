const SUPABASE_URL = 'https://csxgwvtnzhxcntknpofc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzeGd3dnRuemh4Y250a25wb2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MzI0ODIsImV4cCI6MjEwNDMwODQ4Mn0.lNoBE8MhQCNJw46-fsVd41KT65PkUlOjeWRutOg7JQY';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ربط عناصر الواجهة
const loadingScreen = document.getElementById('loadingScreen');
const authModal = document.getElementById('authModal');
const app = document.getElementById('app');
const homeView = document.getElementById('homeView');
const profileView = document.getElementById('profileView');
const homeTab = document.getElementById('homeTab');
const profileTab = document.getElementById('profileTab');

let currentUser = null;
let isSignUpMode = false;
let selectedFile = null;

// 1. فحص الجلسة المحفوظة في LocalStorage
function checkSavedSession() {
    const savedSession = localStorage.getItem('custom_app_session');
    
    if (savedSession) {
        currentUser = JSON.parse(savedSession);
        showApp();
    } else {
        showLogin();
    }
}

function showApp() {
    loadingScreen.classList.add('hidden');
    authModal.classList.add('hidden');
    app.classList.remove('hidden');
    fetchPosts();
    subscribeRealtime();
}

function showLogin() {
    loadingScreen.classList.add('hidden');
    authModal.classList.remove('hidden');
    app.classList.add('hidden');
}

// 2. تسجيل الدخول والتسجيل الجديد
document.getElementById('authSubmitBtn').addEventListener('click', async () => {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();
    const username = document.getElementById('usernameInput').value.trim();

    if (!email || !password) return alert('أدخل البريد وكلمة المرور');

    if (isSignUpMode) {
        const { data, error } = await client.auth.signUp({ 
            email, 
            password, 
            options: { data: { full_name: username } } 
        });
        if (error) alert('خطأ: ' + error.message);
        else {
            alert('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.');
            isSignUpMode = false;
            document.getElementById('toggleAuth').click();
        }
    } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) {
            alert('خطأ: ' + error.message);
        } else if (data.user) {
            currentUser = data.user;
            // حفظ الجلسة محلياً لعدم الخروج عند التحديث
            localStorage.setItem('custom_app_session', JSON.stringify(data.user));
            showApp();
        }
    }
});

// 3. تسجيل الخروج
document.getElementById('logoutBtn').addEventListener('click', async () => {
    localStorage.removeItem('custom_app_session');
    await client.auth.signOut();
    showLogin();
});

// التنقل بين الصفحات
homeTab.addEventListener('click', () => {
    homeView.classList.remove('hidden');
    profileView.classList.add('hidden');
    homeTab.classList.add('active');
    profileTab.classList.remove('active');
});

profileTab.addEventListener('click', () => {
    profileView.classList.remove('hidden');
    homeView.classList.add('hidden');
    profileTab.classList.add('active');
    homeTab.classList.remove('active');
    document.getElementById('profileNameInput').value = currentUser?.user_metadata?.full_name || '';
});

document.getElementById('toggleAuth').addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    document.getElementById('authTitle').innerText = isSignUpMode ? 'حساب جديد' : 'تسجيل الدخول';
    document.getElementById('authSubmitBtn').innerText = isSignUpMode ? 'تسجيل' : 'دخول';
    document.getElementById('usernameInput').classList.toggle('hidden', !isSignUpMode);
    document.getElementById('toggleAuth').innerText = isSignUpMode ? 'لديك حساب بالفعل؟ دخول' : 'ليس لديك حساب؟ إنشاء حساب جديد';
});

// حفظ الملف الشخصي
document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const newName = document.getElementById('profileNameInput').value.trim();
    if (!newName) return;

    const { data, error } = await client.auth.updateUser({ data: { full_name: newName } });
    if (error) alert('خطأ: ' + error.message);
    else {
        currentUser.user_metadata.full_name = newName;
        localStorage.setItem('custom_app_session', JSON.stringify(currentUser));
        alert('تم تحديث اسمك بنجاح!');
    }
});

// معاينة وتجهيز الصورة للمنشور
document.getElementById('imageFile').addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        const preview = document.getElementById('imagePreview');
        preview.src = URL.createObjectURL(selectedFile);
        preview.style.display = 'block';
    }
});

// إضافة منشور جديد
document.getElementById('submitPost').addEventListener('click', async () => {
    const content = document.getElementById('postInput').value.trim();
    if (!content && !selectedFile) return alert('اكتب منشوراً أو اختر صورة');

    let imageUrl = null;
    if (selectedFile) {
        const fileName = `${Date.now()}_${selectedFile.name}`;
        const { data } = await client.storage.from('post-images').upload(fileName, selectedFile);
        if (data) {
            imageUrl = client.storage.from('post-images').getPublicUrl(fileName).data.publicUrl;
        }
    }

    const userName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
    await client.from('posts').insert([{ content, user_name: userName, image_url: imageUrl }]);
    
    document.getElementById('postInput').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    selectedFile = null;
    fetchPosts();
});

// جلب المنشورات
async function fetchPosts() {
    const { data: posts } = await client.from('posts').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('postsContainer');
    container.innerHTML = '';
    posts?.forEach(post => renderPost(post));
}

// عرض منشور
function renderPost(post) {
    const container = document.getElementById('postsContainer');
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `post-${post.id}`;
    
    let imgHtml = post.image_url ? `<img src="${post.image_url}" class="post-img">` : '';

    card.innerHTML = `
        <div style="font-weight:bold; color:#1877f2;">${post.user_name}</div>
        <p style="margin-top:8px; line-height:1.4;">${post.content}</p>
        ${imgHtml}
        <div class="comments-section">
            <div id="comments-list-${post.id}"></div>
            <div class="comment-input-box">
                <input type="text" id="comment-input-${post.id}" class="comment-input" placeholder="اكتب تعليقاً...">
                <button onclick="sendComment('${post.id}')" style="background:#1877f2; color:#fff; border:none; padding:6px 12px; border-radius:12px; cursor:pointer; font-weight:bold;">إرسال</button>
            </div>
        </div>
    `;
    container.appendChild(card);
    fetchComments(post.id);
}

// جلب التعليقات
async function fetchComments(postId) {
    const { data: comments } = await client.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;
    list.innerHTML = '';
    comments?.forEach(c => {
        list.innerHTML += `<div class="comment-item"><span class="comment-user">${c.user_name}:</span> ${c.content}</div>`;
    });
}

// إرسال تعليق
async function sendComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();
    if (!content) return;

    const userName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
    await client.from('comments').insert([{ post_id: postId, user_name: userName, content }]);
    input.value = '';
    fetchComments(postId);
}

// الاشتراكات المباشرة (Realtime)
function subscribeRealtime() {
    client.channel('public-updates')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => fetchPosts())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, payload => fetchComments(payload.new.post_id))
        .subscribe();
}

// تشغيل الفحص الأولي عند تحميل الملف
checkSavedSession();
