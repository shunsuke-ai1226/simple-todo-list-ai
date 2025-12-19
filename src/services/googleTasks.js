// Google Identity Services script loader
const loadGoogleScript = () => {
    return new Promise((resolve, reject) => {
        if (window.google) {
            resolve(window.google);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(window.google);
        script.onerror = reject;
        document.body.appendChild(script);
    });
};

// Helper: Format date for Google Tasks API
// Google Tasks APIでは:
// - 終日タスク: dueフィールドに日付のみ（YYYY-MM-DD）を送信
// - 時間指定タスク: dueフィールドにRFC3339形式（YYYY-MM-DDTHH:mm:ss+HH:mm）を送信
const formatDateForGoogleTasks = (date, time) => {
    if (!date) return null;
    
    // 日付文字列を検証（YYYY-MM-DD形式）
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        console.warn(`無効な日付形式: ${date}`);
        return null;
    }
    
    // 時間が指定されている場合: RFC3339形式で送信（時間指定タスク）
    if (time && time.trim()) {
        const trimmedTime = time.trim();
        console.log(`時間が指定されています: "${trimmedTime}"`);
        
        // 時間形式を検証（HH:mm形式）
        const timeRegex = /^\d{2}:\d{2}$/;
        if (timeRegex.test(trimmedTime)) {
            // ローカルタイムゾーンで日時を作成
            const dateTimeStr = `${date}T${trimmedTime}:00`;
            const localDate = new Date(dateTimeStr);
            
            // ローカルタイムゾーンのオフセットを取得
            const offset = -localDate.getTimezoneOffset();
            const offsetHours = Math.floor(Math.abs(offset) / 60);
            const offsetMinutes = Math.abs(offset) % 60;
            const offsetSign = offset >= 0 ? '+' : '-';
            const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
            
            // RFC3339形式: YYYY-MM-DDTHH:mm:ss+HH:mm（時間指定タスク）
            const result = `${date}T${trimmedTime}:00${offsetStr}`;
            console.log(`RFC3339形式に変換: ${result}`);
            return result;
        } else {
            console.warn(`無効な時間形式: "${trimmedTime}" (期待形式: HH:mm)`);
        }
    } else {
        console.log(`時間が指定されていません。終日タスクとして送信します。`);
    }
    
    // 時間が指定されていない場合: 日付のみを送信（終日タスク）
    // Google Tasks APIは日付のみ（YYYY-MM-DD）を受け付ける
    return date;
};

// Helper: Get Access Token (Cached or New)
const getAccessToken = async () => {
    const clientId = localStorage.getItem('google_client_id');
    if (!clientId) throw new Error("Client IDが設定されていません");

    // Check cache
    const cachedToken = localStorage.getItem('google_access_token');
    const tokenExpiry = localStorage.getItem('google_token_expiry');

    if (cachedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
        return cachedToken;
    }

    // Request new token
    await loadGoogleScript();
    return new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/tasks',
            callback: (resp) => {
                if (resp.error) {
                    reject(resp);
                    return;
                }
                // Cache for 50 minutes (safe margin)
                const expiry = Date.now() + 3000 * 1000;
                localStorage.setItem('google_access_token', resp.access_token);
                localStorage.setItem('google_token_expiry', expiry);
                resolve(resp.access_token);
            },
        });
        // Use 'consent' only if we really need to force it, otherwise '' might be smoother
        // But for the first time or re-auth, 'consent' is safer to ensure we get a refreshable state if needed (though we are using implicit flow here)
        // Let's stick to 'consent' for the interactive request, but since we cache, it won't happen often.
        client.requestAccessToken({ prompt: 'consent' });
    });
};

export const initGoogleAuth = async (clientId) => {
    // Just pre-load the script
    await loadGoogleScript();
};

