import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from './config';

export default function Dashboard() {
    const [pdfs, setPdfs] = useState([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const userId = localStorage.getItem('user_id');

    useEffect(() => {
        fetchPdfs();
    }, []);

    const fetchPdfs = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/pdfs`);
            setPdfs(res.data);
        } catch (err) {
            console.error("Failed to fetch PDFs", err);
        }
    };

    const handleAnalyzeAll = async () => {
        if (!userId) {
            alert("Please register/login first!");
            return;
        }
        setAnalyzing(true);
        setResult(null);
        try {
            const res = await axios.post(`${API_BASE_URL}/analyze`, {
                user_id: userId
            });
            setResult(res.data);
        } catch (err) {
            console.error(err);
            alert("Analysis failed: " + (err.response?.data?.error || err.message));
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="container" style={{ maxWidth: '800px' }}>
            <h1>Your Documents</h1>
            <p>PDFs found in your temp folder.</p>

            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={handleAnalyzeAll}
                    disabled={analyzing || pdfs.length === 0}
                    style={{
                        width: '100%',
                        padding: '15px',
                        fontSize: '1.1rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: analyzing || pdfs.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: analyzing || pdfs.length === 0 ? 0.7 : 1
                    }}
                >
                    {analyzing ? 'Analyzing All Documents...' : 'Analyze All Documents with AI'}
                </button>
            </div>

            {result && (
                <div style={{
                    background: 'rgba(0,0,0,0.3)',
                    padding: '20px',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <h3>Analysis Result</h3>
                    <pre style={{ fontSize: '0.9rem', color: '#a29bfe', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}

            <div className="pdf-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                {pdfs.length === 0 && <p>No PDFs found.</p>}

                {pdfs.map(pdf => (
                    <div key={pdf} style={{
                        background: 'rgba(255,255,255,0.05)',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <span style={{ marginRight: '10px' }}>📄</span>
                        <span style={{ fontWeight: '500' }}>{pdf}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
