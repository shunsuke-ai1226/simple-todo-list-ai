import React, { useState, useEffect } from 'react';
import { X, Save, Key } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, onSave }) {
    const [geminiKey, setGeminiKey] = useState('');
    const [googleClientId, setGoogleClientId] = useState('');

    useEffect(() => {
        if (isOpen) {
            setGeminiKey(localStorage.getItem('gemini_api_key') || '');
            setGoogleClientId(localStorage.getItem('google_client_id') || '');
        }
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('gemini_api_key', geminiKey);
        localStorage.setItem('google_client_id', googleClientId);
        onSave();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div className="glass-panel animate-fade-in" style={{ width: '90%', maxWidth: '500px', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Key size={24} color="#3b82f6" />
                        API設定
                    </h2>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Gemini API Key</label>
                        <input
                            type="password"
                            className="input-field"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AI Studioで取得したキーを入力"
                        />
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
                                キーの取得はこちら
                            </a>
                        </p>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Google Client ID (任意)</label>
                        <input
                            type="text"
                            className="input-field"
                            value={googleClientId}
                            onChange={(e) => setGoogleClientId(e.target.value)}
                            placeholder="Google Cloud Consoleで取得したClient ID"
                        />
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                            Google ToDo同期機能を使用する場合に必要です。
                        </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button className="btn btn-primary" onClick={handleSave}>
                            <Save size={18} />
                            保存する
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
