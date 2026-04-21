import { useState, useEffect } from 'react';
import type { NewsItem } from '../types/news';

const MANUAL_STORAGE_KEY = 'manual_ecosystem_news';
const DELETED_NEWS_KEY = 'deleted_news_ids';
const EDITED_NEWS_KEY = 'edited_news_overrides';

type EditedNewsOverrides = Record<string, Partial<Omit<NewsItem, 'id' | 'isManual'>>>;

const readEditedOverrides = (): EditedNewsOverrides => {
    try {
        const raw = localStorage.getItem(EDITED_NEWS_KEY);
        if (!raw) {
            return {};
        }

        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return parsed as EditedNewsOverrides;
        }
    } catch (error) {
        // ignore malformed overrides
    }

    return {};
};

export const useNewsData = () => {
    const [news, setNews] = useState<NewsItem[]>([]);

    useEffect(() => {
        const fetchAndMergeNews = async () => {
            let autoNews: NewsItem[] = [];
            try {
                const response = await fetch('/auto-news.json');
                if (response.ok) {
                    autoNews = await response.json();
                }
            } catch (error) {
                console.error("Failed to fetch auto-news", error);
            }

            // Filter out deleted auto-news
            let deletedIds: string[] = [];
            try {
                deletedIds = JSON.parse(localStorage.getItem(DELETED_NEWS_KEY) || '[]');
            } catch (e) { }
            autoNews = autoNews.filter(n => !deletedIds.includes(n.id));

            let manualNews: NewsItem[] = [];
            const storedManualNews = localStorage.getItem(MANUAL_STORAGE_KEY);
            if (storedManualNews) {
                try {
                    manualNews = JSON.parse(storedManualNews);
                } catch (error) {
                    console.error("Failed to parse manual news from localStorage", error);
                }
            }

            const editedOverrides = readEditedOverrides();

            const combinedNews = [...manualNews, ...autoNews].map((item) => {
                const override = editedOverrides[item.id];
                if (!override) {
                    return item;
                }

                return { ...item, ...override };
            });

            // Sort by date descending
            combinedNews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setNews(combinedNews);
        };

        fetchAndMergeNews();
    }, []);

    const addNews = (newItem: Omit<NewsItem, 'id'>) => {
        const newEntry: NewsItem = {
            ...newItem,
            id: crypto.randomUUID(),
            isManual: true // Force flag for manual entries
        };

        // Retrieve existing manual news
        let manualNews: NewsItem[] = [];
        const storedManualNews = localStorage.getItem(MANUAL_STORAGE_KEY);
        if (storedManualNews) {
            try {
                manualNews = JSON.parse(storedManualNews);
            } catch (error) {
                // ignore
            }
        }

        // Add to manual storage
        const updatedManualNews = [newEntry, ...manualNews];
        localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(updatedManualNews));

        // Update current state (adding to top of current view)
        setNews(prev => {
            const updated = [newEntry, ...prev];
            updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return updated;
        });
    };

    const updateNews = (id: string, updates: Partial<Omit<NewsItem, 'id' | 'isManual'>>, isManual?: boolean) => {
        if (isManual) {
            let manualNews: NewsItem[] = [];
            try {
                manualNews = JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEY) || '[]');
            } catch (e) { }

            const updatedManualNews = manualNews.map(n =>
                n.id === id ? { ...n, ...updates } : n
            );
            localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(updatedManualNews));
        } else {
            const editedOverrides = readEditedOverrides();
            const nextOverrides: EditedNewsOverrides = {
                ...editedOverrides,
                [id]: {
                    ...editedOverrides[id],
                    ...updates
                }
            };
            localStorage.setItem(EDITED_NEWS_KEY, JSON.stringify(nextOverrides));
        }

        setNews(prev => {
            const updated = prev.map(n => n.id === id ? { ...n, ...updates } : n);
            updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return updated;
        });
    };

    const removeNews = (id: string, isManual?: boolean) => {
        if (isManual) {
            let manualNews: NewsItem[] = [];
            try {
                manualNews = JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEY) || '[]');
            } catch (e) { }

            manualNews = manualNews.filter(n => n.id !== id);
            localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(manualNews));
        } else {
            let deletedIds: string[] = [];
            try {
                deletedIds = JSON.parse(localStorage.getItem(DELETED_NEWS_KEY) || '[]');
            } catch (e) { }

            if (!deletedIds.includes(id)) {
                deletedIds.push(id);
                localStorage.setItem(DELETED_NEWS_KEY, JSON.stringify(deletedIds));
            }
        }

        const editedOverrides = readEditedOverrides();
        if (editedOverrides[id]) {
            delete editedOverrides[id];
            localStorage.setItem(EDITED_NEWS_KEY, JSON.stringify(editedOverrides));
        }

        setNews(prev => prev.filter(n => n.id !== id));
    };

    return { news, addNews, updateNews, removeNews };
};
