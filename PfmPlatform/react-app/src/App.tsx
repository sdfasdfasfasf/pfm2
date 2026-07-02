import React, { useState, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './App.css';

// ---------- Интерфейсы ----------
interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
}

interface Deduction {
    transactionId: string;
    deductionType: string;
    reason: string;
    eligibleAmount: number;
}

interface TaxResponse {
    requestId: string;
    deductions: Deduction[];
    summary: {
        totalEligible: number;
        estimatedRefund: number;
    };
}

interface EnrichedTransaction extends Transaction {
    deductionType: string;
    included: boolean;
    expenseType?: string;
}

interface LimitInfo {
    show: boolean;
    description?: string;
    totalBase?: number;
    eligible?: number;
    details?: string;
}

// ---------- Начальные транзакции (соответствуют ВКР) ----------
const defaultTransactionsJson = `[
  {"id":"1","date":"2025-03-15","description":"ООО «Стоматология №1»","amount":145000},
  {"id":"2","date":"2025-02-22","description":"ЧОУ ДПО «Английский клуб»","amount":50000},
  {"id":"3","date":"2024-12-05","description":"Фитнес-клуб «WorldClass»","amount":60000},
  {"id":"4","date":"2025-01-10","description":"Покупка квартиры (договор купли-продажи)","amount":1800000},
  {"id":"5","date":"2025-06-20","description":"Уплата процентов по ипотеке (АО «Ипотечный банк»)","amount":180000},
  {"id":"6","date":"2024-11-20","description":"Пополнение ИИС типа А","amount":200000},
  {"id":"7","date":"2024-12-10","description":"Поступление от Яндекс.Такси","amount":45000}
]`;

