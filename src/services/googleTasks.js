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
// タイムゾーンの問題を完全に回避するため、常に日付のみ（YYYY-MM-DD）を送信
// Google Tasks APIは日付のみを受け付け、タイムゾーンの変換によるずれを防げる
const formatDateForGoogleTasks = (date, time) => {
    if (!date) return null;
    
    // 時間が指定されていても、Google Tasksは主に日付のみを表示するため
    // タイムゾーンの問題を完全に回避するため、常に日付のみを送信
    // これにより、どのタイムゾーンからアクセスしても同じ日付が表示される
    return date; // YYYY-MM-DD形式のまま送信
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
            const body = {
                title: todo.title,
                notes: "Created by AI ToDo App",
            };

            // 日付がある場合のみdueフィールドを追加（nullは送信しない）
            if (todo.date) {
                const dueDate = formatDateForGoogleTasks(todo.date, todo.time);
                if (dueDate) {
                    body.due = dueDate;
                }
            }

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
