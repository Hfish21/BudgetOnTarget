import type { BudgetStore } from "./store";
import type { SpendGroup } from "./types";
import { recategorizeAll } from "./categorizer";

interface StarterCategory {
  name: string;
  spendGroup: SpendGroup;
}

interface StarterRule {
  pattern: string;
  categoryName: string;
}

const STARTER_CATEGORIES: StarterCategory[] = [
  // Income
  { name: "Salary/Wages", spendGroup: "income" },
  // Necessary
  { name: "Groceries", spendGroup: "necessary" },
  { name: "Rent/Mortgage", spendGroup: "necessary" },
  { name: "Utilities", spendGroup: "necessary" },
  { name: "Insurance", spendGroup: "necessary" },
  { name: "Gas/Fuel", spendGroup: "necessary" },
  { name: "Healthcare", spendGroup: "necessary" },
  { name: "Phone/Internet", spendGroup: "necessary" },
  { name: "Childcare", spendGroup: "necessary" },
  // Discretionary
  { name: "Restaurants/Dining", spendGroup: "discretionary" },
  { name: "Shopping", spendGroup: "discretionary" },
  { name: "Entertainment", spendGroup: "discretionary" },
  { name: "Subscriptions", spendGroup: "discretionary" },
  { name: "Travel", spendGroup: "discretionary" },
  { name: "Personal Care", spendGroup: "discretionary" },
  { name: "Pets", spendGroup: "discretionary" },
  { name: "Gifts/Donations", spendGroup: "discretionary" },
  { name: "Home Improvement", spendGroup: "discretionary" },
];

