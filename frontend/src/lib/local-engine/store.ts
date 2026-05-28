import type {
  BudgetFile,
  BudgetAccount,
  BudgetHouseholdMember,
  BudgetCategory,
  BudgetCategoryRule,
  BudgetTarget,
  BudgetTransaction,
  BudgetCsvImport,
  BudgetTag,
} from "./types";

const CURRENT_VERSION = 1;

function emptyFile(): BudgetFile {
  return {
    version: CURRENT_VERSION,
    exported_at: new Date().toISOString(),
    source: "budgetontarget",
    accounts: [],
    household_members: [],
    categories: [],
    category_rules: [],
    targets: [],
    transactions: [],
    csv_imports: [],
    tags: [],
  };
}

export class BudgetStore {
  accounts: BudgetAccount[] = [];
  householdMembers: BudgetHouseholdMember[] = [];
  categories: BudgetCategory[] = [];
  categoryRules: BudgetCategoryRule[] = [];
  targets: BudgetTarget[] = [];
  transactions: BudgetTransaction[] = [];
  csvImports: BudgetCsvImport[] = [];
  tags: BudgetTag[] = [];

  private _dirty = false;
  private _listeners: Set<() => void> = new Set();

  get dirty(): boolean {
    return this._dirty;
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify(): void {
    this._dirty = true;
    for (const fn of this._listeners) fn();
  }

  markClean(): void {
    this._dirty = false;
  }

  load(file: BudgetFile): void {
    if (file.version > CURRENT_VERSION) {
      throw new Error(
        `File version ${file.version} is newer than supported version ${CURRENT_VERSION}.`
      );
    }
    this.accounts = [...file.accounts];
    this.householdMembers = [...file.household_members];
    this.categories = [...file.categories];
    this.categoryRules = [...file.category_rules];
    this.targets = [...file.targets];
    this.transactions = [...file.transactions];
    this.csvImports = [...file.csv_imports];
    this.tags = [...file.tags];
    this._dirty = false;
    this._notify();
  }

  serialize(): BudgetFile {
    return {
      version: CURRENT_VERSION,
      exported_at: new Date().toISOString(),
      source: "budgetontarget",
      accounts: this.accounts,
      household_members: this.householdMembers,
      categories: this.categories,
      category_rules: this.categoryRules,
      targets: this.targets,
      transactions: this.transactions,
      csv_imports: this.csvImports,
      tags: this.tags,
    };
  }

  clear(): void {
    const empty = emptyFile();
    this.load(empty);
  }

  // --- ID generation ---

  private _nextId(items: { id: number }[]): number {
    if (items.length === 0) return 1;
    return Math.max(...items.map((i) => i.id)) + 1;
  }

  // --- Lookup helpers ---

  accountById(id: number): BudgetAccount | undefined {
    return this.accounts.find((a) => a.id === id);
  }

  memberById(id: number): BudgetHouseholdMember | undefined {
    return this.householdMembers.find((m) => m.id === id);
  }

  categoryById(id: number): BudgetCategory | undefined {
    return this.categories.find((c) => c.id === id);
  }

  targetById(id: number): BudgetTarget | undefined {
    return this.targets.find((t) => t.id === id);
  }

  memberByName(name: string): BudgetHouseholdMember | undefined {
    return this.householdMembers.find((m) => m.name === name);
  }

  // --- CRUD: Accounts ---

  addAccount(data: Omit<BudgetAccount, "id" | "created_at">): BudgetAccount {
    const account: BudgetAccount = {
      ...data,
      id: this._nextId(this.accounts),
      created_at: new Date().toISOString(),
    };
    this.accounts.push(account);
    this._notify();
    return account;
  }

  updateAccount(id: number, data: Partial<BudgetAccount>): BudgetAccount | undefined {
    const account = this.accountById(id);
    if (!account) return undefined;
    Object.assign(account, data);
    this._notify();
    return account;
  }

  // --- CRUD: Household Members ---

  addMember(data: Omit<BudgetHouseholdMember, "id" | "created_at">): BudgetHouseholdMember {
    const member: BudgetHouseholdMember = {
      ...data,
      id: this._nextId(this.householdMembers),
      created_at: new Date().toISOString(),
    };
    this.householdMembers.push(member);
    this._notify();
    return member;
  }

  // --- CRUD: Categories ---

  addCategory(data: Omit<BudgetCategory, "id" | "created_at">): BudgetCategory {
    const cat: BudgetCategory = {
      ...data,
      id: this._nextId(this.categories),
      created_at: new Date().toISOString(),
    };
    this.categories.push(cat);
    this._notify();
    return cat;
  }

  deleteCategory(id: number): boolean {
    const idx = this.categories.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.categories.splice(idx, 1);
    for (const txn of this.transactions) {
      if (txn.category_id === id) txn.category_id = null;
    }
    this._notify();
    return true;
  }

  // --- CRUD: Category Rules ---

  addRule(
    data: Omit<BudgetCategoryRule, "id" | "created_at">
  ): BudgetCategoryRule {
    const rule: BudgetCategoryRule = {
      ...data,
      id: this._nextId(this.categoryRules),
      created_at: new Date().toISOString(),
    };
    this.categoryRules.push(rule);
    this._notify();
    return rule;
  }

  updateRule(
    id: number,
    data: Partial<BudgetCategoryRule>
  ): BudgetCategoryRule | undefined {
    const rule = this.categoryRules.find((r) => r.id === id);
    if (!rule) return undefined;
    Object.assign(rule, data);
    this._notify();
    return rule;
  }

  deleteRule(id: number): boolean {
    const idx = this.categoryRules.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.categoryRules.splice(idx, 1);
    this._notify();
    return true;
  }

  // --- CRUD: Targets ---

  addTarget(data: Omit<BudgetTarget, "id" | "created_at">): BudgetTarget {
    const target: BudgetTarget = {
      ...data,
      id: this._nextId(this.targets),
      created_at: new Date().toISOString(),
    };
    this.targets.push(target);
    this._notify();
    return target;
  }

  updateTarget(id: number, data: Partial<BudgetTarget>): BudgetTarget | undefined {
    const target = this.targetById(id);
    if (!target) return undefined;
    Object.assign(target, data);
    this._notify();
    return target;
  }

  deleteTarget(id: number): boolean {
    const idx = this.targets.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.targets.splice(idx, 1);
    this._notify();
    return true;
  }

  // --- CRUD: Transactions ---

  addTransaction(
    data: Omit<BudgetTransaction, "id" | "created_at">
  ): BudgetTransaction {
    const txn: BudgetTransaction = {
      ...data,
      id: this._nextId(this.transactions),
      created_at: new Date().toISOString(),
    };
    this.transactions.push(txn);
    this._notify();
    return txn;
  }

  addTransactionsBulk(
    items: Omit<BudgetTransaction, "id" | "created_at">[]
  ): BudgetTransaction[] {
    let nextId = this._nextId(this.transactions);
    const now = new Date().toISOString();
    const result: BudgetTransaction[] = [];
    for (const data of items) {
      const txn: BudgetTransaction = { ...data, id: nextId++, created_at: now };
      this.transactions.push(txn);
      result.push(txn);
    }
    this._notify();
    return result;
  }

  updateTransaction(
    id: number,
    data: Partial<BudgetTransaction>
  ): BudgetTransaction | undefined {
    const txn = this.transactions.find((t) => t.id === id);
    if (!txn) return undefined;
    Object.assign(txn, data);
    this._notify();
    return txn;
  }

  // --- CRUD: CSV Imports ---

  addCsvImport(
    data: Omit<BudgetCsvImport, "id" | "imported_at">
  ): BudgetCsvImport {
    const imp: BudgetCsvImport = {
      ...data,
      id: this._nextId(this.csvImports),
      imported_at: new Date().toISOString(),
    };
    this.csvImports.push(imp);
    this._notify();
    return imp;
  }

  hasFileHash(hash: string): boolean {
    return this.csvImports.some((i) => i.file_hash === hash);
  }

  hasTransactionHash(hash: string): boolean {
    return this.transactions.some((t) => t.external_hash === hash);
  }

  existingTransactionHashes(hashes: string[]): Set<string> {
    const set = new Set(this.transactions.map((t) => t.external_hash));
    return new Set(hashes.filter((h) => set.has(h)));
  }
}
