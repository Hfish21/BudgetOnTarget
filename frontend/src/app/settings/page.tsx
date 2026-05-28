"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryList } from "@/components/settings/category-list";
import { RuleList } from "@/components/settings/rule-list";
import { MemberList } from "@/components/settings/member-list";
import { AccountList } from "@/components/settings/account-list";
import { DataPortability } from "@/components/settings/data-portability";
import { Tag, ListFilter, Users, CreditCard, HardDrive } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage how transactions are categorized, tracked, and organized.
        </p>
      </div>

      <Tabs defaultValue="categories" className="flex flex-col">
        <TabsList variant="line" className="border-b border-border pb-0">
          <TabsTrigger value="categories" className="gap-1.5 px-3">
            <Tag className="size-3.5" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5 px-3">
            <ListFilter className="size-3.5" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5 px-3">
            <Users className="size-3.5" />
            Members
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1.5 px-3">
            <CreditCard className="size-3.5" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5 px-3">
            <HardDrive className="size-3.5" />
            Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-6">
          <CategoryList />
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <RuleList />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MemberList />
        </TabsContent>

        <TabsContent value="accounts" className="mt-6">
          <AccountList />
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          <DataPortability />
        </TabsContent>
      </Tabs>
    </div>
  );
}
