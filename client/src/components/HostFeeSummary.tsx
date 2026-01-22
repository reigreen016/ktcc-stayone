import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { apiRequest } from "@/lib/queryClient";
import "./host-fee-summary.css";

interface FeeSummary {
    feeRate: number;
    pendingCount: number;
    pendingTotal: string;
    currentMonthTotal: string;
    currentMonth: string;
    dueDate: string;
}

export function HostFeeSummary() {
    const { user } = useAuth();
    const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
    const [isSettling, setIsSettling] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchFeeSummary = async () => {
        if (!user) return;
        try {
            const res = await apiRequest("GET", "/api/host/fees/summary");
            const data = await res.json() as FeeSummary;
            setFeeSummary(data);
        } catch {
            // Silently fail - might be 401 or other error
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchFeeSummary();
        if (!user) return;
        const t = setInterval(fetchFeeSummary, 10000);
        return () => clearInterval(t);
    }, [user]);

    const onSettleMonthlyFee = async () => {
        setIsSettling(true);
        try {
            const res = await apiRequest("POST", "/api/host/fees/settle");
            const data = await res.json() as { success: boolean; amount?: string; txHash?: string; message?: string };
            toast({ title: "支払い完了", description: `今月分 ${data.amount || ""} dJPY を送金しました` });
            fetchFeeSummary();
        } catch (error: any) {
            toast({ title: "送金失敗", description: error.message || "手数料支払いに失敗しました", variant: "destructive" });
        } finally {
            setIsSettling(false);
        }
    };

    const formatMonth = (monthStr: string) => {
        const [year, month] = monthStr.split("-");
        return `${year}年${parseInt(month)}月`;
    };

    if (isLoading) {
        return <div className="fee-loading">読み込み中...</div>;
    }

    if (!feeSummary) {
        return <div className="fee-empty">手数料情報を取得できません</div>;
    }

    const currentMonthAmount = parseFloat(feeSummary.currentMonthTotal);
    const pendingAmount = parseFloat(feeSummary.pendingTotal);

    return (
        <div className="fee-summary-page">
            <div className="fee-main-card">
                <div className="fee-card-header">
                    <span className="fee-card-label">今月の手数料予定額</span>
                    <span className="fee-card-month">{formatMonth(feeSummary.currentMonth)}</span>
                </div>
                <div className="fee-card-amount">
                    <span className="fee-card-value">{currentMonthAmount.toLocaleString()}</span>
                    <span className="fee-card-unit">dJPY</span>
                </div>
                <div className="fee-card-subtext">
                    宿泊完了時に発生した売上の15%が手数料として計上されます
                </div>
            </div>

            <div className="fee-details-grid">
                <div className="fee-detail-card">
                    <div className="fee-detail-label">手数料率</div>
                    <div className="fee-detail-value">{(feeSummary.feeRate * 100).toFixed(0)}%</div>
                </div>
                <div className="fee-detail-card">
                    <div className="fee-detail-label">対象件数</div>
                    <div className="fee-detail-value">{feeSummary.pendingCount} 件</div>
                </div>
                <div className="fee-detail-card">
                    <div className="fee-detail-label">支払期限</div>
                    <div className="fee-detail-value">{new Date(feeSummary.dueDate).toLocaleDateString("ja-JP")}</div>
                </div>
                <div className="fee-detail-card">
                    <div className="fee-detail-label">未払い合計</div>
                    <div className="fee-detail-value highlight">{pendingAmount.toLocaleString()} dJPY</div>
                </div>
            </div>

            <div className="fee-action-section">
                <p className="fee-action-note">
                    月末までに手数料をお支払いください。支払いボタンを押すと、ウォレットから運営アカウントに送金されます。
                </p>
                <button
                    type="button"
                    className="fee-settle-button"
                    onClick={onSettleMonthlyFee}
                    disabled={isSettling || currentMonthAmount === 0}
                >
                    {isSettling ? "送金中..." : `今月分を支払う（${currentMonthAmount.toLocaleString()} dJPY）`}
                </button>
            </div>

            <div className="fee-info-section">
                <h4>手数料について</h4>
                <ul>
                    <li>宿泊完了時に売上の15%が手数料として計上されます</li>
                    <li>手数料は毎月末にまとめてお支払いいただきます</li>
                    <li>キャンセル時の手数料（50%）は自動的に運営に送金されます</li>
                </ul>
            </div>
        </div>
    );
}
