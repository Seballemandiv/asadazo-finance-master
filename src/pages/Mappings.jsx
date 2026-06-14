import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductMappingTable from "@/components/mappings/ProductMappingTable";
import ShippingMappingTable from "@/components/mappings/ShippingMappingTable";
import EventMappingTable from "@/components/mappings/EventMappingTable";
import CutCostTable from "@/components/mappings/CutCostTable";

export default function Mappings() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mapping Tables</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure how products, shipping and events are classified</p>
      </div>

      <Tabs defaultValue="products">
        <TabsList className="mb-4">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="shipping">Shipping</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="cutcosts">Cut Costs</TabsTrigger>
        </TabsList>
        <TabsContent value="products"><ProductMappingTable /></TabsContent>
        <TabsContent value="shipping"><ShippingMappingTable /></TabsContent>
        <TabsContent value="events"><EventMappingTable /></TabsContent>
        <TabsContent value="cutcosts"><CutCostTable /></TabsContent>
      </Tabs>
    </div>
  );
}