export const syncToGoogleTasks = async (todos) => {
    const accessToken = await getAccessToken();

    // 1. Get Default Task List
    const listResp = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!listResp.ok) {
        const errorText = await listResp.text();
        throw new Error(`タスクリストの取得に失敗しました: ${listResp.status} ${errorText}`);
    }
    
    const lists = await listResp.json();
    
    if (!lists.items || lists.items.length === 0) {
        throw new Error('タスクリストが見つかりません。Google Tasksでリストを作成してください。');
    }
    
    const defaultListId = lists.items[0].id;
    console.log(`使用するタスクリストID: ${defaultListId}`);

    const syncedResults = [];
    let updateCount = 0;

    // 2. Add new incomplete tasks that haven't been synced yet
    const newTasksToSync = todos.filter(t => !t.completed && !t.googleTaskId);
    console.log(`同期対象の新規タスク: ${newTasksToSync.length}件`);
    
    for (const todo of newTasksToSync) {
        try {
            // タイトルが空の場合はスキップ
            if (!todo.title || !todo.title.trim()) {
                console.warn(`タイトルが空のタスクをスキップ: ${todo.id}`);
                continue;
            }

            // タイトルに時間情報を追加（Google Tasks APIが時間をサポートしていない場合の代替案）
            let taskTitle = todo.title.trim();
            const timeValue = todo.time && todo.time.trim() ? todo.time.trim() : null;
            
            // 時間が指定されている場合、タイトルに時間を追加
            // ただし、既にタイトルに時間が含まれている場合は追加しない
            if (timeValue && !taskTitle.includes(timeValue) && !taskTitle.match(/\[\d{2}:\d{2}\]/)) {
                taskTitle = `${taskTitle} [${timeValue}]`;
            }
            
            const body = {
                title: taskTitle,
            };

            // notesフィールドに時間情報を追加
            let notesContent = "Created by AI ToDo App";
            if (timeValue) {
                notesContent = `時間: ${timeValue}\n${notesContent}`;
            }
            if (todo.notes && todo.notes.trim()) {
                notesContent = `${todo.notes.trim()}\n${notesContent}`;
            }
            body.notes = notesContent;

            // 日付がある場合のみdueフィールドを追加
            // Google Tasks APIはRFC3339形式（YYYY-MM-DDTHH:mm:ssZ）または日付のみ（YYYY-MM-DD）を受け付ける
            // 注意: Google Tasks APIは時間情報を保持しない可能性があるため、タイトルとnotesにも時間を追加
            if (todo.date && todo.date.trim()) {
                console.log(`タスク「${todo.title}」の日付・時間: date=${todo.date}, time=${timeValue || '(なし)'}, raw time="${todo.time}"`);
                const dueDate = formatDateForGoogleTasks(todo.date.trim(), timeValue);
                console.log(`フォーマット後のdue: ${dueDate}`);
                if (dueDate) {
                    body.due = dueDate;
                }
            }

            console.log(`送信するリクエストボディ:`, JSON.stringify(body, null, 2));

            const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${defaultListId}/tasks`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                const data = await res.json();
                syncedResults.push({ id: todo.id, googleTaskId: data.id });
                console.log(`タスク同期成功: ${todo.title} -> ${data.id}`);
            } else {
                const errorText = await res.text();
                console.error(`タスク同期失敗: ${todo.title}`, res.status, errorText);
                // エラーが発生しても処理を続行（他のタスクは同期を試みる）
            }
        } catch (error) {
            console.error(`タスク同期エラー: ${todo.title}`, error);
            // エラーが発生しても処理を続行
        }
    }

    // 3. Update existing tasks that have googleTaskId (sync date and title changes)
    const existingTasksToUpdate = todos.filter(t => !t.completed && t.googleTaskId);
    for (const todo of existingTasksToUpdate) {
        const updateBody = {};
        let needsUpdate = false;

        // Update title if changed
        if (todo.title) {
            updateBody.title = todo.title;
            needsUpdate = true;
        }

        // Update due date if changed
        if (todo.date) {
            updateBody.due = formatDateForGoogleTasks(todo.date, todo.time);
            needsUpdate = true;
        } else {
            // If date was removed, clear the due date
            updateBody.due = null;
            needsUpdate = true;
        }

        if (needsUpdate) {
            try {
                await updateGoogleTask(todo.googleTaskId, updateBody);
                updateCount++;
            } catch (e) {
                console.error(`Failed to update Google Task ${todo.googleTaskId}`, e);
            }
        }
    }

    return { syncedResults, updateCount };
};

export const fetchFromGoogleTasks = async () => {
    const accessToken = await getAccessToken();

    // 1. Get Default Task List
    const listResp = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const lists = await listResp.json();
    const defaultListId = lists.items[0].id;

    // 2. Fetch all tasks
    const tasksResp = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${defaultListId}/tasks?showCompleted=true&showHidden=true`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const tasksData = await tasksResp.json();

    return tasksData.items || [];
};

export const updateGoogleTask = async (googleTaskId, updates) => {
    const accessToken = await getAccessToken();

    // Get Default List ID
    const listResp = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const lists = await listResp.json();
    const defaultListId = lists.items[0].id;

    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${defaultListId}/tasks/${googleTaskId}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
    });

    if (res.ok) {
        return await res.json();
    } else {
        throw new Error(await res.text());
    }
};
