import React from 'react';
import { Card } from '@/components/ui/card';

interface ChartContainerProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    height?: number | string;
    className?: string;
}

const ChartContainer: React.FC<ChartContainerProps> = ({
    title,
    subtitle,
    children,
    height = 300,
    className = ''
}) => {
    return (
        <Card title={title} subtitle={subtitle} className={className}>
            <div style={{ height, width: '100%' }}>
                {children}
            </div>
        </Card>
    );
};

export default ChartContainer;
