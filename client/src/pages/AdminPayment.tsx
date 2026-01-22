import { useState, useEffect } from "react";
import { PageLayout } from "@/components/layout/SiteChrome";
import { toast } from "@/hooks/use-toast";
import "@/components/payment-panel.css";

interface Account {
    name: string;
    address: string;
    balance: string;
}

interface AccountsResponse {
    accounts: Account[];
    contractAddress?: string;
}

interface TransactionResult {
    success: boolean;
    txHash?: string;
    message: string;
}

async function safeJson<T>(res: Response): Promise<{ ok: boolean; status: number; data?: T }> {
    const rawText = await res.text();
    try {
        const data = JSON.parse(rawText) as T;
        return { ok: res.ok, status: res.status, data };
    } catch {
        return { ok: res.ok, status: res.status, data: undefined };
    }
}

/**
 * 管理者用JPYC管理ページ
 * - 全アカウントの残高一覧
 * - JPYCのMint（発行）
 * - Transfer（送金）
 */
export default function AdminPayment() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [contractAddress, setContractAddress] = useState<string>("");
    const [evmStatus, setEvmStatus] = useState<"unknown" | "running" | "stopped">("unknown");
    const [loading, setLoading] = useState(false);

    // Mint form
    const [mintTo, setMintTo] = useState("");
    const [mintAmount, setMintAmount] = useState("");

    // Transfer form
    const [transferFrom, setTransferFrom] = useState("");
    const [transferTo, setTransferTo] = useState("");
    const [transferAmount, setTransferAmount] = useState("");

    const shortAddr = (addr?: string) => {
        if (!addr) return "";
        return addr.slice(0, 6) + "…" + addr.slice(-4);
    };

    const fetchAccounts = async () => {
        try {
            const res = await fetch("/api/token/accounts");
            const parsed = await safeJson<AccountsResponse>(res);
            if (parsed.ok && parsed.data) {
                setAccounts(parsed.data.accounts || []);
                setContractAddress(parsed.data.contractAddress || "");
                setEvmStatus("running");
            } else {
                setEvmStatus("stopped");
            }
        } catch {
            setEvmStatus("stopped");
        }
    };

    useEffect(() => {
        fetchAccounts();
        const t = setInterval(fetchAccounts, 5000);
        return () => clearInterval(t);
    }, []);

    const handleMint = async () => {
        if (!mintTo || !mintAmount) {
            toast({ title: "エラー", description: "宛先と金額を入力してください", variant: "destructive" });
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/token/mint", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: mintTo, amount: mintAmount }),
            });
            const parsed = await safeJson<TransactionResult>(res);
            if (parsed.data?.success) {
                toast({ title: "成功", description: `${mintAmount} dJPY を発行しました` });
                setMintAmount("");
                await fetchAccounts();
            } else {
                toast({ title: "エラー", description: parsed.data?.message || "Mint失敗", variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "エラー", description: e?.message || "unknown", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async () => {
        if (!transferFrom || !transferTo || !transferAmount) {
            toast({ title: "エラー", description: "送金元、送金先、金額を入力してください", variant: "destructive" });
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/token/transfer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ from: transferFrom, to: transferTo, amount: transferAmount }),
            });
            const parsed = await safeJson<TransactionResult>(res);
            if (parsed.data?.success) {
                toast({ title: "成功", description: `${transferAmount} dJPY を送金しました` });
                setTransferAmount("");
                await fetchAccounts();
            } else {
                toast({ title: "エラー", description: parsed.data?.message || "Transfer失敗", variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "エラー", description: e?.message || "unknown", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageLayout>
            <div className="admin-page">
                <header className="admin-header">
                    <h1>🔧 JPYC 管理者コンソール</h1>
                    <p>デモ用仮想JPYCの発行・送金・残高確認</p>
                </header>

                <div className="admin-section">
                    <h2>📊 EVM Status & Contract</h2>
                    <div className="payment-status">
                        <div className="status-row">
                            <span className="status-label">EVM Status</span>
                            <span className={`status-value ${evmStatus === "running" ? "running" : "stopped"}`}>
                                {evmStatus === "running" ? "稼働中 ✓" : evmStatus === "stopped" ? "停止" : "確認中..."}
                            </span>
                        </div>
                        {contractAddress && (
                            <div className="status-row">
                                <span className="status-label">Contract Address</span>
                                <span className="status-value">{shortAddr(contractAddress)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="admin-section">
                    <h2>💰 アカウント残高一覧</h2>
                    <div className="accounts-grid">
                        {accounts.map((account) => (
                            <div key={account.address} className="account-card">
                                <div>
                                    <div className="account-name">{account.name}</div>
                                    <div className="account-address">{account.address}</div>
                                </div>
                                <div className="account-balance">
                                    {parseFloat(account.balance).toLocaleString()} dJPY
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="admin-section">
                    <h2>🏭 Mint（JPYC発行）</h2>
                    <div className="mint-form">
                        <div className="form-row">
                            <div className="form-field">
                                <label>宛先アカウント</label>
                                <select value={mintTo} onChange={(e) => setMintTo(e.target.value)}>
                                    <option value="">選択...</option>
                                    {accounts.map((a) => (
                                        <option key={a.address} value={a.address}>
                                            {a.name} ({shortAddr(a.address)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-field">
                                <label>金額 (dJPY)</label>
                                <input
                                    type="number"
                                    value={mintAmount}
                                    onChange={(e) => setMintAmount(e.target.value)}
                                    placeholder="10000"
                                />
                            </div>
                        </div>
                        <button className="admin-btn primary" onClick={handleMint} disabled={loading}>
                            {loading ? "処理中..." : "Mint実行"}
                        </button>
                    </div>
                </div>

                <div className="admin-section">
                    <h2>📤 Transfer（送金）</h2>
                    <div className="mint-form">
                        <div className="form-row">
                            <div className="form-field">
                                <label>送金元</label>
                                <select value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)}>
                                    <option value="">選択...</option>
                                    {accounts.map((a) => (
                                        <option key={a.address} value={a.address}>
                                            {a.name} ({shortAddr(a.address)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-field">
                                <label>送金先</label>
                                <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                                    <option value="">選択...</option>
                                    {accounts.map((a) => (
                                        <option key={a.address} value={a.address}>
                                            {a.name} ({shortAddr(a.address)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-field">
                            <label>金額 (dJPY)</label>
                            <input
                                type="number"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                placeholder="1000"
                            />
                        </div>
                        <button className="admin-btn primary" onClick={handleTransfer} disabled={loading}>
                            {loading ? "処理中..." : "Transfer実行"}
                        </button>
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}
