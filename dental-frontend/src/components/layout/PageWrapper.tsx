import React from 'react';

interface PageWrapperProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    headerContent?: React.ReactNode;
}

export function PageWrapper({
    title,
    description,
    action,
    children,
    headerContent,
}: PageWrapperProps) {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-blue-900 dark:text-blue-100">{title}</h2>
                    {description && (
                        <p className="text-muted-foreground">{description}</p>
                    )}
                </div>
                {action && <div className="flex items-center space-x-2">{action}</div>}
            </div>
            {headerContent && <div className="mb-4">{headerContent}</div>}
            {children}
        </div>
    );
}
