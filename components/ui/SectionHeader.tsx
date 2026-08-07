'use client'

import React from 'react';

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    className?: string;
    badge?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, className = '', badge }) => {
    return (
        <div className={`mb-6 flex flex-col gap-1 ${className}`}>
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-[#1E293B] tracking-tight">{title}</h2>
                {badge && (
                    <span className="px-2 py-0.5 rounded-md bg-[#E0F2FE] text-[#0369A1] text-[10px] font-black uppercase tracking-wider">
                        {badge}
                    </span>
                )}
            </div>
            {subtitle && <p className="text-[#64748B] text-sm font-medium">{subtitle}</p>}
        </div>
    );
};

export default SectionHeader;
