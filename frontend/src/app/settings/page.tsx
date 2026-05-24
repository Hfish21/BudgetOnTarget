"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryList } from "@/components/settings/category-list";
import { RuleList } from "@/components/settings/rule-list";
import { MemberList } from "@/components/settings/member-list";
import { AccountList } from "@/components/settings/account-list";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage categories, rules, household members, and accounts.
        </p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          <CategoryList />
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <RuleList />
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <MemberList />
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <AccountList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
