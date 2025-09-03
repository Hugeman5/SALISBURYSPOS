
'use client';

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ModifierGroup } from "@/types/pos";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2 } from "lucide-react";

interface ModifierGroupEditorProps {
    modifierGroup: ModifierGroup & { type: 'modifier_group' };
    onFormChange: (field: string, value: any) => void;
}

export function ModifierGroupEditor({ modifierGroup, onFormChange }: ModifierGroupEditorProps) {
    
    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...modifierGroup.items];
        newItems[index] = { ...newItems[index], [field]: value };
        onFormChange('items', newItems);
    };

    const addNewItem = () => {
        const newItems = [...(modifierGroup.items || []), { name: '', priceDeltaCents: 0, active: true }];
        onFormChange('items', newItems);
    };
    
    const removeItem = (index: number) => {
        const newItems = modifierGroup.items.filter((_, i) => i !== index);
        onFormChange('items', newItems);
    };
    
    return (
        <div className="space-y-4">
            <div>
                <Label>Group Name</Label>
                <Input value={modifierGroup.name} onChange={e => onFormChange('name', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Min Selection</Label>
                    <Input type="number" value={modifierGroup.min} onChange={e => onFormChange('min', Number(e.target.value))} />
                </div>
                 <div>
                    <Label>Max Selection</Label>
                    <Input type="number" value={modifierGroup.max} onChange={e => onFormChange('max', Number(e.target.value))} />
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <Switch id="mod-active" checked={modifierGroup.active} onCheckedChange={c => onFormChange('active', c)} />
                <Label htmlFor="mod-active">Active</Label>
            </div>
            <div>
                <Label>Options</Label>
                <div className="space-y-2 mt-2 border rounded-md p-2 max-h-60 overflow-y-auto">
                    {(modifierGroup.items || []).map((item, index) => (
                        <div key={item.id || index} className="flex items-center gap-2">
                           <Input
                             placeholder="Option name"
                             value={item.name}
                             onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                           />
                           <Input
                             type="number"
                             placeholder="Price +/-"
                             className="w-28"
                             value={(item as any).priceDeltaZar ?? (item.priceDeltaCents / 100).toFixed(2)}
                             onChange={(e) => handleItemChange(index, 'priceDeltaZar', e.target.value)}
                           />
                           <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                               <Trash2 className="h-4 w-4"/>
                           </Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addNewItem} className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4"/> Add Option
                    </Button>
                </div>
            </div>
        </div>
    );
}
