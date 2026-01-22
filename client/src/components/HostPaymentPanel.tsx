import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { apiRequest } from "@/lib/queryClient";

type EvmStatus = "unknown" | "running" | "stopped";
type FlowMode = "payment" | "refund_host_fault" | "refund_guest_fault";

interface AccountsResponse {
    accounts: { address: string; balance: string }[];
    contractAddress?: string;
}

interface FeeSummary {
    feeRate: number;
    pendingCount: number;
    pendingTotal: string;
    currentMonthTotal: string;
    currentMonth: string;
    dueDate: string;
}

/**
 * ホスト用決済パネル
 * - Hostアカウントの残高表示（ユーザーのウォレットから自動取得）
 * - 手数料支払い・返金操作
 */
export function HostPaymentPanel() {
    const { user } = useAuth();
    const [evmStatus, setEvmStatus] = useState<EvmStatus>("unknown");
    const [balance, setBalance] = useState<string>("0");
    const [contractAddress, setContractAddress] = useState<string>("");
    const [flowMode, setFlowMode] = useState<FlowMode>("payment");
    const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
    const [isSettling, setIsSettling] = useState(false);

    const walletAddress = user?.walletAddress || "";

    const shortAddr = (addr?: string) => {
        if (!addr) return "";
        return addr.slice(0, 6) + "…" + addr.slice(-4);
    };

    const fetchBalance = async () => {
        if (!walletAddress) return;
        try {
            const res = await fetch("/api/token/accounts");
            if (!res.ok) {
                setEvmStatus("stopped");
                return;
            }

            const data = await res.json() as AccountsResponse;
            setContractAddress(data.contractAddress || "");
            setEvmStatus("running");

            const account = data.accounts.find(
                (a) => a.address.toLowerCase() === walletAddress.toLowerCase()
            );
            if (account) {
                setBalance(account.balance);
            }
        } catch {
            setEvmStatus("stopped");
        }
    };

    const fetchFlowMode = async () => {
        try {
            const res = await fetch("/api/demo/status");
            if (!res.ok) return;
            const data = await res.json() as { success: boolean; flowMode?: FlowMode };
            if (data.flowMode) {
                setFlowMode(data.flowMode);
            }
        } catch { }
    };

    const fetchFeeSummary = async () => {
        if (!user) return;
        try {
            const res = await apiRequest("GET", "/api/host/fees/summary");
            const data = await res.json() as FeeSummary;
            setFeeSummary(data);
        } catch { }
    };

    useEffect(() => {
        fetchBalance();
        fetchFlowMode();
        const t = setInterval(() => { fetchBalance(); fetchFlowMode(); }, 5000);
        return () => clearInterval(t);
    }, [walletAddress]);

    useEffect(() => {
        fetchFeeSummary();
        if (!user) return;
        const t = setInterval(fetchFeeSummary, 5000);
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

    const flowModeLabel = flowMode === "payment" ? "通常支払い" : flowMode === "refund_host_fault" ? "ホスト不手際返金" : "ゲスト都合返金";

    const formatMonth = (monthStr: string) => {
        const [year, month] = monthStr.split("-");
        return `${year}年${parseInt(month)}月`;
    };

    return (
        <div className="payment-panel">
            {/* 今月の手数料サマリー */}
            {feeSummary && (
                <div className="fee-summary-card">
                    <h3 className="fee-summary-title">今月の運営手数料</h3>
                    <div className="fee-summary-month">{formatMonth(feeSummary.currentMonth)}</div>
                    <div className="fee-summary-amount">
                        <span className="fee-amount-value">{parseFloat(feeSummary.currentMonthTotal).toLocaleString()}</span>
                        <span className="fee-amount-unit">dJPY</span>
                    </div>
                    <div className="fee-summary-details">
                        <div className="fee-detail-row">
                            <span>手数料率</span>
                            <span>{(feeSummary.feeRate * 100).toFixed(0)}%</span>
                        </div>
                        <div className="fee-detail-row">
                            <span>対象件数</span>
                            <span>{feeSummary.pendingCount} 件</span>
                        </div>
                        <div className="fee-detail-row">
                            <span>支払期限</span>
                            <span>{new Date(feeSummary.dueDate).toLocaleDateString("ja-JP")}</span>
                        </div>
                    </div>
                    {parseFloat(feeSummary.pendingTotal) > 0 && (
                        <div className="fee-summary-warning">
                            未払い合計: {parseFloat(feeSummary.pendingTotal).toLocaleString()} dJPY
                        </div>
                    )}
                    <button
                        type="button"
                        className="primary-btn fee-settle-btn"
                        onClick={onSettleMonthlyFee}
                        disabled={isSettling || feeSummary.currentMonthTotal === "0.00"}
                    >
                        {isSettling ? "送金中..." : "今月分を支払う"}
                    </button>
                </div>
            )}

            <div className="payment-status">
                <div className="status-row">
                    <span className="status-label">EVM Status</span>
                    <span className={`status-value ${evmStatus === "running" ? "running" : evmStatus === "stopped" ? "stopped" : ""}`}>
                        {evmStatus === "running" ? "稼働中" : evmStatus === "stopped" ? "停止" : "確認中..."}
                    </span>
                </div>
                <div className="status-row">
                    <span className="status-label">ウォレット</span>
                    <span className="status-value">{walletAddress ? shortAddr(walletAddress) : "未設定"}</span>
                </div>
                <div className="status-row">
                    <span className="status-label">残高</span>
                    <span className="status-value balance">
                        {walletAddress ? `${parseFloat(balance).toLocaleString()} dJPY` : "—"}
                    </span>
                </div>
            </div>

            <div className="payment-info">
                <p>💡 宿泊完了後に売上が入金され、手数料（15%）は月末にまとめて運営に支払います。</p>
            </div>
        </div>
    );
}
