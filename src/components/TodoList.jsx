import React, { useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Trash2, Calendar, Clock, GripVertical, Plus, Square, CheckSquare } from 'lucide-react';

// --- Sortable Item (Used in Category View) ---
function SortableItem({ todo, onToggle, onDelete, onUpdate, isSelectionMode, isSelected, onSelect }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: todo.id,
        data: { type: 'item', todo },
        disabled: isSelectionMode
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="glass-panel"
            onClick={() => isSelectionMode && onSelect(todo.id)}
        >
            <TodoItemContent
                todo={todo}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdate={onUpdate}
                isSelectionMode={isSelectionMode}
                isSelected={isSelected}
                dragHandleProps={!isSelectionMode ? { ...attributes, ...listeners } : null}
            />
        </div>
    );
}

// --- Simple Item (Used in Date View) ---
function SimpleItem({ todo, onToggle, onDelete, onUpdate, isSelectionMode, isSelected, onSelect }) {
    return (
        <div
            className="glass-panel"
            onClick={() => isSelectionMode && onSelect(todo.id)}
        >
            <TodoItemContent
                todo={todo}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdate={onUpdate}
                isSelectionMode={isSelectionMode}
                isSelected={isSelected}
                dragHandleProps={null} // No drag handle in Date View
            />
        </div>
    );
}

// --- Shared Content Component ---
function TodoItemContent({ todo, onToggle, onDelete, onUpdate, isSelectionMode, isSelected, dragHandleProps }) {
    const handleDateChange = (e) => {
        onUpdate(todo.id, { date: e.target.value });
    };

    const handleTimeChange = (e) => {
        onUpdate(todo.id, { time: e.target.value });
    };

    return (
        <div style={{
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: isSelected ? 'rgba(59, 130, 246, 0.2)' : (todo.completed ? 'rgba(0,0,0,0.2)' : 'transparent'),
            borderRadius: '16px',
            border: isSelected ? '1px solid #3b82f6' : 'none',
            cursor: isSelectionMode ? 'pointer' : 'default'
        }}>
            {/* Drag Handle or Selection Checkbox */}
            {isSelectionMode ? (
                <div style={{ color: isSelected ? '#3b82f6' : '#64748b' }}>
                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
            ) : (
                dragHandleProps ? (
                    <div {...dragHandleProps} style={{ cursor: 'grab', color: '#64748b' }}>
                        <GripVertical size={16} />
                    </div>
                ) : (
                    // Placeholder for alignment in Date View if needed, or just nothing
                    <div style={{ width: '16px' }} />
                )
            )}

            {!isSelectionMode && (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggle(todo.id); }}
                    style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: `2px solid ${todo.completed ? '#10b981' : '#475569'}`,
                        background: todo.completed ? '#10b981' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        color: 'white',
                        transition: 'all 0.2s'
                    }}
                >
                    {todo.completed && <Check size={14} strokeWidth={3} />}
                </button>
            )}

            <div style={{ flex: 1 }}>
                <p style={{
                    fontSize: '1.05rem',
                    textDecoration: todo.completed ? 'line-through' : 'none',
                    color: todo.completed ? '#94a3b8' : 'white',
                    marginBottom: '0.25rem'
                }}>
                    {todo.title}
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', pointerEvents: isSelectionMode ? 'none' : 'auto' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Calendar size={14} style={{ position: 'absolute', left: '6px', color: '#94a3b8', pointerEvents: 'none' }} />
                        <input
                            type="date"
                            value={todo.date || ''}
                            onChange={handleDateChange}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#cbd5e1',
                                fontSize: '0.8rem',
                                padding: '2px 4px 2px 24px',
                                fontFamily: 'inherit',
                                cursor: 'pointer'
                            }}
                        />
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Clock size={14} style={{ position: 'absolute', left: '6px', color: '#94a3b8', pointerEvents: 'none' }} />
                        <input
                            type="time"
                            value={todo.time || ''}
                            onChange={handleTimeChange}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#cbd5e1',
                                fontSize: '0.8rem',
                                padding: '2px 4px 2px 24px',
                                fontFamily: 'inherit',
                                cursor: 'pointer'
                            }}
                        />
                    </div>
                </div>
            </div>

            {!isSelectionMode && (
                <button
                    className="btn-icon"
                    onClick={(e) => { e.stopPropagation(); onDelete(todo.id); }}
                    style={{ color: '#ef4444', opacity: 0.7 }}
                >
                    <Trash2 size={18} />
                </button>
            )}
        </div>
    );
}

