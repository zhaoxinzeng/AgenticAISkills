export interface EcoCase {
    id: string;
    title: string;
    description: string;
    industry: string;
    hardware: string;
    url: string;
    isPinned: boolean;
    createdAt: number;
}

export interface CreateEcoCaseInput {
    title: string;
    description: string;
    industry: string;
    hardware: string;
    url: string;
}
