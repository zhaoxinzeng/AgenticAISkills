import axios from 'axios';
import Parser from 'rss-parser';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';

// 初始化环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.join(__dirname, '../public/auto-news.json');

// ==========================================
// 1. 初始化与配置 (数据源字典 & 关键词)
// ==========================================

const ECOSYSTEM_KEYWORDS = [
    "大模型", "LLM", "适配", "推理", "微调", "算力", "框架",
    "GPU", "NPU", "CPU", "芯片", "集群", "Llama", "PyTorch",
    "TensorFlow", "飞桨", "PaddlePaddle", "MindSpore", "文心", "ERNIE",
    "CUDA", "CANN", "ROCm", "MUSA", "智算"
];

const RSS_SOURCES = [
    {
        vendorName: 'Hugging Face Blog',
        url: 'https://huggingface.co/blog/feed.xml'
    },
    {
        vendorName: 'NVIDIA Developer News',
        url: 'https://developer.nvidia.com/blog/feed/'
    }
];

const API_SOURCES = [];

// 国内硬件厂商官网新闻页（无 RSS/API 时走 HTML 抓取）
const HTML_SOURCES = [
    {
        vendorName: "华为昇腾",
        listUrls: [
            "https://www.hiascend.com/zh/news",
            "https://www.hiascend.com/zh/"
        ],
        linkPatterns: [/hiascend\.com\/zh\/news\/detail\/\d+/i]
    },
    {
        vendorName: "寒武纪",
        listUrls: ["https://www.cambricon.com/index.php?a=lists&catid=7&m=content"],
        linkPatterns: [/index\.php\?a=show&catid=\d+&id=\d+&m=content/i]
    },
    {
        vendorName: "壁仞科技",
        listUrls: ["https://www.birentech.com/news"],
        linkPatterns: [/birentech\.com\/news\/(?!$)/i]
    },
    {
        vendorName: "昆仑芯科技",
        listUrls: ["https://www.kunlunxin.com/news"],
        linkPatterns: [/kunlunxin\.com\/news\/(?!$)/i],
        containerSelector: '.left .main'
    },
    {
        vendorName: "沐曦",
        listUrls: ["https://www.metax-tech.com/news"],
        linkPatterns: [/metax-tech\.com\/ndetail\/\d+\.html/i]
    },
    {
        vendorName: "海光信息",
        listUrls: [
            "https://www.hygon.cn/news",
            "https://www.hygon.cn/"
        ],
        linkPatterns: [/hygon\.cn\/(news|information|dynamic|article|detail|infodetails|press)[^"' ]*/i]
    },
    {
        vendorName: "燧原科技",
        listUrls: [
            "https://www.enflame-tech.com/news",
            "https://www.enflame-tech.com/"
        ],
        linkPatterns: [/enflame-tech\.com\/(news|newsdetail|detail|article|press)[^"' ]*/i]
    },
    {
        vendorName: "Intel Newsroom",
        listUrls: ["https://newsroom.intel.com/"],
        linkPatterns: [/newsroom\.intel\.com\/(news|press-kit)\/[^"' ]+/i]
    },
    {
        vendorName: "安谋科技",
        listUrls: [
            "https://www.armchina.com/index/",
            "https://www.armchina.com/"
        ],
        linkPatterns: [/armchina\.com\/infodetails\?id=\d+/i]
    }
];

// 统一的请求头，模拟真实浏览器
const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
};

// ==========================================
// 2. 大模型客户端双引擎初始化
// ==========================================

// 主引擎 (Gemini 2.5 Flash)
let geminiClient = null;
if (process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} else {
    console.warn("⚠️ 未配置 GEMINI_API_KEY，主引擎不可用。");
}

// 备引擎 (智谱 GLM-4-Flash)
let zhipuClient = null;
if (process.env.ZHIPU_API_KEY) {
    zhipuClient = new OpenAI({
        apiKey: process.env.ZHIPU_API_KEY,
        baseURL: "https://open.bigmodel.cn/api/paas/v4/"
    });
} else {
    console.warn("⚠️ 未配置 ZHIPU_API_KEY，备用引擎不可用。");
}

const SYSTEM_PROMPT = "你是我司的大模型与多硬件生态监控专家。请阅读以下新闻标题和原始摘要。判断该新闻是否实质性涉及'大模型(LLM)、深度学习框架在特定硬件(GPU/NPU)上的适配、训练优化、推理部署或硬核生态合作'。如果是普通的商业公关稿、线下活动（如训练营、大赛、全国行）或无关更新，严格仅输出单词：REJECT。如果相关，请用不超过30个字的精炼中文总结其核心业务价值。注意：如果输入没有摘要，强行用原标题推测业务价值即可，绝对不准回复'未提供摘要'等聊天内容，直接交出总结或抛出REJECT，输出不得包含任何多余文字。";

// ==========================================
// 3. 核心智能清洗函数 (双模型降级切换容灾 & 正文穿透)
// ==========================================

async function fetchArticleContent(targetUrl, defaultSummary) {
    if (!targetUrl) return defaultSummary;
    try {
        const response = await axios.get(targetUrl, {
            headers: REQUEST_HEADERS,
            timeout: 5000
        });
        const $ = cheerio.load(response.data);
        let content = '';
        $('p').each((i, el) => {
            content += $(el).text() + ' ';
        });
        const cleaned = content.replace(/\s+/g, ' ').trim();
        if (cleaned.length > 0) {
            return cleaned.substring(0, 1500); // 截取前 1500 字，防止撑爆大模型输入上限
        }
        return defaultSummary;
    } catch (err) {
        console.warn(`[正文穿透] 获取 ${targetUrl} 失败，回退至原摘要: ${err.message}`);
        return defaultSummary;
    }
}

async function processWithAI(newsItem) {
    // 强制先进行网页正文穿透获取
    const deepContent = await fetchArticleContent(newsItem.url, newsItem.summary || '');
    const prompt = `新闻标题：${newsItem.title}\n深入新闻正文内容：${deepContent}`;

    // 【Plan A: Gemini】
    if (geminiClient) {
        try {
            const response = await geminiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: SYSTEM_PROMPT
                }
            });
            const text = response.text || '';

            if (text.includes('REJECT')) {
                console.log(`❌ [AI 剔除] ${newsItem.vendor}: ${newsItem.title}`);
                return null;
            } else {
                newsItem.summary = text.replace(/\n/g, ' ').trim();
                console.log(`✅ [AI 提炼] ${newsItem.vendor}: ${newsItem.title}`);
                return newsItem;
            }
        } catch (error) {
            console.warn(`⚠️ [Gemini 限流/异常] 自动切换至智谱 GLM-4-Flash 处理: ${newsItem.title}`);
        }
    }

    // 【Plan B: Zhipu Fallback】
    if (zhipuClient) {
        try {
            const response = await zhipuClient.chat.completions.create({
                model: "glm-4-flash",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: prompt }
                ]
            });
            const text = response.choices[0]?.message?.content || '';

            if (text.includes('REJECT')) {
                console.log(`❌ [AI 剔除 (智谱)] ${newsItem.vendor}: ${newsItem.title}`);
                return null;
            } else {
                newsItem.summary = text.replace(/\n/g, ' ').trim();
                console.log(`✅ [AI 提炼 (智谱)] ${newsItem.vendor}: ${newsItem.title}`);
                return newsItem;
            }
        } catch (error) {
            console.error(`❌ [智谱 异常] Plan B 彻底失效，备库同告失败: ${error.message}`);
        }
    }

    // 【Plan C: 彻底兜底】
    newsItem.summary = "暂无智能摘要（双引擎均超时）";
    return newsItem;
}

