const SUPABASE_URL = 'https://csxgwvtnzhxcntknpofc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzeGd3dnRuemh4Y250a25wb2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MzI0ODIsImV4cCI6MjEwNDMwODQ4Mn0.lNoBE8MhQCNJw46-fsVd41KT65PkUlOjeWRutOg7JQY';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BUCKET_NAME = 'post-images';

const loadingScreen = document.getElementById('loadingScreen');
const authModal = document.getElementById('authModal');
const app = document.getElementById('app');
const homeView = document.getElementById('homeView');
const profileView = document.getElementById('profileView');
const homeTab = document.getElementById('homeTab');
const profileTab = document.getElementById('profileTab');

// نافذة التعديل
const editPostModal = document.getElementById('editPostModal');
const editPostInput = document.getElementById('editPostInput');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
let currentEditingPostId = null;

let currentUser = null;
let isSignUpMode = false;
let selectedPostFile = null;
let selectedAvatarFile = null;

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

// التحقق من الجلسة المحفوظة
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

// تسجيل الدخول / إنشاء حساب جديد
document.getElementById('authSubmitBtn').addEventListener('click', async () => {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();
    const username = document.getElementById('usernameInput').value.trim();

    if (!email || !password) return alert('أدخل البريد وكلمة المرور');

    if (isSignUpMode) {
        const { data, error } = await client.auth.signUp({ 
            email, 
            password, 
            options: { data: { full_name: username, avatar_url: DEFAULT_AVATAR } } 
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
            localStorage.setItem('custom_app_session', JSON.stringify(data.user));
            showApp();
        }
    }
});

// تسجيل الخروج
document.getElementById('logoutBtn').addEventListener('click', async () => {
    localStorage.removeItem('custom_app_session');
    await client.auth.signOut();
    showLogin();
});

// التنقل بين الرئيسية والملف الشخصي
homeTab.addEventListener('click', () => {
    homeView.classList.remove('hidden');
    profileView.classList.add('hidden');
    homeTab.classList.add('active');
    profileTab.classList.remove('active');
    fetchPosts();
});

profileTab.addEventListener('click', () => {
    profileView.classList.remove('hidden');
    homeView.classList.add('hidden');
    profileTab.classList.add('active');
    homeTab.classList.remove('active');
    
    document.getElementById('profileNameInput').value = currentUser?.user_metadata?.full_name || '';
    document.getElementById('profileAvatarPreview').src = currentUser?.user_metadata?.avatar_url || DEFAULT_AVATAR;
    
    fetchMyPosts();
});

document.getElementById('toggleAuth').addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    document.getElementById('authTitle').innerText = isSignUpMode ? 'حساب جديد' : 'تسجيل الدخول';
    document.getElementById('authSubmitBtn').innerText = isSignUpMode ? 'تسجيل' : 'دخول';
    document.getElementById('usernameInput').classList.toggle('hidden', !isSignUpMode);
    document.getElementById('toggleAuth').innerText = isSignUpMode ? 'لديك حساب بالفعل؟ دخول' : 'ليس لديك حساب؟ إنشاء حساب جديد';
});

// اختيار معاينة صورة الملف الشخصي
document.getElementById('avatarFile').addEventListener('change', (e) => {
    selectedAvatarFile = e.target.files[0];
    if (selectedAvatarFile) {
        document.getElementById('profileAvatarPreview').src = URL.createObjectURL(selectedAvatarFile);
    }
});

// حفظ تعديلات الملف الشخصي
document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const newName = document.getElementById('profileNameInput').value.trim();
    let avatarUrl = currentUser?.user_metadata?.avatar_url || DEFAULT_AVATAR;

    if (!newName) return alert('الرجاء إدخال اسم');

    if (selectedAvatarFile) {
        const fileExt = selectedAvatarFile.name.split('.').pop();
        const fileName = `avatar_${currentUser.id}_${Date.now()}.${fileExt}`;
        
        const { data, error } = await client.storage.from(BUCKET_NAME).upload(fileName, selectedAvatarFile);
        if (error) {
            return alert(`خطأ في رفع الصورة الشخصية: ${error.message}`);
        }
        avatarUrl = client.storage.from(BUCKET_NAME).getPublicUrl(fileName).data.publicUrl;
    }

    const { data, error } = await client.auth.updateUser({ 
        data: { full_name: newName, avatar_url: avatarUrl } 
    });

    if (error) alert('خطأ: ' + error.message);
    else {
        currentUser.user_metadata = currentUser.user_metadata || {};
        currentUser.user_metadata.full_name = newName;
        currentUser.user_metadata.avatar_url = avatarUrl;
        localStorage.setItem('custom_app_session', JSON.stringify(currentUser));
        alert('تم تحديث الملف الشخصي بنجاح!');
        selectedAvatarFile = null;
    }
});

// معاينة صورة المنشور
document.getElementById('imageFile').addEventListener('change', (e) => {
    selectedPostFile = e.target.files[0];
    if (selectedPostFile) {
        const preview = document.getElementById('imagePreview');
        preview.src = URL.createObjectURL(selectedPostFile);
        preview.style.display = 'block';
    }
});

