import { LucideIcon } from 'lucide-react';
import type { Config } from 'ziggy-js';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    href: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    ziggy: Config & { location: string };

    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;

    [key: string]: unknown;
}

export interface UserProps {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;

    [key: string]: unknown;
}

export type ContactStatus = 'online' | 'offline' | 'busy' | 'away';
export type CallType = 'audio' | 'video' | null;

export interface Contact {
    id: number;
    name: string;
    avatar: string;
    status: ContactStatus;
    lastSeen: string;
    favorite: boolean;
    email?: string;
    phone?: string;
    department?: string;
    location?: string;
}

export interface RecentCall {
    id: number;
    name: string;
    avatar: string;
    type: 'audio' | 'video';
    time: string;
    missed: boolean;
}
