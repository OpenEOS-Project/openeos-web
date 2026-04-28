import React from 'react';

interface PosIconEntry {
    id: string;
    terms: string[];
    icon256: string;
    dataUri: string;
}
interface PosIconProps {
    id: string;
    size?: number;
    className?: string;
    alt?: string;
}

declare function PosIcon({ id, size, className, alt }: PosIconProps): React.ReactElement | null;

declare function searchIcons(query: string): PosIconEntry[];
declare function getIcon(id: string): PosIconEntry | undefined;
declare function getAllIcons(): PosIconEntry[];

export { PosIcon, type PosIconEntry, type PosIconProps, getAllIcons, getIcon, searchIcons };
