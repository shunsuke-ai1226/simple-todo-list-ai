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
    const lists = await listResp.json();
    const defaultListId = lists.items[0].id;

    // 2. Add incomplete tasks that haven't been synced yet
    const tasksToSync = todos.filter(t => !t.completed && !t.googleTaskId);
    const syncedResults = [];

    for (const todo of tasksToSync) {
        const body = {
            title: todo.title,
            notes: "Created by AI ToDo App",
        };

        if (todo.date) {
            let dateStr = todo.date;
            if (todo.time) {
                dateStr += `T${todo.time}:00`;
            } else {
                dateStr += 'T00:00:00';
            }
            // Create date object and format to ISO string
            // Note: Google Tasks 'due' field is technically date-only in many contexts, 
            // but sending RFC3339 timestamp is required. 
            // If we send time, it might be stored but not displayed in some views, 
            // or truncated. However, we will try to send the full timestamp.
            body.due = new Date(dateStr).toISOString();
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
        }
    }
    return syncedResults;
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