// نشر منشور جديد
document.getElementById('submitPost').addEventListener('click', async () => {
    const content = document.getElementById('postInput').value.trim();
    if (!content && !selectedPostFile) return alert('اكتب منشوراً أو اختر صورة');

    let imageUrl = null;
    if (selectedPostFile) {
        const fileExt = selectedPostFile.name.split('.').pop();
        const fileName = `post_${Date.now()}.${fileExt}`;
        const { data, error } = await client.storage.from(BUCKET_NAME).upload(fileName, selectedPostFile);
        if (error) {
            return alert('خطأ في رفع صورة المنشور: ' + error.message);
        }
        if (data) {
            imageUrl = client.storage.from(BUCKET_NAME).getPublicUrl(fileName).data.publicUrl;
        }
    }

    const userName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
    const userAvatar = currentUser.user_metadata?.avatar_url || DEFAULT_AVATAR;

    await client.from('posts').insert([{ 
        content, 
        user_name: userName, 
        image_url: imageUrl,
        avatar_url: userAvatar,
        user_id: currentUser.id
    }]);
    
    document.getElementById('postInput').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    selectedPostFile = null;
    fetchPosts();
});

// جلب جميع المنشورات (للرئيسية)
async function fetchPosts() {
    const { data: posts } = await client.from('posts').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('postsContainer');
    if (!container) return;
    container.innerHTML = '';
    
    if (posts && posts.length > 0) {
        posts.forEach(post => renderPost(post, container));
    } else {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#65676b;">لا توجد منشورات.</div>';
    }
}

// جلب منشورات المستخدم فقط (لالملف الشخصي)
async function fetchMyPosts() {
    const { data: posts } = await client
        .from('posts')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    const container = document.getElementById('myPostsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (posts && posts.length > 0) {
        posts.forEach(post => renderPost(post, container));
    } else {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#65676b;">لم تقم بنشر أي شيء بعد.</div>';
    }
}

// عرض المنشور مع إضافة زر التعديل والحذف لصاحب المنشور فقط
function renderPost(post, container) {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `post-${post.id}`;
    
    let imgHtml = (post.image_url && post.image_url !== 'null') 
        ? `<img src="${post.image_url}" class="post-img" onerror="this.style.display='none'">` 
        : '';

    let avatarSrc = (post.avatar_url && post.avatar_url !== 'null') 
        ? post.avatar_url 
        : DEFAULT_AVATAR;

    // إذا كان المستخدم الحالي هو صاحب المنشور، يُعرض زرا التعديل والحذف
    let isOwner = currentUser && post.user_id === currentUser.id;
    let ownerActionsHtml = isOwner ? `
        <div class="post-actions">
            <button class="action-btn" onclick="openEditModal('${post.id}', \`${escapeHtml(post.content || '')}\`)"><i class="fa-solid fa-pen"></i> تعديل</button>
            <button class="action-btn delete-btn" onclick="deletePost('${post.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
        </div>
    ` : '';

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${avatarSrc}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" onerror="this.src='${DEFAULT_AVATAR}'">
                <div style="font-weight:bold; color:#1877f2;">${post.user_name || 'مستخدم'}</div>
            </div>
            ${ownerActionsHtml}
        </div>
        <p id="post-content-${post.id}" style="margin-top:8px; line-height:1.4;">${post.content || ''}</p>
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

// حماية النص المنقول للدالة
function escapeHtml(text) {
    return text.replace(/`/g, '\\`').replace(/"/g, '&quot;');
}

// دالة حذف المنشور
async function deletePost(postId) {
    if (!confirm('هل أنت تأكد من رغبتك في حذف هذا المنشور؟')) return;

    const { error } = await client.from('posts').delete().eq('id', postId);

    if (error) {
        alert('خطأ أثناء الحذف: ' + error.message);
    } else {
        // حذف العناصر المباشرة من الشاشة
        const postElement = document.getElementById(`post-${postId}`);
        if (postElement) postElement.remove();
    }
}

// فتح نافذة تعديل المنشور
function openEditModal(postId, currentContent) {
    currentEditingPostId = postId;
    editPostInput.value = currentContent;
    editPostModal.classList.remove('hidden');
}

// إغلاق نافذة التعديل
cancelEditBtn.addEventListener('click', () => {
    editPostModal.classList.add('hidden');
    currentEditingPostId = null;
});

// حفظ تعديل المنشور
saveEditBtn.addEventListener('click', async () => {
    const newContent = editPostInput.value.trim();
    if (!newContent) return alert('الرجاء كتابة محتوى للمنشور');

    const { error } = await client
        .from('posts')
        .update({ content: newContent })
        .eq('id', currentEditingPostId);

    if (error) {
        alert('خطأ أثناء حفظ التعديل: ' + error.message);
    } else {
        editPostModal.classList.add('hidden');
        fetchPosts();
        if (!profileView.classList.contains('hidden')) fetchMyPosts();
    }
});

// التعليقات
async function fetchComments(postId) {
    const { data: comments } = await client.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;
    list.innerHTML = '';
    comments?.forEach(c => {
        let avatarSrc = (c.avatar_url && c.avatar_url !== 'null') ? c.avatar_url : DEFAULT_AVATAR;
        list.innerHTML += `
            <div class="comment-item" style="display: flex; align-items: center; gap: 8px;">
                <img src="${avatarSrc}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" onerror="this.src='${DEFAULT_AVATAR}'">
                <div><span class="comment-user">${c.user_name || 'مستخدم'}:</span> ${c.content}</div>
            </div>
        `;
    });
}

async function sendComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();
    if (!content) return;

    const userName = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
    const userAvatar = currentUser.user_metadata?.avatar_url || DEFAULT_AVATAR;

    await client.from('comments').insert([{ 
        post_id: postId, 
        user_name: userName, 
        content,
        avatar_url: userAvatar 
    }]);
    
    input.value = '';
    fetchComments(postId);
}

// المزامنة اللحظية (تحديث وإلغاء المنشورات فوراً)
function subscribeRealtime() {
    client.channel('public-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, payload => {
            fetchPosts();
            if (!profileView.classList.contains('hidden')) fetchMyPosts();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, payload => fetchComments(payload.new.post_id))
        .subscribe();
}

checkSavedSession();
