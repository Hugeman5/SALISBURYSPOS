
'use client';

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Item, ModifierGroup } from "@/types/pos";
import { Checkbox } from "@/components/ui/checkbox";

interface ItemEditorProps {
    item: Item & { type: 'item' };
    modifierGroups: ModifierGroup[];
    onFormChange: (field: string, value: any) => void;
}

export function ItemEditor({ item, modifierGroups, onFormChange }: ItemEditorProps) {
    const handleModifierChange = (modId: string, checked: boolean) => {
        const currentIds = item.modifierGroupIds || [];
        const newIds = checked
            ? [...currentIds, modId]
            : currentIds.filter(id => id !== modId);
        onFormChange('modifierGroupIds', newIds);
    };
    
    return (
        <div className="space-y-4">
            <div>
                <Label>Item Name</Label>
                <Input value={item.name} onChange={e => onFormChange('name', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                 <div>
                    <Label>SKU</Label>
                    <Input value={item.sku || ''} onChange={e => onFormChange('sku', e.target.value)} />
                </div>
                 <div>
                    <Label>Price (ZAR)</Label>
                    <Input type="number" 
                           value={(item.priceCents / 100).toFixed(2)} 
                           onChange={e => onFormChange('priceCents', Math.round(parseFloat(e.target.value) * 100))} />
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <Switch id="item-active" checked={item.active} onCheckedChange={c => onFormChange('active', c)} />
                <Label htmlFor="item-active">Active</Label>
            </div>
            <div>
                <Label>Modifier Groups</Label>
                <div className="space-y-2 mt-2 border rounded-md p-2 max-h-48 overflow-y-auto">
                    {modifierGroups.map(mod => (
                        <div key={mod.id} className="flex items-center space-x-2">
                            <Checkbox
                                id={`mod-${mod.id}`}
                                checked={(item.modifierGroupIds || []).includes(mod.id)}
                                onCheckedChange={(checked) => handleModifierChange(mod.id, !!checked)}
                            />
                            <Label htmlFor={`mod-${mod.id}`} className="font-normal">{mod.name}</Label>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
