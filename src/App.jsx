import React, { useState, useEffect } from 'react';
import { Settings, Share2, CheckCircle2, Plus, Calendar, Clock, CheckSquare, X, LayoutList, CalendarDays, RefreshCw } from 'lucide-react';
import InputSection from './components/InputSection';
import TodoList from './components/TodoList';
import SettingsModal from './components/SettingsModal';
import useLocalStorage from './hooks/useLocalStorage';
import { generateTodosFromText } from './services/gemini';
import { initGoogleAuth, syncToGoogleTasks, updateGoogleTask } from './services/googleTasks';
import { v4 as uuidv4 } from 'uuid';

import { arrayMove } from '@dnd-kit/sortable';

function App() {
    const [todos, setTodos] = useLocalStorage('todos', []);
    const [categories, setCategories] = useLocalStorage('categories', ['仕事', '個人', '買い物', '健康', 'その他']);
    const [viewMode, setViewMode] = useLocalStorage('viewMode', 'category'); // 'category' | 'date'
    const [selectedIds, setSelectedIds] = useState([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // Bulk Edit States
    const [bulkDate, setBulkDate] = useState('');
    const [bulkTime, setBulkTime] = useState('');

    useEffect(() => {
        const clientId = localStorage.getItem('google_client_id');
        if (clientId) {
            initGoogleAuth(clientId);
        }
    }, []);

    const handleGenerate = async (text) => {
        setIsGenerating(true);
        setError(null);
        setSuccessMsg(null);
        const apiKey = localStorage.getItem('gemini_api_key');

        try {
            const newTodos = await generateTodosFromText(text, apiKey);

            // Update categories if new ones appear
            const newCategories = new Set(categories);
            newTodos.forEach(t => newCategories.add(t.category));
            setCategories(Array.from(newCategories));

            setTodos([...newTodos, ...todos]);
            setSuccessMsg(`${newTodos.length}件のタスクを追加しました`);
        } catch (err) {
            setError(err.message);
            if (err.message.includes("API Key")) {
                setIsSettingsOpen(true);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAdd = (text) => {
        const newTodo = {
            id: uuidv4(),
            title: text,
            completed: false,
            category: 'その他',
            date: '',
            time: ''
        };
        setTodos([newTodo, ...todos]);
        setSuccessMsg('タスクを追加しました');
    };

    const handleToggle = (id) => {
        setTodos(todos.map(t =>
            t.id === id ? { ...t, completed: !t.completed } : t
        ));
    };

    const handleDelete = (id) => {
        setTodos(todos.filter(t => t.id !== id));
    };

    const handleUpdate = (id, updates) => {
        setTodos(todos.map(t =>
            t.id === id ? { ...t, ...updates } : t
        ));
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        // Handling Category Reordering
        if (active.data.current?.type === 'container' && over.data.current?.type === 'container') {
            if (activeId !== overId) {
                const oldIndex = categories.indexOf(activeId);
                const newIndex = categories.indexOf(overId);
                setCategories(arrayMove(categories, oldIndex, newIndex));
            }
            return;
        }

        // Handling Item Reordering/Moving
        // Find the items
        const activeTodo = todos.find(t => t.id === activeId);

        // If dropped over a container (category)
        if (over.data.current?.type === 'container') {
            const newCategory = over.id;
            if (activeTodo && activeTodo.category !== newCategory) {
                setTodos(todos.map(t =>
                    t.id === activeId ? { ...t, category: newCategory } : t
                ));
            }
            return;
        }

        // If dropped over another item
        const overTodo = todos.find(t => t.id === overId);

        if (activeTodo && overTodo && activeId !== overId) {
            // If moving to a different category via item drop
            if (activeTodo.category !== overTodo.category) {
                setTodos(todos.map(t =>
                    t.id === activeId ? { ...t, category: overTodo.category } : t
                ));
            } else {
                // Reordering within same category
                const oldIndex = todos.findIndex(t => t.id === activeId);
                const newIndex = todos.findIndex(t => t.id === overId);
                setTodos(arrayMove(todos, oldIndex, newIndex));
            }
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setError(null);
        setSuccessMsg(null);
        try {
            // 1. Push: Sync local new tasks to Google (Create)
            const syncedResults = await syncToGoogleTasks(todos);

            let updatedTodos = [...todos];
            let newCount = 0;
            let updateCount = 0;

            // Update local todos with newly synced IDs
            if (syncedResults.length > 0) {
                updatedTodos = updatedTodos.map(todo => {
                    const synced = syncedResults.find(r => r.id === todo.id);
                    return synced ? { ...todo, googleTaskId: synced.googleTaskId } : todo;
                });
                newCount = syncedResults.length;
            }

            // 2. Push Status Updates (Local -> Google only)
            // If local is completed but Google might not be (we don't check Google, we just push if we have an ID)
            // Actually, without checking Google's state, we should just push completion if local is completed.
            // But to be safe and avoid unnecessary API calls, we might want to track if it was already synced as completed?
            // For now, let's just push 'completed' status for any task that has a googleTaskId and is completed.
            // Optimization: In a real app, we'd track 'dirty' state. Here, we'll just iterate.

            for (const task of updatedTodos) {
                if (task.googleTaskId && task.completed) {
                    // We blindly update to completed. If it's already completed, it's a redundant call but safe.
                    // To avoid too many calls, maybe we can skip? But we don't know remote state.
                    // Let's assume the user wants to ensure Google is up to date.
                    try {
                        await updateGoogleTask(task.googleTaskId, { status: 'completed' });
                        updateCount++; // This might over-count if already completed, but acceptable for "one-way sync" confirmation
                    } catch (e) {
                        console.error(`Failed to update Google Task ${task.googleTaskId}`, e);
                    }
                }
            }

            setTodos(updatedTodos);

            const msgParts = [];
            if (newCount > 0) msgParts.push(`${newCount}件をGoogleに追加`);
            if (updateCount > 0) msgParts.push(`${updateCount}件の状態を同期`);

            if (msgParts.length > 0) {
                setSuccessMsg(`同期完了: ${msgParts.join(', ')}`);
            } else {
                setSuccessMsg("最新の状態です");
            }

        } catch (err) {
            console.error(err);
            setError("同期に失敗しました。再試行してください。");
            // Only open settings if we really suspect missing ID, but usually it's just network or token
            if (!localStorage.getItem('google_client_id')) {
                setIsSettingsOpen(true);
            }
        } finally {
            setIsSyncing(false);
        }
    };

    const handleAddCategory = () => {
        const name = prompt("新しいカテゴリ名を入力してください:");
        if (name && !categories.includes(name)) {
            setCategories([...categories, name]);
        }
    };

    const toggleSelection = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleBulkUpdate = () => {
        if (!bulkDate && !bulkTime) return;

        setTodos(todos.map(t => {
            if (selectedIds.includes(t.id)) {
                return {
                    ...t,
                    date: bulkDate || t.date,
                    time: bulkTime || t.time
                };
            }
            return t;
        }));

        setSuccessMsg(`${selectedIds.length}件のタスクを更新しました`);
        setSelectedIds([]);
        setIsSelectionMode(false);
        setBulkDate('');
        setBulkTime('');
    };

    // Auto-hide messages
    useEffect(() => {
        if (error || successMsg) {
            const timer = setTimeout(() => {
                setError(null);
                setSuccessMsg(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, successMsg]);

    return (
        <>
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <h1>AI ToDo List</h1>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        className={`btn ${isSelectionMode ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                            setIsSelectionMode(!isSelectionMode);
                            setSelectedIds([]);
                        }}
                        title="選択モード"
                    >
                        <CheckSquare size={20} />
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleSync}
                        disabled={isSyncing || todos.length === 0}
                        title="Google ToDoに同期"
                        style={{ gap: '0.5rem' }}
                    >
                        {isSyncing ? (
                            <>
                                <RefreshCw size={18} className="animate-spin" />
                                <span className="hide-on-mobile">同期中...</span>
                            </>
                        ) : (
                            <>
                                <RefreshCw size={18} />
                                <span className="hide-on-mobile">Google同期</span>
                            </>
                        )}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setIsSettingsOpen(true)}
                        title="設定"
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </header>

            {error && (
                <div className="glass-panel animate-fade-in" style={{
                    padding: '1rem',
                    marginBottom: '1rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    borderColor: 'rgba(239, 68, 68, 0.5)',
                    color: '#fca5a5'
                }}>
                    {error}
                </div>
            )}

            {successMsg && (
                <div className="glass-panel animate-pop-in" style={{
                    padding: '1rem',
                    marginBottom: '1rem',
                    background: 'rgba(16, 185, 129, 0.2)',
                    borderColor: 'rgba(16, 185, 129, 0.5)',
                    color: '#6ee7b7',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <CheckCircle2 size={18} />
                    {successMsg}
                </div>
            )}

            <main style={{ paddingBottom: '100px' }}>
                {/* View Tabs */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button
                        onClick={() => setViewMode('category')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: viewMode === 'category' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                            color: viewMode === 'category' ? '#60a5fa' : '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            fontWeight: 600,
                            transition: 'all 0.2s'
                        }}
                    >
                        <LayoutList size={18} />
                        カテゴリ別
                    </button>
                    <button
                        onClick={() => setViewMode('date')}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            borderRadius: '12px',
                            border: 'none',
                            background: viewMode === 'date' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                            color: viewMode === 'date' ? '#60a5fa' : '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            fontWeight: 600,
                            transition: 'all 0.2s'
                        }}
                    >
                        <CalendarDays size={18} />
                        期限順
                    </button>
                </div>

                <InputSection onGenerate={handleGenerate} onAdd={handleAdd} isGenerating={isGenerating} />
                <TodoList
                    todos={todos}
                    categories={categories}
                    viewMode={viewMode}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    onDragEnd={handleDragEnd}
                    onAddCategory={handleAddCategory}
                    isSelectionMode={isSelectionMode}
                    selectedIds={selectedIds}
                    onSelect={toggleSelection}
                />
            </main>

            {/* Bulk Action Toolbar */}
            {isSelectionMode && selectedIds.length > 0 && (
                <div className="glass-panel animate-fade-in" style={{
                    position: 'fixed',
                    bottom: '2rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    zIndex: 100,
                    width: '90%',
                    maxWidth: '600px',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontWeight: 'bold' }}>{selectedIds.length}件選択中</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="date"
                                className="input-field"
                                style={{ padding: '0.5rem' }}
                                value={bulkDate}
                                onChange={(e) => setBulkDate(e.target.value)}
                            />
                            <input
                                type="time"
                                className="input-field"
                                style={{ padding: '0.5rem' }}
                                value={bulkTime}
                                onChange={(e) => setBulkTime(e.target.value)}
                            />
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleBulkUpdate}>
                        適用
                    </button>
                </div>
            )}

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSave={() => {
                    // Re-init auth if client ID changed
                    const clientId = localStorage.getItem('google_client_id');
                    if (clientId) initGoogleAuth(clientId);
                }}
            />
        </>
    );
}

export default App;