// ==========================================
// 数据通道处理辅助函数
// ==========================================

function resolveUrl(baseUrl, targetUrl) {
    if (!targetUrl) return '';
    if (targetUrl.startsWith('http')) return targetUrl;
    try {
        const urlObj = new URL(targetUrl, baseUrl);
        return urlObj.href;
    } catch (e) {
        return targetUrl;
    }
}

function normalizeUrl(url) {
    return (url || '').replace(/\/+$/, '');
}

function extractDateFromText(text) {
    if (!text) return null;
    const normalized = text
        .replace(/[年月]/g, '-')
        .replace(/[日]/g, '')
        .replace(/[./]/g, '-')
        .replace(/\s+/g, ' ');

    const match = normalized.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
    if (!match) return null;

    const [, year, month, day] = match;
    const mm = String(Number(month)).padStart(2, '0');
    const dd = String(Number(day)).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

const parser = new Parser();

// 抓取 RSS 通道
async function fetchRssNews() {
    let results = [];
    for (const config of RSS_SOURCES) {
        try {
            console.log(`[RSS 抓取] 正在处理: ${config.vendorName}`);
            const feed = await parser.parseURL(config.url);

            // 提取前 5-10 条 (统一设为提取前 10 条上限保证覆盖面)
            const items = feed.items.slice(0, 10).map(item => {
                const absoluteUrl = resolveUrl(config.url, item.link);
                return {
                    id: crypto.createHash('md5').update(absoluteUrl || Date.now().toString()).digest('hex'),
                    vendor: config.vendorName,
                    title: item.title,
                    url: absoluteUrl,
                    date: item.isoDate ? new Date(item.isoDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    sourceType: 'RSS',
                    isManual: false,
                    summary: (item.contentSnippet || item.content || '').substring(0, 120) + '...',
                    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop',
                    link: absoluteUrl
                };
            });
            results = [...results, ...items];
            console.log(`[RSS 抓取] 成功提取 ${items.length} 条来自 ${config.vendorName}`);
        } catch (error) {
            console.error(`[RSS 抓取] 失败 ${config.vendorName}:`, error.message);
        }
    }
    return results;
}

// 抓取 API 通道
async function fetchApiNews() {
    let results = [];
    for (const config of API_SOURCES) {
        try {
            console.log(`[API 抓取] 正在处理: ${config.vendorName}`);

            const customHeaders = { ...REQUEST_HEADERS, ...(config.headers || { 'Referer': 'https://www.hiascend.com/' }) };
            const response = await axios({
                method: config.method || 'GET',
                url: config.apiUrl,
                headers: customHeaders,
                timeout: 10000
            });

            let dataList = response.data;
            if (config.dataPath && dataList[config.dataPath]) {
                dataList = dataList[config.dataPath];
            }

            if (!Array.isArray(dataList)) {
                console.warn(`[API 抓取] 返回格式非数组，跳过 ${config.vendorName}`);
                continue;
            }

            let count = 0;
            // 提取前 10 条
            for (const item of dataList) {
                if (count >= 10) break;

                const titleStr = item[config.mapping.title];
                let dateStr = item[config.mapping.date] || new Date().toISOString().split('T')[0];
                if (dateStr.includes('T')) {
                    dateStr = dateStr.split('T')[0];
                }

                const absoluteUrl = config.mapping.urlBuilder ? config.mapping.urlBuilder(item) : undefined;
                if (!titleStr || !absoluteUrl) continue;

                let imageUrl = item[config.mapping.cover] || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop';
                imageUrl = resolveUrl(config.apiUrl, imageUrl);

                results.push({
                    id: crypto.createHash('md5').update(absoluteUrl || Date.now().toString()).digest('hex'),
                    vendor: config.vendorName,
                    title: titleStr,
                    url: absoluteUrl,
                    date: dateStr,
                    sourceType: 'API',
                    isManual: false,
                    imageUrl: imageUrl,
                    summary: item[config.mapping.summary] ? String(item[config.mapping.summary]).substring(0, 120) + '...' : '',
                    link: absoluteUrl
                });
                count++;
            }
            console.log(`[API 抓取] 成功提取 ${count} 条来自 ${config.vendorName}`);
        } catch (error) {
            console.error(`[API 抓取] 失败 ${config.vendorName}:`, error.message);
        }
    }
    return results;
}

// 抓取 HTML 通道
async function fetchHtmlNews() {
    let results = [];
    // 将无日期的文章（通常为侧边栏推荐或活动回顾等）日期设为极旧，以便在全局倒序和切片中被淘汰
    const fallbackDate = '2000-01-01';

    for (const config of HTML_SOURCES) {
        const listUrls = Array.isArray(config.listUrls)
            ? config.listUrls
            : (config.listUrl ? [config.listUrl] : []);

        const seen = new Set();
        const items = [];

        for (const listUrl of listUrls) {
            if (items.length >= 10) break;
            try {
                console.log(`[HTML 抓取] 正在处理: ${config.vendorName} - ${listUrl}`);
                const response = await axios.get(listUrl, {
                    headers: REQUEST_HEADERS,
                    timeout: 10000
                });

                const $ = cheerio.load(response.data);
                const listUrlNormalized = normalizeUrl(listUrl);
                const selector = config.containerSelector ? `${config.containerSelector} a[href]` : 'a[href]';

                $(selector).each((_, element) => {
                    if (items.length >= 10) return;

                    const href = ($(element).attr('href') || '').trim();
                    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;

                    const absoluteUrl = resolveUrl(listUrl, href.split('#')[0].trim());
                    if (!absoluteUrl) return;

                    const normalizedAbs = normalizeUrl(absoluteUrl);
                    if (!normalizedAbs || normalizedAbs === listUrlNormalized) return;

                    const matchesPattern = (config.linkPatterns || []).some((pattern) => pattern.test(absoluteUrl));
                    if (!matchesPattern || seen.has(absoluteUrl)) return;

                    let title = $(element).text().replace(/\s+/g, ' ').trim();
                    if (!title || title.length < 6) return;

                    // 有些官网把日期和标题混排在同一节点，清洗成更稳定的标题
                    title = title.replace(/^\d{4}[./-]\d{1,2}[./-]\d{1,2}\s*/, '').trim();

                    const parentText = ($(element).closest('li,article,div').text() || '').replace(/\s+/g, ' ').trim();
                    const date = extractDateFromText(parentText) || extractDateFromText(title) || fallbackDate;

                    seen.add(absoluteUrl);
                    items.push({
                        id: crypto.createHash('md5').update(absoluteUrl).digest('hex'),
                        vendor: config.vendorName,
                        title,
                        url: absoluteUrl,
                        date,
                        sourceType: 'HTML',
                        isManual: false,
                        imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop',
                        summary: '',
                        link: absoluteUrl
                    });
                });
            } catch (error) {
                console.error(`[HTML 抓取] 失败 ${config.vendorName} (${listUrl}):`, error.message);
            }
        }

        results = [...results, ...items];
        console.log(`[HTML 抓取] 成功提取 ${items.length} 条来自 ${config.vendorName}`);
    }

    return results;
}

// ==========================================
// 4. 整合主干流程 fetchAllNews()
// ==========================================
async function fetchAllNews() {
    console.log("=== 开始获取原始新闻数据 ===");
    const rssNews = await fetchRssNews();
    const apiNews = await fetchApiNews();
    const htmlNews = await fetchHtmlNews();

    const rawCombinedNews = [...rssNews, ...apiNews, ...htmlNews];

    // 按日期全局倒序排列
    rawCombinedNews.sort((a, b) => {
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        return timeB - timeA;
    });

    console.log(`\n=== 原始数据合并完成，共计 ${rawCombinedNews.length} 条。开始智能清洗与摘要（双模型容灾） ===\n`);

    const finalNews = [];

    // 【新增】本地关键词白名单初筛 (Pre-filter)
    const preFilteredNews = rawCombinedNews.filter(item => {
        const textToSearch = (item.title + ' ' + (item.summary || '')).toLowerCase();
        return ECOSYSTEM_KEYWORDS.some(keyword => textToSearch.includes(keyword.toLowerCase()));
    });

    console.log(`[本地初筛] 过滤掉 ${rawCombinedNews.length - preFilteredNews.length} 条明显无关的内容，剩余 ${preFilteredNews.length} 条送入大模型处理。`);

    // 串行遍历大模型处理池
    for (const item of preFilteredNews) {
        const processed = await processWithAI(item);
        if (processed !== null) {
            finalNews.push(processed);
        }
    }

    // 【任务三】滑动窗口：仅保留最新的 100 条高质量新闻
    const finalNewsCapped = finalNews.slice(0, 100);

    try {
        await fs.writeFile(OUTPUT_PATH, JSON.stringify(finalNewsCapped, null, 2), 'utf-8');
        console.log(`\n🎉 [成功] 已将 ${finalNewsCapped.length} 条清洗后的优质新闻写入 ${OUTPUT_PATH} (过滤掉了 ${rawCombinedNews.length - finalNews.length} 条无关废稿)`);
    } catch (err) {
        console.error('\n❌ [严重错误] 写入 JSON 文件失败:', err);
    }
}

// 开始执行
fetchAllNews();
