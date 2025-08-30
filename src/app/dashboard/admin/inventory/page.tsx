
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/stores/auth-store";
import type { InventoryLedger, MovementType, Product } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Download, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { call } from "@/lib/functions/call";

type ProductWithStock = Product & { stockOnHand?: number };

export default function InventoryPage() {
    const { role } = useAuth();
    const canWrite = role === "admin" || role === "manager";

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-4">Inventory Management</h1>
            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="ledger">Ledger</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                    <InventoryOverview canWrite={canWrite} />
                </TabsContent>
                <TabsContent value="ledger">
                    <InventoryLedger canWrite={canWrite} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function InventoryOverview({ canWrite }: { canWrite: boolean }) {
    const [products, setProducts] = useState<ProductWithStock[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [adjustment, setAdjustment] = useState<ProductWithStock | null>(null);

    const loadProducts = useCallback(async () => {
        setLoading(true);
        const q = query(
            collection(db, "products"),
            where("trackStock", "==", true),
            orderBy("name")
        );
        const snap = await getDocs(q);
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductWithStock)));
        setLoading(false);
    }, []);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const filteredProducts = useMemo(() => {
        return products.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [products, searchTerm]);

    return (
        <Card className="mt-4">
            <CardHeader>
                <CardTitle>Stock Levels</CardTitle>
                <CardDescription>Current stock on hand for all tracked products.</CardDescription>
                <div className="pt-2">
                    <Input
                        placeholder="Search for a product..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                    />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">On Hand</TableHead>
                            <TableHead className="text-right">Last Updated</TableHead>
                            {canWrite && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={canWrite ? 5 : 4} className="h-24 text-center">Loading stock levels...</TableCell></TableRow>
                        ) : filteredProducts.length > 0 ? (
                            filteredProducts.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell>{p.sku}</TableCell>
                                    <TableCell className="text-right font-mono">{p.stockOnHand ?? 0}</TableCell>
                                    <TableCell className="text-right">{p.updatedAt ? format(p.updatedAt.toDate(), "PPpp") : "N/A"}</TableCell>
                                    {canWrite && (
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => setAdjustment(p)}>Adjust Stock</Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={canWrite ? 5 : 4} className="h-24 text-center">No tracked products found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
            {adjustment && (
                <AdjustStockSheet
                    product={adjustment}
                    onClose={() => setAdjustment(null)}
                    onSuccess={() => {
                        setAdjustment(null);
                        loadProducts();
                    }}
                />
            )}
        </Card>
    );
}

function InventoryLedger({ canWrite }: { canWrite: boolean }) {
    const [ledger, setLedger] = useState<InventoryLedger[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const loadLedger = useCallback(async () => {
        setLoading(true);
        const q = query(
            collection(db, "inventory_ledger"),
            orderBy("ts", "desc"),
            limit(100)
        );
        const snap = await getDocs(q);
        setLedger(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryLedger)));
        setLoading(false);
    }, []);

    useEffect(() => {
        loadLedger();
    }, [loadLedger]);

    const handleExport = async () => {
        try {
            const result: any = await call("adminExportLedger", {});
            const { filename, mime, dataBase64 } = result;
            const byteCharacters = atob(dataBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mime });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Export failed", description: error.message });
        }
    };
    
    const getTypeBadgeVariant = (type: MovementType) => {
        switch(type) {
            case 'receive':
            case 'refund':
            case 'set':
                return 'default';
            case 'sale':
            case 'wastage':
                return 'destructive';
            case 'adjust':
                return 'secondary';
        }
    }

    return (
        <Card className="mt-4">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Movement Ledger</CardTitle>
                        <CardDescription>Showing the last 100 inventory movements.</CardDescription>
                    </div>
                    {canWrite && <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>}
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead className="text-right">Change</TableHead>
                            <TableHead className="text-right">On Hand</TableHead>
                            <TableHead>Note</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading ledger...</TableCell></TableRow>
                        ) : ledger.length > 0 ? (
                            ledger.map(entry => (
                                <TableRow key={entry.id}>
                                    <TableCell>{entry.ts ? format(entry.ts.toDate(), "PPp") : "N/A"}</TableCell>
                                    <TableCell className="font-medium">{entry.productName} <span className="text-muted-foreground">({entry.productSku})</span></TableCell>
                                    <TableCell>
                                        <Badge variant={getTypeBadgeVariant(entry.type)}>{entry.type}</Badge>
                                    </TableCell>
                                    <TableCell>{entry.userName}</TableCell>
                                    <TableCell className="text-right font-mono">{entry.delta > 0 ? `+${entry.delta}`: entry.delta}</TableCell>
                                    <TableCell className="text-right font-mono">{entry.before} → {entry.after}</TableCell>
                                    <TableCell>{entry.note}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center">No ledger entries found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function AdjustStockSheet({ product, onClose, onSuccess }: { product: ProductWithStock, onClose: () => void, onSuccess: () => void }) {
    const { profile } = useAuth();
    const { toast } = useToast();
    const [type, setType] = useState<MovementType>('adjust');
    const [qty, setQty] = useState('');
    const [note, setNote] = useState('');
    const [adjustSign, setAdjustSign] = useState<1 | -1>(1);
    const [isSubmitting, setSubmitting] = useState(false);

    const { after, delta } = useMemo(() => {
        const before = product.stockOnHand ?? 0;
        const numQty = parseInt(qty, 10) || 0;
        let delta = 0;
        let after = before;

        switch (type) {
            case 'receive':
            case 'refund': delta = numQty; break;
            case 'sale':
            case 'wastage': delta = -numQty; break;
            case 'adjust': delta = numQty * adjustSign; break;
            case 'set':
                after = numQty;
                delta = after - before;
                break;
        }
        if (type !== 'set') {
            after = before + delta;
        }
        return { after, delta };

    }, [type, qty, adjustSign, product.stockOnHand]);

    const handleSubmit = async () => {
        const numQty = parseInt(qty, 10);
        if (isNaN(numQty) || numQty < 0) {
            toast({ variant: 'destructive', title: 'Invalid quantity' });
            return;
        }

        setSubmitting(true);
        try {
            await call("adminPostStockMovement", {
                productId: product.id,
                type,
                qty: numQty,
                note,
                adjustSign,
                clientTxnId: `inv:${product.id}:${Date.now()}`
            });
            toast({ title: 'Stock updated successfully' });
            onSuccess();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Update failed", description: error.message });
        } finally {
            setSubmitting(false);
        }
    }


    return (
        <Sheet open={true} onOpenChange={onClose}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Adjust Stock: {product.name}</SheetTitle>
                    <SheetDescription>Current on hand: {product.stockOnHand ?? 0}</SheetDescription>
                </SheetHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="type">Movement Type</Label>
                        <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
                            <SelectTrigger id="type">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="adjust">Adjustment</SelectItem>
                                <SelectItem value="receive">Receive Stock</SelectItem>
                                <SelectItem value="wastage">Record Wastage</SelectItem>
                                <SelectItem value="set">Set New Count</SelectItem>
                                <SelectItem value="sale">Manual Sale</SelectItem>
                                <SelectItem value="refund">Manual Refund</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="qty">{type === 'set' ? 'New Total Count' : 'Quantity'}</Label>
                        <div className="flex items-center gap-2">
                            {type === 'adjust' && (
                                <ToggleGroup type="single" value={String(adjustSign)} onValueChange={(v) => setAdjustSign(v === '1' ? 1 : -1)}>
                                    <ToggleGroupItem value="1" aria-label="Increase"><Plus className="h-4 w-4"/></ToggleGroupItem>
                                    <ToggleGroupItem value="-1" aria-label="Decrease"><Minus className="h-4 w-4"/></ToggleGroupItem>
                                </ToggleGroup>
                            )}
                            <Input id="qty" type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="note">Note (Optional)</Label>
                        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., Damaged in transit" />
                    </div>

                    <Card className="bg-muted p-4 text-sm">
                        <div className="flex justify-between"><span>Before:</span> <span className="font-mono">{product.stockOnHand ?? 0}</span></div>
                        <div className="flex justify-between"><span>Change:</span> <span className="font-mono">{delta > 0 ? `+${delta}` : delta}</span></div>
                        <div className="flex justify-between font-bold"><span>After:</span> <span className="font-mono">{after}</span></div>
                        {after < 0 && <p className="text-destructive-foreground text-xs mt-2 text-center bg-destructive p-1 rounded">Stock cannot be negative.</p>}
                    </Card>

                </div>
                <SheetFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || after < 0 || !qty}>
                        {isSubmitting ? "Submitting..." : "Submit Movement"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