const App: React.FC = () => {
    // ---------- Состояния ----------
    const [transactionsJson, setTransactionsJson] = useState(defaultTransactionsJson);
    const [requestId, setRequestId] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<TaxResponse | null>(null);
    const [originalTransactions, setOriginalTransactions] = useState<Transaction[]>(() =>
        JSON.parse(defaultTransactionsJson)
    );
    const [enrichedTransactions, setEnrichedTransactions] = useState<EnrichedTransaction[]>([]);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalDeductionType, setModalDeductionType] = useState('');
    const [modalTransactions, setModalTransactions] = useState<EnrichedTransaction[]>([]);

    // Состояния для модального окна памятки
    const [memoModalOpen, setMemoModalOpen] = useState(false);
    const [pdfGenerating, setPdfGenerating] = useState(false);
    const memoContentRef = useRef<HTMLDivElement>(null);

    // ---------- Вспомогательные функции ----------
    const getExpenseType = (tx: Transaction): string => {
        const desc = tx.description.toLowerCase();
        if (desc.includes('стоматолог')) return 'Лечение';
        if (desc.includes('английский клуб')) return 'Обучение';
        if (desc.includes('фитнес')) return 'Физкультурно-оздоровительные услуги';
        if (desc.includes('покупка квартиры')) return 'Имущественный';
        if (desc.includes('проценты по ипотеке')) return 'Ипотечные проценты';
        if (desc.includes('иис')) return 'Внесение средств на ИИС';
        if (desc.includes('яндекс.такси')) return 'Доход от самозанятости';
        return '';
    };

    const enrichTransactions = (transactions: Transaction[], deductions: Deduction[]): EnrichedTransaction[] => {
        const deductionMap = new Map<string, string>();
        for (const d of deductions) {
            deductionMap.set(d.transactionId, d.deductionType);
        }
        return transactions.map(tx => {
            let dt = deductionMap.get(tx.id) || 'none';
            if (tx.description.toLowerCase().includes('яндекс.такси')) dt = 'professional';
            if (tx.description.toLowerCase().includes('покупка квартиры') ||
                tx.description.toLowerCase().includes('проценты по ипотеке')) {
                if (dt === 'none') dt = 'property';
            }
            return {
                ...tx,
                deductionType: dt,
                included: dt !== 'none',
                expenseType: getExpenseType(tx)
            };
        });
    };

    const recalcAmounts = (enriched: EnrichedTransaction[]) => {
        let social = 0, property = 0, investment = 0, professional = 0;
        for (const tx of enriched) {
            if (!tx.included) continue;
            if (tx.deductionType === 'social') social += tx.amount;
            if (tx.deductionType === 'property') property += tx.amount;
            if (tx.deductionType === 'investment') investment += tx.amount;
            if (tx.deductionType === 'professional') professional += tx.amount;
        }
        return { social, property, investment, professional };
    };

    const buildCards = (enriched: EnrichedTransaction[]) => {
        const amounts = recalcAmounts(enriched);
        return [
            {
                id: 'social',
                title: 'Социальный вычет',
                description: 'лечение, обучение, фитнес',
                totalBase: amounts.social,
                estimatedTaxRefund: amounts.social * 0.13,
            },
            {
                id: 'property',
                title: 'Имущественный вычет',
                description: 'покупка квартиры, ипотечные проценты',
                totalBase: amounts.property,
                estimatedTaxRefund: amounts.property * 0.13,
            },
            {
                id: 'investment',
                title: 'Инвестиционный вычет',
                description: 'пополнение ИИС',
                totalBase: amounts.investment,
                estimatedTaxRefund: amounts.investment * 0.13,
            },
            {
                id: 'professional',
                title: 'Профессиональный вычет',
                description: 'для самозанятых',
                totalBase: amounts.professional,
                estimatedTaxRefund: amounts.professional * 0.13,
            }
        ];
    };

    const getLimitInfo = (deductionType: string, transactions: EnrichedTransaction[]): LimitInfo => {
        const totalBase = transactions.reduce((sum, tx) => sum + tx.amount, 0);
        if (deductionType === 'social') {
            const limit = 120000;
            const eligible = Math.min(totalBase, limit);
            return {
                show: true,
                description: 'Вычет предоставляется на сумму до 120 000 ₽ в год по всем социальным расходам (лечение, обучение, фитнес).',
                totalBase,
                eligible,
            };
        }
        if (deductionType === 'property') {
            const buyAmount = transactions
                .filter(tx => tx.description.toLowerCase().includes('покупка квартиры'))
                .reduce((s, tx) => s + tx.amount, 0);
            const interestAmount = transactions
                .filter(tx => tx.description.toLowerCase().includes('проценты по ипотеке'))
                .reduce((s, tx) => s + tx.amount, 0);
            const buyLimit = 2000000;
            const interestLimit = 3000000;
            const buyEligible = Math.min(buyAmount, buyLimit);
            const interestEligible = Math.min(interestAmount, interestLimit);
            const totalEligible = buyEligible + interestEligible;
            return {
                show: true,
                description: `Вычет на приобретение жилья – до 2 000 000 ₽ (возврат 260 000 ₽), на проценты по ипотеке – до 3 000 000 ₽ (возврат 390 000 ₽).`,
                totalBase,
                eligible: totalEligible,
                details: `Покупка: ${buyEligible.toLocaleString('ru-RU')} ₽, проценты: ${interestEligible.toLocaleString('ru-RU')} ₽`,
            };
        }
        if (deductionType === 'investment') {
            const limit = 400000;
            const eligible = Math.min(totalBase, limit);
            return {
                show: true,
                description: 'Вычет предоставляется на сумму до 400 000 ₽ в год (возврат 52 000 ₽) при внесении средств на ИИС типа А.',
                totalBase,
                eligible,
            };
        }
        if (deductionType === 'professional') {
            const eligible = Math.round(totalBase * 0.2);
            return {
                show: true,
                description: 'Профессиональный вычет предоставляется в размере 20% от дохода без подтверждения документов.',
                totalBase,
                eligible,
            };
        }
        return { show: false };
    };

    // ---------- Работа с API ----------
    const handleAnalyze = async () => {
        setLoading(true);
        setResult(null);
        try {
            let transactions: Transaction[];
            try {
                transactions = JSON.parse(transactionsJson);
                if (!Array.isArray(transactions)) throw new Error();
            } catch {
                alert('Неверный JSON. Исправьте формат данных.');
                setLoading(false);
                return;
            }
            setOriginalTransactions(transactions);
            const response = await axios.post('/api/tax/analyze', transactions);
            const { requestId } = response.data;
            setRequestId(requestId);
            pollResult(requestId);
        } catch (error) {
            console.error(error);
            alert('Ошибка при отправке запроса');
            setLoading(false);
        }
    };

    const pollResult = async (id: string) => {
        const interval = setInterval(async () => {
            try {
                const response = await axios.get<TaxResponse>(`/api/tax/result/${id}`);
                if (response.data) {
                    setResult(response.data);
                    const enriched = enrichTransactions(originalTransactions, response.data.deductions);
                    setEnrichedTransactions(enriched);
                    setLoading(false);
                    clearInterval(interval);
                }
            } catch (err: any) {
                if (err.response?.status !== 404) {
                    clearInterval(interval);
                    setLoading(false);
                    alert('Ошибка получения результата');
                }
            }
        }, 2000);
    };

    // ---------- Модальные окна детализации ----------
    const openDetails = (deductionType: string, title: string) => {
        let filtered: EnrichedTransaction[] = [];
        if (deductionType === 'social') {
            filtered = enrichedTransactions.filter(tx => tx.deductionType === 'social' && tx.included);
        } else if (deductionType === 'property') {
            filtered = enrichedTransactions.filter(tx => tx.deductionType === 'property' && tx.included);
        } else if (deductionType === 'investment') {
            filtered = enrichedTransactions.filter(tx => tx.deductionType === 'investment' && tx.included);
        } else if (deductionType === 'professional') {
            filtered = enrichedTransactions.filter(tx => tx.deductionType === 'professional' && tx.included);
        }
        setModalDeductionType(deductionType);
        setModalTitle(title);
        setModalTransactions(filtered);
        setModalOpen(true);
    };

    const excludeTransaction = (txId: string) => {
        const updated = enrichedTransactions.map(tx =>
            tx.id === txId ? { ...tx, included: false } : tx
        );
        setEnrichedTransactions(updated);
        setModalTransactions(prev => prev.filter(tx => tx.id !== txId));
    };

    // ---------- Генерация PDF из HTML (модальное окно памятки) ----------
    const generatePDFFromHTML = async () => {
        if (!memoContentRef.current) return;
        setPdfGenerating(true);
        try {
            const element = memoContentRef.current;
            const canvas = await html2canvas(element, {
                scale: 2,
                logging: false,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const doc = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;
            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                doc.addPage();
                doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            doc.save(`tax-memo-${result?.requestId || 'report'}.pdf`);
        } catch (error) {
            console.error('PDF generation error:', error);
            alert('Не удалось сгенерировать PDF. Попробуйте позже.');
        } finally {
            setPdfGenerating(false);
        }
    };

    const handleOpenMemoModal = () => {
        if (!enrichedTransactions.length) {
            alert('Сначала выполните анализ транзакций.');
            return;
        }
        setMemoModalOpen(true);
    };

    // --- Содержимое памятки для отображения в модальном окне (HTML) ---
    const renderMemoContent = () => {
        const cards = buildCards(enrichedTransactions);
        const totalEligible = cards.reduce((sum, c) => sum + c.totalBase, 0);
        const totalRefund = totalEligible * 0.13;
        return (
            <div className="memo-content" ref={memoContentRef}>
                <h1>Памятка для ФНС</h1>
                <p>Дата: {new Date().toLocaleDateString('ru-RU')}</p>
                <p>Request ID: {result?.requestId || '—'}</p>

                <h2>Выявленные вычеты</h2>
                <table className="memo-table summary-table">
                    <thead>
                        <tr><th>Вид вычета</th><th>Сумма расходов</th><th>Экономия (13%)</th></tr>
                    </thead>
                    <tbody>
                        {cards.map(card => (
                            <tr key={card.id}>
                                <td>{card.title}</td>
                                <td>{card.totalBase.toLocaleString('ru-RU')} ₽</td>
                                <td>{Math.round(card.estimatedTaxRefund).toLocaleString('ru-RU')} ₽</td>
                            </tr>
                        ))}
                        <tr className="memo-total">
                            <td><strong>Итого</strong></td>
                            <td><strong>{totalEligible.toLocaleString('ru-RU')} ₽</strong></td>
                            <td><strong>{Math.round(totalRefund).toLocaleString('ru-RU')} ₽</strong></td>
                        </tr>
                    </tbody>
                </table>

                <h2>Детализация по вычетам</h2>
                {cards.map(card => {
                    let filtered: EnrichedTransaction[] = [];
                    if (card.id === 'social') filtered = enrichedTransactions.filter(tx => tx.deductionType === 'social' && tx.included);
                    else if (card.id === 'property') filtered = enrichedTransactions.filter(tx => tx.deductionType === 'property' && tx.included);
                    else if (card.id === 'investment') filtered = enrichedTransactions.filter(tx => tx.deductionType === 'investment' && tx.included);
                    else if (card.id === 'professional') filtered = enrichedTransactions.filter(tx => tx.deductionType === 'professional' && tx.included);
                    if (filtered.length === 0) return null;
                    return (
                        <div key={card.id}>
                            <h3>{card.title}</h3>
                            <table className="memo-table detail-table">
                                <thead>
                                    <tr>
                                        <th>Дата</th>
                                        <th>Описание</th>
                                        <th>Сумма</th>
                                        <th>Тип расхода</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(tx => (
                                        <tr key={tx.id}>
                                            <td>{tx.date}</td>
                                            <td>{tx.description}</td>
                                            <td>{tx.amount.toLocaleString('ru-RU')} ₽</td>
                                            <td>{tx.expenseType || ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })}

                <h2>Как заполнить декларацию 3‑НДФЛ</h2>
                <ol>
                    <li>Зайдите в личный кабинет налогоплательщика на сайте ФНС (nalog.ru).</li>
                    <li>Выберите раздел «Жизненные ситуации» → «Подать декларацию 3-НДФЛ».</li>
                    <li>Заполните данные о доходах (справка 2-НДФЛ, если вы наёмный работник).</li>
                    <li>В разделе «Вычеты» укажите суммы, выявленные нашим сервисом:
                        <ul>
                            {cards.map(c => <li key={c.id}>{c.title}: {c.totalBase.toLocaleString('ru-RU')} ₽</li>)}
                        </ul>
                    </li>
                    <li>Приложите подтверждающие документы (чеки, договоры, справки об оплате).</li>
                    <li>Отправьте декларацию через личный кабинет или в отделении ФНС.</li>
                </ol>
                <p><strong>Важно:</strong> Социальный вычет ограничен 120 000 ₽ в год; имущественный – до 2 000 000 ₽ (покупка) и до 3 000 000 ₽ (проценты); инвестиционный – до 400 000 ₽ в год; профессиональный – 20% от дохода для самозанятых.</p>
            </div>
        );
    };

    const cards = buildCards(enrichedTransactions);
    const totalEligible = cards.reduce((sum, c) => sum + c.totalBase, 0);
    const estimatedRefund = totalEligible * 0.13;

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>Налоговый помощник (PFM)</h1>
                <p>Анализ транзакций для получения налоговых вычетов</p>
            </header>

            <main className="app-main">
                <section className="input-section">
                    <h2>Ввод транзакций</h2>
                    <textarea
                        rows={9}
                        value={transactionsJson}
                        onChange={(e) => setTransactionsJson(e.target.value)}
                    />
                    <button onClick={handleAnalyze} disabled={loading} className="analyze-btn">
                        {loading ? 'Анализируем...' : 'Анализировать вычеты'}
                    </button>
                    {requestId && <p className="request-id">Request ID: {requestId}</p>}
                </section>

                <section className="result-section">
                    <div className="deductions-grid">
                        {cards.map((card) => (
                            <div key={card.id} className="deduction-card">
                                <div className="card-header">
                                    <h3>{card.title}</h3>
                                </div>
                                <p className="card-description">{card.description}</p>
                                <div className="card-stats">
                                    <div className="stat-row">
                                        <span className="stat-label">Сумма расходов:</span>
                                        <span className="stat-value">{card.totalBase.toLocaleString('ru-RU')} ₽</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">Предполагаемая экономия (13%):</span>
                                        <span className="stat-value stat-highlight">
                                            {Math.round(card.estimatedTaxRefund).toLocaleString('ru-RU')} ₽
                                        </span>
                                    </div>
                                </div>
                                <button className="details-btn" onClick={() => openDetails(card.id, card.title)}>
                                    Подробнее
                                </button>
                            </div>
                        ))}
                    </div>

                    {totalEligible > 0 && (
                        <div className="savings-card">
                            <h3>Итого возможная экономия</h3>
                            <div className="savings-amount">{Math.round(estimatedRefund).toLocaleString('ru-RU')} ₽</div>
                            <button onClick={handleOpenMemoModal} className="memo-btn">
                                Сформировать памятку для ФНС
                            </button>
                        </div>
                    )}
                </section>
            </main>

            {/* Модальное окно детализации вычета (Б.2 – Б.5) */}
            {modalOpen && (
                <div className="modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{modalTitle}</h2>
                            <button className="modal-close" onClick={() => setModalOpen(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <table className="transactions-table">
                                <thead>
                                    <tr>
                                        <th>Дата</th>
                                        <th>Описание</th>
                                        <th>Сумма (₽)</th>
                                        <th>Тип расхода</th>
                                        <th>Действие</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modalTransactions.map(tx => (
                                        <tr key={tx.id}>
                                            <td>{tx.date}</td>
                                            <td>{tx.description}</td>
                                            <td>{tx.amount.toLocaleString('ru-RU')}</td>
                                            <td>{tx.expenseType || ''}</td>
                                            <td>
                                                <button className="exclude-btn" onClick={() => excludeTransaction(tx.id)}>
                                                    Исключить
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {modalTransactions.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="no-data">Нет операций для данного вычета</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {(() => {
                                const info = getLimitInfo(modalDeductionType, modalTransactions);
                                if (!info.show || info.totalBase === undefined || info.eligible === undefined) return null;
                                return (
                                    <div className="limit-info">
                                        <p>{info.description}</p>
                                        <p>
                                            Суммируемая база: <strong>{info.totalBase.toLocaleString('ru-RU')} ₽</strong>
                                            {info.details ? ` (${info.details})` : ''}
                                            {', учтено: '}
                                            <strong>{info.eligible.toLocaleString('ru-RU')} ₽</strong>
                                        </p>
                                    </div>
                                );
                            })()}

                            <div className="modal-buttons">
                                <button className="modal-back" onClick={() => setModalOpen(false)}>Назад</button>
                                <button className="modal-confirm" onClick={() => setModalOpen(false)}>Подтвердить</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно памятки для ФНС */}
            {memoModalOpen && (
                <div className="modal-overlay" onClick={() => setMemoModalOpen(false)}>
                    <div className="modal-content memo-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Памятка для ФНС</h2>
                            <button className="modal-close" onClick={() => setMemoModalOpen(false)}>&times;</button>
                        </div>
                        <div className="modal-body memo-body">
                            {renderMemoContent()}
                        </div>
                        <div className="modal-buttons">
                            <button className="modal-back" onClick={() => setMemoModalOpen(false)}>Закрыть</button>
                            <button
                                className="modal-confirm download-pdf-btn"
                                onClick={generatePDFFromHTML}
                                disabled={pdfGenerating}
                            >
                                {pdfGenerating ? 'Генерация PDF...' : 'Скачать PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;