
'use client';
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Save } from 'lucide-react';
import { adminUpsertMenuEntity } from '@/lib/functions/menu';
import { Item, ModifierGroup } from '@/types/pos';
import { Category } from '@/types';
import { fmtZAR } from '@/utils/money';

type Editable = (Category & { type: 'category' }) | (Item & { type: 'item' });

export default function MenuBuilderPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<Editable | null>(null);

  // Data loading
  useEffect(() => {
    const unsubCategories = onSnapshot(query(collection(db, 'menu_categories'), orderBy('order')), snap => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });
    const unsubItems = onSnapshot(query(collection(db, 'items'), orderBy('name')), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Item)));
    });
    const unsubMods = onSnapshot(query(collection(db, 'modifier_groups'), orderBy('name')), snap => {
      setModifierGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as ModifierGroup)));
    });

    return () => {
      unsubCategories();
      unsubItems();
      unsubMods();
    };
  }, []);

  const itemsInCategory = useMemo(() => {
    if (!selectedCategoryId) return [];
    return items.filter(item => item.categoryId === selectedCategoryId);
  }, [items, selectedCategoryId]);

  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    const category = categories.find(c => c.id === catId);
    if(category) {
        setEditingEntity({ ...category, type: 'category' });
    }
  };

  const handleSelectItem = (item: Item) => {
    setEditingEntity({ ...item, type: 'item' });
  };
  
  const handleAddNewCategory = () => {
    setSelectedCategoryId(null);
    setEditingEntity({ id: '', name: 'New Category', type: 'category', active: true, order: categories.length } as any);
  };
  
  const handleAddNewItem = () => {
      if (!selectedCategoryId) return;
      setEditingEntity({
        id: '',
        name: 'New Item',
        type: 'item',
        active: true,
        categoryId: selectedCategoryId,
        priceCents: 0,
        taxRate: 15
      } as any);
  };
  
  const handleFormChange = (field: string, value: any) => {
      if (!editingEntity) return;
      setEditingEntity(prev => ({ ...prev!, [field]: value }));
  };

  const handleSave = async () => {
    if (!editingEntity) return;
    try {
        let payload: any = { ...editingEntity };
        delete payload.type;

        if (editingEntity.type === 'item') {
            payload.priceCents = Math.round(parseFloat(payload.priceZar || '0') * 100);
            delete payload.priceZar;
        }

        await adminUpsertMenuEntity({ entity: editingEntity.type, data: payload });
        toast({ title: `${editingEntity.type} saved successfully` });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Save failed', description: error.message });
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Menu Builder</CardTitle>
          <CardDescription>Manage categories, items, and modifiers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Categories Column */}
            <div className="border-r pr-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Categories</h3>
                    <Button variant="ghost" size="sm" onClick={handleAddNewCategory}><PlusCircle className="mr-2 h-4 w-4"/> Add</Button>
                </div>
                <div className="space-y-2">
                    {categories.map(cat => (
                        <Button
                            key={cat.id}
                            variant={selectedCategoryId === cat.id ? 'secondary' : 'ghost'}
                            className="w-full justify-start"
                            onClick={() => handleSelectCategory(cat.id)}
                        >
                            {cat.name}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Items Column */}
            <div className="border-r pr-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Menu Items</h3>
                <Button variant="ghost" size="sm" onClick={handleAddNewItem} disabled={!selectedCategoryId}><PlusCircle className="mr-2 h-4 w-4"/> Add</Button>
              </div>
              {selectedCategoryId ? (
                <div className="space-y-2">
                    {itemsInCategory.map(item => (
                        <Button
                            key={item.id}
                            variant={editingEntity?.id === item.id ? 'secondary' : 'ghost'}
                            className="w-full justify-between"
                            onClick={() => handleSelectItem(item)}
                        >
                            <span>{item.name}</span>
                            <span>{fmtZAR(item.priceCents)}</span>
                        </Button>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a category to see items.</p>
              )}
            </div>

            {/* Editor Column */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Editor</h3>
                <Button size="sm" onClick={handleSave} disabled={!editingEntity}><Save className="mr-2 h-4 w-4" /> Save</Button>
              </div>
              {editingEntity ? (
                <div className="space-y-4">
                    {editingEntity.type === 'category' && (
                        <>
                            <Label>Category Name</Label>
                            <Input value={editingEntity.name} onChange={e => handleFormChange('name', e.target.value)} />
                            <div className="flex items-center space-x-2">
                                <Switch id="cat-active" checked={editingEntity.active} onCheckedChange={c => handleFormChange('active', c)} />
                                <Label htmlFor="cat-active">Active</Label>
                            </div>
                        </>
                    )}
                    {editingEntity.type === 'item' && (
                        <>
                            <Label>Item Name</Label>
                            <Input value={editingEntity.name} onChange={e => handleFormChange('name', e.target.value)} />
                            <Label>Price (ZAR)</Label>
                            <Input type="number" value={(editingEntity as any).priceZar ?? (editingEntity.priceCents/100).toFixed(2)} onChange={e => handleFormChange('priceZar', e.target.value)} />
                            <div className="flex items-center space-x-2">
                                <Switch id="item-active" checked={editingEntity.active} onCheckedChange={c => handleFormChange('active', c)} />
                                <Label htmlFor="item-active">Active</Label>
                            </div>
                        </>
                    )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a category or item to edit.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