// --- Category Container (Sortable) ---
function CategoryContainer({ id, title, todos, onToggle, onDelete, onUpdate, isSelectionMode, selectedIds, onSelect }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id,
        data: { type: 'container', id },
        disabled: isSelectionMode
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        background: 'rgba(30, 41, 59, 0.4)',
        borderRadius: '16px',
        padding: '1rem',
        marginBottom: '1.5rem',
        border: '1px solid rgba(255,255,255,0.05)',
        position: 'relative'
    };

    return (
        <div ref={setNodeRef} style={style}>
            <h3 style={{
                fontSize: '1.1rem',
                marginBottom: '1rem',
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                {!isSelectionMode && (
                    <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                        <GripVertical size={18} />
                    </div>
                )}
                {title}
                <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', color: '#94a3b8' }}>
                    {todos.length}
                </span>
            </h3>

            <SortableContext items={todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {todos.map(todo => (
                        <SortableItem
                            key={todo.id}
                            todo={todo}
                            onToggle={onToggle}
                            onDelete={onDelete}
                            onUpdate={onUpdate}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedIds.includes(todo.id)}
                            onSelect={onSelect}
                        />
                    ))}
                    {todos.length === 0 && (
                        <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                            ドラッグして移動
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

// --- Date Group Container (Simple) ---
function DateGroupContainer({ title, todos, onToggle, onDelete, onUpdate, isSelectionMode, selectedIds, onSelect }) {
    if (todos.length === 0) return null;

    return (
        <div style={{
            background: 'rgba(30, 41, 59, 0.4)',
            borderRadius: '16px',
            padding: '1rem',
            marginBottom: '1.5rem',
            border: '1px solid rgba(255,255,255,0.05)'
        }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#e2e8f0' }}>
                {title}
                <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', color: '#94a3b8', marginLeft: '0.5rem' }}>
                    {todos.length}
                </span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {todos.map(todo => (
                    <SimpleItem
                        key={todo.id}
                        todo={todo}
                        onToggle={onToggle}
                        onDelete={onDelete}
                        onUpdate={onUpdate}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.includes(todo.id)}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        </div>
    );
}

export default function TodoList({
    todos,
    categories,
    viewMode,
    onToggle,
    onDelete,
    onUpdate,
    onDragEnd,
    onAddCategory,
    isSelectionMode,
    selectedIds,
    onSelect
}) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // --- Category View Logic ---
    const groupedByCat = useMemo(() => {
        const groups = {};
        categories.forEach(cat => groups[cat] = []);
        todos.forEach(todo => {
            const cat = todo.category || 'その他';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(todo);
        });
        return groups;
    }, [todos, categories]);

    const displayCategories = [...categories];
    Object.keys(groupedByCat).forEach(key => {
        if (!displayCategories.includes(key)) displayCategories.push(key);
    });

    // --- Date View Logic ---
    const groupedByDate = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        const groups = {
            overdue: [],
            today: [],
            tomorrow: [],
            later: [],
            noDate: []
        };

        // Sort all todos by date/time first
        const sortedTodos = [...todos].sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return (a.time || '').localeCompare(b.time || '');
        });

        sortedTodos.forEach(todo => {
            if (!todo.date) {
                groups.noDate.push(todo);
            } else if (todo.date < today) {
                groups.overdue.push(todo);
            } else if (todo.date === today) {
                groups.today.push(todo);
            } else if (todo.date === tomorrow) {
                groups.tomorrow.push(todo);
            } else {
                groups.later.push(todo);
            }
        });

        return groups;
    }, [todos]);

    if (todos.length === 0) {
        return (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <p>タスクがありません。<br />上のフォームからAIに依頼してみましょう！</p>
            </div>
        );
    }

    // --- Render Date View ---
    if (viewMode === 'date') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <DateGroupContainer title="期限切れ" todos={groupedByDate.overdue} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} isSelectionMode={isSelectionMode} selectedIds={selectedIds} onSelect={onSelect} />
                <DateGroupContainer title="今日" todos={groupedByDate.today} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} isSelectionMode={isSelectionMode} selectedIds={selectedIds} onSelect={onSelect} />
                <DateGroupContainer title="明日" todos={groupedByDate.tomorrow} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} isSelectionMode={isSelectionMode} selectedIds={selectedIds} onSelect={onSelect} />
                <DateGroupContainer title="以降" todos={groupedByDate.later} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} isSelectionMode={isSelectionMode} selectedIds={selectedIds} onSelect={onSelect} />
                <DateGroupContainer title="期限なし" todos={groupedByDate.noDate} onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate} isSelectionMode={isSelectionMode} selectedIds={selectedIds} onSelect={onSelect} />
            </div>
        );
    }

    // --- Render Category View (Default) ---
    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
            >
                <SortableContext items={displayCategories} strategy={verticalListSortingStrategy}>
                    {displayCategories.map(cat => (
                        <CategoryContainer
                            key={cat}
                            id={cat}
                            title={cat}
                            todos={groupedByCat[cat]}
                            onToggle={onToggle}
                            onDelete={onDelete}
                            onUpdate={onUpdate}
                            isSelectionMode={isSelectionMode}
                            selectedIds={selectedIds}
                            onSelect={onSelect}
                        />
                    ))}
                </SortableContext>
            </DndContext>

            <button
                onClick={onAddCategory}
                className="glass-panel"
                style={{
                    width: '100%',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    border: '1px dashed rgba(255,255,255,0.2)',
                    background: 'transparent',
                    marginTop: '1rem'
                }}
            >
                <Plus size={20} />
                新しいカテゴリを追加
            </button>
        </div>
    );
}
