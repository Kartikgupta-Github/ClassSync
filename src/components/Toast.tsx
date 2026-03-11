import React, { useState, useEffect } from 'react';

interface ToastItem {
    id: number;
    msg: string;
}

let toastId = 0;
let addToastFn: ((msg: string) => void) | null = null;

export const showToast = (msg: string) => {
    if (addToastFn) addToastFn(msg);
};

const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        addToastFn = (msg: string) => {
            const id = ++toastId;
            setToasts(prev => [...prev, { id, msg }]);
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800);
        };
        return () => { addToastFn = null; };
    }, []);

    return (
        <>
            {toasts.map((t, i) => (
                <div key={t.id} className="toast" style={{ bottom: `${24 + i * 50}px` }}>
                    {t.msg}
                </div>
            ))}
        </>
    );
};

export default ToastContainer;
