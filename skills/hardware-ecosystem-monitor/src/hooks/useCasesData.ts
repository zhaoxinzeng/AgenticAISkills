import { useEffect, useMemo, useState } from 'react';
import type { EcoCase, CreateEcoCaseInput } from '../types/ecoCase';

const CASES_STORAGE_KEY = 'xinghe_cases_data';
const MAX_PINNED = 3;

const DEFAULT_CASES: EcoCase[] = [
    {
        id: 'ec1',
        title: '某自动驾驶企业基于昇腾 910B 的感知模型推理加速实践',
        description: '通过飞桨框架将感知模型迁移至昇腾 910B，推理延迟降低 42%，单卡吞吐提升 2.3 倍，已在量产车型中规模化部署。',
        industry: '自动驾驶',
        hardware: '昇腾 910B',
        url: 'https://invalid.local/pending-case-ec1',
        isPinned: false,
        createdAt: Date.now() - 3000
    },
    {
        id: 'ec2',
        title: '某头部银行基于昆仑芯 2 的风控大模型全栈国产化替代',
        description: '金融场景下完成从 GPU 至昆仑芯 2 的全量迁移，训练成本下降 35%，同时满足数据合规与算力自主可控要求。',
        industry: '金融风控',
        hardware: '昆仑芯 2',
        url: 'https://invalid.local/pending-case-ec2',
        isPinned: false,
        createdAt: Date.now() - 2000
    },
    {
        id: 'ec3',
        title: '某三甲医院基于海光 DCU 的医学影像大模型训练实践',
        description: '利用飞桨框架在海光 DCU 集群上完成 CT 影像分割模型的分布式训练，收敛速度与 A100 基线持平，已通过 NMPA 备案。',
        industry: '医疗影像',
        hardware: '海光 DCU',
        url: 'https://invalid.local/pending-case-ec3',
        isPinned: false,
        createdAt: Date.now() - 1000
    }
];

const sortByCreatedAtDesc = (a: EcoCase, b: EcoCase) => b.createdAt - a.createdAt;

const sortPinnedThenLatest = (a: EcoCase, b: EcoCase) => {
    if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
    }
    return sortByCreatedAtDesc(a, b);
};

const loadCasesFromStorage = (): EcoCase[] => {
    const saved = localStorage.getItem(CASES_STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed as EcoCase[];
            }
        } catch (error) {
            console.error('Failed to parse eco-cases data', error);
        }
    }
    return DEFAULT_CASES;
};

const buildFeaturedCases = (allCases: EcoCase[]): EcoCase[] => {
    if (allCases.length === 0) return [];

    const pinned = allCases.filter(c => c.isPinned).sort(sortByCreatedAtDesc);
    const unpinned = allCases.filter(c => !c.isPinned).sort(sortByCreatedAtDesc);

    return [...pinned, ...unpinned].slice(0, 3);
};

export const useCasesData = () => {
    const [cases, setCases] = useState<EcoCase[]>(loadCasesFromStorage);

    useEffect(() => {
        localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(cases));
    }, [cases]);

    const sortedCases = useMemo(() => [...cases].sort(sortPinnedThenLatest), [cases]);

    const featuredCases = useMemo(() => buildFeaturedCases(cases), [cases]);

    const addCase = (input: CreateEcoCaseInput) => {
        const next: EcoCase = {
            id: `case_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            title: input.title.trim(),
            description: input.description.trim(),
            industry: input.industry.trim(),
            hardware: input.hardware.trim(),
            url: input.url.trim() || `https://invalid.local/pending-case-${Date.now()}`,
            isPinned: false,
            createdAt: Date.now()
        };
        setCases(prev => [next, ...prev]);
    };

    const updateCase = (id: string, updates: Partial<Omit<EcoCase, 'id' | 'isPinned' | 'createdAt'>>) => {
        setCases(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const deleteCase = (id: string) => {
        setCases(prev => prev.filter(c => c.id !== id));
    };

    const togglePinCase = (id: string) => {
        setCases(prev => {
            const target = prev.find(c => c.id === id);
            if (!target) return prev;

            // If unpinning, just toggle
            if (target.isPinned) {
                return prev.map(c => c.id === id ? { ...c, isPinned: false } : c);
            }

            // If pinning, check limit
            const pinnedCount = prev.filter(c => c.isPinned).length;
            if (pinnedCount >= MAX_PINNED) {
                alert(`最多只能置顶 ${MAX_PINNED} 个案例，请先取消其他案例的置顶。`);
                return prev;
            }

            return prev.map(c => c.id === id ? { ...c, isPinned: true } : c);
        });
    };

    return {
        cases,
        sortedCases,
        featuredCases,
        addCase,
        updateCase,
        deleteCase,
        togglePinCase
    };
};
