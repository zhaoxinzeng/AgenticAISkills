import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, ArrowUp, ExternalLink, Pin, Plus, Trash2, Pencil, Search, X, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCasesData } from '../hooks/useCasesData';
import { useAuth } from '../contexts/AuthContext';
import type { EcoCase } from '../types/ecoCase';

// 硬件兼容矩阵：模型/场景 -> 推荐硬件
const HARDWARE_COMPATIBILITY = {
    'LLM推理': ['昇腾 910B', '昆仑芯 2', '海光 DCU', '壁仞 BR104', '燧原邃思 2.0'],
    'LLM训练': ['昇腾 910B', '昆仑芯 R200', '海光 DCU', '沐曦 MXNACA'],
    'CV图像处理': ['昇腾 310P', '寒武纪 MLU370', '海光 DCU', '壁仞 BR104'],
    '自动驾驶感知': ['昇腾 910B', '地平线 J5', '寒武纪 MLU370'],
    '科学计算': ['海光 DCU', 'AMD MI100', 'NVIDIA A100'],
    '语音识别': ['昇腾 310P', '昆仑芯 R200', '寒武纪 MLU370'],
    '推荐系统': ['昇腾 910B', '昆仑芯 2', '海光 DCU'],
    '风控模型': ['昆仑芯 2', '海光 DCU', '昇腾 910B'],
    '医疗影像': ['海光 DCU', '昇腾 910B', '寒武纪 MLU370'],
    '智慧城市': ['昇腾 910B', '昆仑芯 R200', '寒武纪 MLU370'],
} as const;

type HardwareScenario = keyof typeof HARDWARE_COMPATIBILITY;

const createCaseDraft = () => ({
    title: '',
    description: '',
    industry: '',
    hardware: '',
    url: ''
});

