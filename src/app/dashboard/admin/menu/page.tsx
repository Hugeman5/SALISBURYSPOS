
'use client';
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Save } from 'lucide-react';
import { adminUpsertMenuEntity } from '@/lib/functions/menu';
import { Item, ModifierGroup } from '@/types/pos';
import { Category } from '@/types';
import { fmtZAR } from '@/utils/money';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ItemEditor } from '@/components/admin/menu/ItemEditor';
import { CategoryEditor } from '@/components/admin/menu/CategoryEditor';
import { ModifierGroupEditor } from '@/components/admin/menu/ModifierGroupEditor';

type Editable = (Category & { type: 'category' }) | (Item & { type: 'item' }) | (ModifierGroup & { type: 'modifier_group' });

export default function MenuBuilderPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  
  const [activeTab, setActiveTab] = useState('categories');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<Editable | null>(null);

  useEffect(() => {
    const unsubCategories = onSnapshot(query(collection(db, 'menu_categories'), orderBy('order')), snap => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });
    const unsubItems = onSnapshot(query(collection(db, 'menu_items'), orderBy('name')), snap => {
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
    if (activeTab !== 'categories' || !selectedId) return [];
    return items.filter(item => item.categoryId === selectedId);
  }, [items, selectedId, activeTab]);
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSelectedId(null);
    setEditingEntity(null);
  }

  const handleSelectMaster = (id: string) => {
    setSelectedId(id);
    setEditingEntity(null); // Clear item editor when new category/mod is selected
  }
  
  const handleSelectItem = (itemOrId: Item | string) => {
    const item = typeof itemOrId === 'string' ? items.find(i => i.id === itemOrId) : itemOrId;
    if (item) {
        setEditingEntity({ ...item, type: 'item' });
    }
  }

  const handleEditMaster = () => {
    if (activeTab === 'categories') {
        const cat = categories.find(c => c.id === selectedId);
        if (cat) setEditingEntity({ ...cat, type: 'category' });
    } else {
        const mod = modifierGroups.find(m => m.id === selectedId);
        if (mod) setEditingEntity({ ...mod, type: 'modifier_group' });
    }
  }

  const handleAddNew = (type: 'category' | 'item' | 'modifier_group') => {
    if (type === 'category') {
        setSelectedId(null);
        setEditingEntity({ id: '', name: 'New Category', type: 'category', active: true, order: categories.length } as any);
    } else if (type === 'item') {
        if (!selectedId) return;
        setEditingEntity({
            id: '', name: 'New Item', type: 'item', active: true, categoryId: selectedId,
            priceCents: 0, taxRate: 15, modifierGroupIds: []
        } as any);
    } else {
        setSelectedId(null);
        setEditingEntity({
            id: '', name: 'New Modifier Group', type: 'modifier_group', active: true,
            min: 1, max: 1, items: []
        } as any);
    }
  };
  
  const handleFormChange = (field: string, value: any) => {
      if (!editingEntity) return;
      setEditingEntity(prev => ({ ...prev!, [field]: value }));
  };

  const handleSave = async () => {
    if (!editingEntity) return;
    try {
        let payload: any = { ...editingEntity };
        // Clean up internal `type` property before sending
        delete payload.type;

        // Convert price from ZAR float to cents for items
        if ('priceZar' in payload) {
            payload.priceCents = Math.round(parseFloat(payload.priceZar || '0') * 100);
            delete payload.priceZar;
        }
        
        // Convert modifier item prices
        if (payload.items) {
            payload.items = payload.items.map((item: any) => {
                const priceDeltaCents = Math.round(parseFloat(item.priceDeltaZar || '0') * 100);
                delete item.priceDeltaZar;
                return { ...item, priceDeltaCents };
            });
        }
        
        await adminUpsertMenuEntity({ entity: editingEntity.type as any, data: payload });
        toast({ title: `${editingEntity.type.replace('_', ' ')} saved successfully` });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Save failed', description: error.message });
    }
  };

  const renderEditor = () => {
    if (!editingEntity) return <p className="text-sm text-muted-foreground text-center pt-10">Select an item to edit.</p>;

    switch (editingEntity.type) {
        case 'category':
            return <CategoryEditor category={editingEntity} onFormChange={handleFormChange} />;
        case 'item':
            return <ItemEditor item={editingEntity} modifierGroups={modifierGroups} onFormChange={handleFormChange} />;
        case 'modifier_group':
            return <ModifierGroupEditor modifierGroup={editingEntity} onFormChange={handleFormChange} />;
        default:
            return null;
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
            {/* Column 1: Categories / Modifiers */}
            <div className="border-r pr-6">
              <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="categories">Categories</TabsTrigger>
                    <TabsTrigger value="modifiers">Modifiers</TabsTrigger>
                </TabsList>
                <TabsContent value="categories" className="space-y-2 pt-2">
                    <Button variant="ghost" size="sm" onClick={() => handleAddNew('category')} className="w-full justify-start"><PlusCircle className="mr-2 h-4 w-4"/> Add Category</Button>
                    {categories.map(cat => (
                        <Button key={cat.id} variant={selectedId === cat.id ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => handleSelectMaster(cat.id)}>
                            {cat.name}
                        </Button>
                    ))}
                </TabsContent>
                <TabsContent value="modifiers" className="space-y-2 pt-2">
                    <Button variant="ghost" size="sm" onClick={() => handleAddNew('modifier_group')} className="w-full justify-start"><PlusCircle className="mr-2 h-4 w-4"/> Add Modifier Group</Button>
                    {modifierGroups.map(mod => (
                        <Button key={mod.id} variant={selectedId === mod.id ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => handleSelectMaster(mod.id)}>
                            {mod.name}
                        </Button>
                    ))}
                </TabsContent>
              </Tabs>
            </div>

            {/* Column 2: Items */}
            <div className="border-r pr-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">{activeTab === 'categories' ? 'Menu Items' : 'Details'}</h3>
                {activeTab === 'categories' && <Button variant="ghost" size="sm" onClick={() => handleAddNew('item')} disabled={!selectedId}><PlusCircle className="mr-2 h-4 w-4"/> Add Item</Button>}
                {activeTab === 'modifiers' && <Button variant="ghost" size="sm" onClick={handleEditMaster} disabled={!selectedId}>Edit Group</Button>}
              </div>
              {activeTab === 'categories' ? (
                selectedId ? (
                  <div className="space-y-2">
                      <Button variant="ghost" className="w-full justify-start font-semibold" onClick={handleEditMaster}>Edit Category Details</Button>
                      <hr className="my-2"/>
                      {itemsInCategory.map(item => (
                          <Button key={item.id} variant={editingEntity?.id === item.id ? 'secondary' : 'ghost'} className="w-full justify-between" onClick={() => handleSelectItem(item)}>
                              <span>{item.name}</span>
                              <span>{fmtZAR(item.priceCents)}</span>
                          </Button>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center pt-10">Select a category to see items.</p>
                )
              ) : (
                  <p className="text-sm text-muted-foreground text-center pt-10">Select a modifier group to see details.</p>
              )}
            </div>

            {/* Column 3: Editor */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Editor</h3>
                <Button size="sm" onClick={handleSave} disabled={!editingEntity}><Save className="mr-2 h-4 w-4" /> Save</Button>
              </div>
              {renderEditor()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    