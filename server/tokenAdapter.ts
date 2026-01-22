import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const DEMO_JPY_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function owner() view returns (address)",
];

interface AccountInfo {
  name: string;
  address: string;
  privateKey: string;
}

export interface TransactionReceipt {
  txHash: string;
  blockNumber: number;
  gasUsed: string;
  status: number; // 1 = success, 0 = failure
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  message: string;
  receipt?: TransactionReceipt;
}

const DEMO_ACCOUNTS: AccountInfo[] = [
  { name: "Deployer/Owner", address: "", privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
  { name: "Guest", address: "", privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
  { name: "Host", address: "", privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
  { name: "Operator", address: "", privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" },
  { name: "Guest 2", address: "", privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a" },
  { name: "Guest 3", address: "", privateKey: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" },
  { name: "Host 2", address: "", privateKey: "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e" },
  { name: "Host 3", address: "", privateKey: "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356" },
];

class TokenAdapter {
  private provider: ethers.JsonRpcProvider | null = null;
  private contractAddress: string = "";
  private contract: ethers.Contract | null = null;
  private wallets: Map<string, ethers.Wallet> = new Map();
  private initialized: boolean = false;

  async initialize(): Promise<boolean> {
    try {
      this.provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      await this.provider.getBlockNumber();

      const deployInfoPath = path.join(process.cwd(), "deploy-info.json");
      if (fs.existsSync(deployInfoPath)) {
        const deployInfo = JSON.parse(fs.readFileSync(deployInfoPath, "utf-8"));
        this.contractAddress = deployInfo.contractAddress;
      } else {
        console.log("deploy-info.json not found, waiting for deployment...");
        return false;
      }

      this.contract = new ethers.Contract(this.contractAddress, DEMO_JPY_ABI, this.provider);

      for (const acc of DEMO_ACCOUNTS) {
        const wallet = new ethers.Wallet(acc.privateKey, this.provider);
        acc.address = wallet.address;
        this.wallets.set(wallet.address.toLowerCase(), wallet);
      }

      this.initialized = true;
      console.log(`TokenAdapter initialized with contract: ${this.contractAddress}`);
      return true;
    } catch (error) {
      console.log("TokenAdapter initialization failed:", error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isConnected(): boolean {
    return this.initialized && this.provider !== null && this.contract !== null;
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  async getAccounts(): Promise<{ name: string; address: string; balance: string }[]> {
    if (!this.initialized || !this.contract) {
      return [];
    }

    const results = [];
    for (const acc of DEMO_ACCOUNTS) {
      try {
        const balance = await this.contract.balanceOf(acc.address);
        results.push({
          name: acc.name,
          address: acc.address,
          balance: ethers.formatUnits(balance, 18),
        });
      } catch (error: any) {
        console.error(`[TokenAdapter] Failed to fetch balance for ${acc.name} (${acc.address}):`, error);
        results.push({
          name: acc.name,
          address: acc.address,
          balance: "0",
        });
      }
    }
    return results;
  }

  async getBalance(address: string): Promise<string> {
    if (!this.initialized || !this.contract) {
      return "0";
    }
    try {
      const balance = await this.contract.balanceOf(address);
      return ethers.formatUnits(balance, 18);
    } catch {
      return "0";
    }
  }

  async mint(to: string, amount: string): Promise<TransactionResult> {
    if (!this.initialized || !this.contract || !this.provider) {
      return { success: false, message: "Token adapter not initialized" };
    }

    try {
      const ownerWallet = this.wallets.get(DEMO_ACCOUNTS[0].address.toLowerCase());
      if (!ownerWallet) {
        return { success: false, message: "Owner wallet not found" };
      }

      const contractWithSigner = this.contract.connect(ownerWallet) as ethers.Contract;
      const amountWei = ethers.parseUnits(amount, 18);
      const tx = await contractWithSigner.mint(to, amountWei);
      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        return { success: false, message: "Transaction failed on-chain", txHash: receipt?.hash };
      }

      const receiptInfo: TransactionReceipt = {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status,
      };

      return {
        success: true,
        txHash: receipt.hash,
        message: `Minted ${amount} dJPY to ${to}`,
        receipt: receiptInfo,
      };
    } catch (error: any) {
      console.error("[TokenAdapter] Mint error:", error);
      const message = error?.message || error?.reason || String(error) || "Mint failed";
      return { success: false, message };
    }
  }

  async transfer(from: string, to: string, amount: string): Promise<TransactionResult> {
    if (!this.initialized || !this.contract || !this.provider) {
      return { success: false, message: "Token adapter not initialized" };
    }

    try {
      const fromWallet = this.wallets.get(from.toLowerCase());
      if (!fromWallet) {
        return { success: false, message: `Wallet not found for ${from}. Only demo accounts can transfer.` };
      }

      // Check balance before transfer
      const balance = await this.contract.balanceOf(from);
      const amountWei = ethers.parseUnits(amount, 18);
      if (balance < amountWei) {
        const balanceFormatted = ethers.formatUnits(balance, 18);
        return { success: false, message: `Insufficient balance: ${balanceFormatted} dJPY (need ${amount} dJPY)` };
      }

      const contractWithSigner = this.contract.connect(fromWallet) as ethers.Contract;
      const tx = await contractWithSigner.transfer(to, amountWei);
      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        return { success: false, message: "Transaction failed on-chain", txHash: receipt?.hash };
      }

      const receiptInfo: TransactionReceipt = {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status,
      };

      return {
        success: true,
        txHash: receipt.hash,
        message: `Transferred ${amount} dJPY from ${from} to ${to}`,
        receipt: receiptInfo,
      };
    } catch (error: any) {
      return { success: false, message: error.message || "Transfer failed" };
    }
  }

  async getTransactionReceipt(txHash: string): Promise<{ receipt: any; tx: any } | null> {
    if (!this.provider) return null;
    try {
      const [receipt, tx] = await Promise.all([
        this.provider.getTransactionReceipt(txHash),
        this.provider.getTransaction(txHash),
      ]);
      return { receipt, tx };
    } catch {
      return null;
    }
  }

  getAccountByName(name: string): AccountInfo | undefined {
    return DEMO_ACCOUNTS.find(a => a.name.toLowerCase().includes(name.toLowerCase()));
  }

  getAccountByAddress(address: string): AccountInfo | undefined {
    return DEMO_ACCOUNTS.find(a => a.address.toLowerCase() === address.toLowerCase());
  }

  getDemoAccounts(): AccountInfo[] {
    return DEMO_ACCOUNTS;
  }
}

export const tokenAdapter = new TokenAdapter();
