import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    subtitle?: string;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, subtitle, onClick }) => {
    return (
        <div
            className={`bg-white rounded-xl shadow-premium p-8 border border-[#E5E7EB] ${className}`}
            onClick={onClick}
        >
            {(title || subtitle) && (
                <div className="mb-6">
                    {title && <h3 className="text-xl font-bold text-[#1E293B] tracking-tight">{title}</h3>}
                    {subtitle && <p className="text-sm font-medium text-[#64748B] tracking-wide">{subtitle}</p>}
                </div>
            )}
            {children}
        </div>
    );
};

export const CardHeader: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => <div className={`p-6 border-b border-slate-100 ${className}`}>{children}</div>;
export const CardTitle: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => <h3 className={`text-xl font-bold text-slate-900 ${className}`}>{children}</h3>;
export const CardDescription: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => <p className={`text-sm text-slate-500 ${className}`}>{children}</p>;
export const CardContent: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => <div className={`p-6 ${className}`}>{children}</div>;