export const AllCases: React.FC = () => {
    const { sortedCases, addCase, updateCase, deleteCase, togglePinCase } = useCasesData();
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'admin';

    const [isAdding, setIsAdding] = useState(false);
    const [editingCase, setEditingCase] = useState<EcoCase | null>(null);
    const [draft, setDraft] = useState(createCaseDraft);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterIndustry, setFilterIndustry] = useState('');
    const [filterHardware, setFilterHardware] = useState('');
    const [showCompatibility, setShowCompatibility] = useState(false);
    const [selectedScenario, setSelectedScenario] = useState<HardwareScenario | ''>('');

    // 获取所有唯一的行业和硬件选项
    const { industries, hardwareOptions } = useMemo(() => {
        const indSet = new Set<string>();
        const hwSet = new Set<string>();
        sortedCases.forEach(c => {
            if (c.industry) indSet.add(c.industry);
            if (c.hardware) hwSet.add(c.hardware);
        });
        return {
            industries: Array.from(indSet).sort(),
            hardwareOptions: Array.from(hwSet).sort()
        };
    }, [sortedCases]);

    // 过滤后的案例
    const filteredCases = useMemo(() => {
        return sortedCases.filter(c => {
            const matchSearch = !searchQuery ||
                c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.description.toLowerCase().includes(searchQuery.toLowerCase());
            const matchIndustry = !filterIndustry || c.industry === filterIndustry;
            const matchHardware = !filterHardware || c.hardware.toLowerCase().includes(filterHardware.toLowerCase());
            return matchSearch && matchIndustry && matchHardware;
        });
    }, [sortedCases, searchQuery, filterIndustry, filterHardware]);

    // 清除所有过滤条件
    const clearFilters = () => {
        setSearchQuery('');
        setFilterIndustry('');
        setFilterHardware('');
    };

    const hasActiveFilters = searchQuery || filterIndustry || filterHardware;

    const resetFormState = () => {
        setDraft(createCaseDraft());
        setEditingCase(null);
    };

    const handleSubmit = () => {
        const title = draft.title.trim();
        const description = draft.description.trim();
        const industry = draft.industry.trim();
        const hardware = draft.hardware.trim();
        const url = draft.url.trim();

        if (!title || !industry || !hardware) return;

        if (editingCase) {
            updateCase(editingCase.id, { title, description, industry, hardware, url });
        } else {
            addCase({ title, description, industry, hardware, url });
        }

        resetFormState();
        setIsAdding(false);
    };

    const handleStartEdit = (ecoCase: EcoCase) => {
        setEditingCase(ecoCase);
        setDraft({
            title: ecoCase.title,
            description: ecoCase.description,
            industry: ecoCase.industry,
            hardware: ecoCase.hardware,
            url: ecoCase.url
        });
        setIsAdding(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        resetFormState();
    };

    const handleDelete = (id: string) => {
        if (window.confirm('确定要删除该案例吗？')) {
            deleteCase(id);
            if (editingCase?.id === id) {
                resetFormState();
            }
        }
    };

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const isFormValid = draft.title.trim() && draft.industry.trim() && draft.hardware.trim();

    return (
        <div className="min-h-screen bg-[var(--color-bg-primary)] font-sans text-[var(--color-text-primary)]">
            <header className="sticky top-0 z-50 glass-panel border-b border-border-subtle/50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        to="/"
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div className="h-6 w-px bg-gray-200"></div>
                    <h1 className="text-lg font-bold tracking-tight text-gray-900">全部生态案例</h1>
                </div>

                {isAdmin && (
                    <button
                        onClick={() => {
                            if (isAdding) {
                                setIsAdding(false);
                                resetFormState();
                                return;
                            }
                            setIsAdding(true);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold border transition-colors ${isAdding
                            ? 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                            : 'bg-blue-50 text-[var(--color-tech-blue)] border-blue-100 hover:bg-blue-100'
                            }`}
                    >
                        <Plus className="w-4 h-4" />
                        {isAdding ? '取消新增' : '添加案例'}
                    </button>
                )}
            </header>

            <main className="max-w-[1440px] mx-auto p-4 md:p-8 animate-in fade-in duration-500">
                {/* 搜索与筛选 */}
                <div className="mb-6 space-y-4">
                    {/* 搜索框 */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="搜索案例名称或描述..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* 筛选器 */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <select
                            value={filterIndustry}
                            onChange={e => setFilterIndustry(e.target.value)}
                            className="px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                        >
                            <option value="">全部行业</option>
                            {industries.map(ind => (
                                <option key={ind} value={ind}>{ind}</option>
                            ))}
                        </select>

                        <select
                            value={filterHardware}
                            onChange={e => setFilterHardware(e.target.value)}
                            className="px-3 py-2 text-sm rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                        >
                            <option value="">全部硬件</option>
                            {hardwareOptions.map(hw => (
                                <option key={hw} value={hw}>{hw}</option>
                            ))}
                        </select>

                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-4 h-4" /> 清除筛选
                            </button>
                        )}

                        <div className="flex-1" />

                        {/* 硬件兼容分析入口 */}
                        <button
                            onClick={() => setShowCompatibility(!showCompatibility)}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-md border transition-colors ${showCompatibility
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200'
                                }`}
                        >
                            <Info className="w-4 h-4" />
                            硬件兼容分析
                        </button>
                    </div>

                    {/* 硬件兼容分析面板 */}
                    {showCompatibility && (
                        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
                            <h3 className="text-sm font-bold text-purple-900 mb-3">选择场景，获取硬件推荐</h3>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {(Object.keys(HARDWARE_COMPATIBILITY) as HardwareScenario[]).map(scenario => (
                                    <button
                                        key={scenario}
                                        onClick={() => setSelectedScenario(selectedScenario === scenario ? '' : scenario)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${selectedScenario === scenario
                                            ? 'bg-purple-600 text-white border-purple-600'
                                            : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-100'
                                            }`}
                                    >
                                        {scenario}
                                    </button>
                                ))}
                            </div>
                            {selectedScenario && (
                                <div className="bg-white rounded-md p-3 border border-purple-100">
                                    <p className="text-xs text-gray-500 mb-2">推荐硬件（按优先级排序）：</p>
                                    <div className="flex flex-wrap gap-2">
                                        {HARDWARE_COMPATIBILITY[selectedScenario].map((hw, idx) => (
                                            <span key={hw} className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold ${idx === 0 ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                                                }`}>
                                                {idx === 0 && '✨ '}{hw}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-3">
                                        以上推荐基于现有生态案例统计。查看相关案例：
                                        <button
                                            onClick={() => {
                                                setFilterHardware(HARDWARE_COMPATIBILITY[selectedScenario][0]);
                                                setShowCompatibility(false);
                                            }}
                                            className="ml-1 text-purple-600 hover:underline"
                                        >
                                            筛选 {HARDWARE_COMPATIBILITY[selectedScenario][0]} 案例
                                        </button>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 结果统计 */}
                    <p className="text-gray-500 font-medium text-sm">
                        {hasActiveFilters
                            ? `筛选结果：${filteredCases.length} / ${sortedCases.length} 个案例`
                            : `共 ${sortedCases.length} 个案例，排序规则：置顶优先，其次按最新创建时间`}
                    </p>
                </div>

                {/* 案例录入引导（仅非管理员可见） */}
                {!isAdmin && (
                    <div className="mb-6 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-4">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-blue-900 mb-1">如何提交新的硬件适配案例？</p>
                                <p className="text-xs text-blue-700 mb-2">
                                    请联系管理员提交案例。案例信息需包含：案例名称、行业领域、适配硬件、案例链接（可选）和简介描述。
                                </p>
                                <p className="text-xs text-blue-600">
                                    示例：某自动驾驶企业基于昇腾 910B 的感知模型推理加速实践 | 行业：自动驾驶 | 硬件：昇腾 910B
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {isAdmin && isAdding && (
                    <section className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/90 to-white p-4 md:p-5">
                        <h2 className="text-sm font-bold text-gray-900 mb-4">{editingCase ? '修改案例' : '新增案例'}</h2>
                        <p className="text-xs text-gray-500 mb-4">
                            {editingCase
                                ? '当前为编辑模式：修改后将原地更新该案例，不会改变置顶状态和创建时间。'
                                : '案例链接可暂时留空，保存时系统会自动生成占位无效链接，后续可再替换真实链接。'}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                                type="text"
                                placeholder="案例名称"
                                className="w-full px-3 py-2 text-sm rounded-md border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white md:col-span-2"
                                value={draft.title}
                                onChange={e => setDraft(prev => ({ ...prev, title: e.target.value }))}
                            />
                            <input
                                type="text"
                                placeholder="行业领域（如：金融/医疗）"
                                className="w-full px-3 py-2 text-sm rounded-md border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                value={draft.industry}
                                onChange={e => setDraft(prev => ({ ...prev, industry: e.target.value }))}
                            />
                            <input
                                type="text"
                                placeholder="适配硬件（如：昆仑芯/海光）"
                                className="w-full px-3 py-2 text-sm rounded-md border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                value={draft.hardware}
                                onChange={e => setDraft(prev => ({ ...prev, hardware: e.target.value }))}
                            />
                            <input
                                type="text"
                                placeholder="案例链接（如：https://...）"
                                className="w-full px-3 py-2 text-sm rounded-md border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white md:col-span-2"
                                value={draft.url}
                                onChange={e => setDraft(prev => ({ ...prev, url: e.target.value }))}
                            />
                        </div>
                        <textarea
                            placeholder="案例简介（可选，建议一句话描述核心价值与落地效果）"
                            rows={2}
                            className="w-full mt-3 px-3 py-2 text-sm rounded-md border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white resize-none"
                            value={draft.description}
                            onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
                        />
                        <div className="mt-4 flex justify-end">
                            {editingCase && (
                                <button
                                    onClick={handleCancelEdit}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-colors mr-2"
                                >
                                    取消
                                </button>
                            )}
                            <button
                                onClick={handleSubmit}
                                disabled={!isFormValid}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white"
                            >
                                {editingCase ? '保存修改' : '保存案例'}
                            </button>
                        </div>
                    </section>
                )}

                {filteredCases.length === 0 ? (
                    <div className="w-full py-20 flex flex-col items-center justify-center bg-white/50 rounded-2xl border border-dashed border-gray-200">
                        <p className="text-gray-500 font-medium">暂无案例数据</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filteredCases.map(ecoCase => (
                            <article key={ecoCase.id} className="bg-white rounded-xl border border-gray-200/70 shadow-sm flex flex-col overflow-hidden">
                                {/* Card Content */}
                                <a
                                    href={ecoCase.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-4 flex-1 hover:bg-gray-50/60 transition-colors group"
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <h3 className="font-bold text-base text-gray-900 leading-snug group-hover:text-[var(--color-tech-blue)] transition-colors">
                                            {ecoCase.title}
                                        </h3>
                                        <ExternalLink className="w-4 h-4 text-gray-400 shrink-0 mt-0.5 group-hover:text-[var(--color-tech-blue)] transition-colors" />
                                    </div>

                                    <div className="flex gap-2 flex-wrap mb-2">
                                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-medium">
                                            {ecoCase.industry}
                                        </span>
                                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">
                                            {ecoCase.hardware}
                                        </span>
                                        {ecoCase.isPinned && (
                                            <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded-sm flex items-center border border-amber-200/60">
                                                <Pin className="w-2.5 h-2.5 mr-0.5 fill-amber-700" /> 置顶
                                            </span>
                                        )}
                                    </div>

                                    {ecoCase.description && (
                                        <p className="line-clamp-2 text-sm text-gray-500 mt-2">{ecoCase.description}</p>
                                    )}
                                </a>

                                {/* Management Action Bar */}
                                {isAdmin && (
                                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 flex justify-end gap-4">
                                        <button
                                            onClick={() => togglePinCase(ecoCase.id)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border transition-colors ${ecoCase.isPinned
                                                ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                                                : 'text-gray-700 bg-gray-100 border-gray-200 hover:bg-gray-200'
                                                }`}
                                        >
                                            <ArrowUp className="w-3.5 h-3.5" />
                                            {ecoCase.isPinned ? '取消置顶' : '置顶'}
                                        </button>

                                        <button
                                            onClick={() => handleStartEdit(ecoCase)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold text-gray-600 bg-gray-100 border border-gray-200 hover:bg-blue-50 hover:text-[var(--color-tech-blue)] hover:border-blue-200 transition-colors"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                            编辑
                                        </button>

                                        <button
                                            onClick={() => handleDelete(ecoCase.id)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            删除
                                        </button>
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};
