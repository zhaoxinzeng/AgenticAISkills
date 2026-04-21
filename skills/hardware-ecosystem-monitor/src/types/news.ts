export interface NewsItem {
    id: string;
    date: string;
    title: string;
    imageUrl: string;
    summary?: string;
    link?: string;
    isManual?: boolean;
    sourceType?: string;
    vendor?: string;
}