const STARTER_RULES: StarterRule[] = [
  // Groceries
  { pattern: "KROGER", categoryName: "Groceries" },
  { pattern: "WALMART", categoryName: "Groceries" },
  { pattern: "PUBLIX", categoryName: "Groceries" },
  { pattern: "ALDI", categoryName: "Groceries" },
  { pattern: "TRADER JOE", categoryName: "Groceries" },
  { pattern: "WHOLE FOODS", categoryName: "Groceries" },
  { pattern: "HEB ", categoryName: "Groceries" },
  { pattern: "COSTCO", categoryName: "Groceries" },
  { pattern: "SAM'S CLUB", categoryName: "Groceries" },
  { pattern: "TARGET", categoryName: "Groceries" },
  { pattern: "FOOD LION", categoryName: "Groceries" },
  { pattern: "SAFEWAY", categoryName: "Groceries" },
  { pattern: "PIGGLY WIGGLY", categoryName: "Groceries" },
  { pattern: "WINN DIXIE", categoryName: "Groceries" },
  // Restaurants/Dining
  { pattern: "MCDONALD", categoryName: "Restaurants/Dining" },
  { pattern: "STARBUCKS", categoryName: "Restaurants/Dining" },
  { pattern: "CHIPOTLE", categoryName: "Restaurants/Dining" },
  { pattern: "CHICK-FIL-A", categoryName: "Restaurants/Dining" },
  { pattern: "DOORDASH", categoryName: "Restaurants/Dining" },
  { pattern: "UBER EATS", categoryName: "Restaurants/Dining" },
  { pattern: "GRUBHUB", categoryName: "Restaurants/Dining" },
  { pattern: "TACO BELL", categoryName: "Restaurants/Dining" },
  { pattern: "WENDY", categoryName: "Restaurants/Dining" },
  { pattern: "BURGER KING", categoryName: "Restaurants/Dining" },
  { pattern: "DOMINO", categoryName: "Restaurants/Dining" },
  { pattern: "PIZZA HUT", categoryName: "Restaurants/Dining" },
  { pattern: "SUBWAY", categoryName: "Restaurants/Dining" },
  { pattern: "PANERA", categoryName: "Restaurants/Dining" },
  { pattern: "DUNKIN", categoryName: "Restaurants/Dining" },
  // Gas/Fuel
  { pattern: "SHELL", categoryName: "Gas/Fuel" },
  { pattern: "EXXON", categoryName: "Gas/Fuel" },
  { pattern: "CHEVRON", categoryName: "Gas/Fuel" },
  { pattern: "BP ", categoryName: "Gas/Fuel" },
  { pattern: "MARATHON", categoryName: "Gas/Fuel" },
  { pattern: "CIRCLE K", categoryName: "Gas/Fuel" },
  { pattern: "QT ", categoryName: "Gas/Fuel" },
  { pattern: "QUIKTRIP", categoryName: "Gas/Fuel" },
  { pattern: "WAWA", categoryName: "Gas/Fuel" },
  { pattern: "RACETRAC", categoryName: "Gas/Fuel" },
  { pattern: "MURPHY", categoryName: "Gas/Fuel" },
  // Subscriptions
  { pattern: "NETFLIX", categoryName: "Subscriptions" },
  { pattern: "SPOTIFY", categoryName: "Subscriptions" },
  { pattern: "HULU", categoryName: "Subscriptions" },
  { pattern: "AMAZON PRIME", categoryName: "Subscriptions" },
  { pattern: "APPLE.COM/BILL", categoryName: "Subscriptions" },
  { pattern: "DISNEY PLUS", categoryName: "Subscriptions" },
  { pattern: "DISNEY+", categoryName: "Subscriptions" },
  { pattern: "YOUTUBE", categoryName: "Subscriptions" },
  { pattern: "HBO MAX", categoryName: "Subscriptions" },
  { pattern: "PARAMOUNT+", categoryName: "Subscriptions" },
  { pattern: "PEACOCK", categoryName: "Subscriptions" },
  // Utilities
  { pattern: "ELECTRIC", categoryName: "Utilities" },
  { pattern: "WATER BILL", categoryName: "Utilities" },
  { pattern: "GAS BILL", categoryName: "Utilities" },
  { pattern: "POWER COMPANY", categoryName: "Utilities" },
  { pattern: "ENERGY", categoryName: "Utilities" },
  // Phone/Internet
  { pattern: "VERIZON", categoryName: "Phone/Internet" },
  { pattern: "AT&T", categoryName: "Phone/Internet" },
  { pattern: "T-MOBILE", categoryName: "Phone/Internet" },
  { pattern: "COMCAST", categoryName: "Phone/Internet" },
  { pattern: "SPECTRUM", categoryName: "Phone/Internet" },
  { pattern: "XFINITY", categoryName: "Phone/Internet" },
  // Insurance
  { pattern: "GEICO", categoryName: "Insurance" },
  { pattern: "STATE FARM", categoryName: "Insurance" },
  { pattern: "ALLSTATE", categoryName: "Insurance" },
  { pattern: "PROGRESSIVE", categoryName: "Insurance" },
  { pattern: "USAA INS", categoryName: "Insurance" },
  // Healthcare
  { pattern: "CVS", categoryName: "Healthcare" },
  { pattern: "WALGREEN", categoryName: "Healthcare" },
  { pattern: "PHARMACY", categoryName: "Healthcare" },
  // Entertainment
  { pattern: "AMC THEATRE", categoryName: "Entertainment" },
  { pattern: "REGAL CINEMA", categoryName: "Entertainment" },
  { pattern: "DAVE & BUSTER", categoryName: "Entertainment" },
  // Personal Care
  { pattern: "GREAT CLIPS", categoryName: "Personal Care" },
  { pattern: "SPORT CLIPS", categoryName: "Personal Care" },
  { pattern: "SUPERCUTS", categoryName: "Personal Care" },
  // Pets
  { pattern: "PETCO", categoryName: "Pets" },
  { pattern: "PETSMART", categoryName: "Pets" },
  { pattern: "CHEWY", categoryName: "Pets" },
  // Income
  { pattern: "DIRECT DEPOSIT", categoryName: "Salary/Wages" },
  { pattern: "PAYROLL", categoryName: "Salary/Wages" },
  { pattern: "ACH DEPOSIT", categoryName: "Salary/Wages" },
  { pattern: "SALARY", categoryName: "Salary/Wages" },
  // Home Improvement
  { pattern: "HOME DEPOT", categoryName: "Home Improvement" },
  { pattern: "LOWE'S", categoryName: "Home Improvement" },
  { pattern: "LOWES", categoryName: "Home Improvement" },
  { pattern: "ACE HARDWARE", categoryName: "Home Improvement" },
];

export const CATEGORY_SPEND_GROUPS: Record<string, SpendGroup> = {};
for (const cat of STARTER_CATEGORIES) {
  CATEGORY_SPEND_GROUPS[cat.name] = cat.spendGroup;
}

export function installStarterData(store: BudgetStore): Map<string, number> {
  const categoryMap = new Map<string, number>();

  for (const cat of STARTER_CATEGORIES) {
    const existing = store.categories.find((c) => c.name === cat.name);
    if (existing) {
      categoryMap.set(cat.name, existing.id);
      continue;
    }
    const created = store.addCategory({
      name: cat.name,
      parent_category_id: null,
    });
    categoryMap.set(cat.name, created.id);
  }

  for (const rule of STARTER_RULES) {
    const categoryId = categoryMap.get(rule.categoryName);
    if (categoryId == null) continue;

    const exists = store.categoryRules.some(
      (r) =>
        r.pattern.toUpperCase() === rule.pattern.toUpperCase() &&
        r.category_id === categoryId
    );
    if (exists) continue;

    store.addRule({
      pattern: rule.pattern,
      match_type: "substring",
      category_id: categoryId,
      priority: 100,
      is_active: true,
    });
  }

  return categoryMap;
}

export function applyStarterRulesToTransactions(store: BudgetStore): number {
  return recategorizeAll(store);
}
