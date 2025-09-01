
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { useAuth } from "@/stores/auth-store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { adminBulkImportProducts, adminDeleteProduct, adminExportProducts, adminUpsertProduct } from "@/lib/functions/products";

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryName?: string | null;
  trackStock: boolean;
  price: { incCents: number; exCents: number; taxRate: number; currency: "ZAR" };
  costIncCents?: number | null;
};

const fmtZAR = (cents: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format((cents || 0) / 100);

export default function ProductsPage() {
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "manager";
  const canDelete = role === "admin";
  const { toast } = useToast();

  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [edit, setEdit] = useState<Partial<Product> & { id?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirm, setConfirm] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  async function load() {
    setLoading(true);
    try {
      const qy = query(collection(db, "products"), orderBy("name"));
      const snap = await getDocs(qy);
      const list: Product[] = [];
      snap.forEach((d) => {
        const v = d.data() as any;
        list.push({ id: d.id, ...v });
      });
      setRows(list);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error loading products', description: e.message });
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [toast]);

  const filtered = useMemo(() => {
    const k = search.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter(p =>
      p.name?.toLowerCase().includes(k) ||
      p.sku?.toLowerCase().includes(k) ||
      (p.categoryName || "").toLowerCase().includes(k)
    );
  }, [rows, search]);

  async function onSave() {
    if (!edit) return;
    setIsSaving(true);
    try {
      const priceIncZAR = (document.getElementById("priceIncZAR") as HTMLInputElement)?.value;
      const costIncZAR = (document.getElementById("costIncZAR") as HTMLInputElement)?.value;
      
      const payload = {
        id: edit.id,
        name: edit.name,
        sku: edit.sku,
        barcode: edit.barcode || null,
        categoryName: edit.categoryName || null,
        trackStock: !!edit.trackStock,
        priceInc: priceIncZAR,
        costInc: costIncZAR || "",
        taxRate: (edit as any).price?.taxRate ?? 0.15,
      };
      
      await adminUpsertProduct(payload);
      toast({ title: 'Product saved' });
      setEdit(null);
      await load();
    } catch (e: any) {
       toast({ variant: 'destructive', title: 'Save failed', description: e.message });
    } finally {
        setIsSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm) return;
    setIsDeleting(true);
    try {
        await adminDeleteProduct({ id: confirm.id });
        toast({ title: 'Product deleted' });
        setConfirm(null);
        await load();
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Delete failed', description: e.message });
    } finally {
        setIsDeleting(false);
    }
  }

  async function onExport() {
    try {
        const res = await adminExportProducts({});
        const csv = res.csv;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "products-export.csv"; a.click();
        URL.revokeObjectURL(url);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Export failed', description: e.message });
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="ml-auto flex items-center gap-2">
          <Input placeholder="Search name, SKU, category…" value={search} onChange={(e)=>setSearch(e.target.value)} className="w-80" />
          {canWrite && (
            <>
              <CSVImport onImported={load} />
              <Button variant="outline" onClick={onExport}>Export CSV</Button>
              <Button onClick={()=>setEdit({ trackStock: true, price: { incCents: 0, exCents: 0, taxRate: 0.15, currency: "ZAR" } })}>
                New Product
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Name</TableHead>
              <TableHead className="w-[14%]">SKU</TableHead>
              <TableHead className="w-[16%]">Category</TableHead>
              <TableHead className="text-right w-[14%]">Price (inc)</TableHead>
              <TableHead className="text-right w-[14%]">Cost (inc)</TableHead>
              <TableHead className="text-right w-[14%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center p-6 text-muted-foreground">Loading products...</TableCell></TableRow>
            ) : filtered.length > 0 ? (
                 filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.sku}</TableCell>
                <TableCell>{p.categoryName || "—"}</TableCell>
                <TableCell className="text-right">{fmtZAR(p.price?.incCents || 0)}</TableCell>
                <TableCell className="text-right">{p.costIncCents ? fmtZAR(p.costIncCents) : "—"}</TableCell>
                <TableCell className="text-right">
                  {canWrite && (
                    <>
                      <Button size="sm" variant="outline" className="mr-2" onClick={()=>setEdit(p)}>Edit</Button>
                      {canDelete && <Button size="sm" variant="destructive" onClick={()=>setConfirm(p)}>Delete</Button>}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))
            ) : (
              <TableRow><TableCell colSpan={6} className="p-6 text-center text-muted-foreground">No products found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      </Card>


      {/* Edit/New drawer */}
      {edit && (
      <Sheet open={!!edit} onOpenChange={(o)=>!o && setEdit(null)}>
        <SheetContent className="w-[480px]">
          <SheetHeader><SheetTitle>{edit?.id ? "Edit Product" : "New Product"}</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-3">
            <Field label="Name">
              <Input defaultValue={edit?.name} onChange={(e)=>setEdit(s => ({...s!, name: e.target.value}))}/>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU">
                <Input defaultValue={edit?.sku} onChange={(e)=>setEdit(s => ({...s!, sku: e.target.value}))}/>
              </Field>
              <Field label="Barcode">
                <Input defaultValue={edit?.barcode ?? ""} onChange={(e)=>setEdit(s => ({...s!, barcode: e.target.value}))}/>
              </Field>
            </div>
            <Field label="Category">
              <Input defaultValue={edit?.categoryName ?? ""} onChange={(e)=>setEdit(s => ({...s!, categoryName: e.target.value}))}/>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Price (inc) ZAR">
                <Input id="priceIncZAR" defaultValue={edit?.price ? (edit.price.incCents/100).toFixed(2) : ""}/>
              </Field>
              <Field label="Tax Rate">
                <Input defaultValue={(edit.price)?.taxRate ?? 0.15} onChange={(e)=>setEdit(s => ({...s!, price: { ...(s?.price as any), taxRate: Number(e.target.value) }}))}/>
              </Field>
              <Field label="Cost (inc) ZAR">
                <Input id="costIncZAR" defaultValue={edit?.costIncCents ? (edit.costIncCents/100).toFixed(2) : ""}/>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm pt-2">
              <Checkbox
                id="trackStock"
                defaultChecked={!!edit?.trackStock}
                onCheckedChange={(checked)=>setEdit(s=>({...s!, trackStock: !!checked}))}
              />
              <label htmlFor="trackStock">Track stock for this product</label>
            </label>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={()=>setEdit(null)} disabled={isSaving}>Cancel</Button>
            <Button onClick={onSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      )}

      {/* Delete confirm */}
      {confirm && (
      <Dialog open={!!confirm} onOpenChange={(o)=>!o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete product</DialogTitle></DialogHeader>
          <p>Are you sure you want to delete “{confirm?.name}”? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setConfirm(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function CSVImport({ onImported }: { onImported: ()=>void }) {
  const { role } = useAuth();
  const { toast } = useToast();
  const canWrite = role === "admin" || role === "manager";
  const [busy, setBusy] = useState(false);

  if (!canWrite) return null;
  
  async function pickFile(files?: FileList | null) {
    if (!files || !files[0]) return;
    setBusy(true);
    try {
      const text = await files[0].text();
      const res = await adminBulkImportProducts({ csv: text });
      
      toast({
        title: "Import Complete",
        description: `${res.imported} products were imported.`,
      });
      onImported();

    } catch (e:any) {
      toast({ variant: 'destructive', title: 'Import failed', description: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button asChild variant="outline" disabled={busy}>
        <label>
           {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
           Import CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e)=>pickFile(e.target.files)} />
        </label>
      </Button>
    </>
  );
}
