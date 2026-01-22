import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";

type EvmStatus = "unknown" | "running" | "stopped";

interface AccountsResponse {
    accounts: { address: string; balance: string }[];
    contractAddress?: string;
}

/**
 * Guest Payment Panel
 * - Display Guest account balance (auto-connected via user's wallet)
 */
export function GuestPaymentPanel() {
    const { user } = useAuth();
    const [evmStatus, setEvmStatus] = useState<EvmStatus>("unknown");
    const [balance, setBalance] = useState<string>("0");
    const [contractAddress, setContractAddress] = useState<string>("");

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

    useEffect(() => {
        fetchBalance();
        const t = setInterval(fetchBalance, 5000);
        return () => clearInterval(t);
    }, [walletAddress]);

    return (
        <div className="payment-panel">
            <div className="payment-status">
                <div className="status-row">
                    <span className="status-label">EVM Status</span>
                    <span className={`status-value ${evmStatus === "running" ? "running" : evmStatus === "stopped" ? "stopped" : ""}`}>
                        {evmStatus === "running" ? "Running" : evmStatus === "stopped" ? "Stopped" : "Checking..."}
                    </span>
                </div>
                <div className="status-row">
                    <span className="status-label">Wallet</span>
                    <span className="status-value">{walletAddress ? shortAddr(walletAddress) : "Not set"}</span>
                </div>
                <div className="status-row">
                    <span className="status-label">Balance</span>
                    <span className="status-value balance">
                        {walletAddress ? `${parseFloat(balance).toLocaleString()} dJPY` : "—"}
                    </span>
                </div>
                {contractAddress && (
                    <div className="status-row">
                        <span className="status-label">Contract</span>
                        <span className="status-value">{shortAddr(contractAddress)}</span>
                    </div>
                )}
            </div>

            <div className="payment-info">
                <p>💡 Host approval triggers escrow of your JPYC payment.</p>
                <p>After stay completion, JPYC will be released to the host.</p>
            </div>
        </div>
    );
}
