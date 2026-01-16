import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Wallet, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Account {
    name: string;
    address: string;
    balance: string;
}

interface PaymentPanelProps {
    bookingRequestId?: string;
    totalAmount?: string;
    guestWalletAddress?: string;
    hostWalletAddress?: string;
    onPaymentComplete?: (txHash: string) => void;
}

export function PaymentPanel({
    bookingRequestId,
    totalAmount = "0",
    guestWalletAddress,
    hostWalletAddress,
    onPaymentComplete,
}: PaymentPanelProps) {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);
    const [paying, setPaying] = useState(false);
    const [evmStatus, setEvmStatus] = useState<"unknown" | "running" | "stopped">("unknown");
    const [lastTxHash, setLastTxHash] = useState<string | null>(null);

    const fetchAccounts = async () => {
        try {
            const res = await fetch("/api/token/accounts");
            if (res.ok) {
                const data = await res.json();
                setAccounts(data.accounts || []);
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
        const interval = setInterval(fetchAccounts, 5000);
        return () => clearInterval(interval);
    }, []);

    const guestAccount = accounts.find((a) => a.name === "Guest");
    const hostAccount = accounts.find((a) => a.name === "Host");

    const handlePayment = async () => {
        if (!guestAccount || !hostAccount) {
            toast({ title: "エラー", description: "ウォレット情報を取得できません", variant: "destructive" });
            return;
        }

        setPaying(true);
        try {
            const res = await fetch("/api/token/transfer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    from: guestAccount.address,
                    to: hostAccount.address,
                    amount: totalAmount,
                }),
            });

            const data = await res.json();

            if (data.success) {
                setLastTxHash(data.txHash);
                toast({
                    title: "決済完了",
                    description: `${totalAmount} dJPY を送金しました`,
                });
                fetchAccounts();
                onPaymentComplete?.(data.txHash);
            } else {
                toast({
                    title: "決済失敗",
                    description: data.message || "送金に失敗しました",
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            toast({
                title: "エラー",
                description: error.message || "通信エラーが発生しました",
                variant: "destructive",
            });
        } finally {
            setPaying(false);
        }
    };

    return (
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Wallet className="w-5 h-5 text-emerald-400" />
                    JPYC 決済
                    <span
                        className={`ml-auto w-2 h-2 rounded-full ${evmStatus === "running" ? "bg-emerald-400" : "bg-red-400"
                            }`}
                    />
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Balance Display */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">あなたの残高</div>
                        <div className="text-xl font-bold text-emerald-400">
                            {guestAccount ? parseFloat(guestAccount.balance).toLocaleString() : "---"} dJPY
                        </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">ホスト残高</div>
                        <div className="text-xl font-bold text-blue-400">
                            {hostAccount ? parseFloat(hostAccount.balance).toLocaleString() : "---"} dJPY
                        </div>
                    </div>
                </div>

                {/* Payment Amount */}
                <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                    <div className="text-sm text-slate-400 mb-1">支払い金額</div>
                    <div className="text-3xl font-bold text-white">
                        {parseFloat(totalAmount).toLocaleString()} dJPY
                    </div>
                </div>

                {/* Payment Button */}
                <Button
                    onClick={handlePayment}
                    disabled={paying || evmStatus !== "running" || !guestAccount}
                    className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-lg"
                >
                    {paying ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            処理中...
                        </>
                    ) : (
                        <>
                            <ArrowRight className="w-5 h-5 mr-2" />
                            決済する
                        </>
                    )}
                </Button>

                {/* Transaction Result */}
                {lastTxHash && (
                    <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg p-3">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="truncate">TxHash: {lastTxHash.slice(0, 20)}...</span>
                    </div>
                )}

                {evmStatus === "stopped" && (
                    <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-lg p-3">
                        <AlertCircle className="w-4 h-4" />
                        <span>ブロックチェーンに接続できません</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
