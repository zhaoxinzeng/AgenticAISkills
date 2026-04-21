import React, { useState } from 'react';
import { ArrowRight, Trash2, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNewsData } from '../hooks/useNewsData';
import { useAuth } from '../contexts/AuthContext';
import { AddNewsDialog } from './AddNewsDialog';
import type { NewsItem } from '../types/news';

export const PartnerNews: React.FC = () => {
    const { news, addNews, updateNews, removeNews } = useNewsData();
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'admin';
    const [editingNews, setEditingNews] = useState<NewsItem | null>(null);

    const handleDelete = (e: React.MouseEvent, id: string, isManual?: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm("确定要删除这条新闻吗？")) {
            removeNews(id, isManual);
            if (editingNews?.id === id) {
                setEditingNews(null);
            }
        }
    };

    const handleEdit = (e: React.MouseEvent, item: NewsItem) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingNews(item);
    };

    // Only show the latest 3 items on the dashboard
    const displayNews = news.slice(0, 3);

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">硬件伙伴新闻</h2>
                    <p className="text-[var(--color-text-secondary)] text-sm mt-1">最新芯片适配进展与生态联合发布</p>
                </div>

                <div className="flex items-center gap-4">
                    {isAdmin && (
                        <AddNewsDialog
                            onAddNews={addNews}
                            onUpdateNews={(id, updates) => updateNews(id, updates, editingNews?.isManual)}
                            editingItem={editingNews}
                            onCancelEdit={() => setEditingNews(null)}
                        />
                    )}

                    <Link
                        to="/news"
                        className="text-[var(--color-text-secondary)] hover:text-[var(--color-tech-blue)] text-sm font-semibold flex items-center gap-1 transition-colors group"
                    >
                        查看全部
                        <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>

            {displayNews.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-gray-200">
                    <p className="text-gray-500 font-medium">暂无新闻数据</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayNews.map((item) => {
                        const CardWrapper = item.link ? 'a' : 'div';
                        const cardProps = item.link ? { href: item.link, target: "_blank", rel: "noopener noreferrer" } : {};
                        return (
                            <CardWrapper key={item.id} {...cardProps} className="relative glass-panel group cursor-pointer flex flex-col items-start text-left p-0 bg-white shadow-sm border border-gray-100 hover:border-blue-100 hover:shadow-md transition-all duration-300">
                                {isAdmin && (
                                    <div className="absolute top-3 right-3 flex items-center gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => handleEdit(e, item)}
                                            className="p-1.5 bg-white/80 hover:bg-blue-500 hover:text-white text-gray-500 rounded-full transition-colors backdrop-blur-sm"
                                            title="编辑新闻"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(e, item.id, item.isManual)}
                                            className="p-1.5 bg-white/80 hover:bg-red-500 hover:text-white text-gray-500 rounded-full transition-colors backdrop-blur-sm"
                                            title="删除新闻"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                <div className="w-full h-48 overflow-hidden relative">
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent z-10 transition-opacity group-hover:opacity-40" />
                                    <img
                                        src={item.imageUrl}
                                        alt={item.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop';
                                        }}
                                    />
                                </div>
                                <div className="p-5 flex flex-col flex-1 w-full bg-white relative">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-bold text-[var(--color-tech-blue)] uppercase tracking-wider bg-blue-50 w-fit px-2 py-0.5 rounded-sm">{item.date}</span>
                                        {item.isManual && (
                                            <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                                                🔥 重大发新
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2 group-hover:text-[var(--color-tech-blue)] transition-colors line-clamp-2">
                                        {item.title}
                                    </h3>
                                    {item.summary && (
                                        <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed">
                                            {item.summary}
                                        </p>
                                    )}

                                    <div className="mt-auto pt-4 flex items-center text-sm font-bold text-gray-400 group-hover:text-[var(--color-tech-blue)] transition-colors border-t border-gray-50">
                                        Read More
                                        <ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </CardWrapper>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
